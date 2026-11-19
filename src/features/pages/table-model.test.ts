import { describe, expect, it } from "vitest";
import type { PageField } from "./fields";
import {
  computeCard,
  editorFooter,
  operatorsFor,
  summarize,
  summaryOptions,
  visibleRows,
} from "./table-model";
import type { PageRow, TableSettings } from "./table-model";
import { buildTemplateBlocks } from "./templates";

const TODAY = "2026-11-15";

function seqId() {
  let n = 0;
  return () => `id-${++n}`;
}

const bezUstawien: TableSettings = {
  sort: [],
  filters: [],
  hidden_field_ids: [],
  column_summaries: {},
  pinned_cards: [],
};

// Szablon z id pól i opcji, jak po create_page
function szablon(key: "books" | "projects" | "websites") {
  const [blok] = buildTemplateBlocks(key, seqId());
  const fields: PageField[] = blok.fields.map((f, i) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    config: f.config,
    position: i,
    isTitle: f.is_title,
  }));
  const settings = blok.content.settings as TableSettings;
  const pole = (name: string) => fields.find((f) => f.name === name) as PageField;
  const opcja = (name: string, label: string) =>
    pole(name).config.options?.find((o) => o.label === label)?.id as string;
  return { fields, settings, pole, opcja };
}

function wiersz(i: number, values: Record<string, unknown>, deletedAt: string | null = null): PageRow {
  return { id: `r${i}`, values, position: i, deletedAt };
}

// Dane z makiety Books
function ksiazki() {
  const t = szablon("books");
  const w = (
    i: number,
    title: string,
    status: string,
    rating: number | null,
    date: string | null,
  ) =>
    wiersz(i, {
      [t.pole("Tytuł").id]: title,
      [t.pole("Status").id]: t.opcja("Status", status),
      [t.pole("Ocena").id]: rating,
      [t.pole("Przeczytana").id]: date,
    });
  const rows = [
    w(1, "Atomic Habits", "Czytam", null, null),
    w(2, "Hacking", "Czytam", null, null),
    w(3, "Psychologia pieniędzy", "Przeczytane", 5, "2026-11-02"),
    w(4, "Deep Work", "Przeczytane", 4, "2026-10-12"),
    w(5, "Zero to One", "Przeczytane", 4, "2026-08-28"),
    w(6, "Diuna", "Przeczytane", 5, "2026-06-15"),
    w(7, "The Pragmatic Programmer", "Przeczytane", 3, "2026-04-20"),
    w(8, "Ostatnie życzenie", "Przeczytane", 4, "2026-02-03"),
    w(9, "Sapiens", "Przeczytane", 4, "2025-12-11"),
    w(10, "WAHH", "Chcę przeczytać", null, null),
    w(11, "Clean Code", "Chcę przeczytać", null, null),
  ];
  return { ...t, rows };
}

describe("operatorsFor", () => {
  it("zwraca operatory zgodne z typem", () => {
    expect(operatorsFor("checkbox")).toEqual(["checked", "unchecked"]);
    expect(operatorsFor("select")).toEqual(["in", "empty"]);
    expect(operatorsFor("status")).toEqual(["in", "empty"]);
    expect(operatorsFor("number")).toEqual(["gte", "lte", "empty"]);
    expect(operatorsFor("rating")).toEqual(["gte", "lte", "empty"]);
    expect(operatorsFor("text")).toEqual(["contains", "empty"]);
    expect(operatorsFor("url")).toEqual(["contains", "empty"]);
    expect(operatorsFor("date")).toEqual(["before", "after", "empty"]);
  });
});

describe("visibleRows: sort", () => {
  it("bez sortu zostaje kolejność position", () => {
    const k = ksiazki();
    const odwrocone = [...k.rows].reverse();
    expect(visibleRows(k.fields, odwrocone, bezUstawien).map((r) => r.id)).toEqual(
      k.rows.map((r) => r.id),
    );
  });

  it("po Statusie sortuje wg kolejności opcji, nie alfabetu", () => {
    const k = ksiazki();
    const settings = { ...bezUstawien, sort: [{ field_id: k.pole("Status").id, dir: "asc" as const }] };
    const wynik = visibleRows(k.fields, k.rows, settings).map((r) => r.values[k.pole("Tytuł").id]);
    // Czytam, Przeczytane, Chcę przeczytać (alfabetycznie byłoby Chcę przed Czytam)
    expect(wynik.slice(0, 2)).toEqual(["Atomic Habits", "Hacking"]);
    expect(wynik.slice(-2)).toEqual(["WAHH", "Clean Code"]);
  });

  it("po Dacie rosnąco z pustymi na końcu, także przy desc", () => {
    const k = ksiazki();
    const data = k.pole("Przeczytana").id;
    const asc = visibleRows(k.fields, k.rows, { ...bezUstawien, sort: [{ field_id: data, dir: "asc" }] });
    const desc = visibleRows(k.fields, k.rows, { ...bezUstawien, sort: [{ field_id: data, dir: "desc" }] });
    expect(asc[0].values[data]).toBe("2025-12-11");
    expect(asc[6].values[data]).toBe("2026-11-02");
    expect(asc.slice(7).every((r) => r.values[data] === null)).toBe(true);
    expect(desc[0].values[data]).toBe("2026-11-02");
    expect(desc[6].values[data]).toBe("2025-12-11");
    expect(desc.slice(7).every((r) => r.values[data] === null)).toBe(true);
  });

  it("dwa klucze (Books: status, data malejąco)", () => {
    const k = ksiazki();
    const wynik = visibleRows(k.fields, k.rows, k.settings).map((r) => r.id);
    expect(wynik).toEqual(["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10", "r11"]);
    // Odwrócone wejście daje ten sam wynik
    expect(visibleRows(k.fields, [...k.rows].reverse(), k.settings).map((r) => r.id)).toEqual(wynik);
  });

  it("wartość o złym typie jest traktowana jak pusta", () => {
    const k = ksiazki();
    const ocena = k.pole("Ocena").id;
    const rows = [wiersz(1, { [ocena]: "abc" }), wiersz(2, { [ocena]: 2 }), wiersz(3, { [ocena]: 1 })];
    const wynik = visibleRows(k.fields, rows, { ...bezUstawien, sort: [{ field_id: ocena, dir: "asc" }] });
    expect(wynik.map((r) => r.id)).toEqual(["r3", "r2", "r1"]);
  });
});

describe("visibleRows: filtr", () => {
  const pola: PageField[] = [
    { id: "chk", name: "Zrobione", type: "checkbox", config: {}, position: 0, isTitle: false },
    {
      id: "sel",
      name: "Status",
      type: "status",
      config: {
        options: [
          { id: "a", label: "A", color: "#525252" },
          { id: "b", label: "B", color: "#525252" },
          { id: "c", label: "C", color: "#525252" },
        ],
      },
      position: 1,
      isTitle: false,
    },
    { id: "num", name: "Cena", type: "number", config: {}, position: 2, isTitle: false },
    { id: "txt", name: "Nazwa", type: "text", config: {}, position: 3, isTitle: true },
    { id: "dat", name: "Data", type: "date", config: {}, position: 4, isTitle: false },
  ];
  const rows = [
    wiersz(1, { chk: true, sel: "a", num: 10, txt: "Kawa", dat: "2026-01-01" }),
    wiersz(2, { chk: false, sel: "b", num: 50, txt: "herbata", dat: "2026-06-01" }),
    wiersz(3, { chk: true, sel: "c", num: 100, txt: "KAWA mrożona", dat: "2026-12-01" }),
    wiersz(4, {}),
  ];
  const ids = (extra: Parameters<typeof visibleRows>[3]) =>
    visibleRows(pola, rows, bezUstawien, extra).map((r) => r.id);

  it("checked i unchecked", () => {
    expect(ids([{ field_id: "chk", op: "checked" }])).toEqual(["r1", "r3"]);
    expect(ids([{ field_id: "chk", op: "unchecked" }])).toEqual(["r2", "r4"]);
  });
  it("in z dwiema opcjami", () => {
    expect(ids([{ field_id: "sel", op: "in", value: ["a", "c"] }])).toEqual(["r1", "r3"]);
  });
  it("gte i lte na Liczbie", () => {
    expect(ids([{ field_id: "num", op: "gte", value: 50 }])).toEqual(["r2", "r3"]);
    expect(ids([{ field_id: "num", op: "lte", value: 50 }])).toEqual(["r1", "r2"]);
  });
  it("contains bez wielkości liter", () => {
    expect(ids([{ field_id: "txt", op: "contains", value: "kawa" }])).toEqual(["r1", "r3"]);
  });
  it("before i after na Dacie", () => {
    expect(ids([{ field_id: "dat", op: "before", value: "2026-06-01" }])).toEqual(["r1"]);
    expect(ids([{ field_id: "dat", op: "after", value: "2026-06-01" }])).toEqual(["r3"]);
  });
  it("empty i not_empty", () => {
    expect(ids([{ field_id: "txt", op: "empty" }])).toEqual(["r4"]);
    expect(ids([{ field_id: "txt", op: "not_empty" }])).toEqual(["r1", "r2", "r3"]);
  });
  it("warunki łączone „i”", () => {
    expect(
      ids([
        { field_id: "chk", op: "checked" },
        { field_id: "num", op: "gte", value: 50 },
      ]),
    ).toEqual(["r3"]);
  });
  it("extraFilters zastępuje settings.filters, null ich nie zastępuje", () => {
    const settings = { ...bezUstawien, filters: [{ field_id: "chk", op: "checked" as const }] };
    expect(visibleRows(pola, rows, settings, null).map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(visibleRows(pola, rows, settings, []).map((r) => r.id)).toEqual(["r1", "r2", "r3", "r4"]);
  });
});

describe("rows with deletedAt are excluded", () => {
  it("visibleRows, summarize i computeCard pomijają usunięte wiersze", () => {
    const k = ksiazki();
    const rows = k.rows.map((r) => (r.id === "r3" ? { ...r, deletedAt: "2026-11-14T10:00:00Z" } : r));
    expect(visibleRows(k.fields, rows, bezUstawien).map((r) => r.id)).not.toContain("r3");
    expect(summarize(k.pole("Tytuł"), rows, { kind: "count" }, TODAY)).toBe("10 wierszy");
    expect(computeCard(k.settings.pinned_cards[0], k.fields, rows, TODAY).value).toBe("5");
  });
});

describe("ignores settings for missing fields", () => {
  it("sort, filtr, podsumowanie i karta z nieistniejącym field_id", () => {
    const k = ksiazki();
    const zepsute: TableSettings = {
      ...bezUstawien,
      sort: [{ field_id: "nie-ma", dir: "asc" }],
      filters: [{ field_id: "nie-ma", op: "checked" }],
    };
    expect(visibleRows(k.fields, k.rows, zepsute).map((r) => r.id)).toEqual(k.rows.map((r) => r.id));
    const karta = computeCard(
      { label: "X", field_id: "nie-ma", aggregation: "count_option", option_id: "a" },
      k.fields,
      k.rows,
      TODAY,
    );
    expect(karta.value).toBe("—");
    const bezDaty = computeCard(
      { ...k.settings.pinned_cards[0], date_field_id: "nie-ma" },
      k.fields,
      k.rows,
      TODAY,
    );
    expect(bezDaty.value).toBe("—");
  });
});

describe("summarize", () => {
  const cena: PageField = {
    id: "cena",
    name: "Cena",
    type: "number",
    config: { number_format: "pln" },
    position: 0,
    isTitle: false,
  };
  const rows = [wiersz(1, { cena: 10 }), wiersz(2, { cena: 33 }), wiersz(3, {})];

  it("sum i avg Liczby z formatem pln", () => {
    expect(summarize(cena, rows, { kind: "sum" }, TODAY)).toBe("43,00 zł");
    expect(summarize(cena, rows, { kind: "avg" }, TODAY)).toBe("śr. 21,50 zł");
    expect(summarize(cena, rows, { kind: "min" }, TODAY)).toBe("10,00 zł");
    expect(summarize(cena, rows, { kind: "max" }, TODAY)).toBe("33,00 zł");
  });

  it("avg Oceny z 1 miejscem po przecinku", () => {
    const k = ksiazki();
    expect(summarize(k.pole("Ocena"), k.rows, { kind: "avg" }, TODAY)).toBe("śr. 4,1");
  });

  it("count, filled, empty", () => {
    expect(summarize(cena, rows, { kind: "count" }, TODAY)).toBe("3 wiersze");
    expect(summarize(cena, rows, { kind: "filled" }, TODAY)).toBe("2 wypełnione");
    expect(summarize(cena, rows, { kind: "empty" }, TODAY)).toBe("1 pusty");
    expect(summarize(cena, rows, { kind: "none" }, TODAY)).toBe("");
    const k = ksiazki();
    expect(summarize(k.pole("Przeczytana"), k.rows, { kind: "filled" }, TODAY)).toBe("7 terminów");
    expect(
      summarize(k.pole("Przeczytana"), k.rows, { kind: "filled", unit: ["termin", "terminy", "terminów"] }, TODAY),
    ).toBe("7 terminów");
  });

  it("checked pokazuje „x / y”", () => {
    const chk: PageField = { id: "c", name: "Aktywna", type: "checkbox", config: {}, position: 0, isTitle: false };
    const r = [wiersz(1, { c: true }), wiersz(2, { c: false }), wiersz(3, { c: true }), wiersz(4, {})];
    expect(summarize(chk, r, { kind: "checked" }, TODAY)).toBe("2 / 4");
  });

  it("earliest, latest i nearest dat (nearest >= today)", () => {
    const k = ksiazki();
    const data = k.pole("Przeczytana");
    const r = [
      wiersz(1, { [data.id]: "2026-11-01" }),
      wiersz(2, { [data.id]: "2026-11-20" }),
      wiersz(3, { [data.id]: "2026-12-24" }),
      wiersz(4, {}),
    ];
    expect(summarize(data, r, { kind: "earliest" }, TODAY)).toBe("01.11.2026");
    expect(summarize(data, r, { kind: "latest" }, TODAY)).toBe("24.12.2026");
    expect(summarize(data, r, { kind: "nearest" }, TODAY)).toBe("20.11.2026");
    expect(summarize(data, [r[0]], { kind: "nearest" }, TODAY)).toBe("—");
  });

  it("brak wartości daje „—”", () => {
    expect(summarize(cena, [], { kind: "sum" }, TODAY)).toBe("—");
    expect(summarize(cena, [], { kind: "avg" }, TODAY)).toBe("—");
  });

  it("summaryOptions zależy od typu", () => {
    expect(summaryOptions("number")).toContain("sum");
    expect(summaryOptions("rating")).not.toContain("sum");
    expect(summaryOptions("checkbox")).toContain("checked");
    expect(summaryOptions("date")).toContain("nearest");
    expect(summaryOptions("text")).toEqual(["none", "count", "filled", "empty"]);
  });
});

describe("stopki z szablonów (teksty z makiet)", () => {
  const stopka = (t: ReturnType<typeof szablon>, name: string, rows: PageRow[]) => {
    const pole = t.pole(name);
    return summarize(pole, rows, t.settings.column_summaries[pole.id], TODAY);
  };

  it("Books: przeczytane, śr., w tym roku", () => {
    const k = ksiazki();
    expect(stopka(k, "Status", k.rows)).toBe("7 przeczytanych");
    expect(stopka(k, "Ocena", k.rows)).toBe("śr. 4,1");
    expect(stopka(k, "Przeczytana", k.rows)).toBe("6 w tym roku");
    expect(stopka(k, "Status", k.rows.slice(0, 3))).toBe("1 przeczytana");
    expect(stopka(k, "Status", k.rows.slice(0, 5))).toBe("3 przeczytane");
  });

  it("Projects: w toku, terminów, linków", () => {
    const t = szablon("projects");
    const rows = [
      wiersz(1, { [t.pole("Status").id]: t.opcja("Status", "W toku"), [t.pole("Termin").id]: "2026-11-20", [t.pole("Repo").id]: "a/b" }),
      wiersz(2, { [t.pole("Status").id]: t.opcja("Status", "W toku"), [t.pole("Termin").id]: "2026-12-01" }),
      wiersz(3, {}),
    ];
    expect(stopka(t, "Status", rows)).toBe("2 w toku");
    expect(stopka(t, "Termin", rows)).toBe("2 terminy");
    expect(stopka(t, "Repo", rows)).toBe("1 link");
  });

  it("Websites: linków i na żywo", () => {
    const t = szablon("websites");
    const rows = [
      wiersz(1, { [t.pole("URL").id]: "a.pl", [t.pole("Status").id]: t.opcja("Status", "Na żywo") }),
      wiersz(2, { [t.pole("URL").id]: "b.pl" }),
    ];
    expect(stopka(t, "URL", rows)).toBe("2 linki");
    expect(stopka(t, "Status", rows)).toBe("1 na żywo");
  });
});

describe("computeCard: Books", () => {
  it("Przeczytane w bieżącym roku, Czytam teraz, Średnia ocena", () => {
    const k = ksiazki();
    const [przeczytane, czytam, srednia] = k.settings.pinned_cards.map((c) =>
      computeCard(c, k.fields, k.rows, TODAY),
    );
    expect(przeczytane).toEqual({ label: "Przeczytane w 2026", value: "6", sub: "książek" });
    expect(czytam).toMatchObject({ label: "Czytam teraz", value: "2" });
    expect(srednia).toEqual({ label: "Średnia ocena", value: "4,1", sub: "/ 5" });
  });

  it("etykieta bierze rok z „dziś”", () => {
    const k = ksiazki();
    expect(computeCard(k.settings.pinned_cards[0], k.fields, k.rows, "2027-01-02").label).toBe(
      "Przeczytane w 2027",
    );
  });

  it("średnia bez ocen to „—”", () => {
    const k = ksiazki();
    expect(computeCard(k.settings.pinned_cards[2], k.fields, [], TODAY).value).toBe("—");
  });
});

describe("computeCard: Projects", () => {
  function projekty() {
    const t = szablon("projects");
    const w = (i: number, name: string, status: string, due: string | null) =>
      wiersz(i, {
        [t.pole("Nazwa").id]: name,
        [t.pole("Status").id]: t.opcja("Status", status),
        [t.pole("Termin").id]: due,
      });
    const rows = [
      w(1, "Projekt z baz danych", "W toku", "2026-11-20"),
      w(2, "rhytm v3", "W toku", "2026-12-15"),
      w(3, "Strona Fanaberia", "W toku", "2026-11-30"),
      w(4, "LeetRepeat", "Wstrzymane", null),
      w(5, "NetScope", "Do zrobienia", "2027-02-15"),
      w(6, "Stary", "Do zrobienia", "2026-11-01"),
      w(7, "Chainlock", "Do zrobienia", null),
      w(8, "rhytm v2", "Zrobione", "2026-11-16"),
    ];
    return { ...t, rows };
  }

  it("Najbliższy termin: nazwa, relativeDue i urgent przy <= 7 dni", () => {
    const p = projekty();
    const karta = computeCard(p.settings.pinned_cards[1], p.fields, p.rows, TODAY);
    expect(karta).toEqual({
      label: "Najbliższy termin",
      value: "Projekt z baz danych",
      sub: "za 5 dni",
      urgent: true,
    });
  });

  it("Najbliższy termin pomija Zrobione i minione, nieurgentny gdy dalej niż 7 dni", () => {
    const p = projekty();
    const rows = p.rows.filter((r) => r.id !== "r1");
    const karta = computeCard(p.settings.pinned_cards[1], p.fields, rows, TODAY);
    expect(karta.value).toBe("Strona Fanaberia");
    expect(karta.sub).toBe("za 15 dni");
    expect(karta.urgent).toBe(false);
    const brak = computeCard(p.settings.pinned_cards[1], p.fields, [], TODAY);
    expect(brak.value).toBe("Brak terminów");
  });

  it("W toku i Zrobione jako „x / N”", () => {
    const p = projekty();
    expect(computeCard(p.settings.pinned_cards[0], p.fields, p.rows, TODAY).value).toBe("3");
    expect(computeCard(p.settings.pinned_cards[2], p.fields, p.rows, TODAY).value).toBe("1 / 8");
  });
});

describe("computeCard: Websites", () => {
  it("Klienci to liczba różnych niepustych", () => {
    const t = szablon("websites");
    const klient = t.pole("Klient").id;
    const rows = [
      wiersz(1, { [klient]: "Fanaberia" }),
      wiersz(2, { [klient]: "ja" }),
      wiersz(3, { [klient]: "ja" }),
      wiersz(4, { [klient]: "" }),
      wiersz(5, {}),
    ];
    const karta = computeCard(t.settings.pinned_cards[2], t.fields, rows, TODAY);
    expect(karta).toEqual({ label: "Klienci", value: "2", sub: "" });
  });

  it("Klienci łączy zapisy różniące się wielkością liter", () => {
    const t = szablon("websites");
    const klient = t.pole("Klient").id;
    const rows = [wiersz(1, { [klient]: "Fanaberia" }), wiersz(2, { [klient]: "fanaberia" })];
    expect(computeCard(t.settings.pinned_cards[2], t.fields, rows, TODAY).value).toBe("1");
  });
});

describe("editorFooter", () => {
  const rows = [
    wiersz(1, { n: 10, c: true }),
    wiersz(2, { n: 5.5, c: false }),
    wiersz(3, { n: null, c: true }),
    wiersz(4, { n: 100, c: true }, "2026-11-01T00:00:00Z"),
  ];
  it("Liczba: suma, Checkbox: „x / y”, Tekst: null", () => {
    const num: PageField = { id: "n", name: "N", type: "number", config: {}, position: 0, isTitle: false };
    const chk: PageField = { id: "c", name: "C", type: "checkbox", config: {}, position: 1, isTitle: false };
    const txt: PageField = { id: "t", name: "T", type: "text", config: {}, position: 2, isTitle: false };
    expect(editorFooter(num, rows)).toBe("15,5");
    expect(editorFooter(chk, rows)).toBe("2 / 3");
    expect(editorFooter(txt, rows)).toBeNull();
  });
});
