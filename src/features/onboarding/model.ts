// Model onboardingu w 4 krokach (S2OnboardingFlow, CMOnboarding bez kroku kalendarza): stałe i czysta logika.

export const STEP_NAMES = ["Profil", "Do czego", "Pierwszy dzień", "Przypomnienia"] as const;

export type Step = 1 | 2 | 3 | 4;

export const USE_GROUPS = [
  {
    title: "Plan dnia",
    items: [
      ["studia", "Studia"],
      ["praca", "Praca"],
      ["firma", "Klienci i zlecenia"],
      ["dom", "Dom i sprawy"],
    ],
  },
  {
    title: "Ruch",
    items: [
      ["run", "Bieganie"],
      ["gym", "Siłownia"],
      ["oth", "Inne sporty"],
    ],
  },
  {
    title: "Reszta",
    items: [
      ["habits", "Nawyki"],
      ["sleep", "Sen"],
      ["pass", "Hasła"],
      ["subs", "Subskrypcje"],
      ["proj", "Projekty"],
      ["books", "Książki"],
    ],
  },
] as const;

export type UseKey = (typeof USE_GROUPS)[number]["items"][number][0];

export const USE_KEYS = USE_GROUPS.flatMap((g) => g.items.map(([k]) => k as UseKey));

// Nazwy w profiles.pending_pages (PENDING_TO_TEMPLATE w features/pages/templates.ts)
export type PageKey = "Subscriptions" | "Projects" | "Books";

export const SOURCES = [
  ["friend", "Od znajomego"],
  ["uni", "Uczelnia"],
  ["tiktok", "TikTok"],
  ["insta", "Instagram"],
  ["yt", "YouTube"],
  ["search", "Wyszukiwarka"],
  ["ai", "ChatGPT / AI"],
  ["other", "Inne"],
] as const;

export type SourceKey = (typeof SOURCES)[number][0];

export type ReminderKey = "before" | "renew" | "habits";

export const REMINDERS: { key: ReminderKey; title: string; when: string }[] = [
  { key: "before", title: "Przed blokiem", when: "5 min wcześniej" },
  { key: "renew", title: "Odnowienie subskrypcji", when: "Dzień wcześniej, o 9:00" },
  { key: "habits", title: "Nawyki", when: "O godzinie ustawionej przy nawyku" },
];

export const CATEGORY_COLORS = {
  Studia: "#0070f3",
  Praca: "#7c3aed",
  Projekty: "#15803d",
  Sport: "#c2410c",
  Dom: "#a16207",
} as const;

export type CategoryName = keyof typeof CATEGORY_COLORS;

export type DraftBlock = {
  title: string;
  // „HH:MM” z pola (może być w trakcie pisania)
  start: string;
  end: string;
  category: CategoryName;
  // Już zapisany w kalendarzu: nie edytujemy i nie powielamy
  saved?: boolean;
};

export type OnboardingDraft = {
  name: string;
  avatarPath: string | null;
  timezone: string;
  weekStart: "mon" | "sun";
  clock: "24" | "12";
  uses: UseKey[];
  weeklyWorkouts: number;
  weeklyKm: number;
  sleepGoalMin: number;
  blocks: DraftBlock[];
  source: SourceKey | null;
  notify: { perm: boolean } & Record<ReminderKey, boolean>;
};

const ma = (uses: UseKey[], ...klucze: UseKey[]) => klucze.some((k) => uses.includes(k));

export function categoriesForUses(
  uses: UseKey[],
): { name: CategoryName; color: string; is_system: boolean }[] {
  const nazwy: CategoryName[] = [];
  if (ma(uses, "studia")) nazwy.push("Studia");
  if (ma(uses, "praca")) nazwy.push("Praca");
  if (ma(uses, "firma")) nazwy.push("Projekty");
  if (ma(uses, "dom")) nazwy.push("Dom");
  if (ma(uses, "run", "gym", "oth")) nazwy.push("Sport");
  if (nazwy.length === 0) nazwy.push("Dom");
  return nazwy.map((name) => ({ name, color: CATEGORY_COLORS[name], is_system: name === "Sport" }));
}

export function pagesForUses(uses: UseKey[]): PageKey[] {
  const strony: PageKey[] = [];
  if (ma(uses, "subs")) strony.push("Subscriptions");
  if (ma(uses, "proj", "firma")) strony.push("Projects");
  if (ma(uses, "books")) strony.push("Books");
  return strony;
}

const PODPOWIEDZI: [UseKey, DraftBlock][] = [
  ["studia", { start: "08:00", end: "09:30", title: "Zajęcia", category: "Studia" }],
  ["studia", { start: "18:30", end: "20:00", title: "Nauka do kolokwium", category: "Studia" }],
  ["praca", { start: "09:00", end: "17:00", title: "Praca", category: "Praca" }],
  ["firma", { start: "14:00", end: "16:00", title: "Projekt klienta", category: "Projekty" }],
  ["dom", { start: "20:00", end: "20:30", title: "Zakupy i pranie", category: "Dom" }],
  ["run", { start: "17:00", end: "18:00", title: "Bieg 8 km", category: "Sport" }],
  ["gym", { start: "16:00", end: "17:30", title: "Siłownia — Push", category: "Sport" }],
  ["oth", { start: "19:00", end: "20:00", title: "Tenis", category: "Sport" }],
];

// Podpowiedzi z wyborów, bez tych, które już są na liście
export function suggestions(uses: UseKey[], blocks: DraftBlock[]): DraftBlock[] {
  return PODPOWIEDZI.filter(([k, b]) => uses.includes(k) && !blocks.some((x) => x.title === b.title)).map(
    ([, b]) => b,
  );
}

// „08:30” → 510; zły zapis → null
export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export const blockValid = (b: DraftBlock) => {
  const [od, doo] = [toMinutes(b.start), toMinutes(b.end)];
  return od !== null && doo !== null && doo > od;
};

// Cele: bieg 1–300 km (też ułamki), siłownia 1–14, sen 5–11 h co kwadrans
export const kmOk = (v: number) => Number.isFinite(v) && v >= 1 && v <= 300;
export const workoutsOk = (v: number) => Number.isInteger(v) && v >= 1 && v <= 14;
export const sleepOk = (min: number) => Number.isInteger(min) && min >= 300 && min <= 660 && min % 15 === 0;

export function canContinue(step: Step, draft: OnboardingDraft): boolean {
  if (step === 1) return draft.name.trim() !== "";
  if (step === 2) {
    return (
      (!draft.uses.includes("run") || kmOk(draft.weeklyKm)) &&
      (!draft.uses.includes("gym") || workoutsOk(draft.weeklyWorkouts)) &&
      (!draft.uses.includes("sleep") || sleepOk(draft.sleepGoalMin))
    );
  }
  if (step === 3) return draft.blocks.every((b) => b.saved || blockValid(b));
  return true;
}

// Szkic → payload kroku w kluczach schematów z src/features/profile/schemas.ts
export function stepPayload(step: Step, draft: OnboardingDraft) {
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
      return {
        uses: draft.uses,
        // Niewybrany cel może mieć w polu cokolwiek, więc wysyłamy wartość domyślną (akcja jej nie zapisze)
        weekly_km_goal: kmOk(draft.weeklyKm) ? draft.weeklyKm : 25,
        weekly_workouts_goal: workoutsOk(draft.weeklyWorkouts) ? draft.weeklyWorkouts : 3,
        sleep_goal_min: sleepOk(draft.sleepGoalMin) ? draft.sleepGoalMin : 480,
      };
    case 3:
      return {
        blocks: draft.blocks
          .filter((b) => !b.saved)
          .map((b) => ({
            title: b.title,
            category: b.category,
            start_min: toMinutes(b.start) ?? 0,
            end_min: toMinutes(b.end) ?? 0,
          })),
      };
    case 4:
      return {
        referral_source: draft.source,
        push_enabled: draft.notify.perm,
        before: draft.notify.before,
        renew: draft.notify.renew,
        habits: draft.notify.habits,
      };
  }
}
