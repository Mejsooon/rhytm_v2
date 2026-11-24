import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  addField: vi.fn(),
  addRow: vi.fn(),
  changeFieldType: vi.fn(),
  deleteField: vi.fn(),
  deleteRow: vi.fn(),
  reorderFields: vi.fn(),
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
// Strony bez pola Sekret nie czytają stanu sejfu
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => ({ status: "ladowanie" }) }));
vi.mock("../actions", () => actions);

import type { PageField } from "../fields";
import { ColumnMenu } from "./column-menu";
import { PageTable } from "./page-table";
import { DZIS, stronaTestowa, SUBSKRYPCJE } from "./test-page";

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

// Wiersz po wartości pola edycji (tytuły i teksty to pola input, nie tekst komórki)
function wiersz(tekst: string) {
  const tr = screen
    .getAllByRole("row")
    .find((r) => Array.from(r.querySelectorAll("input")).some((i) => i.value.includes(tekst)));
  if (!tr) throw new Error(`Brak wiersza ${tekst}`);
  return tr;
}

function naglowek(nazwa: string) {
  return screen.getByRole("columnheader", { name: new RegExp(nazwa) });
}

async function otworzMenu(user: ReturnType<typeof userEvent.setup>, nazwa: string) {
  await user.click(within(naglowek(nazwa)).getByRole("button", { name: new RegExp(nazwa) }));
  return screen.getByRole("menu", { name: `Kolumna ${nazwa}` });
}

describe("menu kolumny", () => {
  beforeEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
  });

  it("klik w nagłówek otwiera menu z pozycjami z makiety", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
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
    render(<PageTable block={(stronaTestowa("projects", "Projects", PROJECTS)).blocks[0]} today={DZIS} />);
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

  // Przesuwanie do środka przy krawędzi okna sprawdza action-popover.test.tsx (avoidCollisions, collisionPadding)
  it("menu ostatniej kolumny otwiera się pod nagłówkiem w dymku Radixa", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("projects", "Projects", PROJECTS)).blocks[0]} today={DZIS} />);
    // Kolumny z menu mają przycisk aria-haspopup=menu (ostatni nagłówek to „+” dodające pole)
    const zMenu = screen
      .getAllByRole("columnheader")
      .filter((h) => h.querySelector("button[aria-haspopup='menu']"));
    await user.click(within(zMenu[zMenu.length - 1]).getByRole("button", { name: /Repo/ }));
    const dymek = screen.getByRole("dialog", { name: /^Kolumna / });
    expect(dymek.parentElement).toHaveAttribute("data-radix-popper-content-wrapper");
    expect(dymek).toHaveAttribute("data-side", "bottom");
  });

  // PageTable podaje onMove… i onAddOption, więc menu ma „Przesuń…” i dla Wyboru sekcję „Opcje”;
  // kolumna tytułu nie da się przesunąć (obie pozycje wyłączone), a pole tekstowe nie ma sekcji „Opcje”
  it("menu w PageTable ma „Przesuń…” i sekcję „Opcje” tylko dla Wyboru; tytuł się nie przesuwa", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const menu = await otworzMenu(user, "Status");
    expect(within(menu).getByRole("menuitem", { name: /Przesuń w lewo/ })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Przesuń w prawo/ })).toBeInTheDocument();
    expect(within(menu).getByText("Opcje")).toBeInTheDocument();
    expect(within(menu).getByRole("textbox", { name: "Nowa opcja" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    const menuTytulu = await otworzMenu(user, "Tytuł");
    expect(within(menuTytulu).getByRole("menuitem", { name: /Przesuń w lewo/ })).toBeDisabled();
    expect(within(menuTytulu).getByRole("menuitem", { name: /Przesuń w prawo/ })).toBeDisabled();
    await user.keyboard("{Escape}");
    const menuAutora = await otworzMenu(user, "Autor");
    expect(within(menuAutora).queryByText("Opcje")).not.toBeInTheDocument();
    expect(within(menuAutora).queryByRole("textbox", { name: "Nowa opcja" })).not.toBeInTheDocument();
  });

  it("pole tytułowe: Typ i Usuń pole są wyszarzone", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const menu = await otworzMenu(user, "Tytuł");
    expect(within(menu).getByRole("menuitem", { name: /Typ: Tekst/ })).toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: "Usuń pole" })).toBeDisabled();
    // PageTable nie pozwala ukryć kolumny tytułu (canHide), więc „Ukryj kolumnę” też jest wyszarzone
    expect(within(menu).getByRole("menuitem", { name: "Ukryj kolumnę" })).toBeDisabled();
  });

  it("sortowanie zapisuje settings.sort jednym kluczem i zmienia plakietkę „Sort: …” w pasku tabeli", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
    const menu = await otworzMenu(user, "Autor");
    await user.click(within(menu).getByRole("menuitem", { name: "Sortuj malejąco" }));
    const autor = dane.blocks[0].fields.find((f) => f.name === "Autor")!;
    expect(actions.saveTableSettings).toHaveBeenCalledWith("blok-1", {
      sort: [{ field_id: autor.id, dir: "desc" }],
    });
    expect(screen.getByText("Sort: Autor")).toBeInTheDocument();
    const tytuly = screen
      .getAllByRole("row")
      .slice(1, -1)
      .map((r) => (r.querySelector("td input") as HTMLInputElement | null)?.value);
    expect(tytuly).toEqual(["Clean Code", "Atomic Habits", "Diuna", "Deep Work"]);
  });

  it("Ukryj kolumnę: kolumna znika, „Widoczne kolumny” w menu tabeli ją przywraca", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("projects", "Projects", PROJECTS);
    render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
    const menu = await otworzMenu(user, "Repo");
    await user.click(within(menu).getByRole("menuitem", { name: "Ukryj kolumnę" }));
    const repo = dane.blocks[0].fields.find((f) => f.name === "Repo")!;
    expect(actions.saveTableSettings).toHaveBeenCalledWith("blok-1", { hidden_field_ids: [repo.id] });
    expect(screen.queryByRole("columnheader", { name: /Repo/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Menu tabeli" }));
    const ustawienia = await screen.findByRole("dialog", { name: "Ustawienia tabeli" });
    await user.click(within(ustawienia).getByRole("button", { name: "Repo", pressed: false }));
    expect(actions.saveTableSettings).toHaveBeenLastCalledWith("blok-1", { hidden_field_ids: [] });
    expect(screen.getByRole("columnheader", { name: /Repo/ })).toBeInTheDocument();
    expect(within(ustawienia).getByRole("button", { name: "Repo", pressed: true })).toBeInTheDocument();
  });

  it("Data: „Pokaż w kalendarzu” przełącza config i stan przełącznika w menu kolumny", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("projects", "Projects", PROJECTS);
    render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
    // Znaczka „w kalendarzu” w nagłówku kolumny już nie ma (krok 2); stan pokazuje przełącznik w menu kolumny
    expect(within(naglowek("Termin")).queryByText("w kalendarzu")).not.toBeInTheDocument();
    const menu = await otworzMenu(user, "Termin");
    expect(within(menu).getByRole("menuitem", { name: /Pokaż w kalendarzu/ }).querySelector("[data-on=true]")).not.toBeNull();
    await user.click(within(menu).getByRole("menuitem", { name: /Pokaż w kalendarzu/ }));
    const termin = dane.blocks[0].fields.find((f) => f.name === "Termin")!;
    expect(actions.updateField).toHaveBeenCalledWith(termin.id, {
      config: { ...termin.config, show_in_calendar: false },
    });
    // Po ponownym otwarciu menu przełącznik jest wyłączony
    const menu2 = await otworzMenu(user, "Termin");
    expect(within(menu2).getByRole("menuitem", { name: /Pokaż w kalendarzu/ }).querySelector("[data-on=true]")).toBeNull();
  });

  it("zmiana nazwy zapisuje updateField", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
    const menu = await otworzMenu(user, "Autor");
    const pole = within(menu).getByRole("textbox", { name: "Nazwa kolumny" });
    await user.clear(pole);
    await user.type(pole, "Pisarz{Enter}");
    const autor = dane.blocks[0].fields.find((f) => f.name === "Autor")!;
    await waitFor(() => expect(actions.updateField).toHaveBeenCalledWith(autor.id, { name: "Pisarz" }));
    expect(screen.getByRole("columnheader", { name: /Pisarz/ })).toBeInTheDocument();
  });

  describe("podmenu przy prawej krawędzi", () => {
    async function podmenuTypu(prawaKrawedz: number) {
      const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        x: 0, y: 0, width: 260, height: 300, top: 0, left: prawaKrawedz - 260, bottom: 300, right: prawaKrawedz,
        toJSON: () => ({}),
      } as DOMRect);
      const user = userEvent.setup();
      render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: /Typ: Tekst/ }));
      const podmenu = screen.getByRole("menu", { name: "Typ pola" });
      spy.mockRestore();
      return podmenu;
    }

    it("blisko prawej krawędzi otwiera się w lewo", async () => {
      const podmenu = await podmenuTypu(window.innerWidth - 10);
      expect(podmenu).toHaveClass("right-[calc(100%+12px)]");
      expect(podmenu).not.toHaveClass("left-[calc(100%+12px)]");
    });

    it("z zapasem miejsca otwiera się w prawo", async () => {
      const podmenu = await podmenuTypu(200);
      expect(podmenu).toHaveClass("left-[calc(100%+12px)]");
      expect(podmenu).not.toHaveClass("right-[calc(100%+12px)]");
    });
  });

  describe("typ", () => {
    it("bez strat zmienia od razu, bez okna", async () => {
      const user = userEvent.setup();
      const dane = stronaTestowa("projects", "Projects", PROJECTS);
      render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
      const menu = await otworzMenu(user, "Repo");
      await user.click(within(menu).getByRole("menuitem", { name: /Typ: URL/ }));
      await user.click(screen.getByRole("menuitem", { name: /Tekst/ }));
      expect(screen.queryByText("Zmienić typ pola?")).not.toBeInTheDocument();
      const repo = dane.blocks[0].fields.find((f) => f.name === "Repo")!;
      await waitFor(() => expect(actions.changeFieldType).toHaveBeenCalledTimes(1));
      expect(actions.changeFieldType.mock.calls[0].slice(0, 2)).toEqual([repo.id, "text"]);
      expect(naglowek("Repo").querySelector("svg[aria-hidden='true']")).not.toBeNull();
      expect(within(naglowek("Repo")).queryByText("Aa")).toBeNull();
    });

    it("ze stratą pyta o potwierdzenie i dopiero po nim zapisuje", async () => {
      const user = userEvent.setup();
      render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
      const menu = await otworzMenu(user, "Autor");
      await user.click(within(menu).getByRole("menuitem", { name: /Typ: Tekst/ }));
      await user.click(screen.getByRole("menuitem", { name: /Liczba/ }));
      expect(screen.getByText("Zmienić typ pola?")).toBeInTheDocument();
      expect(screen.getByText("4 wartości nie da się przenieść i zostaną wyczyszczone.")).toBeInTheDocument();
      expect(actions.changeFieldType).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Zmień typ" }));
      await waitFor(() => expect(actions.changeFieldType).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByText("Zmienić typ pola?")).not.toBeInTheDocument());
      expect(naglowek("Autor").querySelector("svg[aria-hidden='true']")).not.toBeNull();
      expect(within(naglowek("Autor")).queryByText("#")).toBeNull();
    });

    it("błąd zapisu cofa typ kolumny i pokazuje toast", async () => {
      const user = userEvent.setup();
      actions.changeFieldType.mockResolvedValue({ ok: false, message: "x" });
      render(<PageTable block={(stronaTestowa("projects", "Projects", PROJECTS)).blocks[0]} today={DZIS} />);
      const menu = await otworzMenu(user, "Repo");
      await user.click(within(menu).getByRole("menuitem", { name: /Typ: URL/ }));
      await user.click(screen.getByRole("menuitem", { name: /Tekst/ }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
      expect(naglowek("Repo").querySelector("svg[aria-hidden='true']")).not.toBeNull();
      expect(within(naglowek("Repo")).queryByText("↗")).toBeNull();
    });
  });

  describe("usuwanie pola", () => {
    it("usuwa kolumnę od razu i czyści ślady w ustawieniach", async () => {
      const user = userEvent.setup();
      const dane = stronaTestowa("books", "Books", BOOKS);
      render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
      // Szablon Books sortuje po statusie i dacie przeczytania
      expect(screen.getByText("Sort: Status, Przeczytana")).toBeInTheDocument();
      const menu = await otworzMenu(user, "Przeczytana");
      await user.click(within(menu).getByRole("menuitem", { name: "Usuń pole" }));
      const pole = dane.blocks[0].fields.find((f) => f.name === "Przeczytana")!;
      expect(actions.deleteField).toHaveBeenCalledWith(pole.id);
      expect(screen.queryByRole("columnheader", { name: /Przeczytana/ })).not.toBeInTheDocument();
      expect(screen.getByText("Sort: Status")).toBeInTheDocument();
      expect(within(screen.getAllByRole("row").at(-1) as HTMLElement).getByText("4 wiersze")).toBeInTheDocument();
    });

    it("błąd cofa kolumnę i pokazuje toast", async () => {
      const user = userEvent.setup();
      actions.deleteField.mockResolvedValue({ ok: false, message: "x" });
      render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
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
      render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
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
      render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
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
      render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
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
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
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
      render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
      const menu = await otworzMenu(user, "Przeczytana");
      await user.click(within(menu).getByRole("menuitem", { name: "Usuń pole" }));
      expect(screen.queryByRole("columnheader", { name: /Przeczytana/ })).not.toBeInTheDocument();

      const menuAutora = await otworzMenu(user, "Autor");
      await user.click(within(menuAutora).getByRole("menuitem", { name: "Sortuj rosnąco" }));
      expect(screen.getByText("Sort: Autor")).toBeInTheDocument();

      await act(async () => odrzuc({ ok: false, message: "x" }));
      expect(screen.getByRole("columnheader", { name: /Przeczytana/ })).toBeInTheDocument();
      expect(screen.getByText("Sort: Autor")).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie.");
    });

    it("nieudane usunięcie pola przywraca jego warunki w filtrze tymczasowym", async () => {
      const user = userEvent.setup();
      let odrzuc!: (v: { ok: false; message: string }) => void;
      actions.deleteField.mockReturnValue(new Promise((r) => (odrzuc = r)));
      render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
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
      render(<PageTable block={(stronaTestowa("projects", "Projects", PROJECTS)).blocks[0]} today={DZIS} />);
      const menu = await otworzMenu(user, "Repo");
      await user.click(within(menu).getByRole("menuitem", { name: /Typ: URL/ }));
      await user.click(screen.getByRole("menuitem", { name: /Tekst/ }));

      // Komórki edytują się wprost: pole Repo w wierszu „rhytm v3”, zapis przy wyjściu z komórki (Enter)
      await user.type(within(wiersz("rhytm v3")).getByRole("textbox", { name: "Repo" }), "!{Enter}");
      await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(1));

      await act(async () => odrzuc({ ok: false, message: "x" }));
      expect(naglowek("Repo").querySelector("svg[aria-hidden='true']")).not.toBeNull();
      expect(within(naglowek("Repo")).queryByText("↗")).toBeNull();
      expect(within(wiersz("rhytm v3")).getByRole("textbox", { name: "Repo" })).toHaveValue("Mejsooon/rhytm-v3!");
    });
  });

  it("zmiana typu przy wierszu czekającym na serwer pokazuje toast zamiast milczeć", async () => {
    const user = userEvent.setup();
    actions.addRow.mockReturnValue(new Promise(() => {}));
    render(<PageTable block={(stronaTestowa("projects", "Projects", PROJECTS)).blocks[0]} today={DZIS} />);
    // Na webie „Nowy” dodaje wiersz wprost na serwerze (bez tymczasowego id), więc wiersz czekający
    // na serwer powstaje tylko w arkuszu telefonu (poniżej 800 px): „Nowy” → nazwa → „Zapisz”
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    await user.click(screen.getByRole("button", { name: "Nowy" }));
    await user.type(screen.getByRole("textbox", { name: "Nazwa" }), "Nowy");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    // Telefon: nagłówek otwiera arkusz „Kolumna”, a typ wybiera się chipem
    await user.click(within(naglowek("Repo")).getByRole("button", { name: /Repo/ }));
    const arkusz = await screen.findByRole("dialog", { name: "Kolumna" });
    await user.click(within(arkusz).getByRole("button", { name: "Tekst" }));
    expect(toast.error).toHaveBeenCalledWith("Poczekaj, aż wiersze się zapiszą.");
    expect(actions.changeFieldType).not.toHaveBeenCalled();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("nazwa kolumny zapisuje się też przy zamknięciu menu bez blur", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
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

describe("menu kolumny: typy inteligentne (Subscriptions)", () => {
  beforeEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
  });

  function strona() {
    const dane = stronaTestowa("subscriptions", "Subscriptions", SUBSKRYPCJE);
    render(<PageTable block={dane.blocks[0]} today={DZIS} />);
    return dane.blocks[0].fields;
  }

  it("„Typ pola” kończy się Kwotą cykliczną i Datą odnowienia (bez Sekretu)", async () => {
    const user = userEvent.setup();
    strona();
    const menu = await otworzMenu(user, "Kwota cykliczna");
    await user.click(within(menu).getByRole("menuitem", { name: /^Typ:/ }));
    const typy = within(screen.getByRole("menu", { name: "Typ pola" })).getAllByRole("menuitem").map((t) => t.textContent);
    expect(typy.slice(-2)).toEqual(["Kwota cykliczna", "Data odnowienia"]);
    expect(typy).not.toContain("Sekret");
  });

  it("Data odnowienia: „Pokaż w kalendarzu” jest domyślnie włączone i wyłącza się przez config", async () => {
    const user = userEvent.setup();
    const pola = strona();
    const odnowienie = pola.find((f) => f.name === "Data odnowienia")!;
    const menu = await otworzMenu(user, "Data odnowienia");
    const pozycja = within(menu).getByRole("menuitem", { name: /Pokaż w kalendarzu/ });
    expect(pozycja.querySelector("[data-on=true]")).not.toBeNull();
    await user.click(pozycja);
    expect(actions.updateField).toHaveBeenCalledWith(odnowienie.id, {
      config: { ...odnowienie.config, show_in_calendar: false },
    });
    const menu2 = await otworzMenu(user, "Data odnowienia");
    expect(within(menu2).getByRole("menuitem", { name: /Pokaż w kalendarzu/ }).querySelector("[data-on=true]")).toBeNull();
  });

  it("Data odnowienia: podmenu „Cykl z pola” zaznacza pole Kwoty, a „Własny: rok” zapisuje cykl bez odwołania", async () => {
    const user = userEvent.setup();
    const pola = strona();
    const odnowienie = pola.find((f) => f.name === "Data odnowienia")!;
    const kwota = pola.find((f) => f.name === "Kwota cykliczna")!;
    const menu = await otworzMenu(user, "Data odnowienia");
    await user.click(within(menu).getByRole("menuitem", { name: /^Cykl z pola/ }));
    const podmenu = screen.getByRole("menu", { name: "Cykl z pola" });
    expect(within(podmenu).getAllByRole("menuitem").map((p) => p.textContent)).toEqual([
      "Kwota cykliczna",
      "Własny: miesiąc",
      "Własny: rok",
    ]);
    expect(within(podmenu).getByRole("menuitem", { name: "Kwota cykliczna" }).querySelector("svg")).not.toBeNull();
    await user.click(within(podmenu).getByRole("menuitem", { name: "Własny: rok" }));
    const { cycle_field_id: _pominiete, ...reszta } = odnowienie.config;
    void _pominiete;
    expect(actions.updateField).toHaveBeenCalledWith(odnowienie.id, { config: { ...reszta, cycle: "year" } });
    // Powrót do pola Kwoty usuwa własny cykl
    const menu2 = await otworzMenu(user, "Data odnowienia");
    await user.click(within(menu2).getByRole("menuitem", { name: /^Cykl z pola/ }));
    await user.click(within(screen.getByRole("menu", { name: "Cykl z pola" })).getByRole("menuitem", { name: "Kwota cykliczna" }));
    expect(actions.updateField).toHaveBeenLastCalledWith(odnowienie.id, {
      config: { ...reszta, cycle_field_id: kwota.id },
    });
  });

  it("Data odnowienia: „— zawsze —” zapisuje config bez active_field_id", async () => {
    const user = userEvent.setup();
    const pola = strona();
    const odnowienie = pola.find((f) => f.name === "Data odnowienia")!;
    const menu = await otworzMenu(user, "Data odnowienia");
    await user.click(within(menu).getByRole("menuitem", { name: /^Tylko gdy zaznaczone/ }));
    const podmenu = screen.getByRole("menu", { name: "Tylko gdy zaznaczone" });
    expect(within(podmenu).getAllByRole("menuitem").map((p) => p.textContent)).toEqual(["Aktywna", "— zawsze —"]);
    await user.click(within(podmenu).getByRole("menuitem", { name: "— zawsze —" }));
    const { active_field_id: _pominiete, ...reszta } = odnowienie.config;
    void _pominiete;
    expect(actions.updateField).toHaveBeenCalledWith(odnowienie.id, { config: reszta });
    expect(actions.updateField.mock.calls.at(-1)![1].config).not.toHaveProperty("active_field_id");
  });

  it("Kwota cykliczna: podmenu „Domyślny cykl” zapisuje default_cycle", async () => {
    const user = userEvent.setup();
    const pola = strona();
    const kwota = pola.find((f) => f.name === "Kwota cykliczna")!;
    const menu = await otworzMenu(user, "Kwota cykliczna");
    expect(within(menu).queryByRole("menuitem", { name: /Pokaż w kalendarzu/ })).not.toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: /^Domyślny cykl/ }));
    const podmenu = screen.getByRole("menu", { name: "Domyślny cykl" });
    expect(within(podmenu).getAllByRole("menuitem").map((p) => p.textContent)).toEqual(["miesiąc", "rok"]);
    await user.click(within(podmenu).getByRole("menuitem", { name: "rok" }));
    expect(actions.updateField).toHaveBeenCalledWith(kwota.id, { config: { ...kwota.config, default_cycle: "year" } });
  });

  it("inne typy nie mają podmenu cyklu", async () => {
    const user = userEvent.setup();
    strona();
    const menu = await otworzMenu(user, "Nazwa");
    expect(within(menu).queryByRole("menuitem", { name: /^Cykl z pola/ })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: /^Domyślny cykl/ })).not.toBeInTheDocument();
  });
});

describe("menu kolumny zablokowanej (moduł Hasła)", () => {
  function menu(field: PageField) {
    const wywolania = { onHide: vi.fn(), onSort: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() };
    render(
      <ColumnMenu
        field={field}
        fields={[field]}
        open
        onOpenChange={() => {}}
        canHide
        summary={undefined}
        locked
        onRename={wywolania.onRename}
        onPickType={() => {}}
        onSort={wywolania.onSort}
        onFilter={() => {}}
        onSummary={() => {}}
        onToggleCalendar={() => {}}
        onConfig={() => {}}
        onHide={wywolania.onHide}
        onDelete={wywolania.onDelete}
        onMoveLeft={() => {}}
        onMoveRight={() => {}}
      />,
    );
    return wywolania;
  }

  it("bez zmiany nazwy, typu, przesuwania i usuwania; ukrywanie, sort, filtr i podsumowanie zostają", async () => {
    const user = userEvent.setup();
    const { onHide } = menu({ id: "f-login", name: "Login", type: "text", config: {}, position: 1, isTitle: false });
    const m = screen.getByRole("menu", { name: "Kolumna Login" });
    expect(within(m).queryByRole("textbox", { name: "Nazwa kolumny" })).not.toBeInTheDocument();
    expect(within(m).queryByRole("menuitem", { name: /Typ:/ })).not.toBeInTheDocument();
    expect(within(m).queryByRole("menuitem", { name: /Przesuń/ })).not.toBeInTheDocument();
    expect(within(m).queryByRole("menuitem", { name: /Usuń pole/ })).not.toBeInTheDocument();
    expect(within(m).getByRole("menuitem", { name: /Sortuj rosnąco/ })).toBeInTheDocument();
    expect(within(m).getByRole("menuitem", { name: /Filtruj po tym polu/ })).toBeInTheDocument();
    expect(within(m).getByRole("menuitem", { name: /Podsumowanie/ })).toBeInTheDocument();
    await user.click(within(m).getByRole("menuitem", { name: /Ukryj kolumnę/ }));
    expect(onHide).toHaveBeenCalled();
  });

  it("kolumna Sekret ma plakietkę „szyfr.” w nagłówku", () => {
    menu({ id: "f-haslo", name: "Hasło", type: "secret", config: {}, position: 2, isTitle: false });
    expect(screen.getByRole("button", { name: /Hasło/, expanded: true })).toHaveTextContent("szyfr.");
  });
});

describe("arkusz „Kolumna” (telefon, CMEditor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  async function otworzArkusz(user: ReturnType<typeof userEvent.setup>, nazwa: string) {
    await user.click(within(naglowek(nazwa)).getByRole("button", { name: new RegExp(nazwa) }));
    return screen.findByRole("dialog", { name: "Kolumna" });
  }

  it("„Gotowe” zapisuje wpisaną nazwę bez blur", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    render(<PageTable block={dane.blocks[0]} today={DZIS} />);
    const arkusz = await otworzArkusz(user, "Autor");
    const pole = within(arkusz).getByRole("textbox", { name: "Nazwa kolumny" });
    await user.clear(pole);
    await user.type(pole, "Pisarz");
    await user.click(within(arkusz).getByRole("button", { name: "Gotowe" }));
    const autor = dane.blocks[0].fields.find((f) => f.name === "Autor")!;
    await waitFor(() => expect(actions.updateField).toHaveBeenCalledWith(autor.id, { name: "Pisarz" }));
  });

  it("nagłówek otwiera arkusz z nazwą, chipami typu bez Sekretu, przesuwaniem, usuwaniem i „Gotowe” zamiast dymku", async () => {
    const user = userEvent.setup();
    render(<PageTable block={stronaTestowa("books", "Books", BOOKS).blocks[0]} today={DZIS} />);
    const arkusz = await otworzArkusz(user, "Autor");
    expect(screen.queryByRole("menu", { name: "Kolumna Autor" })).toBeNull();
    expect(within(arkusz).getByRole("textbox", { name: "Nazwa kolumny" })).toHaveValue("Autor");
    for (const typ of ["Tekst", "Liczba", "Checkbox", "URL", "Select", "Status", "Data", "Ocena", "Kwota cykliczna", "Data odnowienia"]) {
      expect(within(arkusz).getByRole("button", { name: typ })).toBeInTheDocument();
    }
    expect(within(arkusz).queryByRole("button", { name: "Sekret" })).toBeNull();
    expect(within(arkusz).getByRole("button", { name: "Tekst" })).toHaveAttribute("aria-pressed", "true");
    expect(within(arkusz).getByRole("button", { name: "← W lewo" })).toBeInTheDocument();
    expect(within(arkusz).getByRole("button", { name: "W prawo →" })).toBeInTheDocument();
    expect(within(arkusz).getByRole("button", { name: "Usuń kolumnę" })).toBeInTheDocument();
    await user.click(within(arkusz).getByRole("button", { name: "Gotowe" }));
    expect(screen.queryByRole("dialog", { name: "Kolumna" })).toBeNull();
  });

  it("chip typu zmienia typ pola, „W prawo” przesuwa, „Usuń kolumnę” usuwa", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    render(<PageTable block={dane.blocks[0]} today={DZIS} />);
    const autor = dane.blocks[0].fields.find((f) => f.name === "Autor")!;
    let arkusz = await otworzArkusz(user, "Autor");
    await user.click(within(arkusz).getByRole("button", { name: "URL" }));
    await waitFor(() => expect(actions.changeFieldType).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "Kolumna" })).toBeNull();

    arkusz = await otworzArkusz(user, "Autor");
    await user.click(within(arkusz).getByRole("button", { name: "W prawo →" }));
    await waitFor(() => expect(actions.reorderFields).toHaveBeenCalled());

    arkusz = await otworzArkusz(user, "Autor");
    await user.click(within(arkusz).getByRole("button", { name: "Usuń kolumnę" }));
    await waitFor(() => expect(actions.deleteField).toHaveBeenCalledWith(autor.id));
  });

  it("kolumna tytułu: chipy typu i „Usuń kolumnę” wyłączone", async () => {
    const user = userEvent.setup();
    render(<PageTable block={stronaTestowa("books", "Books", BOOKS).blocks[0]} today={DZIS} />);
    const arkusz = await otworzArkusz(user, "Tytuł");
    expect(within(arkusz).getByRole("button", { name: "Liczba" })).toBeDisabled();
    expect(within(arkusz).getByRole("button", { name: "Usuń kolumnę" })).toBeDisabled();
  });
});
