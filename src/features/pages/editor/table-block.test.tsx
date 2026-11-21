import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  addField: vi.fn(),
  addRow: vi.fn(),
  changeFieldType: vi.fn(),
  deleteField: vi.fn(),
  deleteRow: vi.fn(),
  reorderFields: vi.fn(),
  restoreRow: vi.fn(),
  updateBlockContent: vi.fn(),
  updateField: vi.fn(),
  updateRow: vi.fn(),
}));
const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("../actions", () => actions);

import type { PageField } from "../fields";
import type { LoadedBlock } from "../load-page";
import { NEW_TABLE_BLOCK } from "../templates";
import { TableBlock } from "./table-block";

// Blok jak po wstawieniu tabeli z menu „/”: Nazwa, Status, Data i dwa puste wiersze
function nowaTabela(): LoadedBlock {
  let n = 0;
  const t = NEW_TABLE_BLOCK(() => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`);
  return {
    id: t.id,
    type: "table",
    position: 0,
    content: t.content,
    fields: t.fields.map((f, i) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      config: f.config,
      position: i,
      isTitle: f.is_title,
    })),
    rows: t.rows.map((w, i) => ({
      id: `row-${i + 1}`,
      values: w.values,
      position: i,
      deletedAt: null,
    })),
  };
}

function pole(id: string, name: string, type: PageField["type"], position: number): PageField {
  return { id, name, type, config: {}, position, isTitle: false };
}

// Przycisk nagłówka kolumny na webie (pierwszy; drugi to nakładka telefonu „Kolumna … — ustawienia”)
function naglowek(nazwa: string) {
  const th = screen.getAllByRole("columnheader").find((h) => h.textContent?.includes(nazwa));
  if (!th) throw new Error(`Brak nagłówka ${nazwa}`);
  return within(th).getAllByRole("button")[0];
}

// Przycisk komórki w danym wierszu danych (1 = pierwszy wiersz pod nagłówkiem)
function komorka(wiersz: number, nazwa: string) {
  return within(screen.getAllByRole("row")[wiersz]).getByRole("button", { name: nazwa });
}

describe("TableBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
  });

  it("nowa tabela ma kolumny Nazwa, Status, Data, 2 wiersze i licznik", () => {
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    const naglowki = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(naglowki[0]).toContain("Nazwa");
    expect(naglowki[1]).toContain("Status");
    expect(naglowki[2]).toContain("Data");
    expect(screen.getByText("2 wiersze · 3 kolumny")).toBeTruthy();
  });

  it("ramka tabeli przewija się poziomo bez warunku szerokości", () => {
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    const ramka = screen.getAllByRole("columnheader")[0].closest("[class*='border-[1.5px]']");
    expect(ramka).toHaveClass("overflow-x-auto");
    expect(ramka?.className).not.toContain("max-[1100px]:overflow-x-auto");
  });

  it("nazwa tabeli ma placeholder i zapisuje content.name po utracie fokusu", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    render(<TableBlock block={blok} editable="cell" />);
    const pole = screen.getByRole("textbox", { name: "Nazwa tabeli" });
    expect(pole.getAttribute("placeholder")).toBe("Tabela bez nazwy");
    await user.type(pole, "Zadania");
    await user.tab();
    await waitFor(() =>
      expect(actions.updateBlockContent).toHaveBeenCalledWith(
        blok.id,
        expect.objectContaining({ name: "Zadania" }),
      ),
    );
  });

  it("klik w nagłówek otwiera dymek z typami, opcjami i przesuwaniem", async () => {
    const user = userEvent.setup();
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    await user.click(naglowek("Status"));
    const dymek = await screen.findByRole("dialog", { name: "Ustawienia kolumny" });
    expect(within(dymek).getByRole("textbox", { name: "Nazwa kolumny" })).toBeTruthy();
    expect(within(dymek).getByText("Typ pola")).toBeTruthy();
    for (const typ of ["Tekst", "Liczba", "Data", "Wybór", "Checkbox", "Link"]) {
      expect(within(dymek).getByRole("button", { name: new RegExp(typ) })).toBeTruthy();
    }
    expect(within(dymek).getByText("Opcje")).toBeTruthy();
    expect(within(dymek).getByRole("button", { name: "← W lewo" })).toBeTruthy();
    expect(within(dymek).getByRole("button", { name: "W prawo →" })).toBeTruthy();
    expect(within(dymek).getByRole("button", { name: "Usuń kolumnę" })).toHaveProperty("disabled", false);
  });

  it("dymek kolumny: klasy z CEmptyPage (.pop p-1, pole FIELD, pozycje .mi, przyciski xs)", async () => {
    const user = userEvent.setup();
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    await user.click(naglowek("Status"));
    const dymek = await screen.findByRole("dialog", { name: "Ustawienia kolumny" });
    expect(dymek).toHaveClass("p-1", "rounded-lg", "shadow-lg");
    expect(dymek).toHaveStyle({ width: "268px" });
    expect(within(dymek).getByRole("textbox", { name: "Nazwa kolumny" })).toHaveClass("h-8", "rounded-md", "shadow-xs");
    expect(within(dymek).getByText("Typ pola")).toHaveClass("text-xs", "font-medium");
    expect(within(dymek).getByRole("button", { name: /Tekst/ })).toHaveClass("min-h-8", "rounded-sm", "hover:bg-accent");
    // Bieżący typ (Wybór) jest podświetlony i ma ikonę ✓ po prawej
    expect(within(dymek).getByRole("button", { name: /Wybór/ })).toHaveClass("bg-accent");
    expect(within(dymek).getByRole("button", { name: /Wybór/ }).querySelector("svg")).not.toBeNull();
    expect(within(dymek).getByRole("textbox", { name: "Nowa opcja" })).toHaveClass("h-8");
    expect(within(dymek).getByRole("button", { name: "Dodaj" })).toHaveClass("h-7", "border-input");
    expect(within(dymek).getByRole("button", { name: "← W lewo" })).toHaveClass("h-6", "bg-transparent");
    expect(within(dymek).getByRole("button", { name: "Usuń kolumnę" })).toHaveClass("text-destructive-foreground", "min-h-8");
    expect(dymek.querySelectorAll(".h-px.bg-border")).toHaveLength(2);
  });

  it("pole tytułowe ma wyłączone usuwanie i zmianę typu", async () => {
    const user = userEvent.setup();
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    await user.click(naglowek("Nazwa"));
    const dymek = await screen.findByRole("dialog", { name: "Ustawienia kolumny" });
    expect(within(dymek).getByRole("button", { name: "Usuń kolumnę" })).toHaveProperty("disabled", true);
    expect(within(dymek).getByRole("button", { name: /Liczba/ })).toHaveProperty("disabled", true);
  });

  it("ostatnia kolumna nie da się usunąć", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    blok.fields = [pole("f-solo", "Solo", "text", 0)];
    render(<TableBlock block={blok} editable="cell" />);
    await user.click(naglowek("Solo"));
    const dymek = await screen.findByRole("dialog", { name: "Ustawienia kolumny" });
    expect(within(dymek).getByRole("button", { name: "Usuń kolumnę" })).toHaveProperty("disabled", true);
  });

  it("opcje Wyboru: dodanie przez Enter i usunięcie przez ×", async () => {
    const user = userEvent.setup();
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    await user.click(naglowek("Status"));
    const dymek = await screen.findByRole("dialog", { name: "Ustawienia kolumny" });
    await user.type(within(dymek).getByRole("textbox", { name: "Nowa opcja" }), "Wstrzymane{Enter}");
    await waitFor(() => expect(actions.updateField).toHaveBeenCalledTimes(1));
    const [id, zmiana] = actions.updateField.mock.calls[0];
    expect(id).toBe("00000000-0000-4000-8000-000000000003");
    expect(zmiana.config.options.map((o: { label: string }) => o.label)).toEqual([
      "Do zrobienia",
      "W toku",
      "Zrobione",
      "Wstrzymane",
    ]);
    await user.click(within(dymek).getByRole("button", { name: "Usuń opcję W toku" }));
    await waitFor(() => expect(actions.updateField).toHaveBeenCalledTimes(2));
    expect(
      actions.updateField.mock.calls[1][1].config.options.map((o: { label: string }) => o.label),
    ).toEqual(["Do zrobienia", "Zrobione", "Wstrzymane"]);
  });

  it("„+” dodaje „Kolumna 4” i od razu otwiera jej dymek", async () => {
    const user = userEvent.setup();
    actions.addField.mockResolvedValue({
      ok: true,
      field: pole("f-new", "Kolumna 4", "text", 3),
    });
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    await user.click(screen.getByRole("button", { name: "Dodaj kolumnę" }));
    const dymek = await screen.findByRole("dialog", { name: "Ustawienia kolumny" });
    expect(within(dymek).getByRole("textbox", { name: "Nazwa kolumny" })).toHaveProperty(
      "value",
      "Kolumna 4",
    );
    await waitFor(() =>
      expect(actions.addField).toHaveBeenCalledWith(expect.any(String), {
        name: "Kolumna 4",
        type: "text",
        config: {},
      }),
    );
    expect(screen.getByText("2 wiersze · 4 kolumny")).toBeTruthy();
    // Dymek zostaje otwarty po podmianie na prawdziwe id
    expect(screen.getByRole("dialog", { name: "Ustawienia kolumny" })).toBeTruthy();
  });

  it("tekst w komórce zapisuje się po utracie fokusu przez updateRow", async () => {
    const user = userEvent.setup();
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    const komorki = screen.getAllByRole("textbox", { name: "Nazwa" });
    await user.type(komorki[0], "Kupić mleko");
    expect(actions.updateRow).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(actions.updateRow).toHaveBeenCalledWith("row-1", {
        "00000000-0000-4000-8000-000000000002": "Kupić mleko",
      }),
    );
  });

  it("błąd zapisu komórki cofa wartość i pokazuje toast", async () => {
    const user = userEvent.setup();
    actions.updateRow.mockResolvedValue({ ok: false, message: "x" });
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    const komorka = screen.getAllByRole("textbox", { name: "Nazwa" })[0];
    await user.type(komorka, "Coś");
    await user.tab();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect((screen.getAllByRole("textbox", { name: "Nazwa" })[0] as HTMLInputElement).value).toBe("");
  });

  it("Checkbox zapisuje jednym kliknięciem, a stopka liczy „x / y”", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    blok.fields = [...blok.fields, pole("f-ok", "Zrobione", "checkbox", 3)];
    render(<TableBlock block={blok} editable="cell" />);
    expect(screen.getByText("0 / 2")).toBeTruthy();
    await user.click(screen.getAllByRole("checkbox", { name: "Zrobione" })[0]);
    expect(screen.getByText("1 / 2")).toBeTruthy();
    await waitFor(() => expect(actions.updateRow).toHaveBeenCalledWith("row-1", { "f-ok": true }));
  });

  it("stopka sumuje pole Liczba", () => {
    const blok = nowaTabela();
    blok.fields = [...blok.fields, pole("f-kwota", "Kwota", "number", 3)];
    blok.rows = [
      { id: "r1", values: { "f-kwota": 12.5 }, position: 0, deletedAt: null },
      { id: "r2", values: { "f-kwota": 7 }, position: 1, deletedAt: null },
    ];
    render(<TableBlock block={blok} editable="cell" />);
    expect(screen.getByText("Suma 19,5")).toBeTruthy();
  });

  it("Wybór: lista opcji, „Wyczyść” i „Edytuj opcje” otwierające dymek kolumny", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    const status = blok.fields[1];
    const opcje = status.config.options ?? [];
    blok.rows = [{ id: "r1", values: { [status.id]: opcje[1].id }, position: 0, deletedAt: null }];
    render(<TableBlock block={blok} editable="cell" />);

    await user.click(komorka(1, "Status"));
    const lista = await screen.findByRole("listbox", { name: "Status" });
    await user.click(within(lista).getByRole("option", { name: /Zrobione/ }));
    await waitFor(() =>
      expect(actions.updateRow).toHaveBeenCalledWith("r1", { [status.id]: opcje[2].id }),
    );

    await user.click(komorka(1, "Status"));
    await user.click(within(await screen.findByRole("listbox", { name: "Status" })).getByText("Wyczyść"));
    await waitFor(() =>
      expect(actions.updateRow).toHaveBeenLastCalledWith("r1", { [status.id]: null }),
    );

    await user.click(komorka(1, "Status"));
    await user.click(within(await screen.findByRole("listbox", { name: "Status" })).getByText("Edytuj opcje"));
    expect(await screen.findByRole("dialog", { name: "Ustawienia kolumny" })).toBeTruthy();
  });

  it("Data wybierana przez DatePicker zapisuje ISO", async () => {
    const user = userEvent.setup();
    render(<TableBlock block={nowaTabela()} editable="cell" today="2026-11-19" />);
    await user.click(komorka(1, "Data"));
    await user.click(await screen.findByRole("button", { name: "Dziś" }));
    await waitFor(() =>
      expect(actions.updateRow).toHaveBeenCalledWith("row-1", {
        "00000000-0000-4000-8000-000000000007": "2026-11-19",
      }),
    );
  });

  it("zmiana typu Tekst → Liczba bez strat zapisuje od razu przez changeFieldType", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    blok.fields = [...blok.fields, pole("f-t", "Ile", "text", 3)];
    blok.rows = [
      { id: "r1", values: { "f-t": "12" }, position: 0, deletedAt: null },
      { id: "r2", values: {}, position: 1, deletedAt: null },
    ];
    render(<TableBlock block={blok} editable="cell" />);
    await user.click(naglowek("Ile"));
    const dymek = await screen.findByRole("dialog", { name: "Ustawienia kolumny" });
    await user.click(within(dymek).getByRole("button", { name: /Liczba/ }));
    await waitFor(() =>
      expect(actions.changeFieldType).toHaveBeenCalledWith("f-t", "number", {}, { r1: 12, r2: null }),
    );
    expect(screen.queryByText("Zmienić typ pola?")).toBeNull();
  });

  it("zmiana typu ze stratą pokazuje okno z liczbą wartości i zapisuje po potwierdzeniu", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    blok.fields = [...blok.fields, pole("f-t", "Ile", "text", 3)];
    blok.rows = [
      { id: "r1", values: { "f-t": "12" }, position: 0, deletedAt: null },
      { id: "r2", values: { "f-t": "dużo" }, position: 1, deletedAt: null },
      { id: "r3", values: { "f-t": "mało" }, position: 2, deletedAt: null },
    ];
    render(<TableBlock block={blok} editable="cell" />);
    await user.click(naglowek("Ile"));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Ustawienia kolumny" })).getByRole("button", {
        name: /Liczba/,
      }),
    );
    expect(await screen.findByText("Zmienić typ pola?")).toBeTruthy();
    expect(screen.getByText("2 wartości nie da się przenieść i zostaną wyczyszczone.")).toBeTruthy();
    expect(actions.changeFieldType).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Zmień typ" }));
    await waitFor(() =>
      expect(actions.changeFieldType).toHaveBeenCalledWith(
        "f-t",
        "number",
        {},
        { r1: 12, r2: null, r3: null },
      ),
    );
    await waitFor(() => expect(screen.queryByText("Zmienić typ pola?")).toBeNull());
  });

  it("Anuluj w oknie zmiany typu niczego nie zapisuje", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    blok.fields = [...blok.fields, pole("f-t", "Ile", "text", 3)];
    blok.rows = [{ id: "r1", values: { "f-t": "dużo" }, position: 0, deletedAt: null }];
    render(<TableBlock block={blok} editable="cell" />);
    await user.click(naglowek("Ile"));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Ustawienia kolumny" })).getByRole("button", {
        name: /Liczba/,
      }),
    );
    await user.click(await screen.findByRole("button", { name: "Anuluj" }));
    expect(actions.changeFieldType).not.toHaveBeenCalled();
    expect(screen.queryByText("Zmienić typ pola?")).toBeNull();
  });

  it("nieudana zmiana typu cofa tylko tę kolumnę, równoległa edycja innej komórki zostaje", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    blok.fields = [...blok.fields, pole("f-t", "Ile", "text", 3)];
    blok.rows = [{ id: "r1", values: { "f-t": "12" }, position: 0, deletedAt: null }];
    let odrzuc: (v: { ok: false; message: string }) => void = () => {};
    actions.changeFieldType.mockReturnValue(new Promise((r) => (odrzuc = r)));
    render(<TableBlock block={blok} editable="cell" />);
    await user.click(naglowek("Ile"));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Ustawienia kolumny" })).getByRole("button", {
        name: /Liczba/,
      }),
    );
    await waitFor(() => expect(actions.changeFieldType).toHaveBeenCalled());
    // Zmiana typu już widoczna; w międzyczasie edytujemy inną komórkę
    const nazwa = within(screen.getAllByRole("row")[1]).getByRole("textbox", { name: "Nazwa" });
    await user.type(nazwa, "Zostaje");
    await user.tab();
    await waitFor(() => expect(actions.updateRow).toHaveBeenCalled());
    odrzuc({ ok: false, message: "x" });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(
      (within(screen.getAllByRole("row")[1]).getByRole("textbox", { name: "Nazwa" }) as HTMLInputElement).value,
    ).toBe("Zostaje");
    // Kolumna wróciła do typu Tekst: nagłówek ma ikonę Aa
    expect(naglowek("Ile").textContent).toContain("Aa");
  });

  it("„+ Nowy wiersz” dodaje pusty wiersz na końcu i podnosi licznik", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    actions.addRow.mockResolvedValue({
      ok: true,
      row: {
        id: "row-3",
        values: { [blok.fields[0].id]: "Bez tytułu" },
        position: 2,
        deletedAt: null,
      },
    });
    render(<TableBlock block={blok} editable="cell" />);
    await user.click(screen.getByRole("button", { name: "+ Nowy wiersz" }));
    expect(screen.getByText("3 wiersze · 3 kolumny")).toBeTruthy();
    await waitFor(() => expect(actions.addRow).toHaveBeenCalledWith(blok.id, {}));
    expect(screen.getAllByRole("row")).toHaveLength(1 + 3);
  });

  it("błąd dodania wiersza usuwa go z widoku i pokazuje toast", async () => {
    const user = userEvent.setup();
    actions.addRow.mockResolvedValue({ ok: false, message: "x" });
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    await user.click(screen.getByRole("button", { name: "+ Nowy wiersz" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText("2 wiersze · 3 kolumny")).toBeTruthy();
  });

  it("odświeżenie danych z serwera nie gubi tymczasowego wiersza", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    actions.addRow.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<TableBlock block={blok} editable="cell" />);
    await user.click(screen.getByRole("button", { name: "+ Nowy wiersz" }));
    expect(screen.getByText("3 wiersze · 3 kolumny")).toBeTruthy();
    rerender(<TableBlock block={{ ...blok, rows: [...blok.rows] }} editable="cell" />);
    expect(screen.getByText("3 wiersze · 3 kolumny")).toBeTruthy();
  });

  it("przesunięcie kolumny w prawo zapisuje nową kolejność", async () => {
    const user = userEvent.setup();
    const blok = nowaTabela();
    render(<TableBlock block={blok} editable="cell" />);
    await user.click(naglowek("Status"));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Ustawienia kolumny" })).getByRole("button", {
        name: "W prawo →",
      }),
    );
    await waitFor(() =>
      expect(actions.reorderFields).toHaveBeenCalledWith(blok.id, [
        blok.fields[0].id,
        blok.fields[2].id,
        blok.fields[1].id,
      ]),
    );
    const naglowki = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(naglowki[1]).toContain("Data");
    expect(naglowki[2]).toContain("Status");
  });

  it("usunięcie kolumny wywołuje deleteField i zdejmuje nagłówek", async () => {
    const user = userEvent.setup();
    render(<TableBlock block={nowaTabela()} editable="cell" />);
    await user.click(naglowek("Data"));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Ustawienia kolumny" })).getByRole("button", {
        name: "Usuń kolumnę",
      }),
    );
    await waitFor(() =>
      expect(actions.deleteField).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000007"),
    );
    expect(screen.getByText("2 wiersze · 2 kolumny")).toBeTruthy();
  });
});
