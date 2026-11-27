// Liczenie przeglądu Sportu (S2Sport): okresy Tydzień/Miesiąc/Rok, słupki, statystyki i rekordy.
import type { IsoDate } from "@/components/controls/calendar-math";
import { MIESIACE } from "@/components/controls/calendar-math";
import { addDays, isoWeekNumber, weekdayOf } from "@/features/calendar/view-range";
import type { SportItem } from "./model";

export type Okres = "tydzien" | "miesiac" | "rok";
export type Filtr = "all" | "run" | "gym" | "other";
type WeekStart = "mon" | "sun";

export function weekStartOf(date: IsoDate, weekStart: WeekStart): IsoDate {
  const dzien = weekdayOf(date);
  return addDays(date, -(weekStart === "mon" ? dzien - 1 : dzien % 7));
}

const dwie = (n: number) => String(n).padStart(2, "0");
const ostatniDzien = (rok: number, miesiac: number) => `${rok}-${dwie(miesiac)}-${dwie(new Date(Date.UTC(rok, miesiac, 0)).getUTCDate())}`;
const krotko = (d: IsoDate) => `${Number(d.slice(8, 10))}.${d.slice(5, 7)}`;

// Przesunięcie kotwicy o n okresów (miesiąc i rok od 1. dnia, żeby nie przeskoczyć krótkiego miesiąca)
export function shiftPeriod(okres: Okres, anchor: IsoDate, n: number): IsoDate {
  if (okres === "tydzien") return addDays(anchor, 7 * n);
  const [r, m] = anchor.split("-").map(Number);
  const d = new Date(Date.UTC(r, m - 1 + (okres === "miesiac" ? n : 12 * n), 1));
  return `${d.getUTCFullYear()}-${dwie(d.getUTCMonth() + 1)}-01`;
}

export type Zakres = { from: IsoDate; to: IsoDate; title: string; bins: { from: IsoDate; to: IsoDate; label: string }[] };

export function periodRange(okres: Okres, anchor: IsoDate, weekStart: WeekStart): Zakres {
  const [r, m] = anchor.split("-").map(Number);
  if (okres === "tydzien") {
    const from = weekStartOf(anchor, weekStart);
    const nazwy = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
    return {
      from,
      to: addDays(from, 6),
      title: `${krotko(from)}–${krotko(addDays(from, 6))}`,
      bins: Array.from({ length: 7 }, (_, i) => {
        const d = addDays(from, i);
        return { from: d, to: d, label: nazwy[weekdayOf(d)] };
      }),
    };
  }
  if (okres === "miesiac") {
    const from = `${r}-${dwie(m)}-01`;
    const to = ostatniDzien(r, m);
    const bins = [];
    for (let t = weekStartOf(from, weekStart); t <= to; t = addDays(t, 7)) {
      // Tydzień na brzegu miesiąca liczy tylko dni tego miesiąca
      bins.push({
        from: t < from ? from : t,
        to: addDays(t, 6) > to ? to : addDays(t, 6),
        label: `tydz. ${isoWeekNumber(addDays(t, 3))}`,
      });
    }
    return { from, to, title: `${MIESIACE[m - 1].charAt(0).toUpperCase()}${MIESIACE[m - 1].slice(1)} ${r}`, bins };
  }
  return {
    from: `${r}-01-01`,
    to: `${r}-12-31`,
    title: String(r),
    bins: Array.from({ length: 12 }, (_, i) => ({
      from: `${r}-${dwie(i + 1)}-01`,
      to: ostatniDzien(r, i + 1),
      label: MIESIACE[i].slice(0, 3),
    })),
  };
}

export const wZakresie = (items: SportItem[], from: IsoDate, to: IsoDate) => items.filter((i) => i.date >= from && i.date <= to);

export function stats(items: SportItem[]) {
  const wykonane = items.filter((i) => !i.planned);
  const biegi = wykonane.filter((i) => i.kind === "run");
  // Tempo tylko z biegów z dystansem i czasem naraz
  const pelne = biegi.filter((i) => i.distanceKm !== null && i.durationS !== null);
  const km = pelne.reduce((s, i) => s + i.distanceKm!, 0);
  const sekundy = pelne.reduce((s, i) => s + i.durationS!, 0);
  return {
    km,
    runs: biegi.length,
    gym: wykonane.filter((i) => i.kind === "gym").length,
    other: wykonane.filter((i) => i.kind === "other").length,
    paceS: km > 0 ? sekundy / km : null,
    // Czas wszystkich wykonanych: zapisany czas albo długość wpisu
    totalS: wykonane.reduce((s, i) => s + (i.durationS ?? i.durationMin * 60), 0),
  };
}

// Wartość słupka: dla „Wszystko” i „Bieg” kilometry biegu, dla pozostałych liczba treningów
export function metric(items: SportItem[], filtr: Filtr, planned = false): number {
  const lista = items.filter((i) => i.planned === planned && (filtr === "all" || i.kind === filtr));
  if (filtr === "gym" || filtr === "other") return lista.length;
  return lista.reduce((s, i) => s + (i.kind === "run" ? (i.distanceKm ?? 0) : 0), 0);
}

export type Rekord = { key: string; label: string; value: string; date: IsoDate; kind: "run" | "gym" | "other" };

// Rekordy biegowe i aktywności z dystansem (1RM ćwiczeń dokłada widok z historii serii)
export function runRecords(items: SportItem[], formatTime: (s: number) => string): Rekord[] {
  const zrobione = items.filter((i) => !i.planned && i.distanceKm !== null);
  const biegi = zrobione.filter((i) => i.kind === "run");
  const wynik: Rekord[] = [];
  for (const [cel, od, doKm] of [[5, 4.9, 5.2], [10, 9.8, 10.4]] as const) {
    const pasujace = biegi.filter((i) => i.distanceKm! >= od && i.distanceKm! <= doKm && i.durationS !== null);
    const naj = pasujace.sort((a, b) => a.durationS! - b.durationS!)[0];
    if (naj) wynik.push({ key: `km${cel}`, label: `${cel} km`, value: formatTime(naj.durationS!), date: naj.date, kind: "run" });
  }
  const km = (d: number) => `${d.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  const najdluzszy = [...biegi].sort((a, b) => b.distanceKm! - a.distanceKm!)[0];
  if (najdluzszy) wynik.push({ key: "long", label: "Najdłuższy bieg", value: km(najdluzszy.distanceKm!), date: najdluzszy.date, kind: "run" });
  const inne = new Map<string, SportItem>();
  for (const i of zrobione.filter((x) => x.kind === "other")) {
    if (i.distanceKm! > (inne.get(i.title)?.distanceKm ?? 0)) inne.set(i.title, i);
  }
  for (const [nazwa, i] of inne) {
    wynik.push({ key: `o:${nazwa}`, label: `${nazwa} · najdłuższa trasa`, value: km(i.distanceKm!), date: i.date, kind: "other" });
  }
  return wynik;
}
