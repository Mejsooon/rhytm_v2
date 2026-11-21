import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  addField: vi.fn(),
  addRow: vi.fn(),
  changeFieldType: vi.fn(),
  deleteField: vi.fn(),
  deleteRow: vi.fn(),
  restoreRow: vi.fn(),
  saveTableSettings: vi.fn(),
  updateField: vi.fn(),
  updateRow: vi.fn(),
}));
const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/strony/p1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("../actions", () => actions);

import { TemplatePageView } from "./template-page-view";
import { stronaTestowa } from "./test-page";

const BOOKS = [
  { Tytuł: "Atomic Habits", Autor: "James Clear", Status: "Czytam" },
  { Tytuł: "Deep Work", Autor: "Cal Newport", Status: "Przeczytane", Ocena: 4, Przeczytana: "2026-10-12" },
  { Tytuł: "Diuna", Autor: "Frank Herbert", Status: "Przeczytane", Ocena: 5, Przeczytana: "2026-06-15" },
  { Tytuł: "Clean Code", Autor: "Robert C. Martin", Status: "Chcę przeczytać" },
];
const PROJECTS = [
  { Nazwa: "rhytm v3", Status: "W toku", Obszar: "Własne", Termin: "2026-12-15", Repo: "Mejsooon/rhytm-v3" },
  { Nazwa: "NetScope", Status: "Do zrobienia", Obszar: "Własne", Termin: "2027-02-15" },
];

function naglowek(nazwa: string) {
  return screen.getByRole("columnheader", { name: new RegExp(nazwa) });
}

async function otworzMenu(user: ReturnType<typeof userEvent.setup>, nazwa: string) {
  await user.click(within(naglowek(nazwa)).getByRole("button", { name: new RegExp(nazwa) }));
  return screen.getByRole("menu", { name: `Kolumna ${nazwa}` });
}

describe("menu kolumny", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
  });

  it("klik w nagłówek otwiera menu z pozycjami z makiety", async () => {
    const user = userEvent.setup();
    render(<TemplatePageView data={stronaTestowa("books", "Books", BOOKS)} />);
    const menu = await otworzMenu(user, "Autor");
    expect(within(menu).getByRole("textbox", { name: "Nazwa kolumny" })).toHaveValue("Autor");
    expect(within(menu).getByRole("menuitem", { name: /Typ: Tekst/ })).toBeInTheDocument();
    for (const nazwa of [
      "Sortuj rosnąco",
      "Sortuj malejąco",
      "Filtruj po tym polu",
      "Podsumowanie Brak ›",
      "Ukryj kolumnę",
      "Usuń pole",
    ]) {
      expect(within(menu).getByRole("menuitem", { name: nazwa })).toBeInTheDocument();
    }
    // „Pokaż w kalendarzu” tylko dla Daty
    expect(within(menu).queryByRole("menuitem", { name: /Pokaż w kalendarzu/ })).not.toBeInTheDocument();
  });

  it("klasy z makiety CColumnMenu: .pop p-1, pole FIELD, pozycje .mi, separatory, Usuń pole czerwone", async () => {
    const user = userEvent.setup();
    render(<TemplatePageView data={stronaTestowa("projects", "Projects", PROJECTS)} />);
    const menu = await otworzMenu(user, "Termin");
    const dymek = menu.closest("[role=dialog]") as HTMLElement;
    expect(dymek).toHaveClass("p-1", "rounded-lg", "shadow-lg");
    expect(dymek).toHaveStyle({ width: "260px" });
    expect(within(menu).getByRole("textbox", { name: "Nazwa kolumny" })).toHaveClass("h-8", "rounded-md", "shadow-xs");
    for (const nazwa of ["Sortuj rosnąco", "Filtruj po tym polu", "Ukryj kolumnę", /Typ: Data/, /Pokaż w kalendarzu/]) {
      expect(within(menu).getByRole("menuitem", { name: nazwa })).toHaveClass("min-h-8", "rounded-sm", "hover:bg-accent");
    }
    expect(within(menu).getByRole("menuitem", { name: "Usuń pole" })).toHaveClass("text-destructive-foreground");
    expect(menu.querySelectorAll(".h-px.bg-border")).toHaveLength(3);
    // Ikony pozycji to lucide (svg), nie znaki
    expect(within(menu).getByRole("menuitem", { name: "Sortuj rosnąco" }).querySelector("svg")).not.toBeNull();
    // Przełącznik „Pokaż w kalendarzu” jest w stanie włączonym (Termin ma show_in_calendar)
    expect(within(menu).getByRole("menuitem", { name: /Pokaż w kalendarzu/ }).querySelector("[data-on=true]")).not.toBeNull();
    // Otwarte podmenu: .pop z p-1, szerokość 210 px, a pozycja rodzica podświetlona
    await user.click(within(menu).getByRole("menuitem", { name: /Podsumowanie/ }));
    const podmenu = screen.getByRole("menu", { name: "Podsumowanie" });
    expect(podmenu).toHaveClass("rounded-lg", "border", "p-1", "shadow-lg", "w-[210px]");
    expect(within(menu).getByRole("menuitem", { name: /^Podsumowanie/ })).toHaveClass("bg-accent");
  });

  it("menu kolumny przy prawej krawędzi otwiera się do środka", async () => {
    const user = userEvent.setup();
    render(<TemplatePageView data={stronaTestowa("projects", "Projects", PROJECTS)} />);
    // Ostatnia kolumna tabeli: dymek pod nagłówkiem, wyrównany do lewej krawędzi przycisku i obsługiwany przez
    // wykrywanie kolizji Radixa (przesuwa się do środka, zamiast wychodzić poza okno)
    const zMenu = screen.getAllByRole("columnheader").filter((h) => within(h).queryByRole("button"));
    await user.click(within(zMenu[zMenu.length - 1]).getByRole("button"));
    const dymek = screen.getByRole("dialog", { name: /^Kolumna / });
    expect(dymek.parentElement).toHaveAttribute("data-radix-popper-content-wrapper");
    expect(dymek).toHaveAttribute("data-side", "bottom");
    expect(dymek).toHaveAttribute("data-align", "start");
  });

  it("pole tytułowe: Typ i Usuń pole są wyszarzone", async () => {
    const user = userEvent.setup();
    render(<TemplatePageView data={stronaTestowa("books", "Books", BOOKS)} />);
    const menu = await otworzMenu(user, "Tytuł");
    expect(within(menu).getByRole("menuitem", { name: /Typ: Tekst/ })).toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: "Usuń pole" })).toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: "Ukryj kolumnę" })).toBeEnabled();
  });

  it("sortowanie zapisuje settings.sort jednym kluczem i zmienia metadane", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    render(<TemplatePageView data={dane} />);
    const menu = await otworzMenu(user, "Autor");
    await user.click(within(menu).getByRole("menuitem", { name: "Sortuj malejąco" }));
    const autor = dane.blocks[0].fields.find((f) => f.name === "Autor")!;
    expect(actions.saveTableSettings).toHaveBeenCalledWith("blok-1", {
      sort: [{ field_id: autor.id, dir: "desc" }],
    });
    expect(screen.getByText(/· sort: autor$/)).toBeInTheDocument();
    const tytuly = screen
      .getAllByRole("row")
      .slice(1, -1)
      .map((r) => r.querySelector("td")?.textContent);
    expect(tytuly).toEqual(["Clean Code", "Atomic Habits", "Diuna", "Deep Work"]);
  });

  it("Ukryj kolumnę: kolumna znika, „· 1 ukryte” ją przywraca", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("projects", "Projects", PROJECTS);
    render(<TemplatePageView data={dane} />);
    const menu = await otworzMenu(user, "Repo");
    await user.click(within(menu).getByRole("menuitem", { name: "Ukryj kolumnę" }));
    const repo = dane.blocks[0].fields.find((f) => f.name === "Repo")!;
    expect(actions.saveTableSettings).toHaveBeenCalledWith("blok-1", { hidden_field_ids: [repo.id] });
    expect(screen.queryByRole("columnheader", { name: /Repo/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "· 1 ukryte" }));
    expect(actions.saveTableSettings).toHaveBeenLastCalledWith("blok-1", { hidden_field_ids: [] });
    expect(screen.getByRole("columnheader", { name: /Repo/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ukryte/ })).not.toBeInTheDocument();
  });

  it("Data: „Pokaż w kalendarzu” przełącza config i znaczek w nagłówku", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("projects", "Projects", PROJECTS);
    render(<TemplatePageView data={dane} />);
    expect(within(naglowek("Termin")).getByText("w kalendarzu")).toBeInTheDocument();
    const menu = await otworzMenu(user, "Termin");
    await user.click(within(menu).getByRole("menuitem", { name: /Pokaż w kalendarzu/ }));
    const termin = dane.blocks[0].fields.find((f) => f.name === "Termin")!;
    expect(actions.updateField).toHaveBeenCalledWith(termin.id, {
      config: { ...termin.config, show_in_calendar: false },
    });
    expect(within(naglowek("Termin")).queryByText("w kalendarzu")).not.toBeInTheDocument();
  });

  it("zmiana nazwy zapisuje updateField", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    render(<TemplatePageView data={dane} />);
    const menu = await otworzMenu(user, "Autor");
    const pole = within(menu).getByRole("textbox", { name: "Nazwa kolumny" });
    await user.clear(pole);
    await user.type(pole, "Pisarz{Enter}");
    const autor = dane.blocks[0].fields.find((f) => f.name === "Autor")!;
    await waitFor(() => expect(actions.updateField).toHaveBeenCalledWith(autor.id, { name: "Pisarz" }));
    expect(screen.getByRole("columnheader", { name: /Pisarz/ })).toBeInTheDocument();
  });

  describe("typ", () => {
    it("bez strat zmienia od razu, bez okna", async () => {
      const user = userEvent.setup();
      const dane = stronaTestowa("projects", "Projects", PROJECTS);
      render(<TemplatePageView data={dane} />);
      const menu = await otworzMenu(user, "Repo");
      await user.click(within(menu).getByRole("menuitem", { name: /Typ: URL/ }));
      await user.click(screen.getByRole("menuitem", { name: /Tekst/ }));
      expect(screen.queryByText("Zmienić typ pola?")).not.toBeInTheDocument();
      const repo = dane.blocks[0].fields.find((f) => f.name === "Repo")!;
      await waitFor(() => expect(actions.changeFieldType).toHaveBeenCalledTimes(1));
      expect(actions.changeFieldType.mock.calls[0].slice(0, 2)).toEqual([repo.id, "text"]);
      expect(within(naglowek("Repo")).getByText("Aa")).toBeInTheDocument();
    });

    it("ze stratą pyta o potwierdzenie i dopiero po nim zapisuje", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={stronaTestowa("books", "Books", BOOKS)} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: /Typ: Tekst/ }));
      await user.click(screen.getByRole("menuitem", { name: /Liczba/ }));
      expect(screen.getByText("Zmienić typ pola?")).toBeInTheDocument();
      expect(screen.getByText("4 wartości nie da się przenieść i zostaną wyczyszczone.")).toBeInTheDocument();
      expect(actions.changeFieldType).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Zmień typ" }));
      await waitFor(() => expect(actions.changeFieldType).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByText("Zmienić typ pola?")).not.toBeInTheDocument());
      expect(within(naglowek("Autor")).getByText("#")).toBeInTheDocument();
    });

    it("błąd zapisu cofa typ kolumny i pokazuje toast", async () => {
      const user = userEvent.setup();
      actions.changeFieldType.mockResolvedValue({ ok: false, message: "x" });
      render(<TemplatePageView data={stronaTestowa("projects", "Projects", PROJECTS)} />);
      const menu = await otworzMenu(user, "Repo");
      await user.click(within(menu).getByRole("menuitem", { name: /Typ: URL/ }));
      await user.click(screen.getByRole("menuitem", { name: /Tekst/ }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      expect(within(naglowek("Repo")).getByText("↗")).toBeInTheDocument();
    });
  });

  describe("usuwanie pola", () => {
    it("usuwa kolumnę od razu i czyści ślady w ustawieniach", async () => {
      const user = userEvent.setup();
      const dane = stronaTestowa("books", "Books", BOOKS);
      render(<TemplatePageView data={dane} />);
      // Szablon Books sortuje po statusie i dacie przeczytania
      expect(screen.getByText(/sort: status, przeczytana$/)).toBeInTheDocument();
      const menu = await otworzMenu(user, "Przeczytana");
      await user.click(within(menu).getByRole("menuitem", { name: "Usuń pole" }));
      const pole = dane.blocks[0].fields.find((f) => f.name === "Przeczytana")!;
      expect(actions.deleteField).toHaveBeenCalledWith(pole.id);
      expect(screen.queryByRole("columnheader", { name: /Przeczytana/ })).not.toBeInTheDocument();
      expect(screen.getByText(/4 wiersze · 4 pola · .* sort: status$/)).toBeInTheDocument();
    });

    it("błąd cofa kolumnę i pokazuje toast", async () => {
      const user = userEvent.setup();
      actions.deleteField.mockResolvedValue({ ok: false, message: "x" });
      render(<TemplatePageView data={stronaTestowa("books", "Books", BOOKS)} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: "Usuń pole" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      expect(screen.getByRole("columnheader", { name: /Autor/ })).toBeInTheDocument();
    });
  });

  describe("podsumowania", () => {
    it("wybór rodzaju zapisuje column_summaries i liczy stopkę z wierszy po filtrze", async () => {
      const user = userEvent.setup();
      const dane = stronaTestowa("books", "Books", BOOKS);
      render(<TemplatePageView data={dane} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: "Podsumowanie Brak ›" }));
      const podmenu = screen.getByRole("menu", { name: "Podsumowanie" });
      expect(within(podmenu).getAllByRole("menuitem").map((e) => e.textContent)).toEqual([
        "Brak",
        "Liczba wierszy",
        "Wypełnione",
        "Puste",
      ]);
      // Wybrana pozycja ma ikonę ✓ po prawej (jak w makiecie), pozostałe jej nie mają
      expect(within(podmenu).getByRole("menuitem", { name: "Brak" }).querySelector("svg")).not.toBeNull();
      expect(within(podmenu).getByRole("menuitem", { name: "Puste" }).querySelector("svg")).toBeNull();
      await user.click(within(podmenu).getByRole("menuitem", { name: "Wypełnione" }));
      const autor = dane.blocks[0].fields.find((f) => f.name === "Autor")!;
      expect(actions.saveTableSettings).toHaveBeenCalledWith("blok-1", {
        column_summaries: expect.objectContaining({ [autor.id]: { kind: "filled" } }),
      });
      const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
      expect(within(stopka).getByText("4 wypełnione")).toBeInTheDocument();
    });

    it("liczby: opcje podsumowania z summaryOptions, bieżące z szablonu to „Średnia”", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={stronaTestowa("books", "Books", BOOKS)} />);
      const menu = await otworzMenu(user, "Ocena");
      await user.click(within(menu).getByRole("menuitem", { name: "Podsumowanie Średnia ›" }));
      expect(
        within(screen.getByRole("menu", { name: "Podsumowanie" }))
          .getAllByRole("menuitem")
          .map((e) => e.textContent),
      ).toEqual(["Brak", "Liczba wierszy", "Wypełnione", "Puste", "Średnia", "Minimum", "Maksimum"]);
    });

    it("podsumowanie z szablonu pokazuje swoją etykietę, a wybór go zastępuje", async () => {
      const user = userEvent.setup();
      const dane = stronaTestowa("books", "Books", BOOKS);
      const przeczytana = dane.blocks[0].fields.find((f) => f.name === "Przeczytana")!;
      render(<TemplatePageView data={dane} />);
      // Szablon Books ma w stopce „Przeczytana” licznik „w roku”
      const menu = await otworzMenu(user, "Przeczytana");
      const pozycja = within(menu).getByRole("menuitem", { name: /^Podsumowanie/ });
      expect(pozycja.textContent).toContain("Liczba w roku");
      await user.click(pozycja);
      await user.click(within(screen.getByRole("menu", { name: "Podsumowanie" })).getByRole("menuitem", { name: "Brak" }));
      const zapis = actions.saveTableSettings.mock.calls.at(-1)![1] as { column_summaries: Record<string, unknown> };
      expect(zapis.column_summaries[przeczytana.id]).toBeUndefined();
    });
  });

  it("„Filtruj po tym polu” otwiera filtr z warunkiem dla pola", async () => {
    const user = userEvent.setup();
    render(<TemplatePageView data={stronaTestowa("books", "Books", BOOKS)} />);
    const menu = await otworzMenu(user, "Autor");
    await user.click(within(menu).getByRole("menuitem", { name: "Filtruj po tym polu" }));
    const filtr = await screen.findByRole("dialog", { name: "Filtr" });
    expect(within(filtr).getByRole("button", { name: "Pole warunku 1" }).textContent).toContain("Autor");
    expect(within(filtr).getByRole("button", { name: "Operator warunku 1" }).textContent).toContain("zawiera");
    expect(screen.getByRole("button", { name: "Filtruj · 1" })).toBeInTheDocument();
  });

  describe("wyścigi przy błędzie zapisu", () => {
    it("nieudane usunięcie pola cofa tylko swoje ślady — sort zmieniony w międzyczasie zostaje", async () => {
      const user = userEvent.setup();
      let odrzuc!: (v: { ok: false; message: string }) => void;
      actions.deleteField.mockReturnValue(new Promise((r) => (odrzuc = r)));
      render(<TemplatePageView data={stronaTestowa("books", "Books", BOOKS)} />);
      const menu = await otworzMenu(user, "Przeczytana");
      await user.click(within(menu).getByRole("menuitem", { name: "Usuń pole" }));
      expect(screen.queryByRole("columnheader", { name: /Przeczytana/ })).not.toBeInTheDocument();

      const menuAutora = await otworzMenu(user, "Autor");
      await user.click(within(menuAutora).getByRole("menuitem", { name: "Sortuj rosnąco" }));
      expect(screen.getByText(/· sort: autor$/)).toBeInTheDocument();

      await act(async () => odrzuc({ ok: false, message: "x" }));
      expect(screen.getByRole("columnheader", { name: /Przeczytana/ })).toBeInTheDocument();
      expect(screen.getByText(/· sort: autor$/)).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie.");
    });

    it("nieudane usunięcie pola przywraca jego warunki w filtrze tymczasowym", async () => {
      const user = userEvent.setup();
      let odrzuc!: (v: { ok: false; message: string }) => void;
      actions.deleteField.mockReturnValue(new Promise((r) => (odrzuc = r)));
      render(<TemplatePageView data={stronaTestowa("books", "Books", BOOKS)} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: "Filtruj po tym polu" }));
      expect(await screen.findByRole("button", { name: "Filtruj · 1" })).toBeInTheDocument();
      await user.keyboard("{Escape}");
      const menu2 = await otworzMenu(user, "Autor");
      await user.click(within(menu2).getByRole("menuitem", { name: "Usuń pole" }));
      expect(screen.getByRole("button", { name: "Filtruj" })).toBeInTheDocument();
      await act(async () => odrzuc({ ok: false, message: "x" }));
      expect(screen.getByRole("button", { name: "Filtruj · 1" })).toBeInTheDocument();
    });

    it("nieudana zmiana typu bez strat nie nadpisuje komórki edytowanej w międzyczasie", async () => {
      const user = userEvent.setup();
      let odrzuc!: (v: { ok: false; message: string }) => void;
      actions.changeFieldType.mockReturnValue(new Promise((r) => (odrzuc = r)));
      render(<TemplatePageView data={stronaTestowa("projects", "Projects", PROJECTS)} />);
      const menu = await otworzMenu(user, "Repo");
      await user.click(within(menu).getByRole("menuitem", { name: /Typ: URL/ }));
      await user.click(screen.getByRole("menuitem", { name: /Tekst/ }));

      await user.click(within(screen.getAllByRole("row").find((r) => r.textContent?.includes("rhytm v3")) as HTMLElement).getByRole("button", { name: "Edytuj wiersz" }));
      await user.type(screen.getByRole("textbox", { name: "Repo" }), "!");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(1));

      await act(async () => odrzuc({ ok: false, message: "x" }));
      expect(within(naglowek("Repo")).getByText("↗")).toBeInTheDocument();
      expect(screen.getByText(/rhytm-v3!/)).toBeInTheDocument();
    });
  });

  it("zmiana typu przy wierszu czekającym na serwer pokazuje toast zamiast milczeć", async () => {
    const user = userEvent.setup();
    actions.addRow.mockReturnValue(new Promise(() => {}));
    render(<TemplatePageView data={stronaTestowa("projects", "Projects", PROJECTS)} />);
    await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
    await user.type(screen.getByRole("textbox", { name: "Nazwa" }), "Nowy");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    const menu = await otworzMenu(user, "Repo");
    await user.click(within(menu).getByRole("menuitem", { name: /Typ: URL/ }));
    await user.click(screen.getByRole("menuitem", { name: /Tekst/ }));
    expect(toast.error).toHaveBeenCalledWith("Poczekaj, aż wiersze się zapiszą.");
    expect(actions.changeFieldType).not.toHaveBeenCalled();
  });

  it("nazwa kolumny zapisuje się też przy zamknięciu menu bez blur", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    render(<TemplatePageView data={dane} />);
    const menu = await otworzMenu(user, "Autor");
    const pole = within(menu).getByRole("textbox", { name: "Nazwa kolumny" });
    await user.clear(pole);
    await user.type(pole, "Pisarz");
    await user.keyboard("{Escape}");
    const autor = dane.blocks[0].fields.find((f) => f.name === "Autor")!;
    await waitFor(() => expect(actions.updateField).toHaveBeenCalledWith(autor.id, { name: "Pisarz" }));
    expect(actions.updateField).toHaveBeenCalledTimes(1);
  });
});
