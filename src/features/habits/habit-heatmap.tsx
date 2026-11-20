"use client";

// Karta „Heatmapa nawyków”: miesiąc z nawigacją albo 13 / 26 / 52 kolumny tygodni (Habits.dc.html, „RZĄD 3”)
import { useState } from "react";

import { Button, Segment } from "@/components/controls";
import {
  formatDatePl,
  monthTitlePl,
  type IsoDate,
} from "@/components/controls/calendar-math";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";
import {
  heatmapMonth,
  heatmapWeeks,
  type Checks,
  type DayCell,
  type Habit,
} from "./model";

type Tryb = "miesiac" | "13" | "26" | "52";

const SKROTY_DNI = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];
const MIESIACE_KROTKO = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
];
const MAKS_WSTECZ = 12; // miesięcy

// Kolor komórki i treść dymka; przyszłość bez dymka.
// Progi z makiety: 0% → najjaśniejszy, ≤ 40% → 1, ≤ 80% → 2, powyżej → najciemniejszy.
// Dzień bez planu ma własny wygląd (jaśniejsze tło i przerywana ramka), żeby nie mylił się z 0%
function wyglad(
  cell: DayCell,
  today: IsoDate,
): { kolor: string; data: string; tekst: string | null; szary: boolean } {
  const data = formatDatePl(cell.date);
  if (cell.date > today) {
    return {
      kolor: "border border-dashed border-input bg-white text-faint-foreground",
      data,
      tekst: null,
      szary: false,
    };
  }
  if (cell.percent === null) {
    return {
      kolor:
        "border border-dashed border-border-strong bg-panel text-soft-foreground",
      data,
      tekst: "brak zaplanowanych",
      szary: true,
    };
  }
  const kolor =
    cell.percent === 0
      ? "bg-active text-soft-foreground"
      : cell.percent <= 40
        ? "bg-success-soft text-soft-foreground"
        : cell.percent <= 80
          ? "bg-[#4ade80] text-soft-foreground"
          : "bg-success text-white";
  return {
    kolor,
    data,
    tekst: `${cell.done} z ${cell.planned} nawyków`,
    szary: false,
  };
}

export function HabitHeatmap({
  habits,
  checks,
  today,
  weekStart,
}: {
  habits: Habit[];
  checks: Checks;
  today: IsoDate;
  weekStart: "mon" | "sun";
}) {
  const [tryb, setTryb] = useState<Tryb>("52");
  const [wstecz, setWstecz] = useState(0); // ile miesięcy przed bieżącym
  // Komórka pod myszą albo z fokusem: data, element (do pozycji dymka) i jej wygląd
  const [najechany, setNajechany] = useState<{
    date: IsoDate;
    el: HTMLElement;
    w: ReturnType<typeof wyglad>;
  } | null>(null);

  // Kolejność dni w tygodniu od dnia z profilu
  const kolejnoscDni =
    weekStart === "mon"
      ? SKROTY_DNI
      : [SKROTY_DNI[6], ...SKROTY_DNI.slice(0, 6)];

  // Miesiąc: rok i miesiąc liczone na liczbach (bez stref)
  const [rokDzis, miesiacDzis] = today.split("-").map(Number);
  const indeks = rokDzis * 12 + (miesiacDzis - 1) - wstecz;
  const rok = Math.floor(indeks / 12);
  const miesiac0 = indeks % 12;
  const komorkiMiesiaca = heatmapMonth(
    habits,
    checks,
    `${rok}-${String(miesiac0 + 1).padStart(2, "0")}`,
    today,
    weekStart,
  );
  // heatmapMonth nie dopełnia ostatniego rzędu — dokładamy puste pola do pełnego tygodnia
  const siatkaMiesiaca = [...komorkiMiesiaca];
  while (siatkaMiesiaca.length % 7 !== 0) siatkaMiesiaca.push(null);

  const tygodnie =
    tryb === "miesiac"
      ? []
      : heatmapWeeks(
          habits,
          checks,
          Number(tryb) as 13 | 26 | 52,
          today,
          weekStart,
        );
  const pierwszyDzien = tygodnie[0]?.[0]?.date ?? today;
  const zakresTekst =
    tryb === "miesiac"
      ? "najedź na dzień, żeby zobaczyć szczegóły"
      : `${MIESIACE_KROTKO[Number(pierwszyDzien.slice(5, 7)) - 1]} ${pierwszyDzien.slice(0, 4)} → ${
          MIESIACE_KROTKO[miesiacDzis - 1]
        } ${rokDzis}`;

  return (
    <section className="rounded-lg border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-4 py-3.5">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-[15px] font-semibold">Heatmapa nawyków</h2>
          <span className="font-mono text-xs text-muted-foreground">
            % nawyków zrobionych danego dnia
          </span>
        </div>
        <Segment
          ariaLabel="Zakres heatmapy"
          value={tryb}
          onChange={(v) => {
            setTryb(v);
            setNajechany(null);
          }}
          options={[
            { value: "miesiac", label: "Miesiąc" },
            { value: "13", label: "3 mies." },
            { value: "26", label: "6 mies." },
            { value: "52", label: "Rok" },
          ]}
        />
      </div>

      <div className="overflow-x-auto p-4">
        {tryb === "miesiac" ? (
          <div className="mx-auto flex w-max flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <Button
                size="sm"
                aria-label="Poprzedni miesiąc"
                disabled={wstecz >= MAKS_WSTECZ}
                onClick={() => {
                  setWstecz(wstecz + 1);
                  setNajechany(null);
                }}
              >
                ‹
              </Button>
              <span className="text-sm font-semibold">
                {monthTitlePl(rok, miesiac0)}
              </span>
              <Button
                size="sm"
                aria-label="Następny miesiąc"
                disabled={wstecz <= 0}
                onClick={() => {
                  setWstecz(wstecz - 1);
                  setNajechany(null);
                }}
              >
                ›
              </Button>
            </div>
            <div className="grid grid-cols-[repeat(7,40px)] gap-1 text-center font-mono text-[10px] text-muted-foreground">
              {kolejnoscDni.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div
              className="grid grid-cols-[repeat(7,40px)] gap-1"
              onMouseLeave={() => setNajechany(null)}
            >
              {siatkaMiesiaca.map((cell, i) => {
                if (cell === null)
                  return <span key={`pusta-${i}`} className="size-10" />;
                const w = wyglad(cell, today);
                return (
                  <span
                    key={cell.date}
                    role="img"
                    tabIndex={0}
                    aria-label={
                      w.tekst === null ? w.data : `${w.data} · ${w.tekst}`
                    }
                    onMouseEnter={(e) =>
                      setNajechany({ date: cell.date, el: e.currentTarget, w })
                    }
                    onFocus={(e) =>
                      setNajechany({ date: cell.date, el: e.currentTarget, w })
                    }
                    onBlur={() => setNajechany(null)}
                    className={cn(
                      "box-border size-10 cursor-default rounded-md px-[5px] py-1 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      w.kolor,
                      cell.date === today && "font-semibold",
                      najechany?.date === cell.date &&
                        "shadow-[0_0_0_2px_#171717]",
                    )}
                  >
                    {Number(cell.date.slice(8, 10))}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-max gap-2">
            <div className="grid grid-rows-[repeat(7,14px)] gap-1 font-mono text-[10px] text-muted-foreground">
              {kolejnoscDni.map((d, i) => (
                <span key={d} className="leading-[14px]">
                  {i % 2 === 0 ? d : ""}
                </span>
              ))}
            </div>
            <div
              className="grid grid-flow-col grid-rows-[repeat(7,14px)] gap-1"
              onMouseLeave={() => setNajechany(null)}
            >
              {tygodnie.flat().map((cell) => {
                const w = wyglad(cell, today);
                return (
                  <span
                    key={cell.date}
                    data-heat-cell
                    role="img"
                    tabIndex={0}
                    aria-label={
                      w.tekst === null ? w.data : `${w.data} · ${w.tekst}`
                    }
                    onMouseEnter={(e) =>
                      setNajechany({ date: cell.date, el: e.currentTarget, w })
                    }
                    onFocus={(e) =>
                      setNajechany({ date: cell.date, el: e.currentTarget, w })
                    }
                    onBlur={() => setNajechany(null)}
                    className={cn(
                      "box-border size-3.5 cursor-default rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      w.kolor,
                      najechany?.date === cell.date &&
                        "shadow-[0_0_0_2px_#171717]",
                    )}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Dymek dnia (przyszłość go nie ma): data pogrubiona, „brak zaplanowanych” szarym */}
        {najechany && najechany.w.tekst !== null && (
          <ChartTooltip anchor={najechany.el}>
            <span className="font-semibold">{najechany.w.data}</span>
            {" · "}
            <span
              className={cn(
                "font-mono text-[11px]",
                najechany.w.szary ? "text-faint-foreground" : "text-faint-foreground",
              )}
            >
              {najechany.w.tekst}
            </span>
          </ChartTooltip>
        )}

        <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>{zakresTekst}</span>
          <span className="flex items-center gap-1">
            mniej
            <span className="size-3 rounded-[3px] bg-active" />
            <span className="size-3 rounded-[3px] bg-success-soft" />
            <span className="size-3 rounded-[3px] bg-[#4ade80]" />
            <span className="size-3 rounded-[3px] bg-success" />
            więcej
          </span>
        </div>
      </div>
    </section>
  );
}
