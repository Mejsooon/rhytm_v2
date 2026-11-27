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
  setExerciseBodyweight,
  skipTemplateOccurrence,
  updateSet,
  copyWorkout,
  discardWorkout,
  saveExercise,
  startWorkout,
  updateExercise,
} from "./actions";

const SESJA = "b1000000-0000-4000-8000-000000000001";
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
    ["startWorkout", () => startWorkout(SESJA)],
    ["discardWorkout", () => discardWorkout(SESJA)],
    ["copyWorkout", () => copyWorkout(SESJA)],
    ["saveExercise", () => saveExercise({ name: "Plank", kind: "dur", group: "", equipment: "" })],
    ["updateExercise", () => updateExercise(PRZYSIAD, { rest_s: 60 })],
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
    ["setExerciseBodyweight", () => setExerciseBodyweight(PRZYSIAD, true)],
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

  it("z szablonu: start z godziny szablonu, puste serie, przerwa i last_used_at", async () => {
    tables.workout_templates = fakeTable({ single: szablon });
    tables.workout_template_items = fakeTable({ data: pozycje });
    const wstawienie = fakeTable({ single: { id: SESJA } });
    tables.sport_sessions = [wstawienie];

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
    expect((tables.gym_sets as Fake).insert).toHaveBeenCalledWith(
      [1, 2, 3].map((nr) =>
        expect.objectContaining({
          session_id: SESJA,
          exercise_id: PRZYSIAD,
          set_no: nr,
          weight_kg: null,
          reps: null,
          done: false,
        }),
      ),
    );
    expect((tables.exercises as Fake).update).toHaveBeenCalledWith({ rest_s: 120 });
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
    expect((tables.gym_sets as Fake).eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("addSet dokłada pustą serię na końcu ćwiczenia", async () => {
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
        weight_kg: null,
        reps: null,
        done: false,
      }),
    );
  });
});

describe("serie — wyścig numeru serii (23505)", () => {
  it("addSet przy zajętym numerze czyta serie ponownie i wstawia z kolejnym numerem", async () => {
    const odczyt1 = fakeTable({
      data: [{ exercise_position: 1, set_no: 1, weight_kg: 60, reps: 8 }],
    });
    const zajete = fakeTable({ error: { code: "23505", message: "dup" } });
    const odczyt2 = fakeTable({
      data: [
        { exercise_position: 1, set_no: 1, weight_kg: 60, reps: 8 },
        { exercise_position: 1, set_no: 2, weight_kg: 60, reps: 8 },
      ],
    });
    const wstawienie = fakeTable({ single: { id: SERIA } });
    tables.gym_sets = [odczyt1, zajete, odczyt2, wstawienie];

    const w = await addSet(SESJA, PRZYSIAD);
    expect(w).toEqual({ ok: true, id: SERIA });
    expect(zajete.insert).toHaveBeenCalledWith(
      expect.objectContaining({ set_no: 2 }),
    );
    expect(wstawienie.insert).toHaveBeenCalledWith(
      expect.objectContaining({ set_no: 3 }),
    );
  });

  it("addSet: drugi 23505 z rzędu → błąd zapisu", async () => {
    const odczyt = fakeTable({
      data: [{ exercise_position: 1, set_no: 1, weight_kg: 60, reps: 8 }],
    });
    const zajete = fakeTable({ error: { code: "23505", message: "dup" } });
    tables.gym_sets = [odczyt, zajete, odczyt, zajete];
    const w = await addSet(SESJA, PRZYSIAD);
    expect(w).toEqual({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
  });

  it("addExercise: 23505, bo to samo ćwiczenie dodano równolegle → zwraca je bez drugiego wstawienia", async () => {
    tables.exercises = fakeTable({
      data: [{ id: PRZYSIAD, name: "Przysiad" }],
    });
    const zajete = fakeTable({ error: { code: "23505", message: "dup" } });
    const ponownie = fakeTable({
      data: [{ exercise_id: PRZYSIAD, exercise_position: 1 }],
    });
    tables.gym_sets = [fakeTable({ data: [] }), zajete, ponownie];
    const w = await addExercise(SESJA, "Przysiad");
    expect(w).toEqual({ ok: true, id: PRZYSIAD });
    expect(ponownie.insert).not.toHaveBeenCalled();
  });

  it("addExercise: 23505 bez tego ćwiczenia w treningu → jedna ponowna próba z nową pozycją", async () => {
    tables.exercises = fakeTable({
      data: [{ id: PRZYSIAD, name: "Przysiad" }],
    });
    const zajete = fakeTable({ error: { code: "23505", message: "dup" } });
    const ponownie = fakeTable({
      data: [{ exercise_id: MARTWY, exercise_position: 1 }],
    });
    const wstawienie = fakeTable();
    tables.gym_sets = [fakeTable({ data: [] }), zajete, ponownie, wstawienie];
    const w = await addExercise(SESJA, "Przysiad");
    expect(w).toEqual({ ok: true, id: PRZYSIAD });
    expect(wstawienie.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ exercise_position: 2, set_no: 1 }),
      ]),
    );
  });
});

describe("finishWorkout", () => {
  beforeEach(() => {
    tables.gym_sets = fakeTable({ data: [{ id: SERIA }] });
  });
  const sesja = (start_local: string, started_at: string | null = null) =>
    fakeTable({ data: [{ id: SESJA }], single: { id: SESJA, start_local, started_at } });

  it("usuwa nieodhaczone serie, oznacza wykonany i ustawia koniec = teraz w strefie profilu", async () => {
    tables.sport_sessions = sesja("2026-11-18T09:30:00");
    expect(await finishWorkout(SESJA)).toEqual({ ok: true });
    expect((tables.gym_sets as Fake).delete).toHaveBeenCalled();
    expect((tables.gym_sets as Fake).eq).toHaveBeenCalledWith("done", false);
    expect((tables.sport_sessions as Fake).update).toHaveBeenCalledWith({
      completed: true,
      end_local: "2026-11-18T11:00:00",
    });
  });

  it("zapisuje trudność i notatkę", async () => {
    tables.sport_sessions = sesja("2026-11-18T09:30:00");
    await finishWorkout(SESJA, { difficulty: 7, note: "dobra energia" });
    expect((tables.sport_sessions as Fake).update).toHaveBeenCalledWith({
      completed: true,
      end_local: "2026-11-18T11:00:00",
      difficulty: 7,
      note: "dobra energia",
    });
  });

  it("trudność spoza 1–10 → błąd, bez zapisu", async () => {
    const w = await finishWorkout(SESJA, { difficulty: 11 });
    expect(w.ok).toBe(false);
    expect((tables.sport_sessions as Fake).update).not.toHaveBeenCalled();
  });

  it("bez zrobionej serii nic nie usuwa i nie kończy", async () => {
    tables.gym_sets = fakeTable({ data: [] });
    tables.sport_sessions = sesja("2026-11-18T09:30:00");
    expect((await finishWorkout(SESJA)).ok).toBe(false);
    expect((tables.gym_sets as Fake).delete).not.toHaveBeenCalled();
    expect((tables.sport_sessions as Fake).update).not.toHaveBeenCalled();
  });

  it("z licznikiem koniec = start + czas licznika", async () => {
    tables.sport_sessions = sesja("2026-11-18T10:00:00", "2026-11-18T09:15:00.000Z");
    await finishWorkout(SESJA);
    expect((tables.sport_sessions as Fake).update).toHaveBeenCalledWith({
      completed: true,
      end_local: "2026-11-18T10:45:00",
    });
  });

  it("dziś, ale start jeszcze nie minął → koniec = start + 90 min", async () => {
    tables.sport_sessions = sesja("2026-11-18T17:00:00");
    await finishWorkout(SESJA);
    expect((tables.sport_sessions as Fake).update).toHaveBeenCalledWith({
      completed: true,
      end_local: "2026-11-18T18:30:00",
    });
  });

  it("trening z innego dnia → koniec = start + 90 min (także przez północ)", async () => {
    tables.sport_sessions = sesja("2026-11-15T23:00:00");
    await finishWorkout(SESJA);
    expect((tables.sport_sessions as Fake).update).toHaveBeenCalledWith({
      completed: true,
      end_local: "2026-11-16T00:30:00",
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
  it("edycja: błąd zapisu nowych pozycji przywraca stare", async () => {
    tables.exercises = fakeTable({
      data: [
        { id: PRZYSIAD, name: "Przysiad" },
        { id: MARTWY, name: "Martwy ciąg" },
        { id: LAWKA, name: "Wyciskanie na ławce" },
      ],
    });
    tables.workout_templates = fakeTable({ data: [{ id: SZABLON }] });
    const stare = [
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
    const odczyt = fakeTable({ data: stare });
    const usuniecie = fakeTable();
    const nieudane = fakeTable({ error: { message: "x" } });
    const przywrocenie = fakeTable();
    tables.workout_template_items = [odczyt, usuniecie, nieudane, przywrocenie];

    const w = await saveTemplate({ ...wzor, id: SZABLON });
    expect(w).toEqual({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    expect(usuniecie.delete).toHaveBeenCalled();
    expect(przywrocenie.insert).toHaveBeenCalledWith(stare);
  });

  it("edycja: nieudane także przywrócenie starych pozycji → wyraźny błąd", async () => {
    tables.exercises = fakeTable({
      data: [
        { id: PRZYSIAD, name: "Przysiad" },
        { id: MARTWY, name: "Martwy ciąg" },
        { id: LAWKA, name: "Wyciskanie na ławce" },
      ],
    });
    tables.workout_templates = fakeTable({ data: [{ id: SZABLON }] });
    const stare = [
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
    tables.workout_template_items = [
      fakeTable({ data: stare }),
      fakeTable(),
      fakeTable({ error: { message: "x" } }),
      fakeTable({ error: { message: "y" } }),
    ];

    const w = await saveTemplate({ ...wzor, id: SZABLON });
    expect(w).toEqual({
      ok: false,
      message:
        "Nie udało się zapisać ćwiczeń szablonu ani przywrócić poprzednich. Dodaj je ponownie.",
    });
  });

  it("dni tygodnia bez powtórzeń i rosnąco", async () => {
    tables.exercises = fakeTable({
      data: [
        { id: PRZYSIAD, name: "Przysiad" },
        { id: MARTWY, name: "Martwy ciąg" },
        { id: LAWKA, name: "Wyciskanie na ławce" },
      ],
    });
    await saveTemplate({ ...wzor, weekdays: [5, 3, 5, 1, 3] });
    expect((tables.workout_templates as Fake).insert).toHaveBeenCalledWith(
      expect.objectContaining({ weekdays: [1, 3, 5] }),
    );
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
    expect((tables.exercises as Fake).eq).toHaveBeenCalledWith("user_id", "u1");
  });
});

describe("setExerciseBodyweight", () => {
  it("zapisuje flagę własnego ćwiczenia i odświeża widoki sportu", async () => {
    tables.exercises = fakeTable({ data: [{ id: PRZYSIAD }] });
    const w = await setExerciseBodyweight(PRZYSIAD, true);
    expect(w).toEqual({ ok: true });
    expect((tables.exercises as Fake).update).toHaveBeenCalledWith({
      bodyweight: true,
      kind: "wbw",
    });
    expect((tables.exercises as Fake).eq).toHaveBeenCalledWith("id", PRZYSIAD);
    expect((tables.exercises as Fake).eq).toHaveBeenCalledWith("user_id", "u1");
    expect(revalidatePath).toHaveBeenCalledWith("/sport");
    expect(revalidatePath).toHaveBeenCalledWith(
      "/sport/cwiczenia/[id]",
      "page",
    );
  });

  it("cudze albo nieistniejące ćwiczenie → błąd", async () => {
    tables.exercises = fakeTable({ data: [] });
    const w = await setExerciseBodyweight(PRZYSIAD, false);
    expect(w).toEqual({ ok: false, message: "Nie znaleziono ćwiczenia." });
  });

  it("zły identyfikator albo błąd bazy → „Nie udało się zapisać”", async () => {
    expect(await setExerciseBodyweight("x", true)).toEqual({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    tables.exercises = fakeTable({ error: { code: "500", message: "x" } });
    expect(await setExerciseBodyweight(PRZYSIAD, true)).toEqual({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
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

  it("deleteSession sesji z szablonu zapisuje pominięcie dnia", async () => {
    tables.sport_sessions = fakeTable({
      data: [{ id: SESJA, template_id: SZABLON, template_date: "2026-11-20" }],
    });
    const w = await deleteSession(SESJA);
    expect(w).toEqual({ ok: true });
    expect((tables.sport_sessions as Fake).eq).toHaveBeenCalledWith(
      "user_id",
      "u1",
    );
    expect((tables.template_skips as Fake).upsert).toHaveBeenCalledWith(
      { template_id: SZABLON, user_id: "u1", date: "2026-11-20" },
      { onConflict: "template_id,date", ignoreDuplicates: true },
    );
  });

  it("deleteSession bez szablonu nie zapisuje pominięcia", async () => {
    await deleteSession(SESJA);
    expect((tables.template_skips as Fake).upsert).not.toHaveBeenCalled();
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

describe("start, kopia i ćwiczenia", () => {
  it("startWorkout: trening z dziś zaczyna się teraz i rusza licznik", async () => {
    tables.sport_sessions = fakeTable({ single: { start_local: "2026-11-18T17:00:00", started_at: null, completed: false } });
    expect(await startWorkout(SESJA)).toEqual({ ok: true });
    expect((tables.sport_sessions as Fake).update).toHaveBeenCalledWith({
      started_at: "2026-11-18T10:00:00.000Z",
      start_local: "2026-11-18T11:00:00",
      end_local: null,
    });
  });

  it("startWorkout: drugi raz nie przestawia licznika", async () => {
    tables.sport_sessions = fakeTable({ single: { start_local: "2026-11-18T09:00:00", started_at: "2026-11-18T08:00:00Z", completed: false } });
    await startWorkout(SESJA);
    expect((tables.sport_sessions as Fake).update).not.toHaveBeenCalled();
  });

  it("copyWorkout: nowy trening z nieodhaczonymi seriami", async () => {
    tables.sport_sessions = fakeTable({ single: { id: SESJA, title: "Push", start_local: "2026-11-11T17:00:00" } });
    tables.gym_sets = fakeTable({ data: [{ exercise_id: PRZYSIAD, exercise_position: 1, set_no: 1, weight_kg: 60, reps: 5, set_type: "W" }] });
    expect(await copyWorkout(SESJA, "2026-11-25")).toEqual({ ok: true, id: SESJA });
    expect((tables.sport_sessions as Fake).insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Push", start_local: "2026-11-25T17:00:00" }),
    );
    expect((tables.gym_sets as Fake).insert).toHaveBeenCalledWith([
      expect.objectContaining({ session_id: SESJA, weight_kg: 60, reps: 5, set_type: "W", done: false }),
    ]);
  });

  it("saveExercise: zmiana rodzaju czyści serie tego treningu", async () => {
    tables.exercises = fakeTable({ single: { kind: null, bodyweight: false } });
    await saveExercise({ id: PRZYSIAD, name: "Przysiad", kind: "dur", group: "nogi", equipment: "" }, SESJA);
    expect((tables.gym_sets as Fake).update).toHaveBeenCalledWith({ weight_kg: null, reps: null, duration_s: null, distance_km: null, done: false });
  });

  it("saveExercise: ten sam rodzaj nie rusza serii; zajęta nazwa ma komunikat", async () => {
    tables.exercises = fakeTable({ single: { kind: "wr", bodyweight: false } });
    await saveExercise({ id: PRZYSIAD, name: "Przysiad 2", kind: "wr", group: "", equipment: "" }, SESJA);
    expect((tables.gym_sets as Fake).update).not.toHaveBeenCalled();
    tables.exercises = fakeTable({ error: { code: "23505", message: "dup" } });
    expect(await saveExercise({ name: "Przysiad", kind: "wr", group: "", equipment: "" })).toEqual({ ok: false, message: "Masz już ćwiczenie o tej nazwie." });
  });
});
