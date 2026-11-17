// Układ bloków w jednym dniu, liczby dnia i linia „teraz".
import type { IsoDate } from "@/components/controls/calendar-math";
import type { Occurrence } from "./occurrences";

// Okno „wolnego czasu": 8:00–20:00
const DZIEN_OD = 8 * 60;
const DZIEN_DO = 20 * 60;

// Nakładające się bloki dzielą szerokość: każdy dostaje kolumnę `col` z `cols` kolumn grupy.
// Grupa = ciąg bloków, z których każdy zaczyna się przed końcem poprzednich.
export function layoutDay(
  items: Occurrence[],
): { key: string; col: number; cols: number }[] {
  const posortowane = [...items].sort(
    (a, b) => a.startMin - b.startMin || b.durationMin - a.durationMin,
  );
  const wynik: { key: string; col: number; cols: number }[] = [];

  let grupa: { key: string; col: number; cols: number }[] = [];
  let koniecKolumn: number[] = []; // minuta końca ostatniego bloku w każdej kolumnie
  let koniecGrupy = -1;

  for (const blok of posortowane) {
    // Blok zaczyna się po końcu całej grupy -> zamykamy grupę i zaczynamy nową
    if (blok.startMin >= koniecGrupy && grupa.length > 0) {
      for (const g of grupa) g.cols = koniecKolumn.length;
      wynik.push(...grupa);
      grupa = [];
      koniecKolumn = [];
    }

    // Pierwsza kolumna, która jest już wolna; jeśli brak — nowa kolumna
    let kolumna = koniecKolumn.findIndex((koniec) => koniec <= blok.startMin);
    if (kolumna === -1) kolumna = koniecKolumn.length;

    const koniec = blok.startMin + blok.durationMin;
    koniecKolumn[kolumna] = koniec;
    koniecGrupy = Math.max(koniecGrupy, koniec);
    grupa.push({ key: blok.key, col: kolumna, cols: 1 });
  }

  for (const g of grupa) g.cols = koniecKolumn.length;
  wynik.push(...grupa);
  return wynik;
}

// Liczby nad dniem: zaplanowane (suma czasów bloków), wolne w oknie 8–20, zadania
export function dayNumbers(
  items: Occurrence[],
  tasks: { done: boolean }[],
): {
  plannedMin: number;
  freeMin: number;
  tasksDone: number;
  tasksTotal: number;
} {
  const plannedMin = items.reduce((suma, b) => suma + b.durationMin, 0);

  // Zajęte minuty w oknie 8–20 liczymy raz, nawet gdy bloki się nakładają
  const przedzialy = items
    .map((b) => [
      Math.max(b.startMin, DZIEN_OD),
      Math.min(b.startMin + b.durationMin, DZIEN_DO),
    ])
    .filter(([od, do_]) => do_ > od)
    .sort((a, b) => a[0] - b[0]);

  let zajete = 0;
  let koniec = DZIEN_OD;
  for (const [od, do_] of przedzialy) {
    const poczatek = Math.max(od, koniec);
    if (do_ > poczatek) zajete += do_ - poczatek;
    koniec = Math.max(koniec, do_);
  }

  return {
    plannedMin,
    freeMin: DZIEN_DO - DZIEN_OD - zajete,
    tasksDone: tasks.filter((t) => t.done).length,
    tasksTotal: tasks.length,
  };
}

// Pozycja linii „teraz" (minuty od północy) albo null, gdy to nie jest ten dzień
export function nowLine(
  nowInTz: { date: IsoDate; minutes: number },
  day: IsoDate,
): number | null {
  return nowInTz.date === day ? nowInTz.minutes : null;
}
