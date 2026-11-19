"use client";

// Ekran Dziś (Today.dc.html web; EmptyToday.dc.html przed pierwszymi krokami).
// Web: nagłówek z „Nowy blok”, karta „Ten tydzień”, plan dnia i „Zadania na dziś”.
// Telefon: MToday (MToday.dc.html). Oba drzewa są w DOM, przełącza je wyłącznie CSS (800 px).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/controls";
import { todayIso } from "@/components/controls/calendar-math";
import { ModuleHeader } from "@/components/shell/module-header";
import {
  BlockDialog,
  type BlockDialogInitial,
} from "@/features/calendar/block-dialog";
import { minutesNow } from "@/features/calendar/load-calendar";
import { DNI_PELNE, MIESIACE_DOP } from "@/features/calendar/mobile/pl";
import { weekdayOf } from "@/features/calendar/view-range";
import { DayPlan } from "./day-plan";
import { EmptyToday } from "./empty-today";
import { firstSteps } from "./first-steps";
import type { TodayData } from "./load-today";
import { MQuickAdd } from "./mobile/m-quick-add";
import { MToday } from "./mobile/m-today";
import { isoWeekNumber, showFullToday, weekTiles } from "./model";
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
  // Dane z optymistycznymi zmianami: plan dnia, „Zadania na dziś” i karta tygodnia
  // liczą się z tych samych zadań, więc odhaczenie zmienia je naraz
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
    <Button variant="primary" size="sm" onClick={otworzNowyBlok}>
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

  // Stan pusty: dopóki nie ma pierwszych kroków (Ruling „EmptyToday → pełne Dziś”)
  if (!showFullToday(data.counts, profile.createdAt, today)) {
    // „Wtorek · 17 listopada” nad tytułem na telefonie
    const etykieta = `${DNI_PELNE[dzien]} · ${Number(dzienMiesiaca)} ${MIESIACE_DOP[Number(miesiac) - 1]}`;
    return (
      <>
        <ModuleHeader
          title="Dziś"
          phoneLabel={etykieta}
          webAction={przyciskNowyBlok}
        />
        <EmptyToday name={name} steps={firstSteps(data.counts)} />
        {oknoBloku}
      </>
    );
  }

  const kafelki = weekTiles({
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

  // „wtorek · 17.11.2026 · tydz. 47” — tydzień ISO także przy tygodniu od niedzieli
  const podtytul = `${DNI_PELNE[dzien].toLowerCase()} · ${dzienMiesiaca}.${miesiac}.${rok} · tydz. ${isoWeekNumber(today)}`;

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
        {/* Nagłówek web (Today.dc.html) */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaeaea] px-6 py-3">
          <div className="flex items-baseline gap-2.5">
            <h1 className="m-0 text-lg font-semibold">Dziś</h1>
            <span className="font-mono text-xs text-[#6b6b6b]">{podtytul}</span>
          </div>
          {przyciskNowyBlok}
        </header>

        <div className="box-border flex w-full max-w-[1200px] flex-col gap-6 p-6">
          {/* 1. Statystyki tygodnia */}
          <WeekCard
            tiles={kafelki}
            weekStartDate={data.weekStartDate}
            today={today}
            clock={profile.clock}
          />

          {/* 2. Plan dnia (oś 00–24) */}
          <DayPlan
            data={data}
            nowMin={teraz}
            applyOptimistic={applyOptimistic}
          />
        </div>
      </div>

      {oknoBloku}
    </>
  );
}
