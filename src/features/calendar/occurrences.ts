// Rozwijanie bloków (także cyklicznych) w konkretne wystąpienia w zakresie dat.
// Godziny to czas ścienny (bez stref), więc zmiana czasu nie przesuwa bloków.
import type { Database } from "@/types/database";
import type { IsoDate } from "@/components/controls/calendar-math";
import { addDays } from "./view-range";

export type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];
export type ExceptionRow = Database["public"]["Tables"]["block_exceptions"]["Row"];

// Kształt kolumny blocks.recurrence (jsonb); byWeekday: 1 = pn … 7 = nd
export type Recurrence = {
  freq: "daily" | "weekdays" | "weekly" | "custom";
  byWeekday?: number[];
  until?: IsoDate;
};

export type Occurrence = {
  key: string; // `${blockId}:${date}`
  blockId: string;
  date: IsoDate;
  startMin: number; // minuty od północy
  durationMin: number;
  title: string;
  categoryId: string | null;
  note: string | null;
  remind: boolean;
  recurring: boolean;
  recurrence: Recurrence | null;
  modified: boolean;
};

// '2026-11-03T08:00:00' -> minuty od północy (480)
function minutyZStartu(startLocal: string): number {
  const [h, m] = startLocal.slice(11, 16).split(":").map(Number);
  return h * 60 + m;
}

// Wystąpienia od `from` do `to` włącznie, posortowane po dacie i godzinie
export function expandOccurrences(
  blocks: BlockRow[],
  exceptions: ExceptionRow[],
  from: IsoDate,
  to: IsoDate,
): Occurrence[] {
  // Wyjątki po kluczu `${blockId}:${date}`, żeby szybko znaleźć wyjątek dla dnia
  const wyjatki = new Map<string, ExceptionRow>();
  for (const w of exceptions) {
    wyjatki.set(`${w.block_id}:${w.occurrence_date}`, w);
  }

  const wynik: Occurrence[] = [];

  for (const blok of blocks) {
    const rec = blok.recurrence as Recurrence | null;
    const dataStartu = blok.start_local.slice(0, 10);
    const startMin = minutyZStartu(blok.start_local);

    // Dzień tygodnia startu (1 = pn … 7 = nd) — dla `weekly`
    const [r0, m0, d0] = dataStartu.split("-").map(Number);
    const dzienStartu = new Date(Date.UTC(r0, m0 - 1, d0)).getUTCDay() || 7;

    // Pierwszy i ostatni dzień do sprawdzenia: przecięcie zakresu z życiem bloku
    const pierwszy = from > dataStartu ? from : dataStartu;
    let ostatni = to;
    if (!rec) {
      ostatni = to < dataStartu ? to : dataStartu;
    } else if (rec.until && rec.until < to) {
      ostatni = rec.until;
    }

    for (let dzien = pierwszy; dzien <= ostatni; dzien = addDays(dzien, 1)) {
      const [r, m, d] = dzien.split("-").map(Number);
      const dzienTygodnia = new Date(Date.UTC(r, m - 1, d)).getUTCDay() || 7;

      let pasuje: boolean;
      if (!rec) pasuje = dzien === dataStartu;
      else if (rec.freq === "daily") pasuje = true;
      else if (rec.freq === "weekdays") pasuje = dzienTygodnia <= 5;
      else if (rec.freq === "weekly") pasuje = dzienTygodnia === dzienStartu;
      else pasuje = (rec.byWeekday ?? []).includes(dzienTygodnia);
      if (!pasuje) continue;

      const wyjatek = wyjatki.get(`${blok.id}:${dzien}`);
      if (wyjatek?.kind === "cancelled") continue;

      const zmieniony = wyjatek?.kind === "modified";
      wynik.push({
        key: `${blok.id}:${dzien}`,
        blockId: blok.id,
        date: dzien,
        // Przeniesienie zmienia tylko godzinę — wystąpienie zostaje w swoim dniu
        startMin:
          zmieniony && wyjatek.new_start_local
            ? minutyZStartu(wyjatek.new_start_local)
            : startMin,
        durationMin: zmieniony ? (wyjatek.new_duration_min ?? blok.duration_min) : blok.duration_min,
        title: zmieniony ? (wyjatek.new_title ?? blok.title) : blok.title,
        categoryId: blok.category_id,
        note: blok.note,
        remind: blok.remind,
        recurring: rec !== null,
        recurrence: rec,
        modified: zmieniony,
      });
    }
  }

  wynik.sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1));
  return wynik;
}
