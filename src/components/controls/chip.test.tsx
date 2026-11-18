import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chip } from "./chip";

describe("Chip", () => {
  it("domyślnie zaznaczony ma ciemną ramkę na białym tle", () => {
    render(<Chip selected>Pn</Chip>);
    const chip = screen.getByRole("button", { name: "Pn" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toHaveClass("border-[#171717]", "bg-white", "font-medium");
    expect(chip).not.toHaveClass("bg-[#171717]");
  });

  it("variant solid: zaznaczony wypełniony na czarno z białym tekstem", () => {
    render(
      <Chip selected variant="solid">
        Pn
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Pn" });
    expect(chip).toHaveClass("bg-[#171717]", "border-[#171717]", "text-white");
    expect(chip).not.toHaveClass("bg-white");
    expect(chip).not.toHaveClass("text-[#404040]");
  });

  it("variant solid bez zaznaczenia wygląda jak zwykły chip", () => {
    render(<Chip variant="solid">Wt</Chip>);
    const chip = screen.getByRole("button", { name: "Wt" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip).toHaveClass("bg-white");
    expect(chip).not.toHaveClass("bg-[#171717]");
  });
});
