"use client";

// Tydzień na telefonie wg MCalendarWeek.dc.html: lista dni, przy każdym plakietka dnia
// (dziś czarna, stuknięcie otwiera dzień) i bloki z godziną startu.
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
              className={`flex h-[52px] w-11 flex-none flex-col items-center justify-center rounded-xl ${
                dzien === today
                  ? "bg-primary text-white"
                  : "bg-muted text-foreground"
              }`}
            >
              <span className="text-[11px]">{DNI_SKROT[numer]}</span>
              <span className="font-mono text-lg font-medium">{d}</span>
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
              {dzienne.length === 0 && treningi.length === 0 && (
                <span className="flex min-h-10 items-center text-sm text-muted-foreground">
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
                      className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-foreground outline-none focus-visible:shadow-focus"
                      style={{
                        background: i.planned ? "#ffffff" : `${SPORT_COLOR}14`,
                        border: i.planned
                          ? `1px dashed ${SPORT_COLOR}`
                          : undefined,
                        borderLeft: `3px ${i.planned ? "dashed" : "solid"} ${SPORT_COLOR}`,
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {i.title}
                      </span>
                      <span className="font-mono text-[11px] text-soft-foreground">
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
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-foreground"
                    style={{
                      background: `${kolor}14`,
                      borderLeft: `3px solid ${kolor}`,
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {o.title}
                    </span>
                    <span className="font-mono text-[11px] text-soft-foreground">
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
        aria-label="Dodaj blok"
        onClick={() => onAdd(date, startPlusa)}
        // 16 px nad dolnym paskiem (ta sama zmienna co wysokość paska)
        className="fixed right-4 bottom-[calc(var(--tabbar-h)+16px)] z-30 flex size-14 cursor-pointer items-center justify-center rounded-2xl bg-primary text-white shadow-[0_8px_20px_rgba(0,0,0,.18)]"
      >
        <Plus size={26} aria-hidden="true" />
      </button>
    </div>
  );
}
