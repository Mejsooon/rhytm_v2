// Sport: tempo, kcal, 1RM, objętość, rekordy, wystąpienia szablonów, statystyki tygodnia
// i siatka miesiąca — czyste funkcje. Daty to 'YYYY-MM-DD', godziny to czas ścienny bez strefy.
import {
  buildMonthGrid,
  type IsoDate,
} from "@/components/controls/calendar-math";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
import type { Database } from "@/types/database";
import type { RunInput } from "./actions";

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

// Czas wpisany ręcznie: "58:00" (mm:ss), "1:02:05" (h:mm:ss) -> sekundy; zły zapis -> null
export function parseDuration(text: string): number | null {
  const m = text
    .trim()
    .match(/^(?:(\d{1,2}):([0-5]\d)|(\d{1,3}):([0-5]\d):([0-5]\d))$/);
  if (!m) return null;
  if (m[1] !== undefined) return Number(m[1]) * 60 + Number(m[2]);
  return Number(m[3]) * 3600 + Number(m[4]) * 60 + Number(m[5]);
}

// Dystans wpisany ręcznie: "10,5" albo "10.5" -> 10.5; zły zapis -> null
export function parseKm(text: string): number | null {
  const t = text.trim().replace(",", ".");
  return /^\d+(\.\d{1,3})?$/.test(t) ? Number(t) : null;
}

// 8 -> "8,0"
export function formatKm(km: number): string {
  return km.toFixed(1).replace(".", ",");
}

// 72.5 -> "72,5", null (masa ciała) -> "mc".
// Ćwiczenie z masą ciała (bodyweight): kg to dociążenie — null/0 -> "mc", 5 -> "mc + 5"
export function formatKg(kg: number | null, bodyweight = false): string {
  if (bodyweight) {
    if (kg === null || kg === 0) return "mc";
    return `mc + ${String(kg).replace(".", ",")}`;
  }
  if (kg === null) return "mc";
  return String(kg).replace(".", ",");
}

// Efektywny ciężar serii. Zwykłe ćwiczenie: wpisany ciężar (null = bez ciężaru).
// Ćwiczenie z masą ciała: waga z profilu + dociążenie (null/0 = brak); bez wagi w profilu -> null
// (seria nie liczy się do objętości, 1RM ani REKORDU).
export function effectiveKg(
  weightKg: number | null,
  bodyweight: boolean,
  profileWeight: number | null,
): number | null {
  if (!bodyweight) return weightKg;
  if (profileWeight === null) return null;
  return profileWeight + (weightKg ?? 0);
}

// Objętość: 5640 -> "5 640", 652.5 -> "652,5" (do 0,1; odstęp tysięcy jak w makietach)
export function formatVolume(kg: number): string {
  const [calosc, ulamek] = String(Math.round(kg * 10) / 10).split(".");
  const zOdstepami = calosc.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return ulamek ? `${zOdstepami},${ulamek}` : zOdstepami;
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

// Formularz biegu (RunDialog na webie i MRunNew na telefonie) → ładunek saveRun albo błędy pól.
// Puste pole to null (bieg bez czasu jest planem); zakresy (0 km, > 24 h) sprawdza saveRun.
export function runFormInput(form: {
  id: string | null; // null = nowy bieg
  kind: RunKind;
  date: IsoDate | null;
  start: string;
  distanceText: string;
  durationText: string;
  difficulty: number | null;
  note: string;
  showInCalendar: boolean;
}):
  | { ok: true; input: RunInput }
  | { ok: false; errors: Partial<Record<keyof RunInput, string>> } {
  const bezDystansu = form.distanceText.trim() === "";
  const bezCzasu = form.durationText.trim() === "";
  const km = parseKm(form.distanceText);
  const sekundy = parseDuration(form.durationText);

  const errors: Partial<Record<keyof RunInput, string>> = {};
  if (!bezDystansu && km === null)
    errors.distanceKm = "Podaj dystans w km, np. 10,5.";
  if (!bezCzasu && sekundy === null)
    errors.durationS = "Podaj czas jako h:mm:ss albo mm:ss, np. 58:00.";
  if (form.date === null) errors.date = "Wybierz datę.";
  if (form.date === null || Object.keys(errors).length > 0)
    return { ok: false, errors };

  const input: RunInput = {
    kind: form.kind,
    date: form.date,
    start: form.start,
    distanceKm: bezDystansu ? null : km,
    durationS: bezCzasu ? null : sekundy,
    difficulty: form.difficulty,
    note: form.note,
    showInCalendar: form.showInCalendar,
  };
  if (form.id !== null) input.id = form.id;
  return { ok: true, input };
}

// Epley: kg × (1 + powt./30), zaokrąglone do 0,5
export function epley1rm(weightKg: number, reps: number): number {
  return Math.round(weightKg * (1 + reps / 30) * 2) / 2;
}

// Σ efektywny ciężar × powt. zrobionych serii; seria bez ciężaru to 0.
// bodyweightIds: id ćwiczeń z masą ciała; profileWeight: waga z profilu (null = brak)
export function sessionVolume(
  sets: {
    exercise_id: string;
    weight_kg: number | null;
    reps: number | null;
    done: boolean;
  }[],
  bodyweightIds: ReadonlySet<string>,
  profileWeight: number | null,
): number {
  let suma = 0;
  for (const s of sets) {
    const kg = effectiveKg(
      s.weight_kg,
      bodyweightIds.has(s.exercise_id),
      profileWeight,
    );
    if (s.done && kg !== null && s.reps !== null) {
      suma += kg * s.reps;
    }
  }
  return suma;
}

// Historia ćwiczeń (REKORD, „vs ostatnio”, „ost. 3×8”, karta rekordu, szczegóły ćwiczenia) liczy się
// tylko z zakończonych treningów (completed) — przyszły albo niedokończony trening z odhaczoną serią
// nie jest „wcześniejszą sesją”. Ekran treningu podaje swój trening jako zakończony (podgląd na żywo).
export type HistorySession = {
  sessionId: string;
  startLocal: string;
  completed: boolean;
  sets: GymSetRow[];
};

// Kolejność sesji w historii: startLocal, przy remisie sessionId (ta sama w każdym widoku)
export function historyOrder(
  a: Pick<HistorySession, "startLocal" | "sessionId">,
  b: Pick<HistorySession, "startLocal" | "sessionId">,
): number {
  if (a.startLocal !== b.startLocal)
    return a.startLocal < b.startLocal ? -1 : 1;
  if (a.sessionId !== b.sessionId) return a.sessionId < b.sessionId ? -1 : 1;
  return 0;
}

// REKORD: zrobiona seria z (efektywnym) ciężarem > max ciężaru zrobionych serii tego ćwiczenia
// we wcześniejszych zakończonych sesjach. Pierwsza sesja nie daje rekordu; w jednej sesji
// plakietkę dostaje tylko najcięższa seria (przy remisie pierwsza wg set_no).
export function recordSetIds(
  history: HistorySession[],
  exerciseId: string,
  bodyweight: boolean,
  profileWeight: number | null,
): Set<string> {
  const wynik = new Set<string>();
  const posortowane = history.filter((h) => h.completed).sort(historyOrder);
  let poprzedniMax: number | null = null;

  for (const sesja of posortowane) {
    const zrobione = sesja.sets
      .filter(
        (s) =>
          s.exercise_id === exerciseId &&
          s.done &&
          effectiveKg(s.weight_kg, bodyweight, profileWeight) !== null,
      )
      .sort((a, b) => a.set_no - b.set_no);
    if (zrobione.length === 0) continue;

    let najciezsza = zrobione[0];
    let max = effectiveKg(
      najciezsza.weight_kg,
      bodyweight,
      profileWeight,
    ) as number;
    for (const s of zrobione) {
      const kg = effectiveKg(s.weight_kg, bodyweight, profileWeight) as number;
      if (kg > max) {
        najciezsza = s;
        max = kg;
      }
    }
    if (poprzedniMax !== null && max > poprzedniMax) wynik.add(najciezsza.id);
    poprzedniMax = poprzedniMax === null ? max : Math.max(poprzedniMax, max);
  }
  return wynik;
}

// „+2,5 kg vs ostatnio”: maks. ciężar zrobionych serii ćwiczenia w sesji sessionId − to samo
// w ostatniej wcześniejszej (wg historyOrder) zakończonej sesji z zrobioną serią z ciężarem tego ćwiczenia.
// null, gdy w jednej z nich nie ma zrobionej serii z ciężarem.
// Ćwiczenie z masą ciała porównuje efektywny ciężar (waga z profilu + dociążenie).
export function kgVsLast(
  history: HistorySession[],
  sessionId: string,
  exerciseId: string,
  bodyweight: boolean,
  profileWeight: number | null,
): number | null {
  const maksimum = (sets: GymSetRow[]) => {
    let max: number | null = null;
    for (const s of sets) {
      const kg = effectiveKg(s.weight_kg, bodyweight, profileWeight);
      if (s.exercise_id !== exerciseId || !s.done || kg === null) continue;
      if (max === null || kg > max) max = kg;
    }
    return max;
  };

  const biezaca = history.find((h) => h.sessionId === sessionId);
  if (!biezaca) return null;
  const teraz = maksimum(biezaca.sets);
  if (teraz === null) return null;

  // Ostatnia wcześniejsza (wg historyOrder) zakończona sesja z taką serią
  let poprzednia: { h: HistorySession; max: number } | null = null;
  for (const h of history) {
    if (!h.completed || historyOrder(h, biezaca) >= 0) continue;
    const max = maksimum(h.sets);
    if (max === null) continue;
    if (poprzednia === null || historyOrder(h, poprzednia.h) > 0)
      poprzednia = { h, max };
  }
  return poprzednia === null ? null : teraz - poprzednia.max;
}

// „ost. 3×8 · 60 kg” (MGym): ostatnia wcześniejsza (wg historyOrder) zakończona sesja ze zrobionymi seriami ćwiczenia —
// liczba zrobionych serii × powt. pierwszej z nich · maks. ciężar (masa ciała: bez kg).
// Ćwiczenie z masą ciała: „· mc” albo „· mc + 5” (maks. dociążenie). Brak → null.
export function lastSetsSummary(
  history: HistorySession[],
  sessionId: string,
  exerciseId: string,
  bodyweight: boolean,
): string | null {
  const biezaca = history.find((h) => h.sessionId === sessionId);
  if (!biezaca) return null;

  let poprzednia: { h: HistorySession; sets: GymSetRow[] } | null = null;
  for (const h of history) {
    if (!h.completed || historyOrder(h, biezaca) >= 0) continue;
    const zrobione = h.sets.filter(
      (s) => s.exercise_id === exerciseId && s.done,
    );
    if (zrobione.length === 0) continue;
    if (poprzednia === null || historyOrder(h, poprzednia.h) > 0)
      poprzednia = { h, sets: zrobione };
  }
  if (poprzednia === null) return null;

  const serie = [...poprzednia.sets].sort((a, b) => a.set_no - b.set_no);
  let max: number | null = null;
  for (const s of serie) {
    if (s.weight_kg !== null && (max === null || s.weight_kg > max))
      max = s.weight_kg;
  }
  const powt = serie[0].reps === null ? "—" : String(serie[0].reps);
  if (bodyweight)
    return `ost. ${serie.length}×${powt} · ${formatKg(max, true)}`;
  return `ost. ${serie.length}×${powt}${max === null ? "" : ` · ${formatKg(max)} kg`}`;
}

// Pole „kg” w treningu: "72,5" / "72.5" -> 72.5; puste albo „mc” -> null (masa ciała);
// zły zapis albo poza 0–1000 (do 0,01) -> undefined
export function parseKgInput(text: string): number | null | undefined {
  const t = text.trim().replace(",", ".");
  if (t === "" || t.toLowerCase() === "mc") return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return undefined;
  const kg = Number(t);
  return kg <= 1000 ? kg : undefined;
}

// Pole „powt.” w treningu: liczba całkowita 0–999; puste -> null; zły zapis -> undefined
export function parseRepsInput(text: string): number | null | undefined {
  const t = text.trim();
  if (t === "") return null;
  return /^\d{1,3}$/.test(t) ? Number(t) : undefined;
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
      difficulty:
        kind === "run" ? (bieg ? bieg.difficulty : null) : s.difficulty,
      runKind: bieg ? (bieg.kind as RunKind) : null,
      note: s.note,
    };
  });
}

// Podgląd w kalendarzu głównym: kolor kategorii Sport i adres dymku tego treningu na /sport
export const SPORT_COLOR = "#c2410c";

// { date: "2026-11-19", key: "t:t1:2026-11-19" } -> "/sport?miesiac=2026-11&wybrany=t:t1:2026-11-19"
export function sportItemHref(item: Pick<SportItem, "date" | "key">): string {
  return `/sport?miesiac=${item.date.slice(0, 7)}&wybrany=${item.key}`;
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
// kg puste, a powt. = pierwsza liczba z reps_text. Ćwiczenie powtórzone w szablonie
// bierzemy tylko z pierwszej pozycji — w treningu każde ćwiczenie jest raz (jak w addExercise),
// a (sesja, ćwiczenie, numer serii) jest w bazie unikalne.
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

  const uzyte = new Set<string>();
  for (const poz of pozycje) {
    if (uzyte.has(poz.exercise_id)) continue;
    uzyte.add(poz.exercise_id);
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

// Przerwa w szablonie wpisywana jako "m:ss": "2:00" -> 120, "0:45" -> 45; do 30:00, zły zapis -> null
export function parseRest(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const s = Number(m[1]) * 60 + Number(m[2]);
  return s <= 1800 ? s : null;
}

// 120 -> "2:00", 45 -> "0:45"
export function formatRest(s: number): string {
  return `${Math.floor(s / 60)}:${dwie(s % 60)}`;
}

// Polska odmiana z liczbą: 1 ćwiczenie, 2–4 ćwiczenia (bez 12–14), 5 ćwiczeń
export function plPlural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  if (n === 1) return `${n} ${one}`;
  const j = n % 10;
  const d = n % 100;
  return `${n} ${j >= 2 && j <= 4 && (d < 12 || d > 14) ? few : many}`;
}

const DNI_KROTKO = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];

// „ostatnio: czw 12.11” — chwila last_used_at jako dzień w strefie profilu; brak -> "—"
export function formatLastUsed(iso: string | null, timeZone: string): string {
  if (!iso) return "—";
  const dzien = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return `${DNI_KROTKO[weekdayOf(dzien)]} ${dzien.slice(8, 10)}.${dzien.slice(5, 7)}`;
}
