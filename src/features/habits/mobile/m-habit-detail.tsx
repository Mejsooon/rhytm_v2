"use client";

// Szczegóły nawyku na telefonie wg CMHabitDetail.dc.html: wstecz / edytuj w nagłówku, podtytuł z harmonogramem,
// karty Seria / Rekord / Skuteczn., „Łącznie N dni zrobionych”, kalendarz do 5 miesięcy wstecz z podsumowaniem,
// notatki, historia harmonogramu i „Usuń nawyk” (ConfirmDialog).
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";

import { Button, Card, CardTitle, StatusBadge } from "@/components/controls";
import { formatDatePl } from "@/components/controls/calendar-math";
import { addDays } from "@/features/calendar/view-range";
import { formatClockTime } from "@/lib/time/timezones";
import { DeleteHabitDialog } from "../delete-habit-dialog";
import { HabitMonth } from "../habit-month";
import { HabitNotes } from "../habit-notes";
import type { HabitDetailData } from "../load-habits";
import {
  currentStreak,
  longestStreak,
  scheduleOn,
  successRate30,
  totalChecks,
  type Checks,
} from "../model";
import { describeSchedule, streakLabel } from "../text";
import { MHabitSheet } from "./m-habit-sheet";

export function MHabitDetail({ data }: { data: HabitDetailData }) {
  const habit = data.habits[0];
  const [edycja, setEdycja] = useState(false);
  const [usuwanie, setUsuwanie] = useState(false);

  const dniOdhaczone = new Set(
    data.checks.filter((c) => c.habitId === habit.id).map((c) => c.date),
  );
  const checks: Checks = new Map([[habit.id, dniOdhaczone]]);

  // Podtytuł jak w makiecie: „Codziennie · 20:00 przypomnienie” (dni z wielkiej litery jak na liście)
  const biezaca = scheduleOn(habit, data.today) ?? habit.schedules[0];
  let podtytul = biezaca
    ? describeSchedule(biezaca)
        .split(", ")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(", ")
    : "";
  if (habit.remindAt) {
    const [g, m] = habit.remindAt.split(":").map(Number);
    podtytul += ` · ${formatClockTime(g, m, data.clock)} przypomnienie`;
  }

  // „12 dni” → liczba duża, jednostka mała
  const seria = streakLabel(
    currentStreak(habit, checks, data.today, data.weekStart),
  ).split(" ");
  const rekord = streakLabel(
    longestStreak(habit, checks, data.today, data.weekStart),
  ).split(" ");
  const skutecznosc = successRate30(habit, checks, data.today);
  const kafelki = [
    {
      etykieta: "Seria",
      wartosc: seria[0],
      jednostka: seria.slice(1).join(" "),
    },
    {
      etykieta: "Rekord",
      wartosc: rekord[0],
      jednostka: rekord.slice(1).join(" "),
    },
    {
      etykieta: "Skuteczn.",
      wartosc: skutecznosc === null ? "—" : `${skutecznosc}%`,
      jednostka: "",
    },
  ];

  // „Łącznie 47 dni zrobionych od 01.10.2026” (odmiana: 1 dzień zrobiony, 2–4 dni zrobione, reszta dni zrobionych)
  const lacznie = totalChecks(habit.id, checks);
  const pierwszaData = habit.schedules[0]?.validFrom;
  let zrobione = "dni zrobionych";
  if (lacznie === 1) zrobione = "dzień zrobiony";
  else if (
    lacznie % 10 >= 2 &&
    lacznie % 10 <= 4 &&
    (lacznie % 100 < 12 || lacznie % 100 > 14)
  )
    zrobione = "dni zrobione";
  const sumaOdhaczen = `Łącznie ${lacznie} ${zrobione}${pierwszaData ? ` od ${formatDatePl(pierwszaData)}` : ""}`;

  // Historia harmonogramu jak na webie: od najnowszej, zakres kończy się dzień przed następną wersją;
  // przy wersji obowiązującej dziś odznaka „Aktualny” i przypomnienie
  let przypomnienie = "";
  if (habit.remindAt) {
    const [g, m] = habit.remindAt.split(":").map(Number);
    przypomnienie = ` · przypomnienie ${formatClockTime(g, m, data.clock)}`;
  }
  const historia = [...habit.schedules]
    .reverse()
    .map((wersja, i, wszystkie) => {
      const nastepna = i === 0 ? null : wszystkie[i - 1];
      let zakres = `od ${formatDatePl(wersja.validFrom)}`;
      if (nastepna) {
        zakres = `${formatDatePl(wersja.validFrom).slice(0, 5)} – ${formatDatePl(addDays(nastepna.validFrom, -1))}`;
      }
      const aktualna = wersja.validFrom === biezaca?.validFrom;
      const opis = describeSchedule(wersja);
      return {
        klucz: wersja.validFrom,
        aktualna,
        zakres: aktualna ? `${zakres}${przypomnienie}` : zakres,
        opis: opis.charAt(0).toUpperCase() + opis.slice(1),
      };
    });

  // Najwcześniejszy miesiąc kalendarza: bieżący − 5 (HabitMonth i tak nie cofnie się przed start nawyku)
  const [rok, miesiac] = data.today.split("-").map(Number);
  const piecWstecz = new Date(Date.UTC(rok, miesiac - 1 - 5, 1));
  const minMonth = `${piecWstecz.getUTCFullYear()}-${String(piecWstecz.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="flex flex-col">
      <header className="m-head border-b-0 px-2">
        <Button variant="ghost" icon asChild>
          <Link href="/nawyki" aria-label="Wstecz">
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          icon
          aria-label="Edytuj"
          onClick={() => setEdycja(true)}
        >
          <Pencil size={18} aria-hidden="true" />
        </Button>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-6">
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {podtytul}
          </div>
          <h1 className="m-title mt-1 text-2xl break-words">{habit.name}</h1>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {kafelki.map((k) => (
            <Card key={k.etykieta} className="px-3.5 py-3">
              <div className="text-xs font-medium text-muted-foreground">
                {k.etykieta}
              </div>
              <div className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] tabular-nums">
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

        <div className="-mt-2 text-[13px] text-muted-foreground tabular-nums">
          {sumaOdhaczen}
        </div>

        <HabitMonth
          // Klucz resetuje widok po przejściu północy na nowy miesiąc
          key={data.today.slice(0, 7)}
          habit={habit}
          checks={dniOdhaczone}
          today={data.today}
          weekStart={data.weekStart}
          minMonth={minMonth}
          maxMonth={data.today.slice(0, 7)}
          phone
        />

        <HabitNotes habitId={habit.id} notes={data.notes} phone />

        <section>
          <CardTitle as="h2" className="mb-2 text-[15px]">
            Historia harmonogramu
          </CardTitle>
          <Card>
            {historia.map((w) => (
              <div key={w.klucz} className="m-row min-h-14">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{w.opis}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {w.zakres}
                  </span>
                </span>
                {w.aktualna && <StatusBadge tone="green">Aktualny</StatusBadge>}
              </div>
            ))}
            <div className="m-row min-h-10">
              <span className="text-xs text-muted-foreground">
                Zmiana harmonogramu nie przelicza przeszłych dni.
              </span>
            </div>
          </Card>
        </section>

        <Button
          variant="destructive-outline"
          className="w-full"
          onClick={() => setUsuwanie(true)}
        >
          <Trash2 size={18} aria-hidden="true" />
          Usuń nawyk
        </Button>
      </div>

      {edycja && (
        <MHabitSheet
          habit={habit}
          weekStart={data.weekStart}
          clock={data.clock}
          today={data.today}
          onDone={() => setEdycja(false)}
        />
      )}
      <DeleteHabitDialog
        habitId={habit.id}
        name={habit.name}
        open={usuwanie}
        onOpenChange={setUsuwanie}
      />
    </div>
  );
}
