// Model onboardingu: stałe z makiet i czysta logika kroków (bez Reacta i bazy).

export type RoleKey = "student" | "work" | "free" | "sport" | "other";
export type PageKey = "Projects" | "Books" | "Websites";
export type SourceKey =
  | "friend"
  | "uni"
  | "tiktok"
  | "insta"
  | "yt"
  | "x"
  | "reddit"
  | "search"
  | "ai"
  | "other";
export type ReminderKey = "before" | "renew" | "weekly" | "habits";
// Rodzaj celu treningowego: liczba treningów albo kilometrów w tygodniu
export type GoalType = "workouts" | "km";

// OnboardingRole
export const ROLES: { key: RoleKey; title: string; desc: string }[] = [
  { key: "student", title: "Student", desc: "Zajęcia, kolokwia, projekty" },
  { key: "work", title: "Pracuję", desc: "Godziny pracy i spotkania" },
  {
    key: "free",
    title: "Freelancer lub firma",
    desc: "Klienci, zlecenia, terminy",
  },
  { key: "sport", title: "Trenuję regularnie", desc: "Biegi, siłownia, plan" },
  { key: "other", title: "Coś innego", desc: "Kategorie ułożysz sam" },
];

// OnboardingPages (kolejność = kolejność w sidebarze)
export const PAGE_TEMPLATES: {
  key: PageKey;
  name: string;
  desc: string;
  fields: string;
}[] = [
  {
    key: "Projects",
    name: "Projects",
    desc: "Statusy, terminy i linki do repo",
    fields: "Status · Data · URL",
  },
  {
    key: "Books",
    name: "Books",
    desc: "Przeczytane, w trakcie i na później",
    fields: "Status · Ocena · Autor",
  },
  {
    key: "Websites",
    name: "Websites",
    desc: "Zakładki z kategoriami",
    fields: "URL · Select · Checkbox",
  },
];

// OnboardingSource
export const SOURCES: { key: SourceKey; label: string }[] = [
  { key: "friend", label: "Od znajomego" },
  { key: "uni", label: "Na uczelni" },
  { key: "tiktok", label: "TikTok" },
  { key: "insta", label: "Instagram" },
  { key: "yt", label: "YouTube" },
  { key: "x", label: "X" },
  { key: "reddit", label: "Reddit" },
  { key: "search", label: "Wyszukiwarka" },
  { key: "ai", label: "ChatGPT lub inne AI" },
  { key: "other", label: "Inne" },
];

// OnboardingNotify
export const REMINDERS: { key: ReminderKey; title: string; when: string }[] = [
  { key: "before", title: "Przed blokiem", when: "10 min wcześniej" },
  {
    key: "renew",
    title: "Odnowienie subskrypcji",
    when: "3 dni wcześniej, o 9:00",
  },
  { key: "weekly", title: "Podsumowanie tygodnia", when: "Niedziela, 18:00" },
  { key: "habits", title: "Nawyki na dziś", when: "Codziennie, 21:00" },
];

export const CATEGORY_COLORS = {
  Studia: "#0070f3",
  Praca: "#7c3aed",
  Projekty: "#15803d",
  Sport: "#c2410c",
  Dom: "#a16207",
} as const;

export type OnboardingDraft = {
  name: string;
  avatarPath: string | null;
  timezone: string;
  weekStart: "mon" | "sun";
  clock: "24" | "12";
  roles: RoleKey[];
  studyField: string;
  // Dwa niezależne cele treningowe (co najmniej jeden włączony); liczby zostają w szkicu po wyłączeniu
  workoutsOn: boolean;
  kmOn: boolean;
  weeklyWorkouts: number;
  weeklyKm: number;
  sleepGoalMin: number;
  source: SourceKey | null;
  sourceOther: string;
  // Strony wybrane w kroku 5 (na starcie nic nie jest zaznaczone)
  pages: PageKey[] | null;
  notify: { perm: boolean } & Record<ReminderKey, boolean>;
};

// Kategorie kalendarza z ról. "Dom" gdy wybrano "other" albo żadna rola nie daje kategorii.
export function categoriesForRoles(
  roles: RoleKey[],
): { name: string; color: string; is_system: boolean }[] {
  const nazwy: (keyof typeof CATEGORY_COLORS)[] = [];
  if (roles.includes("student")) nazwy.push("Studia");
  if (roles.includes("work")) nazwy.push("Praca");
  if (roles.includes("free")) nazwy.push("Projekty");
  if (roles.includes("sport")) nazwy.push("Sport");
  if (roles.includes("other") || nazwy.length === 0) nazwy.push("Dom");

  return nazwy.map((name) => ({
    name,
    color: CATEGORY_COLORS[name],
    is_system: name === "Sport",
  }));
}

// Strony wybrane w kroku 5; bez wyboru (null) nie dodajemy żadnej
export function effectivePages(draft: OnboardingDraft): PageKey[] {
  return draft.pages ?? [];
}

// Licznik kilometrów: co 5, zakres 5–150 (nieliczba z pola web wraca do 25).
// Liczbę z pola web (np. 42 albo 200) najpierw wyrównujemy do siatki co 5: 42 + → 45, 200 − → 150.
export function stepKm(km: number, dir: -1 | 1): number {
  if (!Number.isFinite(km)) return 25;
  return Math.min(150, Math.max(5, Math.round(km / 5) * 5 + dir * 5));
}

// Licznik treningów: co 1, zakres 1–14 (nieliczba z pola web wraca do 3)
export function stepWorkouts(n: number, dir: -1 | 1): number {
  if (!Number.isFinite(n)) return 3;
  return Math.min(14, Math.max(1, n + dir));
}

// Poprawny cel: treningi całe 1–14, kilometry 1–300 (też ułamki; jak w schemacie kroku 3)
export function goalInRange(type: GoalType, value: number): boolean {
  if (type === "workouts")
    return Number.isInteger(value) && value >= 1 && value <= 14;
  return Number.isFinite(value) && value >= 1 && value <= 300;
}

// Kilometry z polskim przecinkiem: 22.5 -> "22,5"
export function formatKm(km: number): string {
  return String(km).replace(".", ",");
}

// 1 -> "1 trening / tydz.", 3 -> "3 treningi / tydz.", 5 -> "5 treningów / tydz.", 25 km -> "25 km / tydz."
export function formatWeeklyGoal(type: GoalType, value: number): string {
  if (type === "km") return `${formatKm(value)} km / tydz.`;
  const jednosci = value % 10;
  const dziesiatki = value % 100;
  let slowo = "treningów";
  if (value === 1) slowo = "trening";
  else if (
    jednosci >= 2 &&
    jednosci <= 4 &&
    (dziesiatki < 12 || dziesiatki > 14)
  )
    slowo = "treningi";
  return `${value} ${slowo} / tydz.`;
}

// Cel snu w minutach: co 15, zakres 300–660
export function stepSleep(min: number, dir: -1 | 1): number {
  return Math.min(660, Math.max(300, min + dir * 15));
}

// 495 -> "8:15"
export function formatSleep(min: number): string {
  const m = min % 60;
  return `${Math.floor(min / 60)}:${String(m).padStart(2, "0")}`;
}

export function canContinue(step: number, draft: OnboardingDraft): boolean {
  if (step === 1) return draft.name.trim() !== "";
  // Krok 3: co najmniej jeden cel treningowy, a każdy włączony ma poprawną liczbę
  if (step === 3) {
    if (!draft.workoutsOn && !draft.kmOn) return false;
    if (draft.workoutsOn && !goalInRange("workouts", draft.weeklyWorkouts))
      return false;
    if (draft.kmOn && !goalInRange("km", draft.weeklyKm)) return false;
    return true;
  }
  return true;
}

// Podsumowanie na ostatnim ekranie; step = krok do którego prowadzi wiersz
export function buildSummary(
  draft: OnboardingDraft,
  variant: "web" | "mobile",
  tzCity: string,
): {
  key: "Profil" | "Kategorie" | "Cele treningowe" | "Strony" | "Przypomnienia";
  value: string;
  step: 1 | 2 | 3 | 5 | 6;
}[] {
  const nazwa = draft.name.trim() || "Ty";
  const kategorie = categoriesForRoles(draft.roles)
    .map((c) => c.name)
    .join(", ");
  const strony = effectivePages(draft).join(", ") || "brak";
  const wlaczone = (["before", "renew", "weekly", "habits"] as const).filter(
    (k) => draft.notify[k],
  ).length;

  let profil: string;
  let przypomnienia: string;
  if (variant === "web") {
    profil = `${nazwa} · ${draft.timezone}`;
    przypomnienia = `${wlaczone} włączone`;
  } else {
    const tydzien = draft.weekStart === "mon" ? "pn" : "nd";
    profil = `${nazwa} · ${tzCity} · tydzień od ${tydzien}`;
    przypomnienia =
      `${wlaczone} z 4 włączone` +
      (draft.notify.perm ? "" : " · bez zgody na push");
  }

  const wiersze: ReturnType<typeof buildSummary> = [
    { key: "Profil", value: profil, step: 1 },
    { key: "Kategorie", value: kategorie, step: 2 },
  ];
  // Cele treningowe: włączone, np. „3 treningi / tydz. · 25 km / tydz.”
  const cele: string[] = [];
  if (draft.workoutsOn)
    cele.push(formatWeeklyGoal("workouts", draft.weeklyWorkouts));
  if (draft.kmOn) cele.push(formatWeeklyGoal("km", draft.weeklyKm));
  wiersze.push({ key: "Cele treningowe", value: cele.join(" · "), step: 3 });
  wiersze.push({ key: "Strony", value: strony, step: 5 });
  wiersze.push({ key: "Przypomnienia", value: przypomnienia, step: 6 });
  return wiersze;
}

// Szkic -> payload kroku w kluczach schematów z src/features/profile/schemas.ts (kroki 1–6)
export function stepPayload(
  step: 1 | 2 | 3 | 4 | 5 | 6,
  draft: OnboardingDraft,
) {
  switch (step) {
    case 1:
      return {
        display_name: draft.name,
        timezone: draft.timezone,
        week_start: draft.weekStart,
        clock: draft.clock,
        avatar_path: draft.avatarPath,
      };
    case 2:
      return { roles: draft.roles, study_field: draft.studyField };
    case 3:
      // Zapisujemy oba przełączniki i obie liczby; zła liczba wyłączonego celu wraca do wartości domyślnej
      return {
        workouts_goal_on: draft.workoutsOn,
        km_goal_on: draft.kmOn,
        weekly_workouts_goal: goalInRange("workouts", draft.weeklyWorkouts)
          ? draft.weeklyWorkouts
          : 3,
        weekly_km_goal: goalInRange("km", draft.weeklyKm) ? draft.weeklyKm : 25,
        sleep_goal_min: draft.sleepGoalMin,
      };
    case 4:
      return {
        referral_source: draft.source,
        referral_other: draft.sourceOther,
      };
    case 5:
      return { pending_pages: effectivePages(draft) };
    case 6:
      return {
        push_enabled: draft.notify.perm,
        before: draft.notify.before,
        renew: draft.notify.renew,
        weekly: draft.notify.weekly,
        habits: draft.notify.habits,
      };
  }
}
