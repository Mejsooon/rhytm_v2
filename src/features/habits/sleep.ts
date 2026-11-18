// Sen: czas snu, tekst celu, tytuł nocy i statystyki — czyste funkcje
import type { IsoDate } from "@/components/controls/calendar-math";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
import { formatDuration } from "./text";

export type SleepLog = {
  date: IsoDate; // dzień pobudki
  sleptAt: string; // 'HH:MM'
  wokeAt: string; // 'HH:MM'
  feeling: number | null;
  tags: string[];
  note: string | null;
};

// Dni tygodnia (indeks 0 = pn): „z poniedziałku” i „na wtorek”
const DNI_DOPELNIACZ = [
  "poniedziałku",
  "wtorku",
  "środy",
  "czwartku",
  "piątku",
  "soboty",
  "niedzieli",
];
const DNI_BIERNIK = [
  "poniedziałek",
  "wtorek",
  "środę",
  "czwartek",
  "piątek",
  "sobotę",
  "niedzielę",
];

const MIESIACE_DOPELNIACZ = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

// Minuty snu: pobudka − zaśnięcie, +24 h gdy wynik ≤ 0; null gdy godziny równe
export function sleepMinutes(sleptAt: string, wokeAt: string): number | null {
  const [hs, ms] = sleptAt.split(":").map(Number);
  const [hw, mw] = wokeAt.split(":").map(Number);
  let roznica = hw * 60 + mw - (hs * 60 + ms);
  if (roznica === 0) return null;
  if (roznica < 0) roznica += 24 * 60;
  return roznica;
}

// Web: „90% celu 8:00 · brakuje 48 min”, telefon: „Brakuje 48 min do celu”
export function goalText(
  minutes: number,
  goalMin: number,
): { web: string; phone: string } {
  const procent = Math.round((minutes / goalMin) * 100);
  const cel = formatDuration(goalMin);
  if (minutes >= goalMin) {
    return {
      web: `${procent}% celu ${cel} · powyżej celu`,
      phone: `Powyżej celu ${cel}`,
    };
  }
  const brakuje = goalMin - minutes;
  return {
    web: `${procent}% celu ${cel} · brakuje ${brakuje} min`,
    phone: `Brakuje ${brakuje} min do celu`,
  };
}

// Web: „Noc z poniedziałku na wtorek”, telefon: „Noc 14 → 15 listopada”
export function nightTitle(date: IsoDate): { web: string; phone: string } {
  const wczoraj = addDays(date, -1);
  const dzienWczoraj = DNI_DOPELNIACZ[weekdayOf(wczoraj) - 1];
  const dzienDzis = DNI_BIERNIK[weekdayOf(date) - 1];
  // „ze środy” — przyimek „ze” przed zbitką „śr”
  const przyimek = dzienWczoraj === "środy" ? "ze" : "z";
  const web = `Noc ${przyimek} ${dzienWczoraj} na ${dzienDzis}`;

  const [, mW, dW] = wczoraj.split("-").map(Number);
  const [, mD, dD] = date.split("-").map(Number);
  const phone =
    mW === mD
      ? `Noc ${dW} → ${dD} ${MIESIACE_DOPELNIACZ[mD - 1]}`
      : `Noc ${dW} ${MIESIACE_DOPELNIACZ[mW - 1]} → ${dD} ${MIESIACE_DOPELNIACZ[mD - 1]}`;
  return { web, phone };
}

// Statystyki z ostatnich `days` dni (dziś włącznie): średnia tylko z dni z wpisem
export function sleepStats(
  logs: SleepLog[],
  today: IsoDate,
  days: 14 | 30,
  goalMin: number,
): {
  avg: number | null;
  metGoal: number;
  bars: { date: IsoDate; minutes: number | null; met: boolean }[];
} {
  // wpisy po dacie (pierwszy wygrywa)
  const poDacie = new Map<IsoDate, SleepLog>();
  for (const log of logs) {
    if (!poDacie.has(log.date)) poDacie.set(log.date, log);
  }

  const bars: { date: IsoDate; minutes: number | null; met: boolean }[] = [];
  let suma = 0;
  let ileZWpisem = 0;
  let metGoal = 0;
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const log = poDacie.get(date);
    const minutes = log ? sleepMinutes(log.sleptAt, log.wokeAt) : null;
    const met = minutes !== null && minutes >= goalMin;
    if (minutes !== null) {
      suma += minutes;
      ileZWpisem++;
    }
    if (met) metGoal++;
    bars.push({ date, minutes, met });
  }

  return {
    avg: ileZWpisem === 0 ? null : Math.round(suma / ileZWpisem),
    metGoal,
    bars,
  };
}
