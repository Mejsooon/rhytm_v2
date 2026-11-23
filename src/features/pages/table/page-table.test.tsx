import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  addField: vi.fn(),
  addRow: vi.fn(),
  changeFieldType: vi.fn(),
  deleteField: vi.fn(),
  updateField: vi.fn(),
  deleteRow: vi.fn(),
  restoreRow: vi.fn(),
  saveTableSettings: vi.fn(),
  updateRow: vi.fn(),
  updateBlockContent: vi.fn(),
  reorderFields: vi.fn(),
}));
const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("../actions", () => actions);
// RowEdit czyta stan sejfu (VaultProvider jest w powłoce aplikacji); tabele bez Sekretu go nie używają
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => ({ status: "ladowanie" }) }));

import { PALETA } from "../fields";
import type { LoadedBlock } from "../load-page";
import { buildTemplateBlocks, type TemplateKey } from "../templates";
import { PageTable } from "./page-table";
import { stronaTestowa } from "./test-page";

const TODAY = "2026-11-15";

// Books (S2Books.dc.html, BASE)
const BOOKS = [
  { Tytuł: "Atomic Habits", Autor: "James Clear", Status: "Czytam" },
  { Tytuł: "Hacking: The Art of Exploitation", Autor: "Jon Erickson", Status: "Czytam" },
  { Tytuł: "Psychologia pieniędzy", Autor: "Morgan Housel", Status: "Przeczytane", Ocena: 5, Przeczytana: "2026-11-02" },
  { Tytuł: "Deep Work", Autor: "Cal Newport", Status: "Przeczytane", Ocena: 4, Przeczytana: "2026-10-12" },
  { Tytuł: "Zero to One", Autor: "Peter Thiel", Status: "Przeczytane", Ocena: 4, Przeczytana: "2026-08-28" },
  { Tytuł: "Diuna", Autor: "Frank Herbert", Status: "Przeczytane", Ocena: 5, Przeczytana: "2026-06-15" },
  { Tytuł: "The Pragmatic Programmer", Autor: "D. Thomas, A. Hunt", Status: "Przeczytane", Ocena: 3, Przeczytana: "2026-04-20" },
  { Tytuł: "Ostatnie życzenie", Autor: "Andrzej Sapkowski", Status: "Przeczytane", Ocena: 4, Przeczytana: "2026-02-03" },
  { Tytuł: "Sapiens", Autor: "Yuval Noah Harari", Status: "Przeczytane", Ocena: 4, Przeczytana: "2025-12-11" },
  { Tytuł: "The Web Application Hacker's Handbook", Autor: "D. Stuttard, M. Pinto", Status: "Chcę przeczytać" },
  { Tytuł: "Clean Code", Autor: "Robert C. Martin", Status: "Chcę przeczytać" },
];

const PROJECTS = [
  { Nazwa: "Projekt z baz danych — drony", Status: "W toku", Obszar: "Studia", Termin: "2026-11-20" },
  { Nazwa: "rhytm v3", Status: "W toku", Obszar: "Własne", Termin: "2026-12-15", Repo: "Mejsooon/rhytm-v3" },
  { Nazwa: "Strona Fanaberia", Status: "W toku", Obszar: "Klient", Termin: "2026-11-30", Repo: "framer.com" },
  { Nazwa: "LeetRepeat", Status: "Wstrzymane", Obszar: "Własne", Repo: "Mejsooon/leetrepeat" },
  { Nazwa: "NetScope", Status: "Do zrobienia", Obszar: "Własne", Termin: "2027-02-15", Repo: "Mejsooon/netscope" },
  { Nazwa: "Chainlock", Status: "Do zrobienia", Obszar: "Własne" },
  { Nazwa: "Password Manager", Status: "Wstrzymane", Obszar: "Własne", Repo: "Mejsooon/password_manager_dev" },
  { Nazwa: "rhytm v2", Status: "Zrobione", Obszar: "Własne", Termin: "2026-11-13", Repo: "Mejsooon/rhytm" },
];

// Blok tabeli z szablonu z wierszami po nazwach pól i etykietach opcji
function blok(key: TemplateKey, wiersze: Record<string, unknown>[]): LoadedBlock {
  return stronaTestowa(key, "Strona", wiersze).blocks[0];
}

function wiersz(tekst: string) {
  const tr = screen.getAllByRole("row").find((r) => r.textContent?.includes(tekst));
  if (!tr) throw new Error(`Brak wiersza ${tekst}`);
  return tr;
}

function karta(etykieta: string) {
  return screen.getByText(etykieta, { selector: "div" }).parentElement as HTMLElement;
}

function tytuly() {
  return screen
    .getAllByRole("row")
    .slice(1, -1)
    .map((r) => r.querySelector("td")?.textContent);
}

function naglowek(nazwa: string) {
  return screen.getByRole("columnheader", { name: new RegExp(nazwa) });
}

async function otworzMenu(user: ReturnType<typeof userEvent.setup>, nazwa: string) {
  await user.click(within(naglowek(nazwa)).getByRole("button", { name: new RegExp(nazwa) }));
  return screen.getByRole("menu", { name: `Kolumna ${nazwa}` });
}

function edycja() {
  const tr = document.querySelector('tr[class*="bg-success-soft"]');
  if (!tr) throw new Error("Brak wiersza w edycji");
  return tr as HTMLElement;
}

function telefon() {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
}

describe("PageTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
    actions.addRow.mockImplementation(async (_b: string, values: Record<string, unknown>) => ({
      ok: true,
      row: { id: "srv-1", values, position: 99, deletedAt: null },
    }));
  });
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  describe("blok z szablonu (Review Focus 1)", () => {
    it("buildTemplateBlocks(„books”)[1] pokazuje trzy karty i stopkę", () => {
      let n = 0;
      const b = buildTemplateBlocks("books", () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`)[1];
      expect(b.type).toBe("table");
      const block: LoadedBlock = {
        id: b.id,
        type: "table",
        position: 1,
        content: b.content,
        fields: b.fields.map((f, i) => ({ id: f.id, name: f.name, type: f.type, config: f.config, position: i, isTitle: f.is_title })),
        rows: [],
      };
      render(<PageTable block={block} today={TODAY} />);
      expect(screen.getByTestId("przypiete-karty").children).toHaveLength(3);
      expect(screen.getByRole("textbox", { name: "Nazwa tabeli" })).toHaveValue("Books");
      const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
      expect(within(stopka).getByText("0 wierszy")).toBeInTheDocument();
    });
  });

  describe("pasek tabeli", () => {
    it("nazwa, plakietka sortu, „Filtruj”, „⋯” i „+ Nowy” pod ramką", () => {
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      expect(screen.getByRole("textbox", { name: "Nazwa tabeli" })).toHaveAttribute("placeholder", "Tabela bez nazwy");
      expect(screen.getByText("Sort: Status, Przeczytana")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Filtruj" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Menu tabeli" })).toBeInTheDocument();
      const nowy = screen.getByRole("button", { name: "Nowy" });
      // „+ Nowy” stoi pod ramką z tabelą, nie w stopce
      expect(nowy.closest("table")).toBeNull();
    });

    it("bez sortu nie ma plakietki", () => {
      const b = blok("websites", []);
      (b.content as { settings: { sort: unknown[] } }).settings.sort = [];
      render(<PageTable block={b} today={TODAY} />);
      expect(screen.queryByText(/^Sort:/)).not.toBeInTheDocument();
    });

    it("zmiana nazwy tabeli na blur woła updateBlockContent z zachowaniem settings", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      const pole = screen.getByRole("textbox", { name: "Nazwa tabeli" });
      await user.clear(pole);
      await user.type(pole, "Lektury");
      await user.tab();
      expect(actions.updateBlockContent).toHaveBeenCalledWith(b.id, {
        name: "Lektury",
        settings: b.content.settings,
      });
      expect(pole).toHaveValue("Lektury");
    });

    it("błąd zapisu nazwy przywraca poprzednią i pokazuje toast", async () => {
      actions.updateBlockContent.mockResolvedValue({ ok: false, message: "x" });
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      const pole = screen.getByRole("textbox", { name: "Nazwa tabeli" });
      await user.clear(pole);
      await user.type(pole, "Lektury{Enter}");
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      expect(pole).toHaveValue("Books");
    });

    it("nazwa bez zmian nie zapisuje nic", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      await user.click(screen.getByRole("textbox", { name: "Nazwa tabeli" }));
      await user.tab();
      expect(actions.updateBlockContent).not.toHaveBeenCalled();
    });

    it("„⋯” (S2TableMenu): odwrócenie i usunięcie sortu, dodanie sortowania", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      const status = b.fields.find((f) => f.name === "Status")!;
      const przeczytana = b.fields.find((f) => f.name === "Przeczytana")!;
      await user.click(screen.getByRole("button", { name: "Menu tabeli" }));
      const menu = await screen.findByRole("dialog", { name: "Ustawienia tabeli" });
      expect(within(menu).getByRole("textbox", { name: "Nazwa tabeli" })).toHaveValue("Books");
      expect(within(menu).getByRole("button", { name: "Odwróć kierunek: Status" }).textContent).toBe("A → Z");
      await user.click(within(menu).getByRole("button", { name: "Odwróć kierunek: Status" }));
      expect(actions.saveTableSettings).toHaveBeenLastCalledWith(b.id, {
        sort: [
          { field_id: status.id, dir: "desc" },
          { field_id: przeczytana.id, dir: "desc" },
        ],
      });
      await user.click(within(menu).getByRole("button", { name: "Usuń sortowanie: Status" }));
      await user.click(within(menu).getByRole("button", { name: "Usuń sortowanie: Przeczytana" }));
      expect(actions.saveTableSettings).toHaveBeenLastCalledWith(b.id, { sort: [] });
      expect(screen.queryByText(/^Sort:/)).not.toBeInTheDocument();
      expect(within(menu).getByText("Wiersze w kolejności dodania.")).toBeInTheDocument();
      await user.click(within(menu).getByRole("button", { name: "Dodaj sortowanie" }));
      expect(actions.saveTableSettings).toHaveBeenLastCalledWith(b.id, { sort: [{ field_id: b.fields[0].id, dir: "asc" }] });
    });

    it("„⋯”: „Usuń tabelę” woła onRemove; bez onRemove pozycji nie ma", async () => {
      const user = userEvent.setup();
      const usun = vi.fn();
      const { unmount } = render(<PageTable block={blok("books", BOOKS)} today={TODAY} onRemove={usun} />);
      await user.click(screen.getByRole("button", { name: "Menu tabeli" }));
      await user.click(await screen.findByRole("button", { name: "Usuń tabelę" }));
      expect(usun).toHaveBeenCalledTimes(1);
      unmount();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      await user.click(screen.getByRole("button", { name: "Menu tabeli" }));
      await screen.findByRole("dialog", { name: "Ustawienia tabeli" });
      expect(screen.queryByRole("button", { name: "Usuń tabelę" })).not.toBeInTheDocument();
    });
  });

  describe("karty", () => {
    it("Books: przeczytane w roku, czytam teraz, średnia ocena", () => {
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      expect(karta("Przeczytane w 2026").textContent).toContain("6 książek");
      expect(karta("Czytam teraz").textContent).toContain("2");
      expect(karta("Średnia ocena").textContent).toContain("4,1 / 5");
    });

    it("Projects: najbliższy termin czerwony przy ≤ 7 dniach i „Zrobione 1 / 8”", () => {
      render(<PageTable block={blok("projects", PROJECTS)} today={TODAY} />);
      const termin = karta("Najbliższy termin");
      expect(termin.textContent).toContain("Projekt z baz danych — drony");
      expect(within(termin).getByText("za 5 dni")).toHaveClass("text-destructive-foreground");
      expect(karta("Zrobione").textContent).toContain("1 / 8");
    });

    it("zrobiony termin w wierszu nie jest pilny (opcja „zrobione” z karty terminu)", () => {
      render(<PageTable block={blok("projects", [{ Nazwa: "Gotowe", Status: "Zrobione", Termin: "2026-11-16" }])} today={TODAY} />);
      expect(within(wiersz("Gotowe")).getByText("jutro")).not.toHaveClass("text-destructive-foreground");
    });

    it("Pusta strona: bez kart", () => {
      render(<PageTable block={blok("empty", [{ Nazwa: "A" }])} today={TODAY} />);
      expect(screen.queryByTestId("przypiete-karty")).not.toBeInTheDocument();
    });
  });

  describe("filtr", () => {
    it("warunek zawęża tabelę i karty; „Zapisz jako domyślny” zapisuje settings.filters", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      await user.click(screen.getByRole("button", { name: "Filtruj" }));
      const filtr = await screen.findByRole("dialog", { name: "Filtr" });
      await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
      await user.type(within(filtr).getByRole("textbox", { name: "Wartość warunku 1" }), "deep");
      expect(tytuly()).toEqual(["Deep Work"]);
      expect(karta("Czytam teraz").textContent).toContain("0");
      expect(screen.getByRole("button", { name: "Filtruj · 1" })).toBeInTheDocument();
      await user.click(within(filtr).getByRole("button", { name: "Zapisz jako domyślny" }));
      expect(actions.saveTableSettings).toHaveBeenCalledWith(b.id, { filters: [expect.objectContaining({ op: "contains", value: "deep" })] });
    });

    it("„Filtruj po tym polu” otwiera filtr z warunkiem dla pola", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: "Filtruj po tym polu" }));
      const filtr = await screen.findByRole("dialog", { name: "Filtr" });
      expect(within(filtr).getByRole("button", { name: "Pole warunku 1" }).textContent).toContain("Autor");
      expect(screen.getByRole("button", { name: "Filtruj · 1" })).toBeInTheDocument();
    });
  });

  describe("menu kolumny", () => {
    it("sort z menu kolumny zapisuje settings.sort i zmienia plakietkę i kolejność", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS.slice(3, 6));
      render(<PageTable block={b} today={TODAY} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: "Sortuj malejąco" }));
      const autor = b.fields.find((f) => f.name === "Autor")!;
      expect(actions.saveTableSettings).toHaveBeenCalledWith(b.id, { sort: [{ field_id: autor.id, dir: "desc" }] });
      expect(screen.getByText("Sort: Autor")).toBeInTheDocument();
      expect(tytuly()).toEqual(["Zero to One", "Diuna", "Deep Work"]);
    });

    it("ukrycie kolumny i ponowne pokazanie w „Widoczne kolumny” menu „⋯”", async () => {
      const user = userEvent.setup();
      const b = blok("projects", PROJECTS);
      render(<PageTable block={b} today={TODAY} />);
      const menu = await otworzMenu(user, "Repo");
      await user.click(within(menu).getByRole("menuitem", { name: "Ukryj kolumnę" }));
      const repo = b.fields.find((f) => f.name === "Repo")!;
      expect(actions.saveTableSettings).toHaveBeenCalledWith(b.id, { hidden_field_ids: [repo.id] });
      expect(screen.queryByRole("columnheader", { name: /Repo/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Menu tabeli" }));
      const ustawienia = await screen.findByRole("dialog", { name: "Ustawienia tabeli" });
      // Pierwszej kolumny nie da się ukryć; ukryta Repo ma aria-pressed=false
      expect(within(ustawienia).getByRole("button", { name: "Nazwa", pressed: true })).toBeDisabled();
      await user.click(within(ustawienia).getByRole("button", { name: "Repo", pressed: false }));
      expect(actions.saveTableSettings).toHaveBeenLastCalledWith(b.id, { hidden_field_ids: [] });
      expect(screen.getByRole("columnheader", { name: /Repo/ })).toBeInTheDocument();
    });

    it("podsumowanie zapisuje column_summaries i liczy stopkę", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: "Podsumowanie Brak ›" }));
      await user.click(within(screen.getByRole("menu", { name: "Podsumowanie" })).getByRole("menuitem", { name: "Wypełnione" }));
      const autor = b.fields.find((f) => f.name === "Autor")!;
      expect(actions.saveTableSettings).toHaveBeenCalledWith(b.id, {
        column_summaries: expect.objectContaining({ [autor.id]: { kind: "filled" } }),
      });
      const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
      expect(within(stopka).getByText("11 wypełnionych")).toBeInTheDocument();
    });

    it("zmiana typu ze stratą pyta o potwierdzenie i dopiero po nim zapisuje", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS.slice(0, 4))} today={TODAY} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: /Typ: Tekst/ }));
      await user.click(screen.getByRole("menuitem", { name: /Liczba/ }));
      expect(screen.getByText("4 wartości nie da się przenieść i zostaną wyczyszczone.")).toBeInTheDocument();
      expect(actions.changeFieldType).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Zmień typ" }));
      await waitFor(() => expect(actions.changeFieldType).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByText("Zmienić typ pola?")).not.toBeInTheDocument());
    });

    it("„Przesuń w prawo” woła reorderFields z nową kolejnością", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      const menu = await otworzMenu(user, "Autor");
      expect(within(menu).getByRole("menuitem", { name: "Przesuń w lewo" })).toBeEnabled();
      await user.click(within(menu).getByRole("menuitem", { name: "Przesuń w prawo" }));
      const [tytul, autor, status, ...reszta] = b.fields.map((f) => f.id);
      expect(actions.reorderFields).toHaveBeenCalledWith(b.id, [tytul, status, autor, ...reszta]);
      const naglowki = screen.getAllByRole("columnheader").map((h) => h.textContent);
      expect(naglowki.slice(0, 3)).toEqual(["Tytuł", "Status", "Autor"]);
    });

    it("pierwsza kolumna ma wyłączone „Przesuń w lewo”, ostatnia „Przesuń w prawo”", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      let menu = await otworzMenu(user, "Tytuł");
      expect(within(menu).getByRole("menuitem", { name: "Przesuń w lewo" })).toBeDisabled();
      await user.keyboard("{Escape}");
      menu = await otworzMenu(user, "Przeczytana");
      expect(within(menu).getByRole("menuitem", { name: "Przesuń w prawo" })).toBeDisabled();
    });

    it("błąd przesunięcia przywraca kolejność i pokazuje toast", async () => {
      actions.reorderFields.mockResolvedValue({ ok: false, message: "x" });
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: "Przesuń w prawo" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      const naglowki = screen.getAllByRole("columnheader").map((h) => h.textContent);
      expect(naglowki.slice(0, 3)).toEqual(["Tytuł", "Autor", "Status"]);
    });

    it("dodanie opcji „Porzucone” w menu Status woła updateField z kolorem z PALETA", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      const status = b.fields.find((f) => f.name === "Status")!;
      const n = status.config.options!.length;
      render(<PageTable block={b} today={TODAY} />);
      const menu = await otworzMenu(user, "Status");
      expect(within(menu).getByText("Opcje")).toBeInTheDocument();
      await user.type(within(menu).getByRole("textbox", { name: "Nowa opcja" }), "Porzucone{Enter}");
      expect(actions.updateField).toHaveBeenCalledTimes(1);
      const [id, patch] = actions.updateField.mock.calls[0];
      expect(id).toBe(status.id);
      const nowa = patch.config.options.at(-1);
      expect(nowa).toEqual({ id: expect.any(String), label: "Porzucone", color: PALETA[n % 8] });
      expect(patch.config.options).toHaveLength(n + 1);
      expect(within(menu).getByText("Porzucone")).toBeInTheDocument();
    });

    it("opcja o tej samej nazwie nie dubluje się", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      const menu = await otworzMenu(user, "Status");
      await user.type(within(menu).getByRole("textbox", { name: "Nowa opcja" }), "czytam{Enter}");
      expect(actions.updateField).not.toHaveBeenCalled();
    });

    it("usunięcie opcji woła updateField bez niej", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      const status = b.fields.find((f) => f.name === "Status")!;
      render(<PageTable block={b} today={TODAY} />);
      const menu = await otworzMenu(user, "Status");
      await user.click(within(menu).getByRole("button", { name: "Usuń opcję Czytam" }));
      const [id, patch] = actions.updateField.mock.calls[0];
      expect(id).toBe(status.id);
      expect(patch.config.options.map((o: { label: string }) => o.label)).not.toContain("Czytam");
      expect(patch.config.options).toHaveLength(status.config.options!.length - 1);
    });

    describe("usunięcie opcji z odwołaniami", () => {
      // Books z zapisanym filtrem „Status jest jednym z: Przeczytane”
      function booksZFiltrem() {
        const b = blok("books", BOOKS);
        const status = b.fields.find((f) => f.name === "Status")!;
        const przeczytane = status.config.options!.find((o) => o.label === "Przeczytane")!.id;
        const ustawienia = b.content.settings as { filters: unknown[] };
        ustawienia.filters = [{ field_id: status.id, op: "in", value: [przeczytane] }];
        return { b, status, przeczytane };
      }

      it("„Przeczytane”: puste wartości wierszy, bez karty, podsumowań i warunku filtra", async () => {
        const user = userEvent.setup();
        const { b, status, przeczytane } = booksZFiltrem();
        const data = b.fields.find((f) => f.name === "Przeczytana")!;
        const wierszeZOpcja = b.rows.filter((r) => r.values[status.id] === przeczytane).map((r) => r.id);
        render(<PageTable block={b} today={TODAY} />);
        expect(screen.getByRole("button", { name: "Filtruj · 1" })).toBeInTheDocument();
        expect(karta("Przeczytane w 2026")).toBeInTheDocument();

        const menu = await otworzMenu(user, "Status");
        await user.click(within(menu).getByRole("button", { name: "Usuń opcję Przeczytane" }));

        // Wiersze: każdy z tą opcją dostaje pustą wartość
        expect(wierszeZOpcja).toHaveLength(7);
        expect(actions.updateRow).toHaveBeenCalledTimes(7);
        for (const id of wierszeZOpcja) expect(actions.updateRow).toHaveBeenCalledWith(id, { [status.id]: null });
        // Ustawienia: bez warunku filtra, karty liczącej opcję i podsumowań na niej (Status i „w roku” z where)
        const [blokId, zmiany] = actions.saveTableSettings.mock.calls[0];
        expect(blokId).toBe(b.id);
        expect(zmiany.filters).toEqual([]);
        expect(zmiany.pinned_cards.map((c: { label: string }) => c.label)).toEqual(["Czytam teraz", "Średnia ocena"]);
        expect(zmiany.column_summaries[status.id]).toBeUndefined();
        expect(zmiany.column_summaries[data.id]).toBeUndefined();
        // Pole: bez opcji
        const [poleId, patch] = actions.updateField.mock.calls[0];
        expect(poleId).toBe(status.id);
        expect(patch.config.options.map((o: { id: string }) => o.id)).not.toContain(przeczytane);

        // Widok od razu
        expect(screen.queryByText("Przeczytane w 2026", { selector: "div" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Filtruj" })).toBeInTheDocument();
        expect(within(wiersz("Deep Work")).queryByText("Przeczytane")).not.toBeInTheDocument();
        const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
        expect(within(stopka).getByText("11 wierszy")).toBeInTheDocument();
        expect(within(stopka).queryByText("7 przeczytanych")).not.toBeInTheDocument();
        expect(within(stopka).queryByText("6 w tym roku")).not.toBeInTheDocument();
      });

      it("warunek tymczasowy na tej opcji też znika", async () => {
        const user = userEvent.setup();
        const b = blok("books", BOOKS);
        render(<PageTable block={b} today={TODAY} />);
        await user.click(screen.getByRole("button", { name: "Filtruj" }));
        const filtr = await screen.findByRole("dialog", { name: "Filtr" });
        await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
        await user.click(within(filtr).getByRole("button", { name: "Pole warunku 1" }));
        await user.click(within(screen.getByRole("listbox", { name: "Pole warunku 1" })).getByRole("option", { name: /Status/ }));
        await user.click(within(filtr).getByRole("button", { name: "Przeczytane" }));
        expect(tytuly()).toHaveLength(7);
        await user.keyboard("{Escape}");
        const menu = await otworzMenu(user, "Status");
        await user.click(within(menu).getByRole("button", { name: "Usuń opcję Przeczytane" }));
        expect(screen.getByRole("button", { name: "Filtruj" })).toBeInTheDocument();
        expect(tytuly()).toHaveLength(11);
      });

      it("błąd zapisu cofa wszystko: wartości, kartę, podsumowania, filtr i opcję", async () => {
        actions.updateField.mockResolvedValue({ ok: false, message: "x" });
        const user = userEvent.setup();
        const { b } = booksZFiltrem();
        render(<PageTable block={b} today={TODAY} />);
        const menu = await otworzMenu(user, "Status");
        await user.click(within(menu).getByRole("button", { name: "Usuń opcję Przeczytane" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
        expect(within(menu).getByRole("button", { name: "Usuń opcję Przeczytane" })).toBeInTheDocument();
        expect(karta("Przeczytane w 2026")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Filtruj · 1" })).toBeInTheDocument();
        expect(within(wiersz("Deep Work")).getByText("Przeczytane")).toBeInTheDocument();
        const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
        expect(within(stopka).getByText("7 przeczytanych")).toBeInTheDocument();
        expect(within(stopka).getByText("6 w tym roku")).toBeInTheDocument();
        expect(tytuly()).toHaveLength(7);
      });
    });

    it("kolumna tekstowa nie ma sekcji „Opcje”", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      const menu = await otworzMenu(user, "Autor");
      expect(within(menu).queryByText("Opcje")).not.toBeInTheDocument();
    });
  });

  describe("„+” w nagłówku", () => {
    it("otwiera „Nowe pole” bez typu Sekret i dodaje kolumnę na końcu", async () => {
      const user = userEvent.setup();
      actions.addField.mockImplementation(async (_b: string, input: { name: string; type: string; config: object }) => ({
        ok: true,
        field: { id: "pole-nowe", position: 5, isTitle: false, ...input },
      }));
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      const plus = screen.getByRole("button", { name: "Dodaj kolumnę" });
      expect(plus.closest("th")).toBe(screen.getAllByRole("columnheader").at(-1));
      await user.click(plus);
      const okno = screen.getByRole("dialog", { name: "Nowe pole" });
      await user.type(within(okno).getByRole("textbox", { name: "Szukaj typu" }), "sek");
      expect(within(okno).queryByText("Sekret")).not.toBeInTheDocument();
      await user.clear(within(okno).getByRole("textbox", { name: "Szukaj typu" }));
      await user.click(within(okno).getByRole("button", { name: "Dodaj pole" }));
      expect(actions.addField).toHaveBeenCalledWith(b.id, expect.objectContaining({ name: "Notatka", type: "text" }));
      await waitFor(() => expect(screen.getAllByRole("columnheader")[5].textContent).toContain("Notatka"));
    });
  });

  describe("wiersze", () => {
    it("„Edytuj” otwiera tryb wiersza, „Zapisz” wysyła zmienione komórki", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Edytuj wiersz" }));
      expect(edycja()).toHaveClass("bg-success-soft/50");
      await user.type(within(edycja()).getByRole("textbox", { name: "Autor" }), "!");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      const autor = b.fields.find((f) => f.name === "Autor")!;
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-4", { [autor.id]: "Cal Newport!" }));
      expect(screen.getByText("Cal Newport!")).toBeInTheDocument();
    });

    it("„+ Nowy”: szkic z opcją domyślną, pusty tytuł → „Bez tytułu”, stopka liczy wiersze", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      await user.click(screen.getByRole("button", { name: "Nowy" }));
      expect(within(edycja()).getByRole("button", { name: "Status" }).textContent).toContain("Chcę przeczytać");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      const tytul = b.fields.find((f) => f.isTitle)!;
      expect(actions.addRow).toHaveBeenCalledWith(b.id, expect.objectContaining({ [tytul.id]: "Bez tytułu" }));
      const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
      expect(within(stopka).getByText("12 wierszy")).toBeInTheDocument();
    });

    it("usunięcie: wiersz znika, toast „Usunięto · Cofnij” przywraca", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      await user.click(within(wiersz("Atomic Habits")).getByRole("button", { name: "Usuń wiersz" }));
      expect(screen.queryByText("Atomic Habits")).not.toBeInTheDocument();
      expect(karta("Czytam teraz").textContent).toContain("1");
      expect(actions.deleteRow).toHaveBeenCalledWith("row-1");
      await waitFor(() => expect(toast).toHaveBeenCalledWith("Usunięto", expect.anything()));
      const opcje = toast.mock.calls[0][1] as { action: { label: string; onClick: () => Promise<void> } };
      expect(opcje.action.label).toBe("Cofnij");
      await act(async () => {
        await opcje.action.onClick();
      });
      expect(actions.restoreRow).toHaveBeenCalledWith("row-1");
      expect(screen.getByText("Atomic Habits")).toBeInTheDocument();
    });
  });

  describe("stopka", () => {
    it("Books: liczba wierszy w pierwszej kolumnie i podsumowania", () => {
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
      expect(within(stopka).getByText("11 wierszy")).toBeInTheDocument();
      expect(within(stopka).getByText("7 przeczytanych")).toBeInTheDocument();
      expect(within(stopka).getByText("śr. 4,1")).toBeInTheDocument();
      expect(within(stopka).getByText("6 w tym roku")).toBeInTheDocument();
    });
  });

  describe("telefon", () => {
    it("stuknięcie wiersza otwiera arkusz; „Zapisz” zapisuje", async () => {
      telefon();
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      await user.click(within(wiersz("Deep Work")).getByText("Cal Newport"));
      const arkusz = screen.getByRole("dialog", { name: "Deep Work" });
      expect(within(arkusz).getByRole("button", { name: "Usuń wiersz" })).toBeInTheDocument();
      expect(document.querySelector('tr[class*="bg-success-soft"]')).toBeNull();
      await user.type(within(arkusz).getByRole("textbox", { name: "Autor" }), "!");
      await user.click(within(arkusz).getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-4", expect.anything()));
      expect(screen.queryByRole("dialog", { name: "Deep Work" })).not.toBeInTheDocument();
    });

    it("„+ Nowy” otwiera arkusz „Nowy wiersz” bez „Usuń wiersz”", async () => {
      telefon();
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      await user.click(screen.getByRole("button", { name: "Nowy" }));
      const arkusz = screen.getByRole("dialog", { name: "Nowy wiersz" });
      expect(within(arkusz).queryByRole("button", { name: "Usuń wiersz" })).not.toBeInTheDocument();
      await user.click(within(arkusz).getByRole("button", { name: "Anuluj" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(actions.addRow).not.toHaveBeenCalled();
    });
  });
});
