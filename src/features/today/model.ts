// Dziś: kafelki tygodnia i dnia, plan dnia, blok „TERAZ”, chipy szybkiego dodawania
// i przejście ze stanu pustego — czyste funkcje. Daty to 'YYYY-MM-DD', godziny to minuty
// od północy w strefie profilu (dostają je z zewnątrz jako `today` i `nowMin`).
import type { IsoDate } from "@/components/controls/calendar-math";
import type { CategoryRow } from "@/features/calendar/load-calendar";
import type { Occurrence } from "@/features/calendar/occurrences";
import { addDays, viewRange } from "@/features/calendar/view-range";
import { dayStats, type Checks, type Habit } from "@/features/habits/model";
import { sleepMinutes, type SleepLog } from "@/features/habits/sleep";
import {
  SPORT_COLOR,
  weekStats,
  type RunKind,
  type SportItem,
} from "@/features/sport/model";
import { occurrenceProgress, type TaskRow } from "@/features/tasks/model";

// Numer tygodnia ISO 8601 — ten sam co w kalendarzu
export { isoWeekNumber } from "@/features/calendar/view-range";

// Kolor bloku bez kategorii — jak w siatce kalendarza
const KOLOR_BRAK = "#a3a3a3";

// Pierwszy dzień tygodnia, w którym leży `today`
export function weekStart(today: IsoDate, start: "mon" | "sun"): IsoDate {
  return viewRange("tydzien", today, start).from;
}

export type WeekTiles = {
  tasks: {
    done: number;
    total: number;
    percent: number | null; // null = brak zadań w tygodniu
    todayDone: number;
    todayTotal: number;
  };
  habits: { percent: number | null; above70: number; plannedDays: number };
  sleep: {
    avgMin: number | null;
    goalMin: number;
    nightsAtGoal: number;
    nights: number;
  };
  run: {
    km: number;
    goalKm: number | null; // null = cel km wyłączony
    nextRun: { date: IsoDate; startMin: number } | null;
  };
  workouts: { done: number; total: number };
};

// Karta „Ten tydzień”: 7 dni od weekStartDate
export function weekTiles(input: {
  today: IsoDate;
  nowMin: number;
  weekStartDate: IsoDate;
  tasks: TaskRow[];
  habits: Habit[];
  checks: Checks;
  sleepLogs: SleepLog[];
  sleepGoalMin: number;
  sportItems: SportItem[];
  kmGoalOn: boolean;
  weeklyKmGoal: number;
  workoutsGoalOn: boolean;
  weeklyWorkoutsGoal: number;
}): WeekTiles {
  const { today, nowMin, weekStartDate } = input;
  const koniec = addDays(weekStartDate, 6);

  // Zadania: wszystkie z due_date w tygodniu (samodzielne i z wystąpień bloków);
  // zaległe sprzed tygodnia i bez daty się nie liczą
  let zadaniaZrobione = 0;
  let zadaniaWszystkie = 0;
  let dzisZrobione = 0;
  let dzisWszystkie = 0;
  for (const z of input.tasks) {
    if (z.due_date === null) continue;
    if (z.due_date < weekStartDate || z.due_date > koniec) continue;
    zadaniaWszystkie++;
    if (z.done) zadaniaZrobione++;
    if (z.due_date === today) {
      dzisWszystkie++;
      if (z.done) dzisZrobione++;
    }
  }

  // Nawyki: średnia % dni z planem od początku tygodnia do dziś włącznie.
  // Uśredniamy nieokrąglone proporcje (jak last30Comparison), „powyżej 70” wg % dnia.
  let sumaProporcji = 0;
  let dniZPlanem = 0;
  let powyzej70 = 0;
  for (let d = weekStartDate; d <= koniec && d <= today; d = addDays(d, 1)) {
    const dzien = dayStats(input.habits, input.checks, d, today);
    if (dzien.percent === null) continue;
    sumaProporcji += dzien.done / dzien.planned;
    dniZPlanem++;
    if (dzien.percent > 70) powyzej70++;
  }

  // Sen: wpisy z datą (dzień pobudki) w tygodniu; jeden wpis na noc (pierwszy wygrywa)
  const noce = new Set<IsoDate>();
  let sumaSnu = 0;
  let nocyZCelem = 0;
  for (const log of input.sleepLogs) {
    if (log.date < weekStartDate || log.date > koniec || noce.has(log.date))
      continue;
    const minuty = sleepMinutes(log.sleptAt, log.wokeAt);
    if (minuty === null) continue;
    noce.add(log.date);
    sumaSnu += minuty;
    if (minuty >= input.sleepGoalMin) nocyZCelem++;
  }

  // Sport: wykonane z weekStats. Zaplanowane do mianownika „Treningi” liczą się od dziś
  // (cały dzisiejszy dzień, także plan o minionej godzinie) do końca tygodnia;
  // najbliższy bieg liczy się od teraz.
  const biegi = input.sportItems.filter((i) => i.kind === "run");
  const statystyki = weekStats(input.sportItems, weekStartDate);
  let nextRun: { date: IsoDate; startMin: number } | null = null;
  let zaplanowane = 0;
  for (const i of input.sportItems) {
    if (!i.planned || i.date > koniec || i.date < today) continue;
    zaplanowane++;
    if (i.kind !== "run") continue;
    if (i.date === today && i.startMin < nowMin) continue;
    const wczesniej =
      nextRun === null ||
      i.date < nextRun.date ||
      (i.date === nextRun.date && i.startMin < nextRun.startMin);
    if (wczesniej) nextRun = { date: i.date, startMin: i.startMin };
  }
  const zPlanu = statystyki.done + zaplanowane;

  return {
    tasks: {
      done: zadaniaZrobione,
      total: zadaniaWszystkie,
      percent:
        zadaniaWszystkie === 0
          ? null
          : Math.round((zadaniaZrobione / zadaniaWszystkie) * 100),
      todayDone: dzisZrobione,
      todayTotal: dzisWszystkie,
    },
    habits: {
      percent:
        dniZPlanem === 0
          ? null
          : Math.round((sumaProporcji / dniZPlanem) * 100),
      above70: powyzej70,
      plannedDays: dniZPlanem,
    },
    sleep: {
      avgMin: noce.size === 0 ? null : Math.round(sumaSnu / noce.size),
      goalMin: input.sleepGoalMin,
      nightsAtGoal: nocyZCelem,
      nights: noce.size,
    },
    run: {
      km: weekStats(biegi, weekStartDate).km,
      goalKm: input.kmGoalOn ? input.weeklyKmGoal : null,
      nextRun,
    },
    workouts: {
      done: statystyki.done,
      total: input.workoutsGoalOn
        ? Math.max(zPlanu, input.weeklyWorkoutsGoal)
        : zPlanu,
    },
  };
}

export type PlanItem = {
  key: string;
  kind: "block" | "run" | "gym";
  title: string;
  startMin: number;
  endMin: number; // najwyżej 1440 (trening przez północ jest ucięty)
  color: string;
  categoryName: string | null;
  planned: boolean; // trening zaplanowany (nie wykonany); bloki zawsze false
  tasksDone: number;
  tasksTotal: number;
  occurrence: Occurrence | null; // tylko dla bloków
  sportKey: string | null; // tylko dla treningów (klucz do /sport?wybrany=)
};

// Plan dnia: wystąpienia bloków z dziś (z wyjątkami — tak je daje expandOccurrences)
// i treningi z dziś, posortowane po godzinie
export function dayPlan(
  occurrences: Occurrence[],
  categories: CategoryRow[],
  tasks: TaskRow[],
  sportItems: SportItem[],
  today: IsoDate,
): PlanItem[] {
  const wynik: PlanItem[] = [];

  // Blok nie przechodzi przez północ (schemas.ts i actions.ts to blokują), więc nie ma
  // „ogona” wczorajszego bloku na dziś — wystarczą wystąpienia z datą dziś, jak w siatce kalendarza.
  for (const o of occurrences) {
    if (o.date !== today) continue;
    const kat = categories.find((k) => k.id === o.categoryId) ?? null;
    // Zadania wystąpienia są przypięte do ORYGINALNEJ daty. Occurrence nie ma osobnego pola
    // na nią — jest tylko w kluczu `${blockId}:${date}` (occurrences.ts), więc bierzemy
    // ostatnie 10 znaków, tak samo jak pinTask w tasks/model.ts. `o.date` to data po przesunięciu.
    const postep = occurrenceProgress(tasks, o.blockId, o.key.slice(-10));
    wynik.push({
      key: o.key,
      kind: "block",
      title: o.title,
      startMin: o.startMin,
      endMin: Math.min(o.startMin + o.durationMin, 1440),
      color: kat?.color ?? KOLOR_BRAK,
      categoryName: kat?.name ?? null,
      planned: false,
      tasksDone: postep.done,
      tasksTotal: postep.total,
      occurrence: o,
      sportKey: null,
    });
  }

  for (const i of sportItems) {
    if (i.date !== today) continue;
    wynik.push({
      key: i.key,
      kind: i.kind,
      title: i.title,
      startMin: i.startMin,
      endMin: Math.min(i.startMin + i.durationMin, 1440),
      color: SPORT_COLOR,
      categoryName: "Sport",
      planned: i.planned,
      tasksDone: 0,
      tasksTotal: 0,
      occurrence: null,
      sportKey: i.key,
    });
  }

  wynik.sort((a, b) => a.startMin - b.startMin);
  return wynik;
}

// Blok „TERAZ”: pierwszy blok, dla którego start ≤ teraz < koniec; treningi się nie liczą
export function nowItem(plan: PlanItem[], nowMin: number): PlanItem | null {
  return (
    plan.find(
      (p) => p.kind === "block" && p.startMin <= nowMin && nowMin < p.endMin,
    ) ?? null
  );
}

// Kafelki 2×2 na telefonie: nawyki i zadania tylko z dziś, sen z ostatniej nocy, km w tygodniu
export function todayTiles(input: {
  today: IsoDate;
  weekStartDate: IsoDate;
  habits: Habit[];
  checks: Checks;
  sleepLogs: SleepLog[];
  tasks: TaskRow[];
  sportItems: SportItem[];
  kmGoalOn: boolean;
  weeklyKmGoal: number;
}): {
  habitsDone: number;
  habitsTotal: number;
  sleepMin: number | null;
  tasksDone: number;
  tasksTotal: number;
  km: number;
  goalKm: number | null;
} {
  const { today } = input;
  const nawyki = dayStats(input.habits, input.checks, today, today);

  // Ostatnia noc = wpis z datą pobudki dziś
  const wpis = input.sleepLogs.find((l) => l.date === today) ?? null;

  // Tylko zadania z terminem dziś — zaległe się nie liczą
  let tasksDone = 0;
  let tasksTotal = 0;
  for (const z of input.tasks) {
    if (z.due_date !== today) continue;
    tasksTotal++;
    if (z.done) tasksDone++;
  }

  const biegi = input.sportItems.filter((i) => i.kind === "run");
  return {
    habitsDone: nawyki.done,
    habitsTotal: nawyki.planned,
    sleepMin: wpis ? sleepMinutes(wpis.sleptAt, wpis.wokeAt) : null,
    tasksDone,
    tasksTotal,
    km: weekStats(biegi, input.weekStartDate).km,
    goalKm: input.kmGoalOn ? input.weeklyKmGoal : null,
  };
}

export type QuickKind = "task" | "block" | "run" | "habit";

// Chipy „Kiedy” w szybkim dodawaniu, zależnie od typu
export function quickWhenOptions(
  kind: QuickKind,
  today: IsoDate,
  nowMin: number,
  weekStartPref: "mon" | "sun",
): { label: string; date: IsoDate | null; startMin: number | null }[] {
  if (kind === "habit") return [];

  const jutro = addDays(today, 1);
  // Pierwszy dzień NASTĘPNEGO tygodnia wg week_start
  const nastepnyTydzien = addDays(weekStart(today, weekStartPref), 7);
  const etykieta = `${weekStartPref === "mon" ? "Pn" : "Nd"} ${nastepnyTydzien.slice(8, 10)}.${nastepnyTydzien.slice(5, 7)}`;

  if (kind === "task") {
    return [
      { label: "Dziś", date: today, startMin: null },
      { label: "Jutro", date: jutro, startMin: null },
      { label: etykieta, date: nastepnyTydzien, startMin: null },
      { label: "Bez daty", date: null, startMin: null },
    ];
  }

  // Blok i bieg: „Dziś” = następna pełna godzina; od 23:00 nie ma już pełnej godziny dziś,
  // więc chip daje jutro 08:00 (bez godzin po północy z dzisiejszą datą)
  const pelna = Math.floor(nowMin / 60) * 60 + 60;
  const dzis =
    pelna < 1440
      ? { label: "Dziś", date: today, startMin: pelna }
      : { label: "Dziś", date: jutro, startMin: 8 * 60 };
  const godzinaJutro = kind === "block" ? 9 * 60 : 18 * 60;

  const wynik: {
    label: string;
    date: IsoDate | null;
    startMin: number | null;
  }[] = [dzis];
  // „Dziś 18:00” tylko wtedy, gdy chip „Dziś” wypada przed 18:00 (od 17:00 „Dziś” to już
  // 18:00 albo później, więc drugi chip byłby duplikatem lub przeszłością)
  if (dzis.date === today && pelna < 18 * 60) {
    wynik.push({ label: "Dziś 18:00", date: today, startMin: 18 * 60 });
  }
  wynik.push({ label: "Jutro", date: jutro, startMin: godzinaJutro });
  wynik.push({
    label: etykieta,
    date: nastepnyTydzien,
    startMin: godzinaJutro,
  });
  return wynik;
}

// Szybki bieg z tekstu: dystans = pierwsza liczba przed „km” (przecinek dozwolony),
// rodzaj ze słów; domyślnie spokojny
export function parseQuickRun(text: string): {
  distanceKm: number | null;
  kind: RunKind;
} {
  const maly = text.toLowerCase();
  const liczba = maly.match(/(\d+(?:[.,]\d+)?)\s*km/);
  const distanceKm = liczba ? Number(liczba[1].replace(",", ".")) : null;

  // Rodzaj: słowo, które w tekście występuje najwcześniej („tempo potem spokojnie” → tempo)
  const slowa: [string, RunKind][] = [
    ["spokojn", "easy"],
    ["tempo", "tempo"],
    ["interwał", "intervals"],
    ["dług", "long"],
    ["zawod", "race"],
  ];
  let kind: RunKind = "easy";
  let najwczesniej = -1;
  for (const [slowo, rodzaj] of slowa) {
    const gdzie = maly.indexOf(slowo);
    if (gdzie === -1) continue;
    if (najwczesniej === -1 || gdzie < najwczesniej) {
      najwczesniej = gdzie;
      kind = rodzaj;
    }
  }

  return { distanceKm, kind };
}

// Pełne Dziś zamiast stanu pustego: wszystkie 4 pierwsze kroki zrobione
// albo jest choć jeden blok i konto jest starsze niż 7 dni
export function showFullToday(
  counts: {
    blocks: number;
    habits: number;
    workouts: number;
    sleepLogs: number;
  },
  accountCreatedAt: string,
  today: IsoDate,
): boolean {
  if (
    counts.blocks > 0 &&
    counts.habits > 0 &&
    counts.workouts > 0 &&
    counts.sleepLogs > 0
  ) {
    return true;
  }
  // Wiek konta w dniach: od dnia założenia (data z timestampu) do dziś
  const dzienZalozenia = accountCreatedAt.slice(0, 10);
  const wiekDni = (Date.parse(today) - Date.parse(dzienZalozenia)) / 86400000;
  return counts.blocks > 0 && wiekDni > 7;
}
