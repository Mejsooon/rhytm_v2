// Rząd czterech kafelków z liczbami (Habits.dc.html, „RZĄD 1”)
import type { IsoDate } from "@/components/controls/calendar-math";
import { dayStats, last30Comparison, longestStreak, type Checks, type Habit } from "./model";
import { sleepStats, type SleepLog } from "./sleep";
import { formatDuration, streakLabel } from "./text";

const ETYKIETA = "font-mono text-[11px] uppercase tracking-[.06em] text-[#6b6b6b]";
const LICZBA = "mt-2 font-mono text-[26px]";
const POD_LICZBA = "mt-2 font-mono text-xs text-[#6b6b6b]";
const JEDNOSTKA = "text-sm text-[#666666]";

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
  const pasek = dzis.planned === 0 ? 0 : Math.round((dzis.done / dzis.planned) * 100);

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
      rekord === null || dni > rekord.dni || (dni === rekord.dni && habit.name.localeCompare(rekord.name, "pl") < 0);
    if (lepsza) rekord = { name: habit.name, dni, label: streakLabel(seria) };
  }

  // Średni sen z 14 dni (tylko noce z wpisem)
  const sen = sleepStats(sleepLogs, today, 14, sleepGoalMin);

  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-[#eaeaea] bg-[#eaeaea]">
      <div className="bg-white px-[18px] py-4">
        <div className={ETYKIETA}>Nawyki dziś</div>
        <div className={LICZBA}>{`${dzis.done}/${dzis.planned}`}</div>
        <div className="mt-2.5 h-1 rounded-sm bg-[#f0f0f0]">
          <div
            className="h-1 rounded-sm bg-[#15803d] transition-[width] duration-200"
            style={{ width: `${pasek}%` }}
          />
        </div>
      </div>

      <div className="bg-white px-[18px] py-4">
        <div className={ETYKIETA}>Ostatnie 30 dni</div>
        <div className={LICZBA}>{trzydziesci.percent === null ? "—" : `${trzydziesci.percent}%`}</div>
        {roznica !== null && (
          <div className={POD_LICZBA}>
            {`${roznica < 0 ? "−" : roznica > 0 ? "+" : ""}${Math.abs(roznica)} pkt vs poprzednie 30`}
          </div>
        )}
      </div>

      <div className="bg-white px-[18px] py-4">
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
      </div>

      <div className="bg-white px-[18px] py-4">
        <div className={ETYKIETA}>Śr. sen · 14 dni</div>
        {sen.avg === null ? (
          <div className={LICZBA}>—</div>
        ) : (
          <>
            <div className={LICZBA}>
              <span>{formatDuration(sen.avg)}</span>{" "}
              <span className={JEDNOSTKA}>/ {formatDuration(sleepGoalMin)}</span>
            </div>
            <div className={POD_LICZBA}>{sen.metGoal} z 14 nocy ≥ cel</div>
          </>
        )}
      </div>
    </div>
  );
}
