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
    expect(linki.map((l) => l.textContent)).toEqual(["Dziś", "Kalendarz", "Sport", "Nawyki", "Strony"]);
    expect(screen.getByRole("link", { name: "Strony" })).toHaveAttribute("href", "/strony");
  });

  it("oznacza aktywną pozycję aria-current na /strony", () => {
    sciezka = "/strony";
    render(<TabBar />);
    expect(screen.getByRole("link", { name: "Strony" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dziś" })).not.toHaveAttribute("aria-current");
  });
});
