import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let sciezka = "/dzis";
vi.mock("next/navigation", () => ({ usePathname: () => sciezka }));

import { TabBar } from "./tab-bar";

describe("TabBar", () => {
  beforeEach(() => {
    sciezka = "/dzis";
  });

  it("ma 5 pozycji w kolejności Dziś, Kalendarz, Sport, Nawyki, Strony", () => {
    render(<TabBar />);
    const linki = screen.getAllByRole("link");
    expect(linki.map((l) => l.textContent)).toEqual([
      "Dziś",
      "Kalendarz",
      "Sport",
      "Nawyki",
      "Strony",
    ]);
    expect(screen.getByRole("link", { name: "Strony" })).toHaveAttribute(
      "href",
      "/strony",
    );
  });

  it("oznacza aktywną pozycję aria-current na /strony", () => {
    sciezka = "/strony";
    render(<TabBar />);
    expect(screen.getByRole("link", { name: "Strony" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dziś" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("wysokość z --tabbar-h (56 px + max(8 px, safe-area)), bez sztywnych 84 px", () => {
    render(<TabBar />);
    const pasek = screen.getByRole("navigation", { name: "Moduły" });
    expect(pasek.className).toContain("h-(--tabbar-h)");
    expect(pasek.className).toContain(
      "pb-[max(8px,env(safe-area-inset-bottom))]",
    );
    expect(pasek.className).not.toContain("84px");
    // Poziomo: boczne wcięcia ekranu (notch)
    expect(pasek.className).toContain(
      "pl-[max(4px,env(safe-area-inset-left))]",
    );
    expect(pasek.className).toContain(
      "pr-[max(4px,env(safe-area-inset-right))]",
    );
  });
});
