"use client";

// Ekran „Nawyki i sen” na komputerze (Habits.dc.html): nagłówek, kafelki, karta Nawyki + karta Sen, heatmapa.
import { useState } from "react";

import { Button } from "@/components/controls";
import { formatDatePl } from "@/components/controls/calendar-math";
import { weekdayOf } from "@/features/calendar/view-range";
import { HabitHeatmap } from "./habit-heatmap";
import { HabitTiles } from "./habit-tiles";
import { HabitWeekGrid } from "./habit-week-grid";
import type { HabitsPageData } from "./load-habits";
import { SleepCard } from "./sleep-card";
import { useHabitsStore } from "./use-habits-store";

// Indeks 0 = poniedziałek
const DNI_TYGODNIA = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];

export function HabitsView({
  data,
  openOnLoad,
}: {
  data: HabitsPageData;
  // Zakładka „sen” (?tab=sen) — liczy się na telefonie (Task 7); web pokazuje wszystko naraz
  initialTab: "sen" | null;
  // Okno do otwarcia od razu (?nowy=nawyk|sen) — okna powstaną w Task 5
  openOnLoad: "nawyk" | "sen" | null;
}) {
  const { checks, toggle } = useHabitsStore(data);

  // TODO(Task 5): stan otwartego okna (nowy nawyk albo wpis snu, z datą dla „sen”) otworzy okna z Task 5.
  // Na razie przyciski tylko ustawiają stan i nic się nie otwiera.
  const [, setOtwarteOkno] = useState<{ rodzaj: "nawyk" | "sen"; date?: string } | null>(
    openOnLoad ? { rodzaj: openOnLoad } : null,
  );
  const onNewHabit = () => setOtwarteOkno({ rodzaj: "nawyk" });
  const onNewSleep = (date?: string) => setOtwarteOkno({ rodzaj: "sen", date });

  const dataNaglowka = `${DNI_TYGODNIA[weekdayOf(data.today) - 1]} · ${formatDatePl(data.today)}`;

  // Telefon (Task 7): tu dojdzie osobne drzewo `min-[800px]:hidden`, a to dostanie `max-[799px]:hidden`.
  // Do tego czasu widok webowy pokazujemy na każdej szerokości.
  return (
    <div className="flex min-w-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaeaea] px-6 py-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="m-0 text-lg font-semibold">Nawyki i sen</h1>
          <span className="font-mono text-xs text-[#6b6b6b]">{dataNaglowka}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onNewSleep()}>
            + Wpis snu
          </Button>
          <Button variant="primary" size="sm" onClick={onNewHabit}>
            Nowy nawyk
          </Button>
        </div>
      </header>

      <div className="box-border flex w-full flex-col gap-6 p-6">
        <HabitTiles
          habits={data.habits}
          checks={checks}
          today={data.today}
          weekStart={data.weekStart}
          sleepLogs={data.sleepLogs}
          sleepGoalMin={data.sleepGoalMin}
        />

        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch gap-6">
          <HabitWeekGrid
            habits={data.habits}
            checks={checks}
            today={data.today}
            weekStart={data.weekStart}
            onToggle={(habitId, date) => void toggle(habitId, date)}
            onNewHabit={onNewHabit}
          />
          <SleepCard sleepLogs={data.sleepLogs} today={data.today} goalMin={data.sleepGoalMin} clock={data.clock} />
        </div>

        <HabitHeatmap habits={data.habits} checks={checks} today={data.today} weekStart={data.weekStart} />
      </div>
    </div>
  );
}
