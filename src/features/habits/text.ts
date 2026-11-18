// Teksty nawyków dokładnie jak w makietach (Habits, HabitDetail, MHabits)
import type { ScheduleVersion } from "./model";

// Skróty dni tygodnia: indeks 0 = pn (1) … 6 = nd (7)
const SKROTY_DNI = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];

// „codziennie”, „pn, śr, pt, nd”, „4× w tygodniu”
export function describeSchedule(v: ScheduleVersion): string {
  if (v.type === "daily") return "codziennie";
  if (v.type === "times_per_week") return `${v.timesPerWeek ?? 0}× w tygodniu`;
  // weekdays: zawsze w kolejności od poniedziałku
  const posortowane = [...v.weekdays].sort((a, b) => a - b);
  return posortowane.map((d) => SKROTY_DNI[d - 1]).join(", ");
}

// Minuty jako h:mm, np. 432 → „7:12”
export function formatDuration(min: number): string {
  const godziny = Math.floor(min / 60);
  const minuty = min % 60;
  return `${godziny}:${String(minuty).padStart(2, "0")}`;
}

// „1 dzień”, „12 dni”, „3 tyg.”
export function streakLabel(streak: {
  value: number;
  unit: "days" | "weeks";
}): string {
  if (streak.unit === "weeks") return `${streak.value} tyg.`;
  return streak.value === 1 ? "1 dzień" : `${streak.value} dni`;
}
