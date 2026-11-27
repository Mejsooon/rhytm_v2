// Ustawienia kalendarza i warstwy zapisane w profilu (Ustawienia → Kalendarz, lewy panel).
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { CalendarView } from "./view-range";

export type CalendarSettings = {
  view: CalendarView;
  fromHour: number;
  toHour: number;
  blockMin: 30 | 60 | 90;
  weekNumbers: boolean;
  showSport: boolean;
  showRenewals: boolean;
};

export const DOMYSLNE_USTAWIENIA: CalendarSettings = {
  view: "tydzien",
  fromHour: 7,
  toHour: 23,
  blockMin: 60,
  weekNumbers: true,
  showSport: true,
  showRenewals: true,
};

// Nazwy widoku w bazie
export const WIDOK_W_BAZIE = { dzien: "day", tydzien: "week", miesiac: "month" } as const;

export async function loadCalendarSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CalendarSettings> {
  const { data } = await supabase
    .from("profiles")
    .select(
      "calendar_view, calendar_from_hour, calendar_to_hour, calendar_block_min, calendar_week_numbers, calendar_show_sport, calendar_show_renewals",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DOMYSLNE_USTAWIENIA;
  return {
    view: data.calendar_view === "day" ? "dzien" : data.calendar_view === "month" ? "miesiac" : "tydzien",
    fromHour: data.calendar_from_hour,
    toHour: data.calendar_to_hour,
    blockMin: data.calendar_block_min === 30 ? 30 : data.calendar_block_min === 90 ? 90 : 60,
    weekNumbers: data.calendar_week_numbers,
    showSport: data.calendar_show_sport,
    showRenewals: data.calendar_show_renewals,
  };
}
