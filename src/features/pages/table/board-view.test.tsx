import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  deleteRows: vi.fn(),
  restoreRows: vi.fn(),
  duplicateRows: vi.fn(),
  setRowsValue: vi.fn(),
}));
const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/strony/p1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../actions", () => actions);
const vault = vi.hoisted(() => ({ state: { status: "ladowanie" } as Record<string, unknown> }));
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => vault.state }));

import type { LoadedBlock } from "../load-page";
import type { TemplateKey } from "../templates";
import { PageTable } from "./page-table";
import { stronaTestowa } from "./test-page";

const TODAY = "2026-11-15";

const PROJECTS = [
  { Nazwa: "Projekt z baz danych — drony", Status: "W toku", Obszar: "Studia", Termin: "2026-11-20" },
  { Nazwa: "rhytm v3", Status: "W toku", Obszar: "Własne", Termin: "2026-12-15" },
  { Nazwa: "NetScope", Status: "Do zrobienia", Obszar: "Własne", Termin: "2027-02-15" },
  { Nazwa: "rhytm v2", Status: "Zrobione", Obszar: "Własne", Termin: "2026-11-13" },
];

// Blok z szablonu w układzie Tablica (ustawienia „Wszystkich”), z dodatkowymi ustawieniami
function blok(key: TemplateKey, wiersze: Record<string, unknown>[], ustawienia: Record<string, unknown> = {}): LoadedBlock {
  const b = stronaTestowa(key, "Strona", wiersze).blocks[0];
  return {
    ...b,
    content: {
      ...b.content,
      settings: { ...(b.content.settings as object), layout: "board", views: [], ...ustawienia },
    },
  };
}

function kolumna(nazwa: string) {
  return screen.getByRole("region", { name: nazwa });
}

function kolumny() {
  return screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
}

function kartaTablicy(tytul: string) {
  const k = screen.getAllByRole("article").find((a) => a.textContent?.includes(tytul));
  if (!k) throw new Error(`Brak karty ${tytul}`);
  return k;
}

describe("Tablica (kanban)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vault.state = { status: "ladowanie" };
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
    actions.addRow.mockImplementation(async (_b: string, values: Record<string, unknown>) => ({
      ok: true,
      row: { id: "srv-1", values, position: 99, deletedAt: null },
    }));
  });

  it("kolumny według pola tablicy szablonu: wszystkie opcje w kolejności pola, także puste; bez tabeli", () => {
    render(<PageTable block={blok("projects", PROJECTS)} today={TODAY} templateKey="projects" />);
    expect(kolumny()).toEqual(["W toku", "Do zrobienia", "Wstrzymane", "Zrobione"]);
    expect(screen.queryByRole("table")).toBeNull();
    // Liczba kart w nagłówku kolumny
    expect(within(kolumna("W toku")).getByText("2")).toBeInTheDocument();
    expect(within(kolumna("Wstrzymane")).getByText("0")).toBeInTheDocument();
    expect(within(kolumna("Wstrzymane")).queryAllByRole("article")).toHaveLength(0);
    expect(within(kolumna("W toku")).getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("Przeciągnij kartę do innej kolumny, żeby zmienić status.")).toBeInTheDocument();
  });

  it("„Bez wartości” na końcu tylko wtedy, gdy są wiersze bez wartości", () => {
    render(
      <PageTable
        block={blok("projects", [...PROJECTS, { Nazwa: "Chainlock", Obszar: "Własne" }])}
        today={TODAY}
        templateKey="projects"
      />,
    );
    expect(kolumny()).toEqual(["W toku", "Do zrobienia", "Wstrzymane", "Zrobione", "Bez wartości"]);
    expect(within(kolumna("Bez wartości")).getByText("Chainlock")).toBeInTheDocument();
  });

  it("grupowanie widoku po polu Wyboru wygrywa z polem tablicy szablonu", () => {
    const b = blok("projects", PROJECTS);
    const obszar = b.fields.find((f) => f.name === "Obszar")!;
    const zGrupa = { ...b, content: { ...b.content, settings: { ...(b.content.settings as object), group_by: obszar.id } } };
    render(<PageTable block={zGrupa} today={TODAY} templateKey="projects" />);
    expect(kolumny()).toEqual(["Studia", "Własne", "Klient", "Praca"]);
    expect(screen.getByText("Przeciągnij kartę do innej kolumny, żeby zmienić obszar.")).toBeInTheDocument();
  });

  it("bez szablonu: pierwsze pole Wyboru albo Statusu", () => {
    const b = blok("empty", []);
    const zPolem: LoadedBlock = {
      ...b,
      fields: [
        ...b.fields,
        { id: "f-kat", name: "Kategoria", type: "select", config: { options: [{ id: "o1", label: "Dom", color: "" }, { id: "o2", label: "Praca", color: "" }] }, position: 1, isTitle: false },
      ],
      rows: [{ id: "r1", values: { [b.fields[0].id]: "Zakupy", "f-kat": "o1" }, position: 0, deletedAt: null }],
    };
    render(<PageTable block={zPolem} today={TODAY} />);
    expect(kolumny()).toEqual(["Dom", "Praca"]);
    expect(within(kolumna("Dom")).getByText("Zakupy")).toBeInTheDocument();
  });

  it("bez pola Wyboru i Statusu: komunikat i przycisk dodania pola", async () => {
    const user = userEvent.setup();
    render(<PageTable block={blok("empty", [])} today={TODAY} />);
    expect(screen.queryAllByRole("region")).toHaveLength(0);
    expect(screen.getByText("Tablica potrzebuje pola Wybór albo Status.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Pole" }));
    // Okno „Nowe pole” (to samo co „+” w nagłówku tabeli)
    expect(screen.getByRole("textbox", { name: "Szukaj typu" })).toBeInTheDocument();
  });

  it("karta: tytuł i pola jak r.meta (plakietka opcji, data z „za N dni”), bez pola tablicy i ukrytych", () => {
    const b = blok("projects", PROJECTS);
    const repo = b.fields.find((f) => f.name === "Repo")!;
    const ukryte = { ...b, content: { ...b.content, settings: { ...(b.content.settings as object), hidden_field_ids: [repo.id] } } };
    render(<PageTable block={ukryte} today={TODAY} templateKey="projects" />);
    const k = kartaTablicy("Projekt z baz danych — drony");
    expect(within(k).getByText("Studia")).toBeInTheDocument();
    expect(within(k).getByText("20.11.2026 · za 5 dni")).toBeInTheDocument();
    // Pole tablicy (Status) nie powtarza się na karcie
    expect(within(k).queryByText("W toku")).toBeNull();
  });

  it("Hasła: karta bez sekretów i URL — tylko serwis i login", () => {
    vault.state = { status: "zablokowany" };
    const pola = [
      { id: "f-serwis", name: "Serwis", type: "text" as const, config: {}, position: 0, isTitle: true },
      { id: "f-login", name: "Login", type: "text" as const, config: {}, position: 1, isTitle: false },
      { id: "f-haslo", name: "Hasło", type: "secret" as const, config: {}, position: 2, isTitle: false },
      { id: "f-url", name: "URL", type: "url" as const, config: {}, position: 3, isTitle: false },
      { id: "f-kat", name: "Kategoria", type: "select" as const, config: { options: [{ id: "k1", label: "Praca", color: "" }] }, position: 4, isTitle: false },
      { id: "f-notatka", name: "Notatka", type: "secret" as const, config: {}, position: 5, isTitle: false },
    ];
    const hasla: LoadedBlock = {
      id: "blok-h",
      type: "table",
      position: 0,
      content: { name: "", settings: { layout: "board", views: [] } },
      fields: pola,
      rows: [
        {
          id: "r1",
          values: {
            "f-serwis": "GitHub",
            "f-login": "mejson",
            "f-haslo": { v: 1, g: 1, iv: "aaa", ct: "SZYFROGRAM" },
            "f-url": "github.com",
            "f-kat": "k1",
            "f-notatka": { v: 1, g: 1, iv: "bbb", ct: "NOTATKA" },
          },
          position: 0,
          deletedAt: null,
        },
      ],
    };
    render(<PageTable block={hasla} today={TODAY} module="passwords" templateKey="passwords" />);
    const k = kartaTablicy("GitHub");
    expect(within(k).getByText("mejson")).toBeInTheDocument();
    expect(k.textContent).not.toContain("github.com");
    expect(k.textContent).not.toContain("SZYFROGRAM");
    expect(k.textContent).not.toContain("NOTATKA");
    // Zamknięty sejf: bez przeciągania, „Dodaj” i menu karty
    expect(k).not.toHaveAttribute("draggable", "true");
    expect(screen.queryByRole("button", { name: "Dodaj" })).toBeNull();
    expect(within(k).queryByRole("button", { name: /Przenieś/ })).toBeNull();
  });

  it("przeciągnięcie karty do innej kolumny zmienia wartość pola tablicy", async () => {
    const b = blok("projects", PROJECTS);
    const status = b.fields.find((f) => f.name === "Status")!;
    const zrobione = status.config.options!.find((o) => o.label === "Zrobione")!;
    render(<PageTable block={b} today={TODAY} templateKey="projects" />);
    const k = kartaTablicy("NetScope");
    expect(k).toHaveAttribute("draggable", "true");
    fireEvent.dragStart(k);
    fireEvent.dragOver(kolumna("Zrobione"));
    fireEvent.drop(kolumna("Zrobione"));
    expect(within(kolumna("Zrobione")).getByText("NetScope")).toBeInTheDocument();
    await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-3", { [status.id]: zrobione.id }));
  });

  it("błąd zapisu po przeciągnięciu: karta wraca do swojej kolumny, toast błędu (Review Focus 4)", async () => {
    actions.updateRow.mockResolvedValue({ ok: false, error: "x" });
    render(<PageTable block={blok("projects", PROJECTS)} today={TODAY} templateKey="projects" />);
    fireEvent.dragStart(kartaTablicy("NetScope"));
    fireEvent.dragOver(kolumna("Zrobione"));
    fireEvent.drop(kolumna("Zrobione"));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(within(kolumna("Do zrobienia")).getByText("NetScope")).toBeInTheDocument());
    expect(within(kolumna("Zrobione")).queryByText("NetScope")).toBeNull();
  });

  it("upuszczenie w tej samej kolumnie niczego nie zapisuje", () => {
    render(<PageTable block={blok("projects", PROJECTS)} today={TODAY} templateKey="projects" />);
    fireEvent.dragStart(kartaTablicy("NetScope"));
    fireEvent.dragOver(kolumna("Do zrobienia"));
    fireEvent.drop(kolumna("Do zrobienia"));
    expect(actions.updateRow).not.toHaveBeenCalled();
  });

  it("klawiatura: menu karty „Przenieś do…” zmienia kolumnę", async () => {
    const user = userEvent.setup();
    const b = blok("projects", PROJECTS);
    const status = b.fields.find((f) => f.name === "Status")!;
    const wstrzymane = status.config.options!.find((o) => o.label === "Wstrzymane")!;
    render(<PageTable block={b} today={TODAY} templateKey="projects" />);
    await user.click(within(kartaTablicy("NetScope")).getByRole("button", { name: "Przenieś: NetScope" }));
    const menu = screen.getByRole("menu", { name: "Przenieś do…" });
    // Bez bieżącej kolumny
    expect(within(menu).queryByRole("menuitem", { name: "Do zrobienia" })).toBeNull();
    await user.click(within(menu).getByRole("menuitem", { name: "Wstrzymane" }));
    expect(within(kolumna("Wstrzymane")).getByText("NetScope")).toBeInTheDocument();
    await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-3", { [status.id]: wstrzymane.id }));
    // Wybór w menu nie otwiera arkusza karty
    expect(screen.queryByRole("dialog", { name: /NetScope/ })).toBeNull();
  });

  it("„Dodaj” w kolumnie tworzy wiersz z wartością tej kolumny", async () => {
    const user = userEvent.setup();
    const b = blok("projects", PROJECTS);
    const status = b.fields.find((f) => f.name === "Status")!;
    const wstrzymane = status.config.options!.find((o) => o.label === "Wstrzymane")!;
    render(<PageTable block={b} today={TODAY} templateKey="projects" />);
    await user.click(within(kolumna("Wstrzymane")).getByRole("button", { name: "Dodaj" }));
    await waitFor(() =>
      expect(actions.addRow).toHaveBeenCalledWith(b.id, expect.objectContaining({ [status.id]: wstrzymane.id })),
    );
    // Nowa karta stoi w kolumnie, a jej arkusz otwiera się od razu (jak edycja nazwy nowej karty w makiecie)
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const wKolumnie = screen.getByRole("region", { name: "Wstrzymane", hidden: true });
    expect(within(wKolumnie).getAllByRole("article", { hidden: true })).toHaveLength(1);
  });

  it("kliknięcie karty otwiera arkusz wiersza", async () => {
    const user = userEvent.setup();
    render(<PageTable block={blok("projects", PROJECTS)} today={TODAY} templateKey="projects" />);
    await user.click(within(kartaTablicy("NetScope")).getByRole("button", { name: "NetScope" }));
    expect(await screen.findByRole("dialog", { name: /NetScope/ })).toBeInTheDocument();
  });
});
