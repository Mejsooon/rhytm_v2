"use client";

// Karta „Sen”: ostatnia noc i wykres słupkowy z linią celu (CHabits.dc.html, karta „Sen”)
import { useState } from "react";

import { Button, CardHeader, CardTitle, Segment, StatusBadge } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { weekdayOf } from "@/features/calendar/view-range";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";
import {
  bedtimeOffset,
  inSleepWindow,
  sleepMinutes,
  sleepRegularity,
  sleepStats,
  type SleepLog,
} from "./sleep";
import { formatDuration } from "./text";

const WYSOKOSC = 150; // px, wysokość wykresu
// Skróty dni tygodnia jak w DatePicker (pn = 1 … nd = 7 z weekdayOf, liczone w UTC)
const DNI_TYGODNIA = ["pn", "wt", "śr", "czw", "pt", "sob", "nd"];

export function SleepCard({
  sleepLogs,
  today,
  goalMin,
  bedtime = "23:00",
  clock,
  onOpenLast,
}: {
  sleepLogs: SleepLog[];
  today: IsoDate;
  goalMin: number;
  // Pora snu z ustawień (początek okna)
  bedtime?: string;
  clock: "24" | "12";
  // Klik w „Ostatnią noc” otwiera okno edycji tego wpisu
  onOpenLast?: (log: SleepLog) => void;
}) {
  const [zakres, setZakres] = useState<"14" | "30">("14");
  const [widok, setWidok] = useState<"czas" | "pory">("czas");
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

  const { bars, avg, metGoal } = sleepStats(
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

  const wpisy = new Map(sleepLogs.map((l) => [l.date, l]));
  const regularnosc = sleepRegularity(
    bars.flatMap((b) => {
      const w = wpisy.get(b.date);
      return w ? [w.sleptAt] : [];
    }),
  );
  const zegar = (min: number) => {
    const m = ((min % 1440) + 1440) % 1440;
    return formatClockTime(Math.floor(m / 60), m % 60, clock);
  };
  const pora = bedtime.split(":").map(Number);
  const porMin = pora[0] * 60 + pora[1];
  // Oś „Pory snu”: 21:00–09:00 (minuty od południa 540–1260)
  const OS_OD = 540;
  const OS = 720;

  // '2026-11-17' → '17.11'
  const krotko = (d: IsoDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

  // Dymek (CHabits): „wt 17.11” oraz „7:12 h snu · 48 min do celu” / „· cel osiągnięty”;
  // brak do celu od 60 min w h:mm („1:05 h do celu”)
  let dymekData = "";
  let dymekTekst = "";
  const wybrany = najechany === null ? null : bars[najechany.k];
  if (wybrany && wybrany.minutes !== null) {
    dymekData = `${DNI_TYGODNIA[weekdayOf(wybrany.date) - 1]} ${krotko(wybrany.date)}`;
    const brakuje = goalMin - wybrany.minutes;
    let cel = "cel osiągnięty";
    if (brakuje > 0) {
      cel =
        brakuje >= 60
          ? `${formatDuration(brakuje)} h do celu`
          : `${brakuje} min do celu`;
    }
    dymekTekst = `${formatDuration(wybrany.minutes)} h snu · ${cel}`;
  }

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
        <div className="flex flex-wrap gap-7">
          {[
            ["Średnio", avg === null ? "—" : formatDuration(avg), `/ ${formatDuration(goalMin)}`],
            ["Cel osiągnięty", `${metGoal} z ${bars.length} nocy`, ""],
            ["Regularność", regularnosc === null ? "—" : `±${regularnosc} min`, ""],
          ].map(([etykieta, wartosc, dopisek]) => (
            <div key={etykieta}>
              <div className="text-xs font-medium text-muted-foreground">{etykieta}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {wartosc}
                {dopisek && <span className="ml-1 text-xs font-normal text-muted-foreground">{dopisek}</span>}
              </div>
            </div>
          ))}
        </div>

        <div role="tablist" aria-label="Widok wykresu snu" className="flex gap-4 border-b border-border">
          {(
            [
              ["czas", "Czas snu"],
              ["pory", "Pory snu"],
            ] as const
          ).map(([v, nazwa]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={widok === v}
              onClick={() => {
                setWidok(v);
                setNajechany(null);
              }}
              className={cn(
                "-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-0 pb-2 text-[13px] font-medium outline-none focus-visible:shadow-focus",
                widok === v ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              {nazwa}
            </button>
          ))}
        </div>

        {widok === "pory" ? (
          <>
            <div className="flex gap-2">
              <div aria-hidden="true" className="flex flex-col justify-between text-[11px] text-muted-foreground tabular-nums" style={{ height: WYSOKOSC }}>
                {[21, 24, 27, 30, 33].map((h) => (
                  <span key={h}>{zegar(h * 60)}</span>
                ))}
              </div>
              <div className={cn("flex flex-1", zakres === "30" ? "gap-[3px]" : "gap-[5px]")} style={{ height: WYSOKOSC }} onMouseLeave={() => setNajechany(null)}>
                {bars.map((b, k) => {
                  const w = wpisy.get(b.date);
                  return (
                    <div key={b.date} className="relative flex-1">
                      {w && b.minutes !== null && (
                        <div
                          role="img"
                          tabIndex={0}
                          aria-label={`${krotko(b.date)} · ${w.sleptAt}–${w.wokeAt}`}
                          onMouseEnter={(e) => setNajechany({ k, el: e.currentTarget })}
                          onFocus={(e) => setNajechany({ k, el: e.currentTarget })}
                          onBlur={() => setNajechany(null)}
                          className={cn("absolute inset-x-0 rounded-[4px] outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid", inSleepWindow(w.sleptAt, bedtime) ? "bg-success" : "bg-border-strong")}
                          style={{
                            top: `${Math.min(96, Math.max(0, ((bedtimeOffset(w.sleptAt) - OS_OD) / OS) * 100))}%`,
                            height: `${Math.min(100, (b.minutes / OS) * 100)}%`,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="-mt-2.5 text-[11px] text-muted-foreground tabular-nums">{`Okno snu ${zegar(porMin)}–${zegar(porMin + goalMin)}`}</div>
            {najechany !== null && wybrany && wybrany.minutes !== null && (
              <ChartTooltip anchor={najechany.el}>
                <div className="font-semibold tabular-nums">{dymekData}</div>
                <div className="mt-0.5 text-muted-foreground tabular-nums">
                  {`${wpisy.get(wybrany.date)!.sleptAt} → ${wpisy.get(wybrany.date)!.wokeAt} · ${formatDuration(wybrany.minutes)} h`}
                </div>
              </ChartTooltip>
            )}
          </>
        ) : (
          <>
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

          {najechany !== null && dymekTekst && (
            // Dymek nad słupkiem: dzień i data pogrubione, pod nimi czas i cel (dla czytników „wt 17.11 · 7:12 h snu · …”)
            <ChartTooltip anchor={najechany.el}>
              <div className="font-semibold tabular-nums">{dymekData}</div>
              <span className="sr-only"> · </span>
              <div className="mt-0.5 text-muted-foreground tabular-nums">
                {dymekTekst}
              </div>
            </ChartTooltip>
          )}
        </div>
        <div className="-mt-2.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{krotko(bars[0].date)}</span>
          <span>{krotko(today)}</span>
        </div>
          </>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3.5 text-xs text-muted-foreground tabular-nums">
          {ostatnia && minutyOstatniej !== null ? (
            <>
              <span>
                <span>Ostatnia noc</span> <b className="text-sm font-semibold text-foreground">{formatDuration(minutyOstatniej)}</b>{" "}
                <span>{`${godziny}${ostatnia.feeling == null ? "" : ` · samopoczucie ${ostatnia.feeling}/5`}`}</span>
              </span>
              {onOpenLast && (
                <Button size="sm" aria-label="Edytuj ostatnią noc" onClick={() => onOpenLast(ostatnia)}>
                  Edytuj
                </Button>
              )}
            </>
          ) : (
            <span>Brak wpisów snu.</span>
          )}
        </div>
      </div>
    </section>
  );
}
