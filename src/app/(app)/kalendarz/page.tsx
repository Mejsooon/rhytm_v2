import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { todayIso } from "@/components/controls/calendar-math";
import { ModuleHeader } from "@/components/shell/module-header";
import { CalendarView } from "@/features/calendar/calendar-view";
import {
  loadCalendar,
  loadCalendarProfile,
  loadRenewals,
  minutesNow,
} from "@/features/calendar/load-calendar";
import { parseCalendarParams, viewRange } from "@/features/calendar/view-range";
import { createClient } from "@/lib/supabase/server";

type Parametry = Promise<{
  widok?: string;
  data?: string;
  nowy?: string;
  godzina?: string;
  tytul?: string;
}>;

const GODZINA = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  // Odnowienia subskrypcji tylko tutaj (Dziś i telefon ich nie wczytują), równolegle z kalendarzem
  const [dane, odnowienia] = await Promise.all([
    loadCalendar(supabase, user.id, zakres, profil),
    loadRenewals(supabase, user.id, zakres),
  ]);

  // ?nowy=blok&data&godzina&tytul (np. z szybkiego dodawania na Dziś) → okno nowego bloku.
  // Dzień = `data` kalendarza (zła albo brak → dziś); zła albo brak godziny → najbliższa pełna
  // godzina (najpóźniej 23:00), jak „Nowy blok” na Dziś.
  const teraz = minutesNow(profil.timezone);
  const nowyBlok =
    parametry.nowy === "blok"
      ? {
          date,
          startMin:
            parametry.godzina && GODZINA.test(parametry.godzina)
              ? Number(parametry.godzina.slice(0, 2)) * 60 +
                Number(parametry.godzina.slice(3, 5))
              : Math.min((Math.floor(teraz / 60) + 1) * 60, 23 * 60),
          title: (parametry.tytul ?? "").slice(0, 120),
        }
      : null;

  return (
    <CalendarView
      view={view}
      hasExplicitView={jawnyWidok}
      date={date}
      today={dzis}
      nowMinutes={teraz}
      data={dane}
      renewals={odnowienia}
      newBlock={nowyBlok}
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
