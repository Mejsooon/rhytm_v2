import { adminClient } from "./konto";
import { dzisWarszawa, przesunDate } from "./nawyki";

// Dane Sportu zasiewane przez API administratora. „Dziś” liczymy w strefie profilu (Europe/Warsaw),
// bo wystąpienia szablonów zaczynają się od dziś, a nagłówek Sportu pokazuje bieżący miesiąc.

// Dzień tygodnia daty „YYYY-MM-DD”: 1 = pn … 7 = nd (jak `weekdays` w bazie)
export function dzienTygodnia(data: string): number {
  const [r, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(r, m - 1, d)).getUTCDay() || 7;
}

// Etykieta dnia w kalendarzu Sportu, np. „czw 19.11” (przyciski mają nazwę „{tytuł}, {etykieta}”)
const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
export function etykietaDnia(data: string): string {
  return `${DNI[dzienTygodnia(data)]} ${data.slice(8, 10)}.${data.slice(5, 7)}`;
}

// Ćwiczenie użytkownika; zwraca id
export async function zasiejCwiczenie(
  userId: string,
  name: string,
  muscleGroup: string | null = null,
): Promise<string> {
  const { data, error } = await adminClient()
    .from("exercises")
    .insert({ user_id: userId, name, muscle_group: muscleGroup })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`Nie udało się zasiać ćwiczenia: ${error?.message}`);
  return data.id;
}

// Szablon z pozycjami (ćwiczenia zakładane po nazwie); zwraca id szablonu i id ćwiczeń po nazwie
export async function zasiejSzablon(
  userId: string,
  szablon: {
    name: string;
    weekdays: number[];
    startTime?: string; // „HH:MM”
    cwiczenia: { name: string; sets: number; reps: string }[];
  },
): Promise<{ id: string; cwiczenia: Record<string, string> }> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("workout_templates")
    .insert({
      user_id: userId,
      name: szablon.name,
      weekdays: szablon.weekdays,
      start_time: `${szablon.startTime ?? "18:00"}:00`,
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`Nie udało się zasiać szablonu: ${error?.message}`);

  const cwiczenia: Record<string, string> = {};
  for (const c of szablon.cwiczenia) {
    cwiczenia[c.name] = await zasiejCwiczenie(userId, c.name);
  }
  const { error: bladPozycji } = await admin
    .from("workout_template_items")
    .insert(
      szablon.cwiczenia.map((c, i) => ({
        user_id: userId,
        template_id: data.id,
        exercise_id: cwiczenia[c.name],
        position: i + 1,
        sets_count: c.sets,
        reps_text: c.reps,
        rest_s: 120,
      })),
    );
  if (bladPozycji)
    throw new Error(
      `Nie udało się zasiać pozycji szablonu: ${bladPozycji.message}`,
    );
  return { id: data.id, cwiczenia };
}

// Wykonany bieg `dniTemu` dni przed dziś o 07:00; zwraca id sesji
export async function zasiejBieg(
  userId: string,
  bieg: { dniTemu: number; km: number; sekundy: number; kind?: string },
): Promise<string> {
  const admin = adminClient();
  const data = przesunDate(dzisWarszawa(), -bieg.dniTemu);
  const tytuly: Record<string, string> = {
    easy: "Spokojny",
    tempo: "Tempo",
    intervals: "Interwały",
    long: "Długi bieg",
    race: "Zawody",
  };
  const kind = bieg.kind ?? "easy";
  const { data: sesja, error } = await admin
    .from("sport_sessions")
    .insert({
      user_id: userId,
      type: "run",
      title: tytuly[kind],
      start_local: `${data}T07:00:00`,
      completed: true,
    })
    .select("id")
    .single();
  if (error || !sesja)
    throw new Error(`Nie udało się zasiać biegu: ${error?.message}`);
  const { error: bladBiegu } = await admin.from("runs").insert({
    session_id: sesja.id,
    user_id: userId,
    kind,
    distance_km: bieg.km,
    duration_s: bieg.sekundy,
  });
  if (bladBiegu)
    throw new Error(`Nie udało się zasiać biegu: ${bladBiegu.message}`);
  return sesja.id;
}

// Wykonany trening siłowy `dniTemu` dni przed dziś o 18:00 z seriami (kg, powt.); zwraca id sesji
export async function zasiejTrening(
  userId: string,
  trening: {
    dniTemu: number;
    title: string;
    serie: { exerciseId: string; kg: number | null; reps: number }[][];
  },
): Promise<string> {
  const admin = adminClient();
  const data = przesunDate(dzisWarszawa(), -trening.dniTemu);
  const { data: sesja, error } = await admin
    .from("sport_sessions")
    .insert({
      user_id: userId,
      type: "gym",
      title: trening.title,
      start_local: `${data}T18:00:00`,
      end_local: `${data}T19:15:00`,
      completed: true,
    })
    .select("id")
    .single();
  if (error || !sesja)
    throw new Error(`Nie udało się zasiać treningu: ${error?.message}`);
  // Każda lista to jedno ćwiczenie (pozycja w treningu), w niej kolejne serie
  const wiersze = trening.serie.flatMap((serie, pozycja) =>
    serie.map((s, nr) => ({
      user_id: userId,
      session_id: sesja.id,
      exercise_id: s.exerciseId,
      exercise_position: pozycja + 1,
      set_no: nr + 1,
      weight_kg: s.kg,
      reps: s.reps,
      done: true,
    })),
  );
  const { error: bladSerii } = await admin.from("gym_sets").insert(wiersze);
  if (bladSerii)
    throw new Error(`Nie udało się zasiać serii: ${bladSerii.message}`);
  return sesja.id;
}
