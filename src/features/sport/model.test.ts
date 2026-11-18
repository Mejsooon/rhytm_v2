import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY, searchExercises } from "./library";
import {
  epley1rm,
  firstReps,
  formatDuration,
  formatKg,
  formatKm,
  formatPace,
  monthGrid,
  paceSPerKm,
  recordSetIds,
  runKcal,
  sessionItems,
  sessionVolume,
  templateOccurrences,
  templateSets,
  weekStats,
  type GymSetRow,
  type RunRow,
  type SessionRow,
  type SkipRow,
  type TemplateItemRow,
  type TemplateRow,
  type SportItem,
} from "./model";

const set = (o: Partial<GymSetRow>): GymSetRow => ({
  id: "x",
  user_id: "u",
  session_id: "s",
  exercise_id: "e1",
  exercise_position: 1,
  set_no: 1,
  weight_kg: 60,
  reps: 8,
  done: true,
  ...o,
});

describe("tempo i formatowanie", () => {
  it("liczy tempo i formatuje", () => {
    expect(paceSPerKm(10, 3480)).toBe(348);
    expect(formatPace(348)).toBe("5:48");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(2700)).toBe("45:00");
    expect(formatKm(8)).toBe("8,0");
    expect(formatKg(72.5)).toBe("72,5");
    expect(formatKg(null)).toBe("mc");
  });
});

describe("runKcal", () => {
  it("liczy wg ACSM", () => {
    const v = (8 * 1000) / (2896 / 60);
    const oczekiwane = Math.round(
      (((3.5 + 0.2 * v) * 72 * (2896 / 60)) / 1000) * 5,
    );
    expect(runKcal(8, 2896, 72)).toBe(oczekiwane);
    expect(runKcal(8, 2896, null)).toBeNull();
  });
});

describe("1RM i objętość", () => {
  it("Epley zaokrągla do 0,5", () => {
    expect(epley1rm(70, 6)).toBe(84);
    expect(epley1rm(72.5, 5)).toBe(84.5);
  });
  it("objętość liczy tylko zrobione serie z ciężarem", () => {
    expect(
      sessionVolume([
        { weight_kg: null, reps: 10, done: true },
        { weight_kg: 60, reps: 8, done: false },
      ]),
    ).toBe(0);
    expect(sessionVolume([{ weight_kg: 60, reps: 8, done: true }])).toBe(480);
  });
});

describe("recordSetIds", () => {
  it("pierwsza sesja bez rekordu, potem tylko najcięższa seria ponad max", () => {
    const wynik = recordSetIds(
      [
        {
          sessionId: "s2",
          startLocal: "2026-11-10T10:00:00",
          sets: [
            set({ id: "b1", weight_kg: 72.5 }),
            set({ id: "b2", weight_kg: 72.5, set_no: 2 }),
            set({ id: "b3", weight_kg: 71, set_no: 3 }),
            set({ id: "bn", weight_kg: null, set_no: 4 }),
          ],
        },
        {
          sessionId: "s1",
          startLocal: "2026-11-03T10:00:00",
          sets: [set({ id: "a1", weight_kg: 70 })],
        },
      ],
      "e1",
    );
    expect([...wynik]).toEqual(["b1"]);
  });
  it("niezrobione serie nie ustalają maksimum ani nie są rekordem", () => {
    const wynik = recordSetIds(
      [
        {
          sessionId: "s1",
          startLocal: "2026-11-03T10:00:00",
          sets: [set({ id: "a1", weight_kg: 100, done: false })],
        },
        {
          sessionId: "s2",
          startLocal: "2026-11-10T10:00:00",
          sets: [set({ id: "b1", weight_kg: 60 })],
        },
      ],
      "e1",
    );
    expect(wynik.size).toBe(0);
  });
});

const szablon = (o: Partial<TemplateRow> = {}): TemplateRow => ({
  id: "t1",
  user_id: "u",
  name: "Push",
  weekdays: [1, 4],
  start_time: "18:30:00",
  last_used_at: null,
  created_at: null,
  ...o,
});

describe("templateOccurrences", () => {
  // 2026-11-16 to poniedziałek, 2026-11-18 środa
  const od = "2026-11-16";
  const doo = "2026-11-22";
  it("pomija przeszłość, bierze czwartek z godziną szablonu", () => {
    const w = templateOccurrences([szablon()], [], [], od, doo, "2026-11-18");
    expect(w.map((i) => i.key)).toEqual(["t:t1:2026-11-19"]);
    expect(w[0].startMin).toBe(18 * 60 + 30);
    expect(w[0].planned).toBe(true);
    expect(w[0].kind).toBe("gym");
    expect(w[0].title).toBe("Push");
  });
  it("pomija dni z template_skips", () => {
    const skip: SkipRow = {
      template_id: "t1",
      date: "2026-11-19",
      user_id: "u",
    };
    expect(
      templateOccurrences([szablon()], [skip], [], od, doo, "2026-11-18"),
    ).toEqual([]);
  });
  it("pomija dni z już utworzoną sesją", () => {
    const sesja = {
      id: "s1",
      template_id: "t1",
      template_date: "2026-11-19",
    } as SessionRow;
    expect(
      templateOccurrences([szablon()], [], [sesja], od, doo, "2026-11-18"),
    ).toEqual([]);
  });
});

describe("sessionItems", () => {
  const sesja = (o: Partial<SessionRow>): SessionRow => ({
    id: "s1",
    user_id: "u",
    type: "run",
    title: "Spokojny",
    start_local: "2026-11-16T07:00:00",
    end_local: null,
    completed: false,
    show_in_calendar: true,
    template_id: null,
    template_date: null,
    note: null,
    created_at: null,
    ...o,
  });
  const bieg = (o: Partial<RunRow>): RunRow => ({
    session_id: "s1",
    user_id: "u",
    kind: "easy",
    distance_km: 10,
    duration_s: 3600,
    difficulty: null,
    weight_kg_snapshot: 72,
    kcal: 700,
    ...o,
  });
  it("bieg wykonany ma czas z duration_s, plan 60 min, siłownia 90 min", () => {
    const items = sessionItems(
      [
        sesja({}),
        sesja({ id: "s2" }),
        sesja({ id: "s3", type: "gym", title: "Push" }),
      ],
      [bieg({}), bieg({ session_id: "s2", duration_s: null })],
    );
    expect(items[0]).toMatchObject({
      key: "s:s1",
      kind: "run",
      date: "2026-11-16",
      startMin: 420,
      durationMin: 60,
      planned: false,
      runKind: "easy",
    });
    expect(items[1]).toMatchObject({ planned: true, durationMin: 60 });
    expect(items[2]).toMatchObject({
      kind: "gym",
      planned: true,
      durationMin: 90,
      runKind: null,
    });
  });
  it("end_local ma pierwszeństwo, ukończony trening nie jest planem", () => {
    const items = sessionItems(
      [
        sesja({
          type: "gym",
          completed: true,
          end_local: "2026-11-16T08:15:00",
        }),
      ],
      [],
    );
    expect(items[0]).toMatchObject({ planned: false, durationMin: 75 });
  });
});

describe("weekStats", () => {
  const bieg = (
    date: string,
    km: number | null,
    s: number | null,
    kcal: number | null,
    planned = false,
  ): SportItem => ({
    key: date,
    kind: "run",
    sessionId: date,
    templateId: null,
    date,
    startMin: 0,
    durationMin: 60,
    title: "x",
    planned,
    showInCalendar: true,
    distanceKm: km,
    durationS: s,
    kcal,
    difficulty: null,
    runKind: "easy",
    note: null,
  });
  it("sumuje km, tempo i kcal wykonanych biegów", () => {
    const w = weekStats(
      [
        bieg("2026-11-16", 10, 3480, 700),
        bieg("2026-11-18", 6, 2130, 400),
        bieg("2026-11-20", 5, null, null, true),
        bieg("2026-11-23", 9, 3000, 600),
      ],
      "2026-11-16",
    );
    expect(w.km).toBe(16);
    expect(w.paceS).toBe((3480 + 2130) / 16);
    expect(w.done).toBe(2);
    expect(w.kcal).toBe(1100);
  });
  it("bez biegów tempo to null", () => {
    expect(weekStats([], "2026-11-16").paceS).toBeNull();
  });
});

describe("monthGrid", () => {
  it("6 x 7, start zależny od week_start", () => {
    const pn = monthGrid("2026-11", "mon");
    expect(pn).toHaveLength(6);
    expect(pn[0]).toHaveLength(7);
    expect(pn[0][0]).toBe("2026-10-26");
    // 1 listopada 2026 to niedziela, więc przy week_start = sun siatka zaczyna się od niego
    expect(monthGrid("2026-11", "sun")[0][0]).toBe("2026-11-01");
    expect(monthGrid("2026-10", "sun")[0][0]).toBe("2026-09-27");
  });
});

describe("templateSets i firstReps", () => {
  const poz: TemplateItemRow = {
    id: "i1",
    user_id: "u",
    template_id: "t1",
    exercise_id: "e1",
    position: 3,
    sets_count: 3,
    reps_text: "8–10",
    rest_s: 120,
  };
  it("serie z historii, brakujące kopiują ostatnią", () => {
    const hist = new Map([
      [
        "e1",
        [
          set({ set_no: 1, weight_kg: 60, reps: 8 }),
          set({ set_no: 2, weight_kg: 62.5, reps: 6 }),
        ],
      ],
    ]);
    expect(templateSets([poz], hist)).toEqual([
      {
        exercise_id: "e1",
        exercise_position: 3,
        set_no: 1,
        weight_kg: 60,
        reps: 8,
      },
      {
        exercise_id: "e1",
        exercise_position: 3,
        set_no: 2,
        weight_kg: 62.5,
        reps: 6,
      },
      {
        exercise_id: "e1",
        exercise_position: 3,
        set_no: 3,
        weight_kg: 62.5,
        reps: 6,
      },
    ]);
  });
  it("bez historii kg puste, powtórzenia z reps_text", () => {
    const w = templateSets([poz], new Map());
    expect(w).toHaveLength(3);
    expect(w.every((s) => s.weight_kg === null && s.reps === 8)).toBe(true);
  });
  it("firstReps", () => {
    expect(firstReps("8–10")).toBe(8);
    expect(firstReps("12")).toBe(12);
    expect(firstReps("AMRAP")).toBeNull();
  });
});

describe("searchExercises", () => {
  it("bez duplikatów i wykluczonych", () => {
    const w = searchExercises(
      "wyc",
      [{ id: "1", name: "Wyciskanie na ławce", muscle_group: "klatka" }],
      ["Wyciskanie żołnierskie"],
    );
    const nazwy = w.map((e) => e.name.toLowerCase());
    expect(nazwy.filter((n) => n === "wyciskanie na ławce")).toHaveLength(1);
    expect(nazwy).not.toContain("wyciskanie żołnierskie");
    expect(w[0].id).toBe("1");
    expect(w.find((e) => e.name === "Wyciskanie hantli skos")?.id).toBeNull();
  });
  it("biblioteka nie ma duplikatów", () => {
    const n = EXERCISE_LIBRARY.map((e) => e.name.toLowerCase());
    expect(new Set(n).size).toBe(n.length);
  });
});
