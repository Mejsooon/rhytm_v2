import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { todayIso } from "@/components/controls/calendar-math";
import { ModuleHeader } from "@/components/shell/module-header";
import { CalendarView } from "@/features/calendar/calendar-view";
import {
  loadCalendar,
  loadCalendarProfile,
  minutesNow,
} from "@/features/calendar/load-calendar";
import { parseCalendarParams, viewRange } from "@/features/calendar/view-range";
import { createClient } from "@/lib/supabase/server";

type Parametry = Promise<{ widok?: string; data?: string }>;

// Dane zależą od ciasteczek i adresu → connection + Suspense (jak /dzis)
async function Kalendarz({ searchParams }: { searchParams: Parametry }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  // Profil najpierw: dzisiejsza data i początek tygodnia wyznaczają zakres zapytań
  const profil = await loadCalendarProfile(supabase, user.id);
  const dzis = todayIso(profil.timezone);
  const parametry = await searchParams;
  const { view, date } = parseCalendarParams(parametry, dzis);
  const jawnyWidok =
    parametry.widok === "dzien" ||
    parametry.widok === "tydzien" ||
    parametry.widok === "miesiac";
  // Dzień na telefonie pokazuje pasek tygodnia z kropkami, więc dane obejmują cały tydzień
  const zakres = viewRange(
    view === "dzien" ? "tydzien" : view,
    date,
    profil.weekStart,
  );
  const dane = await loadCalendar(supabase, user.id, zakres, profil);

  return (
    <CalendarView
      view={view}
      hasExplicitView={jawnyWidok}
      date={date}
      today={dzis}
      nowMinutes={minutesNow(profil.timezone)}
      data={dane}
    />
  );
}

export default function KalendarzPage({
  searchParams,
}: {
  searchParams: Parametry;
}) {
  return (
    <Suspense fallback={<ModuleHeader title="Kalendarz" />}>
      <Kalendarz searchParams={searchParams} />
    </Suspense>
  );
}
