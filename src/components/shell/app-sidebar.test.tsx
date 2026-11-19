import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let sciezka = "/dzis";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => sciezka,
  useRouter: () => ({ push, back: vi.fn() }),
}));
const { createBlankPage, reorderPages, renamePage } = vi.hoisted(() => ({
  createBlankPage: vi.fn(),
  reorderPages: vi.fn(),
  renamePage: vi.fn(),
}));
vi.mock("@/features/pages/actions", () => ({
  createBlankPage,
  reorderPages,
  renamePage,
  setPageIcon: vi.fn(),
  setFavorite: vi.fn(),
  duplicatePage: vi.fn(),
  deletePage: vi.fn(),
  restorePage: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
// Akcja wylogowania importuje next/headers — w testach zastępujemy ją atrapą
vi.mock("@/features/auth/actions", () => ({
  signOut: vi.fn(async () => undefined),
}));

import { AppSidebar } from "./app-sidebar";
import type { PageSummary } from "@/features/pages/load-pages";

const uzytkownik = {
  displayName: "Mejson",
  email: "mejson@example.com",
  avatarUrl: null,
};

function strona(id: string, title: string, position: number, reszta: Partial<PageSummary> = {}): PageSummary {
  return {
    id,
    title,
    icon: "▦",
    favorite: false,
    templateKey: null,
    position,
    rowCount: 0,
    ...reszta,
  };
}

describe("AppSidebar", () => {
  beforeEach(() => {
    sciezka = "/dzis";
    vi.clearAllMocks();
    createBlankPage.mockResolvedValue({ ok: true, id: "nowa-id" });
    reorderPages.mockResolvedValue({ ok: true });
    renamePage.mockResolvedValue({ ok: true });
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
    expect(screen.getByRole("link", { name: "Ustawienia" })).toHaveAttribute(
      "href",
      "/ustawienia",
    );
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("Nowa strona")).toBeInTheDocument();
  });

  it("oznacza aktywny moduł aria-current na /kalendarz", () => {
    sciezka = "/kalendarz";
    render(<AppSidebar user={uzytkownik} />);
    expect(screen.getByRole("link", { name: "Kalendarz" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dziś" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("klik w blok użytkownika otwiera dymek bez linku Ustawienia, Esc go zamyka", async () => {
    const user = userEvent.setup();
    render(<AppSidebar user={uzytkownik} />);
    await user.click(screen.getByRole("button", { name: /Mejson/ }));
    const dymek = await screen.findByRole("dialog");
    expect(within(dymek).getByText("Mejson")).toBeInTheDocument();
    expect(within(dymek).getByText("mejson@example.com")).toBeInTheDocument();
    expect(
      within(dymek).getByRole("button", { name: "Wyloguj się" }),
    ).toBeInTheDocument();
    expect(
      within(dymek).queryByRole("link", { name: /Ustawienia/ }),
    ).toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pokazuje strony w kolejności position, pusty tytuł jako „Bez tytułu”, aktywna ma tło #f0f0f0", () => {
    sciezka = "/strony/b";
    render(
      <AppSidebar
        user={uzytkownik}
        pages={[strona("b", "Books", 0), strona("p", "Projects", 1), strona("x", "", 2)]}
      />,
    );
    const linki = ["Books", "Projects", "Bez tytułu"].map((nazwa) =>
      screen.getByRole("link", { name: nazwa }),
    );
    expect(linki[0]).toHaveAttribute("href", "/strony/b");
    // Kolejność w DOM jak w danych
    expect(linki[0].compareDocumentPosition(linki[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(linki[1].compareDocumentPosition(linki[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(linki[0]).toHaveAttribute("aria-current", "page");
    expect(linki[0].className).toContain("bg-[#f0f0f0]");
    expect(linki[1].className).not.toContain("bg-[#f0f0f0]");
  });

  it.each([
    ["Dodaj stronę", "button"],
    ["Nowa strona", "button"],
  ] as const)("„%s” tworzy stronę i przechodzi do /strony/{id}", async (nazwa, rola) => {
    const user = userEvent.setup();
    render(<AppSidebar user={uzytkownik} />);
    await user.click(screen.getByRole(rola, { name: nazwa }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/strony/nowa-id"));
    expect(createBlankPage).toHaveBeenCalledTimes(1);
  });

  it("F2 na aktywnej stronie włącza edycję nazwy: Enter zapisuje, Esc anuluje", async () => {
    sciezka = "/strony/b";
    const user = userEvent.setup();
    render(<AppSidebar user={uzytkownik} pages={[strona("b", "Books", 0)]} />);

    await user.keyboard("{F2}");
    const pole = screen.getByRole("textbox", { name: "Nazwa strony" });
    expect(pole).toHaveValue("Books");
    await user.clear(pole);
    await user.type(pole, "Lektury{Enter}");
    expect(renamePage).toHaveBeenCalledWith("b", "Lektury");
    // Optymistycznie: nowa nazwa widoczna od razu
    expect(screen.getByRole("link", { name: "Lektury" })).toBeInTheDocument();

    await user.keyboard("{F2}");
    await user.type(screen.getByRole("textbox", { name: "Nazwa strony" }), "xyz{Escape}");
    expect(renamePage).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox", { name: "Nazwa strony" })).toBeNull();
    expect(screen.getByRole("link", { name: "Lektury" })).toBeInTheDocument();
  });

  it("przeciągnięcie pozycji woła reorderPages z nową kolejnością", async () => {
    render(
      <AppSidebar
        user={uzytkownik}
        pages={[strona("a", "Alfa", 0), strona("b", "Beta", 1), strona("c", "Gamma", 2)]}
      />,
    );
    const gamma = screen.getByRole("link", { name: "Gamma" });
    const alfa = screen.getByRole("link", { name: "Alfa" });
    fireEvent.dragStart(gamma);
    fireEvent.dragOver(alfa);
    fireEvent.drop(alfa);
    expect(reorderPages).toHaveBeenCalledWith(["c", "a", "b"]);
    // Optymistycznie: Gamma jest już pierwsza
    const nazwy = screen
      .getAllByRole("link")
      .map((l) => l.textContent?.replace("▦", ""))
      .filter((t) => ["Alfa", "Beta", "Gamma"].includes(t ?? ""));
    expect(nazwy).toEqual(["Gamma", "Alfa", "Beta"]);
  });
});
