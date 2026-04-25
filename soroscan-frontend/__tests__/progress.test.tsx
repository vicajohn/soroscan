import React from "react"
import { render, screen } from "@testing-library/react"

import {
  Progress,
  clampProgressValue,
  getProgressWidth,
} from "@/components/ui/progress"

describe("progress helpers", () => {
  it("clamps values below 0 to 0", () => {
    expect(clampProgressValue(-12)).toBe(0)
    expect(getProgressWidth(-12)).toBe("0%")
  })

  it("clamps values above 100 to 100", () => {
    expect(clampProgressValue(144)).toBe(100)
    expect(getProgressWidth(144)).toBe("100%")
  })

  it("keeps values inside range unchanged", () => {
    expect(clampProgressValue(37)).toBe(37)
    expect(getProgressWidth(37)).toBe("37%")
  })
})

describe("Progress", () => {
  it("renders the percentage and fills to the expected width", () => {
    render(<Progress value={42} label="Upload progress" />)

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42")
    expect(screen.getByText("Upload progress")).toBeInTheDocument()
    expect(screen.getByText("42%")).toBeInTheDocument()
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({
      width: "42%",
    })
  })

  it("renders labels inside the bar when requested", () => {
    render(
      <Progress
        value={65}
        label="Sync"
        labelPosition="inside"
      />,
    )

    expect(screen.getByText("Sync")).toBeInTheDocument()
    expect(screen.getByText("65%")).toBeInTheDocument()
  })

  it.each([
    ["success", "[--progress-color:theme(colors.terminal-green)]"],
    ["warning", "[--progress-color:theme(colors.terminal-warning)]"],
    ["danger", "[--progress-color:theme(colors.terminal-danger)]"],
  ])("applies the %s variant color", (variant, expectedClass) => {
    render(<Progress value={25} variant={variant as "success" | "warning" | "danger"} />)

    expect(screen.getByRole("progressbar")).toHaveClass(expectedClass)
  })

  it("exposes an indeterminate progressbar state without valuenow", () => {
    render(<Progress indeterminate label="Loading data" />)

    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-busy", "true")
    expect(bar).not.toHaveAttribute("aria-valuenow")
    expect(bar).toHaveAttribute("aria-valuetext", "Loading")
  })
})
