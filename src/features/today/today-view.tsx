"use client";

// Ekran Dziś (Today.dc.html web; EmptyToday.dc.html przed pierwszymi krokami).
// Sekcje: nagłówek z „Nowy blok”, karta „Ten tydzień”, dalej plan dnia i zadania (Task 4).
// Telefon (MToday, Task 5) dojdzie jako osobne drzewo za `max-[799px]:`; do tego czasu
// drzewo web widać na każdej szerokości, żeby ekran nie był pusty.
import { useState } from "react";
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
import { EmptyToday } from "./empty-today";
import { firstSteps } from "./first-steps";
import type { TodayData } from "./load-today";
import { isoWeekNumber, showFullToday, weekTiles } from "./model";
import { WeekCard } from "./week-card";

export function TodayView({ data, name }: { data: TodayData; name: string }) {
  const router = useRouter();
  const { profile, today } = data;
  // Otwarte okno nowego bloku (dane startowe) albo null
  const [nowyBlok, setNowyBlok] = useState<BlockDialogInitial | null>(null);

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
    nowMin: data.nowMin,
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
    <div className="flex min-w-0 flex-1 flex-col">
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

        {/* 2. Plan dnia (oś 00–24) i „Zadania na dziś” — Task 4 */}
      </div>

      {oknoBloku}
    </div>
  );
}
