// Wczytywanie danych sportu dla stron /sport, /sport/trening/[id], /sport/szablony i /sport/cwiczenia/[id].
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IsoDate } from "@/components/controls/calendar-math";
import { todayIso } from "@/components/controls/calendar-math";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
import { safeTimezone } from "@/lib/time/timezones";
import type { Database } from "@/types/database";
import {
  monthGrid,
  sessionItems,
  templateOccurrences,
  type ExerciseRow,
  type GymSetRow,
  type RunRow,
  type SessionRow,
  type SkipRow,
  type SportItem,
  type TemplateItemRow,
  type TemplateRow,
} from "./model";
import { idSchema } from "./schemas";

export type SportProfile = {
  timezone: string;
  weekStart: "mon" | "sun";
  clock: "24" | "12";
  weightKg: number | null;
  workoutsGoalOn: boolean;
  weeklyWorkoutsGoal: number;
  kmGoalOn: boolean;
  weeklyKmGoal: number;
};

// Jedna sesja siłowa z jej seriami — wejście dla recordSetIds, „+2,5 kg vs ostatnio”,
// karty rekordu i historii ćwiczenia. Lista zawsze rosnąco po startLocal.
export type SessionSets = {
  sessionId: string;
  startLocal: string;
  title: string;
  completed: boolean;
  sets: GymSetRow[];
};

// Pozycja szablonu z nazwą ćwiczenia (pozycje rosnąco po position)
export type TemplateItemWithName = TemplateItemRow & { exerciseName: string };
export type TemplateWithItems = TemplateRow & { items: TemplateItemWithName[] };

export type SportMonthData = {
  today: IsoDate;
  month: string; // 'YYYY-MM' faktycznie pokazany (zły parametr → bieżący miesiąc)
  profile: SportProfile;
  items: SportItem[]; // siatka miesiąca (6 tyg.) ∪ 12 ostatnich tygodni, z wystąpieniami szablonów
  recent: SportItem[]; // do 10 ostatnich wykonanych biegów + do 10 treningów siłowych, malejąco
  exercises: ExerciseRow[];
  setsHistory: SessionSets[]; // wszystkie sesje siłowe użytkownika z seriami
  templates: TemplateWithItems[];
};

export type WorkoutData = {
  today: IsoDate;
  profile: SportProfile;
  session: SessionRow;
  sets: GymSetRow[]; // rosnąco po exercise_position, set_no
  exercises: ExerciseRow[]; // wszystkie ćwiczenia użytkownika (nazwy + dymek wyszukiwania)
  history: SessionSets[]; // sesje z seriami ćwiczeń tego treningu (łącznie z nim)
};

export type TemplatesData = {
  today: IsoDate;
  profile: SportProfile;
  templates: TemplateWithItems[];
  exercises: ExerciseRow[];
};

export type TemplateData = {
  today: IsoDate;
  profile: SportProfile;
  template: TemplateWithItems;
  exercises: ExerciseRow[];
};

export type ExerciseData = {
  today: IsoDate;
  profile: SportProfile;
  exercise: ExerciseRow;
  history: SessionSets[]; // tylko serie tego ćwiczenia
};

const DOMYSLNY_CEL_TRENINGOW = 3;
const DOMYSLNY_CEL_KM = 25;
const ROZMIAR_STRONY = 1000;

// Profil z bezpiecznymi wartościami domyślnymi (jak loadCalendarProfile + waga i cele)
export async function loadSportProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SportProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "timezone, week_start, clock, weight_kg, workouts_goal_on, weekly_workouts_goal, km_goal_on, weekly_km_goal",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    timezone: safeTimezone(data?.timezone),
    weekStart: data?.week_start === "sun" ? "sun" : "mon",
    clock: data?.clock === "12" ? "12" : "24",
    weightKg: data?.weight_kg ?? null,
    workoutsGoalOn: data?.workouts_goal_on ?? true,
    weeklyWorkoutsGoal: data?.weekly_workouts_goal ?? DOMYSLNY_CEL_TRENINGOW,
    kmGoalOn: data?.km_goal_on ?? true,
    weeklyKmGoal: data?.weekly_km_goal ?? DOMYSLNY_CEL_KM,
  };
}

// Sesje siłowe z seriami. Serie i sesje czytamy stronami (PostgREST obcina odpowiedź do 1000 wierszy).
// Z exerciseIds — tylko serie tych ćwiczeń; bez — wszystkie serie użytkownika.
async function loadSetsHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  exerciseIds?: string[],
): Promise<SessionSets[]> {
  if (exerciseIds && exerciseIds.length === 0) return [];

  const serie: GymSetRow[] = [];
  for (let od = 0; ; od += ROZMIAR_STRONY) {
    let zapytanie = supabase.from("gym_sets").select("*").eq("user_id", userId);
    if (exerciseIds) zapytanie = zapytanie.in("exercise_id", exerciseIds);
    const { data, error } = await zapytanie
      .order("id", { ascending: true })
      .range(od, od + ROZMIAR_STRONY - 1);
    if (error) throw new Error(error.message);
    serie.push(...((data ?? []) as GymSetRow[]));
    if ((data ?? []).length < ROZMIAR_STRONY) break;
  }
  if (serie.length === 0) return [];

  const sesje: Pick<
    SessionRow,
    "id" | "start_local" | "title" | "completed"
  >[] = [];
  for (let od = 0; ; od += ROZMIAR_STRONY) {
    const { data, error } = await supabase
      .from("sport_sessions")
      .select("id, start_local, title, completed")
      .eq("user_id", userId)
      .eq("type", "gym")
      .order("id", { ascending: true })
      .range(od, od + ROZMIAR_STRONY - 1);
    if (error) throw new Error(error.message);
    sesje.push(...(data ?? []));
    if ((data ?? []).length < ROZMIAR_STRONY) break;
  }

  const wynik: SessionSets[] = [];
  for (const s of sesje) {
    const jej = serie
      .filter((z) => z.session_id === s.id)
      .sort((a, b) =>
        a.exercise_position !== b.exercise_position
          ? a.exercise_position - b.exercise_position
          : a.set_no - b.set_no,
      );
    if (jej.length === 0) continue;
    wynik.push({
      sessionId: s.id,
      startLocal: s.start_local,
      title: s.title,
      completed: s.completed,
      sets: jej,
    });
  }
  return wynik.sort((a, b) =>
    a.startLocal < b.startLocal ? -1 : a.startLocal > b.startLocal ? 1 : 0,
  );
}

// Szablony z pozycjami (rosnąco po position) i nazwami ćwiczeń
function joinTemplates(
  templates: TemplateRow[],
  items: TemplateItemRow[],
  exercises: ExerciseRow[],
): TemplateWithItems[] {
  const nazwy = new Map(exercises.map((e) => [e.id, e.name]));
  return templates.map((t) => ({
    ...t,
    items: items
      .filter((i) => i.template_id === t.id)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ ...i, exerciseName: nazwy.get(i.exercise_id) ?? "" })),
  }));
}

// Strona /sport: miesiąc (siatka 6 tygodni) i 12 ostatnich tygodni (kafelki i wykres).
// Sesje czytamy tylko z tych dwóch zakresów; serie — całą historię użytkownika (karta rekordu,
// REKORD i dymki potrzebują wcześniejszych sesji, a przy tej skali to setki wierszy).
export async function loadSportMonth(
  supabase: SupabaseClient<Database>,
  userId: string,
  month: string,
): Promise<SportMonthData> {
  const profile = await loadSportProfile(supabase, userId);
  const today = todayIso(profile.timezone);
  const miesiac = /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ? month
    : today.slice(0, 7);

  // Siatka miesiąca
  const siatka = monthGrid(miesiac, profile.weekStart);
  const siatkaOd = siatka[0][0];
  const siatkaDo = siatka[5][6];
  // 12 tygodni, ostatni = bieżący (tydzień od profiles.week_start)
  const dzien = weekdayOf(today);
  const biezacyTydzien = addDays(
    today,
    -(profile.weekStart === "mon" ? dzien - 1 : dzien % 7),
  );
  const wykresOd = addDays(biezacyTydzien, -77);
  const wykresDo = addDays(biezacyTydzien, 6);

  const [
    sesjeRes,
    ostatnieBiegiRes,
    ostatnieSilowniaRes,
    szablonyRes,
    pozycjeRes,
    pominieciaRes,
    cwiczeniaRes,
    setsHistory,
  ] = await Promise.all([
    supabase
      .from("sport_sessions")
      .select("*")
      .eq("user_id", userId)
      .or(
        `and(start_local.gte.${siatkaOd}T00:00:00,start_local.lt.${addDays(siatkaDo, 1)}T00:00:00),and(start_local.gte.${wykresOd}T00:00:00,start_local.lt.${addDays(wykresDo, 1)}T00:00:00)`,
      )
      .order("start_local", { ascending: true }),
    // Osobno biegi i siłownia, żeby filtr Bieg / Siłownia w „Ostatnich treningach” miał po 10 pozycji
    supabase
      .from("sport_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "run")
      .eq("completed", true)
      .order("start_local", { ascending: false })
      .limit(10),
    supabase
      .from("sport_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "gym")
      .eq("completed", true)
      .order("start_local", { ascending: false })
      .limit(10),
    supabase
      .from("workout_templates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("workout_template_items")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    // Pominięcia mają znaczenie tylko od dziś (wystąpienia liczymy od dziś w przód)
    supabase
      .from("template_skips")
      .select("*")
      .eq("user_id", userId)
      .gte("date", today),
    supabase
      .from("exercises")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true }),
    loadSetsHistory(supabase, userId),
  ]);
  // Błąd zapytania ma trafić do granicy błędu trasy, a nie pokazać pusty ekran
  for (const wynik of [
    sesjeRes,
    ostatnieBiegiRes,
    ostatnieSilowniaRes,
    szablonyRes,
    pozycjeRes,
    pominieciaRes,
    cwiczeniaRes,
  ]) {
    if (wynik.error) throw new Error(wynik.error.message);
  }

  const sesje = (sesjeRes.data ?? []) as SessionRow[];
  const ostatnie = [
    ...((ostatnieBiegiRes.data ?? []) as SessionRow[]),
    ...((ostatnieSilowniaRes.data ?? []) as SessionRow[]),
  ];

  // Dane biegów dla sesji z obu list
  const idBiegow = [
    ...new Set(
      [...sesje, ...ostatnie].filter((s) => s.type === "run").map((s) => s.id),
    ),
  ];
  let biegi: RunRow[] = [];
  if (idBiegow.length > 0) {
    const { data, error } = await supabase
      .from("runs")
      .select("*")
      .eq("user_id", userId)
      .in("session_id", idBiegow);
    if (error) throw new Error(error.message);
    biegi = (data ?? []) as RunRow[];
  }

  const szablony = (szablonyRes.data ?? []) as TemplateRow[];
  const pominiecia = (pominieciaRes.data ?? []) as SkipRow[];
  // Wystąpienia szablonów osobno dla obu zakresów (bez dni pomiędzy nimi), bez powtórzeń przy nakładaniu
  const wystapienia = new Map<string, SportItem>();
  for (const [od, doDnia] of [
    [siatkaOd, siatkaDo],
    [wykresOd, wykresDo],
  ]) {
    for (const w of templateOccurrences(
      szablony,
      pominiecia,
      sesje,
      od,
      doDnia,
      today,
    )) {
      wystapienia.set(w.key, w);
    }
  }

  const items = [...sessionItems(sesje, biegi), ...wystapienia.values()].sort(
    (a, b) =>
      a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.startMin - b.startMin,
  );
  const recent = sessionItems(ostatnie, biegi).sort((a, b) =>
    a.date !== b.date ? (a.date > b.date ? -1 : 1) : b.startMin - a.startMin,
  );
  const exercises = (cwiczeniaRes.data ?? []) as ExerciseRow[];

  return {
    today,
    month: miesiac,
    profile,
    items,
    recent,
    exercises,
    setsHistory,
    templates: joinTemplates(
      szablony,
      (pozycjeRes.data ?? []) as TemplateItemRow[],
      exercises,
    ),
  };
}

// Trening siłowy z seriami; null, gdy sesji nie ma, jest cudza albo to bieg
export async function loadWorkout(
  supabase: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
): Promise<WorkoutData | null> {
  // Nie-uuid dałby błąd bazy zamiast 404
  if (!idSchema.safeParse(sessionId).success) return null;

  const profile = await loadSportProfile(supabase, userId);
  const { data: sesja, error } = await supabase
    .from("sport_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("id", sessionId)
    .eq("type", "gym")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sesja) return null;

  const [serieRes, cwiczeniaRes] = await Promise.all([
    supabase
      .from("gym_sets")
      .select("*")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .order("exercise_position", { ascending: true })
      .order("set_no", { ascending: true }),
    supabase
      .from("exercises")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true }),
  ]);
  for (const wynik of [serieRes, cwiczeniaRes]) {
    if (wynik.error) throw new Error(wynik.error.message);
  }
  const sets = (serieRes.data ?? []) as GymSetRow[];
  const history = await loadSetsHistory(supabase, userId, [
    ...new Set(sets.map((s) => s.exercise_id)),
  ]);

  return {
    today: todayIso(profile.timezone),
    profile,
    session: sesja as SessionRow,
    sets,
    exercises: (cwiczeniaRes.data ?? []) as ExerciseRow[],
    history,
  };
}

// Pojedynczy bieg do okna biegu (?bieg={id}), gdy sesji nie ma w wczytanym miesiącu; null, gdy jej nie ma,
// jest cudza albo to trening siłowy
export async function loadSportRun(
  supabase: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
): Promise<SportItem | null> {
  if (!idSchema.safeParse(sessionId).success) return null;

  const { data: sesja, error } = await supabase
    .from("sport_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("id", sessionId)
    .eq("type", "run")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sesja) return null;

  const { data: bieg, error: blad } = await supabase
    .from("runs")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId);
  if (blad) throw new Error(blad.message);

  return (
    sessionItems([sesja as SessionRow], (bieg ?? []) as RunRow[])[0] ?? null
  );
}

// Lista szablonów (/sport/szablony)
export async function loadTemplates(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<TemplatesData> {
  const profile = await loadSportProfile(supabase, userId);
  const [szablonyRes, pozycjeRes, cwiczeniaRes] = await Promise.all([
    supabase
      .from("workout_templates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("workout_template_items")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    supabase
      .from("exercises")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true }),
  ]);
  for (const wynik of [szablonyRes, pozycjeRes, cwiczeniaRes]) {
    if (wynik.error) throw new Error(wynik.error.message);
  }
  const exercises = (cwiczeniaRes.data ?? []) as ExerciseRow[];
  return {
    today: todayIso(profile.timezone),
    profile,
    templates: joinTemplates(
      (szablonyRes.data ?? []) as TemplateRow[],
      (pozycjeRes.data ?? []) as TemplateItemRow[],
      exercises,
    ),
    exercises,
  };
}

// Jeden szablon do edycji (/sport/szablony/[id]); null, gdy go nie ma albo jest cudzy
export async function loadTemplate(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string,
): Promise<TemplateData | null> {
  if (!idSchema.safeParse(id).success) return null;

  const profile = await loadSportProfile(supabase, userId);
  const { data: szablon, error } = await supabase
    .from("workout_templates")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!szablon) return null;

  const [pozycjeRes, cwiczeniaRes] = await Promise.all([
    supabase
      .from("workout_template_items")
      .select("*")
      .eq("user_id", userId)
      .eq("template_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("exercises")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true }),
  ]);
  for (const wynik of [pozycjeRes, cwiczeniaRes]) {
    if (wynik.error) throw new Error(wynik.error.message);
  }
  const exercises = (cwiczeniaRes.data ?? []) as ExerciseRow[];
  const [template] = joinTemplates(
    [szablon as TemplateRow],
    (pozycjeRes.data ?? []) as TemplateItemRow[],
    exercises,
  );
  return { today: todayIso(profile.timezone), profile, template, exercises };
}

// Szczegóły ćwiczenia (/sport/cwiczenia/[id]); null, gdy go nie ma albo jest cudze
export async function loadExercise(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string,
): Promise<ExerciseData | null> {
  if (!idSchema.safeParse(id).success) return null;

  const profile = await loadSportProfile(supabase, userId);
  const { data: cwiczenie, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cwiczenie) return null;

  return {
    today: todayIso(profile.timezone),
    profile,
    exercise: cwiczenie as ExerciseRow,
    history: await loadSetsHistory(supabase, userId, [id]),
  };
}
