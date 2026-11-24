import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Przechwytuje propsy każdego Popover.Content Radixa (dymek filtra idzie przez ActionPopover)
const zlapane = vi.hoisted(() => ({ propsy: [] as Record<string, unknown>[] }));
vi.mock("radix-ui", async (importOriginal) => {
  const oryginal = await importOriginal<typeof import("radix-ui")>();
  const Content = (props: Record<string, unknown>) => {
    zlapane.propsy.push(props);
    return <oryginal.Popover.Content {...(props as object)} />;
  };
  return { ...oryginal, Popover: { ...oryginal.Popover, Content } };
});

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
// Strony bez pola Sekret nie czytają stanu sejfu
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => ({ status: "ladowanie" }) }));
vi.mock("../actions", () => actions);

import { PageTable } from "./page-table";
import { DZIS, stronaTestowa, SUBSKRYPCJE } from "./test-page";

const BOOKS = [
  { Tytuł: "Atomic Habits", Autor: "James Clear", Status: "Czytam" },
  { Tytuł: "Deep Work", Autor: "Cal Newport", Status: "Przeczytane", Ocena: 4, Przeczytana: "2026-10-12" },
  { Tytuł: "Diuna", Autor: "Frank Herbert", Status: "Przeczytane", Ocena: 5, Przeczytana: "2026-06-15" },
  { Tytuł: "Sapiens", Autor: "Yuval Noah Harari", Status: "Przeczytane", Ocena: 3, Przeczytana: "2025-12-11" },
  { Tytuł: "Clean Code", Autor: "Robert C. Martin", Status: "Chcę przeczytać" },
];

// Tytuły widoczne w tabeli (bez nagłówka i stopki); tytuł wiersza siedzi w polu edycji
function tytuly() {
  return screen
    .getAllByRole("row")
    .slice(1, -1)
    .map((r) => (r.querySelector("td input") as HTMLInputElement | null)?.value);
}

async function otworzFiltr(user: ReturnType<typeof userEvent.setup>, nazwa = "Filtruj") {
  await user.click(screen.getByRole("button", { name: nazwa }));
  return screen.findByRole("dialog", { name: "Filtr" });
}

async function wybierz(user: ReturnType<typeof userEvent.setup>, kontrolka: string, opcja: RegExp | string) {
  await user.click(screen.getByRole("button", { name: kontrolka }));
  await user.click(within(screen.getByRole("listbox", { name: kontrolka })).getByRole("option", { name: opcja }));
}

describe("filtr tabeli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
  });

  it("pusty filtr: licznik „5 z 5 wierszy”, dopisek, przycisk bez liczby", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    expect(within(filtr).getByText("5 z 5 wierszy")).toBeInTheDocument();
    expect(within(filtr).getByText("Filtr zmienia tabelę i sumy. Nie wpływa na kalendarz.")).toBeInTheDocument();
    expect(within(filtr).getByRole("button", { name: "+ Dodaj warunek" })).toBeInTheDocument();
  });

  it("bez warunków pokazuje komunikat, po dodaniu warunku znika", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    expect(within(filtr).getByText("Brak warunków. Tabela pokazuje wszystkie wiersze.")).toBeInTheDocument();
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    expect(within(filtr).queryByText("Brak warunków. Tabela pokazuje wszystkie wiersze.")).toBeNull();
  });

  it("filtr przy prawej krawędzi otwiera się do środka: dymek filtra dostaje avoidCollisions i collisionPadding 8 px, wyrównanie do prawej", async () => {
    const user = userEvent.setup();
    zlapane.propsy.length = 0;
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    await otworzFiltr(user);
    const dymek = zlapane.propsy.find((p) => p["aria-label"] === "Filtr");
    expect(dymek?.avoidCollisions).toBe(true);
    expect(dymek?.collisionPadding).toBe(8);
    expect(dymek?.align).toBe("end");
  });

  it("wygląd COSS: dymek z paddingiem 14 px, wyzwalacz podświetlony, licznik jako plakietka, przyciski z kontrolki Button", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const wyzwalacz = screen.getByRole("button", { name: "Filtruj" });
    expect(wyzwalacz.className).not.toContain("bg-accent");
    const filtr = await otworzFiltr(user);
    expect(filtr.className).toContain("p-3.5");
    expect(wyzwalacz.className).toContain("bg-accent");
    expect(wyzwalacz.className).not.toContain("!bg-active");
    expect(within(filtr).getByText("5 z 5 wierszy").className).toContain("bg-muted");
    expect(within(filtr).getByText("Filtr zmienia tabelę i sumy. Nie wpływa na kalendarz.").className).not.toContain("font-mono");
    // „+ Dodaj warunek” i „Wyczyść”: wysokość 28 px (Button sm), „Zapisz jako domyślny”: wariant główny
    expect(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }).className).toContain("h-7");
    expect(within(filtr).getByRole("button", { name: "Wyczyść" }).className).toContain("bg-transparent");
    expect(within(filtr).getByRole("button", { name: "Zapisz jako domyślny" }).className).toContain("bg-primary");
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    // Etykieta „Gdzie” jak .lbl (12 px, 500), pole wartości jak FIELD (32 px), usuwanie jako ghost-icon
    expect(within(filtr).getByText("Gdzie").className).not.toContain("font-mono");
    expect(within(filtr).getByRole("textbox", { name: "Wartość warunku 1" }).className).toContain("h-8");
    const usun = within(filtr).getByRole("button", { name: "Usuń warunek" });
    expect(usun.className).toContain("bg-transparent");
    expect(usun.className).toContain("w-7");
    expect(usun.textContent).toBe("");
  });

  it("„+ Dodaj warunek” dodaje „Gdzie …”, tekst zawęża tabelę, licznik i przycisk się aktualizują", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    expect(within(filtr).getByText("Gdzie")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtruj · 1" })).toBeInTheDocument();
    await user.type(within(filtr).getByRole("textbox", { name: "Wartość warunku 1" }), "deep");
    expect(tytuly()).toEqual(["Deep Work"]);
    expect(within(filtr).getByText("1 z 5 wierszy")).toBeInTheDocument();
  });

  it("drugi warunek jest łączony „i”, ✕ go usuwa", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    expect(within(filtr).getByText("i")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtruj · 2" })).toBeInTheDocument();
    await user.click(within(filtr).getAllByRole("button", { name: "Usuń warunek" })[1]);
    expect(screen.getByRole("button", { name: "Filtruj · 1" })).toBeInTheDocument();
    expect(within(filtr).queryByText("i")).not.toBeInTheDocument();
  });

  it("Status: operatory „jest jednym z” / „jest puste”, wartość to chipy opcji", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    await wybierz(user, "Pole warunku 1", "Status");
    await user.click(screen.getByRole("button", { name: "Operator warunku 1" }));
    expect(
      within(screen.getByRole("listbox", { name: "Operator warunku 1" }))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["jest jednym z✓", "jest puste"]);
    await user.keyboard("{Escape}");
    const wartosc = within(filtr).getByRole("group", { name: "Wartość warunku 1" });
    await user.click(within(wartosc).getByRole("button", { name: "Przeczytane" }));
    expect(tytuly().sort()).toEqual(["Deep Work", "Diuna", "Sapiens"]);
    await user.click(within(wartosc).getByRole("button", { name: "Czytam" }));
    expect(within(filtr).getByText("4 z 5 wierszy")).toBeInTheDocument();
  });

  it("Ocena: operatory ≥ / ≤ i pole liczby z przecinkiem dziesiętnym", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    await wybierz(user, "Pole warunku 1", "Ocena");
    expect(within(filtr).getByRole("button", { name: "Operator warunku 1" }).textContent).toContain("≥");
    const liczba = within(filtr).getByRole("textbox", { name: "Wartość warunku 1" });
    expect(liczba).toHaveAttribute("inputmode", "decimal");
    await user.type(liczba, "3,5");
    expect(liczba).toHaveValue("3,5");
    expect(tytuly().sort()).toEqual(["Deep Work", "Diuna"]);
    await wybierz(user, "Operator warunku 1", "≤");
    await user.type(within(filtr).getByRole("textbox", { name: "Wartość warunku 1" }), "3");
    expect(tytuly()).toEqual(["Sapiens"]);
  });

  it("Data: operatory przed / po / jest puste i wybór daty", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    await wybierz(user, "Pole warunku 1", "Przeczytana");
    await user.click(screen.getByRole("button", { name: "Operator warunku 1" }));
    expect(
      within(screen.getByRole("listbox", { name: "Operator warunku 1" }))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["przed✓", "po", "jest puste"]);
    await user.keyboard("{Escape}");
    expect(within(filtr).getByRole("button", { name: "Wartość warunku 1" })).toBeInTheDocument();
    await wybierz(user, "Operator warunku 1", "jest puste");
    expect(within(filtr).queryByRole("button", { name: "Wartość warunku 1" })).not.toBeInTheDocument();
    expect(tytuly().sort()).toEqual(["Atomic Habits", "Clean Code"]);
  });

  it("karty i podsumowania liczą się z wierszy po filtrze", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    await wybierz(user, "Pole warunku 1", "Status");
    await user.click(within(within(filtr).getByRole("group", { name: "Wartość warunku 1" })).getByRole("button", { name: "Przeczytane" }));
    // Średnia ocena ze stopki: (4 + 5 + 3) / 3
    const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
    expect(within(stopka).getByText("śr. 4,0")).toBeInTheDocument();
    expect(screen.getByText("Czytam teraz", { selector: "div" }).parentElement?.textContent).toContain("0");
  });

  it("„Wyczyść” czyści filtr tylko w kliencie; „Zapisz jako domyślny” zapisuje settings.filters", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    const status = dane.blocks[0].fields.find((f) => f.name === "Status")!;
    const przeczytane = status.config.options!.find((o) => o.label === "Przeczytane")!;
    const zapisany = [{ field_id: status.id, op: "in", value: [przeczytane.id] }];
    (dane.blocks[0].content as { settings: { filters: unknown[] } }).settings.filters = zapisany;
    render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
    expect(tytuly().sort()).toEqual(["Deep Work", "Diuna", "Sapiens"]);

    const filtr = await otworzFiltr(user, "Filtruj · 1");
    expect(within(filtr).getByText("3 z 5 wierszy")).toBeInTheDocument();
    await user.click(within(filtr).getByRole("button", { name: "Wyczyść" }));
    expect(tytuly()).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Filtruj" })).toBeInTheDocument();
    expect(actions.saveTableSettings).not.toHaveBeenCalled();

    await user.click(within(filtr).getByRole("button", { name: "Zapisz jako domyślny" }));
    expect(actions.saveTableSettings).toHaveBeenCalledWith("blok-1", { filters: [] });
  });

  it("„Zapisz jako domyślny” zapisuje bieżące warunki, po odświeżeniu filtr dalej działa", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    const { rerender } = render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    await user.type(within(filtr).getByRole("textbox", { name: "Wartość warunku 1" }), "deep");
    await user.click(within(filtr).getByRole("button", { name: "Zapisz jako domyślny" }));
    const tytul = dane.blocks[0].fields.find((f) => f.name === "Tytuł")!;
    const zapisane = [{ field_id: tytul.id, op: "contains", value: "deep" }];
    expect(actions.saveTableSettings).toHaveBeenCalledWith("blok-1", { filters: zapisane });
    expect(tytuly()).toEqual(["Deep Work"]);

    // Odświeżone dane z serwera mają już zapisany filtr
    const odswiezone = stronaTestowa("books", "Books", BOOKS);
    (odswiezone.blocks[0].content as { settings: { filters: unknown[] } }).settings.filters = zapisane;
    rerender(<PageTable block={(odswiezone).blocks[0]} today={DZIS} />);
    await waitFor(() => expect(tytuly()).toEqual(["Deep Work"]));
    expect(screen.getByRole("button", { name: "Filtruj · 1" })).toBeInTheDocument();
  });

  describe("typy inteligentne", () => {
    it("Kwota cykliczna: operatory ≥ / ≤ / puste, wartość z dopiskiem „zł / mies.”, filtr po kwocie na miesiąc", async () => {
      const user = userEvent.setup();
      const dane = stronaTestowa("subscriptions", "Subscriptions", SUBSKRYPCJE);
      render(<PageTable block={dane.blocks[0]} today={DZIS} />);
      const filtr = await otworzFiltr(user);
      await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
      await wybierz(user, "Pole warunku 1", "Kwota cykliczna");
      await user.click(screen.getByRole("button", { name: "Operator warunku 1" }));
      expect(
        within(screen.getByRole("listbox", { name: "Operator warunku 1" })).getAllByRole("option").map((o) => o.textContent),
      ).toHaveLength(3);
      await user.keyboard("{Escape}");
      expect(within(filtr).getByText("zł / mies.")).toBeInTheDocument();
      // Strava 249,99 zł / rok = 20,83 zł / mies., Netflix 43, Disney+ 37,99: ≥ 40 zostawia tylko Netflix
      await user.type(within(filtr).getByRole("textbox", { name: "Wartość warunku 1" }), "40");
      expect(tytuly()).toEqual(["Netflix"]);
    });

    it("Data odnowienia: wartość to kalendarz jak dla daty, a filtr idzie po następnym odnowieniu", async () => {
      const user = userEvent.setup();
      const dane = stronaTestowa("subscriptions", "Subscriptions", SUBSKRYPCJE);
      render(<PageTable block={dane.blocks[0]} today={DZIS} />);
      const filtr = await otworzFiltr(user);
      await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
      await wybierz(user, "Pole warunku 1", "Data odnowienia");
      expect(within(filtr).getByRole("button", { name: "Operator warunku 1" })).toHaveTextContent("przed");
      expect(within(filtr).queryByRole("textbox", { name: "Wartość warunku 1" })).not.toBeInTheDocument();
      expect(within(filtr).getByRole("button", { name: "Wartość warunku 1" })).toBeInTheDocument();
      expect(within(filtr).queryByText("zł / mies.")).not.toBeInTheDocument();
    });
  });
});
