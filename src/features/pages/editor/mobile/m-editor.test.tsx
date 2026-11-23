import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  addBlock: vi.fn(),
  updateBlockContent: vi.fn(),
  deleteBlock: vi.fn(),
  restoreBlock: vi.fn(),
  renamePage: vi.fn(),
  setPageIcon: vi.fn(),
  setFavorite: vi.fn(),
  duplicatePage: vi.fn(),
  reorderPages: vi.fn(),
  deletePage: vi.fn(),
  restorePage: vi.fn(),
  countPageRows: vi.fn(),
  addField: vi.fn(),
  addRow: vi.fn(),
  changeFieldType: vi.fn(),
  deleteField: vi.fn(),
  deleteRow: vi.fn(),
  reorderFields: vi.fn(),
  restoreRow: vi.fn(),
  updateField: vi.fn(),
  updateRow: vi.fn(),
  saveTableSettings: vi.fn(),
}));
const { toast, refresh } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/strony/p1",
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("../../actions", () => actions);
// RowEdit / arkusz wiersza czytają stan sejfu (VaultProvider jest w powłoce aplikacji)
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => ({ status: "ladowanie" }) }));

import type { PageField } from "../../fields";
import type { LoadedBlock, LoadedPage } from "../../load-page";
import { EditorView } from "../editor-view";

function blok(id: string, type: LoadedBlock["type"], position: number, content = {}): LoadedBlock {
  return { id, type, position, content, fields: [], rows: [] };
}

function dane(bloki: LoadedBlock[]): LoadedPage {
  return {
    page: {
      id: "p1",
      title: "",
      icon: "▦",
      favorite: false,
      templateKey: null,
      position: 0,
      rowCount: 0,
      createdAt: "2026-11-19T10:00:00Z",
    },
    blocks: bloki,
    today: "2026-11-19",
    currency: "PLN",
  };
}

const OPCJE = [
  { id: "o1", label: "Do zrobienia", color: "#404040" },
  { id: "o2", label: "W toku", color: "#0070f3" },
  { id: "o3", label: "Zrobione", color: "#15803d" },
];

// Blok tabeli z kolumnami Nazwa (tytuł) i Status (Wybór) oraz jednym wierszem
function tabela(status: string | null = null): LoadedBlock {
  const pola: PageField[] = [
    { id: "f1", name: "Nazwa", type: "text", config: {}, position: 0, isTitle: true },
    { id: "f2", name: "Status", type: "status", config: { options: OPCJE }, position: 1, isTitle: false },
  ];
  return {
    id: "t1",
    type: "table",
    position: 0,
    content: { name: "" },
    fields: pola,
    rows: [{ id: "r1", values: { f1: "Zadanie", f2: status }, position: 0, deletedAt: null }],
  };
}

// Przycisk menu strony w nagłówku telefonu (web ma własny w okruszkach)
function menuTelefonu() {
  const przycisk = screen
    .getAllByRole("button", { name: "Menu strony" })
    .find((b) => b.closest("header")?.className.includes("min-[800px]:hidden"));
  if (!przycisk) throw new Error("Brak menu strony na telefonie");
  return przycisk;
}

describe("MEditor (telefon)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
    actions.addBlock.mockImplementation(async (_id: string, type: LoadedBlock["type"], text?: string) => ({
      ok: true,
      block: blok("srv-1", type, 0, type === "todo" ? { text: text ?? "", done: false } : { text: text ?? "" }),
    }));
  });
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("pusty edytor pokazuje podpowiedź", () => {
    render(<EditorView data={dane([])} />);
    expect(screen.getByText("Stuknij „+” na dole albo wpisz „/”, żeby wstawić blok.")).toBeTruthy();
  });

  it("pasek skrótów leży nad paskiem zakładek, a przyciski mają min. 44 px", () => {
    render(<EditorView data={dane([])} />);
    const pasek = screen.getByRole("button", { name: "Wstaw tabelę" }).parentElement!;
    expect(pasek.className).toContain("bottom-(--tabbar-h)");
    for (const nazwa of ["Wstaw tabelę", "Wstaw zadanie", "Wstaw nagłówek"]) {
      expect(screen.getByRole("button", { name: nazwa }).className).toContain("size-11");
    }
  });

  it("„+” otwiera arkusz „Wstaw blok” z 5 pozycjami i zamyka go krzyżykiem", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    expect(screen.queryByRole("dialog", { name: "Wstaw blok" })).toBeNull();
    // Pierwszy przycisk to „+” z linii poleceń weba, ostatni to „+” paska telefonu
    const plusy = screen.getAllByRole("button", { name: "Wstaw blok" });
    await user.click(plusy[plusy.length - 1]);
    const arkusz = screen.getByRole("dialog", { name: "Wstaw blok" });
    for (const nazwa of ["Tabela", "Lista zadań", "Nagłówek", "Tekst", "Separator"]) {
      expect(within(arkusz).getByText(nazwa)).toBeTruthy();
    }
    expect(within(arkusz).getAllByRole("button").length).toBe(5 + 1);
    await user.click(within(arkusz).getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog", { name: "Wstaw blok" })).toBeNull();
  });

  it("„+” przenosi fokus do arkusza, Tab zostaje w arkuszu, a Esc go zamyka", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    const plusy = screen.getAllByRole("button", { name: "Wstaw blok" });
    await user.click(plusy[plusy.length - 1]);
    const arkusz = screen.getByRole("dialog", { name: "Wstaw blok" });
    expect(arkusz.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 12; i++) {
      await user.tab();
      expect(arkusz.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Wstaw blok" })).toBeNull();
  });

  it("Esc zamyka arkusz otwarty przez „/” i czyści pole", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    const pole = screen.getByRole("textbox", { name: "Nowy blok" });
    await user.type(pole, "/ta");
    // Fokus został w polu, więc pisanie dalej filtruje
    expect(document.activeElement).toBe(pole);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Wstaw blok" })).toBeNull();
    expect((pole as HTMLInputElement).value).toBe("");
  });

  it("wpisanie „/” w polu poleceń otwiera arkusz, filtruje i pokazuje „Brak bloku”", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    const pole = screen.getByRole("textbox", { name: "Nowy blok" });
    await user.type(pole, "/");
    expect(screen.getByRole("dialog", { name: "Wstaw blok" })).toBeTruthy();
    await user.type(pole, "tab");
    const arkusz = screen.getByRole("dialog", { name: "Wstaw blok" });
    expect(within(arkusz).getByText("Tabela")).toBeTruthy();
    expect(within(arkusz).queryByText("Tekst")).toBeNull();
    await user.clear(pole);
    await user.type(pole, "/xyz");
    expect(screen.getByText("Brak bloku „xyz”")).toBeTruthy();
  });

  it("wybór pozycji w arkuszu wstawia blok i zamyka arkusz", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    await user.type(screen.getByRole("textbox", { name: "Nowy blok" }), "/");
    await user.click(within(screen.getByRole("dialog", { name: "Wstaw blok" })).getByText("Separator"));
    await waitFor(() => expect(actions.addBlock).toHaveBeenCalledWith("p1", "divider", undefined));
    expect(screen.queryByRole("dialog", { name: "Wstaw blok" })).toBeNull();
  });

  it("ikony paska wstawiają tabelę, zadanie i nagłówek", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    await user.click(screen.getByRole("button", { name: "Wstaw tabelę" }));
    await user.click(screen.getByRole("button", { name: "Wstaw zadanie" }));
    await user.click(screen.getByRole("button", { name: "Wstaw nagłówek" }));
    await waitFor(() => expect(actions.addBlock).toHaveBeenCalledTimes(3));
    expect(actions.addBlock.mock.calls.map((c) => c[1])).toEqual(["table", "todo", "heading"]);
  });

  it("licznik bloków odmienia się po polsku", () => {
    const { rerender } = render(<EditorView data={dane([blok("a", "divider", 0)])} />);
    expect(screen.getByText("1 blok")).toBeTruthy();
    rerender(<EditorView data={dane([blok("a", "divider", 0), blok("b", "divider", 1)])} />);
    expect(screen.getByText("2 bloki")).toBeTruthy();
    rerender(
      <EditorView
        data={dane(["a", "b", "c", "d", "e"].map((id, i) => blok(id, "divider", i)))}
      />,
    );
    expect(screen.getByText("5 bloków")).toBeTruthy();
  });

  it("menu strony jest dostępne na telefonie z pozycją Ulubione", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    await user.click(menuTelefonu());
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Dodaj do ulubionych")).toBeTruthy();
    expect(within(menu).getByText("Zmień nazwę")).toBeTruthy();
    expect(within(menu).getByText("Usuń stronę")).toBeTruthy();
    await user.click(within(menu).getByText("Dodaj do ulubionych"));
    await waitFor(() => expect(actions.setFavorite).toHaveBeenCalledWith("p1", true));
  });

  it("menu strony dostaje całą listę stron, więc „Przenieś wyżej” działa", async () => {
    const user = userEvent.setup();
    const d = dane([]);
    const inna = { ...d.page, id: "p0", title: "Inbox", position: 0 };
    render(<EditorView data={d} pages={[inna, { ...d.page, position: 1 }]} />);
    await user.click(menuTelefonu());
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("button", { name: "Przenieś niżej" })).toBeDisabled();
    await user.click(within(menu).getByRole("button", { name: "Przenieś wyżej" }));
    await waitFor(() => expect(actions.reorderPages).toHaveBeenCalledWith(["p1", "p0"]));
  });

  it("tabela przewija się poziomo", () => {
    render(<EditorView data={dane([tabela()])} />);
    const siatka = screen.getByRole("table");
    // Kontener przewija się poziomo, a siatka ma szerokość sumy kolumn (tytuł 300 + status 180) plus 56 px
    expect(siatka.parentElement!.className).toContain("overflow-x-auto");
    expect(siatka.style.width).toBe("536px");
    expect(siatka.style.minWidth).toBe("100%");
  });

  it("stuknięcie wiersza tabeli otwiera arkusz wiersza; zapis zmienia wiersz", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const user = userEvent.setup();
    render(<EditorView data={dane([tabela()])} />);
    // Tytuł w tabeli to pole komórki; dotknięcie na telefonie otwiera arkusz
    await user.click(screen.getByDisplayValue("Zadanie"));
    const arkusz = await screen.findByRole("dialog", { name: "Zadanie" });
    await user.type(within(arkusz).getByRole("textbox", { name: "Nazwa" }), "!");
    await user.click(within(arkusz).getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("r1", expect.objectContaining({ f1: "Zadanie!" })));
  });

  it("„Cofnij” po usunięciu tabeli odświeża dane, więc wraca tabela z wierszami z tej sesji", async () => {
    const user = userEvent.setup();
    const t = tabela();
    const { rerender } = render(<EditorView data={dane([t])} />);
    const stopka = () => screen.getAllByRole("row").at(-1) as HTMLElement;
    expect(within(stopka()).getByText("1 wiersz")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Usuń blok" }));
    await waitFor(() => expect(actions.deleteBlock).toHaveBeenCalledWith("t1"));
    const akcja = toast.mock.calls.find((c) => c[0] === "Usunięto")![1].action.onClick as () => Promise<void>;
    await act(async () => {
      await akcja();
    });
    expect(actions.restoreBlock).toHaveBeenCalledWith("t1");
    expect(refresh).toHaveBeenCalledTimes(1);

    // Świeże dane z serwera (po router.refresh) zastępują kopię z chwili wczytania strony
    const zSerwera = {
      ...t,
      rows: [...t.rows, { id: "r2", values: { f1: "Nowe" }, position: 1, deletedAt: null }],
    };
    rerender(<EditorView data={dane([zSerwera])} />);
    expect(within(stopka()).getByText("2 wiersze")).toBeTruthy();
  });

  it("„Cofnij” po usunięciu bloku tekstu nie odświeża danych", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([blok("a", "text", 0, { text: "Ala" })])} />);
    await user.click(screen.getByRole("button", { name: "Usuń blok" }));
    await waitFor(() => expect(actions.deleteBlock).toHaveBeenCalledWith("a"));
    const akcja = toast.mock.calls.find((c) => c[0] === "Usunięto")![1].action.onClick as () => Promise<void>;
    await act(async () => {
      await akcja();
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
