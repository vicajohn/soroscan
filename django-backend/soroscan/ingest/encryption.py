"""
AES-256-GCM application-level encryption for event payloads.
Implements envelope encryption.
"""
import base64
import json
import logging
import os
from functools import lru_cache

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings

logger = logging.getLogger(__name__)


def get_master_key() -> bytes:
    master_key_b64 = getattr(settings, "EVENT_ENCRYPTION_MASTER_KEY", "")
    if not master_key_b64:
        raise ValueError("EVENT_ENCRYPTION_MASTER_KEY is not configured")
    try:
        key = base64.b64decode(master_key_b64)
    except Exception as e:
        raise ValueError(f"EVENT_ENCRYPTION_MASTER_KEY is not valid base64: {e}")
    if len(key) != 32:
        raise ValueError("EVENT_ENCRYPTION_MASTER_KEY must be exactly 32 bytes after base64 decoding")
    return key


@lru_cache(maxsize=128)
def get_dek(version: int) -> bytes:
    """Fetch and decrypt the Data Encryption Key for the given version."""
    from .models import EncryptionKey
    try:
        key_record = EncryptionKey.objects.get(version=version)
    except EncryptionKey.DoesNotExist:
        raise ValueError(f"Encryption key version {version} not found")
    
    master_key = get_master_key()
    aesgcm = AESGCM(master_key)
    
    # The stored encrypted DEK contains the nonce + ciphertext
    encrypted_dek = key_record.encrypted_key
    if isinstance(encrypted_dek, memoryview):
        encrypted_dek = encrypted_dek.tobytes()

    nonce = encrypted_dek[:12]
    ciphertext = encrypted_dek[12:]
    
    try:
        dek = aesgcm.decrypt(nonce, ciphertext, None)
    except Exception as e:
        logger.error(f"Failed to decrypt DEK version {version}")
        raise ValueError("Master key failed to decrypt the Data Encryption Key") from e
    
    return dek


def get_active_key_version() -> int:
    """Returns the version of the currently active EncryptionKey, generating one if none exist."""
    from .models import EncryptionKey
    active_key = EncryptionKey.objects.filter(is_active=True).first()
    if active_key:
        return active_key.version
    
    # If no active key exists, we create the first one
    logger.info("No active encryption key found. Generating initial key.")
    return rotate_encryption_key(performed_by=None)


def rotate_encryption_key(performed_by=None) -> int:
    """Generates and activates a new DEK, returning its version."""
    from .models import EncryptionKey, KeyRotationLog
    from django.db import transaction

    master_key = get_master_key()
    aesgcm = AESGCM(master_key)
    
    # Generate new DEK
    new_dek = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(12)
    encrypted_dek = nonce + aesgcm.encrypt(nonce, new_dek, None)
    
    with transaction.atomic():
        # Deactivate all other keys
        EncryptionKey.objects.update(is_active=False)
        
        # Calculate new version
        latest_key = EncryptionKey.objects.order_by('-version').first()
        new_version = (latest_key.version + 1) if latest_key else 1
        
        # Save new key
        new_key = EncryptionKey.objects.create(
            version=new_version,
            encrypted_key=encrypted_dek,
            is_active=True
        )
        
        # Log rotation
        KeyRotationLog.objects.create(
            action="Generated Initial" if new_version == 1 else "Rotated",
            key_version=new_version,
            performed_by=performed_by,
        )
        
    return new_version


def encrypt_payload(data: dict) -> dict:
    """Encrypts a dictionary into an envelope using the active DEK."""
    if data is None:
        return None
        
    version = get_active_key_version()
    dek = get_dek(version)
    
    aesgcm = AESGCM(dek)
    nonce = os.urandom(12)
    
    try:
        json_bytes = json.dumps(data).encode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to serialize payload to JSON: {e}")
        
    ciphertext = aesgcm.encrypt(nonce, json_bytes, None)
    
    # Store nonce + ciphertext
    encrypted_blob = nonce + ciphertext
    encrypted_b64 = base64.b64encode(encrypted_blob).decode("ascii")
    
    return {
        "_ev": version,
        "data": encrypted_b64
    }


def decrypt_payload(envelope: dict) -> dict:
    """Decrypts an envelope dictionary back to the original dictionary."""
    if not envelope:
        return envelope
        
    # If it's not an envelope, return as is (to support legacy unencrypted data)
    if not isinstance(envelope, dict) or "_ev" not in envelope or "data" not in envelope:
        return envelope
        
    version = envelope["_ev"]
    encrypted_b64 = envelope["data"]
    
    try:
        dek = get_dek(version)
    except Exception as e:
        logger.error(f"Failed to retrieve DEK for version {version}: {e}")
        return {"_error": f"Missing decryption key v{version}"}
        
    try:
        encrypted_blob = base64.b64decode(encrypted_b64)
    except Exception as e:
        logger.error(f"Invalid base64 in encrypted payload: {e}")
        return {"_error": "Corrupt encrypted data"}
        
    if len(encrypted_blob) < 12:  # Nonce alone is 12 bytes
        return {"_error": "Ciphertext too short"}
        
    nonce = encrypted_blob[:12]
    ciphertext = encrypted_blob[12:]
    aesgcm = AESGCM(dek)
    
    try:
        json_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return json.loads(json_bytes.decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to decrypt payload with key v{version}: {e}")
        return {"_error": "Decryption failed"}
