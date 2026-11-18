"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { IsoDate } from "@/components/controls/calendar-math";
import { todayIso } from "@/components/controls/calendar-math";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { safeTimezone } from "@/lib/time/timezones";
import type { Database } from "@/types/database";
import { mapHabits } from "./load-habits";
import { canCheck, type ScheduleType } from "./model";
import {
  checkInputSchema,
  habitInputSchema,
  idSchema,
  noteTextSchema,
  sleepInputSchema,
} from "./schemas";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const BRAK_NAWYKU = "Nie znaleziono nawyku.";

export type HabitInput = {
  name: string;
  schedule: { type: ScheduleType; weekdays: number[]; timesPerWeek: number | null };
  remindAt: string | null;
  showOnToday: boolean;
};

export type SleepInput = {
  date: IsoDate;
  sleptAt: string;
  wokeAt: string;
  feeling: 1 | 2 | 3 | 4 | 5 | null;
  tags: string[];
  note: string | null;
};

// Dzisiejsza data w strefie profilu użytkownika; null przy błędzie zapytania
// (akcja ma wtedy zwrócić błąd, a nie liczyć „dziś” w strefie serwera)
async function todayFor(supabase: SupabaseClient<Database>, userId: string): Promise<IsoDate | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return todayIso(safeTimezone(data?.timezone));
}

// Widoki, na które wpływa zmiana nawyku
function revalidateHabits() {
  revalidatePath("/nawyki");
  revalidatePath("/nawyki/[id]", "page");
  revalidatePath("/dzis");
}

export async function createHabit(input: HabitInput): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = habitInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU };
  }
  const dane = parsed.data;
  const dzis = await todayFor(supabase, user.id);
  if (!dzis) return { ok: false, message: BLAD_ZAPISU };

  const { data: nawyk, error } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      name: dane.name,
      remind_at: dane.remindAt,
      show_on_today: dane.showOnToday,
    })
    .select("id")
    .single();
  if (error || !nawyk) return { ok: false, message: BLAD_ZAPISU };

  // Pierwsza wersja harmonogramu obowiązuje od dziś
  const { error: bladWersji } = await supabase.from("habit_schedules").insert({
    habit_id: nawyk.id,
    user_id: user.id,
    valid_from: dzis,
    schedule_type: dane.schedule.type,
    weekdays: dane.schedule.weekdays,
    times_per_week: dane.schedule.timesPerWeek,
  });
  if (bladWersji) {
    // Nie zostawiamy nawyku bez harmonogramu
    const { error: bladCofniecia } = await supabase.from("habits").delete().eq("id", nawyk.id);
    if (bladCofniecia) {
      return { ok: false, message: "Nie udało się zapisać nawyku. Sprawdź listę nawyków i spróbuj ponownie." };
    }
    return { ok: false, message: BLAD_ZAPISU };
  }

  revalidateHabits();
  return { ok: true, id: nawyk.id };
}

export async function updateHabit(id: string, input: HabitInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, message: BLAD_ZAPISU };
  const parsed = habitInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU };
  }
  const dane = parsed.data;

  // Najpierw pola nawyku: zmiana z warunkiem user_id jest jednocześnie sprawdzeniem własności,
  // więc cudzy nawyk kończy się „nie znaleziono”, zanim dotkniemy harmonogramu.
  // Gdyby zapis wersji potem się nie udał, zostaje tylko nowa nazwa/godzina — to nieszkodliwe.
  const { data: zmienione, error } = await supabase
    .from("habits")
    .update({ name: dane.name, remind_at: dane.remindAt, show_on_today: dane.showOnToday })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!zmienione || zmienione.length === 0) return { ok: false, message: BRAK_NAWYKU };

  // Nowa wersja harmonogramu tylko wtedy, gdy zmienił się typ, dni albo X
  const dzis = await todayFor(supabase, user.id);
  if (!dzis) return { ok: false, message: BLAD_ZAPISU };
  const { data: wersje, error: bladWersji } = await supabase
    .from("habit_schedules")
    .select("*")
    .eq("habit_id", id)
    .order("valid_from", { ascending: true });
  if (bladWersji) return { ok: false, message: BLAD_ZAPISU };

  // Obowiązująca dziś: największe valid_from ≤ dziś (gdy wszystkie są w przyszłości — pierwsza);
  // zapytanie już sortuje rosnąco po valid_from
  const lista = wersje ?? [];
  const obowiazujaca = [...lista].reverse().find((w) => w.valid_from <= dzis) ?? lista[0];
  const zmienilSie =
    !obowiazujaca ||
    obowiazujaca.schedule_type !== dane.schedule.type ||
    obowiazujaca.times_per_week !== dane.schedule.timesPerWeek ||
    [...obowiazujaca.weekdays].sort().join(",") !== dane.schedule.weekdays.join(",");

  if (zmienilSie) {
    // Wersja z dzisiejszym valid_from (jeśli już jest) zostaje nadpisana
    const { error: bladZapisu } = await supabase.from("habit_schedules").upsert(
      {
        habit_id: id,
        user_id: user.id,
        valid_from: dzis,
        schedule_type: dane.schedule.type,
        weekdays: dane.schedule.weekdays,
        times_per_week: dane.schedule.timesPerWeek,
      },
      { onConflict: "habit_id,valid_from" },
    );
    if (bladZapisu) return { ok: false, message: BLAD_ZAPISU };
  }

  revalidateHabits();
  return { ok: true };
}

export async function deleteHabit(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  if (!idSchema.safeParse(id).success) return { ok: false, message: BLAD_ZAPISU };

  // Wersje, odhaczenia i notatki usuwa kaskada w bazie
  const { data: usuniete, error } = await supabase
    .from("habits")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!usuniete || usuniete.length === 0) return { ok: false, message: BRAK_NAWYKU };

  revalidateHabits();
  return { ok: true };
}

export async function setHabitCheck(
  habitId: string,
  date: IsoDate,
  done: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = checkInputSchema.safeParse({ habitId, date, done });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU };
  }

  // Własny nawyk (RLS i tak ukrywa cudze)
  const { data: nawyk, error } = await supabase
    .from("habits")
    .select("*")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!nawyk) return { ok: false, message: BRAK_NAWYKU };

  const dzis = await todayFor(supabase, user.id);
  if (!dzis) return { ok: false, message: BLAD_ZAPISU };
  if (date > dzis) return { ok: false, message: "Tego dnia nie można odhaczyć." };

  // Odznaczać wolno każdy dzień ≤ dziś (także odhaczenie osierocone zmianą harmonogramu);
  // odhaczać tylko dni, na które pozwala harmonogram
  if (done) {
    const { data: wersje, error: bladWersji } = await supabase
      .from("habit_schedules")
      .select("*")
      .eq("habit_id", habitId);
    if (bladWersji) return { ok: false, message: BLAD_ZAPISU };
    const [habit] = mapHabits([nawyk], wersje ?? []);
    if (!canCheck(habit, date, dzis)) {
      return { ok: false, message: "Tego dnia nie można odhaczyć." };
    }
  }

  if (done) {
    // Powtórne odhaczenie tego samego dnia jest po cichu ignorowane
    const { error: bladZapisu } = await supabase
      .from("habit_checks")
      .upsert(
        { habit_id: habitId, user_id: user.id, date },
        { onConflict: "habit_id,date", ignoreDuplicates: true },
      );
    if (bladZapisu) return { ok: false, message: BLAD_ZAPISU };
  } else {
    // Odznaczenie nieodhaczonego dnia nie jest błędem, więc nie sprawdzamy liczby wierszy
    const { error: bladUsuniecia } = await supabase
      .from("habit_checks")
      .delete()
      .eq("habit_id", habitId)
      .eq("date", date)
      .eq("user_id", user.id);
    if (bladUsuniecia) return { ok: false, message: BLAD_ZAPISU };
  }

  revalidateHabits();
  return { ok: true };
}

export async function addHabitNote(habitId: string, text: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsedId = idSchema.safeParse(habitId);
  const parsedText = noteTextSchema.safeParse(text);
  if (!parsedId.success) return { ok: false, message: BLAD_ZAPISU };
  if (!parsedText.success) {
    return { ok: false, message: parsedText.error.issues[0]?.message ?? BLAD_ZAPISU };
  }

  const { data: nawyk, error: bladNawyku } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bladNawyku) return { ok: false, message: BLAD_ZAPISU };
  if (!nawyk) return { ok: false, message: BRAK_NAWYKU };

  const dzis = await todayFor(supabase, user.id);
  if (!dzis) return { ok: false, message: BLAD_ZAPISU };
  const { error } = await supabase.from("habit_notes").insert({
    habit_id: habitId,
    user_id: user.id,
    date: dzis,
    text: parsedText.data,
  });
  if (error) return { ok: false, message: BLAD_ZAPISU };

  revalidateHabits();
  return { ok: true };
}

export async function saveSleepLog(input: SleepInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = sleepInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU };
  }
  const dane = parsed.data;

  const dzis = await todayFor(supabase, user.id);
  if (!dzis) return { ok: false, message: BLAD_ZAPISU };
  if (dane.date > dzis) return { ok: false, message: "Nie można zapisać snu z przyszłości." };

  // Jeden wpis na dzień pobudki: ponowny zapis tej samej daty nadpisuje wpis.
  // Tabela nie ma wyzwalacza updated_at, więc ustawiamy go sami.
  const { error } = await supabase.from("sleep_logs").upsert(
    {
      user_id: user.id,
      date: dane.date,
      slept_at: dane.sleptAt,
      woke_at: dane.wokeAt,
      feeling: dane.feeling,
      tags: dane.tags,
      note: dane.note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" },
  );
  // Upsert zawsze tworzy albo nadpisuje własny wiersz (RLS odrzuca cudzy błędem), więc bez sprawdzania liczby wierszy
  if (error) return { ok: false, message: BLAD_ZAPISU };

  revalidateHabits();
  return { ok: true };
}
