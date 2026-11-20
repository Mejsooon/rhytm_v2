"use client";

// Ekran Dziś na telefonie wg MToday.dc.html: nagłówek (szukaj, awatar), kafelki 2×2,
// karta „Teraz” z zadaniami trwającego bloku, „Plan dnia” jako lista, nawyki z odhaczaniem
// i serią, karta najbliższego biegu oraz pływający „+” (szybkie dodawanie, arkusz z Task 6).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronRight, Plus, Search } from "lucide-react";

import type { BlockDialogInitial } from "@/features/calendar/block-dialog";
import { MBlockSheet } from "@/features/calendar/mobile/m-block-sheet";
import {
  DNI_PELNE,
  DNI_SKROT,
  MIESIACE_DOP,
} from "@/features/calendar/mobile/pl";
import { weekdayOf } from "@/features/calendar/view-range";
import {
  canCheck,
  currentStreak,
  isPlanned,
  scheduleOn,
  weekProgress,
} from "@/features/habits/model";
import { formatDuration, streakLabel } from "@/features/habits/text";
import { formatKm, sportItemHref } from "@/features/sport/model";
import { toggleTask } from "@/features/tasks/actions";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import type { TodayData } from "../load-today";
import { dayPlan, nowItem, todayTiles, weekTiles } from "../model";
import type { TodayChange } from "../use-today-store";

const KARTA = "rounded-xl border border-border bg-white";
const ETYKIETA =
  "font-mono text-[11px] tracking-[.06em] text-muted-foreground uppercase";
const PRZYCISK_IKONA =
  "inline-flex size-11 flex-none items-center justify-center rounded-md text-foreground hover:bg-muted";
// Kwadrat 24 px, pole stuknięcia 44 px (pseudo-element)
const POLE_WYBORU =
  "relative inline-flex size-6 flex-none cursor-pointer items-center justify-center rounded-[7px] border-[1.5px] p-0 text-white outline-none after:absolute after:-inset-2.5 after:content-[''] focus-visible:shadow-focus disabled:cursor-default disabled:opacity-40";

export function MToday({
  data,
  nowMin: teraz,
  name,
  avatarUrl,
  applyOptimistic,
  onToggleHabit,
  onQuickAdd,
}: {
  // Dane z optymistycznymi zmianami (useTodayStore)
  data: TodayData;
  // Bieżąca minuta w strefie profilu (zegar co minutę w TodayView)
  nowMin: number;
  // Nazwa do inicjału awatara
  name: string;
  avatarUrl: string | null;
  applyOptimistic: (
    zmiana: TodayChange,
    akcja: () => Promise<ActionResult>,
  ) => Promise<boolean>;
  onToggleHabit: (habitId: string) => void;
  // Pływający „+”: rodzic otwiera arkusz szybkiego dodawania (MQuickAdd)
  onQuickAdd: () => void;
}) {
  const router = useRouter();
  const { today, profile } = data;
  const { clock } = profile;

  // Otwarty arkusz edycji bloku (z karty Teraz) albo null
  const [edycja, setEdycja] = useState<BlockDialogInitial | null>(null);

  const godz = (minuty: number) =>
    formatClockTime(Math.floor(minuty / 60), minuty % 60, clock);
  // 30 → „30 min”, 120 → „2 h”, 90 → „1 h 30 min”
  const czas = (minuty: number) => {
    const h = Math.floor(minuty / 60);
    const m = minuty % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  };

  // „Wtorek · 17 listopada”
  const [, miesiac, dzienMiesiaca] = today.split("-").map(Number);
  const etykieta = `${DNI_PELNE[weekdayOf(today)]} · ${dzienMiesiaca} ${MIESIACE_DOP[miesiac - 1]}`;
  // Inicjał: pierwsza litera nazwy, wielka (jak w sidebarze)
  const inicjal = (Array.from(name.trim())[0] ?? "?").toLocaleUpperCase("pl");

  const kafelki = todayTiles({
    today,
    weekStartDate: data.weekStartDate,
    habits: data.habits,
    checks: data.checks,
    sleepLogs: data.sleepLogs,
    tasks: data.tasks,
    sportItems: data.sportItems,
    kmGoalOn: profile.kmGoalOn,
    weeklyKmGoal: profile.weeklyKmGoal,
  });

  const plan = dayPlan(
    data.occurrencesToday,
    data.categories,
    data.tasks,
    data.sportItems,
    today,
  );
  const trwajacy = nowItem(plan, teraz);
  const wystapienie = trwajacy?.occurrence ?? null;
  // Zadania trwającego wystąpienia — przypięte do jego oryginalnej daty (z klucza)
  const dataOryginalna = wystapienie
    ? wystapienie.key.slice(wystapienie.blockId.length + 1)
    : null;
  const zadaniaTeraz = wystapienie
    ? data.tasks
        .filter(
          (t) =>
            t.block_id === wystapienie.blockId &&
            t.occurrence_date === dataOryginalna,
        )
        .sort((a, b) => a.position - b.position)
    : [];

  function przelaczZadanie(id: string, done: boolean) {
    void applyOptimistic(
      (d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === id ? { ...t, done } : t)),
      }),
      () => toggleTask({ id, done }),
    );
  }

  function edytujTrwajacy() {
    if (!wystapienie || !dataOryginalna) return;
    setEdycja({
      title: wystapienie.title,
      categoryId: wystapienie.categoryId,
      date: wystapienie.date,
      startMin: wystapienie.startMin,
      durationMin: wystapienie.durationMin,
      recurrence: wystapienie.recurrence,
      note: wystapienie.note ?? "",
      remind: wystapienie.remind,
      blockId: wystapienie.blockId,
      occurrenceDate: dataOryginalna,
      // Start serii zawsze należy do serii, więc pierwsze wystąpienie ma datę startu bloku
      firstOccurrence:
        data.blocks
          .find((b) => b.id === wystapienie.blockId)
          ?.start_local.slice(0, 10) === dataOryginalna,
    });
  }

  // Nawyki na liście: pokazywane na Dziś i zaplanowane dziś albo X/tydz. (kafelek liczy wszystkie)
  const nawyki = data.habits.filter((h) => {
    if (!h.showOnToday) return false;
    const wersja = scheduleOn(h, today);
    return (
      wersja !== null &&
      (wersja.type === "times_per_week" || isPlanned(h, today))
    );
  });

  // Najbliższy zaplanowany bieg od teraz w tym tygodniu (ta sama reguła co karta tygodnia na webie)
  const tydzien = weekTiles({
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
  const bieg = tydzien.run.nextRun;
  let tytulBiegu = "";
  let celBiegu: string | null = null;
  if (bieg) {
    // Dziś: „Bieg o 16:00”, później w tygodniu: „Bieg cz 18:00”; dystans po kropce
    tytulBiegu =
      bieg.date === today
        ? `Bieg o ${godz(bieg.startMin)}`
        : `Bieg ${DNI_SKROT[weekdayOf(bieg.date)]} ${godz(bieg.startMin)}`;
    if (bieg.distanceKm !== null)
      // Dystans jak w makiecie: całe bez „,0” („10 km”), inaczej z przecinkiem
      tytulBiegu += ` · ${String(Math.round(bieg.distanceKm * 10) / 10).replace(".", ",")} km`;
    if (kafelki.goalKm !== null) {
      const zostalo = kafelki.goalKm - kafelki.km;
      celBiegu =
        zostalo > 0
          ? `Cel tygodnia: jeszcze ${formatKm(zostalo)} km`
          : "Cel tygodnia osiągnięty";
    }
  }

  const kafelek = (
    href: string,
    tytul: string,
    wartosc: string,
    dopisek: string | null,
  ) => (
    <Link
      href={href}
      className="block bg-white px-3.5 py-3 text-foreground no-underline"
    >
      <div className={ETYKIETA}>{tytul}</div>
      <div className="mt-1 font-mono text-[22px] font-medium">
        {wartosc}
        {dopisek !== null && (
          <span className="text-sm text-muted-foreground">{dopisek}</span>
        )}
      </div>
    </Link>
  );

  return (
    <div className="flex flex-col">
      <header className="flex min-h-[60px] items-center gap-1 pt-2 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <div className={ETYKIETA}>{etykieta}</div>
          <h1 className="m-0 mt-0.5 text-[28px] font-semibold tracking-[-0.02em]">
            Dziś
          </h1>
        </div>
        <Link href="/szukaj" aria-label="Szukaj" className={PRZYCISK_IKONA}>
          <Search size={21} aria-hidden="true" />
        </Link>
        <Link
          href="/ustawienia/ogolne"
          aria-label="Konto i ustawienia"
          className={PRZYCISK_IKONA}
        >
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-input bg-active text-[13px] font-semibold">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- mały awatar z podpisanego URL
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              inicjal
            )}
          </span>
        </Link>
      </header>

      {/* Dół: miejsce na pływający „+” nad dolnym paskiem */}
      <div className="flex flex-col gap-4 px-4 pt-3 pb-[110px]">
        {/* Kafelki 2×2 */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {kafelek(
            "/nawyki",
            "Nawyki",
            String(kafelki.habitsDone),
            `/${kafelki.habitsTotal}`,
          )}
          {kafelek(
            "/nawyki?tab=sen",
            "Sen",
            kafelki.sleepMin === null ? "—" : formatDuration(kafelki.sleepMin),
            kafelki.sleepMin === null ? null : " h",
          )}
          {kafelek(
            "/kalendarz",
            "Zadania",
            String(kafelki.tasksDone),
            `/${kafelki.tasksTotal}`,
          )}
          {kafelek(
            "/sport",
            "Km w tyg.",
            formatKm(kafelki.km),
            kafelki.goalKm === null
              ? null
              : // Cel jak w makiecie: całe bez „,0” („/25”), inaczej z przecinkiem
                `/${String(Math.round(kafelki.goalKm * 10) / 10).replace(".", ",")}`,
          )}
        </div>

        {/* Teraz: tylko gdy trwa blok */}
        {trwajacy && wystapienie && (
          <section
            aria-labelledby="m-teraz"
            className="rounded-xl border border-success-border bg-success-soft"
          >
            <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-1.5">
              <span
                id="m-teraz"
                className="rounded-[5px] border border-success-border bg-white px-[7px] py-0.5 font-mono text-[11px] whitespace-nowrap text-success"
              >
                Teraz
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {`${godz(trwajacy.startMin)}–${godz(trwajacy.endMin)} · zostało ${trwajacy.endMin - teraz} min`}
              </span>
            </div>
            <button
              type="button"
              onClick={edytujTrwajacy}
              className="block min-h-11 w-full cursor-pointer border-0 bg-transparent px-3.5 pb-1 text-left text-lg font-semibold text-foreground outline-none focus-visible:shadow-focus-inset"
            >
              {trwajacy.title}
            </button>
            {zadaniaTeraz.length > 0 && (
              <div className="px-1.5 pt-1 pb-2">
                {zadaniaTeraz.map((t) => (
                  <div
                    key={t.id}
                    className="flex min-h-11 items-center gap-3 px-2"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={t.done}
                      aria-label={t.title}
                      onClick={() => przelaczZadanie(t.id, !t.done)}
                      className={cn(
                        POLE_WYBORU,
                        t.done
                          ? "border-success bg-success"
                          : "border-border-strong bg-white",
                      )}
                    >
                      {t.done && (
                        <CheckIcon
                          aria-hidden="true"
                          strokeWidth={3}
                          className="size-4"
                        />
                      )}
                    </button>
                    <span
                      className={cn(
                        "min-w-0",
                        t.done && "text-faint-foreground line-through",
                      )}
                    >
                      {t.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Plan dnia jako lista */}
        <section aria-labelledby="m-plan-dnia">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="m-plan-dnia" className="m-0 text-[17px] font-semibold">
              Plan dnia
            </h2>
            <Link
              href="/kalendarz?widok=dzien"
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground no-underline"
            >
              Kalendarz
            </Link>
          </div>
          {plan.length === 0 ? (
            <div className={cn(KARTA, "px-3.5 py-4 text-sm text-muted-foreground")}>
              Plan dnia jest pusty
            </div>
          ) : (
            <ul className={cn(KARTA, "m-0 list-none p-0")}>
              {plan.map((p) => {
                const zakonczony = p.endMin <= teraz;
                // „zrobione” (makieta) tylko dla zakończonego wpisu bez zadań albo z wszystkimi
                // zrobionymi; zaplanowany trening, który minął, nie jest zrobiony
                const zrobiony =
                  zakonczony && !p.planned && p.tasksDone === p.tasksTotal;
                const biezacy = p.key === trwajacy?.key;
                // Zrobiony: „30 min · zrobione”; inaczej „{czas} · {kategoria} · x/y”
                const opis = (
                  zrobiony
                    ? [czas(p.endMin - p.startMin), "zrobione"]
                    : [
                        czas(p.endMin - p.startMin),
                        p.categoryName,
                        p.tasksTotal > 0
                          ? `${p.tasksDone}/${p.tasksTotal}`
                          : null,
                      ]
                )
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={p.key}
                    className="border-b border-border last:border-b-0"
                  >
                    <Link
                      href={
                        p.sportKey
                          ? sportItemHref({ date: today, key: p.sportKey })
                          : "/kalendarz?widok=dzien"
                      }
                      className={cn(
                        "flex min-h-[60px] items-center gap-3 px-3.5 text-foreground no-underline",
                        biezacy && "bg-success-soft",
                      )}
                    >
                      <span
                        className={cn(
                          "w-11 flex-none font-mono text-xs",
                          biezacy
                            ? "font-medium text-success"
                            : "text-muted-foreground",
                        )}
                      >
                        {godz(p.startMin)}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-8 w-1 flex-none rounded-sm"
                        style={{ background: p.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block",
                            zakonczony
                              ? "text-faint-foreground line-through"
                              : "font-medium",
                          )}
                        >
                          {p.title}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-xs",
                            zakonczony ? "text-faint-foreground" : "text-muted-foreground",
                          )}
                        >
                          {opis}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Nawyki z odhaczaniem i serią */}
        <section aria-labelledby="m-nawyki-dzis">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="m-nawyki-dzis" className="m-0 text-[17px] font-semibold">
              Nawyki
            </h2>
            <Link
              href="/nawyki"
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground no-underline"
            >
              Wszystkie
            </Link>
          </div>
          {nawyki.length === 0 ? (
            <div className={cn(KARTA, "px-3.5 py-4 text-sm text-muted-foreground")}>
              Brak nawyków na dziś
            </div>
          ) : (
            <div className={KARTA}>
              {nawyki.map((h) => {
                const odhaczone = data.checks.get(h.id)?.has(today) ?? false;
                // Odznaczyć wolno zawsze, odhaczyć tylko gdy dziś się da
                const aktywny = canCheck(h, today, today) || odhaczone;
                // X/tydz.: postęp tygodnia „2/4 tydz.”, inne: seria; zero serii to „—” (makieta)
                const postep = weekProgress(
                  h,
                  data.checks,
                  today,
                  profile.weekStart,
                );
                const seria = currentStreak(
                  h,
                  data.checks,
                  today,
                  profile.weekStart,
                );
                const napis = postep
                  ? `${postep.done}/${postep.target} tydz.`
                  : seria.value === 0
                    ? "—"
                    : streakLabel(seria);
                return (
                  <div
                    key={h.id}
                    className="flex min-h-[52px] items-center gap-3 border-b border-border px-3.5 last:border-b-0"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={odhaczone}
                      aria-label={h.name}
                      disabled={!aktywny}
                      onClick={() => onToggleHabit(h.id)}
                      className={cn(
                        POLE_WYBORU,
                        odhaczone
                          ? "border-success bg-success"
                          : "border-border-strong bg-white",
                      )}
                    >
                      {odhaczone && (
                        <CheckIcon
                          aria-hidden="true"
                          strokeWidth={3}
                          className="size-4"
                        />
                      )}
                    </button>
                    <span className="min-w-0 flex-1">{h.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {napis}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Najbliższy bieg; bez planu karty nie ma */}
        {bieg && (
          <Link
            href="/sport"
            className={cn(
              KARTA,
              "flex items-center gap-3 p-3.5 text-foreground no-underline",
            )}
          >
            <span className="flex size-10 flex-none items-center justify-center rounded-md bg-warning-soft text-warning-foreground">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12h4l3-8 4 16 3-8h4" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{tytulBiegu}</span>
              {celBiegu && (
                <span className="text-[13px] text-muted-foreground">{celBiegu}</span>
              )}
            </span>
            <ChevronRight
              size={18}
              aria-hidden="true"
              className="flex-none text-faint-foreground"
            />
          </Link>
        )}
      </div>

      <button
        type="button"
        aria-label="Szybko dodaj"
        onClick={onQuickAdd}
        // 16 px nad dolnym paskiem (ta sama zmienna co wysokość paska)
        className="fixed right-4 bottom-[calc(var(--tabbar-h)+16px)] z-30 flex size-14 cursor-pointer items-center justify-center rounded-2xl border-0 bg-primary text-white shadow-[0_8px_20px_rgba(0,0,0,.18)]"
      >
        <Plus size={26} aria-hidden="true" />
      </button>

      {edycja && (
        <MBlockSheet
          key={`${edycja.blockId}:${edycja.occurrenceDate}`}
          mode="edit"
          initial={edycja}
          categories={data.categories}
          clock={clock}
          weekStart={profile.weekStart}
          today={today}
          tasks={data.tasks}
          applyOptimistic={applyOptimistic}
          onDone={() => {
            setEdycja(null);
            // Akcje bloku odświeżają tylko /kalendarz, więc Dziś pobiera dane sam
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
