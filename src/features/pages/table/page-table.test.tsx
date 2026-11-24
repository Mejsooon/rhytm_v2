import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
// Sejf (VaultProvider jest w powłoce aplikacji); tabele bez Sekretu go nie używają, moduł Hasła ustawia stan sam
const vault = vi.hoisted(() => ({ state: { status: "ladowanie" } as Record<string, unknown> }));
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => vault.state }));

import { PALETA } from "../fields";
import type { LoadedBlock } from "../load-page";
import { buildTemplateBlocks, type TemplateKey } from "../templates";
import { PageTable } from "./page-table";
import { stronaTestowa, SUBSKRYPCJE } from "./test-page";

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

// Wiersz po tekście komórki albo wartości pola w komórce (tytuł i tekst to pola edycji)
function wiersz(tekst: string) {
  const tr = screen
    .getAllByRole("row")
    .find(
      (r) =>
        r.textContent?.includes(tekst) ||
        Array.from(r.querySelectorAll("input")).some((i) => i.value.includes(tekst)),
    );
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
    .map((r) => (r.querySelector("td input") as HTMLInputElement | null)?.value);
}

function naglowek(nazwa: string) {
  return screen.getByRole("columnheader", { name: new RegExp(nazwa) });
}

async function otworzMenu(user: ReturnType<typeof userEvent.setup>, nazwa: string) {
  await user.click(within(naglowek(nazwa)).getByRole("button", { name: new RegExp(nazwa) }));
  return screen.getByRole("menu", { name: `Kolumna ${nazwa}` });
}

function telefon() {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
}

describe("PageTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vault.state = { status: "ladowanie" };
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
      // Trzy karty i przycisk „Karta” na końcu rzędu
      expect(screen.getByTestId("przypiete-karty").children).toHaveLength(4);
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

    it("„⋯”: nazwa z pola w menu zapisuje się Enterem i przy zamknięciu menu (Esc)", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      await user.click(screen.getByRole("button", { name: "Menu tabeli" }));
      const menu = await screen.findByRole("dialog", { name: "Ustawienia tabeli" });
      const pole = within(menu).getByRole("textbox", { name: "Nazwa tabeli" });
      await user.clear(pole);
      await user.type(pole, "Lektury");
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ustawienia tabeli" })).toBeNull());
      expect(actions.updateBlockContent).toHaveBeenCalledTimes(1);
      expect(actions.updateBlockContent).toHaveBeenCalledWith(b.id, expect.objectContaining({ name: "Lektury" }));
      expect(screen.getByRole("textbox", { name: "Nazwa tabeli" })).toHaveValue("Lektury");
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
      expect(screen.queryAllByTestId("karta")).toHaveLength(0);
      // Przycisk dodawania karty jest widoczny także bez kart
      expect(screen.getByRole("button", { name: "Dodaj kartę" })).toBeInTheDocument();
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
      // Kolumny tytułu nie da się ukryć; ukryta Repo ma aria-pressed=false
      expect(within(ustawienia).getByRole("button", { name: "Nazwa", pressed: true })).toBeDisabled();
      await user.click(within(ustawienia).getByRole("button", { name: "Repo", pressed: false }));
      expect(actions.saveTableSettings).toHaveBeenLastCalledWith(b.id, { hidden_field_ids: [] });
      expect(screen.getByRole("columnheader", { name: /Repo/ })).toBeInTheDocument();
    });

    it("kolumna na pozycji 0 (stare dane z serwera) da się ukryć i przywrócić z „⋯”", async () => {
      const user = userEvent.setup();
      const zSzablonu = blok("books", BOOKS);
      // Przesuwanie nie stawia już niczego przed tytułem, więc taka kolejność przychodzi tylko z serwera
      const b = {
        ...zSzablonu,
        fields: zSzablonu.fields.map((f) => (f.name === "Autor" ? { ...f, position: -1 } : f)),
      };
      render(<PageTable block={b} today={TODAY} />);
      expect(screen.getAllByRole("columnheader")[0].textContent).toBe("Autor");
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: "Ukryj kolumnę" }));
      const autor = b.fields.find((f) => f.name === "Autor")!;
      expect(actions.saveTableSettings).toHaveBeenLastCalledWith(b.id, { hidden_field_ids: [autor.id] });
      expect(screen.queryByRole("columnheader", { name: /Autor/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Menu tabeli" }));
      const ustawienia = await screen.findByRole("dialog", { name: "Ustawienia tabeli" });
      const przycisk = within(ustawienia).getByRole("button", { name: "Autor", pressed: false });
      expect(przycisk).toBeEnabled();
      await user.click(przycisk);
      expect(actions.saveTableSettings).toHaveBeenLastCalledWith(b.id, { hidden_field_ids: [] });
      expect(screen.getByRole("columnheader", { name: /Autor/ })).toBeInTheDocument();
    });

    it("kolumny tytułu nie da się ukryć ani z menu kolumny, ani z listy „Widoczne kolumny”", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      const menu = await otworzMenu(user, "Tytuł");
      expect(within(menu).getByRole("menuitem", { name: "Ukryj kolumnę" })).toBeDisabled();
      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "Menu tabeli" }));
      const ustawienia = await screen.findByRole("dialog", { name: "Ustawienia tabeli" });
      expect(within(ustawienia).getByRole("button", { name: "Tytuł", pressed: true })).toBeDisabled();
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

    it("kolumna tytułu ma wyłączone oba przesunięcia, kolumna tuż za nią „Przesuń w lewo”", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      let menu = await otworzMenu(user, "Tytuł");
      expect(within(menu).getByRole("menuitem", { name: "Przesuń w lewo" })).toBeDisabled();
      expect(within(menu).getByRole("menuitem", { name: "Przesuń w prawo" })).toBeDisabled();
      await user.keyboard("{Escape}");
      menu = await otworzMenu(user, "Autor");
      expect(within(menu).getByRole("menuitem", { name: "Przesuń w lewo" })).toBeDisabled();
      expect(within(menu).getByRole("menuitem", { name: "Przesuń w prawo" })).toBeEnabled();
      await user.keyboard("{Escape}");
      menu = await otworzMenu(user, "Status");
      expect(within(menu).getByRole("menuitem", { name: "Przesuń w lewo" })).toBeEnabled();
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

    it("zmiana nazwy opcji z okienka komórki zostawia wiersz pod filtrem „in” i pokazuje nową nazwę", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      const status = b.fields.find((f) => f.name === "Status")!;
      const czytam = status.config.options!.find((o) => o.label === "Czytam")!.id;
      (b.content.settings as { filters: unknown[] }).filters = [{ field_id: status.id, op: "in", value: [czytam] }];
      render(<PageTable block={b} today={TODAY} />);
      expect(tytuly()).toEqual(["Atomic Habits", "Hacking: The Art of Exploitation"]);
      await user.click(within(wiersz("Atomic Habits")).getByRole("button", { name: /^Status: / }));
      await user.click(screen.getByRole("button", { name: "Edytuj opcję „Czytam”" }));
      const nazwa = screen.getByRole("textbox", { name: "Nazwa opcji" });
      await user.clear(nazwa);
      await user.type(nazwa, "W trakcie{Enter}");
      const [poleId, patch] = actions.updateField.mock.calls[0];
      expect(poleId).toBe(status.id);
      expect(patch.config.options.find((o: { id: string }) => o.id === czytam).label).toBe("W trakcie");
      // Wiersze zostają widoczne (filtr trzyma id opcji), komórka pokazuje nową nazwę
      expect(tytuly()).toEqual(["Atomic Habits", "Hacking: The Art of Exploitation"]);
      expect(within(wiersz("Atomic Habits")).getByRole("button", { name: /^Status: / })).toHaveTextContent("W trakcie");
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
    it("„Utwórz «Porzucone»” w komórce Status zapisuje id nowej opcji i pokazuje ją w komórce", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      const status = b.fields.find((f) => f.name === "Status")!;
      render(<PageTable block={b} today={TODAY} />);
      await user.click(within(wiersz("Clean Code")).getByRole("button", { name: /^Status: / }));
      await user.type(screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }), "Porzucone");
      await user.click(screen.getByRole("button", { name: "Utwórz «Porzucone»" }));
      // Id nowej opcji z zapisu pola; komórka (wołająca onSave z polem sprzed utworzenia) zapisuje właśnie je
      const zapisPola = actions.updateField.mock.calls.at(-1)![1] as { config: { options: { id: string; label: string }[] } };
      const nowa = zapisPola.config.options.find((o) => o.label === "Porzucone")!;
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-11", { [status.id]: nowa.id }));
      expect(within(wiersz("Clean Code")).getByRole("button", { name: /^Status: / })).toHaveTextContent("Porzucone");
    });

    it("bez trybu edycji wiersza: nie ma „Edytuj” ani „Zapisz”", () => {
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      expect(screen.queryByRole("button", { name: /Edytuj/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Zapisz" })).not.toBeInTheDocument();
    });

    it("zmiana tekstu w komórce woła updateRow z jedną kolumną", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      const pole = within(wiersz("Deep Work")).getByRole("textbox", { name: "Autor" });
      await user.type(pole, "!");
      await user.tab();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-4", { [autor.id]: "Cal Newport!" }));
      expect(actions.updateRow).toHaveBeenCalledTimes(1);
      expect(pole).toHaveValue("Cal Newport!");
    });

    it("gwiazdka zapisuje od razu", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      const ocena = b.fields.find((f) => f.name === "Ocena")!;
      await user.click(within(wiersz("Atomic Habits")).getByRole("button", { name: "Ocena 3 na 5" }));
      expect(actions.updateRow).toHaveBeenCalledWith("row-1", { [ocena.id]: 3 });
    });

    it("„Nowy” woła addRow z opcją domyślną, a kursor trafia do tytułu nowego wiersza", async () => {
      const user = userEvent.setup();
      let odpowiedz: () => void = () => {};
      actions.addRow.mockImplementation(
        (_b: string, values: Record<string, unknown>) =>
          new Promise((resolve) => {
            odpowiedz = () => resolve({ ok: true, row: { id: "srv-1", values, position: 99, deletedAt: null } });
          }),
      );
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      const nowy = screen.getByRole("button", { name: "Nowy" });
      await user.click(nowy);
      const status = b.fields.find((f) => f.name === "Status")!;
      const chce = status.config.options!.find((o) => o.label === "Chcę przeczytać")!.id;
      expect(actions.addRow).toHaveBeenCalledWith(b.id, expect.objectContaining({ [status.id]: chce }));
      // Do odpowiedzi serwera przycisk jest wyłączony
      expect(nowy).toBeDisabled();
      await act(async () => {
        odpowiedz();
      });
      expect(nowy).toBeEnabled();
      const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
      expect(within(stopka).getByText("12 wierszy")).toBeInTheDocument();
      const tytul = b.fields.find((f) => f.isTitle)!;
      const pole = screen.getAllByRole("textbox", { name: "Tytuł" }).find((i) => i === document.activeElement);
      expect(pole).toBeDefined();
      expect(pole).toHaveValue("");
      await user.type(pole!, "Diuna{Enter}");
      expect(actions.updateRow).toHaveBeenCalledWith("srv-1", { [tytul.id]: "Diuna" });
    });

    it("kursor w nowym wierszu ustawia się raz: po zmianie filtra komórka nie kradnie fokusu", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      await user.click(screen.getByRole("button", { name: "Nowy" }));
      const nowaKomorka = screen.getAllByRole("textbox", { name: "Tytuł" }).find((i) => i === document.activeElement);
      expect(nowaKomorka).toBeDefined();
      await user.click(screen.getByRole("button", { name: "Filtruj" }));
      const filtr = await screen.findByRole("dialog", { name: "Filtr" });
      await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
      const wartosc = within(filtr).getByRole("textbox", { name: "Wartość warunku 1" });
      // Warunek ukrywa nowy (pusty) wiersz, a po wyczyszczeniu wiersz wraca jako świeżo zamontowana komórka
      await user.type(wartosc, "deep");
      expect(nowaKomorka).not.toBeInTheDocument();
      await user.clear(wartosc);
      expect(screen.getAllByRole("textbox", { name: "Tytuł" }).some((i) => (i as HTMLInputElement).value === "")).toBe(true);
      expect(wartosc).toHaveFocus();
    });

    it("sort po tytule: zapis w trakcie pisania nie przesuwa wiersza ani nie zabiera fokusu; po wyjściu wiersz trafia na swoje miejsce", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS.slice(3, 6));
      const tytul = b.fields.find((f) => f.isTitle)!;
      const ustawienia = b.content.settings as { sort: unknown[]; filters: unknown[] };
      ustawienia.sort = [{ field_id: tytul.id, dir: "asc" }];
      ustawienia.filters = [];
      render(<PageTable block={b} today={TODAY} />);
      expect(tytuly()).toEqual(["Deep Work", "Diuna", "Zero to One"]);
      const pole = within(wiersz("Deep Work")).getByRole("textbox", { name: "Tytuł" });
      await user.click(pole);
      await user.keyboard("{Home}Zzz");
      // Zapis po 600 ms przerwy: magazyn ma już nowy tytuł, a wiersz stoi na swoim miejscu z fokusem
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-1", { [tytul.id]: "ZzzDeep Work" }), {
        timeout: 2000,
      });
      expect(tytuly()).toEqual(["ZzzDeep Work", "Diuna", "Zero to One"]);
      expect(pole).toHaveFocus();
      // Dalsze znaki trafiają do tego samego pola
      await user.keyboard("!");
      expect(pole).toHaveValue("Zzz!Deep Work");
      // Wyjście fokusu: widok liczy się znów wg sortu
      act(() => pole.blur());
      await waitFor(() => expect(tytuly()).toEqual(["Diuna", "Zero to One", "Zzz!Deep Work"]));
    });

    it("„Nowy” przy filtrze, który odrzuca nowy wiersz: wiersz widoczny z kursorem w tytule, po wyjściu znika", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      const status = b.fields.find((f) => f.name === "Status")!;
      const czytam = status.config.options!.find((o) => o.label === "Czytam")!.id;
      const ustawienia = b.content.settings as { sort: unknown[]; filters: unknown[] };
      ustawienia.sort = [];
      ustawienia.filters = [{ field_id: status.id, op: "in", value: [czytam] }];
      const { rerender } = render(<PageTable block={b} today={TODAY} />);
      expect(tytuly()).toEqual(["Atomic Habits", "Hacking: The Art of Exploitation"]);
      await user.click(screen.getByRole("button", { name: "Nowy" }));
      // Nowy wiersz („Chcę przeczytać”) nie spełnia filtra, a mimo to stoi na końcu z kursorem w tytule
      await waitFor(() => expect(tytuly()).toEqual(["Atomic Habits", "Hacking: The Art of Exploitation", ""]));
      const pole = screen.getAllByRole("textbox", { name: "Tytuł" })[2];
      expect(pole).toHaveFocus();
      await user.type(pole, "Nowa{Enter}");
      // Wyjście fokusu: wiersz znika zgodnie z filtrem
      expect(tytuly()).toEqual(["Atomic Habits", "Hacking: The Art of Exploitation"]);
      // nowyId wyczyszczony: gdy wiersz wróci do widoku (bez filtra), komórka nie kradnie fokusu
      const nowy = { id: "srv-1", values: { [status.id]: status.config.default_option }, position: 99, deletedAt: null };
      rerender(
        <PageTable
          block={{ ...b, rows: [...b.rows, nowy], content: { ...b.content, settings: { ...ustawienia, filters: [] } } }}
          today={TODAY}
        />,
      );
      expect(tytuly()).toHaveLength(12);
      expect(screen.getAllByRole("textbox", { name: "Tytuł" }).some((i) => i === document.activeElement)).toBe(false);
    });

    it("błąd „Nowy” nie dodaje wiersza i pokazuje toast", async () => {
      actions.addRow.mockResolvedValue({ ok: false, message: "x" });
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      await user.click(screen.getByRole("button", { name: "Nowy" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
      expect(within(stopka).getByText("11 wierszy")).toBeInTheDocument();
    });

    it("„Usuń wiersz”: wiersz znika, toast „Usunięto · Cofnij” przywraca", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      await user.click(within(wiersz("Atomic Habits")).getByRole("button", { name: "Usuń wiersz" }));
      expect(screen.queryByDisplayValue("Atomic Habits")).not.toBeInTheDocument();
      expect(karta("Czytam teraz").textContent).toContain("1");
      expect(actions.deleteRow).toHaveBeenCalledWith("row-1");
      await waitFor(() => expect(toast).toHaveBeenCalledWith("Usunięto", expect.anything()));
      const opcje = toast.mock.calls[0][1] as { action: { label: string; onClick: () => Promise<void> } };
      expect(opcje.action.label).toBe("Cofnij");
      await act(async () => {
        await opcje.action.onClick();
      });
      expect(actions.restoreRow).toHaveBeenCalledWith("row-1");
      expect(screen.getByDisplayValue("Atomic Habits")).toBeInTheDocument();
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

  describe("szerokość kolumn i przewijanie", () => {
    it("domyślne szerokości z <col>: tytuł 300, ocena 130, a ostatnia kolumna bez szerokości", () => {
      const b = blok("books", BOOKS.slice(0, 2));
      const { container } = render(<PageTable block={b} today={TODAY} />);
      const kolumny = Array.from(container.querySelectorAll("col")) as HTMLElement[];
      const idx = (nazwa: string) => b.fields.findIndex((f) => f.name === nazwa);
      expect(kolumny[idx("Tytuł")].style.width).toBe("300px");
      expect(kolumny[idx("Ocena")].style.width).toBe("130px");
      expect(kolumny[kolumny.length - 1].style.width).toBe("");
    });

    it("tabela ma width równy sumie szerokości plus 56 px i min-width: 100%", () => {
      const b = blok("books", BOOKS.slice(0, 2));
      const { container } = render(<PageTable block={b} today={TODAY} />);
      const kolumny = Array.from(container.querySelectorAll("col")) as HTMLElement[];
      const suma = kolumny.slice(0, -1).reduce((a, c) => a + parseInt(c.style.width, 10), 0);
      const tabela = container.querySelector("table") as HTMLElement;
      expect(tabela.style.width).toBe(`${suma + 56}px`);
      expect(tabela.style.minWidth).toBe("100%");
      expect(tabela.style.tableLayout).toBe("fixed");
    });

    it("śmieciowe wartości z bazy (poniżej 80, nie liczba) dają szerokość domyślną", () => {
      const b = blok("books", BOOKS.slice(0, 1));
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const ocena = b.fields.find((f) => f.name === "Ocena")!;
      const zle: LoadedBlock = {
        ...b,
        content: { ...b.content, settings: { ...(b.content.settings as object), column_widths: { [autor.id]: 10, [ocena.id]: "x" } } },
      };
      const { container } = render(<PageTable block={zle} today={TODAY} />);
      const kolumny = Array.from(container.querySelectorAll("col")) as HTMLElement[];
      expect(kolumny[b.fields.indexOf(autor)].style.width).toBe("220px");
      expect(kolumny[b.fields.indexOf(ocena)].style.width).toBe("130px");
    });

    it("ArrowRight na uchwycie „Autor” zapisuje 240 i nie zmienia innych kolumn", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS.slice(0, 2));
      const { container } = render(<PageTable block={b} today={TODAY} />);
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const uchwyt = screen.getByRole("separator", { name: "Zmień szerokość kolumny Autor (strzałki w lewo i w prawo)" });
      expect(uchwyt).toHaveAttribute("aria-orientation", "vertical");
      uchwyt.focus();
      await user.keyboard("{ArrowRight}");
      expect(actions.saveTableSettings).toHaveBeenCalledTimes(1);
      expect(actions.saveTableSettings).toHaveBeenCalledWith(b.id, { column_widths: { [autor.id]: 240 } });
      const kolumny = Array.from(container.querySelectorAll("col")) as HTMLElement[];
      expect(kolumny[b.fields.indexOf(autor)].style.width).toBe("240px");
      expect(kolumny[0].style.width).toBe("300px");
    });

    it("ArrowLeft przy 80 zostaje na 80 bez zapisu, a przy 90 schodzi do 80", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS.slice(0, 1));
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const wazki: LoadedBlock = {
        ...b,
        content: { ...b.content, settings: { ...(b.content.settings as object), column_widths: { [autor.id]: 80 } } },
      };
      render(<PageTable block={wazki} today={TODAY} />);
      const uchwyt = screen.getByRole("separator", { name: /Autor/ });
      uchwyt.focus();
      await user.keyboard("{ArrowLeft}");
      expect(actions.saveTableSettings).not.toHaveBeenCalled();
      expect(uchwyt).toHaveAttribute("aria-valuenow", "80");
    });

    it("przeciąganie zmienia szerokość lokalnie, a zapis idzie raz po puszczeniu", () => {
      const b = blok("books", BOOKS.slice(0, 1));
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const { container } = render(<PageTable block={b} today={TODAY} />);
      const uchwyt = screen.getByRole("separator", { name: /Autor/ });
      uchwyt.setPointerCapture = vi.fn();
      uchwyt.releasePointerCapture = vi.fn();
      const kolumny = Array.from(container.querySelectorAll("col")) as HTMLElement[];
      fireEvent.pointerDown(uchwyt, { pointerId: 1, clientX: 500, button: 0 });
      fireEvent.pointerMove(uchwyt, { pointerId: 1, clientX: 560, buttons: 1 });
      expect(kolumny[b.fields.indexOf(autor)].style.width).toBe("280px");
      fireEvent.pointerMove(uchwyt, { pointerId: 1, clientX: 100, buttons: 1 });
      expect(kolumny[b.fields.indexOf(autor)].style.width).toBe("80px");
      expect(actions.saveTableSettings).not.toHaveBeenCalled();
      fireEvent.pointerMove(uchwyt, { pointerId: 1, clientX: 530, buttons: 1 });
      fireEvent.pointerUp(uchwyt, { pointerId: 1, clientX: 530 });
      expect(actions.saveTableSettings).toHaveBeenCalledTimes(1);
      expect(actions.saveTableSettings).toHaveBeenCalledWith(b.id, { column_widths: { [autor.id]: 250 } });
    });

    it("pointercancel i lostpointercapture czyszczą stan: cancel bez zapisu, lost z zapisem", () => {
      const b = blok("books", BOOKS.slice(0, 1));
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const { container } = render(<PageTable block={b} today={TODAY} />);
      const uchwyt = screen.getByRole("separator", { name: /Autor/ });
      uchwyt.setPointerCapture = vi.fn();
      const kolumny = Array.from(container.querySelectorAll("col")) as HTMLElement[];
      const kol = kolumny[b.fields.indexOf(autor)];
      fireEvent.pointerDown(uchwyt, { pointerId: 1, clientX: 500, button: 0 });
      fireEvent.pointerMove(uchwyt, { pointerId: 1, clientX: 540, buttons: 1 });
      fireEvent.pointerCancel(uchwyt, { pointerId: 1 });
      expect(kol.style.width).toBe("220px");
      fireEvent.pointerMove(uchwyt, { pointerId: 1, clientX: 700, buttons: 1 });
      expect(kol.style.width).toBe("220px");
      expect(actions.saveTableSettings).not.toHaveBeenCalled();
      fireEvent.pointerDown(uchwyt, { pointerId: 2, clientX: 500, button: 0 });
      fireEvent.pointerMove(uchwyt, { pointerId: 3, clientX: 900, buttons: 1 });
      expect(kol.style.width).toBe("220px");
      fireEvent.pointerMove(uchwyt, { pointerId: 2, clientX: 540, buttons: 1 });
      fireEvent.lostPointerCapture(uchwyt, { pointerId: 2 });
      expect(actions.saveTableSettings).toHaveBeenCalledTimes(1);
      expect(actions.saveTableSettings).toHaveBeenCalledWith(b.id, { column_widths: { [autor.id]: 260 } });
      fireEvent.pointerMove(uchwyt, { pointerId: 2, clientX: 900, buttons: 1 });
      expect(kol.style.width).toBe("260px");
    });

    it("ruch bez wciśniętego przycisku kończy przeciąganie bez zapisu i nie zmienia szerokości", () => {
      const b = blok("books", BOOKS.slice(0, 1));
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const { container } = render(<PageTable block={b} today={TODAY} />);
      const uchwyt = screen.getByRole("separator", { name: /Autor/ });
      uchwyt.setPointerCapture = vi.fn();
      const kol = (Array.from(container.querySelectorAll("col")) as HTMLElement[])[b.fields.indexOf(autor)];
      fireEvent.pointerDown(uchwyt, { pointerId: 1, clientX: 500, button: 0, buttons: 1 });
      fireEvent.pointerMove(uchwyt, { pointerId: 1, clientX: 600, buttons: 0 });
      expect(kol.style.width).toBe("220px");
      fireEvent.pointerMove(uchwyt, { pointerId: 1, clientX: 700, buttons: 1 });
      expect(kol.style.width).toBe("220px");
      expect(actions.saveTableSettings).not.toHaveBeenCalled();
    });

    it("wyzwalacz menu kolumny ucina długą nazwę: max-w (z ujemnym marginesem .colbtn), min-w-0 i truncate", () => {
      const b = blok("books", BOOKS.slice(0, 1));
      render(<PageTable block={b} today={TODAY} />);
      const przycisk = within(naglowek("Autor")).getByRole("button", { name: /Autor/ });
      expect(przycisk).toHaveClass("max-w-[calc(100%+12px)]", "min-w-0");
      expect(within(przycisk).getByText("Autor")).toHaveClass("min-w-0", "truncate");
    });

    it("klik bez ruchu nie zapisuje i daje uchwytowi fokus", () => {
      const b = blok("books", BOOKS.slice(0, 1));
      render(<PageTable block={b} today={TODAY} />);
      const uchwyt = screen.getByRole("separator", { name: /Autor/ });
      uchwyt.setPointerCapture = vi.fn();
      fireEvent.pointerDown(uchwyt, { pointerId: 1, clientX: 500, button: 0 });
      fireEvent.pointerUp(uchwyt, { pointerId: 1, clientX: 500 });
      expect(actions.saveTableSettings).not.toHaveBeenCalled();
      expect(uchwyt).toHaveFocus();
    });

    it("dwie strzałki z rzędu dają 240 i 260, a zapis zachowuje inne wpisy mapy", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS.slice(0, 1));
      const tytul = b.fields.find((f) => f.isTitle)!;
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const z: LoadedBlock = {
        ...b,
        content: { ...b.content, settings: { ...(b.content.settings as object), column_widths: { [tytul.id]: 350.5 } } },
      };
      render(<PageTable block={z} today={TODAY} />);
      screen.getByRole("separator", { name: /Autor/ }).focus();
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(actions.saveTableSettings).toHaveBeenNthCalledWith(1, b.id, { column_widths: { [tytul.id]: 351, [autor.id]: 240 } });
      expect(actions.saveTableSettings).toHaveBeenNthCalledWith(2, b.id, { column_widths: { [tytul.id]: 351, [autor.id]: 260 } });
    });

    it("ramka ma przewijanie poziome", () => {
      const b = blok("books", BOOKS.slice(0, 1));
      const { container } = render(<PageTable block={b} today={TODAY} />);
      expect(container.querySelector("table")!.parentElement).toHaveClass("overflow-x-auto");
    });
  });

  describe("telefon", () => {
    it("stuknięcie wiersza otwiera arkusz; „Zapisz” zapisuje", async () => {
      telefon();
      const user = userEvent.setup();
      render(<PageTable block={blok("books", BOOKS)} today={TODAY} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Ocena 2 na 5" }));
      const arkusz = screen.getByRole("dialog", { name: "Deep Work" });
      // Dotknięcie otwiera arkusz zamiast zmieniać komórkę
      expect(actions.updateRow).not.toHaveBeenCalled();
      expect(within(arkusz).getByRole("button", { name: "Usuń wiersz" })).toBeInTheDocument();
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

  describe("okno karty", () => {
    it("„Dodaj kartę” zapisuje nową kartę na końcu listy", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      render(<PageTable block={b} today={TODAY} />);
      await user.click(screen.getByRole("button", { name: "Dodaj kartę" }));
      const okno = screen.getByRole("dialog");
      await user.click(within(within(okno).getByRole("radiogroup", { name: "Kolumna" })).getByRole("radio", { name: "Autor" }));
      await user.click(within(okno).getByRole("button", { name: "Dodaj kartę" }));
      const [blokId, zmiany] = actions.saveTableSettings.mock.calls[0];
      expect(blokId).toBe(b.id);
      expect(zmiany.pinned_cards).toHaveLength(4);
      expect(zmiany.pinned_cards[3]).toMatchObject({ label: "Autor", aggregation: "count_distinct" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("„Edytuj kartę” podmienia kartę pod indeksem i zachowuje szerokość", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      (b.content.settings as { pinned_cards: { width?: number }[] }).pinned_cards[1].width = 300;
      render(<PageTable block={b} today={TODAY} />);
      const menuKarty = screen.getAllByRole("button", { name: "Menu karty" })[1];
      await user.click(menuKarty);
      await user.click(screen.getByRole("menuitem", { name: "Edytuj kartę" }));
      const okno = screen.getByRole("dialog");
      expect(within(okno).getByRole("heading", { name: "Edytuj kartę" })).toBeInTheDocument();
      await user.clear(within(okno).getByLabelText("Napis"));
      await user.type(within(okno).getByLabelText("Napis"), "Moja ocena");
      await user.click(within(okno).getByRole("button", { name: "Zapisz" }));
      const [, zmiany] = actions.saveTableSettings.mock.calls[0];
      expect(zmiany.pinned_cards).toHaveLength(3);
      expect(zmiany.pinned_cards[1]).toMatchObject({ label: "Moja ocena", width: 300 });
    });

    it("lista kart zmieniona przy otwartym oknie: zapis trafia w edytowaną kartę, a usuniętej nie dodaje", async () => {
      const user = userEvent.setup();
      const b = blok("books", BOOKS);
      const ustawienia = b.content.settings as { pinned_cards: { label: string }[] };
      const { rerender } = render(<PageTable block={b} today={TODAY} />);
      await user.click(screen.getAllByRole("button", { name: "Menu karty" })[1]);
      await user.click(screen.getByRole("menuitem", { name: "Edytuj kartę" }));
      // Odświeżenie z serwera przy otwartym oknie: bez pierwszej karty, nowe obiekty
      const bezPierwszej = JSON.parse(JSON.stringify(ustawienia.pinned_cards.slice(1)));
      rerender(
        <PageTable block={{ ...b, content: { ...b.content, settings: { ...ustawienia, pinned_cards: bezPierwszej } } }} today={TODAY} />,
      );
      const okno = screen.getByRole("dialog");
      await user.clear(within(okno).getByLabelText("Napis"));
      await user.type(within(okno).getByLabelText("Napis"), "Moja ocena");
      await user.click(within(okno).getByRole("button", { name: "Zapisz" }));
      const [, zmiany] = actions.saveTableSettings.mock.calls[0];
      expect(zmiany.pinned_cards).toHaveLength(2);
      expect(zmiany.pinned_cards[0]).toMatchObject({ label: "Moja ocena" });
      expect(zmiany.pinned_cards[1]).toEqual(bezPierwszej[1]);

      // Edytowana karta znika przy otwartym oknie: „Zapisz” niczego nie dodaje
      actions.saveTableSettings.mockClear();
      await user.click(screen.getAllByRole("button", { name: "Menu karty" })[1]);
      await user.click(screen.getByRole("menuitem", { name: "Edytuj kartę" }));
      const tylkoPierwsza = JSON.parse(JSON.stringify(ustawienia.pinned_cards.slice(0, 1)));
      rerender(
        <PageTable block={{ ...b, content: { ...b.content, settings: { ...ustawienia, pinned_cards: tylkoPierwsza } } }} today={TODAY} />,
      );
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Zapisz" }));
      expect(actions.saveTableSettings).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Tej karty już nie ma.");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
  describe("moduł Hasła", () => {
    // Szyfrogramy w poprawnym kształcie; „tekst jawny” zwraca atrapa decrypt
    const IV = btoa("iv-dwanascie");
    const A = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-A-szesnascie") };
    const NOTATKA = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-N-szesnascie") };
    const NOWY = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-nowy-szesnascie") };
    const JAWNE: Record<string, string> = { [A.ct]: "jawne-haslo-A", [NOTATKA.ct]: "jawna-notatka", [NOWY.ct]: "nowe-tajne" };

    function stanSejfu(status: string) {
      vault.state = {
        status,
        decrypt: vi.fn(async (v: { ct: string }) => JAWNE[v.ct] ?? null),
        encrypt: vi.fn(async () => NOWY),
        onStaleGeneration: vi.fn(),
      };
    }

    // Stałe kolumny modułu: Serwis, Login, Hasło, URL, Kategoria, Notatka
    function blokHasel(): LoadedBlock {
      const pola = [
        { id: "f-serwis", name: "Serwis", type: "text" as const, config: { empty_label: "Bez nazwy" }, isTitle: true },
        { id: "f-login", name: "Login", type: "text" as const, config: {}, isTitle: false },
        { id: "f-haslo", name: "Hasło", type: "secret" as const, config: {}, isTitle: false },
        { id: "f-url", name: "URL", type: "url" as const, config: {}, isTitle: false },
        { id: "f-kat", name: "Kategoria", type: "select" as const, config: { options: [{ id: "k1", label: "Praca", color: "" }] }, isTitle: false },
        { id: "f-notatka", name: "Notatka", type: "secret" as const, config: {}, isTitle: false },
      ].map((f, i) => ({ ...f, position: i }));
      return {
        id: "blok-hasla",
        type: "table",
        position: 0,
        content: { name: "Hasła", settings: { sort: [], filters: [], hidden_field_ids: [], column_summaries: {}, pinned_cards: [], column_widths: {} } },
        fields: pola,
        rows: [
          {
            id: "row-1",
            values: { "f-serwis": "GitHub", "f-login": "mejson", "f-haslo": A, "f-url": "github.com", "f-kat": "k1", "f-notatka": NOTATKA },
            position: 0,
            deletedAt: null,
          },
        ],
      };
    }

    beforeEach(() => {
      vi.stubGlobal("CSS", { supports: () => true });
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("odblokowany: kolumna „Akcje”, plakietki „szyfr.”, bez „+” dodającego kolumnę", () => {
      stanSejfu("odblokowany");
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      expect(screen.getByRole("columnheader", { name: "Akcje" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Dodaj kolumnę" })).not.toBeInTheDocument();
      expect(screen.getAllByText("szyfr.")).toHaveLength(2);
      const w = wiersz("GitHub");
      // Oczko i kopiowanie w komórkach sekretów (S2Passwords), w ostatniej kolumnie sam kosz
      const komorkaHasla = within(w).getByRole("button", { name: "Hasło: zaszyfrowane" }).closest("td")!;
      expect(within(komorkaHasla).getByRole("button", { name: "Pokaż hasło" })).toBeInTheDocument();
      expect(within(komorkaHasla).getByRole("button", { name: "Kopiuj hasło" })).toBeInTheDocument();
      const komorkaNotatki = within(w).getByRole("button", { name: "Notatka: zaszyfrowane" }).closest("td")!;
      expect(within(komorkaNotatki).getByRole("button", { name: "Pokaż: Notatka" })).toBeInTheDocument();
      expect(within(komorkaNotatki).getByRole("button", { name: "Kopiuj: Notatka" })).toBeInTheDocument();
      const ostatnia = w.querySelectorAll("td")[w.querySelectorAll("td").length - 1];
      expect(within(ostatnia).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Usuń wiersz"]);
      // Szerokość jak w zwykłej tabeli: suma kolumn + 56 px
      const tabela = screen.getByRole("table");
      const suma = Array.from(tabela.querySelectorAll("col")).reduce((a, c) => a + (parseInt(c.style.width) || 0), 0);
      expect(tabela.style.width).toBe(`${suma + 56}px`);
      expect(screen.getByRole("button", { name: "Nowy" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Dodaj kartę" })).toBeInTheDocument();
    });

    it("moduleRowFilter zawęża wiersze także przy zamkniętym sejfie i zgłasza liczbę wierszy; w zwykłej tabeli jest ignorowany", () => {
      stanSejfu("zablokowany");
      const liczba = vi.fn();
      const { unmount } = render(
        <PageTable
          block={blokHasel()}
          today={TODAY}
          module="passwords"
          onLiveRowCount={liczba}
          moduleRowFilter={(r) => r.values["f-serwis"] === "Nie ma takiego"}
        />,
      );
      expect(screen.queryByDisplayValue("GitHub")).not.toBeInTheDocument();
      expect(liczba).toHaveBeenCalledWith(1);
      unmount();
      render(<PageTable block={blokHasel()} today={TODAY} moduleRowFilter={() => false} />);
      expect(screen.getByDisplayValue("GitHub")).toBeInTheDocument();
    });

    it("menu kolumny modułu jest zablokowane: bez „Usuń pole”, z „Ukryj kolumnę”", async () => {
      stanSejfu("odblokowany");
      const user = userEvent.setup();
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      const menu = await otworzMenu(user, "Login");
      expect(within(menu).queryByRole("menuitem", { name: /Usuń pole/ })).not.toBeInTheDocument();
      expect(within(menu).queryByRole("menuitem", { name: /Przesuń/ })).not.toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: /Ukryj kolumnę/ })).toBeInTheDocument();
    });

    it("zapis sekretu: encrypt i updateRow z SecretValue, nigdy z tekstem jawnym", async () => {
      stanSejfu("odblokowany");
      const user = userEvent.setup();
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await user.click(within(wiersz("GitHub")).getByRole("button", { name: "Hasło: zaszyfrowane" }));
      const pole = await screen.findByRole("textbox", { name: "Hasło" });
      await user.clear(pole);
      await user.type(pole, "nowe-tajne{Enter}");
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-1", { "f-haslo": NOWY }));
      expect(vault.state.encrypt).toHaveBeenCalledWith("nowe-tajne");
      expect(JSON.stringify(actions.updateRow.mock.calls)).not.toContain("nowe-tajne");
      expect(JSON.stringify(actions.updateRow.mock.calls)).not.toContain("jawne-haslo-A");
    });

    it("pusty sekret zapisuje null", async () => {
      stanSejfu("odblokowany");
      const user = userEvent.setup();
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await user.click(within(wiersz("GitHub")).getByRole("button", { name: "Hasło: zaszyfrowane" }));
      await user.clear(await screen.findByRole("textbox", { name: "Hasło" }));
      await user.keyboard("{Enter}");
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-1", { "f-haslo": null }));
      expect(vault.state.encrypt).not.toHaveBeenCalled();
    });

    it("Review Focus 2: stale_generation woła vault.onStaleGeneration i cofa komórkę", async () => {
      stanSejfu("odblokowany");
      actions.updateRow.mockResolvedValue({ ok: false, code: "stale_generation" });
      const user = userEvent.setup();
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await user.click(within(wiersz("GitHub")).getByRole("button", { name: "Hasło: zaszyfrowane" }));
      const pole = await screen.findByRole("textbox", { name: "Hasło" });
      await user.clear(pole);
      await user.type(pole, "nowe-tajne{Enter}");
      await waitFor(() => expect(vault.state.onStaleGeneration).toHaveBeenCalled());
      expect(toast.error).toHaveBeenCalledWith("Sejf zmienił się w innej karcie. Odblokuj go ponownie.");
      // Komórka wróciła do starego szyfrogramu: oczko pokazuje stare hasło
      await user.click(within(wiersz("GitHub")).getByRole("button", { name: "Pokaż hasło" }));
      expect(await screen.findByText("jawne-haslo-A")).toBeInTheDocument();
      expect(screen.queryByText("nowe-tajne")).not.toBeInTheDocument();
    });

    it("oczko pokazuje i chowa odszyfrowane sekrety wiersza", async () => {
      stanSejfu("odblokowany");
      const user = userEvent.setup();
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      expect(document.body.innerHTML).not.toContain("jawne-haslo-A");
      const oczko = within(wiersz("GitHub")).getByRole("button", { name: "Pokaż hasło" });
      await user.click(oczko);
      expect(await screen.findByText("jawne-haslo-A")).toBeInTheDocument();
      expect(screen.getByText("jawna-notatka")).toBeInTheDocument();
      await user.click(within(wiersz("GitHub")).getByRole("button", { name: "Ukryj hasło" }));
      expect(screen.queryByText("jawne-haslo-A")).not.toBeInTheDocument();
    });

    // Schowek z atrapą zapisu i fokusem okna
    function schowek(focus = true) {
      const writeText = vi.fn<(t: string) => Promise<void>>(async () => {});
      vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
      vi.spyOn(document, "hasFocus").mockReturnValue(focus);
      return writeText;
    }

    it("kopiowanie: schowek z hasłem, toast i czyszczenie po 30 s", async () => {
      stanSejfu("odblokowany");
      const writeText = schowek();
      vi.useFakeTimers();
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await act(async () => {
        fireEvent.click(within(wiersz("GitHub")).getByRole("button", { name: "Kopiuj hasło" }));
      });
      expect(writeText).toHaveBeenCalledWith("jawne-haslo-A");
      expect(toast).toHaveBeenCalledWith("Skopiowano hasło GitHub", { description: "Schowek wyczyści się za 30 s." });
      expect(JSON.stringify(toast.mock.calls)).not.toContain("jawne-haslo-A");
      act(() => vi.advanceTimersByTime(29_000));
      expect(writeText).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(1_000));
      expect(writeText).toHaveBeenLastCalledWith("");
    });

    it("„Kopiuj: Notatka” kopiuje wartość tej komórki", async () => {
      stanSejfu("odblokowany");
      const writeText = schowek();
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await act(async () => {
        fireEvent.click(within(wiersz("GitHub")).getByRole("button", { name: "Kopiuj: Notatka" }));
      });
      expect(writeText).toHaveBeenCalledWith("jawna-notatka");
      expect(toast).toHaveBeenCalledWith("Skopiowano: Notatka", { description: "Schowek wyczyści się za 30 s." });
    });

    it("blokada w trakcie odszyfrowania: nic nie trafia do schowka", async () => {
      stanSejfu("odblokowany");
      const writeText = schowek();
      let rozwiaz!: (t: string) => void;
      vault.state.decrypt = vi.fn(() => new Promise<string>((r) => (rozwiaz = r)));
      const { rerender } = render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      fireEvent.click(within(wiersz("GitHub")).getByRole("button", { name: "Kopiuj hasło" }));
      stanSejfu("zablokowany");
      rerender(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await act(async () => rozwiaz("jawne-haslo-A"));
      expect(writeText).not.toHaveBeenCalled();
      expect(toast).not.toHaveBeenCalled();
    });

    it("blokada w trakcie zapisu do schowka czyści go od razu, bez toastu", async () => {
      stanSejfu("odblokowany");
      let zapisano!: () => void;
      const writeText = vi.fn((t: string) => (t === "" ? Promise.resolve() : new Promise<void>((r) => (zapisano = r))));
      vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
      vi.spyOn(document, "hasFocus").mockReturnValue(true);
      const { rerender } = render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await act(async () => {
        fireEvent.click(within(wiersz("GitHub")).getByRole("button", { name: "Kopiuj hasło" }));
      });
      expect(writeText).toHaveBeenCalledWith("jawne-haslo-A");
      stanSejfu("zablokowany");
      rerender(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await act(async () => zapisano());
      expect(writeText).toHaveBeenLastCalledWith("");
      expect(toast).not.toHaveBeenCalled();
    });

    it("blokada przed upływem 30 s czyści schowek od razu", async () => {
      stanSejfu("odblokowany");
      const writeText = schowek();
      const { rerender } = render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await act(async () => {
        fireEvent.click(within(wiersz("GitHub")).getByRole("button", { name: "Kopiuj hasło" }));
      });
      expect(writeText).toHaveBeenCalledTimes(1);
      stanSejfu("zablokowany");
      rerender(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      expect(writeText).toHaveBeenLastCalledWith("");
    });

    it("odmontowanie tabeli czyści schowek od razu", async () => {
      stanSejfu("odblokowany");
      const writeText = schowek();
      const { unmount } = render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await act(async () => {
        fireEvent.click(within(wiersz("GitHub")).getByRole("button", { name: "Kopiuj hasło" }));
      });
      unmount();
      expect(writeText).toHaveBeenLastCalledWith("");
    });

    it("bez fokusu okna czyszczenie czeka na powrót do karty", async () => {
      stanSejfu("odblokowany");
      const writeText = schowek(false);
      vi.useFakeTimers();
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await act(async () => {
        fireEvent.click(within(wiersz("GitHub")).getByRole("button", { name: "Kopiuj hasło" }));
      });
      act(() => vi.advanceTimersByTime(30_000));
      expect(writeText).toHaveBeenCalledTimes(1);
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });
      expect(writeText).toHaveBeenLastCalledWith("");
    });

    it("moduł: bez nazwy tabeli (pasek i menu „⋯”), `moduleTools` w miejscu nazwy z funkcjami magazynu", async () => {
      stanSejfu("odblokowany");
      const user = userEvent.setup();
      render(
        <PageTable
          block={blokHasel()}
          today={TODAY}
          module="passwords"
          moduleTools={({ readOnly }) => <span>Narzędzia modułu {readOnly ? "tylko do odczytu" : "edycja"}</span>}
        />,
      );
      expect(screen.queryByRole("textbox", { name: "Nazwa tabeli" })).not.toBeInTheDocument();
      expect(screen.getByText("Narzędzia modułu edycja")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Menu tabeli" }));
      expect(screen.getByText("Sortowanie")).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Nazwa tabeli" })).not.toBeInTheDocument();
    });

    it("zamknięty sejf: `moduleTools` dostaje readOnly, a opcje Kategorii w menu kolumny są tylko do odczytu", async () => {
      stanSejfu("zablokowany");
      const user = userEvent.setup();
      render(
        <PageTable
          block={blokHasel()}
          today={TODAY}
          module="passwords"
          moduleTools={({ readOnly }) => <span>{readOnly ? "tylko do odczytu" : "edycja"}</span>}
        />,
      );
      expect(screen.getByText("tylko do odczytu")).toBeInTheDocument();
      const menu = await otworzMenu(user, "Kategoria");
      expect(within(menu).queryByRole("textbox", { name: "Nowa opcja" })).not.toBeInTheDocument();
      expect(within(menu).queryByRole("button", { name: /Usuń opcję/ })).not.toBeInTheDocument();
      expect(actions.updateBlockContent).not.toHaveBeenCalled();
    });

    it("telefon: blokada zamyka arkusz, a po odblokowaniu nie wraca sam", async () => {
      stanSejfu("odblokowany");
      telefon();
      const user = userEvent.setup();
      const { rerender } = render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await user.click(within(wiersz("GitHub")).getByRole("textbox", { name: "Login" }));
      expect(screen.getByRole("dialog", { name: "GitHub" })).toBeInTheDocument();
      stanSejfu("zablokowany");
      rerender(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      stanSejfu("odblokowany");
      rerender(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("zamknięty sejf: tylko do odczytu, bez „Nowy”, kosza i kopiowania; sekrety „zablokowane”", () => {
      stanSejfu("zablokowany");
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      expect(screen.queryByRole("button", { name: "Nowy" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Usuń wiersz" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Kopiuj hasło" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Pokaż hasło" })).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Serwis" })).not.toBeInTheDocument();
      expect(screen.getByText("GitHub")).toBeInTheDocument();
      expect(screen.getAllByText("zablokowane")).toHaveLength(2);
      // Karty i sort zostają
      expect(screen.getByRole("button", { name: "Dodaj kartę" })).toBeInTheDocument();
    });

    it("zamknięty sejf na telefonie: dotknięcie wiersza nie otwiera arkusza", async () => {
      stanSejfu("zablokowany");
      telefon();
      const user = userEvent.setup();
      render(<PageTable block={blokHasel()} today={TODAY} module="passwords" />);
      await user.click(screen.getByText("GitHub"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // Subscriptions (S2Main.dc.html): dane z test-page (Disney+ nieaktywny), dziś 15.11.2026
  describe("Subscriptions", () => {
    function stopka() {
      return screen.getAllByRole("row").at(-1) as HTMLElement;
    }

    it("stopka: „Σ 63,83 zł / mies.” pomija nieaktywny wiersz, pogrubiona, ciemna i do prawej", () => {
      render(<PageTable block={blok("subscriptions", SUBSKRYPCJE)} today={TODAY} />);
      const suma = within(stopka()).getByText("Σ 63,83 zł / mies.");
      expect(suma).toHaveClass("font-semibold", "text-foreground", "text-right");
      expect(suma).not.toHaveClass("text-muted-foreground");
      expect(within(stopka()).getByText("2 w kalendarzu")).toHaveClass("text-muted-foreground");
    });

    it("nagłówek Kwoty cyklicznej wyrównany do prawej", () => {
      render(<PageTable block={blok("subscriptions", SUBSKRYPCJE)} today={TODAY} />);
      expect(naglowek("Kwota cykliczna")).toHaveClass("text-right");
      expect(naglowek("Data odnowienia")).toHaveClass("text-left");
    });

    it("sort „Odnowienie” idzie po następnym odnowieniu (od dziś), nie po kotwicy", () => {
      render(<PageTable block={blok("subscriptions", SUBSKRYPCJE)} today={TODAY} />);
      // Netflix 21.11, Disney+ 24.11, Strava 03.12.2026 (kotwica Stravy 03.12.2025 jest najwcześniejsza)
      expect(tytuly()).toEqual(["Netflix", "Disney+", "Strava"]);
      expect(screen.getByText("Sort: Data odnowienia")).toBeInTheDocument();
    });

    it("wiersz z odznaczoną „Aktywna” ma przezroczystość .55 i „anulowana”", () => {
      render(<PageTable block={blok("subscriptions", SUBSKRYPCJE)} today={TODAY} />);
      const disney = wiersz("Disney+");
      expect(disney).toHaveStyle({ opacity: "0.55" });
      expect(within(disney).getByText("anulowana")).toBeInTheDocument();
      expect(wiersz("Netflix").style.opacity).toBe("");
      expect(within(wiersz("Netflix")).getByText("za 6 dni")).toHaveClass("bg-warning-soft");
    });

    it("odznaczenie „Aktywna” i zmiana cyklu przeliczają stopkę i karty", async () => {
      const user = userEvent.setup();
      render(<PageTable block={blok("subscriptions", SUBSKRYPCJE)} today={TODAY} />);
      expect(screen.getByText("63,83")).toBeInTheDocument();
      await user.click(within(wiersz("Netflix")).getByRole("checkbox", { name: "Aktywna" }));
      // Został sam Strava: 249,99 / 12
      expect(within(stopka()).getByText("Σ 20,83 zł / mies.")).toBeInTheDocument();
      expect(wiersz("Netflix")).toHaveStyle({ opacity: "0.55" });
      await user.click(within(wiersz("Strava")).getByRole("button", { name: "Cykl: rok (kliknij, aby zmienić)" }));
      expect(within(stopka()).getByText("Σ 249,99 zł / mies.")).toBeInTheDocument();
      expect(within(wiersz("Strava")).getByRole("button", { name: "Cykl: mies. (kliknij, aby zmienić)" })).toBeInTheDocument();
    });

    it("karty: Σ 63,83 zł, Σ 765,99 zł i link najbliższego odnowienia do tygodnia w kalendarzu", () => {
      render(<PageTable block={blok("subscriptions", SUBSKRYPCJE)} today={TODAY} />);
      const karty = screen.getAllByTestId("karta");
      expect(karty[0]).toHaveTextContent("63,83 zł");
      expect(karty[1]).toHaveTextContent("765,99 zł");
      expect(within(karty[2]).getByRole("link", { name: "Netflix" })).toHaveAttribute(
        "href",
        "/kalendarz?widok=tydzien&data=2026-11-21",
      );
    });
  });
});

