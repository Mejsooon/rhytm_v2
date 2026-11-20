"use client";

// Szczegóły nawyku na komputerze (HabitDetail.dc.html): okruszek, kafelki, kalendarz, historia harmonogramu, notatki.
import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/controls";
import { formatDatePl } from "@/components/controls/calendar-math";
import { addDays } from "@/features/calendar/view-range";
import { formatClockTime } from "@/lib/time/timezones";
import { DeleteHabitDialog } from "./delete-habit-dialog";
import { HabitDialog } from "./habit-dialog";
import { HabitMonth } from "./habit-month";
import { HabitNotes } from "./habit-notes";
import type { HabitDetailData } from "./load-habits";
import { MHabitDetail } from "./mobile/m-habit-detail";
import {
  currentStreak,
  longestStreak,
  scheduleOn,
  successRate30,
  totalChecks,
  type Checks,
} from "./model";
import { describeSchedule, streakLabel } from "./text";

// „12 dni” → wartość „12” i jednostka „dni” (jednostka mniejszą czcionką jak „razy” w makiecie)
function wartoscSerii(seria: { value: number; unit: "days" | "weeks" }) {
  const [wartosc, ...jednostka] = streakLabel(seria).split(" ");
  return { wartosc, jednostka: jednostka.join(" ") };
}

export function HabitDetail({ data }: { data: HabitDetailData }) {
  const habit = data.habits[0];
  const [edycja, setEdycja] = useState(false);
  const [usuwanie, setUsuwanie] = useState(false);

  const dniOdhaczone = new Set(
    data.checks.filter((c) => c.habitId === habit.id).map((c) => c.date),
  );
  const checks: Checks = new Map([[habit.id, dniOdhaczone]]);

  const seria = wartoscSerii(
    currentStreak(habit, checks, data.today, data.weekStart),
  );
  const najdluzsza = wartoscSerii(
    longestStreak(habit, checks, data.today, data.weekStart),
  );
  const skutecznosc = successRate30(habit, checks, data.today);
  const lacznie = totalChecks(habit.id, checks);

  // Obowiązująca dziś wersja; gdy wszystkie są w przyszłości — pierwsza
  const biezaca = scheduleOn(habit, data.today) ?? habit.schedules[0];
  const pierwszaData = habit.schedules[0]?.validFrom;

  let podtytul = biezaca ? describeSchedule(biezaca) : "";
  if (habit.remindAt) {
    const [g, m] = habit.remindAt.split(":").map(Number);
    podtytul += ` · przypomnienie ${formatClockTime(g, m, data.clock)}`;
  }
  if (pierwszaData) podtytul += ` · od ${formatDatePl(pierwszaData)}`;

  const kafelki = [
    { etykieta: "Seria", wartosc: seria.wartosc, jednostka: seria.jednostka },
    {
      etykieta: "Najdłuższa seria",
      wartosc: najdluzsza.wartosc,
      jednostka: najdluzsza.jednostka,
    },
    {
      etykieta: "30 dni",
      wartosc: skutecznosc === null ? "—" : `${skutecznosc}%`,
      jednostka: "",
    },
    { etykieta: "Łącznie", wartosc: String(lacznie), jednostka: "razy" },
  ];

  // Historia: od najnowszej; zakres kończy się dzień przed początkiem następnej wersji
  const historia = [...habit.schedules]
    .reverse()
    .map((wersja, i, wszystkie) => {
      const nastepna = i === 0 ? null : wszystkie[i - 1];
      let zakres = `od ${formatDatePl(wersja.validFrom)}`;
      if (nastepna) {
        zakres = `${formatDatePl(wersja.validFrom).slice(0, 5)} – ${formatDatePl(addDays(nastepna.validFrom, -1))}`;
      }
      return {
        klucz: wersja.validFrom,
        zakres,
        opis: describeSchedule(wersja),
      };
    });

  // Oba układy są w DOM; przełącza je wyłącznie CSS (800 px). Telefon ma własne okna edycji i usuwania.
  return (
    <>
      <div data-testid="m-nawyk" className="min-[800px]:hidden">
        <MHabitDetail data={data} />
      </div>
      <div
        data-testid="web-nawyk"
        className="flex min-w-0 flex-col max-[799px]:hidden"
      >
        <header className="flex min-h-[34px] flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
          <div className="font-mono text-[13px] text-muted-foreground">
            <Link
              href="/nawyki"
              className="text-muted-foreground no-underline hover:text-foreground"
            >
              Nawyki i sen
            </Link>{" "}
            <span className="text-faint-foreground">/</span>{" "}
            <span className="text-foreground">{habit.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="border-destructive-border text-destructive-foreground hover:text-destructive-foreground"
              onClick={() => setUsuwanie(true)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
              </svg>
              Usuń
            </Button>
            <Button variant="primary" size="sm" onClick={() => setEdycja(true)}>
              Edytuj
            </Button>
          </div>
        </header>

        <div className="box-border flex w-full max-w-[1100px] flex-col gap-6 px-6 py-7">
          <div>
            <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">
              {habit.name}
            </h1>
            <p className="m-0 mt-1.5 font-mono text-xs text-muted-foreground">
              {podtytul}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-border bg-border">
            {kafelki.map((k) => (
              <div key={k.etykieta} className="bg-white px-[18px] py-4">
                <div className="font-mono text-[11px] tracking-[.06em] text-muted-foreground uppercase">
                  {k.etykieta}
                </div>
                <div className="mt-2 font-mono text-[26px]">
                  {k.wartosc}
                  {k.jednostka && (
                    <span className="ml-1 text-sm text-muted-foreground">
                      {k.jednostka}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-6">
            <div className="flex min-w-0 flex-col gap-6">
              <HabitMonth
                // Klucz resetuje widok po przejściu północy na nowy miesiąc
                key={data.today.slice(0, 7)}
                habit={habit}
                checks={dniOdhaczone}
                today={data.today}
                weekStart={data.weekStart}
                maxMonth={data.today.slice(0, 7)}
              />
              <HabitNotes habitId={habit.id} notes={data.notes} />
            </div>

            <section className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-4 py-3.5">
                <h2 className="m-0 text-[15px] font-semibold">
                  Historia harmonogramu
                </h2>
              </div>
              {historia.map((w) => (
                <div
                  key={w.klucz}
                  className="border-b border-border px-4 py-3 last:border-b-0"
                >
                  <div className="font-mono text-xs text-muted-foreground">
                    {w.zakres}
                  </div>
                  <div className="mt-0.5">{w.opis}</div>
                </div>
              ))}
              <p className="m-0 border-t border-border bg-panel px-4 py-3 font-mono text-[11px] text-muted-foreground">
                Zmiana harmonogramu nie przelicza przeszłych dni.
              </p>
            </section>
          </div>
        </div>

        <HabitDialog
          open={edycja}
          onOpenChange={setEdycja}
          habit={habit}
          weekStart={data.weekStart}
          clock={data.clock}
          today={data.today}
        />
        <DeleteHabitDialog
          habitId={habit.id}
          name={habit.name}
          open={usuwanie}
          onOpenChange={setUsuwanie}
        />
      </div>
    </>
  );
}
