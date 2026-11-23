import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toast, addBlock, updateBlockContent, deleteBlock, restoreBlock, renamePage, setPageIcon } =
  vi.hoisted(() => ({
    toast: Object.assign(vi.fn(), { error: vi.fn() }),
    addBlock: vi.fn(),
    updateBlockContent: vi.fn(),
    deleteBlock: vi.fn(),
    restoreBlock: vi.fn(),
    renamePage: vi.fn(),
    setPageIcon: vi.fn(),
  }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/strony/p1",
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));
// Akcje tabeli (PageTable) — wszystkie udane
const tabelowe = vi.hoisted(() => ({
  addField: vi.fn(),
  addRow: vi.fn(),
  changeFieldType: vi.fn(),
  deleteField: vi.fn(),
  updateField: vi.fn(),
  deleteRow: vi.fn(),
  restoreRow: vi.fn(),
  saveTableSettings: vi.fn(),
  updateRow: vi.fn(),
  reorderFields: vi.fn(),
}));
vi.mock("../actions", () => ({
  addBlock,
  updateBlockContent,
  deleteBlock,
  restoreBlock,
  renamePage,
  setPageIcon,
  ...tabelowe,
}));
// RowEdit czyta stan sejfu (VaultProvider jest w powłoce aplikacji); tabele bez Sekretu go nie używają
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => ({ status: "ladowanie" }) }));

import type { LoadedBlock, LoadedPage } from "../load-page";
import { buildTemplateBlocks } from "../templates";
import { stronaTestowa } from "../table/test-page";
import { EditorView } from "./editor-view";

function blok(id: string, type: LoadedBlock["type"], position: number, content = {}): LoadedBlock {
  return { id, type, position, content, fields: [], rows: [] };
}

function dane(bloki: LoadedBlock[], title = "", icon = ""): LoadedPage {
  return {
    page: {
      id: "p1",
      title,
      icon,
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

describe("EditorView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renamePage.mockResolvedValue({ ok: true });
    updateBlockContent.mockResolvedValue({ ok: true });
    deleteBlock.mockResolvedValue({ ok: true });
    restoreBlock.mockResolvedValue({ ok: true });
    setPageIcon.mockResolvedValue({ ok: true });
    for (const a of Object.values(tabelowe)) a.mockResolvedValue({ ok: true });
    addBlock.mockImplementation(async (_id: string, type: LoadedBlock["type"], text?: string) => ({
      ok: true,
      block: blok("srv-1", type, 0, type === "todo" ? { text: text ?? "", done: false } : { text: text ?? "" }),
    }));
  });

  it("zmiana tytułu od razu zmienia ścieżkę i zapisuje się po utracie fokusu", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    expect(screen.getAllByText("Bez tytułu").length).toBeGreaterThan(0);
    const pole = screen.getByRole("textbox", { name: "Nazwa strony" });
    await user.type(pole, "Plan");
    expect(screen.getAllByRole("heading", { level: 1, name: "Plan" }).length).toBeGreaterThan(0);
    expect(renamePage).not.toHaveBeenCalled();
    await user.tab();
    await waitFor(() => expect(renamePage).toHaveBeenCalledWith("p1", "Plan"));
  });

  it("przycisk ikony (przerywana ramka bez ikony) otwiera IconPicker; wybór zapisuje setPageIcon, błąd cofa", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    const przycisk = screen.getByRole("button", { name: "Zmień ikonę" });
    expect(przycisk.className).toContain("border-dashed");
    expect(przycisk).toHaveClass("rounded-[10px]", "bg-panel");
    await user.click(przycisk);
    expect(screen.getByRole("group", { name: "Wybór ikony" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Szukaj ikony" }), "ksiazki");
    await user.click(screen.getByRole("button", { name: "book-open" }));
    expect(setPageIcon).toHaveBeenCalledWith("p1", "lucide:book-open");
    expect(screen.getByRole("button", { name: "Zmień ikonę" }).querySelector("[data-page-icon]")).toHaveAttribute("data-page-icon", "book-open");
    expect(screen.getByRole("button", { name: "Zmień ikonę" }).className).not.toContain("border-dashed");

    setPageIcon.mockResolvedValue({ ok: false, message: "x" });
    await user.click(screen.getByRole("button", { name: "Zmień ikonę" }));
    await user.click(screen.getByRole("button", { name: "Usuń" }));
    expect(setPageIcon).toHaveBeenLastCalledWith("p1", "");
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Zmień ikonę" }).querySelector("[data-page-icon]")).toHaveAttribute("data-page-icon", "book-open");
  });

  it("pusty tytuł pokazuje w ścieżce „Bez tytułu”", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([], "Plan")} />);
    await user.clear(screen.getByRole("textbox", { name: "Nazwa strony" }));
    expect(screen.getAllByRole("heading", { level: 1, name: "Bez tytułu" }).length).toBeGreaterThan(0);
  });

  it("błąd zmiany tytułu przywraca poprzedni i pokazuje toast", async () => {
    const user = userEvent.setup();
    renamePage.mockResolvedValue({ ok: false, message: "x" });
    render(<EditorView data={dane([], "Plan")} />);
    const pole = screen.getByRole("textbox", { name: "Nazwa strony" });
    await user.type(pole, "2");
    await user.tab();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
    expect(pole).toHaveValue("Plan");
  });

  it("„/” otwiera menu, ↓↓ Enter wstawia trzecią pozycję (Nagłówek)", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    await user.type(screen.getByRole("combobox", { name: "Nowy blok" }), "/");
    expect(screen.getAllByRole("option")).toHaveLength(5);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await waitFor(() => expect(addBlock).toHaveBeenCalledWith("p1", "heading", undefined));
    expect(screen.queryByRole("listbox", { name: "Bloki" })).toBeNull();
    expect(await screen.findByRole("textbox", { name: "Nagłówek" })).toBeInTheDocument();
  });

  it("menu „/” ma klasy .pop i obsługuje strzałki/Enter/Esc", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    await user.type(screen.getByRole("combobox", { name: "Nowy blok" }), "/");
    const menu = screen.getByRole("listbox", { name: "Bloki" });
    // .pop: promień 12 px, ramka border, cień lg, padding 4 px, szerokość 330 px
    expect(menu).toHaveClass("rounded-xl", "border-border", "shadow-lg", "p-1", "w-[330px]");
    const pozycje = screen.getAllByRole("option");
    // MENU_ITEM: aktywna pozycja ma tło accent (aria-selected), wysokość 44 px
    expect(pozycje[0]).toHaveClass("min-h-11", "rounded-sm");
    expect(pozycje[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(pozycje[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(pozycje[0]).toHaveAttribute("aria-selected", "true");
    // Stopka ze skrótami jako .kbd
    expect(menu.querySelectorAll("kbd")).toHaveLength(4);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Bloki" })).toBeNull();
    await user.clear(screen.getByRole("combobox", { name: "Nowy blok" }));
    await user.type(screen.getByRole("combobox", { name: "Nowy blok" }), "/");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(addBlock).toHaveBeenCalledWith("p1", "table", undefined));
  });

  it("pola edytora mają styl .ed-in, a blok ma prawy odstęp 36 px i kosz jak .btng.xs", () => {
    const { container } = render(
      <EditorView
        data={dane([
          blok("a", "text", 0, { text: "Ala" }),
          blok("z", "todo", 1, { text: "Kup", done: false }),
          blok("d", "divider", 2),
        ])}
      />,
    );
    for (const nazwa of ["Akapit", "Zadanie", "Nowy blok"]) {
      expect(screen.getByRole(nazwa === "Nowy blok" ? "combobox" : "textbox", { name: nazwa })).toHaveClass(
        "rounded-md",
        "focus-visible:bg-black/[.02]",
        "focus-visible:shadow-focus",
      );
    }
    expect(screen.getByRole("combobox", { name: "Nowy blok" })).toHaveClass("text-soft-foreground");
    expect(screen.getAllByRole("button", { name: "Usuń blok" })[0].parentElement).toHaveClass("pr-9");
    expect(screen.getAllByRole("button", { name: "Usuń blok" })[0]).toHaveClass("w-6", "h-6", "rounded-[8px]");
    // Separator: linia 1 px w kolorze border
    expect(container.querySelector("hr")).toHaveClass("h-px", "bg-border");
    // Przycisk „+” to ikona w .btn.ic.sm
    expect(screen.getAllByRole("button", { name: "Wstaw blok" })[0]).toHaveClass("w-7", "border-input");
  });

  it("Esc zamyka menu", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    await user.type(screen.getByRole("combobox", { name: "Nowy blok" }), "/");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Bloki" })).toBeNull();
  });

  it("„/tab” zostawia Tabelę, a wstawiona tabela ma pole nazwy z placeholderem „Tabela bez nazwy”", async () => {
    const user = userEvent.setup();
    addBlock.mockResolvedValue({ ok: true, block: blok("t1", "table", 0, { name: "" }) });
    render(<EditorView data={dane([])} />);
    await user.type(screen.getByRole("combobox", { name: "Nowy blok" }), "/tab");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(addBlock).toHaveBeenCalledWith("p1", "table", undefined));
    const nazwa = await screen.findByRole("textbox", { name: "Nazwa tabeli" });
    expect(nazwa).toHaveAttribute("placeholder", "Tabela bez nazwy");
  });

  it("Enter na zwykłym tekście wstawia akapit na końcu i czyści pole", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([blok("a", "text", 0, { text: "Pierwszy" })])} />);
    const pole = screen.getByRole("combobox", { name: "Nowy blok" });
    await user.type(pole, "Hej{Enter}");
    await waitFor(() => expect(addBlock).toHaveBeenCalledWith("p1", "text", "Hej"));
    expect(pole).toHaveValue("");
    const akapity = await screen.findAllByRole("textbox", { name: "Akapit" });
    expect(akapity.map((a) => (a as HTMLTextAreaElement).value)).toEqual(["Pierwszy", "Hej"]);
  });

  it("pusta strona pokazuje chipy i link do szablonów; po pierwszym bloku znikają", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([])} />);
    expect(screen.getByText("albo zacznij od:")).toBeInTheDocument();
    for (const n of ["Tabela", "Lista zadań", "Nagłówek", "Tekst"]) {
      expect(screen.getByRole("button", { name: new RegExp(n) })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Użyj szablonu →" })).toHaveAttribute("href", "/strony/nowa");
    // Podpowiedź i link bez czcionki mono, link jak w makiecie (foreground, 500)
    expect(screen.getByText("albo zacznij od:")).not.toHaveClass("font-mono");
    expect(screen.getByRole("link", { name: "Użyj szablonu →" })).toHaveClass("font-medium", "text-foreground");
    await user.click(screen.getByRole("button", { name: /Tekst/ }));
    await waitFor(() => expect(screen.queryByText("albo zacznij od:")).toBeNull());
    expect(screen.queryByText(/Wolisz gotowca/)).toBeNull();
  });

  it("lista zadań: checkbox przekreśla tekst i zapisuje {text, done}", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([blok("z", "todo", 0, { text: "Kup mleko", done: false })])} />);
    const tekst = screen.getByRole("textbox", { name: "Zadanie" });
    expect(tekst).not.toHaveClass("line-through");
    await user.click(screen.getByRole("checkbox", { name: "Zrobione" }));
    expect(tekst).toHaveClass("line-through");
    await waitFor(() =>
      expect(updateBlockContent).toHaveBeenCalledWith("z", { text: "Kup mleko", done: true }),
    );
  });

  it("tekst zapisuje się po utracie fokusu, tylko gdy się zmienił", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([blok("a", "text", 0, { text: "Ala" })])} />);
    const akapit = screen.getByRole("textbox", { name: "Akapit" });
    await user.click(akapit);
    await user.tab();
    expect(updateBlockContent).not.toHaveBeenCalled();
    await user.click(akapit);
    await user.type(akapit, " ma kota");
    await user.tab();
    await waitFor(() => expect(updateBlockContent).toHaveBeenCalledWith("a", { text: "Ala ma kota" }));
  });

  it("kosz bloku usuwa go i pokazuje toast „Usunięto” z akcją „Cofnij”", async () => {
    const user = userEvent.setup();
    render(<EditorView data={dane([blok("a", "text", 0, { text: "Ala" }), blok("b", "divider", 1)])} />);
    await user.click(screen.getAllByRole("button", { name: "Usuń blok" })[0]);
    await waitFor(() => expect(deleteBlock).toHaveBeenCalledWith("a"));
    expect(screen.queryByRole("textbox", { name: "Akapit" })).toBeNull();
    expect(toast).toHaveBeenCalledWith("Usunięto", expect.objectContaining({
      action: expect.objectContaining({ label: "Cofnij" }),
    }));

    // „Cofnij” przywraca blok na jego pozycję
    const akcja = toast.mock.calls[0][1].action.onClick as () => Promise<void>;
    await act(async () => {
      await akcja();
    });
    expect(restoreBlock).toHaveBeenCalledWith("a");
    expect(screen.getByRole("textbox", { name: "Akapit" })).toBeInTheDocument();
  });

  it("błąd usunięcia przywraca blok i pokazuje toast błędu", async () => {
    const user = userEvent.setup();
    deleteBlock.mockResolvedValue({ ok: false, message: "x" });
    render(<EditorView data={dane([blok("a", "text", 0, { text: "Ala" })])} />);
    await user.click(screen.getByRole("button", { name: "Usuń blok" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("textbox", { name: "Akapit" })).toBeInTheDocument();
  });

  it("bloki renderują się w kolejności position", () => {
    render(
      <EditorView
        data={dane([
          blok("c", "text", 2, { text: "trzeci" }),
          blok("a", "text", 0, { text: "pierwszy" }),
          blok("b", "text", 1, { text: "drugi" }),
        ])}
      />,
    );
    const wartosci = screen
      .getAllByRole("textbox", { name: "Akapit" })
      .map((a) => (a as HTMLTextAreaElement).value);
    expect(wartosci).toEqual(["pierwszy", "drugi", "trzeci"]);
  });

  it("błąd zapisu cofa wstawiony blok i pokazuje toast błędu", async () => {
    const user = userEvent.setup();
    addBlock.mockResolvedValue({ ok: false, message: "x" });
    render(<EditorView data={dane([])} />);
    await user.type(screen.getByRole("combobox", { name: "Nowy blok" }), "Hej{Enter}");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."),
    );
    expect(screen.queryByRole("textbox", { name: "Akapit" })).toBeNull();
  });

  it("odświeżenie danych w trakcie dodawania nie gubi bloku", async () => {
    const user = userEvent.setup();
    let zakoncz: (v: unknown) => void = () => {};
    addBlock.mockImplementation(() => new Promise((r) => (zakoncz = r)));
    const { rerender } = render(<EditorView data={dane([])} />);
    await user.type(screen.getByRole("combobox", { name: "Nowy blok" }), "Hej{Enter}");
    expect(await screen.findByRole("textbox", { name: "Akapit" })).toBeInTheDocument();

    // Nowe dane z serwera (np. po renamePage) bez nowego bloku
    rerender(<EditorView data={dane([], "Nowy")} />);
    expect(screen.getByRole("textbox", { name: "Akapit" })).toBeInTheDocument();

    await act(async () => {
      zakoncz({ ok: true, block: blok("srv-9", "text", 0, { text: "Hej" }) });
    });
    const akapity = screen.getAllByRole("textbox", { name: "Akapit" });
    expect(akapity).toHaveLength(1);
    expect((akapity[0] as HTMLTextAreaElement).value).toBe("Hej");
  });

  it("odświeżenie danych, które już zawierają zapisany blok, nie dubluje go", async () => {
    const user = userEvent.setup();
    let zakoncz: (v: unknown) => void = () => {};
    addBlock.mockImplementation(() => new Promise((r) => (zakoncz = r)));
    const { rerender } = render(<EditorView data={dane([])} />);
    await user.type(screen.getByRole("combobox", { name: "Nowy blok" }), "Hej{Enter}");
    rerender(<EditorView data={dane([blok("srv-9", "text", 0, { text: "Hej" })])} />);
    await act(async () => {
      zakoncz({ ok: true, block: blok("srv-9", "text", 0, { text: "Hej" }) });
    });
    expect(screen.getAllByRole("textbox", { name: "Akapit" })).toHaveLength(1);
  });

  it("błąd updateBlockContent przywraca poprzednią treść i pokazuje toast", async () => {
    const user = userEvent.setup();
    updateBlockContent.mockResolvedValue({ ok: false, message: "x" });
    render(<EditorView data={dane([blok("a", "text", 0, { text: "Ala" })])} />);
    const akapit = screen.getByRole("textbox", { name: "Akapit" });
    await user.type(akapit, " ma kota");
    await user.tab();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
    await waitFor(() => expect(akapit).toHaveValue("Ala"));
  });

  it("wiersz zadania ma na telefonie min. 44 px i obszar dotyku 44 px przełączający zadanie", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <EditorView data={dane([blok("z", "todo", 0, { text: "Kup", done: false })])} />,
    );
    expect(container.querySelector(".max-\\[799px\\]\\:min-h-11")).not.toBeNull();
    const trafienie = screen.getByTestId("todo-hit");
    expect(trafienie).toHaveClass("size-11");
    await user.click(trafienie);
    expect(updateBlockContent).toHaveBeenCalledWith("z", { text: "Kup", done: true });
  });
  it("nagłówek web ma okruszki i menu strony „⋯”; „Szablony” tylko przy pustej stronie (S2EmptyPage)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<EditorView data={dane([], "Bez tytułu")} />);
    const pustyNaglowek = screen.getAllByRole("banner")[0];
    expect(within(pustyNaglowek).getByRole("link", { name: "Szablony" })).toHaveAttribute("href", "/strony/nowa");
    unmount();
    render(<EditorView data={dane([blok("t", "text", 0, { text: "Notatka" })], "Books")} />);
    const naglowek = screen.getAllByRole("banner")[0];
    expect(naglowek.textContent).toContain("Strony");
    expect(within(naglowek).getByRole("heading", { level: 1, name: "Books" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Szablony" })).toBeNull();
    const menu = within(naglowek).getByRole("button", { name: "Menu strony" });
    // .btn.ic: kwadratowy przycisk 32 px
    expect(menu).toHaveClass("size-8", "border-input");
    await user.click(menu);
    expect(await screen.findByRole("menu", { name: "Strona Books" })).toBeInTheDocument();
  });

  it("strona z szablonu Books pokazuje blok tekstu i tabelę z kartami", () => {
    let n = 0;
    const [tekst, tabela] = buildTemplateBlocks("books", () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`);
    const d = stronaTestowa("books", "Books", [{ Tytuł: "Diuna", Status: "Czytam" }]);
    const bloki: LoadedBlock[] = [
      { id: tekst.id, type: "text", position: 0, content: tekst.content, fields: [], rows: [] },
      { ...d.blocks[0], id: tabela.id, position: 1 },
    ];
    render(<EditorView data={{ ...d, blocks: bloki }} />);
    expect(screen.getByRole("textbox", { name: "Akapit" })).toHaveValue("Co czytam, co przeczytałem i co chcę przeczytać.");
    expect(screen.getByTestId("przypiete-karty").children).toHaveLength(3);
    expect(screen.getByRole("textbox", { name: "Nazwa tabeli" })).toHaveValue("Books");
    expect(screen.getByRole("row", { name: /Diuna/ })).toBeInTheDocument();
  });

  it("dwie tabele: ukrycie kolumny i filtr działają tylko w swoim bloku (Review Focus 2)", async () => {
    const user = userEvent.setup();
    const ksiazki = [
      { Tytuł: "Diuna", Autor: "Frank Herbert", Status: "Czytam" },
      { Tytuł: "Deep Work", Autor: "Cal Newport", Status: "Przeczytane" },
    ];
    const d = stronaTestowa("books", "Books", ksiazki);
    // Te same pola w obu blokach (to samo id pól) — stan musi i tak zostać przy swoim bloku
    const pierwsza = { ...d.blocks[0], id: "t1", position: 0 };
    const druga = { ...d.blocks[0], id: "t2", position: 1, content: { ...d.blocks[0].content, name: "Druga" } };
    render(<EditorView data={{ ...d, blocks: [pierwsza, druga] }} />);
    const tabela = (i: number) => screen.getAllByRole("table")[i];
    const naglowki = (i: number) => within(tabela(i)).getAllByRole("columnheader").map((h) => h.textContent);
    const tytuly = (i: number) =>
      within(tabela(i)).getAllByRole("row").slice(1, -1).map((r) => (r.querySelector("td input") as HTMLInputElement | null)?.value);
    const naglowkiDrugiej = naglowki(1);

    // Ukrycie „Autor” w pierwszej tabeli
    await user.click(within(within(tabela(0)).getByRole("columnheader", { name: /Autor/ })).getByRole("button", { name: /Autor/ }));
    await user.click(within(screen.getByRole("menu", { name: "Kolumna Autor" })).getByRole("menuitem", { name: "Ukryj kolumnę" }));
    expect(tabelowe.saveTableSettings).toHaveBeenCalledWith("t1", { hidden_field_ids: [expect.any(String)] });
    expect(within(tabela(0)).queryByRole("columnheader", { name: /Autor/ })).toBeNull();
    expect(naglowki(1)).toEqual(naglowkiDrugiej);

    // Filtr w drugiej tabeli
    await user.click(screen.getAllByRole("button", { name: "Filtruj" })[1]);
    const filtr = await screen.findByRole("dialog", { name: "Filtr" });
    await user.click(within(filtr).getByRole("button", { name: "+ Dodaj warunek" }));
    await user.type(within(filtr).getByRole("textbox", { name: "Wartość warunku 1" }), "deep");
    expect(tytuly(1)).toEqual(["Deep Work"]);
    expect(tytuly(0)).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Filtruj/ }).map((b) => b.textContent)).toEqual(["Filtruj", "Filtruj · 1"]);
  });
});
