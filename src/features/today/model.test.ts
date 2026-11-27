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
  blocksCountLabel,
  dayPlan,
  dayPlanRows,
  todayHabits,
  weekBars,
  isoWeekNumber,
  nowItem,
  parseQuickRun,
  quickWhenOptions,
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
    block_id: "bx",
    occurrence_date: "2026-11-01",
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
      nextRun: { date: DZIS, startMin: 18 * 60, distanceKm: null },
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
      upcoming: [
        { kind: "run", date: "2026-11-20", startMin: 18 * 60 },
        { kind: "gym", date: "2026-11-21", startMin: 18 * 60 },
      ],
    });
  });

  it("plan z dziś o minionej godzinie liczy się do mianownika (od dziś, nie od teraz)", () => {
    const zRana = [
      ...sportItems,
      trening("rano", {
        kind: "gym",
        date: DZIS,
        startMin: 7 * 60,
        planned: true,
        runKind: null,
      }),
    ];
    const w = weekTiles(wejscie({ sportItems: zRana })).workouts;
    expect(w.done).toBe(2);
    expect(w.total).toBe(5);
    // …ale nie jest już „nadchodzący”
    expect(w.upcoming.map((u) => u.date)).toEqual(["2026-11-20", "2026-11-21"]);
  });

  it("z celem mianownik = max(z planu, cel)", () => {
    const w = weekTiles(
      wejscie({ sportItems, workoutsGoalOn: true, weeklyWorkoutsGoal: 5 }),
    ).workouts;
    expect(w.total).toBe(5);
    const mniejszyCel = weekTiles(
      wejscie({ sportItems, workoutsGoalOn: true, weeklyWorkoutsGoal: 3 }),
    ).workouts;
    expect(mniejszyCel.total).toBe(4);
  });
});

describe("weekTiles — dni tygodnia (słupki)", () => {
  it("7 wartości od początku tygodnia, null po dziś", () => {
    const habits = [nawyk("h1", PN), nawyk("h2", PN)];
    const checks: Checks = new Map([
      ["h1", new Set([PN, "2026-11-17", "2026-11-20"])],
      ["h2", new Set([PN])],
    ]);
    const d = weekTiles(
      wejscie({
        tasks: [
          zadanie("a", { due_date: PN, done: true }),
          zadanie("b", { due_date: PN, done: true }),
          zadanie("c", { due_date: DZIS, done: true }),
          zadanie("d", { due_date: DZIS }),
          zadanie("pt", { due_date: "2026-11-20", done: true }),
          zadanie("zalegle", { due_date: "2026-11-10", done: true }),
        ],
        habits,
        checks,
        sleepLogs: [
          sen(PN, "23:00", "06:00"), // 7:00
          sen(DZIS, "22:30", "07:00"), // 8:30
        ],
        sportItems: [
          trening("r1", { date: PN, distanceKm: 8, durationS: 2880 }),
          trening("r2", { date: PN, distanceKm: 2, durationS: 600 }),
          // bez czasu — nie liczy się do km (jak weekStats), ale jest treningiem
          trening("r3", { date: "2026-11-17", distanceKm: 5 }),
          trening("g1", { kind: "gym", date: "2026-11-17", runKind: null }),
          trening("p1", { date: DZIS, planned: true, distanceKm: 10 }),
        ],
      }),
    ).days;
    expect(d.tasks).toEqual([2, 0, 1, null, null, null, null]);
    expect(d.habits).toEqual([
      { done: 2, planned: 2 },
      { done: 1, planned: 2 },
      { done: 0, planned: 2 },
      null,
      null,
      null,
      null,
    ]);
    expect(d.sleep).toEqual([420, null, 510, null, null, null, null]);
    expect(d.km).toEqual([10, 0, 0, null, null, null, null]);
    expect(d.workouts).toEqual([2, 2, 0, null, null, null, null]);
  });

  it("dzień bez planu nawyków: { done: 0, planned: 0 }", () => {
    const d = weekTiles(wejscie({ habits: [nawyk("h1", "2026-11-17")] })).days
      .habits;
    expect(d.slice(0, 3)).toEqual([
      { done: 0, planned: 0 },
      { done: 0, planned: 1 },
      { done: 0, planned: 1 },
    ]);
  });

  it("tydzień od niedzieli: pierwszy słupek to niedziela 15.11", () => {
    const d = weekTiles(
      wejscie({
        weekStartDate: "2026-11-15",
        tasks: [
          zadanie("nd15", { due_date: "2026-11-15", done: true }),
          zadanie("nd22", { due_date: "2026-11-22", done: true }),
        ],
        sleepLogs: [sen("2026-11-15", "23:00", "07:00")],
      }),
    ).days;
    expect(d.tasks).toEqual([1, 0, 0, 0, null, null, null]);
    expect(d.sleep).toEqual([480, null, null, null, null, null, null]);
  });

  it("nextRun niesie dystans planu", () => {
    const r = weekTiles(
      wejscie({
        sportItems: [
          trening("p1", { date: "2026-11-19", planned: true, distanceKm: 10 }),
        ],
      }),
    ).run;
    expect(r.nextRun).toEqual({
      date: "2026-11-19",
      startMin: 18 * 60,
      distanceKm: 10,
    });
  });

  it("upcoming: plany od teraz, rosnąco po dniu i godzinie, bez przeszłych z dziś", () => {
    const w = weekTiles(
      wejscie({
        sportItems: [
          trening("pt", {
            date: "2026-11-20",
            startMin: 7 * 60,
            planned: true,
          }),
          trening("g", {
            kind: "gym",
            date: "2026-11-19",
            startMin: 19 * 60,
            planned: true,
            runKind: null,
          }),
          trening("dzis", { date: DZIS, startMin: 18 * 60, planned: true }),
          trening("rano", { date: DZIS, startMin: 7 * 60, planned: true }),
          trening("nast", { date: "2026-11-23", planned: true }),
        ],
      }),
    ).workouts.upcoming;
    expect(w).toEqual([
      { kind: "run", date: DZIS, startMin: 18 * 60 },
      { kind: "gym", date: "2026-11-19", startMin: 19 * 60 },
      { kind: "run", date: "2026-11-20", startMin: 7 * 60 },
    ]);
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

  it("wystąpienie przeniesione z wczoraj na dziś jest w planie, zadania z oryginalnej daty", () => {
    const przeniesione = expandOccurrences(
      [
        blok({
          id: "spotkanie",
          title: "Spotkanie",
          start_local: "2026-11-03T09:00:00",
          recurrence: { freq: "weekly" }, // wtorki
        }),
      ],
      [
        {
          block_id: "spotkanie",
          user_id: "u1",
          occurrence_date: "2026-11-17",
          kind: "modified",
          new_start_local: `${DZIS}T15:00:00`,
          new_duration_min: 45,
          new_title: null,
        },
      ],
      DZIS,
      DZIS,
    );
    const zadania = [
      zadanie("p1", {
        block_id: "spotkanie",
        occurrence_date: "2026-11-17",
        due_date: DZIS,
        done: true,
      }),
    ];
    const plan = dayPlan(przeniesione, [], zadania, [], DZIS);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      key: "spotkanie:2026-11-17",
      startMin: 900,
      endMin: 945,
      tasksDone: 1,
      tasksTotal: 1,
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

  it("o 17:30 „Dziś” to 18:00, więc bez duplikatu „Dziś 18:00”", () => {
    expect(quickWhenOptions("block", DZIS, 17 * 60 + 30, "mon")).toEqual([
      { label: "Dziś", date: DZIS, startMin: 18 * 60 },
      { label: "Jutro", date: "2026-11-19", startMin: 9 * 60 },
      { label: "Pn 23.11", date: "2026-11-23", startMin: 9 * 60 },
    ]);
    // o 16:59 oba chipy są potrzebne: 17:00 i 18:00
    expect(
      quickWhenOptions("run", DZIS, 16 * 60 + 59, "mon").map((o) => o.startMin),
    ).toEqual([17 * 60, 18 * 60, 18 * 60, 18 * 60]);
  });

  it("„Dziś 18:00” ukryte przy 18:30; bieg jutro o 18:00", () => {
    const o = quickWhenOptions("run", DZIS, 18 * 60 + 30, "mon");
    expect(o).toEqual([
      { label: "Dziś", date: DZIS, startMin: 19 * 60 },
      { label: "Jutro", date: "2026-11-19", startMin: 18 * 60 },
      { label: "Pn 23.11", date: "2026-11-23", startMin: 18 * 60 },
    ]);
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
    // kilka słów rodzaju: wygrywa to, które jest pierwsze w tekście
    expect(parseQuickRun("tempo potem spokojnie").kind).toBe("tempo");
    expect(parseQuickRun("spokojnie, potem tempo").kind).toBe("easy");
    expect(parseQuickRun("12 km długi z interwałami").kind).toBe("long");
    // liczba bez „km” nie jest dystansem
    expect(parseQuickRun("bieg o 7")).toEqual({
      distanceKm: null,
      kind: "easy",
    });
  });
});

describe("weekBars", () => {
  it("cztery wiersze z gotowymi tekstami wg makiety", () => {
    const wynik = weekBars(
      wejscie({
        workoutsGoalOn: true,
        weeklyWorkoutsGoal: 4,
        kmGoalOn: true,
        weeklyKmGoal: 25,
        sportItems: [
          trening("r1", { distanceKm: 10, durationS: 3600 }),
          trening("g1", { kind: "gym", date: PN }),
        ],
        sleepLogs: [
          sen("2026-11-17", "22:00", "06:30"), // 8:30 ≥ cel
          sen("2026-11-16", "00:30", "07:20"), // 6:50 < cel
        ],
      }),
    );
    expect(wynik.map((w) => w.label)).toEqual([
      "Treningi",
      "Bieg",
      "Nawyki",
      "Sen",
    ]);
    expect(wynik[0]).toMatchObject({
      label: "Treningi",
      value: "2",
      unit: "/ 4",
      percent: 50,
      right: "jeszcze 2",
    });
    expect(wynik[1]).toMatchObject({
      label: "Bieg",
      value: "10",
      unit: "/ 25 km",
      percent: 40,
      right: "jeszcze 15 km",
    });
    // brak dni z planem → „0 %”
    expect(wynik[2]).toMatchObject({
      label: "Nawyki",
      value: "0 %",
      unit: "dni z celem",
      percent: 0,
      right: "—",
    });
    // średnia (510 + 410) / 2 = 460 min = 7:40, cel 8:00 → 96 %
    expect(wynik[3]).toMatchObject({
      label: "Sen",
      value: "7:40",
      unit: "/ 8:00 śr.",
      percent: 96,
      right: "1 z 2 nocy ≥ cel",
    });
  });

  it("porównuje te same dni poprzedniego tygodnia", () => {
    const wynik = weekBars(
      wejscie({
        sportItems: [
          trening("teraz", { distanceKm: 6, durationS: 1800, date: "2026-11-16" }),
          trening("wtedy", { distanceKm: 10, durationS: 3600, date: "2026-11-09" }),
          // Piątek poprzedniego tygodnia jest „później” niż dziś, więc się nie liczy
          trening("pozniej", { distanceKm: 20, durationS: 7200, date: "2026-11-13" }),
        ],
        sleepLogs: [sen("2026-11-16", "23:00", "06:00")],
      }),
    );
    expect(wynik[0].delta).toEqual({ text: "bez zmian", dir: "same" });
    expect(wynik[1].delta).toEqual({ text: "−4 km vs tydz. 46", dir: "down" });
    // Brak snu w poprzednim tygodniu → nie ma czego porównać
    expect(wynik[3].delta).toBeNull();
  });

  it("cel osiągnięty, km z przecinkiem, pasek ograniczony do 100", () => {
    const wynik = weekBars(
      wejscie({
        workoutsGoalOn: true,
        weeklyWorkoutsGoal: 1,
        kmGoalOn: true,
        weeklyKmGoal: 7.5,
        sportItems: [trening("r1", { distanceKm: 9, durationS: 3000 })],
        sleepLogs: [sen("2026-11-17", "22:00", "08:00")],
      }),
    );
    expect(wynik[0].right).toBe("cel osiągnięty");
    expect(wynik[0].percent).toBe(100);
    expect(wynik[1].unit).toBe("/ 7,5 km");
    expect(wynik[1].right).toBe("cel osiągnięty");
    expect(wynik[1].percent).toBe(100);
    expect(wynik[3].percent).toBe(100);
  });

  it("km z ułamkiem w „jeszcze N km”", () => {
    const wynik = weekBars(
      wejscie({
        kmGoalOn: true,
        weeklyKmGoal: 10,
        sportItems: [trening("r1", { distanceKm: 2.5, durationS: 900 })],
      }),
    );
    expect(wynik[1].value).toBe("2,5");
    expect(wynik[1].right).toBe("jeszcze 7,5 km");
    expect(wynik[1].percent).toBe(25);
  });

  it("Bieg tuż pod celem: nie „cel osiągnięty”, brakujące km w górę do 0,1, pasek < 100", () => {
    const wynik = weekBars(
      wejscie({
        kmGoalOn: true,
        weeklyKmGoal: 25,
        sportItems: [trening("r1", { distanceKm: 24.96, durationS: 7200 })],
      }),
    );
    expect(wynik[1].right).toBe("jeszcze 0,1 km");
    expect(wynik[1].percent).toBe(99);
    const ulamek = weekBars(
      wejscie({
        kmGoalOn: true,
        weeklyKmGoal: 10,
        sportItems: [trening("r1", { distanceKm: 3.04, durationS: 900 })],
      }),
    );
    // 10 − 3,04 = 6,96 → 7
    expect(ulamek[1].right).toBe("jeszcze 7 km");
    const rowno = weekBars(
      wejscie({
        kmGoalOn: true,
        weeklyKmGoal: 25,
        sportItems: [trening("r1", { distanceKm: 25, durationS: 7200 })],
      }),
    );
    expect(rowno[1]).toMatchObject({ right: "cel osiągnięty", percent: 100 });
  });

  it("cel wyłączony: sama wartość, pusty pasek, „—”; sen bez wpisów", () => {
    const wynik = weekBars(
      wejscie({
        sportItems: [trening("r1", { distanceKm: 10, durationS: 3600 })],
      }),
    );
    expect(wynik[0]).toMatchObject({
      value: "1",
      unit: "",
      percent: 0,
      right: "—",
    });
    expect(wynik[1]).toMatchObject({
      value: "10",
      unit: "km",
      percent: 0,
      right: "—",
    });
    expect(wynik[3]).toMatchObject({
      label: "Sen",
      value: "—",
      unit: "/ 8:00 śr.",
      percent: 0,
      right: "brak wpisów",
    });
  });

  it("Nawyki: procent z weekTiles", () => {
    const wynik = weekBars(
      wejscie({
        habits: [nawyk("h1", PN)],
        checks: new Map([["h1", new Set(["2026-11-16", "2026-11-17"])]]),
      }),
    );
    // pn, wt zrobione, śr (dziś) nie → 2/3 = 67 %
    expect(wynik[2]).toMatchObject({ value: "67 %", percent: 67 });
  });
});

describe("todayHabits", () => {
  const tpt: Habit = {
    ...nawyk("x", "2026-01-01"),
    schedules: [
      {
        validFrom: "2026-01-01",
        type: "times_per_week",
        weekdays: [],
        timesPerWeek: 2,
      },
    ],
  };
  // środa 18.11 ma numer 3; nawyk tylko pn
  const tylkoPn: Habit = {
    ...nawyk("pn", "2026-01-01"),
    schedules: [
      {
        validFrom: "2026-01-01",
        type: "weekdays",
        weekdays: [1],
        timesPerWeek: null,
      },
    ],
  };
  const przyszly = nawyk("p", "2026-12-01");

  it("zaplanowane dziś + X/tydz., w kolejności wejścia, z passą i etykietą", () => {
    const codzienny = nawyk("d", "2026-01-01");
    const wynik = todayHabits({
      today: DZIS,
      weekStart: "mon",
      habits: [codzienny, tylkoPn, tpt, przyszly],
      checks: new Map([
        ["d", new Set(["2026-11-15", "2026-11-16", "2026-11-17", DZIS])],
        ["x", new Set(["2026-11-17"])],
      ]),
    });
    expect(wynik.map((h) => h.id)).toEqual(["d", "x"]);
    // 18, 17, 16, 15 odhaczone; 14 nie → passa 4 (dziś odhaczone)
    expect(wynik[0]).toEqual({
      id: "d",
      name: "d",
      done: true,
      streak: { value: 4, unit: "days" },
      streakLabel: "4 dni z rzędu",
      hot: true,
    });
    // X/tydz.: 1 odhaczenie z 2 w bieżącym tygodniu (niespełniony nie przerywa), wcześniej brak
    expect(wynik[1]).toMatchObject({
      done: false,
      streak: { value: 0, unit: "weeks" },
      streakLabel: "zacznij passę",
      hot: false,
    });
  });

  it("etykiety: 1 dzień, tygodnie, próg „hot” przy 3", () => {
    const d = nawyk("d", "2026-01-01");
    const jeden = todayHabits({
      today: DZIS,
      weekStart: "mon",
      habits: [d],
      checks: new Map([["d", new Set(["2026-11-17"])]]),
    })[0];
    expect(jeden.streakLabel).toBe("1 dzień z rzędu");
    expect(jeden.hot).toBe(false);
    const trzy = todayHabits({
      today: DZIS,
      weekStart: "mon",
      habits: [d],
      checks: new Map([
        ["d", new Set(["2026-11-15", "2026-11-16", "2026-11-17"])],
      ]),
    })[0];
    expect(trzy.streakLabel).toBe("3 dni z rzędu");
    expect(trzy.hot).toBe(true);
    // X/tydz. spełnione w bieżącym tygodniu (pn, wt) → 1 tydzień
    const tyg = todayHabits({
      today: DZIS,
      weekStart: "mon",
      habits: [tpt],
      checks: new Map([["x", new Set(["2026-11-16", "2026-11-17"])]]),
    })[0];
    expect(tyg.streak).toEqual({ value: 1, unit: "weeks" });
    expect(tyg.streakLabel).toBe("1 tyg. z rzędu");
  });

  it("pomija nawyki z wyłączonym „pokaż na Dziś”", () => {
    const wynik = todayHabits({
      today: DZIS,
      weekStart: "mon",
      habits: [
        nawyk("a", "2026-01-01"),
        { ...nawyk("b", "2026-01-01"), showOnToday: false },
        { ...tpt, showOnToday: false },
      ],
      checks: new Map(),
    });
    expect(wynik.map((h) => h.id)).toEqual(["a"]);
  });

  it("dzień zaplanowany tylko w poniedziałek pojawia się w poniedziałek", () => {
    const wynik = todayHabits({
      today: PN,
      weekStart: "mon",
      habits: [tylkoPn],
      checks: new Map(),
    });
    expect(wynik.map((h) => h.id)).toEqual(["pn"]);
  });
});

function wpis(key: string, startMin: number, endMin: number): PlanItem {
  return {
    key,
    kind: "block",
    title: key,
    startMin,
    endMin,
    color: "#000",
    categoryName: null,
    planned: false,
    tasksDone: 0,
    tasksTotal: 0,
    occurrence: null,
    sportKey: null,
  };
}

describe("dayPlanRows", () => {
  it("pusty dzień: jedna przerwa 24 h, duża", () => {
    expect(dayPlanRows([])).toEqual([
      {
        type: "gap",
        startMin: 0,
        endMin: 1440,
        label: "24 h wolne",
        big: true,
      },
    ]);
  });

  it("przerwy przed, między i po wpisach z etykietami i progiem 180 min", () => {
    const a = wpis("a", 8 * 60, 9 * 60 + 30);
    const b = wpis("b", 10 * 60, 11 * 60);
    const c = wpis("c", 11 * 60, 12 * 60); // bez przerwy po b
    const wiersze = dayPlanRows([a, b, c]);
    expect(
      wiersze.map((w) => (w.type === "gap" ? w.label : w.item.key)),
    ).toEqual(["8 h wolne", "a", "30 min wolne", "b", "c", "12 h wolne"]);
    const pierwsza = wiersze[0];
    expect(pierwsza).toMatchObject({ big: true });
    expect(wiersze[2]).toMatchObject({ big: false });
    expect(wiersze[5]).toMatchObject({
      startMin: 720,
      endMin: 1440,
    });
  });

  it("etykiety „1 h”, „1 h 30 min”, 179 min nie jest duża, 180 jest", () => {
    const wiersze = dayPlanRows([
      wpis("a", 60, 120),
      wpis("b", 180, 240), // przerwa 60
      wpis("c", 330, 1440), // przerwa 90
    ]);
    const przerwy = wiersze.filter((w) => w.type === "gap");
    expect(przerwy.map((w) => w.label)).toEqual([
      "1 h wolne",
      "1 h wolne",
      "1 h 30 min wolne",
    ]);
    const graniczne = dayPlanRows([wpis("a", 179, 1440)])[0];
    expect(graniczne).toMatchObject({ label: "2 h 59 min wolne", big: false });
    const trzy = dayPlanRows([wpis("a", 180, 1440)])[0];
    expect(trzy).toMatchObject({ label: "3 h wolne", big: true });
  });

  it("nakładki łączą się: wpis wewnątrz dłuższego nie tworzy przerwy", () => {
    const wiersze = dayPlanRows([
      wpis("a", 600, 720),
      wpis("b", 630, 660), // wewnątrz a
      wpis("c", 700, 780), // zachodzi na koniec a
      wpis("d", 790, 800),
    ]);
    expect(
      wiersze.map((w) => (w.type === "gap" ? `gap${w.startMin}` : w.item.key)),
    ).toEqual(["gap0", "a", "b", "c", "gap780", "d", "gap800"]);
  });
  it("blok od 00:00 nie ma przerwy przed sobą; wpis ucięty do 1440 nie ma przerwy po sobie", () => {
    const wiersze = dayPlanRows([wpis("a", 0, 60), wpis("b", 1380, 1440)]);
    expect(
      wiersze.map((w) => (w.type === "gap" ? w.label : w.item.key)),
    ).toEqual(["a", "22 h wolne", "b"]);
    expect(wiersze[1]).toMatchObject({
      startMin: 60,
      endMin: 1380,
    });
    // Cała doba jednym wpisem: bez przerw
    expect(dayPlanRows([wpis("c", 0, 1440)]).map((w) => w.type)).toEqual([
      "item",
    ]);
  });
});

describe("blocksCountLabel", () => {
  it("odmiana", () => {
    expect(
      [0, 1, 2, 4, 5, 11, 12, 14, 15, 21, 22, 24, 25, 112].map(
        blocksCountLabel,
      ),
    ).toEqual([
      "0 bloków",
      "1 blok",
      "2 bloki",
      "4 bloki",
      "5 bloków",
      "11 bloków",
      "12 bloków",
      "14 bloków",
      "15 bloków",
      "21 bloków",
      "22 bloki",
      "24 bloki",
      "25 bloków",
      "112 bloków",
    ]);
  });
});
