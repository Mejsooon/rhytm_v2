import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Progress } from "./progress";

describe("Progress", () => {
  it("pokazuje wartość i szerokość wypełnienia", () => {
    render(<Progress value={2} max={4} ariaLabel="Zadania" />);
    const bar = screen.getByRole("progressbar", { name: "Zadania" });
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("50%");
  });

  it("przy max 0 szerokość to 0% bez NaN", () => {
    render(<Progress value={0} max={0} ariaLabel="Puste" />);
    const bar = screen.getByRole("progressbar", { name: "Puste" });
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("0%");
  });
});
