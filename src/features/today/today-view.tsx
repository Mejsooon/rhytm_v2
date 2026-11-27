"use client";

// Ekran Dziś (S2Today web).
// Web: nagłówek z „Nowy blok”, karta „Ten tydzień”, „Nawyki na dziś” i plan dnia.
// Telefon: MToday (makieta CMToday, wariant F). Oba drzewa są w DOM, przełącza je wyłącznie CSS (800 px).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  ActionPopover,
  Button,
  Kbd,
  MENU_ITEM,
  StatusBadge,
} from "@/components/controls";
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
import { SleepDialog } from "@/features/habits/sleep-dialog";
import { createGymSession } from "@/features/sport/actions";
import { activityKinds } from "@/features/sport/activities";
import { ActivityDialog } from "@/features/sport/activity-dialog";
import { RunDialog } from "@/features/sport/run-dialog";
import { DayPlan } from "./day-plan";
import { FirstSteps } from "./first-steps";
import type { TodayData } from "./load-today";
import { MQuickAdd } from "./mobile/m-quick-add";
import { MToday } from "./mobile/m-today";
import { isoWeekNumber, todayHabits, weekBars } from "./model";
import { QuickAddDialog } from "./quick-add-dialog";
import { TodayHabits } from "./today-habits";
import { useTodayStore } from "./use-today-store";
import { WeekCard } from "./week-card";

export function TodayView({
  data: daneSerwera,
  name,
  avatarUrl = null,
  openOnLoad = null,
}: {
  data: TodayData;
  name: string;
  // Podpisany adres zdjęcia profilu (awatar na telefonie); null → inicjał
  avatarUrl?: string | null;
  // ?szybko=blok (z ekranu Szukaj): od razu otwiera dodawanie bloku — arkusz szybkiego dodawania
  // na telefonie, okno „Nowy blok” na webie
  openOnLoad?: "blok" | null;
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
  // Menu „Więcej sposobów dodawania” i okno z niego otwarte
  const [menu, setMenu] = useState(false);
  const [okno, setOkno] = useState<"szybko" | "bieg" | "aktywnosc" | "sen" | null>(null);
  // Skrót Ctrl/⌘+Shift+K: „Szybko dodaj” (tylko web; na telefonie jest pływający „+”)
  useEffect(() => {
    const klawisz = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOkno("szybko");
      }
    };
    window.addEventListener("keydown", klawisz);
    return () => window.removeEventListener("keydown", klawisz);
  }, []);

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

  // Pusty trening od teraz: sesja i od razu dziennik siłowni (menu zamyka się przy kliknięciu,
  // więc nie ma jak kliknąć dwa razy)
  async function rozpocznijTrening() {
    const min = minutesNow(timezone);
    const start = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    const wynik = await createGymSession({ date: todayIso(timezone), start }).catch(() => null);
    if (wynik?.ok && wynik.id) router.push(`/sport/trening/${wynik.id}`);
    else toast.error("Nie udało się zapisać. Spróbuj ponownie.");
  }

  const pozycje: [string, () => void][] = [
    ["Szybko dodaj…", () => setOkno("szybko")],
    ["Zapisz bieg", () => setOkno("bieg")],
    ["Rozpocznij trening", () => void rozpocznijTrening()],
    ["Dodaj aktywność", () => setOkno("aktywnosc")],
    ["Zapisz sen", () => setOkno("sen")],
    ["Nowy nawyk", () => setNowyNawyk(true)],
  ];

  const przyciskNowyBlok = (
    // .btnp z S2Today: przycisk dzielony „Nowy blok” + strzałka z menu
    <div className="flex">
      <Button variant="primary" size="md" onClick={otworzNowyBlok} className="rounded-r-none">
        <Plus size={16} aria-hidden="true" />
        Nowy blok
      </Button>
      <ActionPopover
        open={menu}
        onOpenChange={setMenu}
        align="end"
        width={240}
        className="p-1"
        trigger={
          <Button variant="primary" size="md" icon aria-label="Więcej sposobów dodawania" className="rounded-l-none border-l-white/20">
            <ChevronDown size={16} aria-hidden="true" />
          </Button>
        }
      >
        {pozycje.map(([nazwa, akcja], i) => (
          <button
            key={nazwa}
            type="button"
            className={MENU_ITEM}
            onClick={() => {
              setMenu(false);
              akcja();
            }}
          >
            {nazwa}
            {i === 0 && <Kbd className="ml-auto">Ctrl⇧K</Kbd>}
          </button>
        ))}
      </ActionPopover>
    </div>
  );

  const profilSportu = {
    timezone,
    weekStart: profile.weekStart,
    clock: profile.clock,
    weightKg: profile.weightKg,
    workoutsGoalOn: profile.workoutsGoalOn,
    weeklyWorkoutsGoal: profile.weeklyWorkoutsGoal,
    kmGoalOn: profile.kmGoalOn,
    weeklyKmGoal: profile.weeklyKmGoal,
  };
  const zamknij = () => {
    setOkno(null);
    router.refresh();
  };
  // Domyślna godzina w oknach: teraz
  const godzinaTeraz = `${String(Math.floor(teraz / 60)).padStart(2, "0")}:${String(teraz % 60).padStart(2, "0")}`;

  // ?szybko=blok: otwieramy dodawanie (także gdy widok już działa), a potem czyścimy adres, żeby odświeżenie
  // ani „wstecz” nie otwierały go drugi raz. Wariant wybiera matchMedia dopiero w efekcie, po hydratacji,
  // więc HTML z serwera i pierwszy render klienta są takie same (nic nie jest jeszcze otwarte).
  useEffect(() => {
    if (!openOnLoad) return;
    const tel =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 799px)").matches;
    if (tel) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- otwarcie arkusza jest reakcją na parametr adresu
      setSzybkieDodawanie(true);
    } else {
      otworzNowyBlok();
    }
    router.replace("/dzis");
    // otworzNowyBlok czyta tylko strefę profilu i zawsze aktualny zegar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnLoad]);

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

  // Lista „Pierwsze kroki” i układ nowego konta (S2EmptyToday): lista widoczna i brak statystyk
  const listaKrokow =
    !data.firstSteps.hidden && !Object.values(data.firstSteps.done).every(Boolean);
  const noweKonto = listaKrokow && !data.hasStats;

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
        className="flex min-w-0 flex-1 flex-col bg-[#fafafa] min-[800px]:hidden"
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
              {!noweKonto && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {tydzien}
                </span>
              )}
            </>
          }
          webAction={
            noweKonto ? (
              <Button variant="primary" size="md" onClick={otworzNowyBlok}>
                <Plus size={16} aria-hidden="true" />
                Nowy blok
              </Button>
            ) : (
              przyciskNowyBlok
            )
          }
        />

        <div className="box-border flex w-full flex-col gap-6 p-6">
          {noweKonto && (
            <div>
              <h2 className="m-0 text-xl font-semibold">{`Cześć, ${name}`}</h2>
              <p className="m-0 mt-1 text-muted-foreground">
                Kilka kroków i „Dziś” zacznie pokazywać Twój tydzień.
              </p>
            </div>
          )}
          {/* Po ukryciu lista zostaje w drzewie, żeby pokazać pasek z „Pokaż” */}
          <FirstStepsSlot show={listaKrokow}>
            <FirstSteps
              done={data.firstSteps.done}
              onOpen={(krok) => {
                if (krok === "blok") otworzNowyBlok();
                else if (krok === "nawyk") setNowyNawyk(true);
                else setOkno("bieg");
              }}
            />
          </FirstStepsSlot>

          {/* 1. Cele tygodnia (4 paski) */}
          {data.hasStats ? (
            <WeekCard bars={paski} weekStartDate={data.weekStartDate} />
          ) : (
            <section aria-labelledby="ten-tydzien" className="flex flex-col gap-3">
              <h2 id="ten-tydzien" className="m-0 text-base leading-[1.3] font-semibold">
                Ten tydzień
              </h2>
              <div className="rounded-lg border border-dashed border-black/[.14] p-5">
                <b className="font-medium">Tu pojawią się Twoje statystyki</b>
                <p className="m-0 mt-1 text-muted-foreground">
                  Treningi, kilometry, nawyki i sen, z porównaniem do poprzedniego tygodnia.
                  Wystarczy pierwszy trening albo wpis snu.
                </p>
              </div>
            </section>
          )}

          {/* 2. Nawyki na dziś (kafelki z passą) */}
          {!(noweKonto && data.habits.length === 0) && (
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
          )}

          {/* 3. Plan dnia (lista w godzinach aktywnych) */}
          <DayPlan
            data={data}
            nowMin={teraz}
            applyOptimistic={applyOptimistic}
            onNewBlock={otworzNowyBlok}
          />
        </div>
      </div>

      {okno === "szybko" && (
        <QuickAddDialog
          today={today}
          nowMin={teraz}
          templates={data.templates}
          kinds={activityKinds(data.activityKinds)}
          sleepLogs={data.sleepLogs}
          onClose={() => setOkno(null)}
          onFullForm={(typ) => {
            setOkno(typ === "run" ? "bieg" : typ === "other" ? "aktywnosc" : typ === "sleep" ? "sen" : null);
            if (typ === "block") otworzNowyBlok();
            if (typ === "habit") setNowyNawyk(true);
            if (typ === "gym") void rozpocznijTrening();
          }}
        />
      )}
      {okno === "bieg" && (
        <RunDialog item={null} date={today} start={godzinaTeraz} profile={profilSportu} onClose={zamknij} />
      )}
      {okno === "aktywnosc" && (
        <ActivityDialog item={null} date={today} start={godzinaTeraz} profile={profilSportu} kinds={data.activityKinds} onClose={zamknij} onDelete={zamknij} />
      )}
      {okno === "sen" && (
        <SleepDialog
          open
          onOpenChange={(otwarte) => !otwarte && zamknij()}
          date={today}
          logs={data.sleepLogs}
          goalMin={profile.sleepGoalMin}
          clock={profile.clock}
          weekStart={profile.weekStart}
          today={today}
        />
      )}
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

// Raz pokazana lista zostaje zamontowana do odświeżenia strony (pasek „Pokaż” po ukryciu)
function FirstStepsSlot({ show, children }: { show: boolean; children: React.ReactNode }) {
  const [byla, setByla] = useState(show);
  if (show && !byla) setByla(true);
  return byla ? children : null;
}
