import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let sciezka = "/dzis";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => sciezka,
  useRouter: () => ({ push, back: vi.fn() }),
}));
const { createBlankPage, reorderPages, renamePage, setFavorite, movePage } = vi.hoisted(() => ({
  movePage: vi.fn(),
  createBlankPage: vi.fn(),
  reorderPages: vi.fn(),
  renamePage: vi.fn(),
  setFavorite: vi.fn(),
}));
vi.mock("@/features/pages/actions", () => ({
  createBlankPage,
  reorderPages,
  renamePage,
  setPageIcon: vi.fn(),
  setFavorite,
  movePage,
  duplicatePage: vi.fn(),
  deletePage: vi.fn(),
  restorePage: vi.fn(),
}));
const { toast } = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("sonner", () => ({ toast }));
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
    setFavorite.mockResolvedValue({ ok: true });
    movePage.mockResolvedValue({ ok: true });
  });

  it("pokazuje wyszukiwarkę z keycapem, sekcje, 4 moduły, Ustawienia i inicjał", () => {
    render(<AppSidebar user={uzytkownik} />);
    expect(screen.getByText("Szukaj…")).toBeInTheDocument();
    // Skrót jako Kbd (.kbd z coss.css)
    expect(screen.getByText("⌘K").tagName).toBe("KBD");
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

  it("dymek konta ma pozycję „Konto” — link do /ustawienia/konto (przed „Wyloguj się”)", async () => {
    const user = userEvent.setup();
    render(<AppSidebar user={uzytkownik} />);
    await user.click(screen.getByRole("button", { name: /Mejson/ }));
    const dymek = await screen.findByRole("dialog");
    const konto = within(dymek).getByRole("link", { name: "Konto" });
    expect(konto).toHaveAttribute("href", "/ustawienia/konto");
    expect(konto).toHaveClass("cursor-pointer");
  });

  it("pokazuje strony w kolejności position, pusty tytuł jako „Bez tytułu”, aktywna ma tło .sb-i[aria-current]", () => {
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
    // .sb-i z coss.css: aktywna bg-black/5, pozostałe tekst rgba(38,38,38,.72)
    expect(linki[0]).toHaveClass("bg-black/5", "h-8", "rounded-[8px]");
    expect(linki[1]).not.toHaveClass("bg-black/5");
    expect(linki[1]).toHaveClass("text-[rgba(38,38,38,.72)]");
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
    // Ta sama sekcja: tylko kolejność, bez ulubionych
    expect(movePage).not.toHaveBeenCalled();
    expect(setFavorite).not.toHaveBeenCalled();
    // Optymistycznie: Gamma jest już pierwsza
    const nazwy = screen
      .getAllByRole("link")
      .map((l) => l.textContent)
      .filter((t) => ["Alfa", "Beta", "Gamma"].includes(t ?? ""));
    expect(nazwy).toEqual(["Gamma", "Alfa", "Beta"]);
  });

  it("ulubiona strona jest tylko w sekcji „Ulubione” (między Moduły a Strony); bez ulubionych sekcji nie ma", () => {
    const { rerender } = render(
      <AppSidebar user={uzytkownik} pages={[strona("a", "Alfa", 0), strona("b", "Beta", 1)]} />,
    );
    expect(screen.queryByText("Ulubione")).toBeNull();

    rerender(
      <AppSidebar
        user={uzytkownik}
        pages={[strona("a", "Alfa", 0), strona("b", "Beta", 1, { favorite: true })]}
      />,
    );
    const ulubione = screen.getByText("Ulubione");
    const naglowekStron = screen.getByText("Strony");
    const moduly = screen.getByText("Moduły");
    expect(moduly.compareDocumentPosition(ulubione) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ulubione.compareDocumentPosition(naglowekStron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Beta tylko raz: między „Ulubione” a „Strony”
    const beta = screen.getAllByRole("link", { name: "Beta" });
    expect(beta).toHaveLength(1);
    expect(ulubione.compareDocumentPosition(beta[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(beta[0].compareDocumentPosition(naglowekStron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const alfa = screen.getByRole("link", { name: "Alfa" });
    expect(naglowekStron.compareDocumentPosition(alfa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("upuszczenie strony ze „Strony” na ulubioną woła raz movePage (ulubione + kolejność)", () => {
    render(
      <AppSidebar
        user={uzytkownik}
        pages={[strona("a", "Alfa", 0, { favorite: true }), strona("b", "Beta", 1), strona("c", "Gamma", 2)]}
      />,
    );
    fireEvent.dragStart(screen.getByRole("link", { name: "Gamma" }));
    fireEvent.dragOver(screen.getByRole("link", { name: "Alfa" }));
    fireEvent.drop(screen.getByRole("link", { name: "Alfa" }));
    expect(movePage).toHaveBeenCalledTimes(1);
    expect(movePage).toHaveBeenCalledWith(["c", "a", "b"], "c", true);
    expect(setFavorite).not.toHaveBeenCalled();
    expect(reorderPages).not.toHaveBeenCalled();
    // Optymistycznie: Gamma przed Alfą w sekcji Ulubione
    const ulubione = screen.getByText("Ulubione");
    const gamma = screen.getByRole("link", { name: "Gamma" });
    const naglowekStron = screen.getByText("Strony");
    expect(ulubione.compareDocumentPosition(gamma) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(gamma.compareDocumentPosition(naglowekStron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("upuszczenie ulubionej na stronę z „Strony” zdejmuje ulubione; w dolnej połowie wiersza wstawia za nim", () => {
    render(
      <AppSidebar
        user={uzytkownik}
        pages={[strona("a", "Alfa", 0, { favorite: true }), strona("b", "Beta", 1), strona("c", "Gamma", 2)]}
      />,
    );
    const cel = screen.getByRole("link", { name: "Gamma" }).parentElement!;
    cel.getBoundingClientRect = () => ({ top: 100, height: 30, bottom: 130, left: 0, right: 200, width: 200, x: 0, y: 100, toJSON: () => ({}) });
    fireEvent.dragStart(screen.getByRole("link", { name: "Alfa" }));
    // jsdom nie przenosi clientY do zdarzeń przeciągania — ustawiamy je ręcznie (dolna połowa wiersza)
    const nadDolem = createEvent.dragOver(cel);
    Object.defineProperty(nadDolem, "clientY", { value: 125 });
    fireEvent(cel, nadDolem);
    expect(cel.className).toContain("shadow-[inset_0_-2px_0_var(--foreground)]");
    expect(screen.getByRole("link", { name: "Alfa" }).parentElement!.className).toContain("opacity-[.45]");
    fireEvent.drop(cel);
    expect(movePage).toHaveBeenCalledWith(["b", "c", "a"], "a", false);
    expect(reorderPages).not.toHaveBeenCalled();
    expect(screen.queryByText("Ulubione")).toBeNull();
  });

  it("błąd movePage cofa przeniesienie do sekcji i kolejność, jeden toast", async () => {
    movePage.mockResolvedValue({ ok: false, message: "x" });
    render(
      <AppSidebar
        user={uzytkownik}
        pages={[strona("a", "Alfa", 0, { favorite: true }), strona("b", "Beta", 1)]}
      />,
    );
    fireEvent.dragStart(screen.getByRole("link", { name: "Beta" }));
    fireEvent.dragOver(screen.getByRole("link", { name: "Alfa" }));
    fireEvent.drop(screen.getByRole("link", { name: "Alfa" }));
    expect(movePage).toHaveBeenCalledWith(["b", "a"], "b", true);
    await waitFor(() => {
      const naglowekStron = screen.getByText("Strony");
      const beta = screen.getByRole("link", { name: "Beta" });
      expect(naglowekStron.compareDocumentPosition(beta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    const linki = screen.getAllByRole("link").map((l) => l.textContent).filter((t) => t === "Alfa" || t === "Beta");
    expect(linki).toEqual(["Alfa", "Beta"]);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("menu strony na webie nie ma „Przenieś wyżej / niżej”", async () => {
    const user = userEvent.setup();
    render(<AppSidebar user={uzytkownik} pages={[strona("a", "Alfa", 0), strona("b", "Beta", 1)]} />);
    await user.click(screen.getByRole("button", { name: "Menu strony Alfa" }));
    expect(screen.getByRole("menu", { name: "Strona Alfa" })).toBeInTheDocument();
    expect(screen.queryByText("Przenieś wyżej / niżej")).toBeNull();
  });

  it("wiersz pokazuje ikonę strony: emoji, ikonę w kolorze albo domyślną tabelę", () => {
    render(
      <AppSidebar
        user={uzytkownik}
        pages={[
          strona("a", "Alfa", 0, { icon: "📚" }),
          strona("b", "Beta", 1, { icon: "lucide:rocket:blue" }),
          strona("c", "Gamma", 2, { icon: "" }),
        ]}
      />,
    );
    const ikona = (nazwa: string) =>
      screen.getByRole("link", { name: nazwa }).querySelector("[data-page-icon]")?.getAttribute("data-page-icon");
    expect(ikona("Alfa")).toBe("📚");
    expect(ikona("Beta")).toBe("rocket:blue");
    expect(ikona("Gamma")).toBe("table");
    expect(screen.getByRole("link", { name: "Beta" }).querySelector("svg")).toHaveAttribute("stroke", "#0070f3");
  });

  it("bez ulubionych w trakcie przeciągania pojawia się „Ulubione” ze strefą upuszczenia; upuszczenie dodaje do ulubionych", () => {
    render(<AppSidebar user={uzytkownik} pages={[strona("a", "Alfa", 0), strona("b", "Beta", 1)]} />);
    expect(screen.queryByText("Ulubione")).toBeNull();
    fireEvent.dragStart(screen.getByRole("link", { name: "Beta" }));
    expect(screen.getByText("Ulubione")).toBeInTheDocument();
    const strefa = screen.getByText("Upuść tutaj, aby dodać do ulubionych");
    fireEvent.dragOver(strefa);
    expect(strefa.className).toContain("border-primary");
    fireEvent.drop(strefa);
    // Pusta sekcja: strona zostaje na swoim miejscu w kolejności, zmienia się tylko ulubione
    expect(movePage).toHaveBeenCalledTimes(1);
    expect(movePage).toHaveBeenCalledWith(["a", "b"], "b", true);
    expect(screen.queryByText("Upuść tutaj, aby dodać do ulubionych")).toBeNull();
    const ulubione = screen.getByText("Ulubione");
    const beta = screen.getByRole("link", { name: "Beta" });
    expect(ulubione.compareDocumentPosition(beta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(beta.compareDocumentPosition(screen.getByText("Strony")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("nagłówek i pas pod ostatnim wierszem sekcji dopisują stronę na koniec tej sekcji", () => {
    render(
      <AppSidebar
        user={uzytkownik}
        pages={[
          strona("a", "Alfa", 0, { favorite: true }),
          strona("b", "Beta", 1),
          strona("c", "Gamma", 2, { favorite: true }),
          strona("d", "Delta", 3),
        ]}
      />,
    );
    // Beta na nagłówek „Ulubione” → za Gammą (ostatnią ulubioną)
    fireEvent.dragStart(screen.getByRole("link", { name: "Beta" }));
    fireEvent.dragOver(screen.getByText("Ulubione"));
    fireEvent.drop(screen.getByText("Ulubione"));
    expect(movePage).toHaveBeenLastCalledWith(["a", "c", "b", "d"], "b", true);

    // Alfa (ulubiona) na pas pod końcem „Strony” → za Deltą i zdjęta z ulubionych (movePage)
    fireEvent.dragStart(screen.getByRole("link", { name: "Alfa" }));
    const koniec = screen.getByTestId("koniec-strony");
    fireEvent.dragOver(koniec);
    expect(koniec.className).toContain("shadow-[inset_0_2px_0_var(--foreground)]");
    fireEvent.drop(koniec);
    expect(movePage).toHaveBeenLastCalledWith(["c", "b", "d", "a"], "a", false);

    // Gamma na koniec własnej sekcji (Ulubione) → sama kolejność
    fireEvent.dragStart(screen.getByRole("link", { name: "Gamma" }));
    fireEvent.dragOver(screen.getByTestId("koniec-ulubione"));
    fireEvent.drop(screen.getByTestId("koniec-ulubione"));
    expect(reorderPages).toHaveBeenLastCalledWith(["b", "c", "d", "a"]);
    expect(movePage).toHaveBeenCalledTimes(2);
  });

  it("wyjście kursora poza listę stron czyści wskaźnik upuszczenia", () => {
    render(<AppSidebar user={uzytkownik} pages={[strona("a", "Alfa", 0), strona("b", "Beta", 1)]} />);
    fireEvent.dragStart(screen.getByRole("link", { name: "Beta" }));
    const wiersz = screen.getByRole("link", { name: "Alfa" }).parentElement!;
    fireEvent.dragOver(wiersz);
    expect(wiersz.className).toContain("shadow-[inset_0_2px_0_var(--foreground)]");
    fireEvent.dragLeave(wiersz, { relatedTarget: screen.getByRole("link", { name: "Ustawienia" }) });
    expect(wiersz.className).not.toContain("shadow-");
  });
});
