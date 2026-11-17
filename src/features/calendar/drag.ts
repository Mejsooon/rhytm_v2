// Czysta logika przeciągania w siatce: przyciąganie do 15 minut i wynik gestu.
// Pointerami zajmuje się use-grid-drag.ts; tu są same liczby, więc łatwo je testować.
import type { IsoDate } from "@/components/controls/calendar-math";

// Krok przyciągania i minimalna długość bloku w minutach
export const KROK = 15;
const DOBA = 1440;

export type DragKind = "create" | "move" | "resize";
// Punkt gestu: dzień kolumny i minuta od północy (może być ułamkowa)
export type DragPoint = { date: IsoDate; min: number };
export type DragResult = { date: IsoDate; startMin: number; durationMin: number };

// 487 → 480, 488 → 495
export function snapMinutes(rawMin: number): number {
  return Math.round(rawMin / KROK) * KROK;
}

// Wynik gestu: tworzenie zakresem, przesunięcie (zachowuje czas trwania, może zmienić dzień)
// albo rozciągnięcie dolnej krawędzi. null, gdy brakuje oryginału bloku.
export function dragResult(
  kind: DragKind,
  start: DragPoint,
  current: DragPoint,
  original?: { startMin: number; durationMin: number },
): DragResult | null {
  if (kind === "create") {
    // Zakres od punktu startu do bieżącego, w obie strony; minimum jeden krok
    const a = Math.min(Math.max(snapMinutes(start.min), 0), DOBA);
    const b = Math.min(Math.max(snapMinutes(current.min), 0), DOBA);
    const od = Math.min(a, b, DOBA - KROK);
    const koniec = Math.max(Math.max(a, b), od + KROK);
    return { date: start.date, startMin: od, durationMin: koniec - od };
  }

  if (!original) return null;

  if (kind === "move") {
    const startMin = snapMinutes(original.startMin + (current.min - start.min));
    // Start ≥ 0, koniec ≤ 24:00 (blok dłuższy niż doba i tak zostaje przycięty do 0)
    const maks = Math.max(0, DOBA - original.durationMin);
    return {
      date: current.date,
      startMin: Math.min(Math.max(startMin, 0), maks),
      durationMin: original.durationMin,
    };
  }

  // resize: rusza tylko koniec
  const koniec = snapMinutes(original.startMin + original.durationMin + (current.min - start.min));
  const durationMin = Math.min(Math.max(koniec - original.startMin, KROK), DOBA - original.startMin);
  return { date: start.date, startMin: original.startMin, durationMin };
}
