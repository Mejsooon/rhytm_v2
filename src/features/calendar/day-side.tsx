"use client";

// Prawa kolumna widoku dnia wg CalendarDay.dc.html: mini kalendarz i karta „Dzień w liczbach”.
import { useState } from "react";

import {
  buildMonthGrid,
  monthTitlePl,
  type IsoDate,
} from "@/components/controls/calendar-math";
import { MonoLabel } from "@/components/controls";
import type { TaskRow } from "@/features/tasks/model";
import { dayNumbers } from "./day-layout";
import type { Occurrence } from "./occurrences";

const MIESIACE_DOPELNIACZ = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];
const DNI_PN = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];

export function DaySide({
  date,
  today,
  weekStart = "mon",
  occurrences,
  tasks,
  onPick,
}: {
  date: IsoDate;
  today: IsoDate;
  weekStart?: "mon" | "sun";
  // Wystąpienia pokazanego dnia
  occurrences: Occurrence[];
  tasks: TaskRow[];
  onPick: (date: IsoDate) => void;
}) {
  // Miesiąc mini kalendarza podąża za wybranym dniem, ale strzałki mogą go przesunąć
  const [rok, miesiac] = date.split("-").map(Number);
  const [pokazany, setPokazany] = useState({ rok, miesiac0: miesiac - 1, dla: date });
  if (pokazany.dla !== date) {
    setPokazany({ rok, miesiac0: miesiac - 1, dla: date });
  }

  function przesun(o: number) {
    const d = new Date(Date.UTC(pokazany.rok, pokazany.miesiac0 + o, 1));
    setPokazany({ rok: d.getUTCFullYear(), miesiac0: d.getUTCMonth(), dla: date });
  }

  const komorki = buildMonthGrid(pokazany.rok, pokazany.miesiac0, weekStart);
  const naglowki = weekStart === "mon" ? DNI_PN : [DNI_PN[6], ...DNI_PN.slice(0, 6)];

  // Zadania przypięte do wystąpień tego dnia (po oryginalnej dacie z klucza)
  const zadaniaDnia = tasks.filter((t) =>
    occurrences.some(
      (o) =>
        o.blockId === t.block_id &&
        o.key.slice(o.blockId.length + 1) === t.occurrence_date,
    ),
  );
  const liczby = dayNumbers(occurrences, zadaniaDnia);

  // 150 -> „2 h 30 min”, 240 -> „4 h”, 45 -> „45 min”
  const czas = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0 && m > 0) return `${m} min`;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  };

  return (
    <aside className="flex min-w-0 flex-[1_1_260px] flex-col gap-4">
      <section className="rounded-lg border border-[#eaeaea] bg-white p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold">
            {monthTitlePl(pokazany.rok, pokazany.miesiac0)}
          </span>
          <span className="flex gap-1">
            <button
              type="button"
              aria-label="Poprzedni miesiąc"
              onClick={() => przesun(-1)}
              className="size-7 cursor-pointer rounded-md border border-[#e0e0e0] bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Następny miesiąc"
              onClick={() => przesun(1)}
              className="size-7 cursor-pointer rounded-md border border-[#e0e0e0] bg-white"
            >
              ›
            </button>
          </span>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center font-mono text-[10px] text-[#6b6b6b]">
          {naglowki.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {komorki.map((k) => {
            const [, m, d] = k.date.split("-").map(Number);
            let styl = "bg-transparent text-[#a3a3a3]";
            if (k.date === date) styl = "bg-[#171717] font-semibold text-white";
            else if (k.date === today) styl = "bg-[#f0faf4] font-semibold text-[#15803d]";
            else if (k.inMonth) styl = "bg-transparent text-[#171717]";
            return (
              <button
                key={k.date}
                type="button"
                aria-label={`${d} ${MIESIACE_DOPELNIACZ[m - 1]}`}
                onClick={() => onPick(k.date)}
                className={`h-7 cursor-pointer rounded-md font-mono text-xs ${styl}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-[#eaeaea] bg-white p-3.5">
        <MonoLabel>Dzień w liczbach</MonoLabel>
        <div className="flex justify-between">
          <span className="text-[#666]">Zaplanowane</span>
          <span className="font-mono">{czas(liczby.plannedMin)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#666]">Wolne (8–20)</span>
          <span className="font-mono">{czas(liczby.freeMin)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#666]">Zadania</span>
          <span className="font-mono">{`${liczby.tasksDone} / ${liczby.tasksTotal}`}</span>
        </div>
      </section>
    </aside>
  );
}
