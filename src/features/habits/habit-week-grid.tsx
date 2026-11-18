"use client";

// Karta „Nawyki”: wiersze nawyków z siatką bieżącego tygodnia i przyciskiem ✓ na dziś (Habits.dc.html, „RZĄD 2”)
import Link from "next/link";

import { Button } from "@/components/controls";
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

const KOMORKA = "size-6 rounded-[5px] box-border";

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
    <section className="flex flex-col rounded-lg border border-[#eaeaea] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#eaeaea] px-4 py-3.5">
        <h2 className="m-0 text-[15px] font-semibold">Nawyki</h2>
        {habits.length > 0 && (
          // Nagłówki kolumn nad siatką; margines = przycisk ✓ (34 px) + odstęp 14 px
          <div className="mr-12 grid grid-cols-[repeat(7,24px)] gap-1.5 text-center font-mono text-[10px] text-[#6b6b6b]">
            {dni.map((d) => (
              <span key={d}>{SKROTY_DNI[weekdayOf(d) - 1]}</span>
            ))}
          </div>
        )}
      </div>

      {habits.length === 0 ? (
        // Stan pusty w stylu makiet
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
          <p className="m-0 text-sm text-[#666666]">
            Nie masz jeszcze nawyków.
          </p>
          <Button variant="primary" size="sm" onClick={onNewHabit}>
            Dodaj pierwszy nawyk
          </Button>
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {habits.map((habit) => {
            // Opis harmonogramu: wersja na dziś, a gdy nawyk rusza dopiero później — pierwsza wersja
            const wersja = scheduleOn(habit, today) ?? habit.schedules[0];
            const postep = weekProgress(habit, checks, today, weekStart);
            const opis = [
              wersja ? describeSchedule(wersja) : "",
              `seria ${streakLabel(currentStreak(habit, checks, today, weekStart))}`,
              ...(postep ? [`${postep.done}/${postep.target}`] : []),
            ]
              .filter(Boolean)
              .join(" · ");
            const odhaczoneDzis = checks.get(habit.id)?.has(today) ?? false;
            // Odznaczyć wolno każdy dzień ≤ dziś, także osierocone odhaczenie
            const dzisAktywny = canCheck(habit, today, today) || odhaczoneDzis;

            return (
              <li
                key={habit.id}
                className="flex items-center gap-3.5 border-b border-[#f0f0f0] px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/nawyki/${habit.id}`}
                    className="font-medium text-[#171717] no-underline hover:text-black"
                  >
                    {habit.name}
                  </Link>
                  <div className="mt-[3px] font-mono text-[11px] text-[#6b6b6b]">
                    {opis}
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
                            "flex items-center justify-center text-xs text-[#6b6b6b]",
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
                          "cursor-pointer p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20 disabled:cursor-default",
                          odhaczone
                            ? "border-0 bg-[#15803d]"
                            : aktywna
                              ? "border-0 bg-[#f0f0f0] hover:bg-[#e5e5e5]"
                              : "border border-dashed border-[#e0e0e0] bg-white",
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
                    "size-[34px] flex-none cursor-pointer rounded-md border transition-colors duration-[120ms] disabled:cursor-default disabled:opacity-40",
                    odhaczoneDzis
                      ? "border-[#15803d] bg-[#15803d] text-white"
                      : "border-[#e0e0e0] bg-white text-[#6b6b6b]",
                  )}
                >
                  ✓
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex-1" />
      {/* Okno nowego nawyku powstanie w Task 5 */}
      <button
        type="button"
        onClick={onNewHabit}
        className="cursor-pointer border-0 bg-transparent px-4 py-3 text-left text-sm text-[#666666] hover:text-[#171717]"
      >
        + Nowy nawyk
      </button>
    </section>
  );
}
