"use client";

// Szczegóły nawyku na komputerze (CHabitDetail.dc.html): okruszki, kafelki, kalendarz, historia harmonogramu, notatki.
import { useState } from "react";
import Link from "next/link";
import {
  BellIcon,
  CalendarIcon,
  InfoIcon,
  PenLineIcon,
  TrashIcon,
} from "lucide-react";

import { SidebarToggle } from "@/components/shell/sidebar-toggle";
import {
  Button,
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
  StatusBadge,
} from "@/components/controls";
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

  // Podtytuł jako odznaki: harmonogram, przypomnienie (gdy włączone), „od” pierwszej wersji
  const harmonogram = biezaca ? describeSchedule(biezaca) : "";
  let przypomnienie: string | null = null;
  if (habit.remindAt) {
    const [g, m] = habit.remindAt.split(":").map(Number);
    przypomnienie = `przypomnienie ${formatClockTime(g, m, data.clock)}`;
  }

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
        aktualna: wersja.validFrom === biezaca?.validFrom,
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
        {/* .topbar z coss.css: okruszki .crumb (rodzic jako link, nazwa skracana wielokropkiem) i akcje */}
        <header className="box-content flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-2.5">
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            {/* Przy schowanym pasku: przycisk „Pokaż pasek boczny” przed okruszkami */}
            <SidebarToggle placement="header" />
            <Link
              href="/nawyki"
              className="flex-none rounded-sm text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:shadow-focus"
            >
              Nawyki i sen
            </Link>{" "}
            <span>/</span>{" "}
            <b className="min-w-0 truncate font-medium text-foreground">
              {habit.name}
            </b>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* .btndo i .btnp z ikonami jak w makiecie */}
            <Button
              variant="destructive-outline"
              onClick={() => setUsuwanie(true)}
            >
              <TrashIcon aria-hidden="true" className="size-4" />
              Usuń
            </Button>
            <Button variant="primary" onClick={() => setEdycja(true)}>
              <PenLineIcon aria-hidden="true" className="size-4" />
              Edytuj
            </Button>
          </div>
        </header>

        <div className="box-border flex w-full max-w-[1100px] flex-col gap-6 px-6 py-7">
          <div className="min-w-0">
            <h1 className="m-0 truncate text-2xl font-semibold tracking-[-0.02em]">
              {habit.name}
            </h1>
            {/* Odznaki .bdg.sec.lg z ikonami (kalendarz, dzwonek) i .bdg.out.lg z datą startu */}
            <div
              data-testid="web-podtytul"
              className="mt-2 flex flex-wrap gap-1.5 tabular-nums"
            >
              {harmonogram && (
                <StatusBadge tone="gray" size="lg">
                  <CalendarIcon aria-hidden="true" className="size-3" />
                  {harmonogram}
                </StatusBadge>
              )}
              {przypomnienie && (
                <StatusBadge tone="gray" size="lg">
                  <BellIcon aria-hidden="true" className="size-3" />
                  {przypomnienie}
                </StatusBadge>
              )}
              {pierwszaData && (
                <StatusBadge tone="outline" size="lg">
                  {`od ${formatDatePl(pierwszaData)}`}
                </StatusBadge>
              )}
            </div>
          </div>

          {/* Kafelki statystyk: osobne karty .card, etykieta .lbl, wartość 26 px / 600 */}
          <div className="grid grid-cols-4 gap-3">
            {kafelki.map((k) => (
              <Card key={k.etykieta} className="px-[18px] py-4">
                <div className="text-xs font-medium text-muted-foreground">
                  {k.etykieta}
                </div>
                <div className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">
                  {k.wartosc}
                  {k.jednostka && (
                    <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">
                      {k.jednostka}
                    </span>
                  )}
                </div>
              </Card>
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

            {/* .card z nagłówkiem .card-h, wierszami i stopką .foot z ikoną informacji */}
            <section className="relative flex min-w-0 flex-col rounded-xl border border-border bg-white bg-clip-padding shadow-card">
              <CardHeader className="pb-3.5">
                <CardTitle as="h2">Historia harmonogramu</CardTitle>
              </CardHeader>
              <div className="border-t border-border">
                {historia.map((w) => (
                  <div
                    key={w.klucz}
                    className="flex items-center justify-between gap-3 border-b border-border-soft px-6 py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {w.zakres}
                      </div>
                      <div className="mt-0.5 font-medium">{w.opis}</div>
                    </div>
                    {/* .bdg.ok przy wersji obowiązującej dziś */}
                    {w.aktualna && (
                      <StatusBadge tone="green">Aktualny</StatusBadge>
                    )}
                  </div>
                ))}
              </div>
              <CardFooter className="justify-start">
                <InfoIcon
                  aria-hidden="true"
                  className="size-3.5 flex-none text-muted-foreground"
                />
                <span className="flex-1 text-xs text-muted-foreground">
                  Zmiana harmonogramu nie przelicza przeszłych dni.
                </span>
              </CardFooter>
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
