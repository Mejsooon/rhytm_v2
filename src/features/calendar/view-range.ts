// Zakresy widoków kalendarza i nawigacja po datach — same stringi YYYY-MM-DD,
// arytmetyka dni na UTC-owych Date (bez stref, więc bez przesunięć DST).
import { buildMonthGrid, type IsoDate } from "@/components/controls/calendar-math";

export type CalendarView = "dzien" | "tydzien" | "miesiac";

const dwie = (n: number) => String(n).padStart(2, "0");

// Przesuwa datę o n dni (może być ujemne)
export function addDays(date: IsoDate, n: number): IsoDate {
  const [r, m, d] = date.split("-").map(Number);
  const wynik = new Date(Date.UTC(r, m - 1, d + n));
  return `${wynik.getUTCFullYear()}-${dwie(wynik.getUTCMonth() + 1)}-${dwie(wynik.getUTCDate())}`;
}

export function viewRange(
  view: CalendarView,
  date: IsoDate,
  weekStart: "mon" | "sun",
): { from: IsoDate; to: IsoDate; days: IsoDate[] } {
  if (view === "dzien") {
    return { from: date, to: date, days: [date] };
  }

  if (view === "tydzien") {
    const [r, m, d] = date.split("-").map(Number);
    const dzienTygodnia = new Date(Date.UTC(r, m - 1, d)).getUTCDay(); // 0 = niedziela
    const cofnij = weekStart === "mon" ? (dzienTygodnia + 6) % 7 : dzienTygodnia;
    const from = addDays(date, -cofnij);
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    return { from, to: days[6], days };
  }

  // miesiąc: pełna siatka 6 tygodni
  const [r, m] = date.split("-").map(Number);
  const days = buildMonthGrid(r, m - 1, weekStart).map((c) => c.date);
  return { from: days[0], to: days[days.length - 1], days };
}

// Parametry z URL (?widok=...&data=...); byle co zamieniamy na bezpieczne wartości
export function parseCalendarParams(
  sp: { widok?: string; data?: string },
  today: IsoDate,
): { view: CalendarView; date: IsoDate } {
  const view: CalendarView =
    sp.widok === "dzien" || sp.widok === "tydzien" || sp.widok === "miesiac"
      ? sp.widok
      : "tydzien";

  let date = today;
  if (sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data)) {
    const [r, m, d] = sp.data.split("-").map(Number);
    const sprawdzona = new Date(Date.UTC(r, m - 1, d));
    // Date.UTC przelicza 2026-02-30 na marzec, więc porównujemy z wejściem
    if (
      sprawdzona.getUTCFullYear() === r &&
      sprawdzona.getUTCMonth() === m - 1 &&
      sprawdzona.getUTCDate() === d
    ) {
      date = sp.data;
    }
  }
  return { view, date };
}

// Strzałki < > : dzień, tydzień albo miesiąc (dzień miesiąca przycięty do jego długości)
export function shiftDate(view: CalendarView, date: IsoDate, dir: -1 | 1): IsoDate {
  if (view === "dzien") return addDays(date, dir);
  if (view === "tydzien") return addDays(date, 7 * dir);

  const [r, m, d] = date.split("-").map(Number);
  const dlugoscNowego = new Date(Date.UTC(r, m - 1 + dir + 1, 0)).getUTCDate();
  const nowy = new Date(Date.UTC(r, m - 1 + dir, Math.min(d, dlugoscNowego)));
  return `${nowy.getUTCFullYear()}-${dwie(nowy.getUTCMonth() + 1)}-${dwie(nowy.getUTCDate())}`;
}

// Numer tygodnia ISO 8601 (tydzień z pierwszym czwartkiem roku to tydzień 1)
export function isoWeekNumber(date: IsoDate): number {
  const [r, m, d] = date.split("-").map(Number);
  const dzien = new Date(Date.UTC(r, m - 1, d));
  const numerDnia = dzien.getUTCDay() || 7; // pn = 1 … nd = 7
  dzien.setUTCDate(dzien.getUTCDate() + 4 - numerDnia); // czwartek tego tygodnia
  const poczatekRoku = Date.UTC(dzien.getUTCFullYear(), 0, 1);
  return Math.ceil(((dzien.getTime() - poczatekRoku) / 86400000 + 1) / 7);
}
