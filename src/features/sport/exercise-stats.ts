// Liczby ekranu szczegółów ćwiczenia: sesje, miary wykresu, rekordy i cel na następny trening.
// Rozgrzewka (W) nie liczy się nigdzie; drop set (D) tylko do objętości.
import {
  effectiveKg,
  epley1rm,
  firstReps,
  formatDuration,
  formatKg,
  formatVolume,
  isBodyweightKind,
  recordSetIds,
  type ExerciseKind,
  type GymSetRow,
  type HistorySession,
} from "./model";

export type ExerciseSession = {
  id: string;
  day: string; // YYYY-MM-DD
  title: string;
  sets: GymSetRow[]; // zrobione serie bez rozgrzewki
  working: GymSetRow[]; // bez drop setów
  rm: number | null; // najlepszy szac. 1RM
  best: GymSetRow | null; // seria z tym 1RM
  heaviest: { set: GymSetRow; kg: number } | null;
  mostReps: GymSetRow | null;
  volume: number; // kg × powt.
  longestS: number | null;
  totalS: number;
  longestKm: number | null;
  totalKm: number;
  record: boolean; // seria z rekordem ciężaru (jak w dzienniku)
};

type Sesje = (HistorySession & { title: string })[];

const naj = (liczby: (number | null)[]) => {
  const l = liczby.filter((x): x is number => x !== null);
  return l.length ? Math.max(...l) : null;
};

// Zakończone treningi z wynikiem, rosnąco po dacie
export function exerciseSessions(
  history: Sesje,
  exerciseId: string,
  kind: ExerciseKind,
  profileWeight: number | null,
): ExerciseSession[] {
  const bw = isBodyweightKind(kind);
  const zakonczone = history.filter((h) => h.completed);
  const rekordowe = recordSetIds(zakonczone, exerciseId, bw, profileWeight);
  const wynik: ExerciseSession[] = [];
  for (const h of zakonczone) {
    const sets = h.sets
      .filter(
        (s) =>
          s.exercise_id === exerciseId &&
          s.done &&
          s.set_type !== "W" &&
          ((s.reps ?? 0) >= 1 || s.duration_s !== null || s.distance_km !== null),
      )
      .sort((a, b) => a.set_no - b.set_no);
    if (sets.length === 0) continue;
    const working = sets.filter((s) => s.set_type !== "D");
    let rm: number | null = null;
    let best: GymSetRow | null = null;
    let heaviest: ExerciseSession["heaviest"] = null;
    let mostReps: GymSetRow | null = null;
    let volume = 0;
    for (const s of sets) {
      const kg = effectiveKg(s.weight_kg, bw, profileWeight);
      if (kg !== null && s.reps !== null) volume += kg * s.reps;
      if (s.set_type === "D" || (s.reps ?? 0) < 1) continue;
      const powt = s.reps as number;
      if (mostReps === null || powt > (mostReps.reps as number)) mostReps = s;
      if (kg === null) continue;
      if (heaviest === null || kg > heaviest.kg || (kg === heaviest.kg && powt > (heaviest.set.reps as number)))
        heaviest = { set: s, kg };
      const e = epley1rm(kg, powt);
      if (rm === null || e > rm) {
        rm = e;
        best = s;
      }
    }
    wynik.push({
      id: h.sessionId,
      day: h.startLocal.slice(0, 10),
      title: h.title,
      sets,
      working,
      rm,
      best,
      heaviest,
      mostReps,
      volume,
      longestS: naj(working.map((s) => s.duration_s)),
      totalS: sets.reduce((a, s) => a + (s.duration_s ?? 0), 0),
      longestKm: naj(working.map((s) => s.distance_km)),
      totalKm: sets.reduce((a, s) => a + (s.distance_km ?? 0), 0),
      record: h.sets.some((s) => rekordowe.has(s.id)),
    });
  }
  return wynik.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

export type Metric = {
  key: string;
  label: string;
  unit: string; // opis pod dużą liczbą
  value: (s: ExerciseSession) => number | null;
  format: (v: number) => string;
};

const jedenPo = (v: number) => v.toFixed(1).replace(".", ",");
const km = (v: number) => `${formatKg(Math.round(v * 100) / 100)} km`;
const kgTxt = (v: number) => `${formatKg(Math.round(v * 100) / 100)} kg`;

// Miary wykresu zależnie od rodzaju ćwiczenia
export function metrics(kind: ExerciseKind): Metric[] {
  if (kind === "dur")
    return [
      { key: "longestS", label: "Najdłuższa seria", unit: "najdłuższa seria", value: (s) => s.longestS, format: formatDuration },
      { key: "totalS", label: "Łączny czas", unit: "łączny czas ostatniego treningu", value: (s) => s.totalS || null, format: formatDuration },
    ];
  if (kind === "dist")
    return [
      { key: "longestKm", label: "Najdłuższy dystans", unit: "najdłuższy dystans", value: (s) => s.longestKm, format: km },
      { key: "totalKm", label: "Dystans", unit: "dystans ostatniego treningu", value: (s) => s.totalKm || null, format: km },
    ];
  return [
    { key: "rm", label: "Szac. 1RM", unit: "szacowany 1RM", value: (s) => s.rm, format: (v) => `${jedenPo(v)} kg` },
    { key: "heaviest", label: "Najcięższa seria", unit: "najcięższa seria", value: (s) => s.heaviest?.kg ?? null, format: kgTxt },
    { key: "volume", label: "Objętość", unit: "objętość ostatniego treningu", value: (s) => s.volume || null, format: (v) => `${formatVolume(v)} kg` },
  ];
}

export type ExerciseRecord = { label: string; value: string; day: string; fresh: boolean };

// Najlepsze wyniki z datą pierwszego osiągnięcia; „nowy” = z ostatniego treningu
export function exerciseRecords(sessions: ExerciseSession[], kind: ExerciseKind): ExerciseRecord[] {
  const ostatni = sessions.at(-1)?.id;
  const rekord = (label: string, value: (s: ExerciseSession) => number | null, opis: (s: ExerciseSession, v: number) => string): ExerciseRecord[] => {
    let s: ExerciseSession | null = null;
    let max = 0;
    for (const x of sessions) {
      const v = value(x);
      if (v !== null && v > max) {
        s = x;
        max = v;
      }
    }
    return s ? [{ label, value: opis(s, max), day: s.day, fresh: s.id === ostatni && sessions.length > 1 }] : [];
  };
  const bw = isBodyweightKind(kind);
  const seria = (s: GymSetRow) => `${formatKg(s.weight_kg, bw)} × ${s.reps}`;
  if (kind === "dur")
    return [
      ...rekord("Najdłuższa seria", (s) => s.longestS, (_, v) => formatDuration(v)),
      ...rekord("Łączny czas treningu", (s) => s.totalS, (_, v) => formatDuration(v)),
    ];
  if (kind === "dist")
    return [
      ...rekord("Najdłuższy dystans", (s) => s.longestKm, (_, v) => km(v)),
      ...rekord("Najdłuższy czas", (s) => s.longestS, (_, v) => formatDuration(v)),
      ...rekord("Dystans w treningu", (s) => s.totalKm, (_, v) => km(v)),
    ];
  return [
    ...rekord("Szacowany 1RM", (s) => s.rm, (_, v) => kgTxt(v)),
    ...rekord("Najcięższa seria", (s) => s.heaviest?.kg ?? null, (s) => seria((s.heaviest as NonNullable<ExerciseSession["heaviest"]>).set)),
    ...rekord("Najwięcej powtórzeń", (s) => s.mostReps?.reps ?? null, (s) => seria(s.mostReps as GymSetRow)),
    ...rekord("Objętość treningu", (s) => s.volume, (_, v) => `${formatVolume(v)} kg`),
  ];
}

// Cel na ostatnią serię: +1 powtórzenie, a po dojściu do góry zakresu +2,5 kg i dół zakresu.
// Bez zakresu albo bez ciężaru (sama masa ciała) zawsze +1. Czas i dystans: bez celu.
export function nextGoal(
  last: ExerciseSession | undefined,
  repsText: string | null,
  kind: ExerciseKind,
): { goal: string; last: string; change: string } | null {
  if (kind === "dur" || kind === "dist" || !last) return null;
  const s = last.working.filter((x) => (x.reps ?? 0) >= 1).at(-1);
  if (!s) return null;
  const powt = s.reps as number;
  const bw = isBodyweightKind(kind);
  const opis = (kg: number | null, r: number) =>
    kind === "bw" ? `${r} powt.` : kg === null ? (bw ? `mc × ${r}` : `${r} powt.`) : `${formatKg(kg, bw)} × ${r}`;
  const dol = firstReps(repsText ?? "");
  const gora = Number((repsText ?? "").match(/\d+/g)?.at(-1) ?? NaN);
  const zCiezarem = kind !== "bw" && s.weight_kg !== null && s.weight_kg > 0;
  const wiecejKg = zCiezarem && dol !== null && powt >= gora;
  return {
    goal: wiecejKg ? opis((s.weight_kg as number) + 2.5, dol) : opis(s.weight_kg, powt + 1),
    last: opis(s.weight_kg, powt),
    change: wiecejKg ? "+2,5 kg" : "+1 powtórzenie",
  };
}
