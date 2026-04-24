import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"

import { Tooltip } from "@/components/ui/tooltip"

describe("Tooltip", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    })
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 768,
    })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  function renderTooltip(placement: "top" | "bottom" | "left" | "right" = "top") {
    return render(
      <Tooltip content={<span>Helpful tip</span>} placement={placement} delay={250}>
        <button type="button">Hover me</button>
      </Tooltip>
    )
  }

  it("shows on hover after the configured delay", () => {
    renderTooltip()

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover me" }))
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(screen.getByRole("tooltip")).toHaveTextContent("Helpful tip")
  })

  it("dismisses when clicking outside", () => {
    renderTooltip()

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover me" }))
    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(screen.getByRole("tooltip")).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("falls back to the opposite side when there is no space", () => {
    renderTooltip("top")

    const trigger = screen.getByRole("button", { name: "Hover me" })
    const wrapper = trigger.closest('[data-slot="tooltip-trigger"]') as HTMLElement
    expect(wrapper).not.toBeNull()
    jest.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
      x: 80,
      y: 6,
      top: 6,
      left: 80,
      bottom: 42,
      right: 160,
      width: 80,
      height: 36,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.mouseEnter(trigger)
    act(() => {
      jest.advanceTimersByTime(250)
    })

    const tooltip = screen.getByRole("tooltip")
    expect(tooltip).toHaveAttribute("data-placement", "bottom")
  })

  it("positions to the left when requested and space is available", () => {
    renderTooltip("left")

    const trigger = screen.getByRole("button", { name: "Hover me" })
    const wrapper = trigger.closest('[data-slot="tooltip-trigger"]') as HTMLElement
    expect(wrapper).not.toBeNull()
    jest.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
      x: 700,
      y: 200,
      top: 200,
      left: 700,
      bottom: 236,
      right: 780,
      width: 80,
      height: 36,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.mouseEnter(trigger)
    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(screen.getByRole("tooltip")).toHaveAttribute("data-placement", "left")
  })
})
