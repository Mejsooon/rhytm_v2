import { describe, expect, it } from "vitest";
import type { PageField } from "./fields";
import { effectiveView, groupRows, searchRows, viewCount } from "./table-views";
import { visibleRows } from "./table-model";
import type { PageRow, TableSettings, TableView } from "./table-model";

const pola: PageField[] = [
  { id: "n", name: "Nazwa", type: "text", config: {}, position: 0, isTitle: true },
  {
    id: "s",
    name: "Status",
    type: "status",
    config: {
      options: [
        { id: "o1", label: "Do zrobienia", color: "gray" },
        { id: "o2", label: "W toku", color: "blue" },
        { id: "o3", label: "Gotowe", color: "green" },
      ],
    },
    position: 1,
    isTitle: false,
  },
  { id: "h", name: "Hasło", type: "secret", config: {}, position: 2, isTitle: false },
];

function w(i: number, values: Record<string, unknown>, deletedAt: string | null = null): PageRow {
  return { id: `r${i}`, values, position: i, deletedAt };
}

const ustawienia: TableSettings = {
  sort: [{ field_id: "n", dir: "desc" }],
  filters: [{ field_id: "s", op: "in", value: ["o1"] }],
  hidden_field_ids: ["h"],
  column_summaries: {},
  pinned_cards: [],
  column_widths: {},
  views: [],
  active_view_id: null,
  group_by: "s",
  layout: "board",
  collapsed_groups: {},
};

describe("effectiveView", () => {
  it("bez aktywnego widoku zwraca ustawienia Wszystkich", () => {
    expect(effectiveView(ustawienia)).toEqual({
      filters: ustawienia.filters,
      sort: ustawienia.sort,
      group_by: "s",
      layout: "board",
      hidden_field_ids: ["h"],
    });
  });

  it("zwraca aktywny widok", () => {
    const widok: TableView = {
      id: "v1",
      name: "Moje",
      filters: [],
      sort: [],
      group_by: null,
      layout: "table",
      hidden_field_ids: [],
    };
    const wynik = effectiveView({ ...ustawienia, views: [widok], active_view_id: "v1" });
    expect(wynik).toEqual({ filters: [], sort: [], group_by: null, layout: "table", hidden_field_ids: [] });
  });

  it("nieistniejący active_view_id wraca do Wszystkich", () => {
    const wynik = effectiveView({ ...ustawienia, active_view_id: "nie-ma" });
    expect(wynik.group_by).toBe("s");
    expect(wynik.layout).toBe("board");
  });
});

describe("searchRows", () => {
  const rows = [w(1, { n: "Żółw" }), w(2, { n: "Kot", h: { v: 1, g: 1, iv: "zolw", ct: "zolw" } }), w(3, {})];

  it("zolw znajduje Żółw (bez wielkości liter i diakrytyków)", () => {
    expect(searchRows(pola, rows, "zolw").map((r) => r.id)).toEqual(["r1"]);
    expect(searchRows(pola, rows, "ŻÓŁW").map((r) => r.id)).toEqual(["r1"]);
  });

  it("pole secret nie bierze udziału w szukaniu", () => {
    const sekret = [w(1, { n: "Kot", h: { v: 1, g: 1, iv: "tajne", ct: "tajne" } })];
    expect(searchRows(pola, sekret, "tajne")).toEqual([]);
  });

  it("pusta fraza zwraca wszystkie wiersze", () => {
    expect(searchRows(pola, rows, "  ")).toEqual(rows);
  });
});

describe("groupRows", () => {
  const rows = [
    w(1, { s: "o3" }),
    w(2, { s: "o1" }),
    w(3, {}),
    w(4, { s: "o1" }),
  ];

  it("grupy w kolejności opcji, puste na końcu", () => {
    const g = groupRows(pola, rows, "s");
    expect(g.map((x) => x.key)).toEqual(["o1", "o3", ""]);
    expect(g[0]).toMatchObject({ label: "Do zrobienia", color: "gray" });
    expect(g[0].rows.map((r) => r.id)).toEqual(["r2", "r4"]);
    expect(g[2]).toMatchObject({ label: "Bez wartości", color: null });
  });

  it("brak grupowania lub usunięte pole: jedna grupa key *", () => {
    for (const gb of [null, "usuniete"]) {
      const g = groupRows(pola, rows, gb);
      expect(g).toHaveLength(1);
      expect(g[0].key).toBe("*");
      expect(g[0].rows).toEqual(rows);
    }
  });

  it("checkbox grupuje na zaznaczone i niezaznaczone", () => {
    const cb: PageField = { id: "c", name: "Zrobione", type: "checkbox", config: {}, position: 3, isTitle: false };
    const g = groupRows([...pola, cb], [w(1, { c: true }), w(2, { c: false }), w(3, {})], "c");
    expect(g.map((x) => x.rows.length)).toEqual([1, 2]);
  });
});

describe("viewCount", () => {
  it("zgadza się z liczbą wierszy visibleRows dla filtrów widoku", () => {
    const rows = [w(1, { s: "o1" }), w(2, { s: "o2" }), w(3, { s: "o1" }), w(4, { s: "o1" }, "2026-11-01")];
    const widok = effectiveView(ustawienia);
    const n = viewCount(pola, rows, widok, "2026-11-17");
    expect(n).toBe(visibleRows(pola, rows, ustawienia, widok.filters, "2026-11-17").length);
    expect(n).toBe(2);
  });
});
