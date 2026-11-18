"use client";

// Ekran „Nawyki i sen” na komputerze (Habits.dc.html): nagłówek, kafelki, karta Nawyki + karta Sen, heatmapa.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/controls";
import { formatDatePl } from "@/components/controls/calendar-math";
import type { IsoDate } from "@/components/controls/calendar-math";
import { weekdayOf } from "@/features/calendar/view-range";
import { HabitDialog } from "./habit-dialog";
import { HabitHeatmap } from "./habit-heatmap";
import { HabitTiles } from "./habit-tiles";
import { HabitWeekGrid } from "./habit-week-grid";
import type { HabitsPageData } from "./load-habits";
import { MHabitSheet } from "./mobile/m-habit-sheet";
import { MHabits } from "./mobile/m-habits";
import { MSleepSheet } from "./mobile/m-sleep-sheet";
import { SleepCard } from "./sleep-card";
import { SleepDialog } from "./sleep-dialog";
import { useHabitsStore } from "./use-habits-store";

// Indeks 0 = poniedziałek
const DNI_TYGODNIA = [
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
];

export function HabitsView({
  data,
  initialTab,
  openOnLoad,
}: {
  data: HabitsPageData;
  // Zakładka „sen” (?tab=sen) — liczy się na telefonie; web pokazuje wszystko naraz
  initialTab: "sen" | null;
  // Okno do otwarcia od razu (?nowy=nawyk|sen); „sen” otwiera wpis na dziś
  openOnLoad: "nawyk" | "sen" | null;
}) {
  const { checks, toggle } = useHabitsStore(data);

  // Otwarte okno: nowy nawyk albo wpis snu z datą pobudki (okno samo znajdzie wpis z tego dnia).
  // `tel`: otwarte na telefonie, więc zamiast okna web pokazuje się pełnoekranowy arkusz
  // (jak MBlockSheet w kalendarzu). Zawsze montowany jest tylko jeden wariant — bez dwóch pułapek fokusu.
  const [otwarteOkno, setOtwarteOkno] = useState<
    | { rodzaj: "nawyk"; tel: boolean }
    | { rodzaj: "sen"; date: IsoDate; tel: boolean }
    | null
  >(null);
  const { replace } = useRouter();

  // ?nowy=nawyk|sen: otwieramy okno (także gdy widok już działa), a potem czyścimy adres,
  // żeby odświeżenie ani „wstecz” nie otwierały go drugi raz; pozostałe parametry (tab) zostają.
  // Wariant (arkusz czy okno) wybiera matchMedia — dopiero w efekcie, po hydratacji, więc HTML
  // z serwera i pierwszy render klienta są takie same (okno jest wtedy jeszcze zamknięte).
  useEffect(() => {
    if (!openOnLoad) return;
    const tel =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 799px)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- otwarcie okna jest reakcją na parametr adresu
    setOtwarteOkno(
      openOnLoad === "nawyk"
        ? { rodzaj: "nawyk", tel }
        : { rodzaj: "sen", date: data.today, tel },
    );
    replace(initialTab ? `/nawyki?tab=${initialTab}` : "/nawyki");
  }, [openOnLoad, initialTab, data.today, replace]);
  // Przyciski web otwierają okna, przyciski telefonu (tel = true) — arkusze
  const onNewHabit = (tel = false) => setOtwarteOkno({ rodzaj: "nawyk", tel });
  const onNewSleep = (date?: IsoDate, tel = false) =>
    setOtwarteOkno({ rodzaj: "sen", date: date ?? data.today, tel });
  const zamknijOkno = (otwarte: boolean) => {
    if (!otwarte) setOtwarteOkno(null);
  };

  const dataNaglowka = `${DNI_TYGODNIA[weekdayOf(data.today) - 1]} · ${formatDatePl(data.today)}`;

  // Oba układy są w DOM; przełącza je wyłącznie CSS (800 px)
  return (
    <>
      <div
        data-testid="m-nawyki"
        className="flex min-w-0 flex-col min-[800px]:hidden"
      >
        <MHabits
          data={data}
          checks={checks}
          initialTab={initialTab}
          onToggle={(habitId, date) => void toggle(habitId, date)}
          onNewHabit={() => onNewHabit(true)}
          onNewSleep={(date) => onNewSleep(date, true)}
        />
      </div>
      <div
        data-testid="web-nawyki"
        className="flex min-w-0 flex-col max-[799px]:hidden"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaeaea] px-6 py-3">
          <div className="flex items-baseline gap-2.5">
            <h1 className="m-0 text-lg font-semibold">Nawyki i sen</h1>
            <span className="font-mono text-xs text-[#6b6b6b]">
              {dataNaglowka}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onNewSleep()}>
              + Wpis snu
            </Button>
            <Button variant="primary" size="sm" onClick={() => onNewHabit()}>
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
              onNewHabit={() => onNewHabit()}
            />
            <SleepCard
              sleepLogs={data.sleepLogs}
              today={data.today}
              goalMin={data.sleepGoalMin}
              clock={data.clock}
              onOpenLast={(log) => onNewSleep(log.date)}
            />
          </div>

          <HabitHeatmap
            habits={data.habits}
            checks={checks}
            today={data.today}
            weekStart={data.weekStart}
          />
        </div>
      </div>

      {otwarteOkno?.rodzaj === "nawyk" && otwarteOkno.tel && (
        <MHabitSheet
          weekStart={data.weekStart}
          clock={data.clock}
          today={data.today}
          onDone={() => setOtwarteOkno(null)}
        />
      )}
      <HabitDialog
        open={otwarteOkno?.rodzaj === "nawyk" && !otwarteOkno.tel}
        onOpenChange={zamknijOkno}
        weekStart={data.weekStart}
        clock={data.clock}
        today={data.today}
      />
      {otwarteOkno?.rodzaj === "sen" && otwarteOkno.tel && (
        <MSleepSheet
          key={otwarteOkno.date}
          date={otwarteOkno.date}
          logs={data.sleepLogs}
          goalMin={data.sleepGoalMin}
          clock={data.clock}
          onDone={() => setOtwarteOkno(null)}
        />
      )}
      {otwarteOkno?.rodzaj === "sen" && !otwarteOkno.tel && (
        <SleepDialog
          // Klucz wymusza świeży formularz przy każdym otwarciu na inną datę
          key={otwarteOkno.date}
          open
          onOpenChange={zamknijOkno}
          date={otwarteOkno.date}
          logs={data.sleepLogs}
          goalMin={data.sleepGoalMin}
          clock={data.clock}
          weekStart={data.weekStart}
          today={data.today}
        />
      )}
    </>
  );
}
