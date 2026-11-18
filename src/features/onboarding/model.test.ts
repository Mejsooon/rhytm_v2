import { describe, expect, it } from "vitest";
import { onboardingStepSchemas } from "@/features/profile/schemas";
import {
  buildSummary,
  canContinue,
  categoriesForRoles,
  effectivePages,
  formatKm,
  formatSleep,
  formatWeeklyGoal,
  goalInRange,
  GOALS,
  PAGE_TEMPLATES,
  recommendedPages,
  REMINDERS,
  ROLES,
  SOURCES,
  stepKm,
  stepPayload,
  stepSleep,
  stepWorkouts,
  toggleGoal,
  type OnboardingDraft,
} from "./model";

// Szkic z makiety: Mejson, Warszawa, student + sport, 2 strony, 3 przypomnienia
const draft: OnboardingDraft = {
  name: "Mejson",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  roles: ["student", "sport"],
  studyField: "Cyberbezpieczeństwo",
  goals: ["plan", "sport", "habits", "subs", "proj"],
  workoutsOn: true,
  kmOn: false,
  weeklyWorkouts: 3,
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: ["Subscriptions", "Projects"],
  notify: {
    perm: false,
    before: true,
    renew: true,
    weekly: true,
    habits: false,
  },
};

const names = (r: string[]) => r;

describe("stałe", () => {
  it("mają oczekiwane liczności", () => {
    expect(ROLES).toHaveLength(5);
    expect(GOALS).toHaveLength(7);
    expect(PAGE_TEMPLATES).toHaveLength(5);
    expect(SOURCES).toHaveLength(10);
    expect(REMINDERS).toHaveLength(4);
  });
});

describe("categoriesForRoles", () => {
  it("student + sport", () => {
    const c = categoriesForRoles(["student", "sport"]);
    expect(names(c.map((x) => x.name))).toEqual(["Studia", "Sport"]);
    expect(c[1]).toMatchObject({ is_system: true, color: "#c2410c" });
    expect(c[0].is_system).toBe(false);
  });
  it("brak ról -> Dom", () => {
    expect(categoriesForRoles([]).map((x) => x.name)).toEqual(["Dom"]);
  });
  it("praca + inne -> Praca, Dom", () => {
    expect(categoriesForRoles(["work", "other"]).map((x) => x.name)).toEqual([
      "Praca",
      "Dom",
    ]);
  });
  it("free -> Projekty", () => {
    expect(categoriesForRoles(["free"]).map((x) => x.name)).toEqual([
      "Projekty",
    ]);
  });
  it("wszystkie role", () => {
    expect(
      categoriesForRoles(["student", "work", "free", "sport", "other"]).map(
        (x) => x.name,
      ),
    ).toEqual(["Studia", "Praca", "Projekty", "Sport", "Dom"]);
  });
});

describe("recommendedPages", () => {
  it("mapuje cele na strony", () => {
    expect(recommendedPages(["plan", "subs", "proj"])).toEqual([
      "Subscriptions",
      "Projects",
    ]);
    expect(recommendedPages(["pass", "books"])).toEqual(["Books", "Passwords"]);
  });
});

describe("toggleGoal", () => {
  it("wyłączenie celu wyłącza jego stronę", () => {
    const d = toggleGoal({ ...draft, pages: null, goals: ["subs"] }, "subs");
    expect(d.goals).toEqual([]);
    expect(effectivePages(d)).not.toContain("Subscriptions");
  });
  it("włączenie celu dodaje stronę w kolejności szablonów", () => {
    const d = toggleGoal({ ...draft, pages: ["Websites"], goals: [] }, "books");
    expect(effectivePages(d)).toEqual(["Books", "Websites"]);
  });
  it("cele bazowe są stałe: kliknięcie niczego nie zmienia", () => {
    for (const cel of ["plan", "sport", "habits"] as const) {
      expect(toggleGoal(draft, cel)).toBe(draft);
    }
  });
});

describe("kroki liczników", () => {
  it("stepKm", () => {
    expect(stepKm(5, -1)).toBe(5);
    expect(stepKm(150, 1)).toBe(150);
    expect(stepKm(25, 1)).toBe(30);
  });
  it("stepKm: najpierw wyrównuje do siatki co 5 (np. liczba z pola web)", () => {
    expect(stepKm(42, 1)).toBe(45);
    expect(stepKm(42, -1)).toBe(35);
    expect(stepKm(22.5, 1)).toBe(30);
    expect(stepKm(200, -1)).toBe(150);
    expect(stepKm(2, 1)).toBe(5);
  });
  it("stepWorkouts: co 1, zakres 1–14", () => {
    expect(stepWorkouts(1, -1)).toBe(1);
    expect(stepWorkouts(14, 1)).toBe(14);
    expect(stepWorkouts(3, 1)).toBe(4);
    expect(stepWorkouts(3, -1)).toBe(2);
  });
  it("liczniki z nieliczby wracają do wartości domyślnej", () => {
    expect(stepWorkouts(Number.NaN, 1)).toBe(3);
    expect(stepKm(Number.NaN, 1)).toBe(25);
  });
  it("stepSleep i formatSleep", () => {
    expect(stepSleep(300, -1)).toBe(300);
    expect(stepSleep(660, 1)).toBe(660);
    expect(stepSleep(480, 1)).toBe(495);
    expect(formatSleep(495)).toBe("8:15");
    expect(formatSleep(480)).toBe("8:00");
  });
});

describe("cel treningowy", () => {
  it("goalInRange: treningi całe 1–14, km 1–300 (także ułamki)", () => {
    expect(goalInRange("workouts", 1)).toBe(true);
    expect(goalInRange("workouts", 14)).toBe(true);
    expect(goalInRange("workouts", 0)).toBe(false);
    expect(goalInRange("workouts", 15)).toBe(false);
    expect(goalInRange("workouts", 2.5)).toBe(false);
    expect(goalInRange("workouts", Number.NaN)).toBe(false);
    expect(goalInRange("km", 42)).toBe(true);
    expect(goalInRange("km", 22.5)).toBe(true);
    expect(goalInRange("km", 300)).toBe(true);
    expect(goalInRange("km", 301)).toBe(false);
    expect(goalInRange("km", 0)).toBe(false);
  });
  it("formatWeeklyGoal: polska odmiana treningów", () => {
    expect(formatWeeklyGoal("workouts", 1)).toBe("1 trening / tydz.");
    expect(formatWeeklyGoal("workouts", 2)).toBe("2 treningi / tydz.");
    expect(formatWeeklyGoal("workouts", 3)).toBe("3 treningi / tydz.");
    expect(formatWeeklyGoal("workouts", 4)).toBe("4 treningi / tydz.");
    expect(formatWeeklyGoal("workouts", 5)).toBe("5 treningów / tydz.");
    expect(formatWeeklyGoal("workouts", 12)).toBe("12 treningów / tydz.");
    expect(formatWeeklyGoal("workouts", 14)).toBe("14 treningów / tydz.");
  });
  it("formatKm: ułamek z polskim przecinkiem", () => {
    expect(formatKm(22.5)).toBe("22,5");
    expect(formatKm(40)).toBe("40");
  });
  it("formatWeeklyGoal: kilometry", () => {
    expect(formatWeeklyGoal("km", 25)).toBe("25 km / tydz.");
    expect(formatWeeklyGoal("km", 22.5)).toBe("22,5 km / tydz.");
  });
});

describe("canContinue", () => {
  it("krok 1 wymaga nazwy", () => {
    expect(canContinue(1, { ...draft, name: "   " })).toBe(false);
    expect(canContinue(1, draft)).toBe(true);
    expect(canContinue(4, draft)).toBe(true);
  });
  it("krok 3: zła liczba włączonego celu albo brak celów blokuje „Dalej”", () => {
    expect(canContinue(3, draft)).toBe(true);
    expect(canContinue(3, { ...draft, workoutsOn: false, kmOn: false })).toBe(
      false,
    );
    expect(canContinue(3, { ...draft, kmOn: true, weeklyKm: 0 })).toBe(false);
    expect(canContinue(3, { ...draft, weeklyWorkouts: 15 })).toBe(false);
    expect(
      canContinue(3, {
        ...draft,
        workoutsOn: false,
        kmOn: true,
        weeklyKm: Number.NaN,
      }),
    ).toBe(false);
    // Wyłączonego celu nie sprawdzamy
    expect(
      canContinue(3, {
        ...draft,
        workoutsOn: false,
        kmOn: true,
        weeklyWorkouts: 15,
      }),
    ).toBe(true);
    // Pole celu jest zawsze widoczne, nawet gdy w szkicu brak „sport”
    expect(
      canContinue(3, { ...draft, goals: ["plan"], weeklyWorkouts: 15 }),
    ).toBe(false);
  });
});

describe("buildSummary", () => {
  it("wariant web", () => {
    expect(buildSummary(draft, "web", "Warszawa")).toEqual([
      { key: "Profil", value: "Mejson · Europe/Warsaw", step: 1 },
      { key: "Kategorie", value: "Studia, Sport", step: 2 },
      { key: "Cele treningowe", value: "3 treningi / tydz.", step: 3 },
      { key: "Strony", value: "Subscriptions, Projects", step: 5 },
      { key: "Przypomnienia", value: "3 włączone", step: 6 },
    ]);
  });
  it("wariant telefon", () => {
    expect(buildSummary(draft, "mobile", "Warszawa")).toEqual([
      { key: "Profil", value: "Mejson · Warszawa · tydzień od pn", step: 1 },
      { key: "Kategorie", value: "Studia, Sport", step: 2 },
      { key: "Cele treningowe", value: "3 treningi / tydz.", step: 3 },
      { key: "Strony", value: "Subscriptions, Projects", step: 5 },
      {
        key: "Przypomnienia",
        value: "3 z 4 włączone · bez zgody na push",
        step: 6,
      },
    ]);
  });
  it("telefon ze zgodą, niedziela, puste nazwa i strony", () => {
    const s = buildSummary(
      {
        ...draft,
        name: " ",
        weekStart: "sun",
        pages: [],
        notify: { ...draft.notify, perm: true },
      },
      "mobile",
      "Berlin",
    );
    expect(s[0].value).toBe("Ty · Berlin · tydzień od nd");
    expect(s[3].value).toBe("brak");
    expect(s[4].value).toBe("3 z 4 włączone");
  });
  it("wiersz „Cele treningowe”: jeden albo oba cele, z odmianą", () => {
    const wiersz = (d: OnboardingDraft) =>
      buildSummary(d, "web", "Warszawa").find(
        (w) => w.key === "Cele treningowe",
      )?.value;
    expect(
      wiersz({ ...draft, workoutsOn: false, kmOn: true, weeklyKm: 25 }),
    ).toBe("25 km / tydz.");
    expect(wiersz({ ...draft, weeklyWorkouts: 1 })).toBe("1 trening / tydz.");
    expect(wiersz({ ...draft, weeklyWorkouts: 5 })).toBe("5 treningów / tydz.");
    expect(wiersz({ ...draft, kmOn: true, weeklyKm: 22.5 })).toBe(
      "3 treningi / tydz. · 22,5 km / tydz.",
    );
  });
});

describe("stepPayload", () => {
  it("krok 1: profil w kluczach schematu", () => {
    expect(stepPayload(1, draft)).toEqual({
      display_name: "Mejson",
      timezone: "Europe/Warsaw",
      week_start: "mon",
      clock: "24",
      avatar_path: null,
    });
  });
  it("kroki 2–4", () => {
    expect(stepPayload(2, draft)).toEqual({
      roles: ["student", "sport"],
      study_field: "Cyberbezpieczeństwo",
    });
    expect(stepPayload(3, draft)).toEqual({
      goals: ["plan", "sport", "habits", "subs", "proj"],
      workouts_goal_on: true,
      km_goal_on: false,
      weekly_workouts_goal: 3,
      weekly_km_goal: 25,
      sleep_goal_min: 480,
    });
    // Zły (ukryty lub niewidoczny) cel nie psuje zapisu: wraca wartość domyślna
    expect(
      stepPayload(3, {
        ...draft,
        workoutsOn: false,
        kmOn: true,
        weeklyKm: 42,
        weeklyWorkouts: Number.NaN,
      }),
    ).toMatchObject({
      workouts_goal_on: false,
      km_goal_on: true,
      weekly_workouts_goal: 3,
      weekly_km_goal: 42,
    });
    expect(
      stepPayload(4, { ...draft, source: "other", sourceOther: "Blog" }),
    ).toEqual({
      referral_source: "other",
      referral_other: "Blog",
    });
  });
  it("krok 5: strony efektywne (polecone, gdy pages = null)", () => {
    expect(stepPayload(5, draft)).toEqual({
      pending_pages: ["Subscriptions", "Projects"],
    });
    expect(stepPayload(5, { ...draft, pages: null })).toEqual({
      pending_pages: ["Subscriptions", "Projects"],
    });
  });
  it("krok 6: przypomnienia", () => {
    expect(stepPayload(6, draft)).toEqual({
      push_enabled: false,
      before: true,
      renew: true,
      weekly: true,
      habits: false,
    });
  });
  it("wynik przechodzi przez schematy kroków", () => {
    for (const s of [1, 2, 3, 4, 5, 6] as const) {
      expect(
        onboardingStepSchemas[s].safeParse(stepPayload(s, draft)).success,
      ).toBe(true);
    }
  });
});
