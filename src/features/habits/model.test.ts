import { describe, expect, it } from "vitest";
import { addDays } from "@/features/calendar/view-range";
import {
  canCheck,
  currentStreak,
  dayStats,
  heatmapMonth,
  heatmapWeeks,
  isPlanned,
  last30Comparison,
  longestStreak,
  scheduleOn,
  successRate30,
  totalChecks,
  weekProgress,
  type Checks,
  type Habit,
  type ScheduleVersion,
} from "./model";

// 2026-11-17 to wtorek, 2026-11-01 to niedziela
const DZIS = "2026-11-17";

function nawyk(id: string, schedules: ScheduleVersion[]): Habit {
  return {
    id,
    name: id,
    remindAt: null,
    showOnToday: true,
    createdAt: "2026-01-01T00:00:00Z",
    schedules,
  };
}

const codziennie = (validFrom: string): ScheduleVersion => ({
  validFrom,
  type: "daily",
  weekdays: [],
  timesPerWeek: null,
});

const wDni = (validFrom: string, weekdays: number[]): ScheduleVersion => ({
  validFrom,
  type: "weekdays",
  weekdays,
  timesPerWeek: null,
});

const razyWTyg = (validFrom: string, n: number): ScheduleVersion => ({
  validFrom,
  type: "times_per_week",
  weekdays: [],
  timesPerWeek: n,
});

// Kolejne daty od `from` (włącznie), `n` sztuk
function dni(from: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}

describe("scheduleOn / isPlanned / canCheck", () => {
  const h = nawyk("a", [
    codziennie("2026-11-01"),
    wDni("2026-11-10", [1, 3, 5]),
  ]);

  it("zmiana harmonogramu: wersja z największym validFrom ≤ dzień", () => {
    expect(isPlanned(h, "2026-11-04")).toBe(true); // śr, wersja codzienna
    expect(isPlanned(h, "2026-11-05")).toBe(true); // czw, wersja codzienna
    expect(isPlanned(h, "2026-11-11")).toBe(true); // śr, wersja pn/śr/pt
    expect(isPlanned(h, "2026-11-12")).toBe(false); // czw, wersja pn/śr/pt
    expect(scheduleOn(h, "2026-11-09")?.type).toBe("daily");
    expect(scheduleOn(h, "2026-11-10")?.type).toBe("weekdays");
  });

  it("dzień przed pierwszym validFrom to brak nawyku", () => {
    expect(scheduleOn(h, "2026-10-31")).toBeNull();
    expect(isPlanned(h, "2026-10-31")).toBe(false);
    expect(canCheck(h, "2026-10-31", DZIS)).toBe(false);
  });

  it("canCheck: nie w przyszłości, nie w dzień niezaplanowany, X/tydz. każdego dnia", () => {
    expect(canCheck(h, "2026-11-16", DZIS)).toBe(true); // pn
    expect(canCheck(h, "2026-11-12", DZIS)).toBe(false); // czw, niezaplanowany
    expect(canCheck(h, "2026-11-18", DZIS)).toBe(false); // jutro
    const t = nawyk("t", [razyWTyg("2026-11-01", 3)]);
    expect(canCheck(t, "2026-11-12", DZIS)).toBe(true);
    expect(canCheck(t, DZIS, DZIS)).toBe(true);
    expect(isPlanned(t, "2026-11-12")).toBe(false);
  });
});

describe("dayStats", () => {
  const a = nawyk("a", [codziennie("2026-11-01")]);
  const b = nawyk("b", [razyWTyg("2026-11-01", 3)]);

  it("X/tydz. liczy się dopiero po odhaczeniu", () => {
    const checks: Checks = new Map([["a", new Set([DZIS])]]);
    const przed = dayStats([a, b], checks, DZIS, DZIS);
    expect(przed.planned).toBe(1);
    expect(przed.done).toBe(1);
    expect(przed.percent).toBe(100);

    checks.set("b", new Set([DZIS]));
    const po = dayStats([a, b], checks, DZIS, DZIS);
    expect(po.planned).toBe(2);
    expect(po.done).toBe(2);
    expect(po.percent).toBe(100);
  });

  it("dzień bez planu i dzień w przyszłości mają percent null", () => {
    const checks: Checks = new Map();
    expect(dayStats([a, b], checks, "2026-10-20", DZIS).percent).toBeNull();
    expect(dayStats([a], checks, "2026-11-18", DZIS).percent).toBeNull();
    expect(dayStats([a], checks, "2026-11-16", DZIS).percent).toBe(0);
  });
});

describe("serie", () => {
  it("seria dzienna: dziś nieodhaczone nie przerywa", () => {
    const h = nawyk("a", [codziennie("2026-11-01")]);
    const checks: Checks = new Map([
      ["a", new Set(["2026-11-14", "2026-11-15", "2026-11-16"])],
    ]);
    expect(currentStreak(h, checks, DZIS, "mon")).toEqual({
      value: 3,
      unit: "days",
    });

    checks.get("a")!.add(DZIS);
    expect(currentStreak(h, checks, DZIS, "mon")).toEqual({
      value: 4,
      unit: "days",
    });
  });

  it("seria dzienna: brak 15.11 przerywa", () => {
    const h = nawyk("a", [codziennie("2026-11-01")]);
    const checks: Checks = new Map([
      ["a", new Set(["2026-11-14", "2026-11-16"])],
    ]);
    expect(currentStreak(h, checks, DZIS, "mon")).toEqual({
      value: 1,
      unit: "days",
    });
  });

  it("seria przy weekdays: dni niezaplanowane nie przerywają", () => {
    const h = nawyk("a", [wDni("2026-11-01", [1, 3, 5])]);
    const checks: Checks = new Map([
      ["a", new Set(["2026-11-09", "2026-11-11", "2026-11-13", "2026-11-16"])],
    ]);
    expect(currentStreak(h, checks, DZIS, "mon")).toEqual({
      value: 4,
      unit: "days",
    });
  });

  it("seria tygodniowa: niespełniony bieżący tydzień nie przerywa", () => {
    const h = nawyk("t", [razyWTyg("2026-11-01", 3)]);
    const checks: Checks = new Map([
      [
        "t",
        new Set([
          "2026-11-03",
          "2026-11-04",
          "2026-11-05",
          "2026-11-10",
          "2026-11-12",
          "2026-11-14",
          "2026-11-16",
        ]),
      ],
    ]);
    expect(currentStreak(h, checks, DZIS, "mon")).toEqual({
      value: 2,
      unit: "weeks",
    });
  });

  it("seria tygodniowa: tydzień z innym typem harmonogramu przerywa", () => {
    const h = nawyk("t", [codziennie("2026-10-01"), razyWTyg("2026-11-09", 2)]);
    const checks: Checks = new Map([
      [
        "t",
        new Set([
          "2026-11-03",
          "2026-11-04",
          "2026-11-10",
          "2026-11-12",
          "2026-11-16",
        ]),
      ],
    ]);
    expect(currentStreak(h, checks, DZIS, "mon")).toEqual({
      value: 1,
      unit: "weeks",
    });
  });

  it("najdłuższa seria dzienna i tygodniowa", () => {
    const h = nawyk("a", [codziennie("2026-11-01")]);
    const checks: Checks = new Map([
      [
        "a",
        new Set([
          ...dni("2026-11-01", 5),
          "2026-11-14",
          "2026-11-15",
          "2026-11-16",
        ]),
      ],
    ]);
    expect(longestStreak(h, checks, DZIS, "mon")).toEqual({
      value: 5,
      unit: "days",
    });

    const t = nawyk("t", [razyWTyg("2026-10-01", 1)]);
    // tygodnie (pn): 5.10, 12.10, 19.10 spełnione, 26.10 nie, 2.11 i 9.11 spełnione
    const tChecks: Checks = new Map([
      [
        "t",
        new Set([
          "2026-10-06",
          "2026-10-13",
          "2026-10-20",
          "2026-11-03",
          "2026-11-10",
        ]),
      ],
    ]);
    expect(longestStreak(t, tChecks, DZIS, "mon")).toEqual({
      value: 3,
      unit: "weeks",
    });
    expect(currentStreak(t, tChecks, DZIS, "mon")).toEqual({
      value: 2,
      unit: "weeks",
    });
  });

  it("seria przez zmianę wersji codziennie → pn/śr/pt", () => {
    const h = nawyk("a", [
      codziennie("2026-11-01"),
      wDni("2026-11-10", [1, 3, 5]),
    ]);
    // 05.11 brak; 06–09 codziennie zrobione; od 10.11 pn/śr/pt: 11, 13, 16 zrobione;
    // dziś (wt 17.11) i 10.11 (wt) niezaplanowane
    const checks: Checks = new Map([
      [
        "a",
        new Set([
          ...dni("2026-11-06", 4),
          "2026-11-11",
          "2026-11-13",
          "2026-11-16",
        ]),
      ],
    ]);
    expect(currentStreak(h, checks, DZIS, "mon")).toEqual({
      value: 7,
      unit: "days",
    });
    expect(longestStreak(h, checks, DZIS, "mon")).toEqual({
      value: 7,
      unit: "days",
    });
  });

  it("seria dzienna przez zmianę czasu (29.03 i 25.10)", () => {
    const h = nawyk("a", [codziennie("2026-03-20")]);
    const checks: Checks = new Map([
      ["a", new Set([...dni("2026-03-27", 5), ...dni("2026-10-23", 5)])],
    ]);
    expect(currentStreak(h, checks, "2026-03-31", "mon")).toEqual({
      value: 5,
      unit: "days",
    });
    expect(currentStreak(h, checks, "2026-10-27", "mon")).toEqual({
      value: 5,
      unit: "days",
    });
  });

  it("X/tydz. ruszył w środku bieżącego tygodnia", () => {
    // start śr 18.11, dziś czw 19.11; poprzedni tydzień nie ma wersji
    const h = nawyk("t", [razyWTyg("2026-11-18", 2)]);
    const jedno: Checks = new Map([["t", new Set(["2026-11-18"])]]);
    expect(currentStreak(h, jedno, "2026-11-19", "mon")).toEqual({
      value: 0,
      unit: "weeks",
    });
    expect(weekProgress(h, jedno, "2026-11-19", "mon")).toEqual({
      done: 1,
      target: 2,
    });
    const dwa: Checks = new Map([["t", new Set(["2026-11-18", "2026-11-19"])]]);
    expect(currentStreak(h, dwa, "2026-11-19", "mon")).toEqual({
      value: 1,
      unit: "weeks",
    });
    expect(longestStreak(h, dwa, "2026-11-19", "mon")).toEqual({
      value: 1,
      unit: "weeks",
    });
  });

  it("X/tydz. zmieniony w środku tygodnia: tydzień oceniany wersją z jego końca", () => {
    // 3×/tydz. od 01.11, od śr 18.11 2×/tydz.; odhaczone 16.11 i 18.11.
    // Tydzień 16–22.11 ma na końcu wersję 2×/tydz., więc 2 odhaczenia go spełniają
    // (tak samo jak pokazuje weekProgress w trakcie tego tygodnia).
    const h = nawyk("t", [
      razyWTyg("2026-11-01", 3),
      razyWTyg("2026-11-18", 2),
    ]);
    const checks: Checks = new Map([
      ["t", new Set(["2026-11-16", "2026-11-18"])],
    ]);
    expect(weekProgress(h, checks, "2026-11-18", "mon")).toEqual({
      done: 2,
      target: 2,
    });
    expect(currentStreak(h, checks, "2026-11-18", "mon")).toEqual({
      value: 1,
      unit: "weeks",
    });
    // pn 23.11: bieżący tydzień jeszcze pusty, poprzedni spełniony
    expect(currentStreak(h, checks, "2026-11-23", "mon")).toEqual({
      value: 1,
      unit: "weeks",
    });
    expect(longestStreak(h, checks, "2026-11-23", "mon")).toEqual({
      value: 1,
      unit: "weeks",
    });
  });

  it("X/tydz. podniesiony w środku tygodnia: liczy się nowy, wyższy cel", () => {
    // 2×/tydz. od 01.11, od śr 11.11 3×/tydz.; tydzień 9–15.11 ma tylko 2 odhaczenia
    const h = nawyk("t", [
      razyWTyg("2026-11-01", 2),
      razyWTyg("2026-11-11", 3),
    ]);
    const checks: Checks = new Map([
      ["t", new Set(["2026-11-03", "2026-11-05", "2026-11-09", "2026-11-10"])],
    ]);
    expect(currentStreak(h, checks, DZIS, "mon")).toEqual({
      value: 0,
      unit: "weeks",
    });
    expect(longestStreak(h, checks, DZIS, "mon")).toEqual({
      value: 1,
      unit: "weeks",
    });
  });

  it("nawyk jeszcze nie obowiązuje: seria 0", () => {
    const h = nawyk("a", [codziennie("2026-12-01")]);
    expect(currentStreak(h, new Map(), DZIS, "mon")).toEqual({
      value: 0,
      unit: "days",
    });
    expect(longestStreak(h, new Map(), DZIS, "mon")).toEqual({
      value: 0,
      unit: "days",
    });
  });
});

describe("successRate30 / last30Comparison", () => {
  it("X/tydz.: 15 odhaczeń w 30 dniach przy 3×/tydz. = 100 (obcięte)", () => {
    const h = nawyk("t", [razyWTyg("2026-09-01", 3)]);
    const daty = dni("2026-10-19", 30).filter((_, i) => i % 2 === 0); // 15 dat
    const checks: Checks = new Map([["t", new Set(daty)]]);
    expect(daty).toHaveLength(15);
    expect(successRate30(h, checks, DZIS)).toBe(100);
  });

  it("codzienny: zrobione / zaplanowane w ostatnich 30 dniach", () => {
    const h = nawyk("a", [codziennie("2026-11-01")]); // 17 zaplanowanych dni
    const checks: Checks = new Map([["a", new Set(dni("2026-11-01", 10))]]);
    expect(successRate30(h, checks, DZIS)).toBe(59);
  });

  it("brak danych daje null", () => {
    const h = nawyk("a", [codziennie("2026-12-01")]);
    expect(successRate30(h, new Map(), DZIS)).toBeNull();
  });

  it("X/tydz. młodszy niż 30 dni: mianownik proporcjonalny do dni od startu", () => {
    // start 11.11 → 7 dni do 17.11 włącznie; oczekiwane 3 × 7 / 7 = 3
    const h = nawyk("t", [razyWTyg("2026-11-11", 3)]);
    const checks: Checks = new Map([
      ["t", new Set(["2026-11-12", "2026-11-14", "2026-11-16"])],
    ]);
    expect(successRate30(h, checks, DZIS)).toBe(100);
    // start 14 dni temu (04.11): oczekiwane 6, 3 odhaczenia → 50
    const h2 = nawyk("t", [razyWTyg("2026-11-04", 3)]);
    expect(successRate30(h2, checks, DZIS)).toBe(50);
  });

  it("X/tydz. po wersji codziennej: okno od początku ciągłego ciągu wersji X/tydz.", () => {
    // codziennie od 26.10 (20 dni), od 15.11 3×/tydz. → okno 15–17.11 = 3 dni
    // oczekiwane 3 × 3 / 7 ≈ 1,29; jedno odhaczenie → 78
    const h = nawyk("t", [codziennie("2026-10-26"), razyWTyg("2026-11-15", 3)]);
    const checks: Checks = new Map([
      ["t", new Set([...dni("2026-10-26", 20), "2026-11-16"])],
    ]);
    expect(successRate30(h, checks, DZIS)).toBe(78);
    // dwie kolejne wersje X/tydz. to jeden ciąg: okno od 11.11 (7 dni), oczekiwane 4 × 7 / 7 = 4
    const h2 = nawyk("t", [
      codziennie("2026-10-26"),
      razyWTyg("2026-11-11", 2),
      razyWTyg("2026-11-15", 4),
    ]);
    const checks2: Checks = new Map([
      ["t", new Set(["2026-11-12", "2026-11-16"])],
    ]);
    expect(successRate30(h2, checks2, DZIS)).toBe(50);
  });

  it("średnia z nieokrąglonych proporcji dnia", () => {
    // 3 nawyki od 15.11: 15.11 i 16.11 po 1/3, 17.11 3/3.
    // Z zaokrąglonych procentów (33+33+100)/3 = 55,3 → 55; z proporcji 55,6 → 56
    const hs = ["a", "b", "c"].map((id) =>
      nawyk(id, [codziennie("2026-11-15")]),
    );
    const checks: Checks = new Map([
      ["a", new Set(["2026-11-15", "2026-11-16", DZIS])],
      ["b", new Set([DZIS])],
      ["c", new Set([DZIS])],
    ]);
    expect(last30Comparison(hs, checks, DZIS)).toEqual({
      percent: 56,
      deltaPoints: null,
    });
  });

  it("80% vs 74% → deltaPoints 6", () => {
    // Okno bieżące 19.10–17.11 (30 dni, 24 zrobione = 80%),
    // okno wcześniejsze 19.09–18.10: nawyk od 22.09, 27 dni, 20 zrobionych ≈ 74%
    const h = nawyk("a", [codziennie("2026-09-22")]);
    const daty = [...dni("2026-09-22", 20), ...dni("2026-10-19", 24)];
    const checks: Checks = new Map([["a", new Set(daty)]]);
    expect(last30Comparison([h], checks, DZIS)).toEqual({
      percent: 80,
      deltaPoints: 6,
    });
  });

  it("bez planu we wcześniejszym oknie deltaPoints = null", () => {
    const h = nawyk("a", [codziennie("2026-11-01")]);
    const checks: Checks = new Map([["a", new Set(dni("2026-11-01", 17))]]);
    expect(last30Comparison([h], checks, DZIS)).toEqual({
      percent: 100,
      deltaPoints: null,
    });
    expect(last30Comparison([], checks, DZIS)).toEqual({
      percent: null,
      deltaPoints: null,
    });
  });
});

describe("weekProgress / totalChecks", () => {
  it("postęp tygodnia tylko dla X/tydz.", () => {
    const t = nawyk("t", [razyWTyg("2026-11-01", 4)]);
    const checks: Checks = new Map([
      ["t", new Set(["2026-11-15", "2026-11-16", DZIS])],
    ]);
    expect(weekProgress(t, checks, DZIS, "mon")).toEqual({
      done: 2,
      target: 4,
    });
    expect(weekProgress(t, checks, DZIS, "sun")).toEqual({
      done: 3,
      target: 4,
    });
    expect(
      weekProgress(nawyk("a", [codziennie("2026-11-01")]), checks, DZIS, "mon"),
    ).toBeNull();
    expect(totalChecks("t", checks)).toBe(3);
    expect(totalChecks("x", checks)).toBe(0);
  });
});

describe("heatmapy", () => {
  const h = nawyk("a", [codziennie("2026-11-01")]);
  const checks: Checks = new Map([["a", new Set(["2026-11-01"])]]);

  it("miesiąc: puste pola przed 1. zależnie od początku tygodnia", () => {
    const pn = heatmapMonth([h], checks, "2026-11", DZIS, "mon");
    expect(pn).toHaveLength(36);
    expect(pn.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(pn[6]).toEqual({
      date: "2026-11-01",
      done: 1,
      planned: 1,
      percent: 100,
    });
    expect(pn[35]?.date).toBe("2026-11-30");
    expect(pn[35]?.percent).toBeNull(); // przyszłość

    const nd = heatmapMonth([h], checks, "2026-11", DZIS, "sun");
    expect(nd).toHaveLength(30);
    expect(nd[0]?.date).toBe("2026-11-01");
  });

  it("tygodnie: ciągłe daty przez zmianę czasu 25.10", () => {
    const kolumny = heatmapWeeks([h], checks, 4, "2026-10-27", "mon");
    const daty = kolumny.flat().map((k) => k.date);
    expect(daty).toEqual(dni("2026-10-05", 28));
    expect(kolumny[2][6].date).toBe("2026-10-25");
    expect(kolumny[3][0].date).toBe("2026-10-26");
  });

  it("tygodnie: ostatnie N kolumn do bieżącego tygodnia włącznie", () => {
    const kolumny = heatmapWeeks([h], checks, 4, DZIS, "mon");
    expect(kolumny).toHaveLength(4);
    expect(kolumny.every((k) => k.length === 7)).toBe(true);
    expect(kolumny[0][0].date).toBe("2026-10-26");
    expect(kolumny[3][0].date).toBe("2026-11-16");
    expect(kolumny[3][6].date).toBe("2026-11-22");
    expect(kolumny[3][1].percent).toBe(0); // dziś, nieodhaczone
    expect(kolumny[3][2].percent).toBeNull(); // jutro

    const nd = heatmapWeeks([h], checks, 13, DZIS, "sun");
    expect(nd).toHaveLength(13);
    expect(nd[12][0].date).toBe("2026-11-15");
  });
});
