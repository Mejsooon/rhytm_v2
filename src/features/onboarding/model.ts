// Model onboardingu: stałe z makiet i czysta logika kroków (bez Reacta i bazy).

export type RoleKey = "student" | "work" | "free" | "sport" | "other";
export type GoalKey =
  | "plan"
  | "sport"
  | "habits"
  | "subs"
  | "pass"
  | "proj"
  | "books";
export type PageKey =
  | "Subscriptions"
  | "Projects"
  | "Books"
  | "Websites"
  | "Passwords";
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

// OnboardingRole
export const ROLES: { key: RoleKey; title: string; desc: string }[] = [
  { key: "student", title: "Student", desc: "Zajęcia, kolokwia, projekty" },
  { key: "work", title: "Pracuję", desc: "Godziny pracy i spotkania" },
  { key: "free", title: "Freelancer lub firma", desc: "Klienci, zlecenia, terminy" },
  { key: "sport", title: "Trenuję regularnie", desc: "Biegi, siłownia, plan" },
  { key: "other", title: "Coś innego", desc: "Kategorie ułożysz sam" },
];

// OnboardingGoals (page = strona włączana razem z celem)
export const GOALS: {
  key: GoalKey;
  title: string;
  desc: string;
  page: PageKey | null;
}[] = [
  { key: "plan", title: "Plan tygodnia", desc: "Bloki z zadaniami w środku", page: null },
  { key: "sport", title: "Treningi", desc: "Biegi i siłownia", page: null },
  { key: "habits", title: "Nawyki i sen", desc: "Codzienne odhaczanie", page: null },
  { key: "subs", title: "Subskrypcje", desc: "Sumy i odnowienia", page: "Subscriptions" },
  { key: "pass", title: "Hasła", desc: "Szyfrowany sejf", page: "Passwords" },
  { key: "proj", title: "Projekty", desc: "Statusy i terminy", page: "Projects" },
  { key: "books", title: "Książki", desc: "Co czytasz i co dalej", page: "Books" },
];

// OnboardingPages (kolejność = kolejność w sidebarze)
export const PAGE_TEMPLATES: {
  key: PageKey;
  name: string;
  desc: string;
  fields: string;
}[] = [
  {
    key: "Subscriptions",
    name: "Subscriptions",
    desc: "Sumy miesięczne i roczne, odnowienia w kalendarzu",
    fields: "Kwota cykliczna · Data odnowienia · Aktywna",
  },
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
  {
    key: "Passwords",
    name: "Passwords",
    desc: "Hasło główne ustawisz przy pierwszym otwarciu",
    fields: "Sekret · URL · Login",
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
  { key: "renew", title: "Odnowienie subskrypcji", when: "3 dni wcześniej, o 9:00" },
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
  goals: GoalKey[];
  weeklyKm: number;
  sleepGoalMin: number;
  source: SourceKey | null;
  sourceOther: string;
  // null = użytkownik jeszcze nie ruszał stron, bierzemy polecone z celów
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

// Strony polecone z celów (w kolejności celów z GOALS)
export function recommendedPages(goals: GoalKey[]): PageKey[] {
  const strony: PageKey[] = [];
  for (const g of GOALS) {
    if (g.page && goals.includes(g.key)) strony.push(g.page);
  }
  return strony;
}

export function effectivePages(draft: OnboardingDraft): PageKey[] {
  return draft.pages ?? recommendedPages(draft.goals);
}

// Przełącza cel; jeśli cel ma stronę, włącza/wyłącza ją razem z nim (jak w makiecie web)
export function toggleGoal(
  draft: OnboardingDraft,
  goal: GoalKey,
): OnboardingDraft {
  const wlaczony = draft.goals.includes(goal);
  const goals = wlaczony
    ? draft.goals.filter((g) => g !== goal)
    : [...draft.goals, goal];

  const strona = GOALS.find((g) => g.key === goal)?.page ?? null;
  if (!strona) return { ...draft, goals };

  // Stan stron zostaje zamrożony na aktualnie widocznych, potem zmieniamy jedną
  const biezace = effectivePages(draft);
  const nowe = wlaczony
    ? biezace.filter((p) => p !== strona)
    : [...biezace, strona];
  const pages = PAGE_TEMPLATES.map((t) => t.key).filter((k) => nowe.includes(k));
  return { ...draft, goals, pages };
}

// Licznik kilometrów: co 5, zakres 5–150
export function stepKm(km: number, dir: -1 | 1): number {
  return Math.min(150, Math.max(5, km + dir * 5));
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
  return true;
}

// Podsumowanie na ostatnim ekranie; step = krok do którego prowadzi wiersz
export function buildSummary(
  draft: OnboardingDraft,
  variant: "web" | "mobile",
  tzCity: string,
): {
  key: "Profil" | "Kategorie" | "Strony" | "Przypomnienia";
  value: string;
  step: 1 | 2 | 5 | 6;
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
      `${wlaczone} z 4 włączone` + (draft.notify.perm ? "" : " · bez zgody na push");
  }

  return [
    { key: "Profil", value: profil, step: 1 },
    { key: "Kategorie", value: kategorie, step: 2 },
    { key: "Strony", value: strony, step: 5 },
    { key: "Przypomnienia", value: przypomnienia, step: 6 },
  ];
}
