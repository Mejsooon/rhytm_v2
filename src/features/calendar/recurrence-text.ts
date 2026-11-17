// Teksty o powtarzaniu — dosłownie z makiet BlockDialog.dc.html i Calendar.dc.html.
import { formatDatePl, type IsoDate } from "@/components/controls/calendar-math";
import type { Recurrence } from "./occurrences";

const DOPISEK = "Każde powtórzenie ma własną, pustą listę zadań.";

// Dzień tygodnia -> forma po „w/we" (indeks 0 = niedziela, jak Date.getUTCDay)
const W_DNIACH = ["w niedziele", "w poniedziałki", "we wtorki", "w środy", "w czwartki", "w piątki", "w soboty"];
// Skróty z makiety (pn wt śr cz pt sb nd), indeks 1 = pn … 7 = nd
const SKROTY = ["", "pn", "wt", "śr", "cz", "pt", "sb", "nd"];

export function describeRecurrence(r: Recurrence | null, start: IsoDate): string {
  if (!r) return `Jednorazowy blok. ${DOPISEK}`;

  const koniec = r.until ? `do ${formatDatePl(r.until)}` : "bez końca";

  if (r.freq === "daily") return `Każdego dnia, ${koniec}. ${DOPISEK}`;
  if (r.freq === "weekdays") return `Pon–pt, ${koniec}. ${DOPISEK}`;

  if (r.freq === "weekly") {
    const [rok, m, d] = start.split("-").map(Number);
    const dzien = new Date(Date.UTC(rok, m - 1, d)).getUTCDay();
    return `Co tydzień ${W_DNIACH[dzien]}, ${koniec}. ${DOPISEK}`;
  }

  // custom — makieta nie ma osobnego zdania, więc wyliczamy wybrane dni
  const dni = [...(r.byWeekday ?? [])]
    .sort((a, b) => a - b)
    .map((n) => SKROTY[n])
    .join(", ");
  return `Co tydzień w dni: ${dni}, ${koniec}. ${DOPISEK}`;
}

// Znaczek na bloku w kalendarzu
export function recurrenceBadge(r: Recurrence): string {
  if (r.freq === "daily") return "↻ codziennie";
  if (r.freq === "weekdays") return "↻ dni robocze";
  if (r.freq === "weekly") return "↻ co tydzień";
  return "↻ własne";
}
