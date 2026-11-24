import { describe, expect, it } from "vitest";
import {
  DOMYSLNA_SZEROKOSC,
  EDITOR_TYPES,
  FIELD_TYPE_META,
  KOLORY_OPCJI,
  PALETA,
  addCycle,
  convertValue,
  formatMoney,
  formatValue,
  isRecurringValue,
  isUrgent,
  monthlyAmount,
  nextOptionId,
  nextRenewal,
  normalizeValue,
  planTypeChange,
  relativeDue,
  renewalDates,
  rowActive,
  rowCycle,
  yearlyAmount,
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

  it("normalizeValue secret składa nowy obiekt tylko z v, g, iv, ct (bez dodatkowych kluczy)", () => {
    const zDodatkami = { ...wartosc, jawne: "tajne-haslo", extra: 1 };
    const v = normalizeValue(pole("secret"), zDodatkami);
    expect(v).toEqual(wartosc);
    expect(Object.keys(v as object).sort()).toEqual(["ct", "g", "iv", "v"]);
    expect(v).not.toBe(zDodatkami);
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

describe("stałe tabeli", () => {
  it("KOLORY_OPCJI to „Bez koloru” i 8 kolorów PALETA z polskimi nazwami", () => {
    expect(KOLORY_OPCJI[0]).toEqual({ color: "", name: "Bez koloru" });
    expect(KOLORY_OPCJI.slice(1).map((k) => k.color)).toEqual(PALETA);
    expect(KOLORY_OPCJI.slice(1).map((k) => k.name)).toEqual([
      "Niebieski",
      "Zielony",
      "Fioletowy",
      "Pomarańczowy",
      "Czerwony",
      "Turkusowy",
      "Żółty",
      "Szary",
    ]);
  });

  it("DOMYSLNA_SZEROKOSC ma wartości z ograniczeń", () => {
    expect(DOMYSLNA_SZEROKOSC).toEqual({
      text: 220,
      url: 220,
      select: 180,
      status: 180,
      secret: 180,
      date: 140,
      rating: 130,
      number: 120,
      checkbox: 90,
      recurring: 200,
      renewal: 230,
    });
  });
});

const NBSP = "\u00a0";

describe("Kwota cykliczna: normalizeValue i formatValue", () => {
  it("meta typów", () => {
    expect(FIELD_TYPE_META.recurring).toMatchObject({ icon: "↻zł", label: "Kwota cykliczna" });
    expect(FIELD_TYPE_META.renewal).toMatchObject({ icon: "↻", label: "Data odnowienia" });
  });

  it("obiekt {amount, cycle}: tylko dwa klucze, kwota do 2 miejsc", () => {
    const f = pole("recurring");
    expect(normalizeValue(f, { amount: 43, cycle: "month", extra: 1 })).toEqual({ amount: 43, cycle: "month" });
    expect(Object.keys(normalizeValue(f, { amount: 43, cycle: "month", extra: 1 }) as object)).toEqual([
      "amount",
      "cycle",
    ]);
    expect(normalizeValue(f, { amount: 10.005, cycle: "year" })).toEqual({ amount: 10.01, cycle: "year" });
    expect(normalizeValue(f, { amount: 0, cycle: "year" })).toEqual({ amount: 0, cycle: "year" });
  });

  it("zakres kwoty: ujemna, powyżej 1e9, NaN i zły cykl dają null", () => {
    const f = pole("recurring");
    expect(normalizeValue(f, { amount: -1, cycle: "month" })).toBeNull();
    expect(normalizeValue(f, { amount: 1e9 + 1, cycle: "month" })).toBeNull();
    expect(normalizeValue(f, { amount: 1e9, cycle: "month" })).toEqual({ amount: 1e9, cycle: "month" });
    expect(normalizeValue(f, { amount: Number.NaN, cycle: "month" })).toBeNull();
    expect(normalizeValue(f, { amount: 5, cycle: "week" })).toBeNull();
    expect(normalizeValue(f, true)).toBeNull();
    expect(normalizeValue(f, null)).toBeNull();
  });

  it("liczba i tekst z przecinkiem dostają cykl domyślny pola", () => {
    expect(normalizeValue(pole("recurring"), "43,5")).toEqual({ amount: 43.5, cycle: "month" });
    expect(normalizeValue(pole("recurring"), 12)).toEqual({ amount: 12, cycle: "month" });
    expect(normalizeValue(pole("recurring", { default_cycle: "year" }), 12)).toEqual({ amount: 12, cycle: "year" });
    expect(normalizeValue(pole("recurring"), "abc")).toBeNull();
  });

  it("formatValue: kwota z formatMoney i cykl", () => {
    const f = pole("recurring");
    expect(formatValue(f, { amount: 43, cycle: "month" })).toBe("43,00 zł / mies.");
    expect(formatValue(f, { amount: 249.99, cycle: "year" })).toBe("249,99 zł / rok");
    expect(formatValue(f, { amount: 1234.5, cycle: "month" })).toBe(`1${NBSP}234,50 zł / mies.`);
    expect(formatValue(f, null)).toBe("");
  });

  it("Data odnowienia: jak data", () => {
    const f = pole("renewal");
    expect(normalizeValue(f, "2026-11-21")).toBe("2026-11-21");
    expect(normalizeValue(f, "2026-02-30")).toBeNull();
    expect(formatValue(f, "2026-11-21")).toBe("21.11.2026");
  });

  it("isRecurringValue, monthlyAmount, yearlyAmount", () => {
    expect(isRecurringValue({ amount: 1, cycle: "year" })).toBe(true);
    expect(isRecurringValue({ amount: "1", cycle: "year" })).toBe(false);
    expect(isRecurringValue(null)).toBe(false);
    expect(monthlyAmount({ amount: 120, cycle: "year" })).toBe(10);
    expect(monthlyAmount({ amount: 50, cycle: "month" })).toBe(50);
    expect(yearlyAmount({ amount: 50, cycle: "month" })).toBe(600);
    expect(yearlyAmount({ amount: 600, cycle: "year" })).toBe(600);
  });
});

describe("formatMoney", () => {
  it("2 miejsca, przecinek, tysiące twardą spacją", () => {
    expect(formatMoney(5255.28)).toBe(`5${NBSP}255,28`);
    expect(formatMoney(0)).toBe("0,00");
    expect(formatMoney(43)).toBe("43,00");
    expect(formatMoney(1234567.891)).toBe(`1${NBSP}234${NBSP}567,89`);
  });

  it("NaN i nieskończoność dają 0,00", () => {
    expect(formatMoney(Number.NaN)).toBe("0,00");
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe("0,00");
    expect(formatMoney(Number.NEGATIVE_INFINITY)).toBe("0,00");
  });

  it("bez „-0,00”: znak tylko, gdy zaokrąglona kwota nie jest zerem", () => {
    expect(formatMoney(-0)).toBe("0,00");
    expect(formatMoney(-0.001)).toBe("0,00");
    expect(formatMoney(-0.004)).toBe("0,00");
    expect(formatMoney(-0.005)).toBe("-0,01");
    expect(formatMoney(-1234.5)).toBe(`-1${NBSP}234,50`);
  });
});

describe("addCycle", () => {
  it("dzień obcięty do długości miesiąca, zawsze od kotwicy", () => {
    expect(addCycle("2026-01-31", "month", 0)).toBe("2026-01-31");
    expect(addCycle("2026-01-31", "month", 1)).toBe("2026-02-28");
    expect(addCycle("2026-01-31", "month", 2)).toBe("2026-03-31");
    expect(addCycle("2026-01-31", "month", 3)).toBe("2026-04-30");
    expect(addCycle("2028-01-31", "month", 1)).toBe("2028-02-29");
    expect(addCycle("2026-11-21", "month", 2)).toBe("2027-01-21");
  });

  it("cykl roczny: 29.02 w latach nieprzestępnych to 28.02", () => {
    expect(addCycle("2024-02-29", "year", 1)).toBe("2025-02-28");
    expect(addCycle("2024-02-29", "year", 4)).toBe("2028-02-29");
  });
});

describe("nextRenewal", () => {
  it("kotwica dziś lub później zostaje", () => {
    expect(nextRenewal("2026-11-21", "month", "2026-11-15")).toBe("2026-11-21");
    expect(nextRenewal("2026-10-21", "month", "2026-10-21")).toBe("2026-10-21");
  });

  it("kotwica w przeszłości: najbliższe k ≥ 1 z terminem ≥ dziś", () => {
    expect(nextRenewal("2026-10-21", "month", "2026-11-15")).toBe("2026-11-21");
    expect(nextRenewal("2026-10-21", "month", "2026-11-21")).toBe("2026-11-21");
    expect(nextRenewal("2026-10-21", "month", "2026-11-22")).toBe("2026-12-21");
    expect(nextRenewal("2025-03-14", "year", "2026-11-24")).toBe("2027-03-14");
    expect(nextRenewal("2025-03-14", "year", "2026-03-14")).toBe("2026-03-14");
  });

  it("31.01 liczy się od kotwicy: 28.02, 31.03, 30.04", () => {
    expect(nextRenewal("2026-01-31", "month", "2026-02-01")).toBe("2026-02-28");
    expect(nextRenewal("2026-01-31", "month", "2026-03-01")).toBe("2026-03-31");
    expect(nextRenewal("2026-01-31", "month", "2026-04-01")).toBe("2026-04-30");
  });

  it("odległa kotwica", () => {
    expect(nextRenewal("2010-05-05", "month", "2026-11-24")).toBe("2026-12-05");
    expect(nextRenewal("2010-05-05", "year", "2026-11-24")).toBe("2027-05-05");
  });
});

describe("renewalDates", () => {
  it("wystąpienia w zakresie", () => {
    expect(renewalDates("2026-10-21", "month", "2026-11-16", "2026-12-31")).toEqual([
      "2026-11-21",
      "2026-12-21",
    ]);
  });

  it("przed kotwicą nic, a kotwica w zakresie się liczy", () => {
    expect(renewalDates("2026-11-21", "month", "2026-11-01", "2026-11-20")).toEqual([]);
    expect(renewalDates("2026-11-21", "month", "2026-11-01", "2026-12-31")).toEqual([
      "2026-11-21",
      "2026-12-21",
    ]);
  });

  it("roczny i granice zakresu włącznie", () => {
    expect(renewalDates("2024-02-29", "year", "2025-02-28", "2025-02-28")).toEqual(["2025-02-28"]);
    expect(renewalDates("2025-03-14", "year", "2026-01-01", "2026-03-13")).toEqual([]);
    expect(renewalDates("2026-01-31", "month", "2026-02-01", "2026-04-30")).toEqual([
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });
});

describe("rowCycle i rowActive", () => {
  const kwota: PageField = { id: "kw", name: "Kwota", type: "recurring", config: { default_cycle: "year" }, position: 1, isTitle: false };
  const aktywna: PageField = { id: "ak", name: "Aktywna", type: "checkbox", config: {}, position: 2, isTitle: false };
  const liczba: PageField = { id: "li", name: "Liczba", type: "number", config: {}, position: 3, isTitle: false };
  const wszystkie = [kwota, aktywna, liczba];

  it("rowCycle: z wartości kwoty", () => {
    const o = pole("renewal", { cycle_field_id: "kw", cycle: "month" });
    expect(rowCycle(o, wszystkie, { kw: { amount: 5, cycle: "year" } })).toBe("year");
    expect(rowCycle(o, wszystkie, { kw: { amount: 5, cycle: "month" } })).toBe("month");
  });

  it("rowCycle: pusta kwota daje default_cycle pola kwoty", () => {
    const o = pole("renewal", { cycle_field_id: "kw", cycle: "month" });
    expect(rowCycle(o, wszystkie, {})).toBe("year");
  });

  it("rowCycle: bez cycle_field_id bierze config.cycle, a bez niego miesiąc", () => {
    expect(rowCycle(pole("renewal", { cycle: "year" }), wszystkie, {})).toBe("year");
    expect(rowCycle(pole("renewal"), wszystkie, {})).toBe("month");
  });

  it("rowCycle: cycle_field_id wskazujące pole innego typu albo brak pola to brak odwołania (D18)", () => {
    expect(rowCycle(pole("renewal", { cycle_field_id: "li", cycle: "year" }), wszystkie, { li: 3 })).toBe("year");
    expect(rowCycle(pole("renewal", { cycle_field_id: "nie-ma", cycle: "year" }), wszystkie, {})).toBe("year");
  });

  it("rowActive: brak active_field_id to aktywny", () => {
    expect(rowActive(pole("renewal"), wszystkie, {})).toBe(true);
  });

  it("rowActive: true aktywny, false albo brak wartości nieaktywny", () => {
    const o = pole("renewal", { active_field_id: "ak" });
    expect(rowActive(o, wszystkie, { ak: true })).toBe(true);
    expect(rowActive(o, wszystkie, { ak: false })).toBe(false);
    expect(rowActive(o, wszystkie, {})).toBe(false);
  });

  it("rowActive: odwołanie do pola nie-checkbox albo nieistniejącego to aktywny", () => {
    expect(rowActive(pole("renewal", { active_field_id: "li" }), wszystkie, { li: 0 })).toBe(true);
    expect(rowActive(pole("renewal", { active_field_id: "nie-ma" }), wszystkie, {})).toBe(true);
  });
});

describe("zmiana typu z i do Kwoty cyklicznej i Daty odnowienia", () => {
  it("liczba i tekst → Kwota cykliczna (cykl miesięczny)", () => {
    expect(convertValue(pole("number"), "recurring", 43.5, [])).toEqual({ amount: 43.5, cycle: "month" });
    expect(convertValue(pole("text"), "recurring", "43,5", [])).toEqual({ amount: 43.5, cycle: "month" });
    expect(convertValue(pole("text"), "recurring", "abc", [])).toBeNull();
    expect(convertValue(pole("number"), "recurring", -3, [])).toBeNull();
  });

  it("Kwota cykliczna → liczba (sama kwota) i tekst (formatValue)", () => {
    const v = { amount: 249.99, cycle: "year" };
    expect(convertValue(pole("recurring"), "number", v, [])).toBe(249.99);
    expect(convertValue(pole("recurring"), "text", v, [])).toBe("249,99 zł / rok");
  });

  it("data i tekst → Data odnowienia, ta sama data", () => {
    expect(convertValue(pole("date"), "renewal", "2026-11-21", [])).toBe("2026-11-21");
    expect(convertValue(pole("text"), "renewal", "21.11.2026", [])).toBe("2026-11-21");
    expect(convertValue(pole("text"), "renewal", "kiedyś", [])).toBeNull();
  });

  it("Data odnowienia → data (kotwica) i tekst (dd.mm.rrrr)", () => {
    expect(convertValue(pole("renewal"), "date", "2026-11-21", [])).toBe("2026-11-21");
    expect(convertValue(pole("renewal"), "text", "2026-11-21", [])).toBe("21.11.2026");
  });

  it("pozostałe przejścia dają null", () => {
    const k = { amount: 5, cycle: "month" };
    expect(convertValue(pole("recurring"), "date", k, [])).toBeNull();
    expect(convertValue(pole("recurring"), "renewal", k, [])).toBeNull();
    expect(convertValue(pole("recurring"), "rating", k, [])).toBeNull();
    expect(convertValue(pole("recurring"), "checkbox", k, [])).toBeNull();
    expect(convertValue(pole("recurring"), "url", k, [])).toBeNull();
    expect(convertValue(pole("recurring"), "select", k, [{ id: "o", label: "5,00 zł / mies.", color: "" }])).toBeNull();
    expect(convertValue(pole("renewal"), "number", "2026-11-21", [])).toBeNull();
    expect(convertValue(pole("renewal"), "recurring", "2026-11-21", [])).toBeNull();
    expect(convertValue(pole("date"), "recurring", "2026-11-21", [])).toBeNull();
    expect(convertValue(pole("rating"), "recurring", 4, [])).toBeNull();
    expect(convertValue(pole("checkbox"), "renewal", true, [])).toBeNull();
    expect(convertValue(pole("number"), "renewal", 3, [])).toBeNull();
  });

  it("planTypeChange: nowa Data odnowienia i Kwota cykliczna dostają config", () => {
    const wiersze = [{ id: "r1", values: { f1: "2026-11-21" } as Record<string, unknown> }];
    const zDaty = planTypeChange(pole("date", { show_in_calendar: false }), "renewal", wiersze);
    expect(zDaty.config).toEqual({ show_in_calendar: false, cycle: "month" });
    expect(zDaty.values.r1).toBe("2026-11-21");
    expect(planTypeChange(pole("date"), "renewal", wiersze).config).toEqual({ show_in_calendar: true, cycle: "month" });
    expect(planTypeChange(pole("text"), "renewal", wiersze).config).toEqual({ show_in_calendar: true, cycle: "month" });
    const kw = planTypeChange(pole("number"), "recurring", [{ id: "r1", values: { f1: 12 } }]);
    expect(kw.config).toEqual({ default_cycle: "month" });
    expect(kw.values.r1).toEqual({ amount: 12, cycle: "month" });
    expect(kw.lost).toBe(0);
  });

  it("planTypeChange: utracone wartości przy przejściu bez ścieżki", () => {
    const wynik = planTypeChange(pole("recurring"), "date", [
      { id: "r1", values: { f1: { amount: 5, cycle: "month" } } },
      { id: "r2", values: {} },
    ]);
    expect(wynik.lost).toBe(1);
  });
});
