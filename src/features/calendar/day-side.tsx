"use client";

// Prawa kolumna widoku dnia wg CCalendarDay.dc.html: szary panel (288 px treści) z dwiema kartami (.card) —
// mini kalendarz i „Dzień w liczbach”.
// Stoi w miejscu obok siatki i przewija się sama, gdy brakuje wysokości.
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  buildMonthGrid,
  monthTitlePl,
  type IsoDate,
} from "@/components/controls/calendar-math";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/features/tasks/model";
import { dayNumbers } from "./day-layout";
import type { Occurrence } from "./occurrences";

const MIESIACE_DOPELNIACZ = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
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
  const [pokazany, setPokazany] = useState({
    rok,
    miesiac0: miesiac - 1,
    dla: date,
  });
  if (pokazany.dla !== date) {
    setPokazany({ rok, miesiac0: miesiac - 1, dla: date });
  }

  function przesun(o: number) {
    const d = new Date(Date.UTC(pokazany.rok, pokazany.miesiac0 + o, 1));
    setPokazany({
      rok: d.getUTCFullYear(),
      miesiac0: d.getUTCMonth(),
      dla: date,
    });
  }

  const komorki = buildMonthGrid(pokazany.rok, pokazany.miesiac0, weekStart);
  const naglowki =
    weekStart === "mon" ? DNI_PN : [DNI_PN[6], ...DNI_PN.slice(0, 6)];

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
    <aside className="flex w-[321px] flex-none flex-col gap-4 overflow-y-auto border-l border-border bg-panel p-4">
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          {/* Wielka litera tylko w wyglądzie („Listopad 2026”), tekst zostaje z monthTitlePl */}
          <span className="pl-1 font-semibold first-letter:uppercase">
            {monthTitlePl(pokazany.rok, pokazany.miesiac0)}
          </span>
          <span className="flex gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label="Poprzedni miesiąc"
              onClick={() => przesun(-1)}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label="Następny miesiąc"
              onClick={() => przesun(1)}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </span>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
          {naglowki.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {komorki.map((k) => {
            const [, m, d] = k.date.split("-").map(Number);
            const wybrany = k.date === date;
            return (
              <button
                key={k.date}
                type="button"
                aria-label={`${d} ${MIESIACE_DOPELNIACZ[m - 1]}`}
                onClick={() => onPick(k.date)}
                className={cn(
                  "h-[30px] cursor-pointer rounded-[8px] border border-transparent bg-transparent p-0 text-[13px] tabular-nums outline-none hover:bg-muted focus-visible:shadow-focus",
                  k.inMonth ? "text-foreground" : "text-faint-foreground",
                  // Dziś jak w DatePicker: obwódka
                  k.date === today && "border-border-strong",
                  wybrany &&
                    "border-primary bg-primary font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.16)] hover:bg-primary",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader className="px-4 pt-3.5">
          <CardTitle as="h2" className="text-sm">
            Dzień w liczbach
          </CardTitle>
        </CardHeader>
        {/* Wysokość linii „normal” jak w makiecie (wiersze co 25 px) */}
        <div className="flex flex-col gap-2 px-4 pt-2.5 pb-3.5 leading-[normal]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Zaplanowane</span>
            <span className="font-medium tabular-nums">
              {czas(liczby.plannedMin)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Wolne (8–20)</span>
            <span className="font-medium tabular-nums">
              {czas(liczby.freeMin)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Zadania</span>
            <span className="font-medium tabular-nums">{`${liczby.tasksDone} / ${liczby.tasksTotal}`}</span>
          </div>
        </div>
      </Card>
    </aside>
  );
}
