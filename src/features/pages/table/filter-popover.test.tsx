import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import * as React from "react";

import type { FilterCond } from "../table-model";
import { FilterPopover } from "./filter-popover";
import { PageTable } from "./page-table";
import { DZIS, stronaTestowa } from "./test-page";

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

  const opcja = (filtr: HTMLElement, pole: string, nazwa: string) =>
    within(within(filtr).getByRole("group", { name: pole })).getByRole("checkbox", { name: nazwa });

  it("menu z makiety: pola wyboru z opcjami i liczbami, bez kreatora warunków", async () => {
    const user = userEvent.setup();
    render(<PageTable block={stronaTestowa("books", "Books", BOOKS).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    expect(filtr.className).toContain("w-[240px]");
    expect(opcja(filtr, "Status", "Przeczytane")).not.toBeChecked();
    expect(opcja(filtr, "Status", "Przeczytane").closest("div.flex")?.parentElement?.textContent).toContain("3");
    expect(within(filtr).getByText("Filtr zmienia tabelę i sumy. Nie wpływa na kalendarz.")).toBeInTheDocument();
    expect(within(filtr).queryByRole("button", { name: /Dodaj warunek/ })).toBeNull();
    expect(within(filtr).queryByRole("group", { name: "Autor" })).toBeNull();
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

  it("odhaczenie opcji zawęża tabelę, zapisuje warunek „in”; ostatnie odznaczenie go usuwa", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    const status = dane.blocks[0].fields.find((f) => f.name === "Status")!;
    const id = (nazwa: string) => status.config.options!.find((o) => o.label === nazwa)!.id;
    render(<PageTable block={dane.blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    await user.click(opcja(filtr, "Status", "Przeczytane"));
    await user.click(opcja(filtr, "Status", "Czytam"));
    expect(tytuly()).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Filtruj · 2" })).toBeInTheDocument();
    expect(actions.saveTableSettings).toHaveBeenLastCalledWith("blok-1", {
      filters: [{ field_id: status.id, op: "in", value: [id("Przeczytane"), id("Czytam")] }],
    });
    await user.click(opcja(filtr, "Status", "Przeczytane"));
    await user.click(opcja(filtr, "Status", "Czytam"));
    expect(tytuly()).toHaveLength(5);
    expect(actions.saveTableSettings).toHaveBeenLastCalledWith("blok-1", { filters: [] });
  });

  it("warunek spoza menu (z gotowego widoku) liczy się w plakietce, zostaje po odhaczeniu i znika po „Wyczyść”", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    const autor = dane.blocks[0].fields.find((f) => f.name === "Autor")!;
    const zapisany = { field_id: autor.id, op: "contains", value: "cal" };
    (dane.blocks[0].content as { settings: { filters: unknown[] } }).settings.filters = [zapisany];
    render(<PageTable block={dane.blocks[0]} today={DZIS} />);
    expect(tytuly()).toEqual(["Deep Work"]);
    const filtr = await otworzFiltr(user, "Filtruj · 1");
    await user.click(opcja(filtr, "Status", "Przeczytane"));
    expect(screen.getByRole("button", { name: "Filtruj · 2" })).toBeInTheDocument();
    await user.click(within(filtr).getByRole("button", { name: "Wyczyść" }));
    expect(tytuly()).toHaveLength(5);
  });

  it("karty i podsumowania liczą się z wierszy po filtrze", async () => {
    const user = userEvent.setup();
    render(<PageTable block={(stronaTestowa("books", "Books", BOOKS)).blocks[0]} today={DZIS} />);
    const filtr = await otworzFiltr(user);
    await user.click(opcja(filtr, "Status", "Przeczytane"));
    // Średnia ocena ze stopki: (4 + 5 + 3) / 3
    const stopka = screen.getAllByRole("row").at(-1) as HTMLElement;
    expect(within(stopka).getByText("śr. 4,0")).toBeInTheDocument();
    expect(screen.getByText("Czytam teraz", { selector: "div" }).parentElement?.textContent).toContain("0");
  });

  it("„Wyczyść” czyści filtr i od razu zapisuje settings.filters", async () => {
    const user = userEvent.setup();
    const dane = stronaTestowa("books", "Books", BOOKS);
    const status = dane.blocks[0].fields.find((f) => f.name === "Status")!;
    const przeczytane = status.config.options!.find((o) => o.label === "Przeczytane")!;
    const zapisany = [{ field_id: status.id, op: "in", value: [przeczytane.id] }];
    (dane.blocks[0].content as { settings: { filters: unknown[] } }).settings.filters = zapisany;
    render(<PageTable block={(dane).blocks[0]} today={DZIS} />);
    expect(tytuly().sort()).toEqual(["Deep Work", "Diuna", "Sapiens"]);

    const filtr = await otworzFiltr(user, "Filtruj · 1");
    await user.click(within(filtr).getByRole("button", { name: "Wyczyść" }));
    expect(tytuly()).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Filtruj" })).toBeInTheDocument();
    expect(actions.saveTableSettings).toHaveBeenCalledWith("blok-1", { filters: [] });
  });

});

describe("filtr i sortowanie na telefonie (CMFilterSheet)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("przycisk „Filtr i sortowanie” otwiera arkusz z sekcjami Filtr i Sortowanie", async () => {
    const user = userEvent.setup();
    render(<PageTable block={stronaTestowa("books", "Books", BOOKS).blocks[0]} today={DZIS} />);
    await user.click(screen.getByRole("button", { name: "Filtr i sortowanie" }));
    const arkusz = await screen.findByRole("dialog", { name: "Filtr i sortowanie" });
    expect(within(arkusz).getByText("Brak warunków. Tabela pokazuje wszystkie wiersze.")).toBeInTheDocument();
    expect(within(arkusz).getByText("Sortowanie")).toBeInTheDocument();
    expect(within(arkusz).getByRole("button", { name: "Dodaj sortowanie" })).toBeInTheDocument();
  });

  it("dodane sortowanie ma przełącznik Rosnąco / Malejąco i „Usuń sortowanie”", async () => {
    const user = userEvent.setup();
    render(<PageTable block={stronaTestowa("books", "Books", BOOKS).blocks[0]} today={DZIS} />);
    await user.click(screen.getByRole("button", { name: "Filtr i sortowanie" }));
    const arkusz = await screen.findByRole("dialog", { name: "Filtr i sortowanie" });
    const przed = within(arkusz).queryAllByRole("radio", { name: "Rosnąco" }).length;
    await user.click(within(arkusz).getByRole("button", { name: "Dodaj sortowanie" }));
    expect(within(arkusz).getAllByRole("radio", { name: "Rosnąco" })).toHaveLength(przed + 1);
    expect(within(arkusz).getAllByRole("radio", { name: "Malejąco" })).toHaveLength(przed + 1);
    await user.click(within(arkusz).getAllByRole("button", { name: /^Usuń sortowanie/ })[0]);
    expect(within(arkusz).queryAllByRole("radio", { name: "Rosnąco" })).toHaveLength(przed);
  });

  it("„Gotowe” zamyka arkusz", async () => {
    const user = userEvent.setup();
    render(<PageTable block={stronaTestowa("books", "Books", BOOKS).blocks[0]} today={DZIS} />);
    await user.click(screen.getByRole("button", { name: "Filtr i sortowanie" }));
    const arkusz = await screen.findByRole("dialog", { name: "Filtr i sortowanie" });
    await user.click(within(arkusz).getByRole("button", { name: "Gotowe" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtr i sortowanie" })).toBeNull());
  });
});

// Kreator warunków (arkusz telefonu), sterowany z zewnątrz
describe("FilterPopover — nowe operatory", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });
  const pola = stronaTestowa("books", "Books", []).blocks[0].fields;
  const pole = (nazwa: string) => pola.find((f) => f.name === nazwa)!;

  function Filtr({ start, onSaveAsView }: { start: FilterCond[]; onSaveAsView?: () => void }) {
    const [filtry, setFiltry] = React.useState(start);
    const [open, setOpen] = React.useState(true);
    return (
      <>
        <FilterPopover
          fields={pola}
          filters={filtry}
          today={DZIS}
          rows={[]}
          sort={[]}
          onSortChange={() => {}}
          shown={1}
          total={2}
          open={open}
          onOpenChange={setOpen}
          onChange={setFiltry}
          onSaveAsView={onSaveAsView}
          triggerClassName=""
        />
        <output data-testid="filtry">{JSON.stringify(filtry)}</output>
      </>
    );
  }
  const filtry = () => JSON.parse(screen.getByTestId("filtry").textContent ?? "[]") as FilterCond[];

  it("data „w ciągu dni”: pole liczby z domyślnym 14 (min 1)", async () => {
    const user = userEvent.setup();
    render(<Filtr start={[{ field_id: pole("Przeczytana").id, op: "before" }]} />);
    await wybierz(user, "Operator warunku 1", "w ciągu dni");
    expect(filtry()[0]).toEqual({ field_id: pole("Przeczytana").id, op: "within_days", value: 14 });
    const liczba = screen.getByRole("spinbutton", { name: "Wartość warunku 1" });
    expect(liczba).toHaveValue(14);
    expect(liczba).toHaveAttribute("min", "1");
    await user.clear(liczba);
    await user.type(liczba, "30");
    await waitFor(() => expect(filtry()[0].value).toBe(30));
  });

  it("data „w tym roku”: bez pola wartości, wartość wyczyszczona", async () => {
    const user = userEvent.setup();
    render(<Filtr start={[{ field_id: pole("Przeczytana").id, op: "before", value: "2026-01-01" }]} />);
    await wybierz(user, "Operator warunku 1", "w tym roku");
    expect(filtry()[0]).toEqual({ field_id: pole("Przeczytana").id, op: "this_year" });
    expect(screen.queryByRole("button", { name: "Wartość warunku 1" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Wartość warunku 1" })).toBeNull();
  });

  it("wybór „nie jest żadnym z”: opcje jak w „jest jednym z”", async () => {
    const user = userEvent.setup();
    render(<Filtr start={[{ field_id: pole("Status").id, op: "in", value: ["x"] }]} />);
    await wybierz(user, "Operator warunku 1", "nie jest żadnym z");
    expect(filtry()[0]).toEqual({ field_id: pole("Status").id, op: "not_in" });
    const grupa = screen.getByRole("group", { name: "Wartość warunku 1" });
    await user.click(within(grupa).getByRole("button", { name: "Czytam" }));
    const czytam = pole("Status").config.options!.find((o) => o.label === "Czytam")!;
    expect(filtry()[0].value).toEqual([czytam.id]);
  });

  it("tekst „nie jest równe”: pole tekstu", async () => {
    const user = userEvent.setup();
    render(<Filtr start={[{ field_id: pole("Autor").id, op: "contains", value: "abc" }]} />);
    await wybierz(user, "Operator warunku 1", "nie jest równe");
    expect(filtry()[0]).toEqual({ field_id: pole("Autor").id, op: "not_equals" });
    await user.type(screen.getByRole("textbox", { name: "Wartość warunku 1" }), "Clear");
    await waitFor(() => expect(filtry()[0].value).toBe("Clear"));
  });

  it("„Zapisz jako widok” woła onSaveAsView", async () => {
    const user = userEvent.setup();
    const zapisz = vi.fn();
    render(<Filtr start={[{ field_id: pole("Autor").id, op: "contains", value: "a" }]} onSaveAsView={zapisz} />);
    await user.click(screen.getByRole("button", { name: "Zapisz jako widok" }));
    expect(zapisz).toHaveBeenCalledTimes(1);
  });

  it("operatory zależą od typu pola", async () => {
    const user = userEvent.setup();
    render(<Filtr start={[{ field_id: pole("Przeczytana").id, op: "before" }]} />);
    await user.click(screen.getByRole("button", { name: "Operator warunku 1" }));
    expect(
      within(screen.getByRole("listbox", { name: "Operator warunku 1" }))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["przed✓", "po", "w ciągu dni", "w tym roku", "jest puste"]);
  });
});

describe("FilterPopover — opóźniony zapis wpisywanej wartości", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });
  const pola = stronaTestowa("books", "Books", []).blocks[0].fields;
  const autor = pola.find((f) => f.name === "Autor")!;

  function Filtr({ onChange, onSaveAsView }: { onChange: (f: FilterCond[]) => void; onSaveAsView?: () => void }) {
    const [filtry, setFiltry] = React.useState<FilterCond[]>([{ field_id: autor.id, op: "contains" }]);
    return (
      <FilterPopover
        fields={pola}
        filters={filtry}
        today={DZIS}
        rows={[]}
        sort={[]}
        onSortChange={() => {}}
        shown={1}
        total={2}
        open
        onOpenChange={() => {}}
        onChange={(f) => {
          setFiltry(f);
          onChange(f);
        }}
        onSaveAsView={onSaveAsView}
        triggerClassName=""
      />
    );
  }

  it("tekst zapisuje się raz, 400 ms po ostatnim znaku; pole od razu pokazuje wpisany tekst", async () => {
    const zmiana = vi.fn();
    const user = userEvent.setup();
    render(<Filtr onChange={zmiana} />);
    const pole = screen.getByRole("textbox", { name: "Wartość warunku 1" });
    await user.type(pole, "Clear");
    expect(pole).toHaveValue("Clear");
    expect(zmiana).not.toHaveBeenCalled();
    await waitFor(() => expect(zmiana).toHaveBeenCalledTimes(1));
    expect(zmiana).toHaveBeenCalledWith([{ field_id: autor.id, op: "contains", value: "Clear" }]);
    await new Promise((r) => setTimeout(r, 450));
    expect(zmiana).toHaveBeenCalledTimes(1);
  });

  it("zmiana operatora zapisuje się od razu", async () => {
    const zmiana = vi.fn();
    const user = userEvent.setup();
    render(<Filtr onChange={zmiana} />);
    await wybierz(user, "Operator warunku 1", "nie jest równe");
    expect(zmiana).toHaveBeenCalledWith([{ field_id: autor.id, op: "not_equals" }]);
  });

  it("„Zapisz jako widok” najpierw wysyła czekającą wartość", async () => {
    const zmiana = vi.fn();
    const zapisz = vi.fn(() => expect(zmiana).toHaveBeenCalledWith([{ field_id: autor.id, op: "contains", value: "Cl" }]));
    const user = userEvent.setup();
    render(<Filtr onChange={zmiana} onSaveAsView={zapisz} />);
    await user.type(screen.getByRole("textbox", { name: "Wartość warunku 1" }), "Cl");
    await user.click(screen.getByRole("button", { name: "Zapisz jako widok" }));
    expect(zapisz).toHaveBeenCalledTimes(1);
    expect(zmiana).toHaveBeenCalledTimes(1);
  });
});

