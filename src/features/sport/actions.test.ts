import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";
import { runKcal } from "./model";

const { getUser, from, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  addExercise,
  addSet,
  createGymSession,
  deleteSession,
  deleteSet,
  deleteTemplate,
  finishWorkout,
  removeExercise,
  renameExercise,
  saveRun,
  saveSessionAsTemplate,
  saveTemplate,
  skipTemplateOccurrence,
  updateSet,
} from "./actions";

const SESJA = "b1000000-0000-4000-8000-000000000001";
const STARA = "b1000000-0000-4000-8000-000000000002";
const SZABLON = "c1000000-0000-4000-8000-000000000001";
const PRZYSIAD = "d1000000-0000-4000-8000-000000000001";
const MARTWY = "d1000000-0000-4000-8000-000000000002";
const LAWKA = "d1000000-0000-4000-8000-000000000003";
const SERIA = "e1000000-0000-4000-8000-000000000001";

type Fake = ReturnType<typeof fakeTable>;
// Tabela może mieć kolejkę atrap: kolejne from(nazwa) dostają kolejne atrapy (ostatnia zostaje)
let tables: Record<string, Fake | Fake[]>;

const bieg = {
  kind: "easy" as const,
  date: "2026-11-18",
  start: "07:00",
  distanceKm: 10,
  durationS: null as number | null,
  difficulty: null as number | null,
  note: "",
  showInCalendar: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T10:00:00Z")); // 11:00 w Warszawie
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  tables = {
    profiles: fakeTable({
      single: { timezone: "Europe/Warsaw", weight_kg: 70 },
    }),
    sport_sessions: fakeTable({ data: [{ id: SESJA }], single: { id: SESJA } }),
    runs: fakeTable(),
    exercises: fakeTable({ data: [] }),
    gym_sets: fakeTable({ data: [] }),
    workout_templates: fakeTable({ single: { id: SZABLON } }),
    workout_template_items: fakeTable({ data: [] }),
    template_skips: fakeTable(),
  };
  from.mockImplementation((nazwa: string) => {
    const t = tables[nazwa];
    if (!Array.isArray(t)) return t;
    return t.length > 1 ? t.shift() : t[0];
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("bez sesji", () => {
  it.each([
    ["saveRun", () => saveRun(bieg)],
    ["deleteSession", () => deleteSession(SESJA)],
    [
      "skipTemplateOccurrence",
      () => skipTemplateOccurrence(SZABLON, "2026-11-20"),
    ],
    [
      "createGymSession",
      () => createGymSession({ date: "2026-11-18", start: "17:00" }),
    ],
    ["addExercise", () => addExercise(SESJA, "Przysiad")],
    ["updateSet", () => updateSet(SERIA, { done: true })],
    ["addSet", () => addSet(SESJA, PRZYSIAD)],
    ["deleteSet", () => deleteSet(SERIA)],
    ["removeExercise", () => removeExercise(SESJA, PRZYSIAD)],
    ["finishWorkout", () => finishWorkout(SESJA)],
    [
      "saveTemplate",
      () =>
        saveTemplate({
          name: "Push",
          weekdays: [],
          startTime: "17:00",
          items: [],
        }),
    ],
    ["deleteTemplate", () => deleteTemplate(SZABLON)],
    ["saveSessionAsTemplate", () => saveSessionAsTemplate(SESJA, "Push")],
    ["renameExercise", () => renameExercise(PRZYSIAD, "Przysiad")],
  ])("%s przekierowuje na /logowanie", async (_nazwa, akcja) => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(akcja()).rejects.toThrow("REDIRECT:/logowanie");
  });
});

describe("saveRun", () => {
  it("bez czasu zapisuje plan: duration_s i kcal null", async () => {
    const w = await saveRun(bieg);
    expect(w).toEqual({ ok: true, id: SESJA });
    const sesje = tables.sport_sessions as Fake;
    expect(sesje.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        type: "run",
        title: "Spokojny",
        start_local: "2026-11-18T07:00:00",
        completed: false,
        show_in_calendar: true,
        note: null,
      }),
    );
    expect((tables.runs as Fake).insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: SESJA,
        kind: "easy",
        distance_km: 10,
        duration_s: null,
        kcal: null,
        weight_kg_snapshot: null,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/sport");
    expect(revalidatePath).toHaveBeenCalledWith("/kalendarz");
  });

  it("z czasem liczy kcal z wagi profilu i zapisuje weight_kg_snapshot", async () => {
    await saveRun({ ...bieg, durationS: 3000, kind: "tempo" });
    expect((tables.sport_sessions as Fake).insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Tempo", completed: true }),
    );
    expect((tables.runs as Fake).insert).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_s: 3000,
        kcal: runKcal(10, 3000, 70),
        weight_kg_snapshot: 70,
      }),
    );
  });

  it("dystans 0 przy czasie → błąd pola distanceKm, bez zapisu", async () => {
    const w = await saveRun({ ...bieg, distanceKm: 0, durationS: 3000 });
    expect(w).toMatchObject({ ok: false, field: "distanceKm" });
    expect((tables.sport_sessions as Fake).insert).not.toHaveBeenCalled();
  });

  it("brak dystansu przy czasie → błąd pola distanceKm", async () => {
    const w = await saveRun({ ...bieg, distanceKm: null, durationS: 3000 });
    expect(w).toMatchObject({ ok: false, field: "distanceKm" });
  });

  it("plan bez dystansu jest dozwolony", async () => {
    const w = await saveRun({ ...bieg, distanceKm: null });
    expect(w.ok).toBe(true);
  });

  it("edycja zachowuje wagę z chwili biegu", async () => {
    tables.runs = fakeTable({ single: { weight_kg_snapshot: 65 } });
    const w = await saveRun({ ...bieg, id: SESJA, durationS: 3000 });
    expect(w).toEqual({ ok: true, id: SESJA });
    expect((tables.sport_sessions as Fake).update).toHaveBeenCalled();
    expect((tables.runs as Fake).upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: SESJA,
        weight_kg_snapshot: 65,
        kcal: runKcal(10, 3000, 65),
      }),
      { onConflict: "session_id" },
    );
  });
});

describe("createGymSession", () => {
  const szablon = {
    id: SZABLON,
    user_id: "u1",
    name: "Push",
    weekdays: [3],
    start_time: "17:00:00",
    last_used_at: null,
    created_at: null,
  };
  const pozycje = [
    {
      id: "p1",
      user_id: "u1",
      template_id: SZABLON,
      exercise_id: PRZYSIAD,
      position: 1,
      sets_count: 3,
      reps_text: "8–10",
      rest_s: 120,
    },
  ];

  it("pusty trening: tytuł „Trening siłowy”, bez szablonu", async () => {
    const w = await createGymSession({ date: "2026-11-18", start: "17:15" });
    expect(w).toEqual({ ok: true, id: SESJA });
    expect((tables.sport_sessions as Fake).insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "gym",
        title: "Trening siłowy",
        start_local: "2026-11-18T17:15:00",
        template_id: null,
        template_date: null,
      }),
    );
  });

  it("dwa razy ten sam szablon i data → ten sam id (23505 → istniejąca sesja)", async () => {
    tables.workout_templates = fakeTable({ single: szablon });
    tables.workout_template_items = fakeTable({ data: pozycje });

    // Pierwsze kliknięcie tworzy sesję
    tables.sport_sessions = [
      fakeTable({ single: { id: SESJA } }),
      fakeTable({ data: [] }),
    ];
    const pierwsza = await createGymSession({
      date: "2026-11-20",
      start: "17:00",
      templateId: SZABLON,
    });

    // Drugie trafia na unikalność (template_id, template_date) i czyta istniejącą
    const konflikt = fakeTable({ error: { code: "23505", message: "dup" } });
    const odczyt = fakeTable({ single: { id: SESJA } });
    tables.sport_sessions = [konflikt, odczyt];
    vi.mocked((tables.gym_sets as Fake).insert).mockClear();
    const druga = await createGymSession({
      date: "2026-11-20",
      start: "17:00",
      templateId: SZABLON,
    });

    expect(pierwsza).toEqual({ ok: true, id: SESJA });
    expect(druga).toEqual({ ok: true, id: SESJA });
    expect(odczyt.eq).toHaveBeenCalledWith("template_id", SZABLON);
    expect(odczyt.eq).toHaveBeenCalledWith("template_date", "2026-11-20");
    // Drugie kliknięcie nie dokłada serii
    expect((tables.gym_sets as Fake).insert).not.toHaveBeenCalled();
  });

  it("z szablonu: start z godziny szablonu, serie z ostatnich ciężarów, last_used_at", async () => {
    tables.workout_templates = fakeTable({ single: szablon });
    tables.workout_template_items = fakeTable({ data: pozycje });
    const wstawienie = fakeTable({ single: { id: SESJA } });
    tables.sport_sessions = [
      wstawienie,
      fakeTable({
        data: [{ id: STARA, start_local: "2026-11-13T17:00:00" }],
      }),
    ];
    // Ostatnia wykonana sesja z przysiadem: 2 serie (trzecia bierze ostatnią)
    tables.gym_sets = fakeTable({
      data: [
        {
          id: "s1",
          session_id: STARA,
          exercise_id: PRZYSIAD,
          exercise_position: 1,
          set_no: 1,
          weight_kg: 60,
          reps: 8,
          done: true,
        },
        {
          id: "s2",
          session_id: STARA,
          exercise_id: PRZYSIAD,
          exercise_position: 1,
          set_no: 2,
          weight_kg: 62.5,
          reps: 6,
          done: true,
        },
      ],
    });

    const w = await createGymSession({
      date: "2026-11-20",
      start: "09:00",
      templateId: SZABLON,
    });
    expect(w).toEqual({ ok: true, id: SESJA });
    expect(wstawienie.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Push",
        start_local: "2026-11-20T17:00:00",
        template_id: SZABLON,
        template_date: "2026-11-20",
      }),
    );
    expect((tables.gym_sets as Fake).insert).toHaveBeenCalledWith([
      expect.objectContaining({
        session_id: SESJA,
        exercise_id: PRZYSIAD,
        set_no: 1,
        weight_kg: 60,
        reps: 8,
        done: false,
      }),
      expect.objectContaining({ set_no: 2, weight_kg: 62.5, reps: 6 }),
      expect.objectContaining({ set_no: 3, weight_kg: 62.5, reps: 6 }),
    ]);
    expect((tables.workout_templates as Fake).update).toHaveBeenCalledWith({
      last_used_at: "2026-11-18T10:00:00.000Z",
    });
  });

  it("dziś po godzinie szablonu start = teraz", async () => {
    tables.workout_templates = fakeTable({
      single: { ...szablon, start_time: "08:00:00" },
    });
    const wstawienie = fakeTable({ single: { id: SESJA } });
    tables.sport_sessions = [wstawienie, fakeTable({ data: [] })];
    await createGymSession({
      date: "2026-11-18",
      start: "08:00",
      templateId: SZABLON,
    });
    expect(wstawienie.insert).toHaveBeenCalledWith(
      expect.objectContaining({ start_local: "2026-11-18T11:00:00" }),
    );
  });

  it("bez historii: kg puste, powtórzenia z reps_text", async () => {
    tables.workout_templates = fakeTable({ single: szablon });
    tables.workout_template_items = fakeTable({ data: pozycje });
    tables.sport_sessions = [fakeTable({ single: { id: SESJA } })];
    await createGymSession({
      date: "2026-11-20",
      start: "17:00",
      templateId: SZABLON,
    });
    expect((tables.gym_sets as Fake).insert).toHaveBeenCalledWith([
      expect.objectContaining({ set_no: 1, weight_kg: null, reps: 8 }),
      expect.objectContaining({ set_no: 2, weight_kg: null, reps: 8 }),
      expect.objectContaining({ set_no: 3, weight_kg: null, reps: 8 }),
    ]);
  });
});

describe("addExercise", () => {
  it("„przysiad” przy istniejącym „Przysiad” używa istniejącego ćwiczenia", async () => {
    tables.exercises = fakeTable({
      data: [{ id: PRZYSIAD, name: "Przysiad" }],
    });
    const w = await addExercise(SESJA, "przysiad");
    expect(w).toEqual({ ok: true, id: PRZYSIAD });
    expect((tables.exercises as Fake).insert).not.toHaveBeenCalled();
    expect((tables.gym_sets as Fake).insert).toHaveBeenCalledWith([
      expect.objectContaining({
        exercise_id: PRZYSIAD,
        exercise_position: 1,
        set_no: 1,
        weight_kg: null,
        reps: null,
        done: false,
      }),
      expect.objectContaining({ set_no: 2 }),
      expect.objectContaining({ set_no: 3 }),
    ]);
  });

  it("nowe ćwiczenie z biblioteki dostaje grupę mięśni", async () => {
    tables.exercises = fakeTable({ data: [], single: { id: MARTWY } });
    const w = await addExercise(SESJA, "martwy ciąg");
    expect(w).toEqual({ ok: true, id: MARTWY });
    expect((tables.exercises as Fake).insert).toHaveBeenCalledWith({
      user_id: "u1",
      name: "martwy ciąg",
      muscle_group: "plecy",
    });
  });

  it("pozycja za ostatnim ćwiczeniem treningu", async () => {
    tables.exercises = fakeTable({
      data: [{ id: PRZYSIAD, name: "Przysiad" }],
    });
    tables.gym_sets = fakeTable({
      data: [{ exercise_id: MARTWY, exercise_position: 2 }],
    });
    await addExercise(SESJA, "Przysiad");
    expect((tables.gym_sets as Fake).insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ exercise_position: 3 }),
      ]),
    );
  });
});

describe("serie", () => {
  it("updateSet zapisuje tylko podane pola", async () => {
    tables.gym_sets = fakeTable({ data: [{ id: SERIA }] });
    const w = await updateSet(SERIA, { weight_kg: 72.5, done: true });
    expect(w).toEqual({ ok: true });
    expect((tables.gym_sets as Fake).update).toHaveBeenCalledWith({
      weight_kg: 72.5,
      done: true,
    });
  });

  it("addSet kopiuje ciężar i powtórzenia poprzedniej serii", async () => {
    tables.gym_sets = fakeTable({
      data: [
        { exercise_position: 2, set_no: 1, weight_kg: 60, reps: 8 },
        { exercise_position: 2, set_no: 2, weight_kg: 62.5, reps: 6 },
      ],
      single: { id: SERIA },
    });
    const w = await addSet(SESJA, PRZYSIAD);
    expect(w).toEqual({ ok: true, id: SERIA });
    expect((tables.gym_sets as Fake).insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: SESJA,
        exercise_id: PRZYSIAD,
        exercise_position: 2,
        set_no: 3,
        weight_kg: 62.5,
        reps: 6,
        done: false,
      }),
    );
  });
});

describe("finishWorkout", () => {
  it("oznacza wykonany i ustawia koniec = teraz w strefie profilu", async () => {
    tables.sport_sessions = fakeTable({
      data: [{ id: SESJA }],
      single: { id: SESJA, start_local: "2026-11-18T09:30:00" },
    });
    const w = await finishWorkout(SESJA);
    expect(w).toEqual({ ok: true });
    expect((tables.sport_sessions as Fake).update).toHaveBeenCalledWith({
      completed: true,
      end_local: "2026-11-18T11:00:00",
    });
  });

  it("start w przyszłości → bez end_local", async () => {
    tables.sport_sessions = fakeTable({
      data: [{ id: SESJA }],
      single: { id: SESJA, start_local: "2026-11-18T17:00:00" },
    });
    await finishWorkout(SESJA);
    expect((tables.sport_sessions as Fake).update).toHaveBeenCalledWith({
      completed: true,
      end_local: null,
    });
  });
});

describe("saveTemplate", () => {
  const wzor = {
    name: "Push",
    weekdays: [3, 1],
    startTime: "17:00",
    items: [
      { exerciseName: "Martwy ciąg", setsCount: 3, repsText: "5", restS: 180 },
      { exerciseName: "przysiad", setsCount: 4, repsText: "8–10", restS: 120 },
      {
        exerciseName: "Wyciskanie na ławce",
        setsCount: 3,
        repsText: "8",
        restS: 120,
      },
    ],
  };

  it("bez nazwy → błąd, bez zapisu", async () => {
    const w = await saveTemplate({ ...wzor, name: "  " });
    expect(w).toEqual({ ok: false, message: "Podaj nazwę." });
    expect((tables.workout_templates as Fake).insert).not.toHaveBeenCalled();
  });

  it("bez ćwiczeń → błąd, bez zapisu", async () => {
    const w = await saveTemplate({ ...wzor, items: [] });
    expect(w.ok).toBe(false);
    expect((tables.workout_templates as Fake).insert).not.toHaveBeenCalled();
  });

  it("zachowuje kolejność pozycji i używa istniejących ćwiczeń bez wielkości liter", async () => {
    tables.exercises = fakeTable({
      data: [
        { id: PRZYSIAD, name: "Przysiad" },
        { id: MARTWY, name: "Martwy ciąg" },
        { id: LAWKA, name: "Wyciskanie na ławce" },
      ],
    });
    const w = await saveTemplate(wzor);
    expect(w).toEqual({ ok: true, id: SZABLON });
    expect((tables.workout_templates as Fake).insert).toHaveBeenCalledWith({
      user_id: "u1",
      name: "Push",
      weekdays: [1, 3],
      start_time: "17:00",
    });
    expect((tables.exercises as Fake).insert).not.toHaveBeenCalled();
    expect((tables.workout_template_items as Fake).insert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          template_id: SZABLON,
          exercise_id: MARTWY,
          position: 1,
          sets_count: 3,
          reps_text: "5",
          rest_s: 180,
        }),
        expect.objectContaining({
          exercise_id: PRZYSIAD,
          position: 2,
          sets_count: 4,
        }),
        expect.objectContaining({ exercise_id: LAWKA, position: 3 }),
      ],
    );
  });

  it("edycja podmienia pozycje", async () => {
    tables.exercises = fakeTable({
      data: [
        { id: PRZYSIAD, name: "Przysiad" },
        { id: MARTWY, name: "Martwy ciąg" },
        { id: LAWKA, name: "Wyciskanie na ławce" },
      ],
    });
    tables.workout_templates = fakeTable({ data: [{ id: SZABLON }] });
    const w = await saveTemplate({ ...wzor, id: SZABLON });
    expect(w).toEqual({ ok: true, id: SZABLON });
    expect((tables.workout_template_items as Fake).delete).toHaveBeenCalled();
    expect((tables.workout_template_items as Fake).insert).toHaveBeenCalled();
  });
});

describe("saveSessionAsTemplate", () => {
  it("serie grupuje po ćwiczeniu w kolejności treningu", async () => {
    tables.sport_sessions = fakeTable({
      single: { id: SESJA, start_local: "2026-11-18T17:30:00" },
    });
    tables.gym_sets = fakeTable({
      data: [
        { exercise_id: MARTWY, exercise_position: 1, set_no: 1, reps: 5 },
        { exercise_id: MARTWY, exercise_position: 1, set_no: 2, reps: 5 },
        { exercise_id: PRZYSIAD, exercise_position: 2, set_no: 1, reps: null },
      ],
    });
    const w = await saveSessionAsTemplate(SESJA, "Nogi");
    expect(w).toEqual({ ok: true, id: SZABLON });
    expect((tables.workout_templates as Fake).insert).toHaveBeenCalledWith({
      user_id: "u1",
      name: "Nogi",
      weekdays: [],
      start_time: "17:30",
    });
    expect((tables.workout_template_items as Fake).insert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          exercise_id: MARTWY,
          position: 1,
          sets_count: 2,
          reps_text: "5",
        }),
        expect.objectContaining({
          exercise_id: PRZYSIAD,
          position: 2,
          sets_count: 1,
          reps_text: "8–10",
        }),
      ],
    );
  });
});

describe("renameExercise", () => {
  it("zajęta nazwa → „Masz już ćwiczenie o tej nazwie.”", async () => {
    tables.exercises = fakeTable({
      error: { code: "23505", message: "duplicate key" },
    });
    const w = await renameExercise(PRZYSIAD, "Martwy ciąg");
    expect(w).toEqual({
      ok: false,
      message: "Masz już ćwiczenie o tej nazwie.",
    });
  });

  it("zmienia nazwę", async () => {
    tables.exercises = fakeTable({ data: [{ id: PRZYSIAD }] });
    const w = await renameExercise(PRZYSIAD, " Przysiad tylny ");
    expect(w).toEqual({ ok: true });
    expect((tables.exercises as Fake).update).toHaveBeenCalledWith({
      name: "Przysiad tylny",
    });
  });
});

describe("usuwanie i pominięcia", () => {
  it("deleteSession usuwa własną sesję i odświeża Dziś", async () => {
    const w = await deleteSession(SESJA);
    expect(w).toEqual({ ok: true });
    expect((tables.sport_sessions as Fake).delete).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dzis");
  });

  it("deleteSession cudzej / nieistniejącej → komunikat", async () => {
    tables.sport_sessions = fakeTable({ data: [] });
    const w = await deleteSession(SESJA);
    expect(w).toEqual({ ok: false, message: "Nie znaleziono treningu." });
  });

  it("skipTemplateOccurrence zapisuje pominięcie", async () => {
    const w = await skipTemplateOccurrence(SZABLON, "2026-11-20");
    expect(w).toEqual({ ok: true });
    expect((tables.template_skips as Fake).upsert).toHaveBeenCalledWith(
      { template_id: SZABLON, user_id: "u1", date: "2026-11-20" },
      { onConflict: "template_id,date", ignoreDuplicates: true },
    );
  });
});
