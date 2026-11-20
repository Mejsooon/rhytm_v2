"use client";

// Siatka miesiąca (web) wg CCalendarMonth.dc.html: 6 tygodni, w komórce numer dnia i do 3 wpisów
// (tytuł na tle koloru kategorii), reszta jako link „+N więcej” do widoku dnia.
import { Plus } from "lucide-react";
import Link from "next/link";

import type { IsoDate } from "@/components/controls/calendar-math";
import {
  SPORT_COLOR,
  sportItemHref,
  type SportItem,
} from "@/features/sport/model";
import { formatClockTime } from "@/lib/time/timezones";
import type { CategoryRow } from "./load-calendar";
import type { Occurrence } from "./occurrences";
import { weekdayOf } from "./view-range";

const DNI_KROTKO = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const MAX_WPISOW = 3;
// Kolor bloku bez kategorii — ten sam co w time-grid (tydzień, dzień)
const KOLOR_BRAK = "#a3a3a3";

export function MonthGrid({
  days,
  month0,
  occurrences,
  sport = [],
  categories,
  today,
  clock,
  activeEntryKey,
  activeDay,
  onDayClick,
  onEntryClick,
  onMoreClick,
}: {
  // 42 dni siatki (6 tygodni), od pierwszego dnia tygodnia
  days: IsoDate[];
  month0: number;
  // Tylko widoczne wystąpienia (bez ukrytych kategorii), z datą, na której mają stać w siatce
  occurrences: Occurrence[];
  // Podgląd treningów (tylko do odczytu): klik prowadzi na /sport
  sport?: SportItem[];
  categories: CategoryRow[];
  today: IsoDate;
  clock: "24" | "12";
  // Wpis z otwartym dymkiem i dzień z otwartym „Nowy wpis” dostają obwódkę
  activeEntryKey?: string | null;
  activeDay?: IsoDate | null;
  onDayClick: (date: IsoDate, anchor: HTMLElement) => void;
  onEntryClick: (key: string, anchor: HTMLElement) => void;
  // Klik w „+N więcej” (przejście do widoku dnia)
  onMoreClick?: () => void;
}) {
  // Wpisy pogrupowane po dniu: bloki i treningi razem, godzina rosnąco
  type Wpis =
    | { typ: "blok"; o: Occurrence; startMin: number }
    | { typ: "sport"; i: SportItem; startMin: number };
  const poDniach = new Map<IsoDate, Wpis[]>();
  for (const o of occurrences) {
    const lista = poDniach.get(o.date) ?? [];
    lista.push({ typ: "blok", o, startMin: o.startMin });
    poDniach.set(o.date, lista);
  }
  for (const i of sport) {
    const lista = poDniach.get(i.date) ?? [];
    lista.push({ typ: "sport", i, startMin: i.startMin });
    poDniach.set(i.date, lista);
  }
  for (const lista of poDniach.values()) {
    lista.sort((a, b) => a.startMin - b.startMin);
  }
  const koloryKategorii = new Map(categories.map((k) => [k.id, k.color]));

  return (
    <div className="overflow-x-auto">
      {/* Ramka jak .frame w coss.css: 1,5 px rgba(0,0,0,.14), promień 12 px, białe tło */}
      <div className="min-w-[760px] rounded-lg border-[1.5px] border-black/[.14] bg-background">
        <div className="grid grid-cols-7 border-b border-border text-xs font-medium text-muted-foreground">
          {days.slice(0, 7).map((dzien, i) => (
            <span
              key={dzien}
              data-testid="nazwa-dnia"
              className={`px-2.5 py-2 ${i > 0 ? "border-l border-border-soft" : ""}`}
            >
              {DNI_KROTKO[weekdayOf(dzien)]}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((dzien, i) => {
            const [, m, d] = dzien.split("-").map(Number);
            const wMiesiacu = m - 1 === month0;
            const weekend = weekdayOf(dzien) >= 6;
            const wpisy = poDniach.get(dzien) ?? [];
            const kiedy = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
            // Numer w kółku 22 px; dziś ciemne kółko, dni spoza miesiąca wyszarzone
            const numerKlasy = !wMiesiacu
              ? "text-faint-foreground"
              : dzien === today
                ? "bg-primary font-semibold text-primary-foreground"
                : "font-medium text-foreground";

            return (
              <div
                key={dzien}
                data-testid={`komorka-${dzien}`}
                data-day={dzien}
                // Klik w pustą część komórki (wpisy i linki obsługują się same)
                onClick={(e) => {
                  if (
                    e.target instanceof Element &&
                    e.target.closest("button, a")
                  )
                    return;
                  onDayClick(dzien, e.currentTarget);
                }}
                className={`group relative min-h-28 cursor-pointer p-1.5 ${i >= 7 ? "border-t border-border-soft" : ""} ${i % 7 > 0 ? "border-l border-border-soft" : ""} ${!wMiesiacu || weekend ? "bg-panel" : ""} ${i === 35 ? "rounded-bl-lg" : ""} ${i === 41 ? "rounded-br-lg" : ""} ${activeDay === dzien ? "ring-2 ring-ring ring-inset" : ""}`}
              >
                <span
                  data-testid={`numer-${dzien}`}
                  className={`inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-xs tabular-nums ${numerKlasy}`}
                >
                  {d}
                </span>
                <button
                  type="button"
                  aria-label={`Nowy wpis ${kiedy}`}
                  onClick={(e) => {
                    const komorka =
                      e.currentTarget.closest<HTMLElement>("[data-day]");
                    if (komorka) onDayClick(dzien, komorka);
                  }}
                  className="absolute top-1.5 right-1.5 flex size-[22px] cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-muted-foreground opacity-0 outline-none group-hover:bg-active group-hover:opacity-100 focus-visible:bg-active focus-visible:opacity-100 focus-visible:shadow-focus"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </button>
                {wpisy.slice(0, MAX_WPISOW).map((wpis) => {
                  if (wpis.typ === "sport") {
                    const i = wpis.i;
                    // Plan: białe tło i przerywana ramka; wykonany jak chip bloku (tło 14, ramka 4d, bez paska)
                    return (
                      <Link
                        key={i.key}
                        href={sportItemHref(i)}
                        data-planned={i.planned || undefined}
                        title={`${formatClockTime(Math.floor(i.startMin / 60), i.startMin % 60, clock)} ${i.title}`}
                        style={
                          i.planned
                            ? { border: `1px dashed ${SPORT_COLOR}` }
                            : {
                                backgroundColor: `${SPORT_COLOR}14`,
                                border: `1px solid ${SPORT_COLOR}4d`,
                              }
                        }
                        className={`mt-[3px] block w-full overflow-hidden rounded-sm px-1.5 py-0.5 text-left text-xs font-medium text-ellipsis whitespace-nowrap text-foreground outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${i.planned ? "bg-background" : ""}`}
                      >
                        {i.title}
                      </Link>
                    );
                  }
                  const o = wpis.o;
                  // Bez kategorii szary KOLOR_BRAK jak w tygodniu i dniu (time-grid)
                  const kolor =
                    (o.categoryId && koloryKategorii.get(o.categoryId)) ||
                    KOLOR_BRAK;
                  const zaznaczony = activeEntryKey === o.key;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      data-occurrence-key={o.key}
                      aria-expanded={zaznaczony}
                      title={`${formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)} ${o.title}`}
                      onClick={(e) => onEntryClick(o.key, e.currentTarget)}
                      // Wg CCalendarMonth: tło kolor+14 i ramka kolor+4d (bez paska); zaznaczony: pierścień 2 px kolor+66
                      // w inline boxShadow, więc fokus to outline z odstępem, żeby pierścień go nie zasłonił
                      style={{
                        backgroundColor: `${kolor}14`,
                        border: `1px solid ${kolor}4d`,
                        boxShadow: zaznaczony ? `0 0 0 2px ${kolor}66` : undefined,
                      }}
                      className="mt-[3px] block w-full cursor-pointer overflow-hidden rounded-sm px-1.5 py-0.5 text-left text-xs font-medium text-ellipsis whitespace-nowrap text-foreground outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {o.title}
                    </button>
                  );
                })}
                {wpisy.length > MAX_WPISOW && (
                  <Link
                    href={`/kalendarz?widok=dzien&data=${dzien}`}
                    onClick={onMoreClick}
                    className="mt-[3px] block rounded-sm pl-1 text-[11px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-focus"
                  >
                    {`+${wpisy.length - MAX_WPISOW} więcej`}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
