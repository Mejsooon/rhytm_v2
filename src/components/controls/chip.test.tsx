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

  it("wyłączony wybrany chip nie zmienia tła po najechaniu", () => {
    render(
      <>
        <Chip selected disabled>
          Pn
        </Chip>
        <Chip disabled>Wt</Chip>
        <Chip selected variant="solid" disabled>
          Śr
        </Chip>
      </>,
    );
    const wybrany = screen.getByRole("button", { name: "Pn" });
    const zwykly = screen.getByRole("button", { name: "Wt" });
    const pelny = screen.getByRole("button", { name: "Śr" });
    for (const chip of [wybrany, zwykly, pelny]) {
      // Tło po najechaniu tylko dla włączonego chipa (bez disabled:hover:bg-white)
      expect(chip.className).not.toContain("disabled:hover:");
      expect(chip.className).not.toMatch(/(^|\s)hover:bg-/);
    }
    expect(wybrany).toHaveClass("enabled:hover:bg-muted");
    expect(zwykly).toHaveClass("enabled:hover:bg-panel");
    expect(pelny).toHaveClass("enabled:hover:bg-primary-hover");
  });

  it("dashed (+ Nowa) jak w makiecie: przerywana ramka, szary tekst, bez cienia", () => {
    render(<Chip dashed>+ Nowa</Chip>);
    expect(screen.getByRole("button", { name: "+ Nowa" })).toHaveClass(
      "border-dashed",
      "text-muted-foreground",
      "shadow-none",
    );
  });
});
