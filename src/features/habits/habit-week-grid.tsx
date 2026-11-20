"use client";

// Karta „Nawyki”: wiersze nawyków z siatką bieżącego tygodnia i przyciskiem ✓ na dziś (CHabits.dc.html)
import Link from "next/link";
import { Check, Flame } from "lucide-react";

import {
  Button,
  CardHeader,
  CardTitle,
  StatusBadge,
} from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { viewRange, weekdayOf } from "@/features/calendar/view-range";
import { cn } from "@/lib/utils";
import {
  canCheck,
  currentStreak,
  isPlanned,
  scheduleOn,
  weekProgress,
  type Checks,
  type Habit,
} from "./model";
import { describeSchedule, streakLabel } from "./text";

// Skróty dni: indeks 0 = pn … 6 = nd
const SKROTY_DNI = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];

// Komórka dnia z makiety: 24 px, promień 6 px
const KOMORKA = "size-6 rounded-sm box-border";

export function HabitWeekGrid({
  habits,
  checks,
  today,
  weekStart,
  onToggle,
  onNewHabit,
}: {
  habits: Habit[];
  checks: Checks;
  today: IsoDate;
  weekStart: "mon" | "sun";
  onToggle: (habitId: string, date: IsoDate) => void;
  onNewHabit: () => void;
}) {
  // Bieżący tydzień od dnia z profilu, bez nawigacji
  const dni = viewRange("tydzien", today, weekStart).days;

  return (
    // .card jako <section> (te same klasy co Card)
    <section className="relative flex min-w-0 flex-col rounded-xl border border-border bg-white bg-clip-padding shadow-card">
      <CardHeader className="flex-wrap items-center pb-3">
        <CardTitle as="h2">Nawyki</CardTitle>
        {habits.length > 0 && (
          // Nagłówki kolumn nad siatką; margines = przycisk ✓ (32 px) + odstęp 14 px
          <div className="mr-[46px] grid grid-cols-[repeat(7,24px)] gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
            {dni.map((d) => (
              <span key={d}>{SKROTY_DNI[weekdayOf(d) - 1]}</span>
            ))}
          </div>
        )}
      </CardHeader>

      {habits.length === 0 ? (
        // Stan pusty w stylu makiet
        <div className="flex flex-1 flex-col items-center justify-center gap-3 border-t border-border px-6 py-12 text-center">
          <p className="m-0 text-sm text-muted-foreground">
            Nie masz jeszcze nawyków.
          </p>
          <Button variant="primary" size="sm" onClick={onNewHabit}>
            Dodaj pierwszy nawyk
          </Button>
        </div>
      ) : (
        <ul className="m-0 list-none border-t border-border p-0">
          {habits.map((habit) => {
            // Opis harmonogramu: wersja na dziś, a gdy nawyk rusza dopiero później — pierwsza wersja
            const wersja = scheduleOn(habit, today) ?? habit.schedules[0];
            const postep = weekProgress(habit, checks, today, weekStart);
            const seria = streakLabel(
              currentStreak(habit, checks, today, weekStart),
            );
            const odhaczoneDzis = checks.get(habit.id)?.has(today) ?? false;
            // Odznaczyć wolno każdy dzień ≤ dziś, także osierocone odhaczenie
            const dzisAktywny = canCheck(habit, today, today) || odhaczoneDzis;

            return (
              <li
                key={habit.id}
                className="flex items-center gap-3.5 border-b border-border-soft px-6 py-3"
              >
                <div className="min-w-0 flex-1">
                  {/* Długa nazwa skraca się wielokropkiem */}
                  <Link
                    href={`/nawyki/${habit.id}`}
                    className="inline-block max-w-full truncate align-top font-medium text-foreground no-underline outline-none hover:text-black focus-visible:rounded-sm focus-visible:shadow-focus"
                  >
                    {habit.name}
                  </Link>
                  {/* .hint z harmonogramem, seria w .bdg.sec z płomieniem, postęp X/tydz. */}
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {wersja && (
                      <span className="truncate">
                        {describeSchedule(wersja)}
                      </span>
                    )}
                    <StatusBadge tone="gray" className="flex-none tabular-nums">
                      <Flame size={11} aria-hidden="true" />
                      {/* Słowo „seria” zostaje dla czytników ekranu; na ekranie mówi to płomień */}
                      <span>
                        <span className="sr-only">seria </span>
                        {seria}
                      </span>
                    </StatusBadge>
                    {postep && (
                      <span className="flex-none tabular-nums">{`${postep.done}/${postep.target}`}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(7,24px)] gap-1.5">
                  {dni.map((d) => {
                    const odhaczone = checks.get(habit.id)?.has(d) ?? false;
                    const v = scheduleOn(habit, d);
                    const [, mm, dd] = d.split("-");
                    const nazwa = `${habit.name} · ${dd}.${mm}`;

                    // weekdays, dzień poza planem, bez odhaczenia: „–”, nie przycisk
                    if (
                      v !== null &&
                      v.type === "weekdays" &&
                      !isPlanned(habit, d) &&
                      !odhaczone
                    ) {
                      return (
                        <span
                          key={d}
                          title={`${dd}.${mm} · nie dotyczy`}
                          className={cn(
                            KOMORKA,
                            "flex items-center justify-center text-xs text-muted-foreground",
                          )}
                        >
                          –
                        </span>
                      );
                    }

                    const aktywna =
                      d <= today && (canCheck(habit, d, today) || odhaczone);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-label={`${nazwa}: ${odhaczone ? "zrobione" : "nie zrobione"}`}
                        aria-pressed={odhaczone}
                        disabled={!aktywna}
                        onClick={() => onToggle(habit.id, d)}
                        className={cn(
                          KOMORKA,
                          "cursor-pointer p-0 outline-none focus-visible:shadow-focus disabled:cursor-default",
                          // zrobione → zielony, do odhaczenia → szary, jeszcze nie / poza zakresem → przerywana ramka
                          odhaczone
                            ? "border-0 bg-success"
                            : aktywna
                              ? "border-0 bg-active hover:bg-input"
                              : "border border-dashed border-input bg-white",
                        )}
                      />
                    );
                  })}
                </div>

                <button
                  type="button"
                  aria-label={
                    odhaczoneDzis
                      ? `Cofnij odhaczenie: ${habit.name}`
                      : `Odhacz dziś: ${habit.name}`
                  }
                  aria-pressed={odhaczoneDzis}
                  disabled={!dzisAktywny}
                  onClick={() => onToggle(habit.id, today)}
                  className={cn(
                    "grid size-8 flex-none cursor-pointer place-items-center rounded-md border p-0 transition-colors duration-[120ms] outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-[.64]",
                    odhaczoneDzis
                      ? "border-success bg-success text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_1px_2px_rgba(21,128,61,.3)]"
                      : "border-input bg-white text-faint-foreground shadow-xs hover:text-muted-foreground",
                  )}
                >
                  <Check size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex-1" />
      {/* .btng sm w stopce karty, tekst szary */}
      <div className="px-4 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewHabit}
          className="text-muted-foreground"
        >
          + Nowy nawyk
        </Button>
      </div>
    </section>
  );
}
