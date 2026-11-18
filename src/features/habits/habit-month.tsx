"use client";

// Kalendarz miesiąca jednego nawyku (HabitDetail.dc.html): zrobione / pominięte / szare / neutralne.
// Używany na komputerze i (Task 7) na telefonie z własnym `minMonth`.
import { useState } from "react";

import { buildMonthGrid, MIESIACE } from "@/components/controls/calendar-math";
import type { IsoDate } from "@/components/controls/calendar-math";
import { isPlanned, scheduleOn, type Habit } from "./model";

type StanDnia = "zrobione" | "pominiete" | "szare" | "neutralne" | "przyszlosc";

const SKROTY_DNI = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];

// Style komórek wprost z makiety
const STYLE_STANU: Record<StanDnia, string> = {
  zrobione: "bg-[#15803d] text-white",
  pominiete: "bg-[#fee2e2] text-[#b91c1c]",
  szare: "bg-[#fafafa] text-[#a3a3a3]",
  neutralne: "bg-white text-[#a3a3a3]",
  przyszlosc: "border border-dashed border-[#e0e0e0] bg-white text-[#a3a3a3]",
};

const OPIS_STANU: Record<StanDnia, string> = {
  zrobione: "zrobione",
  pominiete: "pominięte",
  szare: "bez nawyku",
  neutralne: "niezrobione",
  przyszlosc: "zaplanowane",
};

// '2026-11-02' → „2 listopada 2026”
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
function dataSlownie(date: IsoDate): string {
  return `${Number(date.slice(8))} ${MIESIACE_DOPELNIACZ[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

// '2026-11' → numer miesiąca do porównań i przesuwania
function przesunMiesiac(miesiac: string, o: number): string {
  const [r, m] = miesiac.split("-").map(Number);
  const d = new Date(Date.UTC(r, m - 1 + o, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function HabitMonth({
  habit,
  checks,
  today,
  weekStart,
  minMonth,
  maxMonth,
  phone = false,
}: {
  habit: Habit;
  checks: Set<IsoDate>;
  today: IsoDate;
  weekStart: "mon" | "sun";
  // Najwcześniejszy miesiąc 'YYYY-MM' (telefon: 5 miesięcy wstecz); zawsze przycinany do miesiąca startu nawyku
  minMonth?: string;
  // Najpóźniejszy miesiąc 'YYYY-MM' — zwykle bieżący
  maxMonth: string;
  // Wariant telefonu (MHabitDetail.dc.html): pominięte dni szare zamiast czerwonych,
  // a zamiast legendy podsumowanie pokazanego miesiąca
  phone?: boolean;
}) {
  const [miesiac, setMiesiac] = useState(maxMonth);

  // Miesiąc startu nawyku (pierwsze validFrom); bez wersji harmonogramu nie ma kiedy cofać
  const miesiacStartu = habit.schedules[0]?.validFrom.slice(0, 7) ?? maxMonth;
  const dolny = minMonth && minMonth > miesiacStartu ? minMonth : miesiacStartu;

  const [rok, m] = miesiac.split("-").map(Number);
  const komorki = buildMonthGrid(rok, m - 1, weekStart);
  // Siatka ma stałe 6 tygodni; ostatni pusty tydzień (same dni następnego miesiąca) pomijamy
  const widoczne = komorki.slice(0, komorki[35].inMonth ? 42 : 35);
  const naglowki =
    weekStart === "mon"
      ? SKROTY_DNI
      : [SKROTY_DNI[6], ...SKROTY_DNI.slice(0, 6)];

  function stanDnia(date: IsoDate, wMiesiacu: boolean): StanDnia {
    if (!wMiesiacu) return "szare";
    if (checks.has(date)) return "zrobione";
    const wersja = scheduleOn(habit, date);
    if (wersja === null) return "szare";
    const zaplanowany = isPlanned(habit, date);
    // Przy dniach tygodnia dzień poza planem to „dzień bez nawyku”
    if (wersja.type === "weekdays" && !zaplanowany) return "szare";
    if (date > today) return "przyszlosc";
    // Dziś bez odhaczenia jeszcze nie jest pominięte; X/tydz. nigdy nie jest pominięte
    if (date === today || !zaplanowany) return "neutralne";
    return "pominiete";
  }

  // Podsumowanie (telefon): codziennie / dni tygodnia → zrobione z (zrobione + pominięte), pominięte tylko do wczoraj;
  // X/tydz. nie ma pominiętych dni, więc liczymy odhaczenia: „N razy w tym miesiącu”.
  // Typ bierzemy z wersji obowiązującej ostatniego pokazanego dnia (koniec miesiąca, a w bieżącym — dziś).
  let zrobione = 0;
  let pominiete = 0;
  for (const k of widoczne) {
    const stan = stanDnia(k.date, k.inMonth);
    if (stan === "zrobione") zrobione++;
    if (stan === "pominiete") pominiete++;
  }
  const ostatniWMiesiacu =
    widoczne.filter((k) => k.inMonth).at(-1)?.date ?? today;
  const wersjaMiesiaca = scheduleOn(
    habit,
    ostatniWMiesiacu < today ? ostatniWMiesiacu : today,
  );
  const podsumowanie =
    wersjaMiesiaca?.type === "times_per_week"
      ? `${zrobione} razy w tym miesiącu`
      : `${zrobione} z ${zrobione + pominiete} dni zaliczone`;

  return (
    <section className="rounded-lg border border-[#eaeaea] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-[15px] font-semibold">{`${MIESIACE[m - 1][0].toUpperCase()}${MIESIACE[m - 1].slice(1)} ${rok}`}</h2>
        <div className="flex gap-1 font-mono text-xs text-[#6b6b6b]">
          <button
            type="button"
            aria-label="Poprzedni miesiąc"
            disabled={miesiac <= dolny}
            onClick={() => setMiesiac(przesunMiesiac(miesiac, -1))}
            className="size-6 cursor-pointer rounded border-0 bg-transparent hover:bg-[#f5f5f5] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent max-[799px]:size-11 max-[799px]:rounded-[10px] max-[799px]:text-base"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Następny miesiąc"
            disabled={miesiac >= maxMonth}
            onClick={() => setMiesiac(przesunMiesiac(miesiac, 1))}
            className="size-6 cursor-pointer rounded border-0 bg-transparent hover:bg-[#f5f5f5] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent max-[799px]:size-11 max-[799px]:rounded-[10px] max-[799px]:text-base"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-[#6b6b6b]">
        {naglowki.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {widoczne.map((k) => {
          const stan = stanDnia(k.date, k.inMonth);
          return (
            <span
              key={k.date}
              data-day={k.date}
              data-state={stan}
              aria-label={`${dataSlownie(k.date)} · ${OPIS_STANU[stan]}`}
              className={`box-border flex h-10 items-center justify-center rounded-md font-mono text-xs ${
                // Telefon: pominięte szare jak w makiecie; web zostaje przy czerwonym
                phone && stan === "pominiete"
                  ? "bg-[#f5f5f5] text-[#8a8a8a]"
                  : STYLE_STANU[stan]
              }`}
            >
              {Number(k.date.slice(8))}
            </span>
          );
        })}
      </div>

      {phone && (
        <div className="mt-2.5 text-[13px] text-[#666666]">{podsumowanie}</div>
      )}

      {/* Legenda z makiety (web) */}
      {!phone && (
        <div className="mt-3 flex flex-wrap gap-3.5 font-mono text-[11px] text-[#666666]">
          <span>
            <span className="mr-[5px] inline-block size-2.5 rounded-[3px] bg-[#15803d]" />
            zrobione
          </span>
          <span>
            <span className="mr-[5px] inline-block size-2.5 rounded-[3px] bg-[#fee2e2]" />
            pominięte
          </span>
          <span>szare: dzień bez nawyku</span>
        </div>
      )}
    </section>
  );
}
