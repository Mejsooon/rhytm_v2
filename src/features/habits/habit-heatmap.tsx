"use client";

// Karta „Heatmapa nawyków”: miesiąc z nawigacją albo 13 / 26 / 52 kolumny tygodni (Habits.dc.html, „RZĄD 3”)
import { useState } from "react";

import { Button, Segment } from "@/components/controls";
import { formatDatePl, monthTitlePl, type IsoDate } from "@/components/controls/calendar-math";
import { cn } from "@/lib/utils";
import { heatmapMonth, heatmapWeeks, type Checks, type DayCell, type Habit } from "./model";

type Tryb = "miesiac" | "13" | "26" | "52";

const SKROTY_DNI = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];
const MIESIACE_KROTKO = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const MAKS_WSTECZ = 12; // miesięcy

// Kolor komórki i treść dymka; przyszłość bez dymka.
// Progi z makiety: 0% → najjaśniejszy, ≤ 40% → 1, ≤ 80% → 2, powyżej → najciemniejszy
function wyglad(cell: DayCell, today: IsoDate): { kolor: string; data: string; tekst: string | null; szary: boolean } {
  const data = formatDatePl(cell.date);
  if (cell.date > today) {
    return { kolor: "border border-dashed border-[#e0e0e0] bg-white text-[#a3a3a3]", data, tekst: null, szary: false };
  }
  if (cell.percent === null) {
    return { kolor: "bg-[#f0f0f0] text-[#404040]", data, tekst: "brak zaplanowanych", szary: true };
  }
  const kolor =
    cell.percent === 0
      ? "bg-[#f0f0f0] text-[#404040]"
      : cell.percent <= 40
        ? "bg-[#bbe5cc] text-[#404040]"
        : cell.percent <= 80
          ? "bg-[#4ade80] text-[#404040]"
          : "bg-[#15803d] text-white";
  return { kolor, data, tekst: `${cell.done} z ${cell.planned} nawyków`, szary: false };
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
  const [najechany, setNajechany] = useState<IsoDate | null>(null);

  // Kolejność dni w tygodniu od dnia z profilu
  const kolejnoscDni = weekStart === "mon" ? SKROTY_DNI : [SKROTY_DNI[6], ...SKROTY_DNI.slice(0, 6)];

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
  while (komorkiMiesiaca.length % 7 !== 0) komorkiMiesiaca.push(null);

  const tygodnie = tryb === "miesiac" ? [] : heatmapWeeks(habits, checks, Number(tryb) as 13 | 26 | 52, today, weekStart);
  const pierwszyDzien = tygodnie[0]?.[0]?.date ?? today;
  const zakresTekst =
    tryb === "miesiac"
      ? "najedź na dzień, żeby zobaczyć szczegóły"
      : `${MIESIACE_KROTKO[Number(pierwszyDzien.slice(5, 7)) - 1]} ${pierwszyDzien.slice(0, 4)} → ${
          MIESIACE_KROTKO[miesiacDzis - 1]
        } ${rokDzis}`;

  // Dymek: ciemny, data pogrubiona; „brak zaplanowanych” szarym
  const dymek = (w: ReturnType<typeof wyglad>, ponizej: boolean) =>
    w.tekst !== null && (
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-[5] -translate-x-1/2 rounded-lg bg-[#171717] px-2.5 py-2 font-sans text-xs leading-[1.4] font-normal whitespace-nowrap text-white shadow-[0_8px_20px_rgba(0,0,0,.18)]",
          ponizej ? "top-full mt-1.5" : "bottom-full mb-1.5",
        )}
      >
        <span className="font-semibold">{w.data}</span>
        {" · "}
        <span className={cn("font-mono text-[11px]", w.szary ? "text-[#a3a3a3]" : "text-[#d4d4d4]")}>{w.tekst}</span>
      </span>
    );

  return (
    <section className="rounded-lg border border-[#eaeaea] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#eaeaea] px-4 py-3.5">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-[15px] font-semibold">Heatmapa nawyków</h2>
          <span className="font-mono text-xs text-[#6b6b6b]">% nawyków zrobionych danego dnia</span>
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
              <span className="text-sm font-semibold">{monthTitlePl(rok, miesiac0)}</span>
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
            <div className="grid grid-cols-[repeat(7,40px)] gap-1 text-center font-mono text-[10px] text-[#6b6b6b]">
              {kolejnoscDni.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-[repeat(7,40px)] gap-1" onMouseLeave={() => setNajechany(null)}>
              {komorkiMiesiaca.map((cell, i) => {
                if (cell === null) return <span key={`pusta-${i}`} className="size-10" />;
                const w = wyglad(cell, today);
                return (
                  <span
                    key={cell.date}
                    role="img"
                    aria-label={w.tekst === null ? w.data : `${w.data} · ${w.tekst}`}
                    onMouseEnter={() => setNajechany(cell.date)}
                    className={cn(
                      "relative box-border size-10 cursor-default rounded-md px-[5px] py-1 font-mono text-[11px]",
                      w.kolor,
                      cell.date === today && "font-semibold",
                      najechany === cell.date && "shadow-[0_0_0_2px_#171717]",
                    )}
                  >
                    {Number(cell.date.slice(8, 10))}
                    {najechany === cell.date && dymek(w, i < 7)}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-max gap-2">
            <div className="grid grid-rows-[repeat(7,14px)] gap-1 font-mono text-[10px] text-[#6b6b6b]">
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
              {tygodnie.flat().map((cell, i) => {
                const w = wyglad(cell, today);
                return (
                  <span
                    key={cell.date}
                    data-heat-cell
                    role="img"
                    aria-label={w.tekst === null ? w.data : `${w.data} · ${w.tekst}`}
                    onMouseEnter={() => setNajechany(cell.date)}
                    className={cn(
                      "relative box-border size-3.5 cursor-default rounded-[3px]",
                      w.kolor,
                      najechany === cell.date && "shadow-[0_0_0_2px_#171717]",
                    )}
                  >
                    {najechany === cell.date && dymek(w, i % 7 < 2)}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[#6b6b6b]">
          <span>{zakresTekst}</span>
          <span className="flex items-center gap-1">
            mniej
            <span className="size-3 rounded-[3px] bg-[#f0f0f0]" />
            <span className="size-3 rounded-[3px] bg-[#bbe5cc]" />
            <span className="size-3 rounded-[3px] bg-[#4ade80]" />
            <span className="size-3 rounded-[3px] bg-[#15803d]" />
            więcej
          </span>
        </div>
      </div>
    </section>
  );
}
