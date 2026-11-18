"use client";

// Karta „Sen”: ostatnia noc i wykres słupkowy z linią celu (Habits.dc.html, „RZĄD 2”)
import { useState } from "react";

import { MonoLabel, Segment } from "@/components/controls";
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
}: {
  sleepLogs: SleepLog[];
  today: IsoDate;
  goalMin: number;
  clock: "24" | "12";
}) {
  const [zakres, setZakres] = useState<"14" | "30">("14");
  // Słupek pod myszą albo z fokusem: indeks i element (do pozycji dymka)
  const [najechany, setNajechany] = useState<{ k: number; el: HTMLElement } | null>(null);

  // Ostatnia noc = wpis z najpóźniejszą datą (nie z przyszłości)
  let ostatnia: SleepLog | null = null;
  for (const log of sleepLogs) {
    if (log.date <= today && (ostatnia === null || log.date > ostatnia.date)) ostatnia = log;
  }
  const minutyOstatniej = ostatnia ? sleepMinutes(ostatnia.sleptAt, ostatnia.wokeAt) : null;
  // „23:48 → 07:00” w formacie zegara z profilu
  let godziny = "";
  if (ostatnia) {
    const [hs, ms] = ostatnia.sleptAt.split(":").map(Number);
    const [hw, mw] = ostatnia.wokeAt.split(":").map(Number);
    godziny = `${formatClockTime(hs, ms, clock)} → ${formatClockTime(hw, mw, clock)}`;
  }

  const { bars } = sleepStats(sleepLogs, today, zakres === "14" ? 14 : 30, goalMin);
  // Skala jak w makiecie: cel 8 h na 8/9 wysokości, chyba że któraś noc była dłuższa
  let skala = (goalMin * 9) / 8;
  for (const b of bars) if (b.minutes !== null && b.minutes > skala) skala = b.minutes;
  const liniaCelu = Math.round((goalMin / skala) * WYSOKOSC);
  const celTekst = goalMin % 60 === 0 ? `${goalMin / 60}` : formatDuration(goalMin);

  // '2026-11-17' → '17.11'
  const krotko = (d: IsoDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

  return (
    <section className="flex flex-col rounded-lg border border-[#eaeaea] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#eaeaea] px-4 py-3.5">
        <h2 className="m-0 text-[15px] font-semibold">Sen</h2>
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
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex gap-6">
          <div>
            <MonoLabel className="block">Ostatnia noc</MonoLabel>
            <div className="mt-1.5 font-mono text-xl">
              {minutyOstatniej === null ? "—" : formatDuration(minutyOstatniej)}
            </div>
            {ostatnia && <div className="mt-0.5 font-mono text-[11px] text-[#6b6b6b]">{godziny}</div>}
          </div>
          {ostatnia?.feeling != null && (
            <div>
              <MonoLabel className="block">Samopoczucie</MonoLabel>
              <div className="mt-1.5 font-mono text-xl">{`${ostatnia.feeling}/5`}</div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "relative mt-auto flex items-end border-b border-[#eaeaea]",
            zakres === "30" ? "gap-[3px]" : "gap-[5px]",
          )}
          style={{ height: WYSOKOSC }}
          onMouseLeave={() => setNajechany(null)}
        >
          {/* Linia celu (przerywana) z podpisem */}
          <div
            className="absolute right-0 left-0 border-t border-dashed border-[#15803d]"
            style={{ bottom: liniaCelu }}
          />
          <span
            className="absolute right-0 font-mono text-[10px] text-[#15803d]"
            style={{ bottom: liniaCelu + 4 }}
          >
            cel {celTekst} h
          </span>

          {bars.map((b, k) => {
            const opis = `${krotko(b.date)} · ${b.minutes === null ? "brak wpisu" : formatDuration(b.minutes)}`;
            const wysokosc = b.minutes === null ? 0 : Math.round((b.minutes / skala) * WYSOKOSC);
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
                className={cn(
                  "flex-1 cursor-default rounded-t-[3px] outline-none focus-visible:ring-2 focus-visible:ring-[#171717]",
                  b.met ? "bg-[#15803d]" : "bg-[#d4d4d4]",
                  najechany?.k === k && "shadow-[0_0_0_2px_#171717]",
                )}
                style={{ height: wysokosc }}
              />
            );
          })}

          {najechany !== null && bars[najechany.k]?.minutes != null && (
            // Dymek nad słupkiem: „17.11 · 7:12”
            <ChartTooltip anchor={najechany.el}>
              <span className="font-mono">
                {`${krotko(bars[najechany.k].date)} · ${formatDuration(bars[najechany.k].minutes ?? 0)}`}
              </span>
            </ChartTooltip>
          )}
        </div>
        <div className="-mt-2.5 flex justify-between font-mono text-[10px] text-[#6b6b6b]">
          <span>{krotko(bars[0].date)}</span>
          <span>{krotko(today)}</span>
        </div>
      </div>
    </section>
  );
}
