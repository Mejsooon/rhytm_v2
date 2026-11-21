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

import type { LoadedPage } from "../load-page";
import type { PageSummary } from "../load-pages";
import { buildTemplateBlocks, type TemplateKey } from "../templates";
import { TemplatePageView } from "./template-page-view";

const TODAY = "2026-11-15";

// Strona z szablonu z wierszami podanymi po nazwach pól i etykietach opcji (dane z makiet)
function strona(key: TemplateKey, title: string, wiersze: Record<string, unknown>[]): LoadedPage {
  let n = 0;
  const [b] = buildTemplateBlocks(key, () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`);
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
      // Bez kart nie ma siatki kart ani pustej ramki
      expect(container.querySelector('[data-testid="przypiete-karty"]')).toBeNull();
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
});
