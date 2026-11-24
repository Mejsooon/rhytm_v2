import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Progress } from "./progress";

describe("Progress", () => {
  it("pokazuje wartość i szerokość wypełnienia", () => {
    render(<Progress value={2} max={4} ariaLabel="Zadania" />);
    const bar = screen.getByRole("progressbar", { name: "Zadania" });
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("50%");
    // Wypełnienie zielone jak na makietach COSS
    expect(bar.firstElementChild).toHaveClass("bg-success");
  });

  it("przy max 0 szerokość to 0% bez NaN", () => {
    render(<Progress value={0} max={0} ariaLabel="Puste" />);
    const bar = screen.getByRole("progressbar", { name: "Puste" });
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("0%");
  });

  it("przyjmuje własny kolor wypełnienia zamiast zielonego", () => {
    render(<Progress value={1} max={2} ariaLabel="Km" color="#f59e0b" />);
    const fill = screen.getByRole("progressbar", { name: "Km" })
      .firstElementChild as HTMLElement;
    expect(fill).not.toHaveClass("bg-success");
    expect(fill.style.background).toBe("rgb(245, 158, 11)");
  });
});
