// Sport: tempo, kcal, 1RM, objętość, rekordy, wystąpienia szablonów, statystyki tygodnia
// i siatka miesiąca — czyste funkcje. Daty to 'YYYY-MM-DD', godziny to czas ścienny bez strefy.
import {
  buildMonthGrid,
  type IsoDate,
} from "@/components/controls/calendar-math";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
import type { Database } from "@/types/database";

export type { IsoDate };

type Tables = Database["public"]["Tables"];
export type SessionRow = Tables["sport_sessions"]["Row"];
export type RunRow = Tables["runs"]["Row"];
export type GymSetRow = Tables["gym_sets"]["Row"];
export type TemplateRow = Tables["workout_templates"]["Row"];
export type TemplateItemRow = Tables["workout_template_items"]["Row"];
export type SkipRow = Tables["template_skips"]["Row"];
export type ExerciseRow = Tables["exercises"]["Row"];

export type RunKind = "easy" | "tempo" | "intervals" | "long" | "race";

export const RUN_KIND_LABEL: Record<RunKind, string> = {
  easy: "Spokojny",
  tempo: "Tempo",
  intervals: "Interwały",
  long: "Długi bieg",
  race: "Zawody",
};

export type SportItem = {
  key: string; // s:{id} dla sesji, t:{templateId}:{date} dla wystąpienia szablonu
  kind: "run" | "gym";
  sessionId: string | null;
  templateId: string | null;
  date: IsoDate;
  startMin: number;
  durationMin: number;
  title: string;
  planned: boolean;
  showInCalendar: boolean;
  distanceKm: number | null;
  durationS: number | null;
  kcal: number | null;
  difficulty: number | null;
  runKind: RunKind | null;
  note: string | null;
};

const dwie = (n: number) => String(n).padStart(2, "0");

// Tempo w sekundach na kilometr
export function paceSPerKm(distanceKm: number, durationS: number): number {
  return durationS / distanceKm;
}

// 348 -> "5:48"
export function formatPace(s: number): string {
  const razem = Math.round(s);
  return `${Math.floor(razem / 60)}:${dwie(razem % 60)}`;
}

// 3725 -> "1:02:05", 2700 -> "45:00"
export function formatDuration(s: number): string {
  const razem = Math.round(s);
  const h = Math.floor(razem / 3600);
  const m = Math.floor((razem % 3600) / 60);
  const sek = razem % 60;
  return h > 0 ? `${h}:${dwie(m)}:${dwie(sek)}` : `${dwie(m)}:${dwie(sek)}`;
}

// 8 -> "8,0"
export function formatKm(km: number): string {
  return km.toFixed(1).replace(".", ",");
}

// 72.5 -> "72,5", null (masa ciała) -> "mc"
export function formatKg(kg: number | null): string {
  if (kg === null) return "mc";
  return String(kg).replace(".", ",");
}

// ACSM: VO2 = 3,5 + 0,2 × prędkość [m/min]; kcal = VO2 × waga × minuty / 1000 × 5
export function runKcal(
  distanceKm: number,
  durationS: number,
  weightKg: number | null,
): number | null {
  if (weightKg === null) return null;
  const minuty = durationS / 60;
  const predkosc = (distanceKm * 1000) / minuty;
  const vo2 = 3.5 + 0.2 * predkosc;
  return Math.round(((vo2 * weightKg * minuty) / 1000) * 5);
}

// Epley: kg × (1 + powt./30), zaokrąglone do 0,5
export function epley1rm(weightKg: number, reps: number): number {
  return Math.round(weightKg * (1 + reps / 30) * 2) / 2;
}

// Σ kg × powt. zrobionych serii; seria bez ciężaru to 0
export function sessionVolume(
  sets: { weight_kg: number | null; reps: number | null; done: boolean }[],
): number {
  let suma = 0;
  for (const s of sets) {
    if (s.done && s.weight_kg !== null && s.reps !== null) {
      suma += s.weight_kg * s.reps;
    }
  }
  return suma;
}

// REKORD: zrobiona seria z ciężarem > max ciężaru zrobionych serii tego ćwiczenia
// we wcześniejszych sesjach. Pierwsza sesja nie daje rekordu; w jednej sesji
// plakietkę dostaje tylko najcięższa seria (przy remisie pierwsza wg set_no).
export function recordSetIds(
  history: { sessionId: string; startLocal: string; sets: GymSetRow[] }[],
  exerciseId: string,
): Set<string> {
  const wynik = new Set<string>();
  const posortowane = [...history].sort((a, b) =>
    a.startLocal < b.startLocal ? -1 : a.startLocal > b.startLocal ? 1 : 0,
  );
  let poprzedniMax: number | null = null;

  for (const sesja of posortowane) {
    const zrobione = sesja.sets
      .filter(
        (s) => s.exercise_id === exerciseId && s.done && s.weight_kg !== null,
      )
      .sort((a, b) => a.set_no - b.set_no);
    if (zrobione.length === 0) continue;

    let najciezsza = zrobione[0];
    for (const s of zrobione) {
      if ((s.weight_kg as number) > (najciezsza.weight_kg as number)) {
        najciezsza = s;
      }
    }
    const max = najciezsza.weight_kg as number;
    if (poprzedniMax !== null && max > poprzedniMax) wynik.add(najciezsza.id);
    poprzedniMax = poprzedniMax === null ? max : Math.max(poprzedniMax, max);
  }
  return wynik;
}

// "18:30:00" albo "18:30" -> minuty od północy
const minutyZGodziny = (godzina: string) =>
  Number(godzina.slice(0, 2)) * 60 + Number(godzina.slice(3, 5));

// Wystąpienia szablonów: tylko daty od dziś włącznie w przód, w dni z weekdays,
// bez template_skips i bez dat, na które istnieje już sesja z tego szablonu.
export function templateOccurrences(
  templates: TemplateRow[],
  skips: SkipRow[],
  sessions: SessionRow[],
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
): SportItem[] {
  const wynik: SportItem[] = [];
  const start = from > today ? from : today;

  for (let data = start; data <= to; data = addDays(data, 1)) {
    const dzien = weekdayOf(data);
    for (const t of templates) {
      if (!t.weekdays.includes(dzien)) continue;
      if (skips.some((s) => s.template_id === t.id && s.date === data))
        continue;
      if (
        sessions.some((s) => s.template_id === t.id && s.template_date === data)
      )
        continue;
      wynik.push({
        key: `t:${t.id}:${data}`,
        kind: "gym",
        sessionId: null,
        templateId: t.id,
        date: data,
        startMin: minutyZGodziny(t.start_time),
        durationMin: 90,
        title: t.name,
        planned: true,
        showInCalendar: true,
        distanceKm: null,
        durationS: null,
        kcal: null,
        difficulty: null,
        runKind: null,
        note: null,
      });
    }
  }
  return wynik;
}

// Sesje (bieg + siłownia) jako elementy kalendarza.
// Bieg bez duration_s i trening siłowy bez completed to plan.
export function sessionItems(
  sessions: SessionRow[],
  runs: RunRow[],
): SportItem[] {
  const biegi = new Map(runs.map((r) => [r.session_id, r]));

  return sessions.map((s) => {
    const bieg = s.type === "run" ? (biegi.get(s.id) ?? null) : null;
    const kind: "run" | "gym" = s.type === "run" ? "run" : "gym";
    const planned =
      kind === "run" ? !bieg || bieg.duration_s === null : !s.completed;
    const startMin = minutyZGodziny(s.start_local.slice(11, 16));

    let durationMin: number;
    if (s.end_local) {
      const koniec = minutyZGodziny(s.end_local.slice(11, 16));
      const dni =
        (Date.parse(s.end_local.slice(0, 10)) -
          Date.parse(s.start_local.slice(0, 10))) /
        86400000;
      durationMin = dni * 1440 + koniec - startMin;
    } else if (kind === "run") {
      durationMin =
        bieg && bieg.duration_s !== null
          ? Math.round(bieg.duration_s / 60)
          : 60;
    } else {
      durationMin = 90;
    }

    return {
      key: `s:${s.id}`,
      kind,
      sessionId: s.id,
      templateId: s.template_id,
      date: s.start_local.slice(0, 10),
      startMin,
      durationMin,
      title: s.title,
      planned,
      showInCalendar: s.show_in_calendar,
      distanceKm: bieg ? bieg.distance_km : null,
      durationS: bieg ? bieg.duration_s : null,
      kcal: bieg ? bieg.kcal : null,
      difficulty: bieg ? bieg.difficulty : null,
      runKind: bieg ? (bieg.kind as RunKind) : null,
      note: s.note,
    };
  });
}

// Statystyki 7 dni od weekStartDate: km i kcal tylko z wykonanych biegów,
// tempo = Σ czas / Σ km, done = wykonane sesje obu rodzajów.
export function weekStats(
  items: SportItem[],
  weekStartDate: IsoDate,
): { km: number; paceS: number | null; done: number; kcal: number } {
  const koniec = addDays(weekStartDate, 6);
  let km = 0;
  let sekundy = 0;
  let kcal = 0;
  let done = 0;

  for (const i of items) {
    if (i.date < weekStartDate || i.date > koniec || i.planned) continue;
    done += 1;
    if (i.kind === "run") {
      kcal += i.kcal ?? 0;
      // tempo tylko z biegów z dystansem i czasem naraz
      if (i.distanceKm !== null && i.durationS !== null) {
        km += i.distanceKm;
        sekundy += i.durationS;
      }
    }
  }
  return { km, paceS: km > 0 ? sekundy / km : null, done, kcal };
}

// Siatka miesiąca 6 × 7 dla 'YYYY-MM'
export function monthGrid(
  month: string,
  weekStart: "mon" | "sun",
): IsoDate[][] {
  const [r, m] = month.split("-").map(Number);
  const dni = buildMonthGrid(r, m - 1, weekStart).map((c) => c.date);
  return Array.from({ length: 6 }, (_, w) => dni.slice(w * 7, w * 7 + 7));
}

// "8–10" -> 8, "AMRAP" -> null
export function firstReps(repsText: string): number | null {
  const trafienie = repsText.match(/\d+/);
  return trafienie ? Number(trafienie[0]) : null;
}

// Serie nowego treningu z szablonu: kg i powt. z ostatniej wykonanej sesji
// (seria o tym samym numerze, a gdy jej brak, ostatnia seria); bez historii
// kg puste, a powt. = pierwsza liczba z reps_text.
export function templateSets(
  items: TemplateItemRow[],
  lastSetsByExercise: Map<string, GymSetRow[]>,
): {
  exercise_id: string;
  exercise_position: number;
  set_no: number;
  weight_kg: number | null;
  reps: number | null;
}[] {
  const wynik: {
    exercise_id: string;
    exercise_position: number;
    set_no: number;
    weight_kg: number | null;
    reps: number | null;
  }[] = [];
  const pozycje = [...items].sort((a, b) => a.position - b.position);

  for (const poz of pozycje) {
    const historia = [...(lastSetsByExercise.get(poz.exercise_id) ?? [])].sort(
      (a, b) => a.set_no - b.set_no,
    );
    for (let nr = 1; nr <= poz.sets_count; nr++) {
      const zHistorii =
        historia.find((s) => s.set_no === nr) ??
        historia[historia.length - 1] ??
        null;
      wynik.push({
        exercise_id: poz.exercise_id,
        exercise_position: poz.position,
        set_no: nr,
        weight_kg: zHistorii ? zHistorii.weight_kg : null,
        reps: zHistorii?.reps ?? firstReps(poz.reps_text),
      });
    }
  }
  return wynik;
}
