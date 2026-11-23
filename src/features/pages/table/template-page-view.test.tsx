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
  reorderPages: vi.fn(),
  renamePage: vi.fn(),
  setPageIcon: vi.fn(),
  setFavorite: vi.fn(),
  duplicatePage: vi.fn(),
  deletePage: vi.fn(),
  restorePage: vi.fn(),
  countPageRows: vi.fn(),
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

// Stan sejfu sterowany z testu (provider ma własne testy)
const vault = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  setup: vi.fn(),
  unlock: vi.fn(),
  lock: vi.fn(),
  reset: vi.fn(),
  countSecrets: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  onStaleGeneration: vi.fn(),
}));
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => vault.state }));
vi.mock("@/features/vault/actions", () => ({ countSecrets: vault.countSecrets }));

import type { LoadedPage } from "../load-page";
import type { PageSummary } from "../load-pages";
import type { FieldConfig } from "../fields";
import { buildTemplateBlocks, type TemplateKey } from "../templates";
import { TemplatePageView } from "./template-page-view";

const TODAY = "2026-11-15";
// Tekst jawny widziany tylko po odszyfrowaniu; NOWY_SEKRET to to, co zwraca atrapa encrypt
const JAWNE = "jawne-haslo-z-sejfu";
const NOWY_SEKRET = { v: 1, g: 1, iv: btoa("iv-nowy-12bB"), ct: btoa("nowy-szyfrogram-szesnascie") };

// Strona z szablonu z wierszami podanymi po nazwach pól i etykietach opcji (dane z makiet)
function strona(key: TemplateKey, title: string, wiersze: Record<string, unknown>[]): LoadedPage {
  let n = 0;
  // „Pusta strona” nie ma już tabeli: w testach jej odpowiednik to tabela z samym polem „Nazwa”
  const b =
    key === "empty"
      ? {
          content: { name: "", settings: { sort: [], filters: [], hidden_field_ids: [], column_summaries: {}, pinned_cards: [], column_widths: {} } },
          fields: [{ id: "00000000-0000-4000-8000-000000000001", name: "Nazwa", type: "text" as const, config: { empty_label: "Bez tytułu" } as FieldConfig, is_title: true }],
        }
      : buildTemplateBlocks(key, () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`).find((x) => x.type === "table")!;
  const fields = b.fields.map((f, i) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    config: f.config,
    position: i,
    isTitle: f.is_title,
  }));
  const rows = wiersze.map((w, i) => {
    const values: Record<string, unknown> = {};
    for (const [nazwa, v] of Object.entries(w)) {
      const pole = fields.find((f) => f.name === nazwa);
      if (!pole) throw new Error(`Brak pola ${nazwa}`);
      const opcja = pole.config.options?.find((o) => o.label === v);
      values[pole.id] = opcja ? opcja.id : v;
    }
    return { id: `row-${i + 1}`, values, position: i, deletedAt: null };
  });
  return {
    page: {
      id: "p1",
      title,
      icon: "▦",
      favorite: false,
      templateKey: key,
      position: 0,
      rowCount: rows.length,
      createdAt: "2026-11-01T10:00:00Z",
    },
    blocks: [{ id: "blok-1", type: "table", position: 0, content: b.content, fields, rows }],
    today: TODAY,
    currency: "PLN",
  };
}

// Books.dc.html (BASE)
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

// Projects.dc.html (BASE)
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

// Websites.dc.html (BASE)
const WEBSITES = [
  { Nazwa: "Fanaberia", URL: "fanaberia.photo", Klient: "Fanaberia", Status: "Na żywo", Hosting: "Framer" },
  { Nazwa: "rhytm", URL: "rhytm-delta.vercel.app", Klient: "ja", Status: "Na żywo", Hosting: "Vercel" },
];

// Wiersz tabeli zawierający tekst
function wiersz(tekst: string) {
  const tr = screen.getAllByRole("row").find((r) => r.textContent?.includes(tekst));
  if (!tr) throw new Error(`Brak wiersza ${tekst}`);
  return tr;
}

// Karty: etykieta → tekst karty
function karta(etykieta: string) {
  const el = screen.getByText(etykieta, { selector: "div" });
  return el.parentElement as HTMLElement;
}

// Wiersz w trybie edycji (tło #f7fbf8)
function edycja() {
  const tr = document.querySelector('tr[class*="bg-success-soft"]');
  if (!tr) throw new Error("Brak wiersza w edycji");
  return tr as HTMLElement;
}

// Id opcji pola po etykietach
function opcja(dane: LoadedPage, pole: string, etykieta: string) {
  const f = dane.blocks[0].fields.find((x) => x.name === pole)!;
  return { fieldId: f.id, optionId: f.config.options!.find((o) => o.label === etykieta)!.id };
}

describe("TemplatePageView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vault.state = {
      status: "brak",
      generation: null,
      createdAt: null,
      remainingMs: 0,
      setup: vault.setup,
      unlock: vault.unlock,
      lock: vault.lock,
      reset: vault.reset,
      encrypt: vault.encrypt,
      decrypt: vault.decrypt,
      onStaleGeneration: vault.onStaleGeneration,
    };
    // Atrapa kryptografii: szyfrogram z innej wartości niż tekst jawny, odszyfrowanie zwraca „jawne”
    vault.encrypt.mockImplementation(async () => NOWY_SEKRET);
    vault.decrypt.mockResolvedValue(JAWNE);
    vault.countSecrets.mockResolvedValue({ ok: true, count: 4 });
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
    actions.addRow.mockImplementation(async (_b: string, values: Record<string, unknown>) => ({
      ok: true,
      row: { id: "srv-1", values, position: 99, deletedAt: null },
    }));
  });
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  describe("nagłówek i metadane", () => {
    it("Books: ścieżka, przyciski i metadane z liczbą wierszy i sortem", () => {
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      expect(screen.getByText("Strony", { exact: false }).textContent).toContain("Strony / Books");
      expect(screen.getByRole("button", { name: "Filtruj" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "+ Pole" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Nowy wiersz" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "Books" })).toBeInTheDocument();
      expect(
        screen.getByText("11 wierszy · 5 pól · szablon „Book tracker” · sort: status, przeczytana"),
      ).toBeInTheDocument();
    });

    it("ikona strony stoi przy tytule h1 (aria-hidden), nazwa h1 bez zmian", () => {
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      const h1 = screen.getByRole("heading", { level: 1, name: "Books" });
      const ikona = h1.querySelector("[data-page-icon]");
      expect(ikona).not.toBeNull();
      expect(ikona).toHaveAttribute("aria-hidden", "true");
      expect(ikona?.parentElement).toBe(h1);
    });

    it("Websites: bez części „sort”; liczba wierszy w odmianie", () => {
      render(<TemplatePageView data={strona("websites", "Websites", WEBSITES)} />);
      expect(screen.getByText("2 wiersze · 5 pól · szablon „Websites”")).toBeInTheDocument();
    });

    it("Projects: szablon „Projects” i sort po terminie", () => {
      render(<TemplatePageView data={strona("projects", "Projects", PROJECTS)} />);
      expect(screen.getByText("8 wierszy · 5 pól · szablon „Projects” · sort: termin")).toBeInTheDocument();
    });

    it("Pusta strona: jedno pole, bez kart", () => {
      render(<TemplatePageView data={strona("empty", "Notatki", [{ Nazwa: "A" }])} />);
      expect(screen.getByText("1 wiersz · 1 pole · szablon „Pusta strona”")).toBeInTheDocument();
      expect(screen.queryByText("Czytam teraz")).not.toBeInTheDocument();
    });
  });

  describe("wygląd COSS", () => {
    it("tabela jak .tbl: nagłówek 40 px, wiersz 44 px, ostatni wiersz bez dolnej linii", () => {
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      const th = screen.getByRole("columnheader", { name: /Tytuł/ });
      expect(th).toHaveClass("h-10");
      const deep = wiersz("Deep Work");
      expect(deep).toHaveClass("group/wiersz");
      expect(within(deep).getByText("Deep Work").closest("td")).toHaveClass(
        "h-11",
        "group-last/wiersz:border-b-0",
      );
    });

    it("strona na pełną szerokość, bez limitu 1100 px", () => {
      const { container } = render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      expect(container.innerHTML).not.toContain("max-w-[1100px]");
    });

    it("karty to .card z etykietą .lbl i liczbą tabular-nums", () => {
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      expect(karta("Średnia ocena")).toHaveClass("rounded-xl", "shadow-card");
      expect(screen.getByText("Średnia ocena", { selector: "div" })).toHaveClass("text-xs", "font-medium");
    });

    it("długa wartość komórki ma truncate, a tabela przewija się poziomo", () => {
      const dlugi = "Bardzo długi tytuł książki ".repeat(10).trim();
      render(<TemplatePageView data={strona("books", "Books", [{ Tytuł: dlugi, Autor: "A" }])} />);
      const tekst = screen.getByText(dlugi);
      // Limit szerokości na elemencie wewnętrznym (max-w na td jest ignorowane przy table-layout:auto)
      expect(tekst).toHaveClass("truncate", "max-w-[280px]");
      expect(tekst.closest("td")?.className).not.toContain("max-w-");
      expect(tekst.closest("table")?.parentElement).toHaveClass("overflow-x-auto");
    });

    it("strona-szablon bez wierszy i kart pokazuje stan pusty bez pustych ramek", () => {
      const { container } = render(<TemplatePageView data={strona("empty", "Notatki", [])} />);
      // Bez kart nie ma pustej ramki karty, a strona z szablonu nie ma okna karty, więc i przycisku „Dodaj kartę”
      expect(container.querySelector('[data-testid="karta"]')).toBeNull();
      expect(screen.queryByRole("button", { name: "Dodaj kartę" })).not.toBeInTheDocument();
      // Tabela ma nagłówek i stopkę z „+ Nowy wiersz”, a w tbody nie ma pustych wierszy
      expect(screen.getByRole("columnheader", { name: /Nazwa/ })).toBeInTheDocument();
      expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
      expect(screen.getByRole("button", { name: "+ Nowy wiersz" })).toBeInTheDocument();
    });
  });

  describe("karty", () => {
    it("Books: przeczytane w roku, czytam teraz, średnia ocena", () => {
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      expect(karta("Przeczytane w 2026").textContent).toContain("6 książek");
      expect(karta("Czytam teraz").textContent).toContain("2");
      expect(karta("Średnia ocena").textContent).toContain("4,1 / 5");
    });

    it("Projects: najbliższy termin czerwony przy ≤ 7 dniach i „Zrobione 1 / 8”", () => {
      render(<TemplatePageView data={strona("projects", "Projects", PROJECTS)} />);
      const termin = karta("Najbliższy termin");
      expect(termin.textContent).toContain("Projekt z baz danych — drony");
      expect(within(termin).getByText("za 5 dni")).toHaveClass("text-destructive-foreground");
      expect(karta("Zrobione").textContent).toContain("1 / 8");
      expect(karta("W toku").textContent).toContain("3");
    });

    it("karty liczą wiersze po zapisanym filtrze (settings.filters)", () => {
      const dane = strona("books", "Books", BOOKS);
      const przeczytane = opcja(dane, "Status", "Przeczytane");
      const content = dane.blocks[0].content as { settings: { filters: unknown[] } };
      content.settings.filters = [{ field_id: przeczytane.fieldId, op: "in", value: [przeczytane.optionId] }];
      render(<TemplatePageView data={dane} />);
      expect(karta("Czytam teraz").textContent).toContain("0");
      expect(screen.queryByText("Atomic Habits")).not.toBeInTheDocument();
    });

    it("Projects: termin dalej niż 7 dni jest szary", () => {
      const dane = strona("projects", "Projects", [{ Nazwa: "NetScope", Status: "W toku", Termin: "2026-12-15" }]);
      render(<TemplatePageView data={dane} />);
      expect(within(karta("Najbliższy termin")).getByText("za 30 dni")).toHaveClass("bg-muted");
    });
  });

  describe("podgląd wiersza", () => {
    it("Books: plakietka statusu, gwiazdki i data dd.mm.rrrr", () => {
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      const deep = wiersz("Deep Work");
      expect(within(deep).getByText("Przeczytane")).toBeInTheDocument();
      expect(within(deep).getByLabelText("Ocena 4 na 5").textContent).toBe("★★★★★");
      expect(within(deep).getByText("12.10.2026")).toBeInTheDocument();
      expect(within(wiersz("Atomic Habits")).getByLabelText("Brak oceny").textContent).toBe("—");
      // Szara plakietka ma tekst #404040 jak w makiecie
      expect(within(wiersz("Clean Code")).getByText("Chcę przeczytać")).toHaveStyle({ color: "#404040" });
    });

    it("Books: wiersze w kolejności sortu status, data", () => {
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      const tytuly = screen
        .getAllByRole("row")
        .slice(1, -1)
        .map((r) => r.querySelector("td")?.textContent);
      expect(tytuly.slice(0, 4)).toEqual([
        "Atomic Habits",
        "Hacking: The Art of Exploitation",
        "Psychologia pieniędzy",
        "Deep Work",
      ]);
      expect(tytuly[10]).toBe("Clean Code");
    });

    it("Projects: czas do terminu (za N dni / minął / za N mies.) i pilny na czerwono", () => {
      const dane = strona("projects", "Projects", [
        ...PROJECTS,
        { Nazwa: "Dziś", Status: "W toku", Termin: "2026-11-15" },
        { Nazwa: "Jutro", Status: "W toku", Termin: "2026-11-16" },
      ]);
      render(<TemplatePageView data={dane} />);
      expect(within(wiersz("drony")).getByText("za 5 dni")).toHaveClass("text-destructive-foreground");
      expect(within(wiersz("rhytm v3")).getByText("za 30 dni")).toHaveClass("text-muted-foreground");
      expect(within(wiersz("rhytm v2")).getByText("minął")).toBeInTheDocument();
      expect(within(wiersz("NetScope")).getByText("za 3 mies.")).toBeInTheDocument();
      expect(within(wiersz("Dziś")).getByText("dziś")).toBeInTheDocument();
      expect(within(wiersz("Jutro")).getByText("jutro")).toBeInTheDocument();
    });

    it("klik w wiersz otwiera edycję, a link Repo nie", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("projects", "Projects", PROJECTS)} />);
      await user.click(within(wiersz("rhytm v3")).getByRole("link", { name: "Mejsooon/rhytm-v3" }));
      expect(screen.queryByRole("button", { name: "Zapisz" })).not.toBeInTheDocument();
      await user.click(within(wiersz("rhytm v3")).getByText("Własne"));
      expect(screen.getByRole("button", { name: "Zapisz" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Nazwa" })).toHaveValue("rhytm v3");
    });

    it("„Edytuj” i „Usuń” w ostatniej kolumnie każdego wiersza", () => {
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      const deep = wiersz("Deep Work");
      const ostatnia = deep.querySelectorAll("td")[5];
      expect(within(ostatnia).getByRole("button", { name: "Edytuj wiersz" })).toHaveClass("opacity-0");
      expect(within(ostatnia).getByRole("button", { name: "Usuń wiersz" })).toBeInTheDocument();
    });
  });

  describe("tryb edycji", () => {
    it("tło #f7fbf8, pola tekstowe, status z plakietką i ✓, data; „Zapisz” zapisuje", async () => {
      const user = userEvent.setup();
      const dane = strona("books", "Books", BOOKS);
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Edytuj wiersz" }));
      const edycja = screen.getByRole("textbox", { name: "Tytuł" }).closest("tr") as HTMLElement;
      expect(edycja).toHaveClass("bg-success-soft/50");
      expect(within(edycja).getByRole("textbox", { name: "Autor" })).toHaveValue("Cal Newport");
      expect(within(edycja).getByRole("button", { name: "Przeczytana" }).textContent).toContain("12.10.2026");

      await user.click(within(edycja).getByRole("button", { name: "Status" }));
      const lista = screen.getByRole("listbox", { name: "Status" });
      const wybrana = within(lista).getByRole("option", { selected: true });
      expect(wybrana.textContent).toContain("Przeczytane");
      expect(wybrana.textContent).toContain("✓");
      await user.click(within(lista).getByRole("option", { name: /Czytam/ }));

      await user.clear(within(edycja).getByRole("textbox", { name: "Autor" }));
      await user.type(within(edycja).getByRole("textbox", { name: "Autor" }), "C. Newport");
      await user.click(within(edycja).getByRole("button", { name: "Zapisz" }));

      const pola = dane.blocks[0].fields;
      const status = pola.find((f) => f.name === "Status")!;
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(1));
      const [id, wartosci] = actions.updateRow.mock.calls[0];
      expect(id).toBe("row-4");
      expect(wartosci[pola.find((f) => f.name === "Autor")!.id]).toBe("C. Newport");
      expect(wartosci[status.id]).toBe(status.config.options!.find((o) => o.label === "Czytam")!.id);
      expect(screen.queryByRole("button", { name: "Zapisz" })).not.toBeInTheDocument();
      // Liczniki od razu: Czytam teraz 3
      expect(karta("Czytam teraz").textContent).toContain("3");
    });

    it("„Zapisz” wysyła tylko zmienione komórki — brudna wartość z bazy zostaje", async () => {
      const user = userEvent.setup();
      const dane = strona("books", "Books", BOOKS);
      const ocena = dane.blocks[0].fields.find((f) => f.name === "Ocena")!;
      const autor = dane.blocks[0].fields.find((f) => f.name === "Autor")!;
      // Tekst w polu Ocena (ręczna edycja bazy) — normalizeValue dałby null
      dane.blocks[0].rows[3].values[ocena.id] = "dużo";
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Edytuj wiersz" }));
      await user.type(screen.getByRole("textbox", { name: "Autor" }), "!");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(1));
      expect(actions.updateRow).toHaveBeenCalledWith("row-4", { [autor.id]: "Cal Newport!" });
    });

    it("„Zapisz” bez zmian nie wysyła nic", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Edytuj wiersz" }));
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      expect(screen.queryByRole("button", { name: "Zapisz" })).not.toBeInTheDocument();
      expect(actions.updateRow).not.toHaveBeenCalled();
    });

    it("gwiazdki: klik ustawia, ponowny klik tej samej zeruje", async () => {
      const user = userEvent.setup();
      const dane = strona("books", "Books", BOOKS);
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Edytuj wiersz" }));
      expect(screen.getByRole("button", { name: "Ocena 4 na 5" })).toHaveAttribute("aria-pressed", "true");
      await user.click(screen.getByRole("button", { name: "Ocena 2 na 5" }));
      expect(screen.getByRole("button", { name: "Ocena 3 na 5" })).toHaveAttribute("aria-pressed", "false");
      await user.click(screen.getByRole("button", { name: "Ocena 2 na 5" }));
      expect(screen.getByRole("button", { name: "Ocena 1 na 5" })).toHaveAttribute("aria-pressed", "false");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      const ocena = dane.blocks[0].fields.find((f) => f.name === "Ocena")!;
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalled());
      expect(actions.updateRow.mock.calls[0][1][ocena.id]).toBeNull();
    });

    it("✕ anuluje bez zapisu; tylko jeden wiersz w edycji", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Edytuj wiersz" }));
      // Nietknięty szkic po prostu się zamyka przy przejściu do innego wiersza
      await user.click(within(wiersz("Diuna")).getByRole("button", { name: "Edytuj wiersz" }));
      expect(screen.getAllByRole("button", { name: "Zapisz" })).toHaveLength(1);
      expect(screen.getByRole("textbox", { name: "Tytuł" })).toHaveValue("Diuna");
      await user.type(screen.getByRole("textbox", { name: "Tytuł" }), " 2");
      await user.click(screen.getByRole("button", { name: "Anuluj" }));
      expect(screen.queryByRole("button", { name: "Zapisz" })).not.toBeInTheDocument();
      expect(actions.updateRow).not.toHaveBeenCalled();
      expect(screen.getByText("Diuna")).toBeInTheDocument();
    });

    it("przejście do innego wiersza najpierw zapisuje zmieniony szkic", async () => {
      const user = userEvent.setup();
      const dane = strona("books", "Books", BOOKS);
      const tytul = dane.blocks[0].fields.find((f) => f.isTitle)!;
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Edytuj wiersz" }));
      await user.type(screen.getByRole("textbox", { name: "Tytuł" }), " 2");
      await user.click(within(wiersz("Diuna")).getByRole("button", { name: "Edytuj wiersz" }));
      await waitFor(() => expect(screen.getByRole("textbox", { name: "Tytuł" })).toHaveValue("Diuna"));
      expect(actions.updateRow).toHaveBeenCalledWith("row-4", { [tytul.id]: "Deep Work 2" });
      expect(screen.getByText("Deep Work 2")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Zapisz" })).toHaveLength(1);
    });

    it("klik w inny wiersz też zapisuje szkic przed przełączeniem", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Edytuj wiersz" }));
      await user.type(screen.getByRole("textbox", { name: "Autor" }), "!");
      await user.click(screen.getByText("Diuna"));
      await waitFor(() => expect(screen.getByRole("textbox", { name: "Tytuł" })).toHaveValue("Diuna"));
      expect(actions.updateRow).toHaveBeenCalledTimes(1);
      expect(actions.updateRow.mock.calls[0][0]).toBe("row-4");
    });

    it("błąd zapisu szkicu przy przełączaniu zostawia otwarty szkic z wpisanymi zmianami", async () => {
      actions.updateRow.mockResolvedValue({ ok: false, message: "x" });
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Edytuj wiersz" }));
      await user.type(screen.getByRole("textbox", { name: "Tytuł" }), " 2");
      await user.click(within(wiersz("Diuna")).getByRole("button", { name: "Edytuj wiersz" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      expect(screen.getByRole("textbox", { name: "Tytuł" })).toHaveValue("Deep Work 2");
      expect(screen.getAllByRole("button", { name: "Zapisz" })).toHaveLength(1);
    });

    it("błąd zapisu cofa zmianę i pokazuje toast", async () => {
      actions.updateRow.mockResolvedValue({ ok: false, message: "x" });
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(within(wiersz("Deep Work")).getByRole("button", { name: "Edytuj wiersz" }));
      await user.clear(screen.getByRole("textbox", { name: "Tytuł" }));
      await user.type(screen.getByRole("textbox", { name: "Tytuł" }), "Shallow");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      // Edycja zostaje otwarta z wpisanym tytułem; po „Anuluj” tabela pokazuje starą wartość
      expect(within(edycja()).getByDisplayValue("Shallow")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Anuluj" }));
      expect(screen.getByText("Deep Work")).toBeInTheDocument();
      expect(screen.queryByText("Shallow")).not.toBeInTheDocument();
    });
  });

  describe("nowy wiersz", () => {
    it("Books: wiersz w edycji na końcu; pusty tytuł → „Bez tytułu”, licznik rośnie", async () => {
      const user = userEvent.setup();
      const dane = strona("books", "Books", BOOKS);
      actions.addRow.mockImplementation(async (_b: string, values: Record<string, unknown>) => ({
        ok: true,
        row: { id: "srv-1", values, position: 11, deletedAt: null },
      }));
      render(<TemplatePageView data={dane} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      const wiersze = screen.getAllByRole("row");
      expect(within(wiersze[wiersze.length - 2]).getByRole("textbox", { name: "Tytuł" })).toHaveValue("");
      expect(screen.getByRole("textbox", { name: "Tytuł" })).toHaveAttribute("placeholder", "Tytuł…");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      const tytul = dane.blocks[0].fields.find((f) => f.isTitle)!;
      expect(actions.addRow).toHaveBeenCalledWith("blok-1", expect.objectContaining({ [tytul.id]: "Bez tytułu" }));
      expect(screen.getByText("Bez tytułu")).toBeInTheDocument();
      expect(screen.getByText(/^12 wierszy/)).toBeInTheDocument();
    });

    it("Projects: pusta nazwa → „Bez nazwy”; opcje domyślne Do zrobienia / Własne", async () => {
      const user = userEvent.setup();
      const dane = strona("projects", "Projects", PROJECTS);
      render(<TemplatePageView data={dane} />);
      await user.click(screen.getByRole("button", { name: "+ Nowy wiersz" }));
      expect(within(edycja()).getByRole("button", { name: "Status" }).textContent).toContain("Do zrobienia");
      expect(within(edycja()).getByRole("button", { name: "Obszar" }).textContent).toContain("Własne");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      const tytul = dane.blocks[0].fields.find((f) => f.isTitle)!;
      const status = opcja(dane, "Status", "Do zrobienia");
      const obszar = opcja(dane, "Obszar", "Własne");
      expect(actions.addRow).toHaveBeenCalledWith(
        "blok-1",
        expect.objectContaining({
          [tytul.id]: "Bez nazwy",
          [status.fieldId]: status.optionId,
          [obszar.fieldId]: obszar.optionId,
        }),
      );
    });

    it("Books i Websites: opcje domyślne z makiet", async () => {
      const user = userEvent.setup();
      const { unmount } = render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      expect(within(edycja()).getByRole("button", { name: "Status" }).textContent).toContain("Chcę przeczytać");
      unmount();
      render(<TemplatePageView data={strona("websites", "Websites", WEBSITES)} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      expect(within(edycja()).getByRole("button", { name: "Status" }).textContent).toContain("Wycena");
      expect(within(edycja()).getByRole("button", { name: "Hosting" }).textContent).toContain("Framer");
    });

    it("„Nowy wiersz” przy zmienionym szkicu nowego wiersza najpierw go zapisuje", async () => {
      const user = userEvent.setup();
      const dane = strona("books", "Books", BOOKS);
      const tytul = dane.blocks[0].fields.find((f) => f.isTitle)!;
      render(<TemplatePageView data={dane} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      await user.type(screen.getByRole("textbox", { name: "Tytuł" }), "Solaris");
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      await waitFor(() => expect(screen.getByRole("textbox", { name: "Tytuł" })).toHaveValue(""));
      expect(actions.addRow).toHaveBeenCalledTimes(1);
      expect(actions.addRow).toHaveBeenCalledWith("blok-1", expect.objectContaining({ [tytul.id]: "Solaris" }));
      expect(screen.getByText("Solaris")).toBeInTheDocument();
    });

    it("„Nowy wiersz” przy nietkniętym szkicu nie zapisuje nic", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      await user.click(screen.getByRole("button", { name: "+ Nowy wiersz" }));
      expect(screen.getAllByRole("button", { name: "Zapisz" })).toHaveLength(1);
      expect(actions.addRow).not.toHaveBeenCalled();
    });

    it("✕ usuwa szkic bez zapisu", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      await user.click(screen.getByRole("button", { name: "Anuluj" }));
      expect(screen.queryByRole("textbox", { name: "Tytuł" })).not.toBeInTheDocument();
      expect(actions.addRow).not.toHaveBeenCalled();
    });
  });

  describe("usuwanie", () => {
    it("wiersz znika, liczniki i karty od razu się przeliczają, toast „Usunięto · Cofnij”", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(within(wiersz("Atomic Habits")).getByRole("button", { name: "Usuń wiersz" }));
      expect(screen.queryByText("Atomic Habits")).not.toBeInTheDocument();
      expect(screen.getByText(/^10 wierszy/)).toBeInTheDocument();
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
      expect(screen.getByText(/^11 wierszy/)).toBeInTheDocument();
    });
  });

  describe("„+ Pole”", () => {
    it("grupa „Podstawowe” z 8 typami; nazwa domyślna z typu; Status z opcjami; kolumna na końcu", async () => {
      const user = userEvent.setup();
      actions.addField.mockImplementation(async (_b: string, input: { name: string; type: string; config: object }) => ({
        ok: true,
        field: { id: "pole-nowe", position: 5, isTitle: false, ...input },
      }));
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(screen.getByRole("button", { name: "+ Pole" }));
      // „Anuluj” bez ramki (ghost, .btng z makiet)
      expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
      expect(screen.getByRole("button", { name: "Anuluj" }).className).not.toContain("border-input");
      expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass("max-[799px]:h-11");
      const okno = screen.getByRole("dialog", { name: "Nowe pole" });
      // Okno jak .pop z CAddField: bez paddingu, lista typów po lewej, wybrany typ to biała pigułka
      expect(okno).toHaveClass("p-0", "overflow-hidden", "rounded-lg");
      expect(within(okno).getByRole("textbox", { name: "Szukaj typu" }).parentElement).toHaveClass("h-8", "rounded-md", "shadow-xs");
      expect(within(okno).getByRole("textbox", { name: "Nazwa pola" })).toHaveClass("h-8", "rounded-md", "shadow-xs");
      expect(within(okno).getByRole("button", { name: "Tekst" })).toHaveClass("min-h-8", "justify-between", "bg-white");
      expect(within(okno).getByRole("button", { name: "Liczba" })).toHaveClass("hover:bg-accent");
      expect(within(okno).getByRole("button", { name: "Liczba" })).not.toHaveClass("bg-white");
      expect(within(okno).getByText("Podstawowe")).toHaveClass("text-xs", "font-medium");
      expect(within(okno).getByRole("button", { name: "Dodaj pole" })).toHaveClass("bg-primary", "max-[799px]:h-11");
      expect(within(okno).getByText("Podstawowe")).toBeInTheDocument();
      const typy = ["Tekst", "Liczba", "Checkbox", "URL", "Select", "Status", "Data", "Ocena"];
      for (const t of typy) expect(within(okno).getByRole("button", { name: t })).toBeInTheDocument();
      expect(within(okno).queryByText("Inteligentne")).not.toBeInTheDocument();
      expect(within(okno).getByRole("textbox", { name: "Nazwa pola" })).toHaveValue("Notatka");

      await user.click(within(okno).getByRole("button", { name: "Data" }));
      expect(within(okno).getByRole("textbox", { name: "Nazwa pola" })).toHaveValue("Termin");
      expect(within(okno).getByRole("checkbox", { name: "Pokaż w kalendarzu" })).toBeInTheDocument();
      expect(within(okno).getByText("Tylko gdy zaznaczone")).toBeInTheDocument();
      expect(within(okno).getByRole("button", { name: "Tylko gdy zaznaczone" }).textContent).toContain("— zawsze —");
      await user.click(within(okno).getByRole("button", { name: "Status" }));
      expect(within(okno).getByRole("textbox", { name: "Nazwa pola" })).toHaveValue("Status");
      expect(within(okno).getByText("Do zrobienia")).toBeInTheDocument();
      expect(within(okno).getByText("W toku")).toBeInTheDocument();
      expect(within(okno).getByText("Zrobione")).toBeInTheDocument();
      await user.click(within(okno).getByRole("button", { name: "+ Opcja" }));
      await user.type(within(okno).getByRole("textbox", { name: "Nowa opcja" }), "Wstrzymane{Enter}");
      await user.clear(within(okno).getByRole("textbox", { name: "Nazwa pola" }));
      await user.type(within(okno).getByRole("textbox", { name: "Nazwa pola" }), "Etap");
      await user.click(within(okno).getByRole("button", { name: "Dodaj pole" }));

      expect(actions.addField).toHaveBeenCalledTimes(1);
      const [blok, input] = actions.addField.mock.calls[0];
      expect(blok).toBe("blok-1");
      expect(input.name).toBe("Etap");
      expect(input.type).toBe("status");
      expect(input.config.options.map((o: { label: string }) => o.label)).toEqual([
        "Do zrobienia",
        "W toku",
        "Zrobione",
        "Wstrzymane",
      ]);
      const naglowki = screen.getAllByRole("columnheader").map((h) => h.textContent);
      expect(naglowki[5]).toContain("Etap");
      expect(screen.getByText(/· 6 pól ·/)).toBeInTheDocument();
    });

    it("„Anuluj” zamyka okno bez dodawania", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(screen.getByRole("button", { name: "+ Pole" }));
      await user.click(screen.getByRole("button", { name: "Anuluj" }));
      expect(screen.queryByRole("dialog", { name: "Nowe pole" })).not.toBeInTheDocument();
      expect(actions.addField).not.toHaveBeenCalled();
    });
  });

  describe("telefon", () => {
    // Lista stron z sidebaru: Inbox, ta strona (p1), Projects
    function listaStron(dane: LoadedPage): PageSummary[] {
      const inna = (id: string, title: string, position: number): PageSummary => ({
        id,
        title,
        icon: "▤",
        favorite: false,
        templateKey: null,
        position,
        rowCount: 0,
      });
      return [inna("p0", "Inbox", 0), { ...dane.page, position: 1 }, inna("p2", "Projects", 2)];
    }

    it("nagłówek ma powrót do /strony i menu strony z całą listą (Przenieś wyżej / niżej)", async () => {
      const user = userEvent.setup();
      const dane = strona("books", "Books", BOOKS);
      render(<TemplatePageView data={dane} pages={listaStron(dane)} />);
      expect(screen.getByRole("link", { name: "Strony" })).toHaveAttribute("href", "/strony");
      await user.click(screen.getByRole("button", { name: "Menu strony" }));
      const menu = screen.getByRole("menu", { name: "Strona Books" });
      expect(within(menu).getByRole("button", { name: "Przenieś wyżej" })).toBeEnabled();
      expect(within(menu).getByRole("button", { name: "Przenieś niżej" })).toBeEnabled();
      await user.click(within(menu).getByRole("button", { name: "Przenieś niżej" }));
      expect(actions.reorderPages).toHaveBeenCalledWith(["p0", "p2", "p1"]);
      expect(within(menu).getByRole("menuitem", { name: /Usuń stronę/ })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: /Dodaj do ulubionych/ })).toBeInTheDocument();
    });

    it("„Zmień nazwę” z menu strony otwiera okno i zapisuje nową nazwę", async () => {
      const user = userEvent.setup();
      const dane = strona("books", "Books", BOOKS);
      render(<TemplatePageView data={dane} pages={listaStron(dane)} />);
      await user.click(screen.getByRole("button", { name: "Menu strony" }));
      await user.click(screen.getByRole("menuitem", { name: /Zmień nazwę/ }));
      const okno = await screen.findByRole("dialog", { name: "Zmień nazwę" });
      const pole = within(okno).getByRole("textbox", { name: "Nazwa strony" });
      // „Anuluj” bez ramki (ghost, .btng z makiet)
      expect(within(okno).getByRole("button", { name: "Anuluj" })).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
      expect(pole).toHaveValue("Books");
      await user.clear(pole);
      await user.type(pole, "Książki");
      await user.click(within(okno).getByRole("button", { name: "Zapisz" }));
      expect(actions.renamePage).toHaveBeenCalledWith("p1", "Książki");
      expect(screen.getByRole("heading", { level: 1, name: "Książki" })).toBeInTheDocument();
    });

    function telefon() {
      window.matchMedia = vi
        .fn()
        .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    }

    it("stuknięcie wiersza otwiera arkusz z kontrolkami, „Usuń wiersz”, „Anuluj” / „Zapisz”", async () => {
      telefon();
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(within(wiersz("Deep Work")).getByText("Cal Newport"));
      const arkusz = screen.getByRole("dialog", { name: "Deep Work" });
      expect(within(arkusz).getByRole("textbox", { name: "Autor" })).toHaveValue("Cal Newport");
      expect(within(arkusz).getByRole("button", { name: "Status" })).toBeInTheDocument();
      expect(within(arkusz).getByRole("button", { name: "Przeczytana" })).toBeInTheDocument();
      expect(within(arkusz).getByRole("button", { name: "Ocena 4 na 5" })).toBeInTheDocument();
      expect(within(arkusz).getByRole("button", { name: "Usuń wiersz" })).toBeInTheDocument();
      expect(within(arkusz).getByRole("button", { name: "Anuluj" })).toBeInTheDocument();
      // „Anuluj” bez ramki (ghost, .btng z makiet)
      expect(within(arkusz).getByRole("button", { name: "Anuluj" })).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
      expect(within(arkusz).getByRole("button", { name: "Anuluj" }).className).not.toContain("border-input");
      // Bez edycji w wierszu tabeli
      expect(document.querySelector('tr[class*="bg-success-soft"]')).toBeNull();

      await user.clear(within(arkusz).getByRole("textbox", { name: "Autor" }));
      await user.type(within(arkusz).getByRole("textbox", { name: "Autor" }), "Newport");
      await user.click(within(arkusz).getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-4", expect.anything()));
      expect(screen.queryByRole("dialog", { name: "Deep Work" })).not.toBeInTheDocument();
    });

    it("„Usuń wiersz” w arkuszu usuwa wiersz", async () => {
      telefon();
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(within(wiersz("Diuna")).getByText("Frank Herbert"));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń wiersz" }));
      expect(actions.deleteRow).toHaveBeenCalledWith("row-6");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByText("Diuna")).not.toBeInTheDocument();
    });

    it("„Nowy wiersz” otwiera arkusz bez „Usuń wiersz”", async () => {
      telefon();
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      const arkusz = screen.getByRole("dialog", { name: "Nowy wiersz" });
      expect(within(arkusz).queryByRole("button", { name: "Usuń wiersz" })).not.toBeInTheDocument();
      await user.click(within(arkusz).getByRole("button", { name: "Anuluj" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(actions.addRow).not.toHaveBeenCalled();
    });
  });

  describe("stopka", () => {
    it("Books: „+ Nowy wiersz” i podsumowania z makiety", () => {
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
      expect(within(stopka).getByRole("button", { name: "+ Nowy wiersz" })).toBeInTheDocument();
      expect(within(stopka).getByText("7 przeczytanych")).toBeInTheDocument();
      expect(within(stopka).getByText("śr. 4,1")).toBeInTheDocument();
      expect(within(stopka).getByText("6 w tym roku")).toBeInTheDocument();
    });

    it("Projects: w toku, terminy, linki", () => {
      render(<TemplatePageView data={strona("projects", "Projects", PROJECTS)} />);
      const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
      expect(within(stopka).getByText("3 w toku")).toBeInTheDocument();
      expect(within(stopka).getByText("5 terminów")).toBeInTheDocument();
      expect(within(stopka).getByText("6 linków")).toBeInTheDocument();
    });

    it("Websites: linki i na żywo", () => {
      render(<TemplatePageView data={strona("websites", "Websites", WEBSITES)} />);
      const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
      expect(within(stopka).getByText("2 linki")).toBeInTheDocument();
      expect(within(stopka).getByText("2 na żywo")).toBeInTheDocument();
    });
  });

  // Passwords (CVaultSetup / CVault / CPasswords.dc.html)
  describe("sejf (pole Sekret)", () => {
    // Rozpoznawalny szyfrogram: nie może trafić do tekstu strony
    const SEKRET = { v: 1, g: 1, iv: btoa("iv-dwanascie"), ct: btoa("szyfrogram-szesnascie") };
    const HASLA = [
      { Serwis: "GitHub", Login: "mejsooon", Hasło: SEKRET, URL: "github.com" },
      { Serwis: "Supabase", Login: "mejson@…", Hasło: SEKRET, URL: "supabase.com" },
    ];

    it("brak sejfu: widok ustawiania zamiast tabeli; Utwórz sejf nieaktywne do spełnienia 3 warunków", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      expect(screen.getByRole("heading", { name: "Ustaw hasło główne sejfu" })).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      const utworz = screen.getByRole("button", { name: "Utwórz sejf" });
      expect(utworz).toBeDisabled();

      await user.type(screen.getByLabelText("Hasło główne"), "Dobre-haslo-glowne-1");
      await user.type(screen.getByLabelText("Powtórz"), "Dobre-haslo-glowne-1");
      // brak zgody
      expect(utworz).toBeDisabled();
      await user.click(screen.getByRole("checkbox"));
      expect(utworz).toBeEnabled();
    });

    it("Hasła się różnią. pod Powtórz", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.type(screen.getByLabelText("Hasło główne"), "Dobre-haslo-glowne-1");
      await user.type(screen.getByLabelText("Powtórz"), "Dobre-haslo");
      expect(screen.getByText("Hasła się różnią.")).toBeInTheDocument();
      await user.click(screen.getByRole("checkbox"));
      expect(screen.getByRole("button", { name: "Utwórz sejf" })).toBeDisabled();
    });

    it("Anuluj: tabela z — nieustawiony sejf", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(screen.getByRole("button", { name: "Anuluj" }));
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getAllByText("— nieustawiony sejf")).toHaveLength(2);
      expect(screen.queryByRole("heading", { name: "Ustaw hasło główne sejfu" })).not.toBeInTheDocument();
    });

    it("zablokowany: kolumna Sekret pokazuje zablokowane, karta Odblokuj", () => {
      vault.state = { ...vault.state, status: "zablokowany", generation: 1 };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      expect(screen.getAllByText("zablokowane")).toHaveLength(2);
      expect(screen.getByText("Sejf zablokowany")).toBeInTheDocument();
      expect(screen.getByText("serwer widzi tylko szyfrogram")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Odblokuj sejf" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Odblokuj" })).toBeInTheDocument();
      // tabela i karta pod nią
      const tabela = screen.getByRole("table");
      const karta = screen.getByRole("heading", { name: "Odblokuj sejf" });
      expect(tabela.compareDocumentPosition(karta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByText("AES-GCM w przeglądarce")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Zablokuj teraz" })).not.toBeInTheDocument();
    });

    it("odblokowany: baner z blokada za 04:59 i Zablokuj teraz", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      expect(screen.getByText("Sejf odblokowany")).toBeInTheDocument();
      expect(screen.getByText("blokada za 04:59")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Odblokuj sejf" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Zablokuj teraz" }));
      expect(vault.lock).toHaveBeenCalledTimes(1);
    });

    it("reset: przycisk aktywny dopiero po RESETUJ; liczba sekretów z odmianą", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "zablokowany", generation: 1 };
      vault.reset.mockResolvedValue({ ok: true, cleared: 4 });
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(screen.getByRole("button", { name: "Nie pamiętam hasła — zresetuj sejf" }));
      const okno = await screen.findByRole("dialog", { name: "Zresetować sejf?" });
      expect(await within(okno).findByText("4 sekrety")).toBeInTheDocument();
      expect(within(okno).getByText("serwisy, loginy, URL-e")).toBeInTheDocument();
      const zresetuj = within(okno).getByRole("button", { name: "Zresetuj sejf" });
      expect(zresetuj).toHaveAttribute("aria-disabled", "true");
      await user.click(zresetuj);
      expect(vault.reset).not.toHaveBeenCalled();
      await user.type(within(okno).getByPlaceholderText("RESETUJ"), "RESETUJ");
      expect(zresetuj).toHaveAttribute("aria-disabled", "false");
      await user.click(zresetuj);
      expect(vault.reset).toHaveBeenCalledTimes(1);
    });

    it("strona bez pola secret nie pokazuje niczego z sejfu", () => {
      render(<TemplatePageView data={strona("books", "Books", BOOKS)} />);
      expect(screen.queryByText("AES-GCM w przeglądarce")).not.toBeInTheDocument();
      expect(screen.queryByText("Sejf zablokowany")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Ustaw hasło główne sejfu" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Zablokuj teraz" })).not.toBeInTheDocument();
    });

    it("odblokowany: komórki Sekret to ••••••••••••, a szyfrogram nie trafia do tekstu strony", () => {
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      expect(screen.getAllByText("••••••••••••")).toHaveLength(2);
      expect(document.body.textContent).not.toContain(SEKRET.ct);
      expect(document.body.textContent).not.toContain(SEKRET.iv);
      // Przed „Pokaż” jawny tekst nie występuje nigdzie w DOM (także w atrybutach)
      expect(document.body.innerHTML).not.toContain(JAWNE);
    });

    it("odblokowany: Pokaż odsłania tekst tylko w klikniętej komórce, a Kopiuj nie odsłania nic", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(within(wiersz("GitHub")).getByRole("button", { name: "Pokaż hasło" }));
      expect(await within(wiersz("GitHub")).findByText(JAWNE)).toBeInTheDocument();
      expect(within(wiersz("Supabase")).queryByText(JAWNE)).not.toBeInTheDocument();
      // Klik w przycisk w komórce nie otwiera edycji wiersza
      expect(screen.queryByRole("button", { name: "Zapisz" })).not.toBeInTheDocument();
    });

    it("zablokowany: szyfrogram nie trafia do tekstu strony", () => {
      vault.state = { ...vault.state, status: "zablokowany", generation: 1 };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      expect(document.body.textContent).not.toContain(SEKRET.ct);
      expect(document.body.textContent).not.toContain(SEKRET.iv);
    });

    it("edycja wiersza: pole Hasło wyłączone z podpowiedzią Odblokuj sejf, żeby edytować", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "zablokowany", generation: 1 };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const pole = await screen.findByLabelText("Hasło");
      expect(pole).toBeDisabled();
      expect(pole).toHaveAttribute("placeholder", "Odblokuj sejf, żeby edytować");
    });

    it("edycja szyfruje przed zapisem: updateRow dostaje SecretValue, nigdy string", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("CSS", { supports: () => true });
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      const dane = strona("passwords", "Passwords", HASLA);
      const haslo = dane.blocks[0].fields.find((f) => f.name === "Hasło")!;
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const pole = await screen.findByLabelText("Hasło");
      expect(pole).toBeEnabled();
      // Pole tekstowe maskowane CSS (menedżer haseł go nie zapisuje), bez atrybutu name
      expect(pole).toHaveAttribute("type", "text");
      expect(pole).toHaveClass("[-webkit-text-security:disc]");
      expect(pole).not.toHaveAttribute("name");
      // Wartość początkowa to odszyfrowany sekret
      await waitFor(() => expect(pole).toHaveValue(JAWNE));
      await user.clear(pole);
      await user.type(pole, "nowe-tajne");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(1));
      expect(vault.encrypt).toHaveBeenCalledWith("nowe-tajne");
      const [id, zmiany] = actions.updateRow.mock.calls[0] as [string, Record<string, unknown>];
      expect(id).toBe("row-1");
      expect(zmiany[haslo.id]).toEqual(NOWY_SEKRET);
      expect(typeof zmiany[haslo.id]).not.toBe("string");
      // Tekst jawny nie wychodzi poza komponent: ani do akcji, ani do toastów
      expect(JSON.stringify(actions.updateRow.mock.calls)).not.toContain("nowe-tajne");
      expect(JSON.stringify([toast.mock.calls, toast.error.mock.calls])).not.toContain("nowe-tajne");
    });

    it("edycja bez ruszania hasła: updateRow nie dostaje pola Sekret", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      const dane = strona("passwords", "Passwords", HASLA);
      const haslo = dane.blocks[0].fields.find((f) => f.name === "Hasło")!;
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const login = await screen.findByRole("textbox", { name: "Login" });
      await user.clear(login);
      await user.type(login, "inny");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(1));
      expect(vault.encrypt).not.toHaveBeenCalled();
      expect(actions.updateRow.mock.calls[0][1]).not.toHaveProperty(haslo.id);
    });

    it("wyczyszczone pole Sekret zapisuje null", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      const dane = strona("passwords", "Passwords", HASLA);
      const haslo = dane.blocks[0].fields.find((f) => f.name === "Hasło")!;
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const pole = await screen.findByLabelText("Hasło");
      await waitFor(() => expect(pole).toHaveValue(JAWNE));
      await user.clear(pole);
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(1));
      expect(actions.updateRow.mock.calls[0][1]).toEqual({ [haslo.id]: null });
    });

    it("sejf zablokowany w trakcie edycji: encrypt rzuca, toast bez treści błędu i brak zapisu", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      vault.encrypt.mockRejectedValue(new Error("tajny-szczegol"));
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      await user.type(await screen.findByLabelText("Hasło"), "x");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie zapisano. Sejf musi być odblokowany."));
      expect(actions.updateRow).not.toHaveBeenCalled();
    });

    it("blokada podczas edycji: pole znów wyłączone i bez wpisanego tekstu", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      const dane = strona("passwords", "Passwords", HASLA);
      const { rerender } = render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const pole = await screen.findByLabelText("Hasło");
      await waitFor(() => expect(pole).toHaveValue(JAWNE));
      vault.state = { ...vault.state, status: "zablokowany" };
      rerender(<TemplatePageView data={dane} />);
      expect(screen.getByLabelText("Hasło")).toBeDisabled();
      expect(screen.getByLabelText("Hasło")).toHaveValue("");
      expect(document.body.innerHTML).not.toContain(JAWNE);
    });

    it("zapis odrzucony z inną generacją: onStaleGeneration i komunikat z serwera", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      actions.updateRow.mockResolvedValue({
        ok: false,
        message: "Sejf zmienił się w innej karcie. Odblokuj go ponownie.",
        code: "stale_generation",
      });
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      await user.type(await screen.findByLabelText("Hasło"), "x");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(vault.onStaleGeneration).toHaveBeenCalledTimes(1));
      expect(toast.error).toHaveBeenCalledWith("Sejf zmienił się w innej karcie. Odblokuj go ponownie.");
    });

    it("nowy wiersz z hasłem: addRow dostaje SecretValue", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      const dane = strona("passwords", "Passwords", HASLA);
      const haslo = dane.blocks[0].fields.find((f) => f.name === "Hasło")!;
      render(<TemplatePageView data={dane} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      await user.type(screen.getByRole("textbox", { name: "Serwis" }), "Nowy serwis");
      await user.type(screen.getByLabelText("Hasło"), "swieze-haslo");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.addRow).toHaveBeenCalledTimes(1));
      const wartosci = actions.addRow.mock.calls[0][1] as Record<string, unknown>;
      expect(wartosci[haslo.id]).toEqual(NOWY_SEKRET);
      expect(JSON.stringify(actions.addRow.mock.calls)).not.toContain("swieze-haslo");
    });

    it("zmiana tylko hasła → klik innego wiersza: updateRow z SecretValue (hasło nie ginie po cichu)", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      const dane = strona("passwords", "Passwords", HASLA);
      const haslo = dane.blocks[0].fields.find((f) => f.name === "Hasło")!;
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const pole = await screen.findByLabelText("Hasło");
      await waitFor(() => expect(pole).toHaveValue(JAWNE));
      await user.type(pole, "-dopisek");
      await user.click(within(wiersz("Supabase")).getByText("mejson@…"));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(1));
      expect(actions.updateRow.mock.calls[0][0]).toBe("row-1");
      expect(actions.updateRow.mock.calls[0][1]).toEqual({ [haslo.id]: NOWY_SEKRET });
      expect(vault.encrypt).toHaveBeenCalledWith(`${JAWNE}-dopisek`);
      // Tekst jawny nie trafił do argumentów akcji
      expect(JSON.stringify(actions.updateRow.mock.calls)).not.toContain("dopisek");
      // Drugi wiersz przeszedł w edycję
      await waitFor(() => expect(within(edycja()).getByDisplayValue("mejson@…")).toBeInTheDocument());
    });

    it("zmiana loginu i hasła → klik innego wiersza: jeden updateRow z obydwoma", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      const dane = strona("passwords", "Passwords", HASLA);
      const haslo = dane.blocks[0].fields.find((f) => f.name === "Hasło")!;
      const login = dane.blocks[0].fields.find((f) => f.name === "Login")!;
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const poleLogin = await screen.findByRole("textbox", { name: "Login" });
      await user.clear(poleLogin);
      await user.type(poleLogin, "inny");
      await user.clear(screen.getByLabelText("Hasło"));
      await user.type(screen.getByLabelText("Hasło"), "nowe");
      await user.click(within(wiersz("Supabase")).getByText("mejson@…"));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(1));
      expect(actions.updateRow.mock.calls[0][1]).toEqual({ [login.id]: "inny", [haslo.id]: NOWY_SEKRET });
    });

    it("zmiana hasła → „Nowy wiersz”: hasło zapisuje się przed otwarciem szkicu", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      const dane = strona("passwords", "Passwords", HASLA);
      const haslo = dane.blocks[0].fields.find((f) => f.name === "Hasło")!;
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      await user.type(await screen.findByLabelText("Hasło"), "x");
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(1));
      expect(actions.updateRow.mock.calls[0][1]).toEqual({ [haslo.id]: NOWY_SEKRET });
    });

    it("przełączenie wiersza przy zablokowanym sejfie (encrypt rzuca): brak zapisu, edycja zostaje, toast", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      vault.encrypt.mockRejectedValue(new Error("x"));
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      await user.type(await screen.findByLabelText("Hasło"), "x");
      await user.click(within(wiersz("Supabase")).getByText("mejson@…"));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie zapisano. Sejf musi być odblokowany."));
      expect(actions.updateRow).not.toHaveBeenCalled();
      expect(within(edycja()).getByDisplayValue("mejsooon")).toBeInTheDocument();
    });

    it("odrzucony zapis (inna generacja): edycja zostaje otwarta z loginem, komunikat z serwera widoczny", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      actions.updateRow.mockResolvedValue({
        ok: false,
        message: "Sejf zmienił się w innej karcie. Odblokuj go ponownie.",
        code: "stale_generation",
      });
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const login = await screen.findByRole("textbox", { name: "Login" });
      await user.clear(login);
      await user.type(login, "inny-login");
      await user.type(screen.getByLabelText("Hasło"), "x");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(vault.onStaleGeneration).toHaveBeenCalledTimes(1));
      expect(toast.error).toHaveBeenCalledWith("Sejf zmienił się w innej karcie. Odblokuj go ponownie.");
      expect(within(edycja()).getByDisplayValue("inny-login")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Zapisz" })).toBeInTheDocument();
    });

    it("zwykły błąd zapisu: edycja zostaje otwarta, bez onStaleGeneration", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      actions.updateRow.mockResolvedValue({ ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." });
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const login = await screen.findByRole("textbox", { name: "Login" });
      await user.type(login, "2");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      expect(vault.onStaleGeneration).not.toHaveBeenCalled();
      expect(within(edycja()).getByDisplayValue("mejsooon2")).toBeInTheDocument();
    });

    it("błąd updateRow po zmianie hasła: edycja pokazuje NOWE hasło, ponowne Zapisz wysyła SecretValue", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      // Odszyfrowanie rozpoznaje nowy szyfrogram po ct
      vault.decrypt.mockImplementation(async (v: { ct: string }) => (v.ct === NOWY_SEKRET.ct ? "nowe-tajne" : JAWNE));
      // Odpowiedź z opóźnieniem (jak sieć): wiersz w edycji zdąży się zamknąć i otworzyć na nowo
      actions.updateRow
        .mockImplementationOnce(
          () => new Promise((r) => setTimeout(() => r({ ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." }), 30)),
        )
        .mockResolvedValueOnce({ ok: true });
      const dane = strona("passwords", "Passwords", HASLA);
      const haslo = dane.blocks[0].fields.find((f) => f.name === "Hasło")!;
      render(<TemplatePageView data={dane} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const pole = await screen.findByLabelText("Hasło");
      await waitFor(() => expect(pole).toHaveValue(JAWNE));
      await user.clear(pole);
      await user.type(pole, "nowe-tajne");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      // Przywrócony szkic ma szyfrogram nowego hasła, nie stare hasło
      await waitFor(() => expect(screen.getByLabelText("Hasło")).toHaveValue("nowe-tajne"));
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(2));
      expect(actions.updateRow.mock.calls[1][0]).toBe("row-1");
      expect(actions.updateRow.mock.calls[1][1]).toEqual({ [haslo.id]: NOWY_SEKRET });
      expect(JSON.stringify(actions.updateRow.mock.calls)).not.toContain("nowe-tajne");
    });

    it("błąd addRow po wpisaniu hasła: edycja pokazuje NOWE hasło, ponowne Zapisz wysyła SecretValue", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      vault.decrypt.mockImplementation(async (v: { ct: string }) => (v.ct === NOWY_SEKRET.ct ? "nowe-tajne" : JAWNE));
      actions.addRow.mockImplementationOnce(() => new Promise((_r, odrzuc) => setTimeout(() => odrzuc(new Error("sieć")), 30)));
      const dane = strona("passwords", "Passwords", HASLA);
      const haslo = dane.blocks[0].fields.find((f) => f.name === "Hasło")!;
      render(<TemplatePageView data={dane} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      await user.type(screen.getByRole("textbox", { name: "Serwis" }), "Nowy serwis");
      await user.type(screen.getByLabelText("Hasło"), "nowe-tajne");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      await waitFor(() => expect(screen.getByLabelText("Hasło")).toHaveValue("nowe-tajne"));
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.addRow).toHaveBeenCalledTimes(2));
      const wartosci = actions.addRow.mock.calls[1][1] as Record<string, unknown>;
      expect(wartosci[haslo.id]).toEqual(NOWY_SEKRET);
      expect(JSON.stringify(actions.addRow.mock.calls)).not.toContain("nowe-tajne");
    });

    it("błąd zapisu przy przełączaniu wiersza: szkic zostaje z NOWYM hasłem", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      vault.decrypt.mockImplementation(async (v: { ct: string }) => (v.ct === NOWY_SEKRET.ct ? "nowe-tajne" : JAWNE));
      actions.updateRow.mockImplementationOnce(
        () => new Promise((r) => setTimeout(() => r({ ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." }), 30)),
      );
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const pole = await screen.findByLabelText("Hasło");
      await waitFor(() => expect(pole).toHaveValue(JAWNE));
      await user.clear(pole);
      await user.type(pole, "nowe-tajne");
      await user.click(within(wiersz("Supabase")).getByText("mejson@…"));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      await waitFor(() => expect(screen.getByLabelText("Hasło")).toHaveValue("nowe-tajne"));
      expect(within(edycja()).getByDisplayValue("mejsooon")).toBeInTheDocument();
    });

    it("podwójny Zapisz: jeden addRow", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      // Wolne szyfrowanie: drugi klik trafia w trakcie pierwszego
      let dokoncz: (v: typeof NOWY_SEKRET) => void = () => {};
      vault.encrypt.mockImplementation(() => new Promise((r) => (dokoncz = r)));
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      await user.type(screen.getByRole("textbox", { name: "Serwis" }), "Nowy serwis");
      await user.type(screen.getByLabelText("Hasło"), "swieze");
      const zapisz = screen.getByRole("button", { name: "Zapisz" });
      await user.click(zapisz);
      await user.click(zapisz);
      await act(async () => dokoncz(NOWY_SEKRET));
      await waitFor(() => expect(actions.addRow).toHaveBeenCalledTimes(1));
      expect(vault.encrypt).toHaveBeenCalledTimes(1);
    });

    it("+ Pole: Sekret w grupie Bezpieczne tylko na stronie Hasła", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      const { unmount } = render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(screen.getByRole("button", { name: "+ Pole" }));
      const okno = await screen.findByRole("dialog", { name: "Nowe pole" });
      expect(within(okno).getByText("Bezpieczne")).toBeInTheDocument();
      await user.click(within(okno).getByRole("button", { name: /Sekret/ }));
      expect(within(okno).getByText("Zamaskowana wartość, np. hasło.")).toBeInTheDocument();
      expect(within(okno).getByRole("textbox", { name: "Nazwa pola" })).toHaveValue("Hasło");
      actions.addField.mockImplementation(async (_b: string, pole: { name: string; type: string; config: object }) => ({
        ok: true,
        field: { id: "srv-pole", name: pole.name, type: pole.type, config: pole.config, position: 9, isTitle: false },
      }));
      await user.click(within(okno).getByRole("button", { name: "Dodaj pole" }));
      await waitFor(() => expect(actions.addField).toHaveBeenCalledTimes(1));
      expect(actions.addField.mock.calls[0][1]).toMatchObject({ type: "secret", name: "Hasło" });
      unmount();

      // Pusta strona (bez szablonu) nie oferuje Sekretu
      const pusta = strona("empty", "Pusta", []);
      pusta.page.templateKey = null;
      render(<TemplatePageView data={pusta} />);
      await user.click(screen.getByRole("button", { name: "+ Pole" }));
      const okno2 = await screen.findByRole("dialog", { name: "Nowe pole" });
      expect(within(okno2).queryByText("Bezpieczne")).not.toBeInTheDocument();
      expect(within(okno2).queryByRole("button", { name: /Sekret/ })).not.toBeInTheDocument();
    });

    it("+ Pole: strona Books (w tym widoku tylko z istniejącym Sekretem) nie oferuje nowego Sekretu", async () => {
      const user = userEvent.setup();
      render(<TemplatePageView data={strona("books", "Books", [])} />);
      await user.click(screen.getByRole("button", { name: "+ Pole" }));
      const okno = await screen.findByRole("dialog", { name: "Nowe pole" });
      expect(within(okno).queryByRole("button", { name: /Sekret/ })).not.toBeInTheDocument();
    });

    it("menu kolumny secret: brak sortowania i zmiany typu", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      const naglowek = screen.getByRole("columnheader", { name: /Hasło/ });
      await user.click(within(naglowek).getByRole("button", { name: /Hasło/ }));
      const menu = screen.getByRole("menu", { name: "Kolumna Hasło" });
      expect(within(menu).queryByRole("menuitem", { name: "Sortuj rosnąco" })).not.toBeInTheDocument();
      expect(within(menu).queryByRole("menuitem", { name: "Sortuj malejąco" })).not.toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: /Typ: Sekret/ })).toBeDisabled();
      expect(within(menu).getByRole("menuitem", { name: "Filtruj po tym polu" })).toBeInTheDocument();
    });

    it("filtr: pole secret tylko pusty/niepusty", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      const naglowek = screen.getByRole("columnheader", { name: /Hasło/ });
      await user.click(within(naglowek).getByRole("button", { name: /Hasło/ }));
      await user.click(screen.getByRole("menuitem", { name: "Filtruj po tym polu" }));
      const filtr = await screen.findByRole("dialog", { name: "Filtr" });
      await user.click(within(filtr).getByRole("button", { name: "Operator warunku 1" }));
      expect(await screen.findByRole("option", { name: "jest puste" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "nie jest puste" })).toBeInTheDocument();
      expect(screen.getAllByRole("option").filter((o) => o.closest("[role=listbox]"))).toHaveLength(2);
      // Dla pusty / niepusty nie ma pola wartości
      expect(within(filtr).queryByRole("textbox", { name: "Wartość warunku 1" })).not.toBeInTheDocument();
    });

    it("nowy wiersz zapisany z samym tytułem: addRow dostaje null dla pola Sekret", async () => {
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "odblokowany", generation: 1, remainingMs: 299000 };
      const dane = strona("passwords", "Passwords", HASLA);
      const haslo = dane.blocks[0].fields.find((f) => f.name === "Hasło")!;
      render(<TemplatePageView data={dane} />);
      await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
      await user.type(screen.getByRole("textbox", { name: "Serwis" }), "Nowy serwis");
      await user.click(screen.getByRole("button", { name: "Zapisz" }));
      await waitFor(() => expect(actions.addRow).toHaveBeenCalledTimes(1));
      const wartosci = actions.addRow.mock.calls[0][1] as Record<string, unknown>;
      expect(wartosci[haslo.id]).toBeNull();
    });

    it("arkusz mobilny pomija pole Sekret", async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
      const user = userEvent.setup();
      vault.state = { ...vault.state, status: "zablokowany", generation: 1 };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      await user.click(within(wiersz("GitHub")).getByText("mejsooon"));
      const arkusz = screen.getByRole("dialog", { name: "GitHub" });
      expect(within(arkusz).getByRole("textbox", { name: "Login" })).toBeInTheDocument();
      expect(within(arkusz).queryByLabelText("Hasło")).not.toBeInTheDocument();
    });

    it("po resecie (status przechodzi na brak) otwiera się VaultSetup", () => {
      vault.state = { ...vault.state, status: "zablokowany", generation: 1 };
      const dane = strona("passwords", "Passwords", HASLA);
      const { rerender } = render(<TemplatePageView data={dane} />);
      expect(screen.queryByRole("heading", { name: "Ustaw hasło główne sejfu" })).not.toBeInTheDocument();
      vault.state = { ...vault.state, status: "brak", generation: null };
      rerender(<TemplatePageView data={dane} />);
      expect(screen.getByRole("heading", { name: "Ustaw hasło główne sejfu" })).toBeInTheDocument();
    });

    it("nieobsługiwany: komunikat o nowoczesnej przeglądarce", () => {
      vault.state = { ...vault.state, status: "nieobslugiwany" };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      expect(screen.getByText("Sejf wymaga nowoczesnej przeglądarki i połączenia HTTPS.")).toBeInTheDocument();
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("ładowanie: neutralnie, bez ustawiania, banera i karty", () => {
      vault.state = { ...vault.state, status: "ladowanie" };
      render(<TemplatePageView data={strona("passwords", "Passwords", HASLA)} />);
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Ustaw hasło główne sejfu" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Odblokuj sejf" })).not.toBeInTheDocument();
      expect(screen.queryByText("Sejf zablokowany")).not.toBeInTheDocument();
    });
  });
});

// Globalne podmiany (np. CSS.supports) nie przechodzą między testami
afterEach(() => {
  vi.unstubAllGlobals();
});
