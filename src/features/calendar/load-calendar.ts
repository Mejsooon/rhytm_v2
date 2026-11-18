// Wczytywanie danych kalendarza dla zakresu dat (blok, wyjątki, zadania, kategorie, profil)
// oraz podglądu treningów (sesje i wystąpienia szablonów, tylko do odczytu).
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIso, type IsoDate } from "@/components/controls/calendar-math";
import { safeTimezone } from "@/lib/time/timezones";
import type { Database } from "@/types/database";
import type { BlockRow, ExceptionRow, Recurrence } from "./occurrences";
import { addDays } from "./view-range";
import type { TaskRow } from "@/features/tasks/model";
import {
  sessionItems,
  templateOccurrences,
  type RunRow,
  type SessionRow,
  type SkipRow,
  type SportItem,
  type TemplateRow,
} from "@/features/sport/model";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export type CalendarProfile = {
  timezone: string;
  weekStart: "mon" | "sun";
  clock: "24" | "12";
};

export type CalendarData = {
  blocks: BlockRow[];
  exceptions: ExceptionRow[];
  tasks: TaskRow[];
  categories: CategoryRow[];
  profile: CalendarProfile;
  // Treningi do podglądu: sesje z show_in_calendar i wystąpienia szablonów od dziś, rosnąco
  sport: SportItem[];
};

// Bloki, które mogą mieć wystąpienia w zakresie: jednorazowe z dniem w zakresie
// oraz serie zaczęte do końca zakresu, których `until` nie wypada przed jego początkiem
export function pickBlocksForRange(
  blocks: BlockRow[],
  from: IsoDate,
  to: IsoDate,
): BlockRow[] {
  return blocks.filter((blok) => {
    const dataStartu = blok.start_local.slice(0, 10);
    if (dataStartu > to) return false;
    const rec = blok.recurrence as Recurrence | null;
    if (!rec) return dataStartu >= from;
    return rec.until === undefined || rec.until >= from;
  });
}

// Profil użytkownika z bezpiecznymi wartościami domyślnymi
export async function loadCalendarProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CalendarProfile> {
  const { data } = await supabase
    .from("profiles")
    .select("timezone, week_start, clock")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    timezone: safeTimezone(data?.timezone),
    weekStart: data?.week_start === "sun" ? "sun" : "mon",
    clock: data?.clock === "12" ? "12" : "24",
  };
}

// Minuty od północy w podanej strefie (liczone na serwerze, żeby nie rozjechać hydracji)
export function minutesNow(timeZone: string, now: Date = new Date()): number {
  const czesci = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const godzina = Number(czesci.find((c) => c.type === "hour")?.value ?? 0);
  const minuta = Number(czesci.find((c) => c.type === "minute")?.value ?? 0);
  return godzina * 60 + minuta;
}

export async function loadCalendar(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: { from: IsoDate; to: IsoDate },
  profile?: CalendarProfile,
  // „Dziś” do wystąpień szablonów; domyślnie z profilu (parametr dla testów)
  today?: IsoDate,
): Promise<CalendarData> {
  const { from, to } = range;
  const nastepnyDzien = addDays(to, 1);

  const [
    blokiRes,
    wyjatkiRes,
    zadaniaRes,
    kategorieRes,
    sesjeRes,
    szablonyRes,
    pominieciaRes,
    profil,
  ] = await Promise.all([
    supabase
      .from("blocks")
      .select("*")
      .eq("user_id", userId)
      .lte("start_local", `${to}T23:59:59`)
      // Jednorazowe tylko od początku zakresu; serie mogą zaczynać się dowolnie wcześniej
      .or(`recurrence.not.is.null,start_local.gte.${from}T00:00:00`),
    // Wyjątki z oryginalną datą w zakresie ORAZ takie, które przenoszą wystąpienie do zakresu z zewnątrz
    supabase
      .from("block_exceptions")
      .select("*")
      .eq("user_id", userId)
      .or(
        `and(occurrence_date.gte.${from},occurrence_date.lte.${to}),and(new_start_local.gte.${from}T00:00:00,new_start_local.lt.${nastepnyDzien}T00:00:00)`,
      ),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .or(
        `and(due_date.gte.${from},due_date.lte.${to}),and(occurrence_date.gte.${from},occurrence_date.lte.${to})`,
      )
      .order("position", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    // Sesje ze startem w zakresie oraz sesje z szablonu na dzień z zakresu (te tylko
    // zastępują wystąpienie szablonu, nawet gdy trening przeniesiono na inny dzień)
    supabase
      .from("sport_sessions")
      .select("*")
      .eq("user_id", userId)
      .or(
        `and(start_local.gte.${from}T00:00:00,start_local.lt.${nastepnyDzien}T00:00:00),and(template_date.gte.${from},template_date.lte.${to})`,
      )
      .order("start_local", { ascending: true }),
    supabase.from("workout_templates").select("*").eq("user_id", userId),
    supabase
      .from("template_skips")
      .select("*")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to),
    profile ? Promise.resolve(profile) : loadCalendarProfile(supabase, userId),
  ]);

  // Błąd zapytania ma trafić do granicy błędu trasy, a nie pokazać pusty kalendarz
  for (const wynik of [
    blokiRes,
    wyjatkiRes,
    zadaniaRes,
    kategorieRes,
    sesjeRes,
    szablonyRes,
    pominieciaRes,
  ]) {
    if (wynik.error) throw new Error(wynik.error.message);
  }

  const exceptions = (wyjatkiRes.data ?? []) as ExceptionRow[];
  const blocks = pickBlocksForRange(
    (blokiRes.data ?? []) as BlockRow[],
    from,
    to,
  );

  // Wyjątek przenoszący wystąpienie do zakresu może należeć do bloku spoza wybranych
  const znane = new Set(blocks.map((b) => b.id));
  const brakujace = [
    ...new Set(
      exceptions.map((w) => w.block_id).filter((id) => !znane.has(id)),
    ),
  ];
  if (brakujace.length > 0) {
    const { data, error } = await supabase
      .from("blocks")
      .select("*")
      .eq("user_id", userId)
      .in("id", brakujace);
    if (error) throw new Error(error.message);
    blocks.push(...((data ?? []) as BlockRow[]));
  }

  // Zadania wystąpień przeniesionych do zakresu z dnia spoza niego. Nowe przeniesienia zmieniają
  // due_date zadań, ale starsze dane mają termin z oryginalnego dnia — dociągamy je po parze
  // (blok, oryginalna data).
  const tasks = (zadaniaRes.data ?? []) as TaskRow[];
  const spozaZakresu = exceptions.filter(
    (w) =>
      w.kind === "modified" &&
      (w.occurrence_date < from || w.occurrence_date > to),
  );
  if (spozaZakresu.length > 0) {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .in("block_id", [...new Set(spozaZakresu.map((w) => w.block_id))])
      .in("occurrence_date", [
        ...new Set(spozaZakresu.map((w) => w.occurrence_date)),
      ]);
    if (error) throw new Error(error.message);
    const pary = new Set(
      spozaZakresu.map((w) => `${w.block_id}:${w.occurrence_date}`),
    );
    const znaneZadania = new Set(tasks.map((t) => t.id));
    for (const zadanie of (data ?? []) as TaskRow[]) {
      if (znaneZadania.has(zadanie.id)) continue;
      if (!pary.has(`${zadanie.block_id}:${zadanie.occurrence_date}`)) continue;
      tasks.push(zadanie);
    }
    tasks.sort((a, b) => a.position - b.position);
  }

  // Podgląd treningów: sesje ze startem w zakresie i show_in_calendar (biegi z danymi biegu)
  // oraz wystąpienia szablonów od dziś (Ruling „Wystąpienia z szablonów”)
  const sesje = (sesjeRes.data ?? []) as SessionRow[];
  const pokazane = sesje.filter(
    (s) =>
      s.show_in_calendar &&
      s.start_local >= `${from}T00:00:00` &&
      s.start_local < `${nastepnyDzien}T00:00:00`,
  );
  const idBiegow = pokazane.filter((s) => s.type === "run").map((s) => s.id);
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
  const sport = [
    ...sessionItems(pokazane, biegi),
    ...templateOccurrences(
      (szablonyRes.data ?? []) as TemplateRow[],
      (pominieciaRes.data ?? []) as SkipRow[],
      sesje,
      from,
      to,
      today ?? todayIso(profil.timezone),
    ),
  ].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.startMin - b.startMin,
  );

  return {
    blocks,
    exceptions,
    tasks,
    categories: (kategorieRes.data ?? []) as CategoryRow[],
    profile: profil,
    sport,
  };
}
