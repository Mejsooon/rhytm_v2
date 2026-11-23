// Dziś: kafelki tygodnia i dnia, plan dnia, blok „Teraz”, chipy szybkiego dodawania
// i przejście ze stanu pustego — czyste funkcje. Daty to 'YYYY-MM-DD', godziny to minuty
// od północy w strefie profilu (dostają je z zewnątrz jako `today` i `nowMin`).
import type { IsoDate } from "@/components/controls/calendar-math";
import type { CategoryRow } from "@/features/calendar/load-calendar";
import type { Occurrence } from "@/features/calendar/occurrences";
import { addDays, viewRange } from "@/features/calendar/view-range";
import {
  currentStreak,
  dayStats,
  isPlanned,
  scheduleOn,
  type Checks,
  type Habit,
} from "@/features/habits/model";
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
    nextRun: {
      date: IsoDate;
      startMin: number;
      distanceKm: number | null;
    } | null;
  };
  workouts: {
    done: number;
    total: number;
    // Zaplanowane treningi od teraz do końca tygodnia, rosnąco
    upcoming: { kind: "run" | "gym"; date: IsoDate; startMin: number }[];
  };
  // Słupki kafelków: 7 wartości od weekStartDate, null dla dni po dziś
  days: {
    tasks: (number | null)[]; // zrobione zadania z due_date tego dnia
    habits: ({ done: number; planned: number } | null)[];
    sleep: (number | null)[]; // minuty snu nocy (data pobudki); null też bez wpisu
    km: (number | null)[]; // km wykonanych biegów (z dystansem i czasem, jak weekStats)
    workouts: (number | null)[]; // wykonane treningi
  };
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

  // Zadania: wszystkie z due_date w tygodniu (każde należy do wystąpienia bloku);
  // zaległe sprzed tygodnia i bez daty się nie liczą
  let zadaniaZrobione = 0;
  let zadaniaWszystkie = 0;
  let dzisZrobione = 0;
  let dzisWszystkie = 0;
  // Dni tygodnia: indeks 0 = weekStartDate; dni po dziś to null
  const dni = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const zadaniaDni: (number | null)[] = dni.map((d) => (d <= today ? 0 : null));
  for (const z of input.tasks) {
    if (z.due_date === null) continue;
    if (z.due_date < weekStartDate || z.due_date > koniec) continue;
    zadaniaWszystkie++;
    if (z.done) zadaniaZrobione++;
    const i = dni.indexOf(z.due_date);
    const dotad = zadaniaDni[i];
    if (z.done && dotad !== null) zadaniaDni[i] = dotad + 1;
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
  const nawykiDni: ({ done: number; planned: number } | null)[] = dni.map(
    () => null,
  );
  for (let d = weekStartDate; d <= koniec && d <= today; d = addDays(d, 1)) {
    const dzien = dayStats(input.habits, input.checks, d, today);
    nawykiDni[dni.indexOf(d)] =
      dzien.percent === null
        ? { done: 0, planned: 0 }
        : { done: dzien.done, planned: dzien.planned };
    if (dzien.percent === null) continue;
    sumaProporcji += dzien.done / dzien.planned;
    dniZPlanem++;
    if (dzien.percent > 70) powyzej70++;
  }

  // Sen: wpisy z datą (dzień pobudki) w tygodniu; jeden wpis na noc (pierwszy wygrywa)
  const noce = new Set<IsoDate>();
  let sumaSnu = 0;
  let nocyZCelem = 0;
  const senDni: (number | null)[] = dni.map(() => null);
  for (const log of input.sleepLogs) {
    if (log.date < weekStartDate || log.date > koniec || noce.has(log.date))
      continue;
    const minuty = sleepMinutes(log.sleptAt, log.wokeAt);
    if (minuty === null) continue;
    noce.add(log.date);
    if (log.date <= today) senDni[dni.indexOf(log.date)] = minuty;
    sumaSnu += minuty;
    if (minuty >= input.sleepGoalMin) nocyZCelem++;
  }

  // Sport: wykonane z weekStats. Zaplanowane do mianownika „Treningi” liczą się od dziś
  // (cały dzisiejszy dzień, także plan o minionej godzinie) do końca tygodnia;
  // najbliższy bieg liczy się od teraz.
  const biegi = input.sportItems.filter((i) => i.kind === "run");
  const statystyki = weekStats(input.sportItems, weekStartDate);
  let nextRun: WeekTiles["run"]["nextRun"] = null;
  let zaplanowane = 0;
  const nadchodzace: WeekTiles["workouts"]["upcoming"] = [];
  const kmDni: (number | null)[] = dni.map((d) => (d <= today ? 0 : null));
  const treningiDni: (number | null)[] = dni.map((d) =>
    d <= today ? 0 : null,
  );
  for (const i of input.sportItems) {
    if (i.date < weekStartDate || i.date > koniec) continue;
    // Wykonane: słupki dni (jak weekStats: km tylko z dystansem i czasem)
    if (!i.planned) {
      const d = dni.indexOf(i.date);
      const ileTreningow = treningiDni[d];
      if (ileTreningow !== null) treningiDni[d] = ileTreningow + 1;
      const ileKm = kmDni[d];
      if (
        i.kind === "run" &&
        i.distanceKm !== null &&
        i.durationS !== null &&
        ileKm !== null
      ) {
        kmDni[d] = ileKm + i.distanceKm;
      }
      continue;
    }
    if (i.date < today) continue;
    zaplanowane++;
    if (i.date === today && i.startMin < nowMin) continue;
    nadchodzace.push({ kind: i.kind, date: i.date, startMin: i.startMin });
    if (i.kind !== "run") continue;
    const wczesniej =
      nextRun === null ||
      i.date < nextRun.date ||
      (i.date === nextRun.date && i.startMin < nextRun.startMin);
    if (wczesniej)
      nextRun = {
        date: i.date,
        startMin: i.startMin,
        distanceKm: i.distanceKm,
      };
  }
  nadchodzace.sort((a, b) =>
    a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1,
  );
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
      upcoming: nadchodzace,
    },
    days: {
      tasks: zadaniaDni,
      habits: nawykiDni,
      sleep: senDni,
      km: kmDni,
      workouts: treningiDni,
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
    // ostatnie 10 znaków, a nie pole zadania `occurrence_date` w nowej dacie. `o.date` to data po przesunięciu.
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

// Blok „Teraz”: pierwszy blok, dla którego start ≤ teraz < koniec; treningi się nie liczą
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

export type QuickKind = "block" | "run" | "habit";

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

// Karta „Ten tydzień” (wariant F): 4 wiersze z gotowymi tekstami. Liczy z `weekTiles`,
// więc dostaje to samo wejście. `percent` to pasek 0–100.
export type WeekBar = {
  label: "Treningi" | "Bieg" | "Nawyki" | "Sen";
  value: string; // duża liczba, np. „2”, „10”, „78 %”, „7:25”
  unit: string; // szary dopisek, np. „/ 4”, „/ 25 km”, „dni z celem”
  percent: number;
  right: string; // prawa kolumna
};

export function weekBars(input: Parameters<typeof weekTiles>[0]): WeekBar[] {
  const t = weekTiles(input);
  // Pasek: zaokrąglony procent z zakresu 0–100 (cel 0 → pusty pasek)
  const procent = (czesc: number, calosc: number) =>
    calosc <= 0
      ? 0
      : Math.min(100, Math.max(0, Math.round((czesc / calosc) * 100)));
  // Km bez zbędnego zera, z przecinkiem: „10”, „7,5”
  const km = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");
  // Czas „h:mm”
  const hmm = (minuty: number) =>
    `${Math.floor(minuty / 60)}:${String(minuty % 60).padStart(2, "0")}`;

  // Treningi: cel wyłączony → sama liczba wykonanych
  const treningiCel = input.workoutsGoalOn;
  const treningiBrakuje = Math.max(0, t.workouts.total - t.workouts.done);

  // Bieg: cel wyłączony (goalKm null) → sama liczba km. „Cel osiągnięty” tylko przy surowym
  // km ≥ cel (24,96 z 25 to jeszcze nie cel); brakujące km zaokrąglone w górę do 0,1
  // (odjęcie 1e-9 chroni przed błędem ułamków, np. 15,000000000000002 → 15,1)
  const biegCel = t.run.goalKm;
  const biegOsiagniety = biegCel !== null && t.run.km >= biegCel;
  const biegBrakuje =
    biegCel === null || biegOsiagniety
      ? 0
      : Math.ceil((biegCel - t.run.km) * 10 - 1e-9) / 10;

  // Sen: średnia wobec celu, nie więcej niż 100 %
  const sen = t.sleep;

  return [
    {
      label: "Treningi",
      value: String(t.workouts.done),
      unit: treningiCel ? `/ ${t.workouts.total}` : "",
      percent: treningiCel ? procent(t.workouts.done, t.workouts.total) : 0,
      right: !treningiCel
        ? "—"
        : treningiBrakuje === 0
          ? "cel osiągnięty"
          : `jeszcze ${treningiBrakuje}`,
    },
    {
      label: "Bieg",
      value: km(t.run.km),
      unit: biegCel === null ? "km" : `/ ${km(biegCel)} km`,
      // Przed celem pasek najwyżej 99 % (zaokrąglenie nie może udawać pełnego paska)
      percent:
        biegCel === null
          ? 0
          : biegOsiagniety
            ? procent(t.run.km, biegCel)
            : Math.min(99, procent(t.run.km, biegCel)),
      right:
        biegCel === null
          ? "—"
          : biegOsiagniety
            ? "cel osiągnięty"
            : `jeszcze ${km(Math.max(0.1, biegBrakuje))} km`,
    },
    {
      label: "Nawyki",
      value: `${t.habits.percent ?? 0} %`,
      unit: "dni z celem",
      percent: procent(t.habits.percent ?? 0, 100),
      right: "—",
    },
    {
      label: "Sen",
      value: sen.avgMin === null ? "—" : hmm(sen.avgMin),
      unit: `/ ${hmm(sen.goalMin)} śr.`,
      percent: sen.avgMin === null ? 0 : procent(sen.avgMin, sen.goalMin),
      right:
        sen.nights === 0
          ? "brak wpisów"
          : `${sen.nightsAtGoal} z ${sen.nights} nocy ≥ cel`,
    },
  ];
}

export type TodayHabit = {
  id: string;
  name: string;
  done: boolean;
  streak: { value: number; unit: "days" | "weeks" };
  streakLabel: string;
  hot: boolean; // passa ≥ 3: płomień w kolorze #c2410c
};

// Nawyki na dziś (z włączonym „pokaż na Dziś”): zaplanowane na dziś (codziennie / dni tygodnia) i X/tydz.,
// w kolejności z wejścia (jak w module Nawyki)
export function todayHabits(input: {
  today: IsoDate;
  weekStart: "mon" | "sun";
  habits: Habit[];
  checks: Checks;
}): TodayHabit[] {
  const wynik: TodayHabit[] = [];
  for (const h of input.habits) {
    // Nawyk ukryty w module Nawyki („pokaż na Dziś” wyłączone) nie trafia na listę
    if (!h.showOnToday) continue;
    const wersja = scheduleOn(h, input.today);
    if (wersja === null) continue;
    if (wersja.type !== "times_per_week" && !isPlanned(h, input.today)) {
      continue;
    }
    const passa = currentStreak(h, input.checks, input.today, input.weekStart);
    const v = passa.value;
    const etykieta =
      v === 0
        ? "zacznij passę"
        : passa.unit === "weeks"
          ? `${v} tyg. z rzędu`
          : v === 1
            ? "1 dzień z rzędu"
            : `${v} dni z rzędu`;
    wynik.push({
      id: h.id,
      name: h.name,
      done: input.checks.get(h.id)?.has(input.today) ?? false,
      streak: { value: v, unit: passa.unit },
      streakLabel: etykieta,
      hot: v >= 3,
    });
  }
  return wynik;
}

export type DayPlanRow =
  | {
      type: "gap";
      startMin: number;
      endMin: number;
      time: string; // „HH:MM” początku przerwy
      label: string; // „30 min wolne”, „1 h wolne”, „1 h 30 min wolne”, „24 h wolne”
      big: boolean; // ≥ 180 min
    }
  | { type: "item"; item: PlanItem };

// Wiersze planu dnia: wpisy (z `dayPlan`, rosnąco po starcie) poprzedzielane przerwami.
// Przerwa to odcinek 0–1440 bez żadnego wpisu; nakładające się wpisy łączą się w jedno pokrycie.
export function dayPlanRows(plan: PlanItem[]): DayPlanRow[] {
  const wiersze: DayPlanRow[] = [];
  let pokryte = 0;
  // Dodaje przerwę [od, do) jako wiersz z gotowym tekstem
  const przerwa = (od: number, do_: number) => {
    const minuty = do_ - od;
    const h = Math.floor(minuty / 60);
    const m = minuty % 60;
    wiersze.push({
      type: "gap",
      startMin: od,
      endMin: do_,
      time: `${String(Math.floor(od / 60)).padStart(2, "0")}:${String(od % 60).padStart(2, "0")}`,
      label: `${h > 0 ? `${h} h` : ""}${h > 0 && m > 0 ? " " : ""}${m > 0 ? `${m} min` : ""} wolne`,
      big: minuty >= 180,
    });
  };
  for (const item of plan) {
    if (item.startMin > pokryte) przerwa(pokryte, item.startMin);
    wiersze.push({ type: "item", item });
    pokryte = Math.max(pokryte, item.endMin);
  }
  if (pokryte < 1440) przerwa(pokryte, 1440);
  return wiersze;
}

// „0 bloków”, „1 blok”, „2 bloki”, „5 bloków”, „12 bloków”, „22 bloki”
export function blocksCountLabel(n: number): string {
  if (n === 1) return "1 blok";
  const reszta10 = n % 10;
  const reszta100 = n % 100;
  if (reszta10 >= 2 && reszta10 <= 4 && (reszta100 < 12 || reszta100 > 14)) {
    return `${n} bloki`;
  }
  return `${n} bloków`;
}
