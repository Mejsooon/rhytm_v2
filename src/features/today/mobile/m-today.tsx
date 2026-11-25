"use client";

// Ekran Dziś na telefonie wg CMToday.dc.html (wariant F, jak web): przezroczysty nagłówek z datą,
// szukaniem i awatarem, karta „Ten tydzień” (4 paski), „Nawyki na dziś” jako kafelki, „Plan dnia”
// na całą dobę z przerwami oraz pływający „+” (szybkie dodawanie). Pusty dzień wg CMEmptyToday.
// Stuknięcie bloku otwiera jego szczegóły (arkusz z kalendarza), a z nich edycję i usuwanie.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Flame, Plus, Search } from "lucide-react";

import { Avatar, Button, Card, StatusBadge } from "@/components/controls";
import type { BlockDialogInitial } from "@/features/calendar/block-dialog";
import { DeleteBlockDialog } from "@/features/calendar/delete-block-dialog";
import { MBlockDetail } from "@/features/calendar/mobile/m-block-detail";
import { MBlockSheet } from "@/features/calendar/mobile/m-block-sheet";
import {
  DNI_PELNE,
  DNI_SKROT,
  MIESIACE_DOP,
} from "@/features/calendar/mobile/pl";
import type { Occurrence } from "@/features/calendar/occurrences";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
import { sportItemHref } from "@/features/sport/model";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import type { TodayData } from "../load-today";
import {
  blocksCountLabel,
  dayPlan,
  dayPlanRows,
  nowItem,
  todayHabits,
  weekBars,
} from "../model";
import type { TodayChange } from "../use-today-store";

// Otwarte okno nad ekranem: szczegóły bloku (klucz wystąpienia), arkusz bloku albo potwierdzenie usunięcia
type Okno =
  | { typ: "szczegoly"; key: string }
  | { typ: "blok"; mode: "create" | "edit"; initial: BlockDialogInitial }
  | { typ: "usun"; occurrence: Occurrence };

export function MToday({
  data,
  nowMin: teraz,
  name,
  avatarUrl,
  applyOptimistic,
  onToggleHabit,
  onQuickAdd,
  onNewHabit,
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
  // „Utwórz nowy nawyk” w pustym dniu: rodzic otwiera okno nowego nawyku
  onNewHabit: () => void;
}) {
  const router = useRouter();
  const { today, profile } = data;
  const { clock } = profile;

  const [okno, setOkno] = useState<Okno | null>(null);

  const godz = (minuty: number) =>
    formatClockTime(Math.floor(minuty / 60), minuty % 60, clock);

  // „Wtorek · 17 listopada”
  const [, miesiac, dzienMiesiaca] = today.split("-").map(Number);
  const etykieta = `${DNI_PELNE[weekdayOf(today)]} · ${dzienMiesiaca} ${MIESIACE_DOP[miesiac - 1]}`;
  // Inicjał: pierwsza litera nazwy, wielka (jak w sidebarze)
  const inicjal = (Array.from(name.trim())[0] ?? "?").toLocaleUpperCase("pl");

  // Zakres tygodnia „pn 16 – nd 22.11”; przez granicę miesiąca: „pn 30.11 – nd 6.12”
  const koniecTygodnia = addDays(data.weekStartDate, 6);
  const [, mOd, dOd] = data.weekStartDate.split("-").map(Number);
  const [, mDo, dDo] = koniecTygodnia.split("-").map(Number);
  const zakres = `${DNI_SKROT[weekdayOf(data.weekStartDate)]} ${dOd}${mOd === mDo ? "" : `.${String(mOd).padStart(2, "0")}`} – ${DNI_SKROT[weekdayOf(koniecTygodnia)]} ${dDo}.${String(mDo).padStart(2, "0")}`;

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

  const nawyki = todayHabits({
    today,
    weekStart: profile.weekStart,
    habits: data.habits,
    checks: data.checks,
  });
  const odhaczoneNawyki = nawyki.filter((h) => h.done).length;

  const plan = dayPlan(
    data.occurrencesToday,
    data.categories,
    data.tasks,
    data.sportItems,
    today,
  );
  const wiersze = dayPlanRows(plan);
  const trwajacy = nowItem(plan, teraz);
  const wybrane =
    okno?.typ === "szczegoly"
      ? (plan.find((p) => p.key === okno.key)?.occurrence ?? null)
      : null;

  function otworzNowyBlok() {
    setOkno({
      typ: "blok",
      mode: "create",
      initial: {
        title: "",
        categoryId: null,
        date: today,
        // Najbliższa pełna godzina (najpóźniej 23:00), 60 min — jak „Nowy blok” na webie
        startMin: Math.min((Math.floor(teraz / 60) + 1) * 60, 23 * 60),
        durationMin: 60,
        recurrence: null,
        note: "",
        remind: true,
      },
    });
  }

  function edytuj(o: Occurrence) {
    // Oryginalna data wystąpienia siedzi w kluczu (blok mógł zostać przesunięty)
    const dataOryginalna = o.key.slice(o.blockId.length + 1);
    setOkno({
      typ: "blok",
      mode: "edit",
      initial: {
        title: o.title,
        categoryId: o.categoryId,
        date: o.date,
        startMin: o.startMin,
        durationMin: o.durationMin,
        recurrence: o.recurrence,
        note: o.note ?? "",
        remind: o.remind,
        blockId: o.blockId,
        occurrenceDate: dataOryginalna,
        // Start serii zawsze należy do serii, więc pierwsze wystąpienie ma datę startu bloku
        firstOccurrence:
          data.blocks
            .find((b) => b.id === o.blockId)
            ?.start_local.slice(0, 10) === dataOryginalna,
      },
    });
  }

  return (
    <div className="flex flex-1 flex-col bg-[#fafafa]">
      {/* Nagłówek: przezroczysty, bez ramki */}
      <header className="m-head border-b-0 bg-transparent pt-1">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground tabular-nums">
            {etykieta}
          </div>
          <h1 className="m-title">Dziś</h1>
        </div>
        <Link
          href="/szukaj"
          aria-label="Szukaj"
          className="inline-flex size-11 flex-none items-center justify-center rounded-md text-foreground hover:bg-muted"
        >
          <Search size={20} aria-hidden="true" />
        </Link>
        <Link
          href="/ustawienia"
          aria-label="Konto i ustawienia"
          className="inline-flex size-11 flex-none items-center justify-center rounded-md text-foreground hover:bg-muted"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- mały awatar z podpisanego URL
            <img
              src={avatarUrl}
              alt=""
              className="size-8 rounded-full object-cover shadow-[inset_0_0_0_1px_var(--border)]"
            />
          ) : (
            <Avatar initials={inicjal} />
          )}
        </Link>
      </header>

      {/* Dół: miejsce na pływający „+” nad dolnym paskiem */}
      <div className="flex flex-col gap-5 px-4 pt-3 pb-[120px]">
        {/* Ten tydzień */}
        <section aria-labelledby="m-tydzien" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2
              id="m-tydzien"
              className="m-0 text-base leading-[1.3] font-semibold"
            >
              Ten tydzień
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {zakres}
            </span>
          </div>
          <Card className="px-4 py-1">
            {paski.map((b) => (
              <div
                key={b.label}
                className="flex flex-col gap-1.5 border-t border-black/[.06] py-2.5 first:border-t-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{b.label}</span>
                  <span className="tabular-nums">
                    <b className="text-base font-semibold">{b.value}</b>
                    {b.unit && (
                      <>
                        {" "}
                        <span className="text-xs text-muted-foreground">
                          {b.unit}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={b.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={b.percent}
                  className="h-2 overflow-hidden rounded-full bg-black/[.06]"
                >
                  <span
                    className="block h-full rounded-full bg-foreground"
                    style={{ width: `${b.percent}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {b.right}
                </span>
              </div>
            ))}
          </Card>
        </section>

        {/* Nawyki na dziś: kafelki 2 w rzędzie; bez nawyków przerywany „Utwórz nowy nawyk” */}
        <section aria-labelledby="m-nawyki" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2
              id="m-nawyki"
              className="m-0 text-base leading-[1.3] font-semibold"
            >
              Nawyki na dziś
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {`${odhaczoneNawyki} / ${nawyki.length}`}
            </span>
          </div>
          {nawyki.length === 0 ? (
            <button
              type="button"
              onClick={onNewHabit}
              className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-white text-sm font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid outline-none"
            >
              <Plus size={16} aria-hidden="true" />
              Utwórz nowy nawyk
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {nawyki.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  aria-pressed={h.done}
                  onClick={() => onToggleHabit(h.id)}
                  // Odhaczony: ramka rgba(0,0,0,.24), tło rgba(0,0,0,.02)
                  className={`box-border flex min-h-[72px] cursor-pointer flex-col items-start gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid outline-none border px-3.5 py-3 text-left text-sm text-foreground shadow-[0_1px_2px_rgba(0,0,0,.04)] ${h.done ? "border-black/[.24] bg-black/[.02]" : "border-black/10 bg-white"}`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">
                      {h.name}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`box-border grid size-[18px] shrink-0 place-items-center rounded-sm border-[1.5px] ${h.done ? "border-foreground bg-foreground text-[#fafafa]" : "border-black/30"}`}
                    >
                      {h.done && <Check size={14} strokeWidth={2.5} />}
                    </span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs tabular-nums ${h.hot ? "text-[#c2410c]" : "text-muted-foreground"}`}
                  >
                    {h.streak.value >= 1 && (
                      <Flame size={14} aria-hidden="true" />
                    )}
                    {h.streakLabel}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Plan dnia: doba z przerwami; pusty dzień jako karta z zachętą */}
        <section aria-labelledby="m-plan" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2
              id="m-plan"
              className="m-0 text-base leading-[1.3] font-semibold"
            >
              Plan dnia
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {`00:00–24:00 · ${blocksCountLabel(plan.length)}`}
            </span>
          </div>
          {plan.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-md border border-border bg-white text-muted-foreground shadow-xs"
                >
                  <CalendarDays size={20} />
                </span>
                <p className="m-0 text-sm text-muted-foreground">
                  Nie masz jeszcze bloków na dziś.
                </p>
                <span className="text-xs text-muted-foreground tabular-nums">
                  00:00–24:00 · 24 h wolne
                </span>
                <Button
                  variant="primary"
                  className="mt-1.5"
                  onClick={otworzNowyBlok}
                >
                  Dodaj pierwszy blok
                </Button>
              </div>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-lg border-[1.5px] border-black/[.14] bg-white px-3 pt-1.5 pb-0.5 leading-[normal]">
              {wiersze.map((w) => {
                if (w.type === "gap") {
                  return (
                    <div
                      key={`gap-${w.startMin}`}
                      className={`grid grid-cols-[48px_1fr] border-t border-black/[.06] first:border-t-0 ${w.big ? "min-h-[72px] items-stretch" : "min-h-[30px] items-center"}`}
                    >
                      <span
                        className={`text-xs text-muted-foreground tabular-nums ${w.big ? "pt-2" : ""}`}
                      >
                        {godz(w.startMin)}
                      </span>
                      <span className="flex items-center gap-2 self-center text-xs text-muted-foreground tabular-nums before:flex-1 before:border-t before:border-dashed before:border-black/[.14] before:content-[''] after:flex-1 after:border-t after:border-dashed after:border-black/[.14] after:content-['']">
                        {w.label}
                      </span>
                    </div>
                  );
                }

                const p = w.item;
                const trwa = trwajacy?.key === p.key;
                // Odznaka po prawej: trening „plan”/„zrobione”, blok „x/y” zadań (bez zadań — brak)
                const odznaka =
                  p.kind !== "block"
                    ? p.planned
                      ? "plan"
                      : "zrobione"
                    : p.tasksTotal > 0
                      ? `${p.tasksDone}/${p.tasksTotal}`
                      : "";
                // Tło kolor+12, ramka kolor+4d; trwający blok dostaje pierścień
                const styl: React.CSSProperties = {
                  background: `${p.color}12`,
                  border: `1px solid ${p.color}4d`,
                  boxShadow: trwa
                    ? `0 0 0 2px #fff, 0 0 0 3px ${p.color}59`
                    : undefined,
                };
                const tresc = (
                  <>
                    <span className="min-w-0">
                      <b className="font-medium">{p.title}</b>
                      {trwa && (
                        <>
                          {" "}
                          <StatusBadge tone="green">Teraz</StatusBadge>
                        </>
                      )}
                      <br />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {`${godz(p.startMin)}–${godz(p.endMin)} · ${p.categoryName ?? "Bez kategorii"}`}
                      </span>
                    </span>
                    {odznaka && (
                      <StatusBadge
                        tone="gray"
                        className="shrink-0 tabular-nums"
                      >
                        {odznaka}
                      </StatusBadge>
                    )}
                  </>
                );
                const klasy =
                  "my-1 box-border flex min-h-11 w-full items-start justify-between gap-2 rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid outline-none px-2.5 py-2 text-left text-[13px] text-foreground no-underline";
                return (
                  <div
                    key={p.key}
                    className="grid min-h-12 grid-cols-[48px_1fr] border-t border-black/[.06] first:border-t-0"
                  >
                    <span className="pt-2 text-xs text-muted-foreground tabular-nums">
                      {godz(p.startMin)}
                    </span>
                    <div className="min-w-0">
                      {p.kind !== "block" ? (
                        // Trening: tylko do odczytu, prowadzi do podglądu na /sport
                        <Link
                          href={sportItemHref({ date: today, key: p.key })}
                          className={klasy}
                          style={styl}
                        >
                          {tresc}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setOkno({ typ: "szczegoly", key: p.key })
                          }
                          className={`${klasy} cursor-pointer`}
                          style={styl}
                        >
                          {tresc}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Ostatni, pusty wiersz 23:00 — pomijany, gdy coś startuje o 23:00 lub później */}
              {!wiersze.some(
                (w) =>
                  (w.type === "gap" ? w.startMin : w.item.startMin) >= 23 * 60,
              ) && (
                <div
                  aria-hidden="true"
                  className="grid min-h-10 grid-cols-[48px_1fr] border-t border-black/[.06]"
                >
                  <span className="pt-2 text-xs text-muted-foreground tabular-nums">
                    {godz(23 * 60)}
                  </span>
                  <div />
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <button
        type="button"
        aria-label="Szybko dodaj"
        onClick={onQuickAdd}
        className="m-fab"
      >
        <Plus size={24} aria-hidden="true" />
      </button>

      {wybrane && (
        <MBlockDetail
          occurrence={wybrane}
          tasks={data.tasks}
          category={data.categories.find((k) => k.id === wybrane.categoryId)}
          clock={clock}
          applyOptimistic={applyOptimistic}
          onEdit={() => edytuj(wybrane)}
          onDelete={() => setOkno({ typ: "usun", occurrence: wybrane })}
          onClose={() => setOkno(null)}
        />
      )}
      {okno?.typ === "blok" && (
        <MBlockSheet
          key={`${okno.initial.blockId ?? "nowy"}:${okno.initial.occurrenceDate ?? okno.initial.date}`}
          mode={okno.mode}
          initial={okno.initial}
          categories={data.categories}
          clock={clock}
          weekStart={profile.weekStart}
          today={today}
          tasks={data.tasks}
          applyOptimistic={applyOptimistic}
          onDone={() => {
            setOkno(null);
            // Akcje bloku odświeżają tylko /kalendarz, więc Dziś pobiera dane sam
            router.refresh();
          }}
        />
      )}
      {okno?.typ === "usun" && (
        <DeleteBlockDialog
          occurrence={okno.occurrence}
          clock={clock}
          onDeleted={() => {
            setOkno(null);
            router.refresh();
          }}
          onCancel={() => setOkno(null)}
        />
      )}
    </div>
  );
}
