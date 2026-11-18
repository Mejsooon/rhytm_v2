// Nawyki: harmonogram, % dnia, serie, skuteczność i heatmapy — czyste funkcje.
// Daty to stringi 'YYYY-MM-DD'; dni przesuwamy addDays (UTC, bez DST),
// a stringi w tym formacie można porównywać zwykłym < i >.
import type { IsoDate } from "@/components/controls/calendar-math";
import { addDays, weekdayOf } from "@/features/calendar/view-range";

export type ScheduleType = "daily" | "weekdays" | "times_per_week";

export type ScheduleVersion = {
  validFrom: IsoDate;
  type: ScheduleType;
  weekdays: number[]; // 1 = pn … 7 = nd
  timesPerWeek: number | null;
};

export type Habit = {
  id: string;
  name: string;
  remindAt: string | null;
  showOnToday: boolean;
  createdAt: string;
  schedules: ScheduleVersion[]; // rosnąco po validFrom
};

export type Checks = Map<string /* habitId */, Set<IsoDate>>;

export type DayCell = {
  date: IsoDate;
  done: number;
  planned: number;
  percent: number | null; // null = bez planu albo przyszłość
};

type WeekStart = "mon" | "sun";
type Streak = { value: number; unit: "days" | "weeks" };

// Pierwszy dzień tygodnia, w którym leży `date`
function startOfWeek(date: IsoDate, weekStart: WeekStart): IsoDate {
  const dzien = weekdayOf(date); // 1 = pn … 7 = nd
  const cofnij = weekStart === "mon" ? dzien - 1 : dzien % 7;
  return addDays(date, -cofnij);
}

// Wersja harmonogramu obowiązująca w dniu `date`: największe validFrom ≤ date
export function scheduleOn(
  habit: Habit,
  date: IsoDate,
): ScheduleVersion | null {
  let wynik: ScheduleVersion | null = null;
  for (const v of habit.schedules) {
    if (
      v.validFrom <= date &&
      (wynik === null || v.validFrom >= wynik.validFrom)
    ) {
      wynik = v;
    }
  }
  return wynik;
}

// Czy nawyk jest zaplanowany na konkretny dzień (X/tydz. nigdy nie jest)
export function isPlanned(habit: Habit, date: IsoDate): boolean {
  const v = scheduleOn(habit, date);
  if (v === null) return false;
  if (v.type === "daily") return true;
  if (v.type === "weekdays") return v.weekdays.includes(weekdayOf(date));
  return false;
}

// Czy można odhaczyć: nie przyszłość, nawyk już obowiązuje, a przy weekdays dzień zaplanowany
export function canCheck(habit: Habit, date: IsoDate, today: IsoDate): boolean {
  if (date > today) return false;
  const v = scheduleOn(habit, date);
  if (v === null) return false;
  if (v.type === "times_per_week") return true;
  return isPlanned(habit, date);
}

// % dnia = (zrobione zaplanowane + odhaczone X/tydz.) / (zaplanowane + odhaczone X/tydz.)
export function dayStats(
  habits: Habit[],
  checks: Checks,
  date: IsoDate,
  today: IsoDate,
): DayCell {
  let done = 0;
  let planned = 0;
  for (const habit of habits) {
    const v = scheduleOn(habit, date);
    if (v === null) continue;
    const odhaczone = checks.get(habit.id)?.has(date) ?? false;
    if (v.type === "times_per_week") {
      // X/tydz. liczy się tylko wtedy, gdy jest odhaczony
      if (odhaczone) {
        planned++;
        done++;
      }
    } else if (isPlanned(habit, date)) {
      planned++;
      if (odhaczone) done++;
    }
  }
  const percent =
    date > today || planned === 0 ? null : Math.round((done / planned) * 100);
  return { date, done, planned, percent };
}

// Bieżąca seria: w dniach (codziennie / weekdays) albo w tygodniach (X/tydz.)
export function currentStreak(
  habit: Habit,
  checks: Checks,
  today: IsoDate,
  weekStart: WeekStart,
): Streak {
  const dzisiejsza = scheduleOn(habit, today);
  if (dzisiejsza === null) return { value: 0, unit: "days" };
  const odhaczone = checks.get(habit.id) ?? new Set<IsoDate>();

  if (dzisiejsza.type !== "times_per_week") {
    // Idziemy wstecz od dziś po dniach zaplanowanych
    let value = 0;
    for (let d = today; ; d = addDays(d, -1)) {
      const v = scheduleOn(habit, d);
      if (v === null) break; // przed pierwszym validFrom
      if (v.type === "times_per_week") continue; // dni z wersją X/tydz. pomijamy
      if (!isPlanned(habit, d)) continue; // dni niezaplanowane nie przerywają
      if (odhaczone.has(d)) {
        value++;
      } else if (d === today) {
        continue; // dziś jeszcze można odhaczyć — liczymy od wczoraj
      } else {
        break;
      }
    }
    return { value, unit: "days" };
  }

  // X/tydz.: idziemy wstecz po tygodniach od bieżącego
  let value = 0;
  for (
    let start = startOfWeek(today, weekStart);
    ;
    start = addDays(start, -7)
  ) {
    // koniec tygodnia; w bieżącym tygodniu to dziś
    const koniec = addDays(start, 6) > today ? today : addDays(start, 6);
    // tydzień oceniamy wersją z jego końca (w bieżącym — dzisiejszą, tą samą co weekProgress);
    // wersja z początku tygodnia tylko wtedy, gdy na końcu żadnej nie ma
    const v = scheduleOn(habit, koniec) ?? scheduleOn(habit, start);
    if (v === null || v.type !== "times_per_week") break; // inny typ przerywa serię
    let ile = 0;
    for (let d = start; d <= koniec; d = addDays(d, 1)) {
      if (odhaczone.has(d)) ile++;
    }
    const spelniony = ile >= (v.timesPerWeek ?? 0);
    const biezacy = start === startOfWeek(today, weekStart);
    if (spelniony) {
      value++;
    } else if (!biezacy) {
      break; // niespełniony bieżący tydzień nie przerywa, wcześniejszy tak
    }
  }
  return { value, unit: "weeks" };
}

// Najdłuższa seria w całej historii — ta sama miara co currentStreak
export function longestStreak(
  habit: Habit,
  checks: Checks,
  today: IsoDate,
  weekStart: WeekStart,
): Streak {
  const dzisiejsza = scheduleOn(habit, today);
  if (dzisiejsza === null || habit.schedules.length === 0)
    return { value: 0, unit: "days" };
  const odhaczone = checks.get(habit.id) ?? new Set<IsoDate>();
  const pierwszyDzien = habit.schedules[0].validFrom;

  if (dzisiejsza.type !== "times_per_week") {
    // Idziemy do przodu od pierwszego validFrom do dziś
    let max = 0;
    let seria = 0;
    for (let d = pierwszyDzien; d <= today; d = addDays(d, 1)) {
      const v = scheduleOn(habit, d);
      if (v === null || v.type === "times_per_week") continue;
      if (!isPlanned(habit, d)) continue;
      if (odhaczone.has(d)) {
        seria++;
        if (seria > max) max = seria;
      } else if (d !== today) {
        seria = 0;
      }
    }
    return { value: max, unit: "days" };
  }

  // X/tydz.: tygodnie od tego z pierwszym validFrom do bieżącego
  let max = 0;
  let seria = 0;
  const biezacyStart = startOfWeek(today, weekStart);
  for (
    let start = startOfWeek(pierwszyDzien, weekStart);
    start <= biezacyStart;
    start = addDays(start, 7)
  ) {
    const koniec = addDays(start, 6) > today ? today : addDays(start, 6);
    // ta sama zasada co w currentStreak: wersja z końca tygodnia
    const v = scheduleOn(habit, koniec) ?? scheduleOn(habit, start);
    if (v === null || v.type !== "times_per_week") {
      seria = 0;
      continue;
    }
    let ile = 0;
    for (let d = start; d <= koniec; d = addDays(d, 1)) {
      if (odhaczone.has(d)) ile++;
    }
    if (ile >= (v.timesPerWeek ?? 0)) {
      seria++;
      if (seria > max) max = seria;
    } else if (start !== biezacyStart) {
      seria = 0;
    }
  }
  return { value: max, unit: "weeks" };
}

// Skuteczność z ostatnich 30 dni (dziś włącznie), w pełnych procentach
export function successRate30(
  habit: Habit,
  checks: Checks,
  today: IsoDate,
): number | null {
  const dzisiejsza = scheduleOn(habit, today);
  if (dzisiejsza === null) return null;
  const odhaczone = checks.get(habit.id) ?? new Set<IsoDate>();

  if (dzisiejsza.type === "times_per_week") {
    const naTydzien = dzisiejsza.timesPerWeek ?? 0;
    if (naTydzien === 0) return null;
    // Początek bieżącego ciągu wersji X/tydz.: cofamy się od dzisiejszej wersji,
    // dopóki poprzednia też jest X/tydz. (wersje są rosnąco po validFrom)
    let poczatekCiagu = dzisiejsza.validFrom;
    for (let i = habit.schedules.length - 1; i >= 0; i--) {
      const w = habit.schedules[i];
      if (w.validFrom > dzisiejsza.validFrom) continue; // wersje z przyszłości pomijamy
      if (w.type !== "times_per_week") break;
      poczatekCiagu = w.validFrom;
    }
    // D = dni od początku ciągu do dziś włącznie, najwyżej 30
    // (nie karzemy za dni, gdy nawyk nie istniał albo miał inny typ harmonogramu)
    let dniOkna = 0;
    let ile = 0;
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, -i);
      if (d < poczatekCiagu) break;
      dniOkna++;
      if (odhaczone.has(d)) ile++;
    }
    // oczekiwane odhaczenia = X × D / 7; wynik obcięty do 100
    const oczekiwane = (naTydzien * dniOkna) / 7;
    return Math.min(100, Math.round((ile / oczekiwane) * 100));
  }

  let planned = 0;
  let done = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i);
    if (!isPlanned(habit, d)) continue;
    planned++;
    if (odhaczone.has(d)) done++;
  }
  return planned === 0 ? null : Math.round((done / planned) * 100);
}

// Średni % dni z planem w ostatnich 30 dniach i różnica względem 30 dni wcześniej.
// Uśredniamy nieokrąglone proporcje done/planned; zaokrąglamy tylko wynik końcowy.
export function last30Comparison(
  habits: Habit[],
  checks: Checks,
  today: IsoDate,
): { percent: number | null; deltaPoints: number | null } {
  // okno 0 = ostatnie 30 dni (dziś włącznie), okno 1 = 30 dni przed nim
  const srednie: (number | null)[] = [];
  for (let okno = 0; okno < 2; okno++) {
    let suma = 0;
    let ileDni = 0;
    for (let i = 0; i < 30; i++) {
      const komorka = dayStats(
        habits,
        checks,
        addDays(today, -(okno * 30 + i)),
        today,
      );
      if (komorka.percent === null) continue; // bez planu albo przyszłość
      suma += komorka.done / komorka.planned;
      ileDni++;
    }
    srednie.push(ileDni === 0 ? null : (suma / ileDni) * 100);
  }

  const [teraz, wczesniej] = srednie;
  if (teraz === null) return { percent: null, deltaPoints: null };
  return {
    percent: Math.round(teraz),
    deltaPoints: wczesniej === null ? null : Math.round(teraz - wczesniej),
  };
}

// Postęp bieżącego tygodnia — tylko dla X/tydz.
export function weekProgress(
  habit: Habit,
  checks: Checks,
  today: IsoDate,
  weekStart: WeekStart,
): { done: number; target: number } | null {
  const v = scheduleOn(habit, today);
  if (v === null || v.type !== "times_per_week") return null;
  const odhaczone = checks.get(habit.id) ?? new Set<IsoDate>();
  let done = 0;
  for (let d = startOfWeek(today, weekStart); d <= today; d = addDays(d, 1)) {
    if (odhaczone.has(d)) done++;
  }
  return { done, target: v.timesPerWeek ?? 0 };
}

// Dni miesiąca 'YYYY-MM' z pustymi polami (null) przed 1., wyrównane do początku tygodnia
export function heatmapMonth(
  habits: Habit[],
  checks: Checks,
  monthIso: string,
  today: IsoDate,
  weekStart: WeekStart,
): (DayCell | null)[] {
  const pierwszy = `${monthIso}-01`;
  const dzien = weekdayOf(pierwszy);
  const puste = weekStart === "mon" ? dzien - 1 : dzien % 7;

  const wynik: (DayCell | null)[] = [];
  for (let i = 0; i < puste; i++) wynik.push(null);
  for (let d = pierwszy; d.startsWith(monthIso); d = addDays(d, 1)) {
    wynik.push(dayStats(habits, checks, d, today));
  }
  return wynik;
}

// Ostatnie `weeks` kolumn tygodni (po 7 dni) do bieżącego tygodnia włącznie
export function heatmapWeeks(
  habits: Habit[],
  checks: Checks,
  weeks: 4 | 13 | 26 | 52,
  today: IsoDate,
  weekStart: WeekStart,
): DayCell[][] {
  const pierwszyStart = addDays(
    startOfWeek(today, weekStart),
    -7 * (weeks - 1),
  );
  const kolumny: DayCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const kolumna: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      kolumna.push(
        dayStats(habits, checks, addDays(pierwszyStart, w * 7 + i), today),
      );
    }
    kolumny.push(kolumna);
  }
  return kolumny;
}

// Liczba wszystkich odhaczeń nawyku
export function totalChecks(habitId: string, checks: Checks): number {
  return checks.get(habitId)?.size ?? 0;
}
