"use client";

// Miesiąc na telefonie wg MCalendarMonth.dc.html: siatka z kropkami kategorii (do 3), wybrany dzień
// czarny, pod siatką lista bloków wybranego dnia albo „Brak bloków — dodaj”.
import { useState } from "react";
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
import { DNI_SKROT, KOLOR_BRAK, MIESIACE_DOP } from "./pl";

export function MCalendarMonth({
  days,
  date,
  today,
  occurrences,
  sport = [],
  categories,
  clock,
  onAdd,
  onBlockClick,
}: {
  // 42 dni siatki (6 tygodni); rząd bez dni miesiąca „date” nie jest pokazywany
  days: IsoDate[];
  // Dzień z adresu: miesiąc widoku i początkowo wybrany dzień
  date: IsoDate;
  today: IsoDate;
  occurrences: Occurrence[];
  // Podgląd treningów (tylko do odczytu): kropka w kolorze Sportu, stuknięcie prowadzi na /sport
  sport?: SportItem[];
  categories: CategoryRow[];
  clock: "24" | "12";
  onAdd: (date: IsoDate, startMin: number) => void;
  onBlockClick: (key: string) => void;
}) {
  const [wybrany, setWybrany] = useState(date);
  // Przejście do innego dnia z zewnątrz (strzałki miesiąca) zmienia wybór (stan ustawiany w renderze)
  const [dateDla, setDateDla] = useState(date);
  if (dateDla !== date) {
    setDateDla(date);
    setWybrany(date);
  }

  const miesiac0 = Number(date.slice(5, 7)) - 1;
  const rzedy = Array.from({ length: 6 }, (_, i) =>
    days.slice(i * 7, i * 7 + 7),
  ).filter((rzad) =>
    rzad.some((dzien) => Number(dzien.slice(5, 7)) - 1 === miesiac0),
  );
  const wybraneBloki = occurrences.filter((o) => o.date === wybrany);
  const wybraneTreningi = sport.filter((i) => i.date === wybrany);
  // Bloki i treningi wybranego dnia razem, godzina rosnąco (jak na webie)
  const wpisyDnia = [
    ...wybraneBloki.map((o) => ({
      typ: "blok" as const,
      o,
      startMin: o.startMin,
    })),
    ...wybraneTreningi.map((i) => ({
      typ: "sport" as const,
      i,
      startMin: i.startMin,
    })),
  ].sort((a, b) => a.startMin - b.startMin);
  const [, mWybranego, dWybranego] = wybrany.split("-").map(Number);
  const tytul = `${dWybranego} ${MIESIACE_DOP[mWybranego - 1]}`;

  return (
    <div className="flex flex-col">
      <div className="pb-2">
        <div className="grid grid-cols-7 pb-1.5 text-center font-mono text-[11px] text-[#8a8a8a]">
          {days.slice(0, 7).map((dzien) => (
            <span key={dzien}>{DNI_SKROT[weekdayOf(dzien)]}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {rzedy.flat().map((dzien) => {
            const [, m, d] = dzien.split("-").map(Number);
            if (m - 1 !== miesiac0) {
              // Dzień sąsiedniego miesiąca: puste miejsce jak w makiecie
              return (
                <span key={dzien} aria-hidden="true" className="h-[46px]" />
              );
            }
            const aktywny = dzien === wybrany;
            // Kategorie dnia bez powtórzeń, w kolejności bloków; bez kategorii to osobny „kolor”,
            // treningi dają kropkę w kolorze Sportu
            const kolory = [
              ...new Set([
                ...occurrences
                  .filter((o) => o.date === dzien)
                  .map(
                    (o) =>
                      categories.find((k) => k.id === o.categoryId)?.color ??
                      KOLOR_BRAK,
                  ),
                ...(sport.some((i) => i.date === dzien) ? [SPORT_COLOR] : []),
              ]),
            ].slice(0, 3);
            return (
              <button
                key={dzien}
                type="button"
                aria-label={`${d} ${MIESIACE_DOP[m - 1]}`}
                aria-pressed={aktywny}
                onClick={() => setWybrany(dzien)}
                className={`flex h-[46px] cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[10px] ${
                  aktywny
                    ? "bg-[#171717]"
                    : dzien === today
                      ? "bg-[#f0f0f0]"
                      : "bg-transparent"
                }`}
              >
                <span
                  className={`font-mono text-[15px] ${aktywny ? "text-white" : "text-[#171717]"} ${dzien === today ? "font-semibold" : ""}`}
                >
                  {d}
                </span>
                <span className="flex h-[5px] gap-0.5">
                  {kolory.map((kolor) => (
                    <span
                      key={kolor}
                      data-testid="kropka-kategorii"
                      className="size-[5px] rounded-full"
                      style={{ background: aktywny ? "#ffffff" : kolor }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-[#eaeaea] pt-3.5 pb-24">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">{tytul}</h2>
          <Link
            href={`/kalendarz?widok=dzien&data=${wybrany}`}
            className="inline-flex min-h-11 items-center text-sm text-[#666666]"
          >
            Otwórz dzień
          </Link>
        </div>
        {wpisyDnia.map((wpis) => {
          if (wpis.typ === "sport") {
            const i = wpis.i;
            return (
              // Plan ma przerywaną ramkę, wykonany trening tło w kolorze Sportu
              <Link
                key={i.key}
                href={sportItemHref(i)}
                data-planned={i.planned || undefined}
                className="flex min-h-12 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[#171717] outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/30"
                style={{
                  background: i.planned ? "#ffffff" : `${SPORT_COLOR}14`,
                  border: i.planned ? `1px dashed ${SPORT_COLOR}` : undefined,
                  borderLeft: `3px ${i.planned ? "dashed" : "solid"} ${SPORT_COLOR}`,
                }}
              >
                <span className="w-[42px] font-mono text-xs text-[#555555]">
                  {formatClockTime(
                    Math.floor(i.startMin / 60),
                    i.startMin % 60,
                    clock,
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {i.title}
                </span>
              </Link>
            );
          }
          const o = wpis.o;
          const kolor =
            categories.find((k) => k.id === o.categoryId)?.color ?? KOLOR_BRAK;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onBlockClick(o.key)}
              className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left text-[#171717]"
              style={{
                background: `${kolor}14`,
                borderLeft: `3px solid ${kolor}`,
              }}
            >
              <span className="w-[42px] font-mono text-xs text-[#555555]">
                {formatClockTime(
                  Math.floor(o.startMin / 60),
                  o.startMin % 60,
                  clock,
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {o.title}
              </span>
            </button>
          );
        })}
        {wybraneBloki.length === 0 && wybraneTreningi.length === 0 && (
          <button
            type="button"
            onClick={() => onAdd(wybrany, 540)}
            className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#eaeaea] bg-white text-sm text-[#666666]"
          >
            <Plus size={16} aria-hidden="true" />
            Brak bloków — dodaj
          </button>
        )}
      </div>
    </div>
  );
}
