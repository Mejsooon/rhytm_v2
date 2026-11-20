import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chip } from "./chip";

describe("Chip", () => {
  it("domyślnie zaznaczony ma szare tło (bg-muted)", () => {
    render(<Chip selected>Pn</Chip>);
    const chip = screen.getByRole("button", { name: "Pn" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toHaveClass("bg-muted");
    expect(chip).not.toHaveClass("bg-primary");
    expect(chip).not.toHaveClass("bg-white");
  });

  it("variant solid: zaznaczony wypełniony na czarno z białym tekstem", () => {
    render(
      <Chip selected variant="solid">
        Pn
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Pn" });
    expect(chip).toHaveClass(
      "bg-primary",
      "border-primary",
      "text-primary-foreground",
    );
    expect(chip).not.toHaveClass("bg-white");
    expect(chip).not.toHaveClass("text-foreground");
  });

  it("variant solid bez zaznaczenia wygląda jak zwykły chip", () => {
    render(<Chip variant="solid">Wt</Chip>);
    const chip = screen.getByRole("button", { name: "Wt" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip).toHaveClass("bg-white");
    expect(chip).not.toHaveClass("bg-primary");
  });
});
