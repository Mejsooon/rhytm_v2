"use client";

// Dzień na telefonie wg CMCalendarDay.dc.html: pasek tygodnia z kropkami, wiersz z datą, oś całej doby
// (56 px na godzinę, start przewinięty do 07:00 albo do trwającego bloku), linia „teraz”,
// stuknięcie pustego miejsca i pływający „+” dodają blok.
// Pasek tygodnia i wiersz z datą stoją w miejscu; oś wypełnia resztę ekranu do dolnego paska
// (flex) i tylko ona się przewija.
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { StatusBadge } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import {
  SPORT_COLOR,
  sportItemHref,
  type SportItem,
} from "@/features/sport/model";
import { occurrenceProgress, type TaskRow } from "@/features/tasks/model";
import { formatClockTime } from "@/lib/time/timezones";
import { layoutDay, nowLine } from "../day-layout";
import type { CategoryRow } from "../load-calendar";
import type { Occurrence } from "../occurrences";
import { viewRange, weekdayOf } from "../view-range";
import {
  DNI_PELNE,
  DNI_SKROT,
  KOLOR_BRAK,
  MIESIACE_DOP,
  WYSOKOSC_GODZINY,
} from "./pl";

export function MCalendarDay({
  date,
  today,
  weekStart,
  nowMinutes,
  occurrences,
  sport = [],
  categories,
  clock,
  tasks = [],
  onAdd,
  onBlockClick,
}: {
  date: IsoDate;
  today: IsoDate;
  weekStart: "mon" | "sun";
  nowMinutes: number;
  // Widoczne wystąpienia całego tygodnia wybranego dnia (z nich kropki paska i bloki dnia)
  occurrences: Occurrence[];
  // Podgląd treningów tygodnia (tylko do odczytu): stuknięcie prowadzi na /sport
  sport?: SportItem[];
  categories: CategoryRow[];
  clock: "24" | "12";
  // Zadania kalendarza: pasek „Zaplanowane…” liczy z nich „zadania A/B” dnia
  tasks?: TaskRow[];
  onAdd: (date: IsoDate, startMin: number) => void;
  // Stuknięcie bloku (klucz wystąpienia); szczegóły otwiera arkusz u rodzica
  onBlockClick: (key: string) => void;
}) {
  const osRef = useRef<HTMLDivElement>(null);
  const dniTygodnia = viewRange("tydzien", date, weekStart).days;
  const dnia = occurrences.filter((o) => o.date === date);
  const treningi = sport.filter((i) => i.date === date);
  // Bloki i treningi dzielą szerokość przy nakładaniu
  const uklad = layoutDay([...dnia, ...treningi]);
  const linia = nowLine({ date: today, minutes: nowMinutes }, date);

  const [, miesiac, numerDnia] = date.split("-").map(Number);
  const tytul = `${DNI_PELNE[weekdayOf(date)]}, ${numerDnia} ${MIESIACE_DOP[miesiac - 1]}`;
  const liczba = dnia.length;
  // Odmiana: 1 blok; 2–4, 22–24, 32–34… bloki (ale 12–14 bloków); reszta bloków
  const slowoBlok =
    liczba === 1
      ? "blok"
      : liczba % 10 >= 2 &&
          liczba % 10 <= 4 &&
          (liczba % 100 < 12 || liczba % 100 > 14)
        ? "bloki"
        : "bloków";

  // Pasek pod datą: zaplanowany czas (bloki i treningi bez dublowania nakładających się), wolny czas
  // między 8:00 a 20:00 i zadania bloków dnia (wykonane/wszystkie)
  const przedzialy = [...dnia, ...treningi]
    .map((i) => ({
      od: i.startMin,
      do: i.startMin + Math.min(i.durationMin, 1440 - i.startMin),
    }))
    .sort((a, b) => a.od - b.od);
  let zaplanowaneMin = 0;
  let zajeteWDzienMin = 0;
  let koniecScalonego = 0;
  for (const p of przedzialy) {
    const od = Math.max(p.od, koniecScalonego);
    if (p.do <= od) continue;
    zaplanowaneMin += p.do - od;
    zajeteWDzienMin += Math.max(
      0,
      Math.min(p.do, 20 * 60) - Math.max(od, 8 * 60),
    );
    koniecScalonego = p.do;
  }
  const wolneMin = 12 * 60 - zajeteWDzienMin;
  // „2 h 30 min”, „3 h”, „45 min”, „0 h”
  const naGodziny = (min: number) =>
    min === 0
      ? "0 h"
      : [
          min >= 60 ? `${Math.floor(min / 60)} h` : null,
          min % 60 > 0 ? `${min % 60} min` : null,
        ]
          .filter(Boolean)
          .join(" ");
  let zadanWykonanych = 0;
  let zadanRazem = 0;
  for (const o of dnia) {
    const { done, total } = occurrenceProgress(
      tasks,
      o.blockId,
      o.key.slice(o.blockId.length + 1),
    );
    zadanWykonanych += done;
    zadanRazem += total;
  }

  // Oś startuje na 07:00; w dzisiejszym dniu z trwającym blokiem na jego początku (z zapasem pół godziny)
  useEffect(() => {
    const os = osRef.current;
    if (!os) return;
    const trwajacy =
      linia === null
        ? undefined
        : dnia.find(
            (o) => o.startMin <= linia && linia < o.startMin + o.durationMin,
          );
    os.scrollTop = trwajacy
      ? Math.round(
          (trwajacy.startMin / 60) * WYSOKOSC_GODZINY - WYSOKOSC_GODZINY / 2,
        )
      : 7 * WYSOKOSC_GODZINY;
    // Tylko przy wejściu na dzień: późniejsze zmiany danych nie mogą odsuwać przewiniętej osi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Domyślna godzina „+”: dziś najbliższa pełna godzina, inny dzień 09:00
  const startPlusa =
    date === today
      ? Math.min((Math.floor(nowMinutes / 60) + 1) * 60, 23 * 60)
      : 540;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="group"
        aria-label="Dzień tygodnia"
        className="grid flex-none grid-cols-7 gap-1 px-3 pt-0.5 pb-2"
      >
        {dniTygodnia.map((dzien) => {
          const numer = weekdayOf(dzien);
          const wybrany = dzien === date;
          const maBloki =
            occurrences.some((o) => o.date === dzien) ||
            sport.some((i) => i.date === dzien);
          const [, m, d] = dzien.split("-").map(Number);
          return (
            <Link
              key={dzien}
              href={`/kalendarz?widok=dzien&data=${dzien}`}
              aria-label={`${DNI_PELNE[numer]} ${d} ${MIESIACE_DOP[m - 1]}`}
              aria-current={wybrany ? "date" : undefined}
              className={`flex h-[58px] flex-col items-center gap-0.5 rounded-xl py-1.5 no-underline ${
                wybrany
                  ? "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.16)]"
                  : "text-foreground"
              }`}
            >
              <span className="text-[11px] opacity-75">{DNI_SKROT[numer]}</span>
              <span
                data-dzis={dzien === today || undefined}
                className={
                  // Dziś (niewybrane): czerwone kółko 24 px; wybrany dzień to sam ciemny kafelek
                  dzien === today && !wybrany
                    ? "inline-flex size-6 items-center justify-center rounded-full bg-destructive-strong text-sm leading-none font-semibold tracking-normal text-white tabular-nums"
                    : "text-base font-medium tabular-nums"
                }
              >
                {d}
              </span>
              {maBloki ? (
                <span
                  data-testid={`kropka-${dzien}`}
                  className={`size-1 rounded-full ${wybrany ? "bg-primary-foreground" : "bg-success"}`}
                />
              ) : (
                <span className="size-1" />
              )}
            </Link>
          );
        })}
      </div>

      <div
        data-testid="m-wiersz-daty"
        className="flex flex-none items-center gap-2 border-y border-border px-4 py-2 text-[13px] text-muted-foreground"
      >
        <span>{tytul}</span>
        <span aria-hidden="true">·</span>
        <StatusBadge
          tone="gray"
          className="tabular-nums"
        >{`${liczba} ${slowoBlok}`}</StatusBadge>
      </div>

      <div
        data-testid="m-pasek-dnia"
        className="flex-none border-b border-border px-4 py-2 text-xs text-muted-foreground tabular-nums"
      >
        {`Zaplanowane ${naGodziny(zaplanowaneMin)} · wolne (8–20) ${naGodziny(wolneMin)} · zadania ${zadanWykonanych}/${zadanRazem}`}
      </div>

      <div
        ref={osRef}
        data-testid="m-os-dnia"
        // Wypełnia resztę ekranu; dolny odstęp 96 px, żeby pływający „+” nie zasłaniał ostatniej godziny
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-2.5 pb-24"
      >
        <div className="relative" style={{ height: 24 * WYSOKOSC_GODZINY }}>
          {Array.from({ length: 24 }, (_, godzina) => (
            <div
              key={godzina}
              className="absolute inset-x-0 flex items-start gap-2"
              style={{ top: godzina * WYSOKOSC_GODZINY }}
            >
              <span className="w-10 -translate-y-[7px] text-right text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
                {formatClockTime(godzina, 0, clock)}
              </span>
              <span className="flex-1 border-t border-border" />
            </div>
          ))}

          {/* Puste miejsce na osi: stuknięcie dodaje blok o tej godzinie (z dokładnością do 30 min) */}
          <button
            type="button"
            aria-label="Dodaj wpis w wolnym miejscu"
            className="absolute top-0 right-0 bottom-0 left-12 cursor-pointer"
            onClick={(e) => {
              const gora = e.currentTarget.getBoundingClientRect().top;
              const minuty =
                Math.floor(((e.clientY - gora) / WYSOKOSC_GODZINY) * 2) * 30;
              onAdd(date, Math.min(Math.max(minuty, 0), 23 * 60 + 30));
            }}
          />

          {dnia.map((o) => {
            const pozycja = uklad.find((u) => u.key === o.key);
            const kolumna = pozycja?.col ?? 0;
            const kolumn = pozycja?.cols ?? 1;
            const kategoria = categories.find((k) => k.id === o.categoryId);
            const kolor = kategoria?.color ?? KOLOR_BRAK;
            // Blok nie wychodzi poza dolną krawędź osi
            const czas = Math.min(o.durationMin, 1440 - o.startMin);
            const koniec = o.startMin + czas;
            const godziny = `${formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}–${formatClockTime(Math.floor(koniec / 60), koniec % 60, clock)}`;
            // Bloki krótsze niż godzina: tytuł i godziny w jednej linii, wyśrodkowane w pionie
            const kompakt = czas < 60;
            const wysokosc = (czas / 60) * WYSOKOSC_GODZINY - 4;
            // Niski blok zachowuje wygląd, ale pole dotyku ma co najmniej 44 px (przezroczysty obszar
            // wystający poza blok; przy sąsiadach wygrywa blok późniejszy w DOM)
            const zapas = wysokosc < 44 ? (44 - wysokosc) / 2 : 0;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => onBlockClick(o.key)}
                className="absolute z-[2] box-border cursor-pointer rounded-[10px] px-2.5 text-left text-foreground"
                style={{
                  top: (o.startMin / 60) * WYSOKOSC_GODZINY + 1,
                  height: wysokosc,
                  left: `calc(52px + (100% - 56px) * ${kolumna / kolumn})`,
                  width: `calc((100% - 56px) / ${kolumn})`,
                  background: `${kolor}12`,
                  border: `1px solid ${kolor}4d`,
                }}
              >
                {zapas > 0 && (
                  <span
                    aria-hidden="true"
                    data-testid="obszar-dotyku"
                    className="absolute inset-x-0"
                    style={{ top: -zapas, bottom: -zapas }}
                  />
                )}
                {kompakt ? (
                  // Krótki blok: tytuł ucina się wielokropkiem, godziny zostają w całości
                  <span
                    data-testid="blok-jedna-linia"
                    className="flex h-full items-center gap-2 overflow-hidden"
                  >
                    <span className="min-w-0 truncate text-sm leading-[18px] font-medium whitespace-nowrap">
                      {o.title}
                    </span>
                    <span className="flex-none text-xs leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
                      {godziny}
                    </span>
                  </span>
                ) : (
                  <span className="flex h-full flex-col gap-0.5 overflow-hidden py-1.5">
                    <span className="min-w-0 truncate text-sm leading-[18px] font-medium">
                      {o.title}
                    </span>
                    <span className="truncate text-xs leading-4 text-muted-foreground tabular-nums">
                      {`${godziny} · ${kategoria?.name ?? "Bez kategorii"}`}
                    </span>
                  </span>
                )}
              </button>
            );
          })}

          {treningi.map((i) => {
            const pozycja = uklad.find((u) => u.key === i.key);
            const kolumna = pozycja?.col ?? 0;
            const kolumn = pozycja?.cols ?? 1;
            const czas = Math.min(i.durationMin, 1440 - i.startMin);
            const koniec = i.startMin + czas;
            const godziny = `${formatClockTime(Math.floor(i.startMin / 60), i.startMin % 60, clock)}–${formatClockTime(Math.floor(koniec / 60), koniec % 60, clock)}`;
            const wysokosc = (czas / 60) * WYSOKOSC_GODZINY - 4;
            // Pole dotyku co najmniej 44 px, jak przy blokach
            const zapas = wysokosc < 44 ? (44 - wysokosc) / 2 : 0;
            return (
              // Plan: przerywana ramka; wykonany: tło w kolorze Sportu
              <Link
                key={i.key}
                href={sportItemHref(i)}
                data-planned={i.planned || undefined}
                className={`absolute z-[2] box-border rounded-[10px] px-2.5 text-left text-foreground outline-none focus-visible:shadow-focus ${i.planned ? "bg-background" : ""}`}
                style={{
                  top: (i.startMin / 60) * WYSOKOSC_GODZINY + 1,
                  height: wysokosc,
                  left: `calc(52px + (100% - 56px) * ${kolumna / kolumn})`,
                  width: `calc((100% - 56px) / ${kolumn})`,
                  background: i.planned ? undefined : `${SPORT_COLOR}12`,
                  border: i.planned ? `1px dashed ${SPORT_COLOR}` : undefined,
                  borderLeft: `3px ${i.planned ? "dashed" : "solid"} ${SPORT_COLOR}`,
                }}
              >
                {zapas > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0"
                    style={{ top: -zapas, bottom: -zapas }}
                  />
                )}
                <span
                  className={`flex h-full overflow-hidden ${czas < 60 ? "items-center gap-2" : "flex-col gap-0.5 py-1.5"}`}
                >
                  <span className="min-w-0 truncate text-sm leading-[18px] font-medium whitespace-nowrap">
                    {i.title}
                  </span>
                  <span className="flex-none truncate text-xs leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
                    {czas < 60 ? godziny : `${godziny} · Sport`}
                  </span>
                </span>
              </Link>
            );
          })}

          {linia !== null && (
            <div
              data-testid="linia-teraz"
              aria-hidden="true"
              className="pointer-events-none absolute right-0 left-[42px] z-[3] h-0.5 bg-destructive"
              style={{ top: (linia / 60) * WYSOKOSC_GODZINY }}
            >
              <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-destructive" />
            </div>
          )}
        </div>
      </div>

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
