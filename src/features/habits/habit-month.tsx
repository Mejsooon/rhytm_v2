"use client";

// Kalendarz miesiąca jednego nawyku (CHabitDetail.dc.html): zrobione / pominięte / szare / neutralne.
// Używany na komputerze i na telefonie (CMHabitDetail, własny `minMonth`). Web i telefon to osobne bloki JSX.
import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/controls";
import { buildMonthGrid, MIESIACE } from "@/components/controls/calendar-math";
import type { IsoDate } from "@/components/controls/calendar-math";
import { isPlanned, scheduleOn, type Habit } from "./model";

type StanDnia = "zrobione" | "pominiete" | "szare" | "neutralne" | "przyszlosc";

const SKROTY_DNI = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];

// Web: komórki wg CHabitDetail.dc.html (ramka 1 px w każdym stanie). Makieta ma „off” białe dla obu,
// ale „szare” (dzień bez nawyku) zostaje na szarym tle, żeby różniło się od „neutralne” i legenda była prawdziwa.
const STYLE_STANU: Record<StanDnia, string> = {
  zrobione: "border-success bg-success text-white",
  pominiete:
    "border-destructive/[.16] bg-destructive/10 text-destructive-foreground",
  szare: "border-border bg-panel text-faint-foreground",
  neutralne: "border-border bg-white text-faint-foreground",
  przyszlosc: "border-dashed border-input bg-white text-faint-foreground",
};

// Telefon (CMHabitDetail.dc.html): zrobione → zielone, przyszłość → przerywana ramka, reszta szara jak w renderVals;
// „szare” (dzień bez nawyku) zostaje jaśniejsze, żeby różniło się od pominiętego
const STYLE_STANU_TEL: Record<StanDnia, string> = {
  zrobione: "bg-success text-white",
  pominiete: "bg-active text-muted-foreground",
  szare: "bg-panel text-faint-foreground",
  neutralne: "bg-active text-muted-foreground",
  przyszlosc:
    "border border-dashed border-input bg-white text-faint-foreground",
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
  // Wariant telefonu (CMHabitDetail.dc.html): osobny blok JSX, zamiast legendy podsumowanie miesiąca
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

  // Nazwa miesiąca z wielkiej litery: „Listopad 2026”
  const tytul = `${MIESIACE[m - 1][0].toUpperCase()}${MIESIACE[m - 1].slice(1)} ${rok}`;

  // Telefon (CMHabitDetail): osobny blok JSX — karta, strzałki 44 px z aria-disabled, nagłówki .lbl,
  // komórki 12 px / 500, dziś z czerwonym pierścieniem, pod spodem podsumowanie miesiąca
  if (phone) {
    return (
      <Card className="p-3.5">
        <div className="mb-2.5 flex items-center">
          <CardTitle as="h2" className="flex-1 text-[15px]">
            {tytul}
          </CardTitle>
          <Button
            variant="ghost"
            icon
            aria-label="Poprzedni miesiąc"
            aria-disabled={miesiac <= dolny}
            className="aria-disabled:opacity-30"
            onClick={() => {
              if (miesiac > dolny) setMiesiac(przesunMiesiac(miesiac, -1));
            }}
          >
            <ChevronLeftIcon size={20} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            icon
            aria-label="Następny miesiąc"
            aria-disabled={miesiac >= maxMonth}
            className="aria-disabled:opacity-30"
            onClick={() => {
              if (miesiac < maxMonth) setMiesiac(przesunMiesiac(miesiac, 1));
            }}
          >
            <ChevronRightIcon size={20} aria-hidden="true" />
          </Button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-[5px] text-center text-xs font-medium text-muted-foreground">
          {naglowki.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-[5px]">
          {widoczne.map((k) => {
            const stan = stanDnia(k.date, k.inMonth);
            return (
              <span
                key={k.date}
                data-day={k.date}
                data-state={stan}
                aria-label={`${dataSlownie(k.date)} · ${OPIS_STANU[stan]}`}
                // Dni sąsiednich miesięcy zajmują miejsce, ale ich nie widać (jak puste pola w makiecie)
                className={`box-border flex aspect-square items-center justify-center rounded-lg text-xs font-medium tabular-nums ${
                  k.inMonth ? STYLE_STANU_TEL[stan] : "invisible"
                } ${k.date === today ? "shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--destructive-strong)]" : ""}`}
              >
                {Number(k.date.slice(8))}
              </span>
            );
          })}
        </div>
        <div className="mt-2.5 text-xs text-muted-foreground">
          {podsumowanie}
        </div>
      </Card>
    );
  }

  const naglowkiDni = (
    <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
      {naglowki.map((n) => (
        <span key={n}>{n}</span>
      ))}
    </div>
  );

  const siatka = (
    <div className="grid grid-cols-7 gap-1">
      {widoczne.map((k) => {
        const stan = stanDnia(k.date, k.inMonth);
        let wyglad = STYLE_STANU[stan];
        // Web: dzień spoza miesiąca przezroczysty, jaśniejsza cyfra (.out z makiety)
        if (!k.inMonth) {
          wyglad = "border-transparent bg-transparent text-faint-foreground/50";
        }
        return (
          <span
            key={k.date}
            data-day={k.date}
            data-state={stan}
            aria-label={`${dataSlownie(k.date)} · ${OPIS_STANU[stan]}`}
            // Web: dziś z pierścieniem (biała przerwa 2 px + obrys 2 px) — celowy dodatek z makiety CHabitDetail
            // (wcześniej aplikacja nie wyróżniała dziś); tylko styl, bez zmian w treści i ARIA
            style={
              k.date === today
                ? {
                    boxShadow:
                      "0 0 0 2px var(--background), 0 0 0 4px var(--foreground)",
                  }
                : undefined
            }
            className={`box-border flex h-10 items-center justify-center rounded-[8px] border text-[13px] font-medium tabular-nums ${wyglad}`}
          >
            {Number(k.date.slice(8))}
          </span>
        );
      })}
    </div>
  );

  // Web: .card z nagłówkiem .card-h (tytuł + ‹ › jako .btng.ic.sm) i treścią .card-p
  return (
    <section className="relative flex min-w-0 flex-col rounded-xl border border-border bg-white bg-clip-padding shadow-card">
      <CardHeader className="items-center">
        <CardTitle as="h2">{tytul}</CardTitle>
        <span className="flex gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            icon
            aria-label="Poprzedni miesiąc"
            disabled={miesiac <= dolny}
            onClick={() => setMiesiac(przesunMiesiac(miesiac, -1))}
          >
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon
            aria-label="Następny miesiąc"
            disabled={miesiac >= maxMonth}
            onClick={() => setMiesiac(przesunMiesiac(miesiac, 1))}
          >
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </Button>
        </span>
      </CardHeader>
      <CardContent>
        {naglowkiDni}
        {siatka}
        {/* Legenda z makiety (teksty bez zmian) */}
        <div className="mt-3.5 flex flex-wrap items-center gap-3.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[3px] bg-success" />
            zrobione
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[3px] bg-destructive/[.14]" />
            pominięte
          </span>
          <span>szare: dzień bez nawyku</span>
        </div>
      </CardContent>
    </section>
  );
}
