import { describe, expect, it } from "vitest";
import {
  EDITOR_TYPES,
  FIELD_TYPE_META,
  convertValue,
  formatValue,
  isUrgent,
  nextOptionId,
  normalizeValue,
  planTypeChange,
  relativeDue,
  type FieldConfig,
  type FieldOption,
  type FieldType,
  type PageField,
} from "./fields";

function pole(type: FieldType, config: FieldConfig = {}): PageField {
  return { id: "f1", name: "Pole", type, config, position: 0, isTitle: false };
}

const opcje: FieldOption[] = [
  { id: "o1", label: "Do zrobienia", color: "#0070f3" },
  { id: "o2", label: "Zrobione", color: "#15803d" },
];

describe("meta typów", () => {
  it("ikony z makiet: komponenty lucide, znak zostaje dla telefonu", () => {
    for (const typ of Object.keys(FIELD_TYPE_META) as (keyof typeof FIELD_TYPE_META)[]) {
      expect(FIELD_TYPE_META[typ].Icon).toBeTruthy();
    }
    for (const t of EDITOR_TYPES) expect(t.Icon).toBeTruthy();
    expect(FIELD_TYPE_META.text.icon).toBe("Aa");
    expect(FIELD_TYPE_META.rating.icon).toBe("★");
  });

  it("edytor ma 6 typów z EmptyPage", () => {
    expect(EDITOR_TYPES.map((t) => t.label)).toEqual([
      "Tekst",
      "Liczba",
      "Data",
      "Wybór",
      "Checkbox",
      "Link",
    ]);
    expect(EDITOR_TYPES.map((t) => t.type)).toEqual([
      "text",
      "number",
      "date",
      "status",
      "checkbox",
      "url",
    ]);
  });
});

describe("normalizeValue", () => {
  it("liczba", () => {
    expect(normalizeValue(pole("number"), "12,5")).toBe(12.5);
    expect(normalizeValue(pole("number"), "abc")).toBeNull();
    expect(normalizeValue(pole("number"), 7)).toBe(7);
  });
  it("ocena", () => {
    expect(normalizeValue(pole("rating"), 0)).toBeNull();
    expect(normalizeValue(pole("rating"), 6)).toBeNull();
    expect(normalizeValue(pole("rating"), 3)).toBe(3);
  });
  it("checkbox nie zgaduje", () => {
    expect(normalizeValue(pole("checkbox"), true)).toBe(true);
    expect(normalizeValue(pole("checkbox"), "x")).toBeNull();
  });
  it("data", () => {
    expect(normalizeValue(pole("date"), "2026-02-30")).toBeNull();
    expect(normalizeValue(pole("date"), "2026-11-20")).toBe("2026-11-20");
  });
  it("select spoza opcji", () => {
    const f = pole("select", { options: opcje });
    expect(normalizeValue(f, "zzz")).toBeNull();
    expect(normalizeValue(f, "o2")).toBe("o2");
  });
  it("url i tekst", () => {
    expect(normalizeValue(pole("url"), "  ")).toBeNull();
    expect(normalizeValue(pole("text"), "")).toBeNull();
    expect(normalizeValue(pole("text"), "abc")).toBe("abc");
  });
});

describe("formatValue", () => {
  it("liczby", () => {
    expect(formatValue(pole("number", { number_format: "pln" }), 43)).toBe("43,00 zł");
    expect(formatValue(pole("number", { number_format: "percent" }), 43)).toBe("43%");
    expect(formatValue(pole("number", { number_format: "plain" }), 1234.5)).toBe("1234,5");
  });
  it("data, url, ocena, checkbox, status", () => {
    expect(formatValue(pole("date"), "2026-11-20")).toBe("20.11.2026");
    expect(formatValue(pole("url"), "https://www.github.com/x")).toBe("github.com/x");
    expect(formatValue(pole("rating"), 4)).toBe("★★★★☆");
    expect(formatValue(pole("checkbox"), true)).toBe("✓");
    expect(formatValue(pole("checkbox"), false)).toBe("");
    expect(formatValue(pole("status", { options: opcje }), "o1")).toBe("Do zrobienia");
  });
  it("formatValue tolerates invalid stored values", () => {
    expect(formatValue(pole("number"), "abc")).toBe("");
    expect(formatValue(pole("status", { options: opcje }), "nieznane")).toBe("");
  });
});

describe("convertValue", () => {
  it("tekst -> liczba", () => {
    expect(convertValue(pole("text"), "number", "12", [])).toBe(12);
    expect(convertValue(pole("text"), "number", "dwa", [])).toBeNull();
  });
  it("tekst -> checkbox", () => {
    for (const s of ["tak", "1", "x", "X"]) {
      expect(convertValue(pole("text"), "checkbox", s, [])).toBe(true);
    }
    expect(convertValue(pole("text"), "checkbox", "nie", [])).toBe(false);
    expect(convertValue(pole("text"), "checkbox", "", [])).toBeNull();
  });
  it("tekst -> data", () => {
    expect(convertValue(pole("text"), "date", "20.11.2026", [])).toBe("2026-11-20");
    expect(convertValue(pole("text"), "date", "2026-11-20", [])).toBe("2026-11-20");
    expect(convertValue(pole("text"), "date", "jutro", [])).toBeNull();
  });
  it("tekst -> status po etykiecie", () => {
    expect(convertValue(pole("text"), "status", "Zrobione", opcje)).toBe("o2");
    expect(convertValue(pole("text"), "status", "Inne", opcje)).toBeNull();
  });
  it("na tekst", () => {
    expect(convertValue(pole("number"), "text", 12.5, [])).toBe("12,5");
    expect(convertValue(pole("status", { options: opcje }), "text", "o1", [])).toBe("Do zrobienia");
    expect(convertValue(pole("checkbox"), "text", true, [])).toBe("tak");
    expect(convertValue(pole("checkbox"), "text", false, [])).toBe("nie");
  });
  it("status -> select zachowuje id", () => {
    expect(convertValue(pole("status", { options: opcje }), "select", "o2", opcje)).toBe("o2");
  });
  it("ocena <-> liczba", () => {
    expect(convertValue(pole("rating"), "number", 4, [])).toBe(4);
    expect(convertValue(pole("number"), "rating", 7, [])).toBeNull();
    expect(convertValue(pole("number"), "rating", 3, [])).toBe(3);
  });
});

describe("planTypeChange", () => {
  it("tekst -> status zbiera opcje w kolejności pierwszego wystąpienia", () => {
    let n = 0;
    const plan = planTypeChange(
      pole("text"),
      "status",
      [
        { id: "r1", values: { f1: "Rozrywka" } },
        { id: "r2", values: { f1: "Praca" } },
        { id: "r3", values: { f1: "Rozrywka" } },
        { id: "r4", values: { f1: "" } },
      ],
      () => `id${++n}`,
    );
    expect(plan.config.options).toEqual([
      { id: "id1", label: "Rozrywka", color: "#0070f3" },
      { id: "id2", label: "Praca", color: "#15803d" },
    ]);
    expect(plan.values).toEqual({ r1: "id1", r2: "id2", r3: "id1", r4: null });
    expect(plan.lost).toBe(0);
  });
  it("tekst -> liczba liczy utracone", () => {
    const plan = planTypeChange(pole("text"), "number", [
      { id: "r1", values: { f1: "5" } },
      { id: "r2", values: { f1: "pięć" } },
    ]);
    expect(plan.values.r1).toBe(5);
    expect(plan.values.r2).toBeNull();
    expect(plan.lost).toBe(1);
  });
  it("status -> select zachowuje opcje, domyślne id przez crypto", () => {
    const plan = planTypeChange(pole("status", { options: opcje }), "select", [
      { id: "r1", values: { f1: "o1" } },
    ]);
    expect(plan.config.options).toEqual(opcje);
    expect(plan.values.r1).toBe("o1");
    expect(plan.lost).toBe(0);
  });
  it("zostawia number_format tylko dla liczby", () => {
    const plan = planTypeChange(pole("number", { number_format: "pln" }), "text", []);
    expect(plan.config.number_format).toBeUndefined();
  });
});

describe("relativeDue uses provided today", () => {
  const dzis = "2026-11-15";
  it("teksty", () => {
    expect(relativeDue("2026-11-14", dzis).text).toBe("minął");
    expect(relativeDue("2026-11-15", dzis).text).toBe("dziś");
    expect(relativeDue("2026-11-16", dzis).text).toBe("jutro");
    expect(relativeDue("2026-11-20", dzis)).toEqual({ text: "za 5 dni", days: 5 });
    expect(relativeDue("2027-01-14", dzis).text).toBe("za 60 dni");
    expect(relativeDue("2027-02-15", dzis).text).toBe("za 3 mies.");
  });
});

describe("isUrgent", () => {
  const dzis = "2026-11-15";
  it("okno 0..7 dni", () => {
    expect(isUrgent("2026-11-15", dzis, false)).toBe(true);
    expect(isUrgent("2026-11-22", dzis, false)).toBe(true);
    expect(isUrgent("2026-11-23", dzis, false)).toBe(false);
    expect(isUrgent("2026-11-14", dzis, false)).toBe(false);
    expect(isUrgent("2026-11-16", dzis, true)).toBe(false);
    expect(isUrgent(null, dzis, false)).toBe(false);
  });
});

describe("nextOptionId", () => {
  const opcje = [
    { id: "a", label: "A", color: "#404040" },
    { id: "b", label: "B", color: "#0070f3" },
  ];
  it("przechodzi po kolei, po ostatniej zwraca pustą, z pustej pierwszą", () => {
    expect(nextOptionId(opcje, null)).toBe("a");
    expect(nextOptionId(opcje, "a")).toBe("b");
    expect(nextOptionId(opcje, "b")).toBeNull();
  });
  it("nieznana wartość działa jak pusta, brak opcji daje pustą", () => {
    expect(nextOptionId(opcje, "usunieta")).toBe("a");
    expect(nextOptionId([], "a")).toBeNull();
  });
});

describe("Sekret", () => {
  const wartosc = { v: 1, g: 1, iv: "A".repeat(16), ct: "B".repeat(24) };

  it("meta: ikona KeyRound i etykieta Sekret", () => {
    expect(FIELD_TYPE_META.secret.label).toBe("Sekret");
    expect(FIELD_TYPE_META.secret.Icon).toBeTruthy();
  });

  it("normalizeValue: null albo SecretValue, inaczej null", () => {
    expect(normalizeValue(pole("secret"), wartosc)).toEqual(wartosc);
    expect(normalizeValue(pole("secret"), null)).toBeNull();
    expect(normalizeValue(pole("secret"), "tekst")).toBeNull();
    expect(normalizeValue(pole("secret"), { ...wartosc, v: 2 })).toBeNull();
    expect(normalizeValue(pole("secret"), 5)).toBeNull();
  });

  it("formatValue nigdy nie zwraca szyfrogramu; convertValue z i na secret daje null", () => {
    expect(formatValue(pole("secret"), wartosc)).toBe("");
    expect(convertValue(pole("secret"), "text", wartosc, [])).toBeNull();
    expect(convertValue(pole("text"), "secret", "abc", [])).toBeNull();
  });

  it("edytor nie ma typu Sekret", () => {
    expect(EDITOR_TYPES.some((t) => (t.type as string) === "secret")).toBe(false);
  });
});
