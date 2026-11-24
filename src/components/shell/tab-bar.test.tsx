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
      "pl-[max(6px,env(safe-area-inset-left))]",
    );
    expect(pasek.className).toContain(
      "pr-[max(6px,env(safe-area-inset-right))]",
    );
  });

  it("A1: /hasla i /hasla/... zaznaczają „Strony” (Hasła nie mają zakładki)", () => {
    for (const s of ["/hasla", "/hasla/nowe"]) {
      sciezka = s;
      const { unmount } = render(<TabBar />);
      expect(screen.getByRole("link", { name: "Strony" })).toHaveAttribute("aria-current", "page");
      expect(screen.getAllByRole("link").filter((l) => l.hasAttribute("aria-current"))).toHaveLength(1);
      unmount();
    }
    // Sam prefiks bez ukośnika nie łapie innych tras
    sciezka = "/haslaxyz";
    render(<TabBar />);
    expect(screen.getByRole("link", { name: "Strony" })).not.toHaveAttribute("aria-current");
  });

  it("wygląd według CMTabBar: tło --sidebar, zakładki 44 px, aktywna z tłem, ikony 20 px", () => {
    sciezka = "/sport";
    render(<TabBar />);
    const pasek = screen.getByRole("navigation", { name: "Moduły" });
    expect(pasek).toHaveClass("bg-sidebar", "border-sidebar-border", "gap-0.5", "pt-1.5", "text-[11px]");
    const aktywna = screen.getByRole("link", { name: "Sport" });
    expect(aktywna).toHaveClass("min-h-11", "rounded-lg", "font-medium", "gap-[3px]", "bg-black/5", "text-foreground");
    const nieaktywna = screen.getByRole("link", { name: "Dziś" });
    expect(nieaktywna).toHaveClass("min-h-11", "text-[rgba(38,38,38,.68)]");
    expect(nieaktywna).not.toHaveClass("bg-black/5");
    const ikona = aktywna.querySelector("svg")!;
    expect(ikona).toHaveAttribute("width", "20");
    expect(ikona).toHaveAttribute("height", "20");
  });
});
