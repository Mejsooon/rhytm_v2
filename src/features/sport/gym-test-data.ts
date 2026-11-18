// Dane testowe ekranu treningu siłowego (czw 19.11.2026 15:00, z szablonu „Push”).
import type { WorkoutData } from "./load-sport";
import type { GymSetRow } from "./model";
import {
  POMPKI,
  SESJA_PUSH,
  SZABLON_PUSH,
  WYCISKANIE,
} from "./sport-test-data";

export const SESJA = "a1000000-0000-4000-8000-000000000019";

export const seriaTreningu = (
  id: string,
  sesja: string,
  cwiczenie: string,
  pozycja: number,
  nr: number,
  kg: number | null,
  powt: number | null,
  done: boolean,
): GymSetRow => ({
  id,
  user_id: "u1",
  session_id: sesja,
  exercise_id: cwiczenie,
  exercise_position: pozycja,
  set_no: nr,
  weight_kg: kg,
  reps: powt,
  done,
});

// Wyciskanie: 70×6 ✓, 70×6 ✓, 72,5×5 ✓, 72,5×4; pompki na poręczach: mc×12, mc×10.
// Poprzednio (czw 12.11) wyciskanie maks. 70 kg → REKORD na 72,5 i „+2,5 kg vs ostatnio”.
export function daneTreningu(zmiany: Partial<WorkoutData> = {}): WorkoutData {
  const sets = [
    seriaTreningu("w1", SESJA, WYCISKANIE, 1, 1, 70, 6, true),
    seriaTreningu("w2", SESJA, WYCISKANIE, 1, 2, 70, 6, true),
    seriaTreningu("w3", SESJA, WYCISKANIE, 1, 3, 72.5, 5, true),
    seriaTreningu("w4", SESJA, WYCISKANIE, 1, 4, 72.5, 4, false),
    seriaTreningu("p1", SESJA, POMPKI, 2, 1, null, 12, false),
    seriaTreningu("p2", SESJA, POMPKI, 2, 2, null, 10, false),
  ];
  return {
    today: "2026-11-19",
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
    session: {
      id: SESJA,
      user_id: "u1",
      type: "gym",
      title: "Push",
      start_local: "2026-11-19T15:00:00",
      end_local: null,
      note: null,
      completed: false,
      show_in_calendar: true,
      template_id: SZABLON_PUSH,
      template_date: "2026-11-19",
      created_at: null,
      difficulty: null,
    },
    templateName: "Push",
    sets,
    exercises: [
      {
        id: POMPKI,
        user_id: "u1",
        name: "Pompki na poręczach",
        muscle_group: "triceps",
        created_at: null,
      },
      {
        id: WYCISKANIE,
        user_id: "u1",
        name: "Wyciskanie na ławce",
        muscle_group: "klatka",
        created_at: null,
      },
    ],
    history: [
      {
        sessionId: SESJA_PUSH,
        startLocal: "2026-11-12T16:00:00",
        title: "Push",
        completed: true,
        sets: [
          seriaTreningu("h1", SESJA_PUSH, WYCISKANIE, 1, 1, 70, 6, true),
          seriaTreningu("h2", SESJA_PUSH, WYCISKANIE, 1, 2, 70, 5, true),
        ],
      },
      {
        sessionId: SESJA,
        startLocal: "2026-11-19T15:00:00",
        title: "Push",
        completed: false,
        sets,
      },
    ],
    ...zmiany,
  };
}
