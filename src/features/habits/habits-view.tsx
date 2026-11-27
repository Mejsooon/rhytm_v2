"use client";

// Ekran „Nawyki i sen” na komputerze (CHabits.dc.html): nagłówek, kafelki, karta Nawyki + karta Sen, heatmapa.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/controls";
import { ModuleHeader } from "@/components/shell/module-header";
import type { IsoDate } from "@/components/controls/calendar-math";
import { weekdayOf } from "@/features/calendar/view-range";
import { setHabitArchived } from "./actions";
import { DeleteHabitDialog } from "./delete-habit-dialog";
import { HabitDialog } from "./habit-dialog";
import { HabitHeatmap } from "./habit-heatmap";
import { HabitWeekGrid } from "./habit-week-grid";
import type { HabitsPageData } from "./load-habits";
import { MHabitSheet } from "./mobile/m-habit-sheet";
import { MHabits } from "./mobile/m-habits";
import { MSleepSheet } from "./mobile/m-sleep-sheet";
import { SleepCard } from "./sleep-card";
import { archivedSince, dayStats } from "./model";
import { sleepMinutes } from "./sleep";
import { SleepDialog } from "./sleep-dialog";
import { formatDuration } from "./text";
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

const MIESIACE = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

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

  // Nawyki z archiwum znikają z list, ale ich historia zostaje w heatmapie
  const aktywne = data.habits.filter((h) => archivedSince(h, data.today) === null);
  const wArchiwum = data.habits.length - aktywne.length;
  const [edytowany, setEdytowany] = useState<string | null>(null);
  const [usuwany, setUsuwany] = useState<{ id: string; name: string } | null>(null);

  async function archiwizuj(id: string, name: string) {
    const wynik = await setHabitArchived(id, true).catch(() => null);
    if (!wynik?.ok) {
      toast.error(wynik?.message ?? "Nie udało się zapisać. Spróbuj ponownie.");
      return;
    }
    toast.success(`Zarchiwizowano „${name}”. Historia zostaje.`, {
      action: { label: "Cofnij", onClick: () => void setHabitArchived(id, false) },
    });
  }

  // „Wtorek, 17 listopada · 3 z 8 nawyków zrobione dziś · ostatnia noc 7:12 snu”
  const dzis = dayStats(aktywne, checks, data.today, data.today);
  const noc = [...data.sleepLogs].reverse().find((l) => l.date <= data.today);
  const minutyNocy = noc ? sleepMinutes(noc.sleptAt, noc.wokeAt) : null;
  const dzien = DNI_TYGODNIA[weekdayOf(data.today) - 1];
  const [, miesiac, dm] = data.today.split("-").map(Number);
  const podtytul = [
    `${dzien[0].toUpperCase()}${dzien.slice(1)}, ${dm} ${MIESIACE[miesiac - 1]}`,
    `${dzis.done} z ${dzis.planned} nawyków zrobione dziś`,
    ...(minutyNocy === null ? [] : [`ostatnia noc ${formatDuration(minutyNocy)} snu`]),
  ].join(" · ");
  const noweKonto = data.habits.length === 0 && data.sleepLogs.length === 0;

  // Oba układy są w DOM; przełącza je wyłącznie CSS (800 px)
  return (
    <>
      <div
        data-testid="m-nawyki"
        className="flex min-w-0 flex-col min-[800px]:hidden"
      >
        <MHabits
          data={{ ...data, habits: aktywne }}
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
        {/* .topbar z CHabits: sam tytuł, data jako .hint, akcje .btn i .btnp (32 px) */}
        <ModuleHeader
          title="Nawyki i sen"
          webOnly
          webAction={
            <>
              {wArchiwum > 0 && (
                <Button variant="ghost" asChild>
                  <Link href="/nawyki/archiwum">{`Archiwum (${wArchiwum})`}</Link>
                </Button>
              )}
              {/* Ikona księżyca zamiast „+”; nazwa dostępna zostaje „+ Wpis snu” (e2e, testy) */}
              <Button aria-label="+ Wpis snu" onClick={() => onNewSleep()}>
                <Moon size={16} aria-hidden="true" />
                Wpis snu
              </Button>
              <Button variant="primary" onClick={() => onNewHabit()}>
                <Plus size={16} aria-hidden="true" />
                Nowy nawyk
              </Button>
            </>
          }
        />

        {noweKonto ? (
          <HabitsEmpty onNewHabit={() => onNewHabit()} onNewSleep={() => onNewSleep()} />
        ) : (
          <div className="box-border flex w-full flex-col gap-6 p-6">
            {/* Tytuł „Nawyki i sen” jest w nagłówku modułu */}
            <p className="m-0 text-muted-foreground tabular-nums">{podtytul}</p>

            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch gap-6">
              <HabitWeekGrid
                habits={aktywne}
                checks={checks}
                progress={data.progress ?? []}
                today={data.today}
                weekStart={data.weekStart}
                onToggle={(habitId, date) => void toggle(habitId, date)}
                onNewHabit={() => onNewHabit()}
                onEdit={setEdytowany}
                onArchive={(h) => void archiwizuj(h.id, h.name)}
                onDelete={setUsuwany}
              />
              <SleepCard
                sleepLogs={data.sleepLogs}
                today={data.today}
                goalMin={data.sleepGoalMin}
                bedtime={data.sleepBedtime ?? "23:00"}
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
        )}
      </div>

      {edytowany && (
        <HabitDialog
          open
          onOpenChange={(o) => !o && setEdytowany(null)}
          habit={data.habits.find((h) => h.id === edytowany)}
          weekStart={data.weekStart}
          clock={data.clock}
          today={data.today}
        />
      )}
      {usuwany && (
        <DeleteHabitDialog
          habitId={usuwany.id}
          name={usuwany.name}
          open
          onOpenChange={(o) => !o && setUsuwany(null)}
          onDeleted={() => setUsuwany(null)}
        />
      )}

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

// Nowe konto (S2HabitsEmpty)
function HabitsEmpty({
  onNewHabit,
  onNewSleep,
}: {
  onNewHabit: () => void;
  onNewSleep: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center gap-4 px-6 py-16 text-center">
      <h2 className="m-0 text-xl font-semibold">Dodaj pierwszy nawyk albo wpis snu</h2>
      <p className="m-0 text-muted-foreground">
        Nawyki odhaczasz na ekranie Dziś. Sen zapisujesz rano — wystarczą godziny zaśnięcia i wstania.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={onNewHabit}>
          Nowy nawyk
        </Button>
        <Button onClick={onNewSleep}>Zapisz sen</Button>
      </div>
      <section aria-label="Co tu zobaczysz" className="mt-6 flex w-full flex-col gap-3 rounded-lg border border-dashed border-black/[.14] p-5 text-left">
        <span className="text-xs font-medium text-muted-foreground">Co tu zobaczysz</span>
        {[
          ["Heatmapa nawyków", "Dni z celem w kalendarzu 30 dni, 3 mies., 6 mies. i roku"],
          ["Sen", "Średnia długość, regularność i noce z celem"],
          ["Przypomnienia", "Push o wybranej godzinie, w dni, w które nawyk obowiązuje"],
        ].map(([t, o]) => (
          <div key={t}>
            <b className="font-medium">{t}</b>
            <p className="m-0 text-muted-foreground">{o}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
