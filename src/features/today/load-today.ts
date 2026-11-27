// Dane ekranu Dziś: wszystko, czego potrzebuje bieżący tydzień, w jednym wywołaniu serwera.
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIso, type IsoDate } from "@/components/controls/calendar-math";
import {
  loadCalendar,
  minutesNow,
  type CategoryRow,
} from "@/features/calendar/load-calendar";
import {
  expandOccurrences,
  type BlockRow,
  type Occurrence,
} from "@/features/calendar/occurrences";
import { addDays } from "@/features/calendar/view-range";
import {
  loadChecks,
  mapHabits,
  mapSleepLogs,
} from "@/features/habits/load-habits";
import type { Checks, Habit } from "@/features/habits/model";
import type { SleepLog } from "@/features/habits/sleep";
import type { ActivityKindRow } from "@/features/sport/activities";
import type { SportItem } from "@/features/sport/model";
import type { TaskRow } from "@/features/tasks/model";
import { safeTimezone } from "@/lib/time/timezones";
import type { Database } from "@/types/database";
import { firstStepsDone, type FirstStepKey } from "./first-steps-model";
import { weekStart } from "./model";

type HabitRow = Database["public"]["Tables"]["habits"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["habit_schedules"]["Row"];
type SleepRow = Database["public"]["Tables"]["sleep_logs"]["Row"];

const DOMYSLNY_CEL_SNU_MIN = 480;
const DOMYSLNY_CEL_KM = 25;
const DOMYSLNY_CEL_TRENINGOW = 3;

export type TodayData = {
  profile: {
    timezone: string;
    weekStart: "mon" | "sun";
    clock: "24" | "12";
    displayName: string | null;
    avatarPath: string | null;
    sleepGoalMin: number;
    kmGoalOn: boolean;
    weeklyKmGoal: number;
    workoutsGoalOn: boolean;
    weeklyWorkoutsGoal: number;
    // Godziny aktywne planu dnia (Ustawienia → Kalendarz)
    fromHour: number;
    toHour: number;
    // Waga do liczenia kcal w oknach biegu i aktywności
    weightKg: number | null;
  };
  // Szablony siłowni i własne rodzaje aktywności (menu dodawania i „Szybko dodaj”)
  templates: { id: string; name: string }[];
  activityKinds: ActivityKindRow[];
  // „Pierwsze kroki” i to, czy karta tygodnia ma już z czego liczyć (kiedykolwiek)
  firstSteps: { hidden: boolean; done: Record<FirstStepKey, boolean> };
  hasStats: boolean;
  today: IsoDate;
  nowMin: number;
  weekStartDate: IsoDate;
  // Bloki tygodnia (okno edycji potrzebuje daty startu serii)
  blocks: BlockRow[];
  occurrencesToday: Occurrence[];
  categories: CategoryRow[];
  // Zadania tygodnia
  tasks: TaskRow[];
  habits: Habit[];
  checks: Checks;
  // Ostatnie 60 dni
  sleepLogs: SleepLog[];
  // Treningi tygodnia — wszystkie, także ukryte w kalendarzu
  sportItems: SportItem[];
};

export async function loadToday(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<TodayData> {
  // Profil najpierw: strefa i początek tygodnia wyznaczają zakresy pozostałych zapytań
  const { data: p, error: blad } = await supabase
    .from("profiles")
    .select(
      "timezone, week_start, clock, display_name, avatar_path, sleep_goal_min, km_goal_on, weekly_km_goal, workouts_goal_on, weekly_workouts_goal, calendar_from_hour, calendar_to_hour, weight_kg, height_cm, first_steps, first_steps_hidden",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (blad) throw new Error(blad.message);

  const timezone = safeTimezone(p?.timezone);
  const startTygodnia: "mon" | "sun" = p?.week_start === "sun" ? "sun" : "mon";
  const profile: TodayData["profile"] = {
    timezone,
    weekStart: startTygodnia,
    clock: p?.clock === "12" ? "12" : "24",
    displayName: p?.display_name ?? null,
    avatarPath: p?.avatar_path ?? null,
    sleepGoalMin: p?.sleep_goal_min ?? DOMYSLNY_CEL_SNU_MIN,
    kmGoalOn: p?.km_goal_on ?? false,
    weeklyKmGoal: p?.weekly_km_goal ?? DOMYSLNY_CEL_KM,
    workoutsGoalOn: p?.workouts_goal_on ?? false,
    weeklyWorkoutsGoal: p?.weekly_workouts_goal ?? DOMYSLNY_CEL_TRENINGOW,
    fromHour: p?.calendar_from_hour ?? 7,
    toHour: p?.calendar_to_hour ?? 23,
    weightKg: p?.weight_kg ?? null,
  };

  const today = todayIso(timezone, now);
  const nowMin = minutesNow(timezone, now);
  const weekStartDate = weekStart(today, startTygodnia);
  const koniecTygodnia = addDays(weekStartDate, 6);
  // Treningi i sen także z poprzedniego tygodnia (porównanie w karcie „Ten tydzień”)
  const odPoprzedniego = addDays(weekStartDate, -7);

  const [
    kalendarz,
    nawykiRes,
    wersjeRes,
    odhaczenia,
    senRes,
    szablonyRes,
    rodzajeRes,
  ] = await Promise.all([
    // Bloki, wyjątki, zadania tygodnia, kategorie i treningi tygodnia (wszystkie)
    loadCalendar(
      supabase,
      userId,
      { from: odPoprzedniego, to: koniecTygodnia },
      {
        timezone,
        weekStart: startTygodnia,
        clock: profile.clock,
      },
      today,
      { wszystkieTreningi: true },
    ),
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
    // Cała historia odhaczeń (strony po 1000) — seria nawyku idzie wstecz bez limitu
    loadChecks(supabase, userId, {}),
    supabase
      .from("sleep_logs")
      .select("*")
      .eq("user_id", userId)
      // 60 dni jak w Nawykach: okno snu z menu musi znaleźć starszy wpis, inaczej by go nadpisało
      .gte("date", addDays(today, -60))
      .lte("date", koniecTygodnia)
      .order("date", { ascending: true }),
    supabase
      .from("workout_templates")
      .select("id, name")
      .eq("user_id", userId)
      .order("name"),
    supabase
      .from("activity_kinds")
      .select("name, color, has_distance")
      .eq("user_id", userId)
      .order("name"),
  ]);

  // Błąd zapytania ma trafić do granicy błędu trasy, a nie pokazać pusty ekran
  for (const wynik of [nawykiRes, wersjeRes, senRes, szablonyRes, rodzajeRes]) {
    if (wynik.error) throw new Error(wynik.error.message);
  }

  // Czy cokolwiek takiego istnieje (same liczniki, bez wierszy)
  const ile = (tabela: "blocks" | "sport_sessions" | "sleep_logs" | "push_subscriptions") =>
    supabase.from(tabela).select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  const liczniki = await Promise.all([
    ile("blocks"),
    ile("sport_sessions"),
    ile("sleep_logs"),
    ile("push_subscriptions"),
    supabase
      .from("pages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_system", false),
  ]);
  for (const wynik of liczniki) {
    if (wynik.error) throw new Error(wynik.error.message);
  }
  const [bloki, treningi, noce, push, strony] = liczniki.map((w) => (w.count ?? 0) > 0);

  // Zadania tygodnia (kafelki i plan dnia)
  const tasks = kalendarz.tasks;

  // Odhaczenia z całej historii: habitId → zbiór dat
  const checks: Checks = new Map();
  for (const c of odhaczenia) {
    const daty = checks.get(c.habitId) ?? new Set<IsoDate>();
    daty.add(c.date);
    checks.set(c.habitId, daty);
  }

  return {
    firstSteps: {
      hidden: p?.first_steps_hidden ?? false,
      done: firstStepsDone(p?.first_steps, {
        profil: Boolean(p?.display_name && p?.weight_kg && p?.height_cm),
        blok: bloki,
        nawyk: (nawykiRes.data ?? []).length > 0,
        trening: treningi,
        push,
        strona: strony,
      }),
    },
    hasStats: treningi || noce || odhaczenia.length > 0,
    profile,
    templates: szablonyRes.data ?? [],
    activityKinds: rodzajeRes.data ?? [],
    today,
    nowMin,
    weekStartDate,
    blocks: kalendarz.blocks,
    occurrencesToday: expandOccurrences(
      kalendarz.blocks,
      kalendarz.exceptions,
      today,
      today,
    ),
    categories: kalendarz.categories,
    tasks,
    habits: mapHabits(
      (nawykiRes.data ?? []) as HabitRow[],
      (wersjeRes.data ?? []) as ScheduleRow[],
    ),
    checks,
    sleepLogs: mapSleepLogs((senRes.data ?? []) as SleepRow[]),
    sportItems: kalendarz.sport,
  };
}
