"use client";

// Kalendarz miesiąca Sportu (Sport.dc.html, „KALENDARZ: MIESIĄC”): 6 tygodni wg początku tygodnia,
// chipy treningów, kolumna „Σ tydz.”, dymek treningu i dymek dnia „Dodaj trening”.
import { useEffect, useRef } from "react";
import { Activity, Dumbbell, Plus, X } from "lucide-react";

import {
  Button,
  Chip,
  MENU_ITEM,
  MENU_LABEL,
  MENU_SEPARATOR,
} from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { minutesNow } from "@/features/calendar/load-calendar";
import { weekdayOf } from "@/features/calendar/view-range";
import { cn } from "@/lib/utils";
import type { GymSessionInput } from "./actions";
import { ItemPopover, type RunRequest } from "./item-popover";
import type { SportMonthData } from "./load-sport";
import { formatKm, monthGrid, weekStats, type SportItem } from "./model";

// Kolory danych z makiety CSport: bieg = token warning (#f59e0b), siłownia #525252
export const BIEG = "#f59e0b";
export const SILA = "#525252";
// Pozycja „Dodaj trening” jak .mi z makiety (min. 44 px, kafelek ikony 28 px)
const OPCJA = `${MENU_ITEM} min-h-11 gap-2.5 py-1`;
const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const NAGLOWEK_PON = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const NAGLOWEK_ND = ["nd", "pon", "wt", "śr", "czw", "pt", "sob"];

export function MonthCalendar({
  data,
  items,
  selectedKey,
  addDate,
  onSelect,
  onAddDay,
  onOpenRun,
  onStartGym,
  onDelete,
  suspended = false,
}: {
  data: SportMonthData;
  // Treningi po filtrze Wszystko / Bieg / Siłownia
  items: SportItem[];
  selectedKey: string | null;
  addDate: IsoDate | null;
  onSelect: (key: string | null) => void;
  onAddDay: (date: IsoDate | null) => void;
  onOpenRun: (req: RunRequest) => void;
  onStartGym: (input: GymSessionInput) => void;
  onDelete: (item: SportItem) => void;
  // Okno potwierdzenia usunięcia jest otwarte: Esc i klik poza kalendarzem nie zamykają dymka
  suspended?: boolean;
}) {
  const { profile, month, today } = data;
  const wiersze = monthGrid(month, profile.weekStart);
  const otwarty = selectedKey !== null || addDate !== null;
  const kontener = useRef<HTMLDivElement>(null);

  // Otwarty dymek zamyka Esc i klik poza kalendarzem
  useEffect(() => {
    if (!otwarty || suspended) return;
    function zamknij() {
      onSelect(null);
      onAddDay(null);
    }
    function naKlawisz(e: KeyboardEvent) {
      if (e.key === "Escape") zamknij();
    }
    function naKlik(e: PointerEvent) {
      if (e.target instanceof Node && !kontener.current?.contains(e.target))
        zamknij();
    }
    document.addEventListener("keydown", naKlawisz);
    document.addEventListener("pointerdown", naKlik);
    return () => {
      document.removeEventListener("keydown", naKlawisz);
      document.removeEventListener("pointerdown", naKlik);
    };
  }, [otwarty, suspended, onSelect, onAddDay]);

  // Godzina nowego treningu z dymku dnia: teraz w strefie profilu, w dół do 15 min
  function godzinaTeraz() {
    const teraz = minutesNow(profile.timezone);
    const min = teraz - (teraz % 15);
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }

  return (
    <div>
      {/* Ramka jak .frame>.inner z makiety: border 1,5 px (border-strong), promień 12 px */}
      <div
        ref={kontener}
        data-testid="kalendarz-sportu"
        className="relative min-w-[760px] rounded-lg border-[1.5px] border-border-strong bg-white"
      >
        <div
          data-testid="naglowek-dni"
          className="grid grid-cols-[repeat(7,minmax(0,1fr))_92px] rounded-t-[10px] border-b border-border text-xs font-medium text-muted-foreground"
        >
          {(profile.weekStart === "mon" ? NAGLOWEK_PON : NAGLOWEK_ND).map(
            (d, i) => (
              <span
                key={d}
                className={cn(
                  "px-2.5 py-2",
                  i > 0 && "border-l border-border-soft",
                )}
              >
                {d}
              </span>
            ),
          )}
          <span className="border-l border-border-soft px-2.5 py-2 text-right">
            Σ tydz.
          </span>
        </div>

        {wiersze.map((dni, r) => {
          // Σ tydz.: km wykonanych biegów i wykonane treningi całego wiersza (także dni spoza miesiąca)
          const suma = weekStats(items, dni[0]);
          return (
            <div
              key={dni[0]}
              className="grid grid-cols-[repeat(7,minmax(0,1fr))_92px] border-b border-border-soft last:border-b-0"
            >
              {dni.map((date, c) => {
                const wMiesiacu = date.slice(0, 7) === month;
                const dzisiaj = date === today;
                const naDzien = items.filter((i) => i.date === date);
                const wybrany = naDzien.find((i) => i.key === selectedKey);
                const [, mm, dd] = date.split("-");
                const etykietaDnia = `${DNI[weekdayOf(date)]} ${dd}.${mm}`;
                return (
                  <div
                    key={date}
                    data-testid={`dzien-${date}`}
                    // Klik w pusty obszar dnia otwiera wybór: bieg / siłownia (jak w makiecie)
                    onClick={(e) => {
                      if (!wMiesiacu) return;
                      if (
                        e.target instanceof Element &&
                        e.target.closest("button,a,[role=dialog]")
                      )
                        return;
                      onAddDay(addDate === date ? null : date);
                    }}
                    className={cn(
                      "group relative box-border min-h-[88px] p-1.5",
                      c > 0 && "border-l border-border-soft",
                      wMiesiacu ? "cursor-pointer" : "bg-black/[.018]",
                    )}
                  >
                    <span
                      className={cn(
                        "mb-1 inline-flex size-[22px] items-center justify-center rounded-full text-xs leading-none tracking-normal tabular-nums",
                        wMiesiacu && dzisiaj
                          ? "bg-destructive-strong font-semibold text-white"
                          : wMiesiacu
                            ? "font-medium text-foreground"
                            : "text-faint-foreground",
                      )}
                    >
                      {Number(dd)}
                    </span>
                    {wMiesiacu && (
                      <button
                        type="button"
                        aria-label={`Dodaj trening, ${etykietaDnia}`}
                        onClick={() => onAddDay(addDate === date ? null : date)}
                        className="float-right flex cursor-pointer border-0 bg-transparent p-0 text-faint-foreground opacity-0 transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    )}

                    {naDzien.map((item) => {
                      const kolor = item.kind === "run" ? BIEG : SILA;
                      const wcisniety = item.key === selectedKey;
                      // Bieg wykonany: „8,0”; zaplanowany: „10 km” (bez dystansu — tytuł); siłownia: nazwa
                      let krotko = item.title;
                      if (item.kind === "run" && item.distanceKm !== null) {
                        krotko = item.planned
                          ? `${String(item.distanceKm).replace(".", ",")} km`
                          : formatKm(item.distanceKm);
                      }
                      return (
                        <button
                          key={item.key}
                          type="button"
                          aria-pressed={wcisniety}
                          aria-label={`${item.title}, ${etykietaDnia}`}
                          onClick={() => onSelect(wcisniety ? null : item.key)}
                          // Fokus przez outline, bo cień zaznaczenia zajmuje box-shadow w style
                          className="mt-1 flex w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-sm px-1.5 py-0.5 text-left text-xs font-medium whitespace-nowrap text-foreground tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
                          style={{
                            background: item.planned ? "#ffffff" : `${kolor}14`,
                            border: item.planned
                              ? `1px dashed ${kolor}`
                              : `1px solid ${kolor}30`,
                            boxShadow: wcisniety
                              ? `0 0 0 2px ${kolor}55`
                              : undefined,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="size-1.5 flex-none rounded-full"
                            style={{ background: kolor }}
                          />
                          <span className="min-w-0 truncate">{krotko}</span>
                        </button>
                      );
                    })}

                    {wybrany && (
                      <ItemPopover
                        item={wybrany}
                        openLeft={c >= 4}
                        openUp={r >= 3}
                        clock={profile.clock}
                        templates={data.templates}
                        exercises={data.exercises}
                        setsHistory={data.setsHistory}
                        profileWeight={profile.weightKg}
                        onClose={() => onSelect(null)}
                        onOpenRun={onOpenRun}
                        onStartGym={onStartGym}
                        onDelete={onDelete}
                      />
                    )}

                    {wMiesiacu && addDate === date && (
                      // .pop z makiety: promień 12 px, ramka border, cień shadow-lg, padding 4 px
                      <div
                        role="dialog"
                        aria-label="Dodaj trening"
                        className={cn(
                          "absolute z-20 box-border w-[250px] cursor-default rounded-lg border border-border bg-white bg-clip-padding p-1 text-left text-sm shadow-lg",
                          c >= 4
                            ? "right-[calc(100%+6px)]"
                            : "left-[calc(100%+6px)]",
                          r >= 3 ? "bottom-0" : "top-0",
                        )}
                      >
                        <div className="flex items-center gap-2 py-1 pr-1 pl-2">
                          <span className="text-sm font-semibold">
                            Dodaj trening
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {etykietaDnia}
                          </span>
                          <Button
                            variant="ghost"
                            size="xs"
                            icon
                            aria-label="Zamknij"
                            onClick={() => onAddDay(null)}
                            className="ml-auto"
                          >
                            <X size={14} aria-hidden="true" />
                          </Button>
                        </div>
                        <button
                          type="button"
                          className={OPCJA}
                          onClick={() =>
                            onOpenRun({ date, start: godzinaTeraz() })
                          }
                        >
                          <span
                            aria-hidden="true"
                            className="grid size-7 flex-none place-items-center rounded-[8px] bg-warning-soft text-warning-foreground"
                          >
                            <Activity size={15} />
                          </span>
                          <span className="flex flex-col">
                            <span className="font-medium">Bieg</span>
                            <span className="text-xs text-muted-foreground">
                              dystans, czas, tempo
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={OPCJA}
                          onClick={() =>
                            onStartGym({ date, start: godzinaTeraz() })
                          }
                        >
                          <span
                            aria-hidden="true"
                            className="grid size-7 flex-none place-items-center rounded-[8px] bg-muted text-soft-foreground"
                          >
                            <Dumbbell size={15} />
                          </span>
                          <span className="flex flex-col">
                            <span className="font-medium">Siłownia</span>
                            <span className="text-xs text-muted-foreground">
                              pusty trening siłowy
                            </span>
                          </span>
                        </button>
                        {data.templates.length > 0 && (
                          <>
                            <div className={MENU_SEPARATOR} />
                            <div className={MENU_LABEL}>Z szablonu</div>
                            <div className="flex flex-wrap gap-1.5 px-2 pt-0.5 pb-1.5">
                              {data.templates.map((t) => (
                                <Chip
                                  key={t.id}
                                  onClick={() =>
                                    onStartGym({
                                      date,
                                      start: t.start_time.slice(0, 5),
                                      templateId: t.id,
                                    })
                                  }
                                >
                                  {t.name}
                                </Chip>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div
                data-testid={`suma-${dni[0]}`}
                className="border-l border-border-soft bg-black/[.02] px-2.5 py-2 text-right text-[13px]"
              >
                <div className="font-semibold tabular-nums">
                  {suma.km > 0 ? `${formatKm(suma.km)} km` : "—"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {suma.done > 0 ? `${suma.done} tr.` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
