"use client";

// Karta „Sen”: ostatnia noc i wykres słupkowy z linią celu (CHabits.dc.html, karta „Sen”)
import { useState, type KeyboardEvent } from "react";

import { CardHeader, CardTitle, Segment, StatusBadge } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";
import { sleepMinutes, sleepStats, type SleepLog } from "./sleep";
import { formatDuration } from "./text";

const WYSOKOSC = 150; // px, wysokość wykresu

export function SleepCard({
  sleepLogs,
  today,
  goalMin,
  clock,
  onOpenLast,
}: {
  sleepLogs: SleepLog[];
  today: IsoDate;
  goalMin: number;
  clock: "24" | "12";
  // Klik w „Ostatnią noc” otwiera okno edycji tego wpisu
  onOpenLast?: (log: SleepLog) => void;
}) {
  const [zakres, setZakres] = useState<"14" | "30">("14");
  // Słupek pod myszą albo z fokusem: indeks i element (do pozycji dymka)
  const [najechany, setNajechany] = useState<{
    k: number;
    el: HTMLElement;
  } | null>(null);

  // Ostatnia noc = wpis z najpóźniejszą datą (nie z przyszłości)
  let ostatnia: SleepLog | null = null;
  for (const log of sleepLogs) {
    if (log.date <= today && (ostatnia === null || log.date > ostatnia.date))
      ostatnia = log;
  }
  const minutyOstatniej = ostatnia
    ? sleepMinutes(ostatnia.sleptAt, ostatnia.wokeAt)
    : null;
  // „23:48 → 07:00” w formacie zegara z profilu
  let godziny = "";
  if (ostatnia) {
    const [hs, ms] = ostatnia.sleptAt.split(":").map(Number);
    const [hw, mw] = ostatnia.wokeAt.split(":").map(Number);
    godziny = `${formatClockTime(hs, ms, clock)} → ${formatClockTime(hw, mw, clock)}`;
  }

  const { bars } = sleepStats(
    sleepLogs,
    today,
    zakres === "14" ? 14 : 30,
    goalMin,
  );
  // Skala jak w makiecie: cel 8 h na 8/9 wysokości, chyba że któraś noc była dłuższa
  let skala = (goalMin * 9) / 8;
  for (const b of bars)
    if (b.minutes !== null && b.minutes > skala) skala = b.minutes;
  const liniaCelu = Math.round((goalMin / skala) * WYSOKOSC);
  const celTekst =
    goalMin % 60 === 0 ? `${goalMin / 60}` : formatDuration(goalMin);

  // '2026-11-17' → '17.11'
  const krotko = (d: IsoDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

  return (
    // Klasy .card (jak Card), ale jako <section> — e2e szuka sekcji po nagłówku
    <section className="relative flex flex-col rounded-xl border border-border bg-white bg-clip-padding shadow-card">
      <CardHeader className="flex-wrap items-center">
        <CardTitle as="h2">Sen</CardTitle>
        <Segment
          ariaLabel="Zakres snu"
          value={zakres}
          onChange={(v) => {
            setZakres(v);
            setNajechany(null);
          }}
          options={[
            { value: "14", label: "14 dni" },
            { value: "30", label: "30 dni" },
          ]}
        />
      </CardHeader>

      <div className="flex flex-1 flex-col gap-4 px-6 pt-4 pb-5">
        <div className="flex gap-7">
          <div
            // Z wpisem i obsługą kliknięcia blok działa jak przycisk (fokus z klawiatury, Enter/Spacja)
            {...(ostatnia && onOpenLast
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick: () => onOpenLast(ostatnia),
                  onKeyDown: (e: KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenLast(ostatnia);
                    }
                  },
                }
              : {})}
            className={cn(
              "-m-1.5 rounded-md p-1.5",
              ostatnia &&
                onOpenLast &&
                "cursor-pointer outline-none hover:bg-panel focus-visible:shadow-focus",
            )}
          >
            <div className="text-xs font-medium text-muted-foreground">Ostatnia noc</div>
            {ostatnia && onOpenLast && (
              <span className="sr-only">Edytuj ostatnią noc</span>
            )}
            <div className="mt-1.5 text-xl font-semibold tabular-nums">
              {minutyOstatniej === null ? "—" : formatDuration(minutyOstatniej)}
            </div>
            {ostatnia && (
              <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {godziny}
              </div>
            )}
          </div>
          {ostatnia?.feeling != null && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">Samopoczucie</div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums">{`${ostatnia.feeling}/5`}</div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "relative mt-auto flex items-end border-b border-border",
            zakres === "30" ? "gap-[3px]" : "gap-[5px]",
          )}
          style={{ height: WYSOKOSC }}
          onMouseLeave={() => setNajechany(null)}
        >
          {/* Linia celu (przerywana) z podpisem */}
          <div
            className="absolute right-0 left-0 border-t border-dashed border-success"
            style={{ bottom: liniaCelu }}
          />
          {/* Podpis celu jako odznaka .bdg.ok tuż nad linią; nieprzezroczyste tło (bg-card) pod półprzezroczystym zielonym, by tekst był czytelny nad słupkiem */}
          <span className="absolute right-0 flex rounded-sm bg-card" style={{ bottom: liniaCelu + 5 }}>
            <StatusBadge tone="green">cel {celTekst} h</StatusBadge>
          </span>

          {bars.map((b, k) => {
            const opis = `${krotko(b.date)} · ${b.minutes === null ? "brak wpisu" : formatDuration(b.minutes)}`;
            const wysokosc =
              b.minutes === null
                ? 0
                : Math.round((b.minutes / skala) * WYSOKOSC);
            return (
              <div
                key={b.date}
                data-sleep-bar
                role="img"
                // Fokus tylko na słupkach z wpisem (pusty dzień nie ma dymka)
                tabIndex={b.minutes === null ? undefined : 0}
                aria-label={opis}
                onMouseEnter={(e) => setNajechany({ k, el: e.currentTarget })}
                onFocus={(e) => setNajechany({ k, el: e.currentTarget })}
                onBlur={() => setNajechany(null)}
                // Zaznaczenie (mysz/fokus) to pierścień w style, a fokus klawiatury osobny obrys
                className={cn(
                  "flex-1 cursor-default rounded-t-[4px] outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  b.met ? "bg-success" : "bg-border-strong",
                )}
                style={{
                  height: wysokosc,
                  boxShadow:
                    najechany?.k === k ? "0 0 0 2px var(--foreground)" : undefined,
                }}
              />
            );
          })}

          {najechany !== null && bars[najechany.k]?.minutes != null && (
            // Dymek nad słupkiem: data pogrubiona, pod nią czas (dla czytników „17.11 · 7:12”)
            <ChartTooltip anchor={najechany.el}>
              <div className="font-semibold tabular-nums">
                {krotko(bars[najechany.k].date)}
              </div>
              <span className="sr-only"> · </span>
              <div className="mt-0.5 text-muted-foreground tabular-nums">
                {formatDuration(bars[najechany.k].minutes ?? 0)}
              </div>
            </ChartTooltip>
          )}
        </div>
        <div className="-mt-2.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{krotko(bars[0].date)}</span>
          <span>{krotko(today)}</span>
        </div>
      </div>
    </section>
  );
}
