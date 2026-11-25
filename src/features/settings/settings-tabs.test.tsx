import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SETTINGS_TABS, SettingsTabs } from "./settings-tabs";

describe("SettingsTabs", () => {
  it("ma 5 zakładek z właściwymi adresami", () => {
    expect(SETTINGS_TABS.map((t) => t.slug)).toEqual([
      "ogolne",
      "konto",
      "sejf",
      "powiadomienia",
      "kategorie",
    ]);
    render(<SettingsTabs active="ogolne" />);
    const nav = screen.getByRole("navigation", { name: "Sekcje ustawień" });
    expect(nav.querySelectorAll("a")).toHaveLength(5);
    expect(
      screen.getByRole("link", { name: "Konto i bezpieczeństwo" }),
    ).toHaveAttribute("href", "/ustawienia/konto");
  });

  it("aktywna zakładka ma aria-current", () => {
    render(<SettingsTabs active="sejf" />);
    expect(screen.getByRole("link", { name: "Sejf" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Ogólne" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("SETTINGS_TABS: tylko Ogólne ma podtytuł z makiety", () => {
    expect(SETTINGS_TABS.find((t) => t.slug === "ogolne")?.description).toBe(
      "Profil, cele i podstawowe preferencje aplikacji.",
    );
    const reszta = SETTINGS_TABS.filter((t) => t.slug !== "ogolne");
    for (const t of reszta) {
      expect(t.description).toBeUndefined();
    }
  });

  it("zakładka: wysokość 32 px, zaokrąglenie 8 px, aktywna z tłem i aria-current", () => {
    render(<SettingsTabs active="ogolne" />);
    const aktywna = screen.getByRole("link", { name: "Ogólne" });
    expect(aktywna).toHaveAttribute("aria-current", "page");
    expect(aktywna).toHaveClass("min-[800px]:h-8", "rounded-lg", "font-medium", "bg-active");
    const nieaktywna = screen.getByRole("link", { name: "Sejf" });
    expect(nieaktywna).toHaveClass("min-[800px]:h-8", "rounded-lg", "font-medium", "hover:bg-hover");
    expect(nieaktywna).not.toHaveClass("bg-active");
  });

  it("telefon: poziomy pasek ukryty (zakładki są w indeksie /ustawienia)", () => {
    render(<SettingsTabs active="ogolne" />);
    expect(
      screen.getByRole("navigation", { name: "Sekcje ustawień" }),
    ).toHaveClass("max-[799px]:hidden");
  });

  it("każda zakładka ma opis do indeksu telefonu", () => {
    for (const t of SETTINGS_TABS) expect(t.phoneHint.length).toBeGreaterThan(0);
  });
});
