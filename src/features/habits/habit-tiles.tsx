// Rząd czterech kafelków z liczbami (CHabits.dc.html: cztery osobne .card, odstęp 12 px)
import { Card, StatusBadge } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import {
  dayStats,
  last30Comparison,
  longestStreak,
  type Checks,
  type Habit,
} from "./model";
import { sleepStats, type SleepLog } from "./sleep";
import { formatDuration, streakLabel } from "./text";

// Kafelek .card z CHabits: etykieta .lbl, duża liczba (.num 26 px), podpowiedź .hint
const KAFELEK = "min-w-0 px-[18px] py-4";
const ETYKIETA = "text-xs font-medium text-muted-foreground";
const LICZBA =
  "mt-2 text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] tabular-nums";
const POD_LICZBA = "mt-2 truncate text-xs text-muted-foreground";
const JEDNOSTKA = "text-sm font-normal tracking-normal text-muted-foreground";

export function HabitTiles({
  habits,
  checks,
  today,
  weekStart,
  sleepLogs,
  sleepGoalMin,
}: {
  habits: Habit[];
  checks: Checks;
  today: IsoDate;
  weekStart: "mon" | "sun";
  sleepLogs: SleepLog[];
  sleepGoalMin: number;
}) {
  // Nawyki dziś: zrobione / zaplanowane (X/tydz. liczy się dopiero po odhaczeniu)
  const dzis = dayStats(habits, checks, today, today);
  const pasek =
    dzis.planned === 0 ? 0 : Math.round((dzis.done / dzis.planned) * 100);

  // Ostatnie 30 dni i różnica w punktach procentowych (minus typograficzny „−”, zero bez znaku)
  const trzydziesci = last30Comparison(habits, checks, today);
  const roznica = trzydziesci.deltaPoints;

  // Najdłuższa seria: największa w dniach (tydzień serii X/tydz. = 7 dni),
  // przy remisie nazwa pierwsza alfabetycznie; pokazujemy ją we własnej jednostce
  let rekord: { name: string; dni: number; label: string } | null = null;
  for (const habit of habits) {
    const seria = longestStreak(habit, checks, today, weekStart);
    const dni = seria.unit === "weeks" ? seria.value * 7 : seria.value;
    const lepsza =
      rekord === null ||
      dni > rekord.dni ||
      (dni === rekord.dni && habit.name.localeCompare(rekord.name, "pl") < 0);
    if (lepsza) rekord = { name: habit.name, dni, label: streakLabel(seria) };
  }

  // Średni sen z 14 dni (tylko noce z wpisem)
  const sen = sleepStats(sleepLogs, today, 14, sleepGoalMin);

  return (
    <div className="grid grid-cols-4 gap-3">
      <Card className={KAFELEK}>
        <div className={ETYKIETA}>Nawyki dziś</div>
        <div className={LICZBA}>{`${dzis.done}/${dzis.planned}`}</div>
        {/* .prog: tor 6 px, wypełnienie zielone */}
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-200"
            style={{ width: `${pasek}%` }}
          />
        </div>
      </Card>

      <Card className={KAFELEK}>
        <div className={ETYKIETA}>Ostatnie 30 dni</div>
        <div className={LICZBA}>
          {trzydziesci.percent === null ? "—" : `${trzydziesci.percent}%`}
        </div>
        {roznica !== null && (
          // Różnica w odznace: wzrost zielony (.bdg.ok), spadek czerwony, zero szare
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <StatusBadge
              tone={roznica > 0 ? "green" : roznica < 0 ? "red" : "gray"}
              className="tabular-nums"
            >
              {`${roznica < 0 ? "−" : roznica > 0 ? "+" : ""}${Math.abs(roznica)} pkt`}
            </StatusBadge>{" "}
            <span>vs poprzednie 30</span>
          </div>
        )}
      </Card>

      <Card className={KAFELEK}>
        <div className={ETYKIETA}>Najdłuższa seria</div>
        {rekord === null ? (
          <div className={LICZBA}>—</div>
        ) : (
          <>
            {/* streakLabel daje „12 dni” → liczba duża, jednostka mała */}
            <div className={LICZBA}>
              <span>{rekord.label.split(" ")[0]}</span>{" "}
              <span className={JEDNOSTKA}>{rekord.label.split(" ")[1]}</span>
            </div>
            <div className={POD_LICZBA}>{rekord.name}</div>
          </>
        )}
      </Card>

      <Card className={KAFELEK}>
        <div className={ETYKIETA}>Śr. sen · 14 dni</div>
        {sen.avg === null ? (
          <div className={LICZBA}>—</div>
        ) : (
          <>
            <div className={LICZBA}>
              <span>{formatDuration(sen.avg)}</span>{" "}
              <span className={JEDNOSTKA}>
                / {formatDuration(sleepGoalMin)}
              </span>
            </div>
            <div className={POD_LICZBA}>{sen.metGoal} z 14 nocy ≥ cel</div>
          </>
        )}
      </Card>
    </div>
  );
}
