"use client";

// Karta „Heatmapa nawyków”: miesiąc z nawigacją albo 13 / 26 / 52 kolumny tygodni (CHabits.dc.html)
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Button,
  CardDescription,
  CardHeader,
  CardTitle,
  Segment,
} from "@/components/controls";
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
// Paleta poziomów (CHabits): active → heat-1 → heat-2 → success.
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
        ? "bg-heat-1 text-soft-foreground"
        : cell.percent <= 80
          ? "bg-heat-2 text-soft-foreground"
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
    // .card jako <section> (te same klasy co Card)
    <section className="relative flex min-w-0 flex-col rounded-xl border border-border bg-white bg-clip-padding shadow-card">
      <CardHeader className="flex-wrap items-center">
        <div>
          <CardTitle as="h2">Heatmapa nawyków</CardTitle>
          <CardDescription>% nawyków zrobionych danego dnia</CardDescription>
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
      </CardHeader>

      <div className="overflow-x-auto px-6 py-5">
        {tryb === "miesiac" ? (
          <div className="mx-auto flex w-max flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <Button
                size="sm"
                icon
                aria-label="Poprzedni miesiąc"
                disabled={wstecz >= MAKS_WSTECZ}
                onClick={() => {
                  setWstecz(wstecz + 1);
                  setNajechany(null);
                }}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </Button>
              <span className="text-sm font-semibold">
                {monthTitlePl(rok, miesiac0)}
              </span>
              <Button
                size="sm"
                icon
                aria-label="Następny miesiąc"
                disabled={wstecz <= 0}
                onClick={() => {
                  setWstecz(wstecz - 1);
                  setNajechany(null);
                }}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </div>
            <div className="grid grid-cols-[repeat(7,40px)] gap-1 text-center text-[11px] font-medium text-muted-foreground">
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
                    // Zaznaczenie to pierścień w style; fokus klawiatury — osobny obrys (outline)
                    className={cn(
                      "box-border size-10 cursor-default rounded-[8px] px-1.5 py-1 text-xs font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
                      w.kolor,
                      cell.date === today && "font-bold",
                    )}
                    style={
                      najechany?.date === cell.date
                        ? {
                            boxShadow:
                              "0 0 0 2px var(--background), 0 0 0 4px var(--foreground)",
                          }
                        : undefined
                    }
                  >
                    {Number(cell.date.slice(8, 10))}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-max gap-2">
            <div className="grid grid-rows-[repeat(7,14px)] gap-1 text-[10px] font-medium text-muted-foreground">
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
                    // Zaznaczenie to pierścień w style; fokus klawiatury — osobny obrys (outline)
                    className={cn(
                      "box-border size-3.5 cursor-default rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
                      w.kolor,
                    )}
                    style={
                      najechany?.date === cell.date
                        ? { boxShadow: "0 0 0 2px var(--foreground)" }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Dymek dnia (przyszłość go nie ma): data pogrubiona, pod nią „x z y nawyków” szarym;
            „ · ” zostaje dla czytników ekranu, na ekranie dzieli to nowa linia */}
        {najechany && najechany.w.tekst !== null && (
          <ChartTooltip anchor={najechany.el}>
            <span className="block font-semibold">{najechany.w.data}</span>
            <span className="sr-only">{" · "}</span>
            <span
              className={cn(
                "mt-0.5 block tabular-nums",
                najechany.w.szary
                  ? "text-faint-foreground"
                  : "text-muted-foreground",
              )}
            >
              {najechany.w.tekst}
            </span>
          </ChartTooltip>
        )}

        <div className="mt-3.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>{zakresTekst}</span>
          {/* Legenda poziomów: te same kolory co komórki */}
          <span className="flex items-center gap-1">
            mniej
            <span className="size-3 rounded-[3px] bg-active" />
            <span className="size-3 rounded-[3px] bg-heat-1" />
            <span className="size-3 rounded-[3px] bg-heat-2" />
            <span className="size-3 rounded-[3px] bg-success" />
            więcej
          </span>
        </div>
      </div>
    </section>
  );
}
