import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SETTINGS_TABS, SettingsTabs } from "./settings-tabs";

describe("SettingsTabs", () => {
  it("ma 5 zakładek z właściwymi adresami", () => {
    expect(SETTINGS_TABS.map((t) => t.slug)).toEqual(["ogolne", "konto", "sejf", "powiadomienia", "kategorie"]);
    render(<SettingsTabs active="ogolne" />);
    const nav = screen.getByRole("navigation", { name: "Sekcje ustawień" });
    expect(nav.querySelectorAll("a")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Konto i bezpieczeństwo" })).toHaveAttribute("href", "/ustawienia/konto");
  });

  it("aktywna zakładka ma aria-current", () => {
    render(<SettingsTabs active="sejf" />);
    expect(screen.getByRole("link", { name: "Sejf" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ogólne" })).not.toHaveAttribute("aria-current");
  });
});
