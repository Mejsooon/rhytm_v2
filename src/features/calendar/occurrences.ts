// Rozwijanie bloków (także cyklicznych) w konkretne wystąpienia w zakresie dat.
// Godziny to czas ścienny (bez stref), więc zmiana czasu nie przesuwa bloków.
import type { Database } from "@/types/database";
import type { IsoDate } from "@/components/controls/calendar-math";
import { addDays, weekdayOf } from "./view-range";

export type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];
export type ExceptionRow =
  Database["public"]["Tables"]["block_exceptions"]["Row"];

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
    const dzienStartu = weekdayOf(dataStartu); // dla `weekly`

    // Ostatni dzień życia bloku: jednorazowy = dzień startu, seria = until (albo bez końca)
    const koniecZycia = !rec ? dataStartu : (rec.until ?? "9999-12-31");

    // Czy blok (lub seria) ma w ogóle wystąpienie w tym dniu — przed wyjątkami.
    // Nieznana częstotliwość nie pasuje do niczego.
    const czyPasuje = (dzien: IsoDate): boolean => {
      if (dzien < dataStartu || dzien > koniecZycia) return false;
      if (!rec) return true;
      const dzienTygodnia = weekdayOf(dzien);
      if (rec.freq === "daily") return true;
      if (rec.freq === "weekdays") return dzienTygodnia <= 5;
      if (rec.freq === "weekly") return dzienTygodnia === dzienStartu;
      if (rec.freq === "custom")
        return (rec.byWeekday ?? []).includes(dzienTygodnia);
      return false;
    };

    // Buduje wystąpienie z uwzględnieniem wyjątku `modified`; `data` to dzień, na którym ląduje
    const zbuduj = (
      dataOryginalna: IsoDate,
      wyjatek: ExceptionRow | undefined,
    ): Occurrence => {
      const zmieniony = wyjatek?.kind === "modified";
      const nowyStart = zmieniony ? wyjatek.new_start_local : null;
      return {
        // Klucz zawsze z oryginalnej daty, żeby edycja i anulowanie trafiały w to samo wystąpienie
        key: `${blok.id}:${dataOryginalna}`,
        blockId: blok.id,
        date: nowyStart ? nowyStart.slice(0, 10) : dataOryginalna,
        startMin: nowyStart
          ? minutyZStartu(nowyStart)
          : minutyZStartu(blok.start_local),
        durationMin: zmieniony
          ? (wyjatek.new_duration_min ?? blok.duration_min)
          : blok.duration_min,
        title: zmieniony ? (wyjatek.new_title ?? blok.title) : blok.title,
        categoryId: blok.category_id,
        note: blok.note,
        remind: blok.remind,
        recurring: rec !== null,
        recurrence: rec,
        modified: zmieniony,
      };
    };

    // 1) Dni z zakresu: zwykłe wystąpienia i przesunięte w obrębie dnia lub zmienione
    const pierwszy = from > dataStartu ? from : dataStartu;
    const ostatni = koniecZycia < to ? koniecZycia : to;
    for (let dzien = pierwszy; dzien <= ostatni; dzien = addDays(dzien, 1)) {
      if (!czyPasuje(dzien)) continue;
      const wyjatek = wyjatki.get(`${blok.id}:${dzien}`);
      if (wyjatek?.kind === "cancelled") continue;

      const wystapienie = zbuduj(dzien, wyjatek);
      // Przeniesione na inny dzień pokaże drugi krok (jeśli nowy dzień jest w zakresie)
      if (wystapienie.date !== dzien) continue;
      wynik.push(wystapienie);
    }

    // 2) Wystąpienia przeniesione na inny dzień: liczy się NOWA data, oryginalna może być poza zakresem
    for (const wyjatek of exceptions) {
      if (
        wyjatek.block_id !== blok.id ||
        wyjatek.kind !== "modified" ||
        !wyjatek.new_start_local
      ) {
        continue;
      }
      const dzien = wyjatek.occurrence_date;
      if (!czyPasuje(dzien)) continue;
      const wystapienie = zbuduj(dzien, wyjatek);
      if (wystapienie.date === dzien) continue; // ten sam dzień — obsłużone w kroku 1
      if (wystapienie.date >= from && wystapienie.date <= to)
        wynik.push(wystapienie);
    }
  }

  wynik.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
  return wynik;
}
