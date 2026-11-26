import { describe, expect, it } from "vitest";
import { csvToValues, parseCsv, suggestMapping, toCsv, type CsvMapping } from "./csv";
import type { PageField } from "./fields";
import type { PageRow } from "./table-model";

const pole = (id: string, name: string, type: PageField["type"], config: PageField["config"] = {}): PageField => ({
  id,
  name,
  type,
  config,
  position: 0,
  isTitle: false,
});
const wiersz = (id: string, values: Record<string, unknown>): PageRow => ({
  id,
  values,
  position: 0,
  deletedAt: null,
});

const OPCJE = [
  { id: "o1", label: "Czytam", color: "#0070f3" },
  { id: "o2", label: "Przeczytana", color: "#15803d" },
];

describe("toCsv", () => {
  const pola = [
    pole("t", "Tytuł", "text"),
    pole("h", "Hasło", "secret"),
    pole("s", "Status", "status", { options: OPCJE }),
    pole("d", "Data", "date"),
    pole("n", "Cena", "number"),
    pole("k", "Kwota", "recurring"),
    pole("c", "Zrobione", "checkbox"),
  ];

  it("zaczyna się od BOM, pomija pola secret, ma nagłówek z nazw pól", () => {
    const csv = toCsv(pola, [wiersz("r1", { t: "Dune", h: { v: 1, g: 1, iv: "a", ct: "b" } })]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [naglowek] = csv.slice(1).split("\r\n");
    expect(naglowek).toBe("Tytuł,Status,Data,Cena,Kwota,Zrobione");
    expect(csv).not.toContain("Hasło");
    expect(csv).not.toContain("ct");
  });

  it("pole z przecinkiem i cudzysłowem trafia w cudzysłowie z podwojonym \"", () => {
    const csv = toCsv([pole("t", "Tytuł", "text")], [wiersz("r1", { t: 'a, "b"' })]);
    expect(csv.slice(1).split("\r\n")[1]).toBe('"a, ""b"""');
  });

  it("wartości: etykieta opcji, data RRRR-MM-DD, liczba z kropką, kwota cykliczna tekstem, checkbox tak/nie", () => {
    const csv = toCsv(pola, [
      wiersz("r1", {
        t: "A",
        s: "o1",
        d: "2026-11-21",
        n: 43.5,
        k: { amount: 43, cycle: "month" },
        c: true,
      }),
      wiersz("r2", { t: "B", k: { amount: 120, cycle: "year" }, c: false }),
    ]);
    const linie = csv.slice(1).split("\r\n");
    expect(linie[1]).toBe("A,Czytam,2026-11-21,43.5,43.00 / mies.,tak");
    expect(linie[2]).toBe("B,,,,120.00 / rok,nie");
  });
});

describe("toCsv i csvToValues: formuły", () => {
  const pola = [
    pole("t", "=Tytuł", "text"),
    pole("u", "Link", "url"),
    pole("s", "Status", "status", { options: [{ id: "o1", label: "+plus", color: "#000" }] }),
    pole("n", "Cena", "number"),
  ];
  it("prefiksuje ' tekst, link, etykietę opcji i nagłówek zaczynające się od = + - @; liczby bez zmian", () => {
    const csv = toCsv(pola, [wiersz("r1", { t: "=SUM(A1)", u: "@x", s: "o1", n: -5 }), wiersz("r2", { t: "-1+2" })]);
    const linie = csv.slice(1).split("\r\n");
    expect(linie[0]).toBe("'=Tytuł,Link,Status,Cena");
    expect(linie[1]).toBe("'=SUM(A1),'@x,'+plus,-5");
    expect(linie[2]).toBe("'-1+2,,,");
  });
  it("import zdejmuje jeden ' przed znakiem formuły; reszta apostrofów zostaje; round trip", () => {
    const csv = toCsv(pola, [wiersz("r1", { t: "=SUM(A1)", u: "@x", s: "o1" })]);
    const p = parseCsv(csv);
    const m = suggestMapping(p.header, pola);
    expect(m[0].target).toEqual({ kind: "field", field_id: "t" });
    const w = csvToValues(p.rows, m, pola);
    expect(w.rows[0]).toEqual({ t: "=SUM(A1)", u: "@x", s: "o1", n: null });
    const z = csvToValues([["'tekst", "''=x"]], [
      { column: 0, target: { kind: "field", field_id: "t" } },
      { column: 1, target: { kind: "field", field_id: "u" } },
    ], pola);
    expect(z.rows[0]).toEqual({ t: "'tekst", u: "'=x" });
  });
});

describe("parseCsv", () => {
  it("rozpoznaje ; z Excela", () => {
    expect(parseCsv("a;b\r\n1;2\r\n")).toEqual({ header: ["a", "b"], rows: [["1", "2"]] });
  });
  it("zdejmuje BOM i obsługuje CRLF oraz LF", () => {
    expect(parseCsv("﻿a,b\n1,2\r\n3,4")).toEqual({
      header: ["a", "b"],
      rows: [
        ["1", "2"],
        ["3", "4"],
      ],
    });
  });
  it("pole w cudzysłowie może mieć nową linię, przecinek i podwojony cudzysłów", () => {
    const w = parseCsv('a,b\n"x\ny","z, ""q"""\n');
    expect(w.rows).toEqual([["x\ny", 'z, "q"']]);
  });
  it("pomija puste końcowe wiersze", () => {
    expect(parseCsv("a,b\n1,2\n\n\n").rows).toEqual([["1", "2"]]);
    expect(parseCsv("a,b\n1,2\n,\n").rows).toEqual([["1", "2"]]);
  });
  it("pusty tekst daje pusty nagłówek", () => {
    expect(parseCsv("")).toEqual({ header: [], rows: [] });
  });
});

describe("suggestMapping", () => {
  const pola = [pole("t", "Tytuł", "text"), pole("h", "Hasło", "secret"), pole("d", "Data", "date")];
  it("dopasowuje po nazwie bez wielkości liter, reszta to nowe pole tekstowe, secret nie jest celem", () => {
    expect(suggestMapping(["tytuł", "Hasło", "Uwagi", "DATA"], pola)).toEqual([
      { column: 0, target: { kind: "field", field_id: "t" } },
      { column: 1, target: { kind: "new", name: "Hasło", type: "text" } },
      { column: 2, target: { kind: "new", name: "Uwagi", type: "text" } },
      { column: 3, target: { kind: "field", field_id: "d" } },
    ]);
  });
});

describe("csvToValues", () => {
  const pola = [
    pole("t", "Tytuł", "text"),
    pole("n", "Cena", "number"),
    pole("d", "Data", "date"),
    pole("s", "Status", "status", { options: OPCJE }),
    pole("h", "Hasło", "secret"),
    pole("k", "Kwota", "recurring"),
    pole("c", "Zrobione", "checkbox"),
  ];
  const mapowanie = (...ids: string[]): CsvMapping =>
    ids.map((id, i) => ({ column: i, target: { kind: "field", field_id: id } }));

  it("liczby: 43,50 / 43.50 / 1 234,50", () => {
    const w = csvToValues([["43,50"], ["43.50"], ["1 234,50"], ["1 234,50"], ["abc"]], mapowanie("n"), pola);
    expect(w.rows.map((r) => r.n)).toEqual([43.5, 43.5, 1234.5, 1234.5, null]);
  });

  it("daty: 21.11.2026, 2026-11-21, 21/11/2026 → ISO; błędna → null", () => {
    const w = csvToValues([["21.11.2026"], ["2026-11-21"], ["21/11/2026"], ["31.02.2026"], ["x"]], mapowanie("d"), pola);
    expect(w.rows.map((r) => r.d)).toEqual(["2026-11-21", "2026-11-21", "2026-11-21", null, null]);
  });

  it("etykieta opcji → id opcji (bez wielkości liter); nieznana → nowa opcja zwracana osobno", () => {
    const w = csvToValues([["czytam"], ["Porzucona"], ["porzucona"]], mapowanie("s"), pola);
    expect(w.newOptions.s).toHaveLength(1);
    expect(w.newOptions.s[0].label).toBe("Porzucona");
    expect(w.rows.map((r) => r.s)).toEqual(["o1", w.newOptions.s[0].id, w.newOptions.s[0].id]);
    expect(w.newOptions.s[0].color).toBe("#7c3aed");
  });

  it("nie zapisuje pól secret ani celu skip", () => {
    const m: CsvMapping = [
      { column: 0, target: { kind: "field", field_id: "h" } },
      { column: 1, target: { kind: "skip" } },
      { column: 2, target: { kind: "field", field_id: "t" } },
    ];
    const w = csvToValues([["tajne", "x", "Dune"]], m, pola);
    expect(w.rows).toEqual([{ t: "Dune" }]);
  });

  it("nowe pola trafiają pod kluczem new:<indeks>", () => {
    const m: CsvMapping = [
      { column: 0, target: { kind: "new", name: "Uwagi", type: "text" } },
      { column: 1, target: { kind: "field", field_id: "t" } },
      { column: 2, target: { kind: "new", name: "Ocena", type: "number" } },
    ];
    const w = csvToValues([["hej", "Dune", "7,5"]], m, pola);
    expect(w.rows).toEqual([{ "new:0": "hej", t: "Dune", "new:1": 7.5 }]);
  });

  it("nowe pole typu select dostaje opcje pod kluczem new:<indeks>", () => {
    const m: CsvMapping = [{ column: 0, target: { kind: "new", name: "Gatunek", type: "select" } }];
    const w = csvToValues([["Sci-fi"], ["Dramat"], ["sci-fi"]], m, pola);
    expect(w.newOptions["new:0"].map((o) => o.label)).toEqual(["Sci-fi", "Dramat"]);
    expect(w.rows[2]["new:0"]).toBe(w.rows[0]["new:0"]);
  });

  it("kwota cykliczna i checkbox", () => {
    const w = csvToValues(
      [["43.00 / mies.", "tak"], ["120,00 / rok", "Nie"], ["15", "?"]],
      mapowanie("k", "c"),
      pola,
    );
    expect(w.rows).toEqual([
      { k: { amount: 43, cycle: "month" }, c: true },
      { k: { amount: 120, cycle: "year" }, c: false },
      { k: { amount: 15, cycle: "month" }, c: null },
    ]);
  });
});
