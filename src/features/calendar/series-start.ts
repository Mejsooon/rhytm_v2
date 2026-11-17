// Data startu serii nie może być "duchem": dla weekdays i custom przesuwamy ją
// na pierwszy dzień, który naprawdę należy do serii (np. sobota → poniedziałek).
import type { IsoDate } from "@/components/controls/calendar-math";
import type { Recurrence } from "./occurrences";
import { addDays, weekdayOf } from "./view-range";

export function normalizeSeriesStart(
  date: IsoDate,
  recurrence: Recurrence | null,
): IsoDate {
  if (recurrence === null) return date;
  if (recurrence.freq !== "weekdays" && recurrence.freq !== "custom") {
    return date;
  }

  // Maksymalnie 7 dni do przodu wystarczy, żeby trafić w dzień serii
  let dzien = date;
  for (let i = 0; i < 7; i++) {
    const dzienTygodnia = weekdayOf(dzien);
    const pasuje =
      recurrence.freq === "weekdays"
        ? dzienTygodnia <= 5
        : (recurrence.byWeekday ?? []).includes(dzienTygodnia);
    if (pasuje) return dzien;
    dzien = addDays(dzien, 1);
  }
  return date; // custom bez dni — walidacja zod i tak tego nie przepuści
}
