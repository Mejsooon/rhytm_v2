"use client";

// Lewy panel kalendarza na webie (S2Calendar): mini kalendarz, kategorie, warstwy i suma godzin okresu.
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { buildMonthGrid, MIESIACE, type IsoDate } from "@/components/controls/calendar-math";
import { Button } from "@/components/controls";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "./load-calendar";
import { isoWeekNumber, viewRange, type CalendarView } from "./view-range";

const DNI_PN = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];
const MIESIACE_DOP = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];
const OKRES = { dzien: "Ten dzień", tydzien: "Ten tydzień", miesiac: "Ten miesiąc" };
const ETYKIETA = "px-2 pb-1 text-xs font-medium text-muted-foreground";

// Wiersz z kwadratem wyboru (.catrow): `kolor` wypełnia zaznaczony kwadrat
function Wiersz({
  nazwa,
  dopisek,
  kolor = "#262626",
  wlaczony,
  onToggle,
}: {
  nazwa: string;
  dopisek?: string;
  kolor?: string;
  wlaczony: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={wlaczony}
      onClick={onToggle}
      className="flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2 text-left text-sm text-foreground outline-none hover:bg-muted focus-visible:shadow-focus"
    >
      <span
        aria-hidden="true"
        className="box-border grid size-4 flex-none place-items-center rounded-[4px] text-white"
        style={wlaczony ? { background: kolor } : { border: "1.5px solid #a3a3a3" }}
      >
        {wlaczony && <Check strokeWidth={3.5} className="size-[11px]" />}
      </span>
      <span className={cn("min-w-0 truncate", !wlaczony && "text-muted-foreground")}>{nazwa}</span>
      {dopisek && <span className="ml-auto flex-none text-xs text-muted-foreground">{dopisek}</span>}
    </button>
  );
}

export function CalendarPanel({
  view,
  date,
  today,
  weekStart,
  weekNumbers,
  categories,
  onToggleCategory,
  onAddCategory,
  showSport,
  showRenewals,
  onToggleSport,
  onToggleRenewals,
  plannedMin,
  onPick,
}: {
  view: CalendarView;
  date: IsoDate;
  today: IsoDate;
  weekStart: "mon" | "sun";
  weekNumbers: boolean;
  categories: CategoryRow[];
  onToggleCategory: (category: CategoryRow) => void;
  onAddCategory: () => void;
  showSport: boolean;
  showRenewals: boolean;
  onToggleSport: () => void;
  onToggleRenewals: () => void;
  // Suma widocznych bloków pokazanego okresu
  plannedMin: number;
  onPick: (date: IsoDate) => void;
}) {
  // Miesiąc mini kalendarza podąża za wybraną datą, ale strzałki mogą go przesunąć
  const [przesuniecie, setPrzesuniecie] = useState({ o: 0, dla: date });
  if (przesuniecie.dla !== date) setPrzesuniecie({ o: 0, dla: date });
  const [rok, miesiac] = date.split("-").map(Number);
  const pokazany = new Date(Date.UTC(rok, miesiac - 1 + przesuniecie.o, 1));
  const m0 = pokazany.getUTCMonth();
  const komorki = buildMonthGrid(pokazany.getUTCFullYear(), m0, weekStart);
  const naglowki = weekStart === "mon" ? DNI_PN : [DNI_PN[6], ...DNI_PN.slice(0, 6)];
  const tydzien = view === "tydzien" ? viewRange("tydzien", date, weekStart) : null;
  const tytul = `${MIESIACE[m0].charAt(0).toUpperCase()}${MIESIACE[m0].slice(1)} ${pokazany.getUTCFullYear()}`;
  const kolumny = { gridTemplateColumns: `${weekNumbers ? "20px " : ""}repeat(7, minmax(0, 1fr))` };

  return (
    <aside
      aria-label="Panel kalendarza"
      className="flex w-[232px] flex-none flex-col gap-5 overflow-y-auto border-r border-border px-3 py-4 max-[799px]:hidden"
    >
      <section aria-label={tytul}>
        <div className="flex items-center justify-between px-1 pb-2">
          <b className="text-[13px] font-semibold">{tytul}</b>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label="Poprzedni miesiąc"
              onClick={() => setPrzesuniecie({ o: przesuniecie.o - 1, dla: date })}
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label="Następny miesiąc"
              onClick={() => setPrzesuniecie({ o: przesuniecie.o + 1, dla: date })}
            >
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          </span>
        </div>
        <div className="grid items-center text-center text-xs tabular-nums" style={kolumny}>
          {weekNumbers && <span />}
          {naglowki.map((n) => (
            <span key={n} className="pb-1 font-medium text-muted-foreground">
              {n}
            </span>
          ))}
          {komorki.map((k, i) => {
            const [, m, d] = k.date.split("-").map(Number);
            const dzis = k.date === today;
            const wybrany = view === "dzien" && k.date === date;
            const wTygodniu = tydzien !== null && k.date >= tydzien.from && k.date <= tydzien.to;
            return [
              weekNumbers && i % 7 === 0 && (
                <span key={`t-${k.date}`} className="text-[11px] text-faint-foreground">
                  {isoWeekNumber(komorki[i + 3].date)}
                </span>
              ),
              <button
                key={k.date}
                type="button"
                aria-label={`${d} ${MIESIACE_DOP[m - 1]}`}
                aria-current={dzis ? "date" : undefined}
                onClick={() => onPick(k.date)}
                className={cn(
                  "h-7 cursor-pointer rounded-[8px] border-0 bg-transparent p-0 outline-none hover:bg-muted focus-visible:shadow-focus",
                  k.inMonth ? "text-foreground" : "text-faint-foreground",
                  wTygodniu && "bg-black/5",
                  wybrany && "bg-black/5 font-semibold",
                  dzis && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                )}
              >
                {d}
              </button>,
            ];
          })}
        </div>
      </section>

      <section aria-label="Kategorie">
        <div className={cn(ETYKIETA, "flex items-center justify-between")}>
          Kategorie
          <Button variant="ghost" size="sm" icon aria-label="Nowa kategoria" onClick={onAddCategory}>
            <Plus size={14} aria-hidden="true" />
          </Button>
        </div>
        {categories.map((k) => (
          <Wiersz key={k.id} nazwa={k.name} kolor={k.color} wlaczony={!k.hidden} onToggle={() => onToggleCategory(k)} />
        ))}
      </section>

      <section aria-label="Warstwy">
        <div className={ETYKIETA}>Warstwy</div>
        <Wiersz nazwa="Treningi" dopisek="z Sportu" wlaczony={showSport} onToggle={onToggleSport} />
        <Wiersz nazwa="Odnowienia" dopisek="z Subskrypcji" wlaczony={showRenewals} onToggle={onToggleRenewals} />
      </section>

      <div className="flex-1" />
      <div className="px-2 text-xs text-muted-foreground">
        {OKRES[view]}:{" "}
        <b className="font-medium text-foreground tabular-nums">
          {`${(plannedMin / 60).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} h`}
        </b>{" "}
        zaplanowane
      </div>
    </aside>
  );
}
