import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/components/shell/sidebar-toggle", () => ({ SidebarToggle: () => null }));

import { MSettingsIndex } from "./m-settings-index";

function pokaz(avatarUrl: string | null = null) {
  return render(
    <MSettingsIndex name="mejson" email="m@example.com" avatarUrl={avatarUrl} version="0.1.0" />,
  );
}

describe("MSettingsIndex", () => {
  it("nagłówek: „Wstecz” → /dzis i tytuł Ustawienia", () => {
    pokaz();
    expect(screen.getByRole("link", { name: "Wstecz" })).toHaveAttribute("href", "/dzis");
    expect(screen.getByRole("heading", { name: "Ustawienia" })).toBeInTheDocument();
  });

  it("karta profilu: inicjał, nazwa, e-mail, link do Ogólne", () => {
    pokaz();
    const link = screen.getByRole("link", { name: /mejson.*m@example\.com/ });
    expect(link).toHaveAttribute("href", "/ustawienia/ogolne");
    expect(within(link).getByText("M")).toHaveClass("size-[52px]");
  });

  it("zdjęcie zamiast inicjału", () => {
    const { container } = pokaz("https://x/y.png");
    expect(container.querySelector("img")).toHaveClass("size-[52px]");
  });

  it("wiersze zakładek prowadzą do podstron", () => {
    pokaz();
    const nav = within(screen.getByRole("navigation", { name: "Sekcje ustawień" }));
    const hrefy = nav.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(hrefy).toEqual([
      "/ustawienia/ogolne",
      "/ustawienia/konto",
      "/ustawienia/sejf",
      "/ustawienia/powiadomienia",
      "/ustawienia/kategorie",
    ]);
    expect(nav.getByRole("link", { name: /Sejf/ })).toHaveClass("m-row", "min-h-14");
  });

  it("„Wyloguj się” jest przyciskiem submit w formularzu, a wersja pod spodem; całość tylko na telefonie", () => {
    const { container } = pokaz();
    const wyloguj = screen.getByRole("button", { name: "Wyloguj się" });
    expect(wyloguj).toHaveAttribute("type", "submit");
    expect(wyloguj.closest("form")).not.toBeNull();
    expect(screen.getByText("rhytm 0.1.0")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("min-[800px]:hidden");
  });
});
