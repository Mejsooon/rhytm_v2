// Dane testowe ekranu Sport (listopad 2026, tydzień od poniedziałku, dziś = wt 17.11).
import type { SportMonthData } from "./load-sport";
import type { GymSetRow, SportItem } from "./model";

export const WYCISKANIE = "e1000000-0000-4000-8000-000000000001";
export const POMPKI = "e1000000-0000-4000-8000-000000000002";
export const SZABLON_PUSH = "c1000000-0000-4000-8000-000000000001";
export const SESJA_PULL = "a1000000-0000-4000-8000-000000000006";
export const SESJA_PUSH = "a1000000-0000-4000-8000-000000000012";

const pusty: SportItem = {
  key: "",
  kind: "run",
  sessionId: null,
  templateId: null,
  date: "2026-11-01",
  startMin: 0,
  durationMin: 60,
  title: "",
  planned: false,
  showInCalendar: true,
  distanceKm: null,
  durationS: null,
  kcal: null,
  difficulty: null,
  runKind: null,
  note: null,
};

export function bieg(
  id: string,
  date: string,
  zmiany: Partial<SportItem> = {},
): SportItem {
  return {
    ...pusty,
    key: `s:${id}`,
    sessionId: id,
    date,
    title: "Spokojny",
    runKind: "easy",
    ...zmiany,
  };
}

const seria = (
  id: string,
  sesja: string,
  cwiczenie: string,
  pozycja: number,
  nr: number,
  kg: number | null,
  powt: number,
): GymSetRow => ({
  id,
  user_id: "u1",
  session_id: sesja,
  exercise_id: cwiczenie,
  exercise_position: pozycja,
  set_no: nr,
  weight_kg: kg,
  reps: powt,
  done: true,
  set_type: "N",
  duration_s: null,
  distance_km: null,
});

export function daneSportu(
  zmiany: Partial<SportMonthData> = {},
): SportMonthData {
  const items: SportItem[] = [
    {
      ...pusty,
      key: `s:${SESJA_PULL}`,
      kind: "gym",
      sessionId: SESJA_PULL,
      date: "2026-11-06",
      startMin: 16 * 60,
      durationMin: 90,
      title: "Pull",
      difficulty: 7,
    },
    bieg("a1000000-0000-4000-8000-000000000010", "2026-11-10", {
      title: "Interwały",
      runKind: "intervals",
      startMin: 17 * 60,
      durationMin: 34,
      distanceKm: 6.4,
      durationS: 2035,
      kcal: 520,
      difficulty: 9,
    }),
    {
      ...pusty,
      key: `s:${SESJA_PUSH}`,
      kind: "gym",
      sessionId: SESJA_PUSH,
      date: "2026-11-12",
      startMin: 16 * 60,
      durationMin: 90,
      title: "Push",
      difficulty: 8,
      note: "Nowy rekord w wyciskaniu: 72,5 × 5.",
    },
    bieg("a1000000-0000-4000-8000-000000000015", "2026-11-15", {
      title: "Długi bieg",
      runKind: "long",
      startMin: 9 * 60,
      durationMin: 70,
      distanceKm: 12,
      durationS: 4212,
      kcal: 912,
      difficulty: 7,
      note: "Ostatnie 2 km mocniej, nogi dobrze.",
    }),
    bieg("a1000000-0000-4000-8000-000000000017", "2026-11-17", {
      title: "Spokojny",
      startMin: 16 * 60,
      durationMin: 60,
      planned: true,
      distanceKm: 10,
    }),
    {
      ...pusty,
      key: `t:${SZABLON_PUSH}:2026-11-19`,
      kind: "gym",
      templateId: SZABLON_PUSH,
      date: "2026-11-19",
      startMin: 15 * 60,
      durationMin: 90,
      title: "Push",
      planned: true,
    },
    bieg("a1000000-0000-4000-8000-000000000029", "2026-11-29", {
      title: "Spokojny",
      startMin: 10 * 60,
      durationMin: 50,
      distanceKm: 8,
      durationS: 2896,
      kcal: 610,
      difficulty: 5,
    }),
  ];
  return {
    today: "2026-11-17",
    month: "2026-11",
    profile: {
      timezone: "Europe/Warsaw",
      weekStart: "mon",
      clock: "24",
      weightKg: 72,
      workoutsGoalOn: true,
      weeklyWorkoutsGoal: 3,
      kmGoalOn: true,
      weeklyKmGoal: 25,
    },
    items,
    recent: items
      .filter((i) => !i.planned)
      .sort((a, b) => (a.date > b.date ? -1 : 1)),
    exercises: [
      {
        id: POMPKI,
        user_id: "u1",
        name: "Pompki na poręczach",
        muscle_group: "Klatka",
        created_at: null,
        bodyweight: false,
        kind: null,
        equipment: null,
        note: null,
        rest_s: null,
      },
      {
        id: WYCISKANIE,
        user_id: "u1",
        name: "Wyciskanie na ławce",
        muscle_group: "Klatka",
        created_at: null,
        bodyweight: false,
        kind: null,
        equipment: null,
        note: null,
        rest_s: null,
      },
    ],
    setsHistory: [
      {
        sessionId: SESJA_PULL,
        startLocal: "2026-11-06T16:00:00",
        title: "Pull",
        completed: true,
        sets: [seria("s01", SESJA_PULL, WYCISKANIE, 1, 1, 70, 5)],
      },
      {
        sessionId: SESJA_PUSH,
        startLocal: "2026-11-12T16:00:00",
        title: "Push",
        completed: true,
        sets: [
          seria("s11", SESJA_PUSH, WYCISKANIE, 1, 1, 72.5, 5),
          seria("s12", SESJA_PUSH, WYCISKANIE, 1, 2, 72.5, 4),
          seria("s13", SESJA_PUSH, POMPKI, 2, 1, null, 10),
        ],
      },
    ],
    templates: [
      {
        id: SZABLON_PUSH,
        user_id: "u1",
        name: "Push",
        weekdays: [4],
        start_time: "15:00:00",
        last_used_at: null,
        created_at: null,
        items: [
          {
            id: "ti1",
            user_id: "u1",
            template_id: SZABLON_PUSH,
            exercise_id: WYCISKANIE,
            position: 1,
            sets_count: 4,
            reps_text: "5",
            rest_s: 120,
            exerciseName: "Wyciskanie na ławce",
          },
          {
            id: "ti2",
            user_id: "u1",
            template_id: SZABLON_PUSH,
            exercise_id: POMPKI,
            position: 2,
            sets_count: 3,
            reps_text: "8–10",
            rest_s: 90,
            exerciseName: "Pompki na poręczach",
          },
        ],
      },
    ],
    ...zmiany,
  };
}
