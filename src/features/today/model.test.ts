import { describe, expect, it } from "vitest";
import {
  expandOccurrences,
  type BlockRow,
  type ExceptionRow,
} from "@/features/calendar/occurrences";
import type { CategoryRow } from "@/features/calendar/load-calendar";
import type { Checks, Habit } from "@/features/habits/model";
import type { SleepLog } from "@/features/habits/sleep";
import type { SportItem } from "@/features/sport/model";
import type { TaskRow } from "@/features/tasks/model";
import {
  dayPlan,
  isoWeekNumber,
  nowItem,
  parseQuickRun,
  quickWhenOptions,
  showFullToday,
  todayTiles,
  weekStart,
  weekTiles,
  type PlanItem,
} from "./model";

// 2026-11-18 to środa; tydzień od pn: 16–22.11, od nd: 15–21.11
const DZIS = "2026-11-18";
const PN = "2026-11-16";

function zadanie(id: string, nadpisz: Partial<TaskRow>): TaskRow {
  return {
    id,
    user_id: "u1",
    title: id,
    block_id: null,
    occurrence_date: null,
    due_date: null,
    done: false,
    done_at: null,
    position: 0,
    created_at: null,
    ...nadpisz,
  };
}

function nawyk(id: string, validFrom: string): Habit {
  return {
    id,
    name: id,
    remindAt: null,
    showOnToday: true,
    createdAt: "2026-01-01T00:00:00Z",
    schedules: [{ validFrom, type: "daily", weekdays: [], timesPerWeek: null }],
  };
}

function sen(date: string, sleptAt: string, wokeAt: string): SleepLog {
  return { date, sleptAt, wokeAt, feeling: null, tags: [], note: null };
}

function trening(key: string, nadpisz: Partial<SportItem>): SportItem {
  return {
    key,
    kind: "run",
    sessionId: key,
    templateId: null,
    date: DZIS,
    startMin: 18 * 60,
    durationMin: 60,
    title: "Bieg",
    planned: false,
    showInCalendar: true,
    distanceKm: null,
    durationS: null,
    kcal: null,
    difficulty: null,
    runKind: "easy",
    note: null,
    ...nadpisz,
  };
}

function blok(nadpisz: Partial<BlockRow>): BlockRow {
  return {
    id: "b1",
    user_id: "u1",
    title: "Blok",
    category_id: null,
    note: null,
    start_local: `${DZIS}T08:00:00`,
    duration_min: 60,
    timezone: "Europe/Warsaw",
    recurrence: null,
    remind: false,
    created_at: null,
    updated_at: null,
    ...nadpisz,
  };
}

function kategoria(id: string, name: string, color: string): CategoryRow {
  return {
    id,
    user_id: "u1",
    name,
    color,
    position: 0,
    hidden: false,
    is_system: false,
    created_at: null,
  };
}

// Wejście kafelków tygodnia z pustymi danymi; test nadpisuje to, co sprawdza
function wejscie(nadpisz: Partial<Parameters<typeof weekTiles>[0]> = {}) {
  return {
    today: DZIS,
    nowMin: 12 * 60,
    weekStartDate: PN,
    tasks: [],
    habits: [],
    checks: new Map() as Checks,
    sleepLogs: [],
    sleepGoalMin: 480,
    sportItems: [],
    kmGoalOn: false,
    weeklyKmGoal: 0,
    workoutsGoalOn: false,
    weeklyWorkoutsGoal: 0,
    ...nadpisz,
  };
}

describe("weekStart i isoWeekNumber", () => {
  it("początek tygodnia od pn i od nd, numer ISO", () => {
    expect(weekStart("2026-11-18", "mon")).toBe("2026-11-16");
    expect(weekStart("2026-11-18", "sun")).toBe("2026-11-15");
    // niedziela przy tygodniu od pn należy do tygodnia, który się kończy
    expect(weekStart("2026-11-22", "mon")).toBe("2026-11-16");
    expect(weekStart("2026-11-22", "sun")).toBe("2026-11-22");
    expect(isoWeekNumber("2026-11-17")).toBe(47);
  });
});

describe("weekTiles — zadania", () => {
  it("liczy zadania z datą w tygodniu, bez zaległych sprzed tygodnia", () => {
    const tasks = [
      zadanie("a", { due_date: DZIS, done: true }),
      zadanie("b", { due_date: DZIS }),
      // zadanie z wystąpienia bloku też się liczy
      zadanie("c", {
        due_date: "2026-11-20",
        block_id: "b1",
        occurrence_date: "2026-11-20",
      }),
      zadanie("zalegle", { due_date: "2026-11-10" }),
      zadanie("bez-daty", { due_date: null }),
    ];
    const t = weekTiles(wejscie({ tasks })).tasks;
    expect(t).toEqual({
      done: 1,
      total: 3,
      percent: 33,
      todayDone: 1,
      todayTotal: 2,
    });
  });

  it("bez zadań: percent null", () => {
    expect(weekTiles(wejscie()).tasks.percent).toBeNull();
  });

  it("tydzień od niedzieli: zadanie z niedzieli 15.11 wchodzi, z niedzieli 22.11 nie", () => {
    const tasks = [
      zadanie("nd15", { due_date: "2026-11-15" }),
      zadanie("nd22", { due_date: "2026-11-22" }),
    ];
    const t = weekTiles(wejscie({ tasks, weekStartDate: "2026-11-15" })).tasks;
    expect(t.total).toBe(1);
  });
});

describe("weekTiles — nawyki", () => {
  it("średnia % dni z planem do dziś, przyszłość pominięta, above70 > 70", () => {
    // dwa nawyki codziennie od pn; pn 2/2 (100%), wt 1/2 (50%), śr 0/2 (0%)
    const habits = [nawyk("h1", PN), nawyk("h2", PN)];
    const checks: Checks = new Map([
      ["h1", new Set([PN, "2026-11-17", "2026-11-20"])],
      ["h2", new Set([PN])],
    ]);
    const h = weekTiles(wejscie({ habits, checks })).habits;
    expect(h).toEqual({ percent: 50, above70: 1, plannedDays: 3 });
  });

  it("dzień z dokładnie 70% nie jest powyżej 70", () => {
    // 10 nawyków, w pn 7 odhaczonych = 70%
    const habits = Array.from({ length: 10 }, (_, i) => nawyk(`h${i}`, DZIS));
    const checks: Checks = new Map(
      habits.slice(0, 7).map((n) => [n.id, new Set([DZIS])]),
    );
    const h = weekTiles(wejscie({ habits, checks })).habits;
    expect(h).toEqual({ percent: 70, above70: 0, plannedDays: 1 });
  });

  it("bez planu: percent null", () => {
    expect(weekTiles(wejscie()).habits).toEqual({
      percent: null,
      above70: 0,
      plannedDays: 0,
    });
  });
});

describe("weekTiles — sen", () => {
  it("średnia z wpisów tygodnia i noce ≥ cel", () => {
    const sleepLogs = [
      sen("2026-11-17", "23:00", "06:00"), // 7:00
      sen(DZIS, "22:30", "07:00"), // 8:30
      sen("2026-11-10", "22:00", "08:00"), // poprzedni tydzień
    ];
    const s = weekTiles(wejscie({ sleepLogs })).sleep;
    expect(s).toEqual({
      avgMin: 465,
      goalMin: 480,
      nightsAtGoal: 1,
      nights: 2,
    });
  });

  it("bez wpisów: avgMin null", () => {
    expect(weekTiles(wejscie()).sleep.avgMin).toBeNull();
  });
});

describe("weekTiles — bieg", () => {
  const sportItems = [
    trening("r1", { date: PN, distanceKm: 8, durationS: 2880 }),
    trening("r2", { date: "2026-11-17", distanceKm: 5.5, durationS: 1800 }),
    // plan dziś przed teraz — już nie „najbliższy”
    trening("p0", { date: DZIS, startMin: 7 * 60, planned: true }),
    trening("p1", { date: DZIS, startMin: 18 * 60, planned: true }),
    trening("p2", { date: "2026-11-20", startMin: 7 * 60, planned: true }),
    // trening siłowy wykonany nie dokłada km
    trening("g1", { kind: "gym", date: PN, runKind: null }),
  ];

  it("km z wykonanych, nextRun od teraz, bez celu goalKm null", () => {
    const r = weekTiles(wejscie({ sportItems })).run;
    expect(r).toEqual({
      km: 13.5,
      goalKm: null,
      nextRun: { date: DZIS, startMin: 18 * 60 },
    });
  });

  it("z celem goalKm, po ostatnim planie nextRun null", () => {
    const r = weekTiles(
      wejscie({
        sportItems: sportItems.filter((i) => i.key !== "p2"),
        nowMin: 19 * 60,
        kmGoalOn: true,
        weeklyKmGoal: 30,
      }),
    ).run;
    expect(r.goalKm).toBe(30);
    expect(r.nextRun).toBeNull();
  });
});

describe("weekTiles — treningi", () => {
  const sportItems = [
    trening("r1", { date: PN, distanceKm: 8, durationS: 2880 }),
    trening("g1", { kind: "gym", date: "2026-11-17", runKind: null }),
    trening("p1", { date: "2026-11-20", planned: true }),
    trening(`t:t1:2026-11-21`, {
      kind: "gym",
      sessionId: null,
      templateId: "t1",
      date: "2026-11-21",
      planned: true,
      runKind: null,
    }),
    // plan z przeszłości (nie odbył się) i z następnego tygodnia — poza mianownikiem
    trening("stary", { date: PN, planned: true }),
    trening("nast", { date: "2026-11-23", planned: true }),
  ];

  it("wykonane / (wykonane + zaplanowane od teraz)", () => {
    expect(weekTiles(wejscie({ sportItems })).workouts).toEqual({
      done: 2,
      total: 4,
    });
  });

  it("z celem mianownik = max(z planu, cel)", () => {
    const w = weekTiles(
      wejscie({ sportItems, workoutsGoalOn: true, weeklyWorkoutsGoal: 5 }),
    ).workouts;
    expect(w).toEqual({ done: 2, total: 5 });
    const mniejszyCel = weekTiles(
      wejscie({ sportItems, workoutsGoalOn: true, weeklyWorkoutsGoal: 3 }),
    ).workouts;
    expect(mniejszyCel).toEqual({ done: 2, total: 4 });
  });
});

describe("dayPlan", () => {
  const categories = [kategoria("k1", "Praca", "#2563eb")];
  const blocks = [
    blok({
      id: "seria",
      title: "Głęboka praca",
      category_id: "k1",
      start_local: "2026-11-02T10:30:00",
      duration_min: 120,
      recurrence: { freq: "daily" },
    }),
    blok({
      id: "odwolany",
      title: "Siłka rano",
      start_local: "2026-11-02T07:00:00",
      recurrence: { freq: "daily" },
    }),
    blok({
      id: "przesuniety",
      title: "Czytanie",
      start_local: "2026-11-02T20:00:00",
      duration_min: 30,
      recurrence: { freq: "daily" },
    }),
  ];
  const exceptions: ExceptionRow[] = [
    {
      block_id: "odwolany",
      user_id: "u1",
      occurrence_date: DZIS,
      kind: "cancelled",
      new_start_local: null,
      new_duration_min: null,
      new_title: null,
    },
    {
      block_id: "przesuniety",
      user_id: "u1",
      occurrence_date: DZIS,
      kind: "modified",
      new_start_local: `${DZIS}T06:00:00`,
      new_duration_min: null,
      new_title: null,
    },
  ];
  const occurrences = expandOccurrences(blocks, exceptions, DZIS, DZIS);
  const tasks = [
    zadanie("t1", {
      block_id: "seria",
      occurrence_date: DZIS,
      due_date: DZIS,
      done: true,
    }),
    zadanie("t2", { block_id: "seria", occurrence_date: DZIS, due_date: DZIS }),
    // zadanie z innego wystąpienia tej serii
    zadanie("t3", {
      block_id: "seria",
      occurrence_date: "2026-11-17",
      due_date: "2026-11-17",
    }),
  ];
  const sportItems = [
    trening("s:plan", { startMin: 18 * 60, planned: true, title: "Spokojny" }),
    trening("s:wczoraj", { date: "2026-11-17" }),
  ];

  it("bloki z wyjątkami i treningi dnia po godzinie", () => {
    const plan = dayPlan(occurrences, categories, tasks, sportItems, DZIS);
    expect(plan.map((p) => [p.key, p.startMin])).toEqual([
      ["przesuniety:2026-11-18", 360],
      ["seria:2026-11-18", 630],
      ["s:plan", 1080],
    ]);
    expect(plan[1]).toMatchObject({
      kind: "block",
      title: "Głęboka praca",
      endMin: 750,
      color: "#2563eb",
      categoryName: "Praca",
      planned: false,
      tasksDone: 1,
      tasksTotal: 2,
      sportKey: null,
    });
    expect(plan[1].occurrence?.blockId).toBe("seria");
    expect(plan[0]).toMatchObject({ color: "#a3a3a3", categoryName: null });
    expect(plan[2]).toMatchObject({
      kind: "run",
      title: "Spokojny",
      planned: true,
      color: "#c2410c",
      categoryName: "Sport",
      occurrence: null,
      sportKey: "s:plan",
      tasksTotal: 0,
    });
  });

  it("trening przez północ kończy się o 24:00", () => {
    const plan = dayPlan(
      [],
      [],
      [],
      [trening("s:noc", { startMin: 23 * 60, durationMin: 120 })],
      DZIS,
    );
    expect(plan[0].endMin).toBe(1440);
  });
});

describe("nowItem", () => {
  const plan: PlanItem[] = [
    {
      key: "b:1",
      kind: "block",
      title: "Głęboka praca",
      startMin: 630,
      endMin: 750,
      color: "#2563eb",
      categoryName: "Praca",
      planned: false,
      tasksDone: 0,
      tasksTotal: 0,
      occurrence: null,
      sportKey: null,
    },
    {
      key: "s:1",
      kind: "run",
      title: "Bieg",
      startMin: 780,
      endMin: 840,
      color: "#c2410c",
      categoryName: "Sport",
      planned: true,
      tasksDone: 0,
      tasksTotal: 0,
      occurrence: null,
      sportKey: "s:1",
    },
  ];

  it("blok trwający teraz, koniec wyłączny, trening się nie liczy", () => {
    expect(nowItem(plan, 11 * 60 + 36)?.key).toBe("b:1");
    expect(nowItem(plan, 630)?.key).toBe("b:1");
    expect(nowItem(plan, 12 * 60 + 30)).toBeNull();
    expect(nowItem(plan, 13 * 60 + 10)).toBeNull();
  });
});

describe("todayTiles", () => {
  it("nawyki, sen z dziś, zadania tylko z dziś, km w tygodniu", () => {
    const t = todayTiles({
      today: DZIS,
      weekStartDate: PN,
      habits: [nawyk("h1", PN), nawyk("h2", PN)],
      checks: new Map([["h1", new Set([DZIS])]]),
      sleepLogs: [
        sen("2026-11-17", "22:00", "06:00"),
        sen(DZIS, "23:15", "06:27"),
      ],
      tasks: [
        zadanie("a", { due_date: DZIS, done: true }),
        zadanie("b", { due_date: DZIS }),
        zadanie("zalegle", { due_date: "2026-11-17" }),
        zadanie("zalegle-zrobione", { due_date: "2026-11-17", done: true }),
      ],
      sportItems: [trening("r1", { date: PN, distanceKm: 8, durationS: 2880 })],
      kmGoalOn: true,
      weeklyKmGoal: 30,
    });
    expect(t).toEqual({
      habitsDone: 1,
      habitsTotal: 2,
      sleepMin: 432,
      tasksDone: 1,
      tasksTotal: 2,
      km: 8,
      goalKm: 30,
    });
  });

  it("bez wpisu snu z dziś i bez celu km", () => {
    const t = todayTiles({
      today: DZIS,
      weekStartDate: PN,
      habits: [],
      checks: new Map(),
      sleepLogs: [sen("2026-11-17", "22:00", "06:00")],
      tasks: [],
      sportItems: [],
      kmGoalOn: false,
      weeklyKmGoal: 30,
    });
    expect(t.sleepMin).toBeNull();
    expect(t.goalKm).toBeNull();
  });
});

describe("quickWhenOptions", () => {
  it("blok po 23:00: pierwszy chip to jutro 08:00, bez „Dziś 18:00”", () => {
    const o = quickWhenOptions("block", DZIS, 23 * 60 + 10, "mon");
    expect(o[0]).toEqual({
      label: "Dziś",
      date: "2026-11-19",
      startMin: 8 * 60,
    });
    expect(o.map((x) => x.label)).toEqual(["Dziś", "Jutro", "Pn 23.11"]);
  });

  it("blok w ciągu dnia: najbliższa pełna godzina, Dziś 18:00, Jutro 09:00", () => {
    expect(quickWhenOptions("block", DZIS, 11 * 60 + 36, "mon")).toEqual([
      { label: "Dziś", date: DZIS, startMin: 12 * 60 },
      { label: "Dziś 18:00", date: DZIS, startMin: 18 * 60 },
      { label: "Jutro", date: "2026-11-19", startMin: 9 * 60 },
      { label: "Pn 23.11", date: "2026-11-23", startMin: 9 * 60 },
    ]);
  });

  it("„Dziś 18:00” ukryte przy 18:30; bieg jutro o 18:00", () => {
    const o = quickWhenOptions("run", DZIS, 18 * 60 + 30, "mon");
    expect(o).toEqual([
      { label: "Dziś", date: DZIS, startMin: 19 * 60 },
      { label: "Jutro", date: "2026-11-19", startMin: 18 * 60 },
      { label: "Pn 23.11", date: "2026-11-23", startMin: 18 * 60 },
    ]);
  });

  it("zadanie ma „Bez daty”, tydzień od nd daje następną niedzielę", () => {
    expect(quickWhenOptions("task", DZIS, 600, "mon")).toEqual([
      { label: "Dziś", date: DZIS, startMin: null },
      { label: "Jutro", date: "2026-11-19", startMin: null },
      { label: "Pn 23.11", date: "2026-11-23", startMin: null },
      { label: "Bez daty", date: null, startMin: null },
    ]);
    expect(quickWhenOptions("task", DZIS, 600, "sun")[2]).toEqual({
      label: "Nd 22.11",
      date: "2026-11-22",
      startMin: null,
    });
    // w niedzielę przy tygodniu od nd „następna niedziela” to za tydzień
    expect(quickWhenOptions("task", "2026-11-22", 600, "sun")[2].date).toBe(
      "2026-11-29",
    );
  });

  it("nawyk nie ma chipów", () => {
    expect(quickWhenOptions("habit", DZIS, 600, "mon")).toEqual([]);
  });
});

describe("parseQuickRun", () => {
  it("dystans przed km i rodzaj ze słów", () => {
    expect(parseQuickRun("8 km spokojnie")).toEqual({
      distanceKm: 8,
      kind: "easy",
    });
    expect(parseQuickRun("10,5km tempo")).toEqual({
      distanceKm: 10.5,
      kind: "tempo",
    });
    expect(parseQuickRun("długi bieg")).toEqual({
      distanceKm: null,
      kind: "long",
    });
    expect(parseQuickRun("Interwały 6 KM")).toEqual({
      distanceKm: 6,
      kind: "intervals",
    });
    expect(parseQuickRun("zawody 21.1 km")).toEqual({
      distanceKm: 21.1,
      kind: "race",
    });
    // liczba bez „km” nie jest dystansem
    expect(parseQuickRun("bieg o 7")).toEqual({
      distanceKm: null,
      kind: "easy",
    });
  });
});

describe("showFullToday", () => {
  const wszystkie = { blocks: 1, habits: 1, workouts: 1, sleepLogs: 1 };

  it("4 kroki albo blok i konto starsze niż 7 dni", () => {
    expect(
      showFullToday(
        { ...wszystkie, sleepLogs: 0 },
        "2026-11-16T10:00:00Z",
        DZIS,
      ),
    ).toBe(false);
    expect(showFullToday(wszystkie, "2026-11-16T10:00:00Z", DZIS)).toBe(true);
    expect(
      showFullToday(
        { blocks: 1, habits: 0, workouts: 0, sleepLogs: 0 },
        "2026-11-10T10:00:00Z",
        DZIS,
      ),
    ).toBe(true);
    // równo 7 dni to jeszcze nie „starsze niż 7 dni”
    expect(
      showFullToday(
        { blocks: 1, habits: 0, workouts: 0, sleepLogs: 0 },
        "2026-11-11T10:00:00Z",
        DZIS,
      ),
    ).toBe(false);
    // stare konto bez bloku zostaje w stanie pustym
    expect(
      showFullToday(
        { blocks: 0, habits: 1, workouts: 1, sleepLogs: 1 },
        "2026-01-01T10:00:00Z",
        DZIS,
      ),
    ).toBe(false);
  });
});
