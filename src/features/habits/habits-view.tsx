"use client";

// Ekran „Nawyki i sen” na komputerze (Habits.dc.html): nagłówek, kafelki, karta Nawyki + karta Sen, heatmapa.
import { useState } from "react";

import { Button } from "@/components/controls";
import { formatDatePl } from "@/components/controls/calendar-math";
import type { IsoDate } from "@/components/controls/calendar-math";
import { weekdayOf } from "@/features/calendar/view-range";
import { HabitDialog } from "./habit-dialog";
import { HabitHeatmap } from "./habit-heatmap";
import { HabitTiles } from "./habit-tiles";
import { HabitWeekGrid } from "./habit-week-grid";
import type { HabitsPageData } from "./load-habits";
import { SleepCard } from "./sleep-card";
import { SleepDialog } from "./sleep-dialog";
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
  // Okno do otwarcia od razu (?nowy=nawyk|sen); „sen” otwiera wpis na dziś
  openOnLoad: "nawyk" | "sen" | null;
}) {
  const { checks, toggle } = useHabitsStore(data);

  // Otwarte okno: nowy nawyk albo wpis snu z datą pobudki (okno samo znajdzie wpis z tego dnia)
  const [otwarteOkno, setOtwarteOkno] = useState<{ rodzaj: "nawyk" } | { rodzaj: "sen"; date: IsoDate } | null>(
    openOnLoad === "nawyk"
      ? { rodzaj: "nawyk" }
      : openOnLoad === "sen"
        ? { rodzaj: "sen", date: data.today }
        : null,
  );
  const onNewHabit = () => setOtwarteOkno({ rodzaj: "nawyk" });
  const onNewSleep = (date?: IsoDate) => setOtwarteOkno({ rodzaj: "sen", date: date ?? data.today });
  const zamknijOkno = (otwarte: boolean) => {
    if (!otwarte) setOtwarteOkno(null);
  };

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
          <SleepCard
            sleepLogs={data.sleepLogs}
            today={data.today}
            goalMin={data.sleepGoalMin}
            clock={data.clock}
            onOpenLast={(log) => onNewSleep(log.date)}
          />
        </div>

        <HabitHeatmap habits={data.habits} checks={checks} today={data.today} weekStart={data.weekStart} />
      </div>

      <HabitDialog
        open={otwarteOkno?.rodzaj === "nawyk"}
        onOpenChange={zamknijOkno}
        weekStart={data.weekStart}
        clock={data.clock}
        today={data.today}
      />
      {otwarteOkno?.rodzaj === "sen" && (
        <SleepDialog
          // Klucz wymusza świeży formularz przy każdym otwarciu na inną datę
          key={otwarteOkno.date}
          open
          onOpenChange={zamknijOkno}
          date={otwarteOkno.date}
          existing={data.sleepLogs.find((l) => l.date === otwarteOkno.date)}
          logs={data.sleepLogs}
          goalMin={data.sleepGoalMin}
          clock={data.clock}
          weekStart={data.weekStart}
          today={data.today}
        />
      )}
    </div>
  );
}
