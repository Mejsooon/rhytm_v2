import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  addField: vi.fn(),
  addRow: vi.fn(),
  changeFieldType: vi.fn(),
  deleteField: vi.fn(),
  deleteRow: vi.fn(),
  reorderFields: vi.fn(),
  restoreRow: vi.fn(),
  updateField: vi.fn(),
  updateRow: vi.fn(),
}));
const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/strony/p1",
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("../../actions", () => actions);

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

describe("MEditor (telefon)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
    actions.addBlock.mockImplementation(async (_id: string, type: LoadedBlock["type"], text?: string) => ({
      ok: true,
      block: blok("srv-1", type, 0, type === "todo" ? { text: text ?? "", done: false } : { text: text ?? "" }),
    }));
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
    await user.click(screen.getByRole("button", { name: "Menu strony" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("★ Dodaj do ulubionych")).toBeTruthy();
    expect(within(menu).getByText("Zmień nazwę")).toBeTruthy();
    expect(within(menu).getByText("Usuń stronę")).toBeTruthy();
    await user.click(within(menu).getByText("★ Dodaj do ulubionych"));
    await waitFor(() => expect(actions.setFavorite).toHaveBeenCalledWith("p1", true));
  });

  it("tabela przewija się poziomo", () => {
    render(<EditorView data={dane([tabela()])} />);
    const wiersz = screen.getAllByRole("row")[0];
    expect(wiersz.parentElement!.className).toContain("overflow-x-auto");
  });

  it("nagłówek kolumny otwiera arkusz „Kolumna” z kontrolkami", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([tabela()])} />);
    await user.click(screen.getByRole("button", { name: "Kolumna Status — ustawienia" }));
    const arkusz = await screen.findByRole("dialog", { name: "Kolumna" });
    expect(within(arkusz).getByRole("textbox", { name: "Nazwa kolumny" })).toHaveProperty("value", "Status");
    expect(within(arkusz).getByText("Typ pola")).toBeTruthy();
    expect(within(arkusz).getByRole("button", { name: "Wybór" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(arkusz).getByRole("button", { name: "← W lewo" })).toBeTruthy();
    expect(within(arkusz).getByRole("button", { name: "W prawo →" })).toBeTruthy();
    expect(within(arkusz).getByRole("button", { name: "Usuń kolumnę" })).toBeTruthy();
    await user.click(within(arkusz).getByRole("button", { name: "Gotowe" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kolumna" })).toBeNull());
  });

  it("arkusz „Kolumna”: przesunięcie i usunięcie zapisują się, kolumna tytułowa się nie usuwa", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([tabela()])} />);
    await user.click(screen.getByRole("button", { name: "Kolumna Status — ustawienia" }));
    let arkusz = await screen.findByRole("dialog", { name: "Kolumna" });
    await user.click(within(arkusz).getByRole("button", { name: "← W lewo" }));
    await waitFor(() => expect(actions.reorderFields).toHaveBeenCalledWith("t1", ["f2", "f1"]));
    await user.click(within(arkusz).getByRole("button", { name: "Usuń kolumnę" }));
    await waitFor(() => expect(actions.deleteField).toHaveBeenCalledWith("f2"));

    await user.click(screen.getByRole("button", { name: "Kolumna Nazwa — ustawienia" }));
    arkusz = await screen.findByRole("dialog", { name: "Kolumna" });
    expect((within(arkusz).getByRole("button", { name: "Usuń kolumnę" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("stuknięcie komórki Wyboru przełącza opcje po kolei, po ostatniej pusta", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([tabela()])} />);
    const komorka = () => screen.getByRole("button", { name: /^Status: .*stuknij by zmienić$/ });
    expect(komorka().getAttribute("aria-label")).toBe("Status: brak, stuknij by zmienić");

    await user.click(komorka());
    expect(komorka().getAttribute("aria-label")).toBe("Status: Do zrobienia, stuknij by zmienić");
    await user.click(komorka());
    expect(komorka().getAttribute("aria-label")).toBe("Status: W toku, stuknij by zmienić");
    await user.click(komorka());
    expect(komorka().getAttribute("aria-label")).toBe("Status: Zrobione, stuknij by zmienić");
    await user.click(komorka());
    expect(komorka().getAttribute("aria-label")).toBe("Status: brak, stuknij by zmienić");

    await waitFor(() => expect(actions.updateRow).toHaveBeenCalledTimes(4));
    expect(actions.updateRow.mock.calls.map((c) => c[1])).toEqual([
      { f2: "o1" },
      { f2: "o2" },
      { f2: "o3" },
      { f2: null },
    ]);
  });
});
