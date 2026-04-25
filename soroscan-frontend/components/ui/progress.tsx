"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressVariants = cva(
  "relative overflow-hidden rounded-full border border-terminal-green/25 bg-terminal-black/90",
  {
    variants: {
      variant: {
        success: "[--progress-color:theme(colors.terminal-green)]",
        warning: "[--progress-color:theme(colors.terminal-warning)]",
        danger: "[--progress-color:theme(colors.terminal-danger)]",
      },
      size: {
        sm: "h-2",
        md: "h-3",
        lg: "h-4",
      },
    },
    defaultVariants: {
      variant: "success",
      size: "md",
    },
  },
)

const fillVariants = cva(
  "h-full rounded-full bg-[var(--progress-color)] shadow-[0_0_18px_var(--progress-color)] transition-[width,transform] duration-300 ease-out",
  {
    variants: {
      indeterminate: {
        true: "absolute left-0 top-0 w-2/5 animate-[progress-indeterminate_1.4s_ease-in-out_infinite]",
        false: "relative",
      },
    },
    defaultVariants: {
      indeterminate: false,
    },
  },
)

export type ProgressVariant = "success" | "warning" | "danger"
export type ProgressLabelPosition = "top" | "inside"

export interface ProgressProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof progressVariants> {
  value?: number
  label?: React.ReactNode
  labelPosition?: ProgressLabelPosition
  showPercentage?: boolean
  indeterminate?: boolean
  ariaLabel?: string
}

export function clampProgressValue(value: number | undefined | null) {
  if (!Number.isFinite(value ?? NaN)) return 0
  return Math.min(100, Math.max(0, Number(value)))
}

export function getProgressWidth(value: number | undefined | null) {
  return `${clampProgressValue(value)}%`
}

function formatProgressText(value: number) {
  return `${value}%`
}

export function Progress({
  className,
  value = 0,
  label,
  labelPosition = "top",
  showPercentage = true,
  indeterminate = false,
  ariaLabel,
  variant,
  size,
  ...props
}: ProgressProps) {
  const progressValue = clampProgressValue(value)
  const progressText = formatProgressText(progressValue)
  const showTopLabel = Boolean(label) && labelPosition === "top"
  const showInsideLabel = Boolean(label) && labelPosition === "inside"

  return (
    <div className={cn("grid gap-1.5", className)}>
      {showTopLabel ? (
        <div className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide text-terminal-cyan">
          <span className="truncate">{label}</span>
          {showPercentage ? <span className="shrink-0">{progressText}</span> : null}
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-label={ariaLabel ?? (typeof label === "string" ? label : "Progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : progressValue}
        aria-valuetext={indeterminate ? "Loading" : progressText}
        aria-busy={indeterminate || undefined}
        data-indeterminate={indeterminate ? "true" : "false"}
        data-value={progressValue}
        className={cn(progressVariants({ variant, size }))}
        {...props}
      >
        <div
          className={cn(fillVariants({ indeterminate }))}
          style={
            indeterminate
              ? {
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,0) 0%, var(--progress-color) 35%, rgba(255,255,255,0.35) 50%, var(--progress-color) 65%, rgba(0,0,0,0) 100%)",
                }
              : {
                  width: getProgressWidth(progressValue),
                  background:
                    "linear-gradient(90deg, color-mix(in srgb, var(--progress-color) 82%, white), var(--progress-color))",
                }
          }
        >
          {showInsideLabel ? (
            <span className="absolute inset-0 flex items-center justify-between gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/80 mix-blend-screen">
              <span className="truncate">{label}</span>
              {showPercentage ? <span className="shrink-0">{progressText}</span> : null}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
