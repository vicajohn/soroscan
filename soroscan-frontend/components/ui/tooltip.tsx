"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

export type TooltipPlacement = "top" | "bottom" | "left" | "right"

export interface TooltipProps {
  children: React.ReactElement
  content: React.ReactNode
  placement?: TooltipPlacement
  delay?: number
  className?: string
  contentClassName?: string
  arrowClassName?: string
  offset?: number
}

type Coordinates = {
  top: number
  left: number
  placement: TooltipPlacement
  arrowStyle: React.CSSProperties
}

const TOOLTIP_OFFSET = 10
const VIEWPORT_PADDING = 8

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getPlacementFromRect(
  preferredPlacement: TooltipPlacement,
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  offset: number,
): Coordinates {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const fitsTop = triggerRect.top >= tooltipRect.height + offset + VIEWPORT_PADDING
  const fitsBottom =
    viewportHeight - triggerRect.bottom >= tooltipRect.height + offset + VIEWPORT_PADDING
  const fitsLeft = triggerRect.left >= tooltipRect.width + offset + VIEWPORT_PADDING
  const fitsRight =
    viewportWidth - triggerRect.right >= tooltipRect.width + offset + VIEWPORT_PADDING

  let placement: TooltipPlacement = preferredPlacement

  if (preferredPlacement === "top" && !fitsTop && fitsBottom) placement = "bottom"
  else if (preferredPlacement === "bottom" && !fitsBottom && fitsTop) placement = "top"
  else if (preferredPlacement === "left" && !fitsLeft && fitsRight) placement = "right"
  else if (preferredPlacement === "right" && !fitsRight && fitsLeft) placement = "left"
  else if (preferredPlacement === "top" && !fitsTop && !fitsBottom) placement = "bottom"
  else if (preferredPlacement === "bottom" && !fitsBottom && !fitsTop) placement = "top"
  else if (preferredPlacement === "left" && !fitsLeft && !fitsRight) placement = "right"
  else if (preferredPlacement === "right" && !fitsRight && !fitsLeft) placement = "left"

  const centeredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
  const centeredTop = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2

  const next: Coordinates = {
    placement,
    top: 0,
    left: 0,
    arrowStyle: {},
  }

  if (placement === "top" || placement === "bottom") {
    const top =
      placement === "top"
        ? triggerRect.top - tooltipRect.height - offset
        : triggerRect.bottom + offset
    const left = clamp(
      centeredLeft,
      VIEWPORT_PADDING,
      viewportWidth - tooltipRect.width - VIEWPORT_PADDING,
    )

    next.top = top
    next.left = left
    next.arrowStyle = {
      left: clamp(
        triggerRect.left + triggerRect.width / 2 - left - 6,
        12,
        tooltipRect.width - 12,
      ),
    }
  } else {
    const left =
      placement === "left"
        ? triggerRect.left - tooltipRect.width - offset
        : triggerRect.right + offset
    const top = clamp(
      centeredTop,
      VIEWPORT_PADDING,
      viewportHeight - tooltipRect.height - VIEWPORT_PADDING,
    )

    next.top = top
    next.left = left
    next.arrowStyle = {
      top: clamp(
        triggerRect.top + triggerRect.height / 2 - top - 6,
        12,
        tooltipRect.height - 12,
      ),
    }
  }

  return next
}

export function Tooltip({
  children,
  content,
  placement = "top",
  delay = 300,
  className,
  contentClassName,
  arrowClassName,
  offset = TOOLTIP_OFFSET,
}: TooltipProps) {
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const tooltipRef = React.useRef<HTMLDivElement | null>(null)
  const delayTimerRef = React.useRef<number | null>(null)
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [coords, setCoords] = React.useState<Coordinates | null>(null)

  React.useEffect(() => {
    setMounted(true)
    return () => {
      if (delayTimerRef.current) {
        window.clearTimeout(delayTimerRef.current)
      }
    }
  }, [])

  const close = React.useCallback(() => {
    if (delayTimerRef.current) {
      window.clearTimeout(delayTimerRef.current)
      delayTimerRef.current = null
    }
    setOpen(false)
    setCoords(null)
  }, [])

  const updatePosition = React.useCallback(() => {
    const triggerEl = triggerRef.current
    const tooltipEl = tooltipRef.current

    if (!triggerEl || !tooltipEl) return

    const triggerRect = triggerEl.getBoundingClientRect()
    const tooltipRect = tooltipEl.getBoundingClientRect()
    const next = getPlacementFromRect(placement, triggerRect, tooltipRect, offset)

    setCoords(next)
  }, [offset, placement])

  React.useEffect(() => {
    if (!open) return

    updatePosition()

    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) {
        return
      }
      close()
    }

    const handleReposition = () => updatePosition()

    document.addEventListener("mousedown", handleOutside)
    window.addEventListener("resize", handleReposition)
    window.addEventListener("scroll", handleReposition, true)

    return () => {
      document.removeEventListener("mousedown", handleOutside)
      window.removeEventListener("resize", handleReposition)
      window.removeEventListener("scroll", handleReposition, true)
    }
  }, [close, open, updatePosition])

  const scheduleOpen = () => {
    if (delayTimerRef.current) {
      window.clearTimeout(delayTimerRef.current)
    }

    delayTimerRef.current = window.setTimeout(() => {
      setOpen(true)
    }, delay)
  }

  const renderPlacement = coords?.placement ?? placement
  const trigger = (
    <span
      ref={triggerRef}
      className="inline-flex"
      data-slot="tooltip-trigger"
      onMouseEnter={scheduleOpen}
      onMouseLeave={close}
      onFocus={scheduleOpen}
      onBlur={close}
    >
      {children}
    </span>
  )

  return (
    <>
      {trigger}
      {mounted && open
        ? createPortal(
            <div
              ref={tooltipRef}
              id="tooltip-content"
              role="tooltip"
              data-placement={renderPlacement}
              className={cn(
                "fixed z-50 max-w-xs rounded-md border border-terminal-green/30",
                "bg-terminal-black/95 px-3 py-2 text-xs text-terminal-green shadow-glow-green backdrop-blur-sm",
                "font-terminal-mono tracking-wide",
                "transition-opacity duration-150",
                coords ? "opacity-100" : "opacity-0",
                className,
                contentClassName,
              )}
              style={
                coords
                  ? { top: coords.top, left: coords.left }
                  : { top: -9999, left: -9999, visibility: "hidden" }
              }
            >
              <div
                aria-hidden="true"
                className={cn(
                  "absolute size-3 rotate-45 border-terminal-green/30 bg-terminal-black/95",
                  renderPlacement === "top"
                    ? "bottom-[-6px] border-b border-r"
                    : renderPlacement === "bottom"
                      ? "top-[-6px] border-t border-l"
                      : renderPlacement === "left"
                        ? "right-[-6px] border-t border-r"
                        : "left-[-6px] border-b border-l",
                  arrowClassName,
                )}
                style={
                  coords && (renderPlacement === "top" || renderPlacement === "bottom")
                    ? { left: coords.arrowStyle.left }
                    : coords
                      ? { top: coords.arrowStyle.top }
                      : undefined
                }
              />
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
