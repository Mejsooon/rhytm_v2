import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let sciezka = "/dzis";
vi.mock("next/navigation", () => ({ usePathname: () => sciezka }));
// Akcja wylogowania importuje next/headers — w testach zastępujemy ją atrapą
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn(async () => undefined) }));

import { AppSidebar } from "./app-sidebar";

const uzytkownik = { displayName: "Mejson", email: "mejson@example.com", avatarUrl: null };

describe("AppSidebar", () => {
  beforeEach(() => {
    sciezka = "/dzis";
  });

  it("pokazuje wyszukiwarkę z keycapem, sekcje, 4 moduły, Ustawienia i inicjał", () => {
    render(<AppSidebar user={uzytkownik} />);
    expect(screen.getByText("Szukaj…")).toBeInTheDocument();
    expect(screen.getByText("⌘K")).toBeInTheDocument();
    expect(screen.getByText("Moduły")).toBeInTheDocument();
    expect(screen.getByText("Strony")).toBeInTheDocument();
    for (const nazwa of ["Dziś", "Kalendarz", "Sport", "Nawyki i sen"]) {
      expect(screen.getByRole("link", { name: nazwa })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Ustawienia" })).toHaveAttribute("href", "/ustawienia");
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("Nowa strona")).toBeInTheDocument();
  });

  it("oznacza aktywny moduł aria-current na /kalendarz", () => {
    sciezka = "/kalendarz";
    render(<AppSidebar user={uzytkownik} />);
    expect(screen.getByRole("link", { name: "Kalendarz" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dziś" })).not.toHaveAttribute("aria-current");
  });

  it("klik w blok użytkownika otwiera dymek bez linku Ustawienia, Esc go zamyka", async () => {
    const user = userEvent.setup();
    render(<AppSidebar user={uzytkownik} />);
    await user.click(screen.getByRole("button", { name: /Mejson/ }));
    const dymek = await screen.findByRole("dialog");
    expect(within(dymek).getByText("Mejson")).toBeInTheDocument();
    expect(within(dymek).getByText("mejson@example.com")).toBeInTheDocument();
    expect(within(dymek).getByRole("button", { name: "Wyloguj się" })).toBeInTheDocument();
    expect(within(dymek).queryByRole("link", { name: /Ustawienia/ })).toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
