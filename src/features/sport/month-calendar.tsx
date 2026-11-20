"use client";

// Kalendarz miesiąca Sportu (Sport.dc.html, „KALENDARZ: MIESIĄC”): 6 tygodni wg początku tygodnia,
// chipy treningów, kolumna „Σ tydz.”, dymek treningu i dymek dnia „Dodaj trening”.
import { useEffect, useRef } from "react";

import type { IsoDate } from "@/components/controls/calendar-math";
import { minutesNow } from "@/features/calendar/load-calendar";
import { weekdayOf } from "@/features/calendar/view-range";
import { cn } from "@/lib/utils";
import type { GymSessionInput } from "./actions";
import { ItemPopover, type RunRequest } from "./item-popover";
import type { SportMonthData } from "./load-sport";
import { formatKm, monthGrid, weekStats, type SportItem } from "./model";

const BIEG = "#c2410c";
const SILA = "#404040";
const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const NAGLOWEK_PON = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const NAGLOWEK_ND = ["nd", "pon", "wt", "śr", "czw", "pt", "sob"];
const OPCJA =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent p-2 text-left text-foreground outline-none hover:bg-muted focus-visible:bg-muted";

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
      <div
        ref={kontener}
        data-testid="kalendarz-sportu"
        className="relative min-w-[760px] rounded-lg border border-border"
      >
        <div
          data-testid="naglowek-dni"
          className="grid grid-cols-[repeat(7,minmax(0,1fr))_88px] rounded-t-lg border-b border-border bg-panel font-mono text-[11px] text-muted-foreground"
        >
          {(profile.weekStart === "mon" ? NAGLOWEK_PON : NAGLOWEK_ND).map(
            (d, i) => (
              <span
                key={d}
                className={cn(
                  "px-2.5 py-2",
                  i > 0 && "border-l border-border",
                )}
              >
                {d}
              </span>
            ),
          )}
          <span className="border-l border-border px-2.5 py-2 text-right">
            Σ tydz.
          </span>
        </div>

        {wiersze.map((dni, r) => {
          // Σ tydz.: km wykonanych biegów i wykonane treningi całego wiersza (także dni spoza miesiąca)
          const suma = weekStats(items, dni[0]);
          return (
            <div
              key={dni[0]}
              className="grid grid-cols-[repeat(7,minmax(0,1fr))_88px] border-b border-border last:border-b-0"
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
                      "group relative box-border min-h-[86px] px-2 py-1.5",
                      c > 0 && "border-l border-border",
                      wMiesiacu
                        ? "cursor-pointer hover:bg-panel"
                        : "bg-panel",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block text-xs",
                        wMiesiacu && dzisiaj
                          ? "rounded bg-success px-[5px] font-semibold text-white"
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
                        className="float-right cursor-pointer border-0 bg-transparent p-0 font-mono text-[13px] leading-none text-faint-foreground opacity-0 transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        +
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
                          className="mt-1 block w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left font-mono text-[11px] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                          style={{
                            color: item.planned ? kolor : "#171717",
                            background: item.planned ? "#ffffff" : `${kolor}18`,
                            border: item.planned
                              ? `1px dashed ${kolor}`
                              : `1px solid ${kolor}40`,
                            boxShadow: wcisniety
                              ? `0 0 0 2px ${kolor}55`
                              : undefined,
                          }}
                        >
                          {item.kind === "run" ? "●" : "■"} {krotko}
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
                      <div
                        role="dialog"
                        aria-label="Dodaj trening"
                        className={cn(
                          "absolute z-20 box-border w-60 cursor-default rounded-xl border border-input bg-white p-2 text-left text-sm shadow-[0_16px_48px_rgba(0,0,0,.16)]",
                          c >= 4
                            ? "right-[calc(100%+6px)]"
                            : "left-[calc(100%+6px)]",
                          r >= 3 ? "bottom-0" : "top-0",
                        )}
                      >
                        <div className="flex items-center gap-2 px-1 pt-0.5 pb-2">
                          <span className="text-[13px] font-semibold">
                            Dodaj trening
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {etykietaDnia}
                          </span>
                          <button
                            type="button"
                            aria-label="Zamknij"
                            onClick={() => onAddDay(null)}
                            className="ml-auto size-6 cursor-pointer rounded-md border-0 bg-transparent text-xs text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/20"
                          >
                            ✕
                          </button>
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
                            className="flex size-7 items-center justify-center rounded-md border border-warning-border bg-warning-soft text-xs text-warning-foreground"
                          >
                            ●
                          </span>
                          <span className="flex flex-col">
                            <span className="text-[13px] font-medium">
                              Bieg
                            </span>
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
                            className="flex size-7 items-center justify-center rounded-md border border-input bg-muted text-xs text-soft-foreground"
                          >
                            ■
                          </span>
                          <span className="flex flex-col">
                            <span className="text-[13px] font-medium">
                              Siłownia
                            </span>
                            <span className="text-xs text-muted-foreground">
                              pusty trening siłowy
                            </span>
                          </span>
                        </button>
                        {data.templates.length > 0 && (
                          <>
                            <div className="mx-0 mt-1.5 mb-1 border-t border-border" />
                            <div className="px-2 py-1 font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
                              Z szablonu
                            </div>
                            <div className="flex flex-wrap gap-1.5 px-2 pt-0.5 pb-1">
                              {data.templates.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() =>
                                    onStartGym({
                                      date,
                                      start: t.start_time.slice(0, 5),
                                      templateId: t.id,
                                    })
                                  }
                                  className="cursor-pointer rounded-full border border-input bg-white px-2.5 py-[3px] text-xs text-soft-foreground outline-none hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring/20"
                                >
                                  {t.name}
                                </button>
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
                className="border-l border-border bg-panel px-2.5 py-2 text-right font-mono text-xs"
              >
                <div className="font-medium">
                  {suma.km > 0 ? `${formatKm(suma.km)} km` : "—"}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
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
