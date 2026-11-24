"use client";

// Tydzień na telefonie wg CMCalendarWeek.dc.html: lista dni, przy każdym odznaka dnia
// (dziś: numer w czerwonym kółku, stuknięcie otwiera dzień) i wpisy z godziną startu
// w kolorach kategorii (tło 12, ramka 4d).
import Link from "next/link";
import { Plus } from "lucide-react";

import type { IsoDate } from "@/components/controls/calendar-math";
import {
  SPORT_COLOR,
  sportItemHref,
  type SportItem,
} from "@/features/sport/model";
import { formatClockTime } from "@/lib/time/timezones";
import type { CategoryRow } from "../load-calendar";
import type { Occurrence } from "../occurrences";
import { weekdayOf } from "../view-range";
import { DNI_PELNE, DNI_SKROT, KOLOR_BRAK, MIESIACE_DOP } from "./pl";

export function MCalendarWeek({
  days,
  date,
  today,
  nowMinutes,
  occurrences,
  sport = [],
  categories,
  clock,
  onAdd,
  onBlockClick,
}: {
  // 7 dni tygodnia od jego pierwszego dnia
  days: IsoDate[];
  // Wybrany dzień (z adresu): na niego dodaje pływający „+”
  date: IsoDate;
  today: IsoDate;
  nowMinutes: number;
  occurrences: Occurrence[];
  // Podgląd treningów (tylko do odczytu): stuknięcie prowadzi na /sport
  sport?: SportItem[];
  categories: CategoryRow[];
  clock: "24" | "12";
  onAdd: (date: IsoDate, startMin: number) => void;
  onBlockClick: (key: string) => void;
}) {
  const startPlusa =
    date === today
      ? Math.min((Math.floor(nowMinutes / 60) + 1) * 60, 23 * 60)
      : 540;

  return (
    <div className="flex flex-col gap-[18px] pt-2 pb-24">
      {days.map((dzien) => {
        const numer = weekdayOf(dzien);
        const [, m, d] = dzien.split("-").map(Number);
        const nazwa = `${DNI_PELNE[numer]} ${d} ${MIESIACE_DOP[m - 1]}`;
        const dzienne = occurrences.filter((o) => o.date === dzien);
        const treningi = sport.filter((i) => i.date === dzien);
        // Bloki i treningi dnia razem, godzina rosnąco
        const wpisy = [
          ...dzienne.map((o) => ({
            typ: "blok" as const,
            o,
            startMin: o.startMin,
          })),
          ...treningi.map((i) => ({
            typ: "sport" as const,
            i,
            startMin: i.startMin,
          })),
        ].sort((a, b) => a.startMin - b.startMin);
        return (
          <section key={dzien} aria-label={nazwa} className="flex gap-3">
            <Link
              href={`/kalendarz?widok=dzien&data=${dzien}`}
              aria-label={nazwa}
              className="flex h-[52px] w-11 flex-none flex-col items-center justify-center rounded-xl bg-accent text-foreground no-underline"
            >
              <span className="text-[11px]">{DNI_SKROT[numer]}</span>
              <span
                data-dzis={dzien === today || undefined}
                className={
                  dzien === today
                    ? "inline-flex size-7 items-center justify-center rounded-full bg-destructive-strong text-base leading-none font-semibold tracking-normal text-white tabular-nums"
                    : "text-lg font-medium tabular-nums"
                }
              >
                {d}
              </span>
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
              {dzienne.length === 0 && treningi.length === 0 && (
                <span className="flex min-h-11 items-center text-sm text-muted-foreground">
                  Brak bloków
                </span>
              )}
              {wpisy.map((wpis) => {
                if (wpis.typ === "sport") {
                  const i = wpis.i;
                  // Plan ma przerywaną ramkę
                  return (
                    <Link
                      key={i.key}
                      href={sportItemHref(i)}
                      data-planned={i.planned || undefined}
                      className={`box-border flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-foreground no-underline outline-none focus-visible:shadow-focus ${i.planned ? "bg-background" : ""}`}
                      style={{
                        background: i.planned ? undefined : `${SPORT_COLOR}12`,
                        border: i.planned
                          ? `1px dashed ${SPORT_COLOR}`
                          : `1px solid ${SPORT_COLOR}4d`,
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {i.title}
                      </span>
                      <span className="flex-none text-xs text-muted-foreground tabular-nums">
                        {formatClockTime(
                          Math.floor(i.startMin / 60),
                          i.startMin % 60,
                          clock,
                        )}
                      </span>
                    </Link>
                  );
                }
                const o = wpis.o;
                const kolor =
                  categories.find((k) => k.id === o.categoryId)?.color ??
                  KOLOR_BRAK;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => onBlockClick(o.key)}
                    className="box-border flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2.5 text-left text-foreground"
                    style={{
                      background: `${kolor}12`,
                      border: `1px solid ${kolor}4d`,
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {o.title}
                    </span>
                    <span className="flex-none text-xs text-muted-foreground tabular-nums">
                      {formatClockTime(
                        Math.floor(o.startMin / 60),
                        o.startMin % 60,
                        clock,
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <button
        type="button"
        aria-label="Nowy wpis"
        onClick={() => onAdd(date, startPlusa)}
        className="m-fab"
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    </div>
  );
}
