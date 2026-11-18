// Wczytywanie nawyków, odhaczeń i snu dla stron /nawyki oraz /nawyki/[id].
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IsoDate } from "@/components/controls/calendar-math";
import { todayIso } from "@/components/controls/calendar-math";
import { addDays } from "@/features/calendar/view-range";
import { idSchema } from "@/features/calendar/schemas";
import { safeTimezone } from "@/lib/time/timezones";
import type { Database } from "@/types/database";
import type { Habit, ScheduleType, ScheduleVersion } from "./model";
import type { SleepLog } from "./sleep";

type HabitRow = Database["public"]["Tables"]["habits"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["habit_schedules"]["Row"];
type SleepRow = Database["public"]["Tables"]["sleep_logs"]["Row"];

export type HabitsPageData = {
  today: IsoDate;
  weekStart: "mon" | "sun";
  clock: "24" | "12";
  sleepGoalMin: number;
  habits: Habit[];
  checks: Array<{ habitId: string; date: IsoDate }>;
  sleepLogs: SleepLog[];
};

export type HabitDetailData = HabitsPageData & {
  notes: { id: string; date: IsoDate; text: string }[];
};

const DOMYSLNY_CEL_SNU_MIN = 480;

// Wiersze nawyków + wersji harmonogramu → Habit; wersje zawsze rosnąco po validFrom (model na tym polega)
export function mapHabits(
  habitRows: HabitRow[],
  scheduleRows: ScheduleRow[],
): Habit[] {
  return habitRows.map((h) => {
    const schedules: ScheduleVersion[] = scheduleRows
      .filter((s) => s.habit_id === h.id)
      .map((s) => ({
        validFrom: s.valid_from,
        type: s.schedule_type as ScheduleType,
        weekdays: s.weekdays ?? [],
        timesPerWeek: s.times_per_week,
      }))
      .sort((a, b) =>
        a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0,
      );
    return {
      id: h.id,
      name: h.name,
      // kolumna time wraca jako 'HH:MM:SS'
      remindAt: h.remind_at ? h.remind_at.slice(0, 5) : null,
      showOnToday: h.show_on_today,
      createdAt: h.created_at ?? "",
      schedules,
    };
  });
}

function mapSleepLogs(rows: SleepRow[]): SleepLog[] {
  return rows.map((r) => ({
    date: r.date,
    sleptAt: r.slept_at.slice(0, 5),
    wokeAt: r.woke_at.slice(0, 5),
    feeling: r.feeling,
    tags: r.tags ?? [],
    note: r.note,
  }));
}

// Profil z bezpiecznymi wartościami domyślnymi (jak loadCalendarProfile + cel snu)
async function loadProfile(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone, week_start, clock, sleep_goal_min")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const timezone = safeTimezone(data?.timezone);
  return {
    today: todayIso(timezone),
    weekStart: (data?.week_start === "sun" ? "sun" : "mon") as "mon" | "sun",
    clock: (data?.clock === "12" ? "12" : "24") as "12" | "24",
    sleepGoalMin: data?.sleep_goal_min ?? DOMYSLNY_CEL_SNU_MIN,
  };
}

const ROZMIAR_STRONY = 1000;

// Wszystkie odhaczenia (PostgREST obcina odpowiedź do 1000 wierszy, więc czytamy stronami)
async function loadChecks(
  supabase: SupabaseClient<Database>,
  userId: string,
  filtr: { habitId?: string },
): Promise<Array<{ habitId: string; date: IsoDate }>> {
  const wynik: Array<{ habitId: string; date: IsoDate }> = [];
  for (let od = 0; ; od += ROZMIAR_STRONY) {
    let zapytanie = supabase
      .from("habit_checks")
      .select("habit_id, date")
      .eq("user_id", userId);
    if (filtr.habitId) zapytanie = zapytanie.eq("habit_id", filtr.habitId);
    // Stabilna kolejność, żeby strony się nie zachodziły
    const { data, error } = await zapytanie
      .order("date", { ascending: true })
      .order("habit_id", { ascending: true })
      .range(od, od + ROZMIAR_STRONY - 1);
    if (error) throw new Error(error.message);
    for (const c of data ?? [])
      wynik.push({ habitId: c.habit_id, date: c.date });
    if ((data ?? []).length < ROZMIAR_STRONY) break;
  }
  return wynik;
}

// Lista nawyków z odhaczeniami z całej historii i snem z 60 dni.
// Pełna historia odhaczeń jest potrzebna, żeby serie na liście zgadzały się ze stroną szczegółów.
export async function loadHabitsPage(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<HabitsPageData> {
  const profil = await loadProfile(supabase, userId);
  const odSnu = addDays(profil.today, -60);

  const [nawykiRes, wersjeRes, odhaczenia, senRes] = await Promise.all([
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("habit_schedules")
      .select("*")
      .eq("user_id", userId)
      .order("valid_from", { ascending: true }),
    loadChecks(supabase, userId, {}),
    supabase
      .from("sleep_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", odSnu)
      .order("date", { ascending: true }),
  ]);
  // Błąd zapytania ma trafić do granicy błędu trasy, a nie pokazać pustą listę
  for (const wynik of [nawykiRes, wersjeRes, senRes]) {
    if (wynik.error) throw new Error(wynik.error.message);
  }

  return {
    ...profil,
    habits: mapHabits(
      (nawykiRes.data ?? []) as HabitRow[],
      (wersjeRes.data ?? []) as ScheduleRow[],
    ),
    checks: odhaczenia,
    sleepLogs: mapSleepLogs((senRes.data ?? []) as SleepRow[]),
  };
}

// Szczegóły jednego nawyku: odhaczenia z całej historii i notatki; null, gdy nawyku nie ma albo jest cudzy
export async function loadHabitDetail(
  supabase: SupabaseClient<Database>,
  userId: string,
  habitId: string,
): Promise<HabitDetailData | null> {
  // Nie-uuid dałby błąd bazy zamiast 404
  if (!idSchema.safeParse(habitId).success) return null;

  const profil = await loadProfile(supabase, userId);
  const odSnu = addDays(profil.today, -60);

  const { data: nawyk, error } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .eq("id", habitId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!nawyk) return null;

  const [wersjeRes, odhaczenia, notatkiRes, senRes] = await Promise.all([
    supabase
      .from("habit_schedules")
      .select("*")
      .eq("user_id", userId)
      .eq("habit_id", habitId)
      .order("valid_from", { ascending: true }),
    loadChecks(supabase, userId, { habitId }),
    supabase
      .from("habit_notes")
      .select("id, date, text")
      .eq("user_id", userId)
      .eq("habit_id", habitId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("sleep_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", odSnu)
      .order("date", { ascending: true }),
  ]);
  for (const wynik of [wersjeRes, notatkiRes, senRes]) {
    if (wynik.error) throw new Error(wynik.error.message);
  }

  return {
    ...profil,
    habits: mapHabits(
      [nawyk as HabitRow],
      (wersjeRes.data ?? []) as ScheduleRow[],
    ),
    checks: odhaczenia,
    sleepLogs: mapSleepLogs((senRes.data ?? []) as SleepRow[]),
    notes: (notatkiRes.data ?? []).map((n) => ({
      id: n.id,
      date: n.date,
      text: n.text,
    })),
  };
}
