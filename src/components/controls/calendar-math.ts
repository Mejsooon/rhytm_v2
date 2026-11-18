// Kalendarz na samych liczbach — bez `Date` w strefie przeglądarki (Date.UTC tylko do dnia tygodnia).

export type IsoDate = string; // 'YYYY-MM-DD'

export const MIESIACE = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];

const dwie = (n: number) => String(n).padStart(2, "0");

// Zawsze 42 komórki (6 tygodni); dni sąsiednich miesięcy mają inMonth = false
export function buildMonthGrid(
  year: number,
  month0: number,
  weekStart: "mon" | "sun",
): { date: IsoDate; inMonth: boolean }[] {
  // Dzień tygodnia 1. dnia miesiąca: 0 = niedziela
  const dzienTygodnia = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const przesuniecie =
    weekStart === "mon" ? (dzienTygodnia + 6) % 7 : dzienTygodnia;

  const komorki: { date: IsoDate; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    // Date.UTC samo normalizuje dni spoza zakresu (ujemne, > długości miesiąca)
    const d = new Date(Date.UTC(year, month0, 1 - przesuniecie + i));
    komorki.push({
      date: `${d.getUTCFullYear()}-${dwie(d.getUTCMonth() + 1)}-${dwie(d.getUTCDate())}`,
      inMonth: d.getUTCMonth() === ((month0 % 12) + 12) % 12,
    });
  }
  return komorki;
}

// '2026-11-16' -> '16.11.2026'
export function formatDatePl(d: IsoDate): string {
  const [r, m, dzien] = d.split("-");
  return `${dzien}.${m}.${r}`;
}

export function monthTitlePl(year: number, month0: number): string {
  return `${MIESIACE[month0]} ${year}`;
}

// Dzisiejsza data w podanej strefie (domyślnie strefa środowiska); 'en-CA' daje format YYYY-MM-DD
export function todayIso(timeZone?: string): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
