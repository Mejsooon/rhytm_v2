import { describe, expect, it } from "vitest";
import {
  buildSummary,
  canContinue,
  categoriesForRoles,
  effectivePages,
  formatSleep,
  GOALS,
  PAGE_TEMPLATES,
  recommendedPages,
  REMINDERS,
  ROLES,
  SOURCES,
  stepKm,
  stepSleep,
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
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: ["Subscriptions", "Projects"],
  notify: { perm: false, before: true, renew: true, weekly: true, habits: false },
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
    expect(categoriesForRoles(["free"]).map((x) => x.name)).toEqual(["Projekty"]);
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
    expect(recommendedPages(["pass", "books"])).toEqual(["Passwords", "Books"]);
  });
});

describe("toggleGoal", () => {
  it("wyłączenie celu wyłącza jego stronę", () => {
    const d = toggleGoal(
      { ...draft, pages: null, goals: ["subs"] },
      "subs",
    );
    expect(d.goals).toEqual([]);
    expect(effectivePages(d)).not.toContain("Subscriptions");
  });
  it("włączenie celu dodaje stronę w kolejności szablonów", () => {
    const d = toggleGoal({ ...draft, pages: ["Websites"], goals: [] }, "books");
    expect(effectivePages(d)).toEqual(["Books", "Websites"]);
  });
  it("cel bez strony nie zmienia pages", () => {
    const d = toggleGoal(draft, "plan");
    expect(d.pages).toEqual(["Subscriptions", "Projects"]);
    expect(d.goals).not.toContain("plan");
  });
});

describe("kroki liczników", () => {
  it("stepKm", () => {
    expect(stepKm(5, -1)).toBe(5);
    expect(stepKm(150, 1)).toBe(150);
    expect(stepKm(25, 1)).toBe(30);
  });
  it("stepSleep i formatSleep", () => {
    expect(stepSleep(300, -1)).toBe(300);
    expect(stepSleep(660, 1)).toBe(660);
    expect(stepSleep(480, 1)).toBe(495);
    expect(formatSleep(495)).toBe("8:15");
    expect(formatSleep(480)).toBe("8:00");
  });
});

describe("canContinue", () => {
  it("krok 1 wymaga nazwy", () => {
    expect(canContinue(1, { ...draft, name: "   " })).toBe(false);
    expect(canContinue(1, draft)).toBe(true);
    expect(canContinue(4, draft)).toBe(true);
  });
});

describe("buildSummary", () => {
  it("wariant web", () => {
    expect(buildSummary(draft, "web", "Warszawa")).toEqual([
      { key: "Profil", value: "Mejson · Europe/Warsaw", step: 1 },
      { key: "Kategorie", value: "Studia, Sport", step: 2 },
      { key: "Strony", value: "Subscriptions, Projects", step: 5 },
      { key: "Przypomnienia", value: "3 włączone", step: 6 },
    ]);
  });
  it("wariant telefon", () => {
    expect(buildSummary(draft, "mobile", "Warszawa")).toEqual([
      { key: "Profil", value: "Mejson · Warszawa · tydzień od pn", step: 1 },
      { key: "Kategorie", value: "Studia, Sport", step: 2 },
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
    expect(s[2].value).toBe("brak");
    expect(s[3].value).toBe("3 z 4 włączone");
  });
});
