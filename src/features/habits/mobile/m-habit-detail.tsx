"use client";

// Szczegóły nawyku na telefonie wg MHabitDetail.dc.html: wstecz / edytuj w nagłówku, podtytuł z harmonogramem,
// kafelki Seria / Rekord / Skuteczn., kalendarz do 5 miesięcy wstecz z „N z M dni zaliczone”, notatki, „Usuń nawyk”.
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";

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
  type Checks,
} from "../model";
import { describeSchedule, streakLabel } from "../text";
import { MHabitSheet } from "./m-habit-sheet";

const PRZYCISK_IKONY =
  "inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent p-0 text-[#171717] outline-none hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-[#171717]/20";
const ETYKIETA =
  "font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase";

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

  // „12 dni” → liczba duża, jednostka mała (jak na webie)
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

  // Najwcześniejszy miesiąc kalendarza: bieżący − 5 (HabitMonth i tak nie cofnie się przed start nawyku)
  const [rok, miesiac] = data.today.split("-").map(Number);
  const piecWstecz = new Date(Date.UTC(rok, miesiac - 1 - 5, 1));
  const minMonth = `${piecWstecz.getUTCFullYear()}-${String(piecWstecz.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="flex flex-col">
      <header className="flex min-h-[60px] items-center gap-1 p-2">
        <Link href="/nawyki" aria-label="Wstecz" className={PRZYCISK_IKONY}>
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          aria-label="Edytuj"
          onClick={() => setEdycja(true)}
          className={PRZYCISK_IKONY}
        >
          <Pencil size={19} aria-hidden="true" />
        </button>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-6">
        <div>
          <div className={ETYKIETA}>{podtytul}</div>
          <h1 className="m-0 mt-1 text-[28px] font-semibold tracking-[-0.02em] break-words">
            {habit.name}
          </h1>
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-[#eaeaea] bg-[#eaeaea]">
          {kafelki.map((k) => (
            <div key={k.etykieta} className="bg-white px-3.5 py-3">
              <div className={ETYKIETA}>{k.etykieta}</div>
              <div className="mt-1 font-mono text-[22px] font-medium">
                {k.wartosc}
                {k.jednostka && (
                  <span className="ml-1 text-sm text-[#6b6b6b]">
                    {k.jednostka}
                  </span>
                )}
              </div>
            </div>
          ))}
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

        <button
          type="button"
          onClick={() => setUsuwanie(true)}
          className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#f3c7c7] bg-white text-[15px] font-medium text-[#b91c1c] outline-none hover:bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-[#171717]/20"
        >
          <Trash2 size={18} aria-hidden="true" />
          Usuń nawyk
        </button>
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
