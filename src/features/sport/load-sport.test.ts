import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";
import {
  loadExercise,
  loadSportMonth,
  loadSportRun,
  loadTemplate,
  loadWorkout,
} from "./load-sport";

const BIEG = "b1000000-0000-4000-8000-000000000001";
const SILA = "b1000000-0000-4000-8000-000000000002";
const STARA = "b1000000-0000-4000-8000-000000000003";
const SZABLON = "c1000000-0000-4000-8000-000000000001";
const PRZYSIAD = "d1000000-0000-4000-8000-000000000001";
const MARTWY = "d1000000-0000-4000-8000-000000000002";

type Fake = ReturnType<typeof fakeTable>;

// Kolejne from(nazwa) dostają kolejne atrapy z listy (ostatnia zostaje)
function klient(tables: Record<string, Fake | Fake[]>) {
  return {
    from: (nazwa: string) => {
      const t = tables[nazwa];
      if (!Array.isArray(t)) return t;
      return t.length > 1 ? t.shift() : t[0];
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- atrapa klienta
  } as any;
}

const sesjaBiegu = {
  id: BIEG,
  user_id: "u1",
  type: "run",
  title: "Spokojny",
  start_local: "2026-11-16T07:00:00",
  end_local: null,
  note: null,
  completed: true,
  show_in_calendar: true,
  template_id: null,
  template_date: null,
  created_at: null,
};
const sesjaSilowa = {
  ...sesjaBiegu,
  id: SILA,
  type: "gym",
  title: "Trening siłowy",
  start_local: "2026-11-17T17:00:00",
  end_local: "2026-11-17T18:15:00",
};
const seria = (
  id: string,
  sessionId: string,
  exerciseId: string,
  pos: number,
  nr: number,
  kg: number | null,
) => ({
  id,
  user_id: "u1",
  session_id: sessionId,
  exercise_id: exerciseId,
  exercise_position: pos,
  set_no: nr,
  weight_kg: kg,
  reps: 8,
  done: true,
});

let tables: Record<string, Fake | Fake[]>;
let miesiacSesji: Fake;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T10:00:00Z")); // środa
  miesiacSesji = fakeTable({ data: [sesjaBiegu, sesjaSilowa] });
  tables = {
    profiles: fakeTable({
      single: {
        timezone: "Europe/Warsaw",
        week_start: "mon",
        clock: "24",
        weight_kg: 72.5,
        workouts_goal_on: true,
        weekly_workouts_goal: null,
        km_goal_on: false,
        weekly_km_goal: 30,
      },
    }),
    sport_sessions: [
      miesiacSesji,
      fakeTable({ data: [sesjaBiegu] }), // ostatnie biegi
      fakeTable({ data: [sesjaSilowa] }), // ostatnie siłowe
      // sesje siłowe do historii serii (celowo malejąco)
      fakeTable({
        data: [
          {
            id: SILA,
            start_local: "2026-11-17T17:00:00",
            title: "Trening siłowy",
            completed: true,
          },
          {
            id: STARA,
            start_local: "2026-11-10T17:00:00",
            title: "Push",
            completed: true,
          },
        ],
      }),
    ],
    runs: fakeTable({
      data: [
        {
          session_id: BIEG,
          user_id: "u1",
          kind: "easy",
          distance_km: 8,
          duration_s: 2880,
          difficulty: 4,
          weight_kg_snapshot: 72.5,
          kcal: 600,
        },
      ],
    }),
    workout_templates: fakeTable({
      data: [
        {
          id: SZABLON,
          user_id: "u1",
          name: "Push",
          weekdays: [3, 5],
          start_time: "17:00:00",
          last_used_at: null,
          created_at: null,
        },
      ],
    }),
    workout_template_items: fakeTable({
      data: [
        {
          id: "p2",
          template_id: SZABLON,
          exercise_id: MARTWY,
          position: 2,
          sets_count: 3,
          reps_text: "5",
          rest_s: 180,
          user_id: "u1",
        },
        {
          id: "p1",
          template_id: SZABLON,
          exercise_id: PRZYSIAD,
          position: 1,
          sets_count: 4,
          reps_text: "8–10",
          rest_s: 120,
          user_id: "u1",
        },
      ],
    }),
    template_skips: fakeTable({
      data: [{ template_id: SZABLON, user_id: "u1", date: "2026-11-20" }],
    }),
    exercises: fakeTable({
      data: [
        {
          id: MARTWY,
          user_id: "u1",
          name: "Martwy ciąg",
          muscle_group: "plecy",
          created_at: null,
        },
        {
          id: PRZYSIAD,
          user_id: "u1",
          name: "Przysiad",
          muscle_group: "nogi",
          created_at: null,
        },
      ],
      single: {
        id: PRZYSIAD,
        user_id: "u1",
        name: "Przysiad",
        muscle_group: "nogi",
        created_at: null,
      },
    }),
    gym_sets: fakeTable({
      data: [
        seria("s3", SILA, PRZYSIAD, 1, 2, 65),
        seria("s2", SILA, PRZYSIAD, 1, 1, 62.5),
        seria("s1", STARA, PRZYSIAD, 1, 1, 60),
      ],
    }),
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loadSportMonth", () => {
  it("profil z wartościami domyślnymi celów", async () => {
    const d = await loadSportMonth(klient(tables), "u1", "2026-11");
    expect(d.today).toBe("2026-11-18");
    expect(d.month).toBe("2026-11");
    expect(d.profile).toEqual({
      timezone: "Europe/Warsaw",
      weekStart: "mon",
      clock: "24",
      weightKg: 72.5,
      workoutsGoalOn: true,
      weeklyWorkoutsGoal: 3,
      kmGoalOn: false,
      weeklyKmGoal: 30,
    });
  });

  it("sesje z siatki miesiąca i 12 ostatnich tygodni", async () => {
    await loadSportMonth(klient(tables), "u1", "2026-11");
    const filtr = vi.mocked(miesiacSesji.or).mock.calls[0][0] as string;
    // siatka 26.10–6.12, wykres 31.08–22.11
    expect(filtr).toContain("start_local.gte.2026-10-26T00:00:00");
    expect(filtr).toContain("start_local.lt.2026-12-07T00:00:00");
    expect(filtr).toContain("start_local.gte.2026-08-31T00:00:00");
    expect(filtr).toContain("start_local.lt.2026-11-23T00:00:00");
  });

  it("zły miesiąc → bieżący", async () => {
    const d = await loadSportMonth(klient(tables), "u1", "2026-13");
    expect(d.month).toBe("2026-11");
  });

  it("elementy: sesje z danymi biegu i wystąpienia szablonu od dziś, bez pominięć", async () => {
    const d = await loadSportMonth(klient(tables), "u1", "2026-11");
    const klucze = d.items.map((i) => i.key);
    expect(klucze.slice(0, 3)).toEqual([
      `s:${BIEG}`,
      `s:${SILA}`,
      `t:${SZABLON}:2026-11-18`,
    ]);
    // pt 13.11 jest w przeszłości, pt 20.11 pominięty
    expect(klucze).not.toContain(`t:${SZABLON}:2026-11-13`);
    expect(klucze).not.toContain(`t:${SZABLON}:2026-11-20`);
    expect(klucze).toContain(`t:${SZABLON}:2026-11-25`);
    expect(klucze).toContain(`t:${SZABLON}:2026-12-04`);
    expect(klucze).not.toContain(`t:${SZABLON}:2026-12-09`);
    // każde wystąpienie tylko raz, choć zakresy się nakładają
    expect(new Set(klucze).size).toBe(klucze.length);
    const bieg = d.items.find((i) => i.key === `s:${BIEG}`);
    expect(bieg).toMatchObject({ planned: false, distanceKm: 8, kcal: 600 });
  });

  it("ostatnie treningi malejąco po dacie", async () => {
    const d = await loadSportMonth(klient(tables), "u1", "2026-11");
    expect(d.recent.map((i) => i.key)).toEqual([`s:${SILA}`, `s:${BIEG}`]);
  });

  it("szablony z pozycjami w kolejności i nazwami ćwiczeń", async () => {
    const d = await loadSportMonth(klient(tables), "u1", "2026-11");
    expect(d.templates[0].items.map((i) => i.exerciseName)).toEqual([
      "Przysiad",
      "Martwy ciąg",
    ]);
  });

  it("historia serii pogrupowana po sesji, rosnąco po starcie", async () => {
    const d = await loadSportMonth(klient(tables), "u1", "2026-11");
    expect(d.setsHistory.map((h) => h.sessionId)).toEqual([STARA, SILA]);
    expect(d.setsHistory[1].sets.map((s) => s.id)).toEqual(["s2", "s3"]);
  });

  it("błąd zapytania trafia do granicy błędu", async () => {
    tables.workout_templates = fakeTable({ error: { message: "x" } });
    await expect(
      loadSportMonth(klient(tables), "u1", "2026-11"),
    ).rejects.toThrow("x");
  });
});

describe("loadWorkout", () => {
  it("nie-uuid → null", async () => {
    expect(await loadWorkout(klient(tables), "u1", "abc")).toBeNull();
  });

  it("brak sesji → null", async () => {
    tables.sport_sessions = fakeTable({ single: null });
    expect(await loadWorkout(klient(tables), "u1", SILA)).toBeNull();
  });

  it("sesja z seriami i historią ćwiczeń", async () => {
    tables.sport_sessions = [
      fakeTable({ single: sesjaSilowa }),
      fakeTable({
        data: [
          {
            id: SILA,
            start_local: "2026-11-17T17:00:00",
            title: "Trening siłowy",
            completed: true,
          },
          {
            id: STARA,
            start_local: "2026-11-10T17:00:00",
            title: "Push",
            completed: true,
          },
        ],
      }),
    ];
    const d = await loadWorkout(klient(tables), "u1", SILA);
    expect(d?.session.id).toBe(SILA);
    expect(d?.history.map((h) => h.sessionId)).toEqual([STARA, SILA]);
    expect(d?.exercises).toHaveLength(2);
  });
});

describe("loadTemplate i loadExercise", () => {
  it("loadTemplate: brak → null", async () => {
    tables.workout_templates = fakeTable({ single: null });
    expect(await loadTemplate(klient(tables), "u1", SZABLON)).toBeNull();
  });

  it("loadExercise: ćwiczenie z historią", async () => {
    tables.sport_sessions = fakeTable({
      data: [
        {
          id: SILA,
          start_local: "2026-11-17T17:00:00",
          title: "Trening siłowy",
          completed: true,
        },
      ],
    });
    const d = await loadExercise(klient(tables), "u1", PRZYSIAD);
    expect(d?.exercise.name).toBe("Przysiad");
    expect(d?.history).toHaveLength(1);
  });

  it("loadExercise: nie-uuid → null", async () => {
    expect(await loadExercise(klient(tables), "u1", "x")).toBeNull();
  });
});

describe("loadSportRun", () => {
  it("bieg z danymi jako element kalendarza", async () => {
    const klientBiegu = klient({
      sport_sessions: fakeTable({ single: sesjaBiegu }),
      runs: fakeTable({
        data: [
          {
            session_id: BIEG,
            kind: "tempo",
            distance_km: 10,
            duration_s: 3480,
            kcal: 700,
            difficulty: 6,
          },
        ],
      }),
    });
    const item = await loadSportRun(klientBiegu, "u1", BIEG);
    expect(item).toMatchObject({
      sessionId: BIEG,
      kind: "run",
      distanceKm: 10,
      durationS: 3480,
      runKind: "tempo",
      planned: false,
    });
  });

  it("brak sesji albo nie-uuid → null", async () => {
    const pusty = klient({ sport_sessions: fakeTable({ single: null }) });
    expect(await loadSportRun(pusty, "u1", BIEG)).toBeNull();
    expect(await loadSportRun(pusty, "u1", "x")).toBeNull();
  });
});
