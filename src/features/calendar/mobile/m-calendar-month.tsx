"use client";

// Miesiąc na telefonie wg CMCalendarMonth.dc.html: siatka z kropkami kategorii (do 3), wybrany dzień
// czarny (dziś wybrane to sama czarna kafelka, dziś niewybrane ma czerwone kółko), pod siatką lista
// wpisów wybranego dnia w kolorach kategorii albo przerywany przycisk „Brak bloków — dodaj”.
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/controls";
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
      <div className="px-3 pt-1 pb-2">
        <div className="grid grid-cols-7 pb-1.5 text-center text-xs font-medium text-muted-foreground">
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
                className={`flex h-[46px] cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[10px] border-0 ${
                  aktywny
                    ? "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.16)]"
                    : "bg-transparent text-foreground"
                }`}
              >
                <span
                  data-dzis={dzien === today || undefined}
                  className={
                    dzien === today && !aktywny
                      ? "inline-flex size-[26px] items-center justify-center rounded-full bg-destructive-strong text-sm leading-none font-semibold tracking-normal text-white tabular-nums"
                      : "text-[15px] tabular-nums"
                  }
                >
                  {d}
                </span>
                <span className="flex h-[5px] gap-0.5">
                  {kolory.map((kolor) => (
                    <span
                      key={kolor}
                      data-testid="kropka-kategorii"
                      className="size-[5px] rounded-full"
                      style={{ background: aktywny ? "#fafafa" : kolor }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border px-4 pt-3.5 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] leading-[1.3] font-semibold">{tytul}</h2>
          <Button variant="ghost" asChild className="px-1">
            <Link href={`/kalendarz?widok=dzien&data=${wybrany}`}>
              Otwórz dzień
            </Link>
          </Button>
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
                className={`box-border flex min-h-12 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-foreground no-underline outline-none focus-visible:shadow-focus ${i.planned ? "bg-background" : ""}`}
                style={{
                  background: i.planned ? undefined : `${SPORT_COLOR}12`,
                  border: i.planned
                    ? `1px dashed ${SPORT_COLOR}`
                    : `1px solid ${SPORT_COLOR}4d`,
                }}
              >
                <span className="w-[42px] flex-none text-xs text-muted-foreground tabular-nums">
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
              className="box-border flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left text-foreground"
              style={{
                background: `${kolor}12`,
                border: `1px solid ${kolor}4d`,
              }}
            >
              <span className="w-[42px] flex-none text-xs text-muted-foreground tabular-nums">
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
          <Button
            className="h-14 w-full border-dashed text-muted-foreground shadow-none max-[799px]:h-14"
            onClick={() => onAdd(wybrany, 540)}
          >
            <Plus size={16} aria-hidden="true" />
            Brak bloków — dodaj
          </Button>
        )}
      </div>
    </div>
  );
}
