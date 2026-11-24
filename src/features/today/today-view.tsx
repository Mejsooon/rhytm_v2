"use client";

// Ekran Dziś (S2Today web).
// Web: nagłówek z „Nowy blok”, karta „Ten tydzień”, „Nawyki na dziś” i plan dnia.
// Telefon: MToday (MToday.dc.html). Oba drzewa są w DOM, przełącza je wyłącznie CSS (800 px).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button, StatusBadge } from "@/components/controls";
import { todayIso } from "@/components/controls/calendar-math";
import { ModuleHeader } from "@/components/shell/module-header";
import {
  BlockDialog,
  type BlockDialogInitial,
} from "@/features/calendar/block-dialog";
import { minutesNow } from "@/features/calendar/load-calendar";
import { DNI_PELNE } from "@/features/calendar/mobile/pl";
import { weekdayOf } from "@/features/calendar/view-range";
import { HabitDialog } from "@/features/habits/habit-dialog";
import { DayPlan } from "./day-plan";
import type { TodayData } from "./load-today";
import { MQuickAdd } from "./mobile/m-quick-add";
import { MToday } from "./mobile/m-today";
import { isoWeekNumber, todayHabits, weekBars } from "./model";
import { TodayHabits } from "./today-habits";
import { useTodayStore } from "./use-today-store";
import { WeekCard } from "./week-card";

export function TodayView({
  data: daneSerwera,
  name,
  avatarUrl = null,
}: {
  data: TodayData;
  name: string;
  // Podpisany adres zdjęcia profilu (awatar na telefonie); null → inicjał
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  // Dane z optymistycznymi zmianami: plan dnia („x/y”) liczy się z tych samych zadań co dymek
  // bloku, a nawyki i karta tygodnia z tych samych odhaczeń, więc klik zmienia je naraz
  const { data, applyOptimistic, toggleHabit } = useTodayStore(daneSerwera);
  const { profile, today } = data;
  const { timezone } = profile;

  // Jeden zegar dla obu drzew (plan dnia web i MToday): start z wartości serwera, potem na początku
  // każdej pełnej minuty w strefie profilu; nowa wartość z serwera (odświeżenie) zastępuje zegar.
  // Po północy dane są z wczoraj → jedno odświeżenie strony.
  const [teraz, setTeraz] = useState(data.nowMin);
  const [terazDla, setTerazDla] = useState(data.nowMin);
  if (terazDla !== data.nowMin) {
    setTerazDla(data.nowMin);
    setTeraz(data.nowMin);
  }
  useEffect(() => {
    const tik = () => {
      if (todayIso(timezone) !== today) router.refresh();
      setTeraz(minutesNow(timezone));
    };
    let interwal: number | undefined;
    const start = window.setTimeout(
      () => {
        tik();
        interwal = window.setInterval(tik, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interwal);
    };
  }, [timezone, today, router]);
  // Otwarte okno nowego bloku (dane startowe) albo null
  const [nowyBlok, setNowyBlok] = useState<BlockDialogInitial | null>(null);
  // Otwarty arkusz szybkiego dodawania MQuickAdd (pływający „+” na telefonie)
  const [szybkieDodawanie, setSzybkieDodawanie] = useState(false);
  // Otwarte okno nowego nawyku (kafelek „Utwórz nowy nawyk”)
  const [nowyNawyk, setNowyNawyk] = useState(false);

  // „Nowy blok”: dziś, najbliższa pełna godzina (najpóźniej 23:00), 60 min — jak w kalendarzu.
  // Dzień i godzina liczone w chwili kliknięcia, w strefie profilu (strona mogła być otwarta długo).
  function otworzNowyBlok() {
    const teraz = minutesNow(profile.timezone);
    setNowyBlok({
      title: "",
      categoryId: null,
      date: todayIso(profile.timezone),
      startMin: Math.min((Math.floor(teraz / 60) + 1) * 60, 23 * 60),
      durationMin: 60,
      recurrence: null,
      note: "",
      remind: true,
    });
  }

  const przyciskNowyBlok = (
    // .btnp z CToday: 32 px, ikona + 16 px
    <Button variant="primary" size="md" onClick={otworzNowyBlok}>
      <Plus size={16} aria-hidden="true" />
      Nowy blok
    </Button>
  );

  const oknoBloku = nowyBlok && (
    <BlockDialog
      mode="create"
      initial={nowyBlok}
      categories={data.categories}
      clock={profile.clock}
      weekStart={profile.weekStart}
      today={today}
      onSaved={() => {
        setNowyBlok(null);
        // Akcje bloku odświeżają tylko /kalendarz, więc Dziś pobiera dane sam
        router.refresh();
      }}
      onCancel={() => setNowyBlok(null)}
    />
  );

  const dzien = weekdayOf(today);
  const [rok, miesiac, dzienMiesiaca] = today.split("-");

  const paski = weekBars({
    today,
    nowMin: teraz,
    weekStartDate: data.weekStartDate,
    tasks: data.tasks,
    habits: data.habits,
    checks: data.checks,
    sleepLogs: data.sleepLogs,
    sleepGoalMin: profile.sleepGoalMin,
    sportItems: data.sportItems,
    kmGoalOn: profile.kmGoalOn,
    weeklyKmGoal: profile.weeklyKmGoal,
    workoutsGoalOn: profile.workoutsGoalOn,
    weeklyWorkoutsGoal: profile.weeklyWorkoutsGoal,
  });

  // „wtorek · 17.11.2026” w odznace i „tydz. 47” obok — tydzień ISO także przy tygodniu od niedzieli
  const dataNaglowka = `${DNI_PELNE[dzien].toLowerCase()} · ${dzienMiesiaca}.${miesiac}.${rok}`;
  const tydzien = `tydz. ${isoWeekNumber(today)}`;

  return (
    <>
      <div
        data-testid="m-dzis"
        className="flex min-w-0 flex-1 flex-col min-[800px]:hidden"
      >
        <MToday
          data={data}
          nowMin={teraz}
          name={name}
          avatarUrl={avatarUrl}
          applyOptimistic={applyOptimistic}
          onToggleHabit={(habitId) => void toggleHabit(habitId, today)}
          onQuickAdd={() => setSzybkieDodawanie(true)}
          onNewHabit={() => setNowyNawyk(true)}
        />
      </div>
      {/* Arkusz szybkiego dodawania (pływający „+” na telefonie) */}
      {szybkieDodawanie && (
        <MQuickAdd
          today={today}
          nowMin={teraz}
          weekStart={profile.weekStart}
          categories={data.categories}
          onClose={() => setSzybkieDodawanie(false)}
        />
      )}

      <div
        data-testid="web-dzis"
        className="flex min-w-0 flex-1 flex-col max-[799px]:hidden"
      >
        {/* Nagłówek web (.topbar z CToday): sam tytuł „Dziś”, odznaka z datą, „tydz. N”, „Nowy blok” */}
        <ModuleHeader
          title="Dziś"
          webOnly
          webMeta={
            <>
              <StatusBadge tone="gray" size="lg" className="tabular-nums">
                {dataNaglowka}
              </StatusBadge>
              <span className="text-xs text-muted-foreground tabular-nums">
                {tydzien}
              </span>
            </>
          }
          webAction={przyciskNowyBlok}
        />

        <div className="box-border flex w-full flex-col gap-6 p-6">
          {/* 1. Cele tygodnia (4 paski) */}
          <WeekCard bars={paski} weekStartDate={data.weekStartDate} />

          {/* 2. Nawyki na dziś (kafelki z passą) */}
          <TodayHabits
            habits={todayHabits({
              today,
              weekStart: profile.weekStart,
              habits: data.habits,
              checks: data.checks,
            })}
            onToggle={(habitId) => void toggleHabit(habitId, today)}
            onCreate={() => setNowyNawyk(true)}
          />

          {/* 3. Plan dnia (lista 00–24 z przerwami) */}
          <DayPlan
            data={data}
            nowMin={teraz}
            applyOptimistic={applyOptimistic}
            onNewBlock={otworzNowyBlok}
          />
        </div>
      </div>

      {oknoBloku}
      {/* Okno nowego nawyku z modułu Nawyki; akcja odświeża /dzis, a refresh dociąga dane od razu */}
      <HabitDialog
        open={nowyNawyk}
        onOpenChange={(otwarte) => {
          if (otwarte) return;
          setNowyNawyk(false);
          router.refresh();
        }}
        weekStart={profile.weekStart}
        clock={profile.clock}
        today={today}
      />
    </>
  );
}
