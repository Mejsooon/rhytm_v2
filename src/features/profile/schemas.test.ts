import { describe, expect, it } from "vitest";
import {
  goalsSchema,
  onboardingStepSchemas,
  parseDecimal,
  profileSchema,
} from "./schemas";

const poprawnyProfil = {
  display_name: " Mejson ",
  timezone: "Europe/Warsaw",
  weight_kg: "72,5",
  height_cm: "",
};
const poprawneCele = {
  sleep_goal_min: "480",
  workouts_goal_on: true,
  km_goal_on: true,
  weekly_workouts_goal: "3",
  weekly_km_goal: "40",
  currency: "PLN",
  week_start: "mon",
};

function komunikaty(wynik: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return wynik.success ? [] : wynik.error!.issues.map((i) => i.message);
}

describe("parseDecimal", () => {
  it("przycina i zamienia przecinek na kropkę", () => {
    expect(parseDecimal(" 72,5 ")).toBe(72.5);
  });
  it("pusty tekst daje null", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("   ")).toBeNull();
  });
  it("nieliczba daje NaN", () => {
    expect(Number.isNaN(parseDecimal("abc"))).toBe(true);
  });
});

describe("profileSchema", () => {
  it("przyjmuje poprawny profil i normalizuje wartości", () => {
    const wynik = profileSchema.parse(poprawnyProfil);
    expect(wynik).toEqual({
      display_name: "Mejson",
      timezone: "Europe/Warsaw",
      weight_kg: 72.5,
      height_cm: null,
    });
  });
  it("odrzuca pustą nazwę", () => {
    const wynik = profileSchema.safeParse({
      ...poprawnyProfil,
      display_name: "   ",
    });
    expect(komunikaty(wynik)).toContain("Nazwa nie może być pusta.");
  });
  it("odrzuca nazwę dłuższą niż 40 znaków", () => {
    expect(
      profileSchema.safeParse({
        ...poprawnyProfil,
        display_name: "a".repeat(41),
      }).success,
    ).toBe(false);
  });
  it("odrzuca wagę poza zakresem i nieliczbę", () => {
    expect(
      komunikaty(
        profileSchema.safeParse({ ...poprawnyProfil, weight_kg: "29" }),
      ),
    ).toContain("Podaj liczbę 30–250.");
    expect(
      komunikaty(
        profileSchema.safeParse({ ...poprawnyProfil, weight_kg: "251" }),
      ),
    ).toContain("Podaj liczbę 30–250.");
    expect(
      komunikaty(
        profileSchema.safeParse({ ...poprawnyProfil, weight_kg: "abc" }),
      ),
    ).toContain("Podaj liczbę 30–250.");
  });
  it("odrzuca wzrost poza zakresem", () => {
    expect(
      komunikaty(
        profileSchema.safeParse({ ...poprawnyProfil, height_cm: "231" }),
      ),
    ).toContain("Podaj liczbę 120–230.");
    expect(
      komunikaty(
        profileSchema.safeParse({ ...poprawnyProfil, height_cm: "119" }),
      ),
    ).toContain("Podaj liczbę 120–230.");
  });
  it("odrzuca nieznaną strefę czasową", () => {
    expect(
      profileSchema.safeParse({ ...poprawnyProfil, timezone: "Mars/Base" })
        .success,
    ).toBe(false);
  });
  it("przyjmuje inną poprawną strefę", () => {
    expect(
      profileSchema.safeParse({ ...poprawnyProfil, timezone: "Asia/Tokyo" })
        .success,
    ).toBe(true);
  });
});

describe("goalsSchema", () => {
  it("przyjmuje poprawne cele ze stringów formularza", () => {
    expect(goalsSchema.parse(poprawneCele)).toEqual({
      sleep_goal_min: 480,
      workouts_goal_on: true,
      km_goal_on: true,
      weekly_workouts_goal: 3,
      weekly_km_goal: 40,
      currency: "PLN",
      week_start: "mon",
    });
  });
  it("odrzuca tygodniowy cel km poza 1–300", () => {
    expect(
      komunikaty(
        goalsSchema.safeParse({ ...poprawneCele, weekly_km_goal: "0" }),
      ),
    ).toContain("Podaj liczbę 1–300.");
    expect(
      komunikaty(
        goalsSchema.safeParse({ ...poprawneCele, weekly_km_goal: "301" }),
      ),
    ).toContain("Podaj liczbę 1–300.");
  });
  it("odrzuca treningi poza 1–14 i ułamki", () => {
    for (const zle of ["0", "15", "2,5", "", "abc"]) {
      expect(
        komunikaty(
          goalsSchema.safeParse({ ...poprawneCele, weekly_workouts_goal: zle }),
        ),
      ).toEqual(["Podaj liczbę 1–14."]);
    }
    expect(
      goalsSchema.parse({ ...poprawneCele, weekly_workouts_goal: 14 })
        .weekly_workouts_goal,
    ).toBe(14);
  });
  it("przyjmuje sam cel km z ułamkiem kilometrów", () => {
    const wynik = goalsSchema.parse({
      ...poprawneCele,
      workouts_goal_on: false,
      weekly_km_goal: "22,5",
    });
    expect(wynik).toMatchObject({
      workouts_goal_on: false,
      km_goal_on: true,
      weekly_km_goal: 22.5,
      weekly_workouts_goal: 3,
    });
  });
  it("odrzuca oba cele wyłączone", () => {
    expect(
      komunikaty(
        goalsSchema.safeParse({
          ...poprawneCele,
          workouts_goal_on: false,
          km_goal_on: false,
        }),
      ),
    ).toEqual(["Włącz co najmniej jeden cel."]);
  });
  it("odrzuca sen niebędący wielokrotnością 15 lub poza zakresem", () => {
    expect(
      goalsSchema.safeParse({ ...poprawneCele, sleep_goal_min: 310 }).success,
    ).toBe(false);
    expect(
      goalsSchema.safeParse({ ...poprawneCele, sleep_goal_min: "285" }).success,
    ).toBe(false);
    expect(
      goalsSchema.safeParse({ ...poprawneCele, sleep_goal_min: "675" }).success,
    ).toBe(false);
  });
  it("odrzuca nieznaną walutę i dzień startu tygodnia", () => {
    expect(
      goalsSchema.safeParse({ ...poprawneCele, currency: "JPY" }).success,
    ).toBe(false);
    expect(
      goalsSchema.safeParse({ ...poprawneCele, week_start: "tue" }).success,
    ).toBe(false);
  });
});

describe("onboardingStepSchemas", () => {
  it("krok 1: przycina nazwę i przyjmuje avatar null", () => {
    const wynik = onboardingStepSchemas[1].parse({
      display_name: " Ala ",
      timezone: "Europe/Berlin",
      week_start: "sun",
      clock: "12",
      avatar_path: null,
    });
    expect(wynik).toMatchObject({
      display_name: "Ala",
      clock: "12",
      avatar_path: null,
    });
  });
  it("krok 1: odrzuca złą strefę i pustą nazwę", () => {
    const baza = {
      display_name: "A",
      timezone: "Europe/Warsaw",
      week_start: "mon",
      clock: "24",
      avatar_path: null,
    };
    expect(
      onboardingStepSchemas[1].safeParse({ ...baza, timezone: "Mars/Base" })
        .success,
    ).toBe(false);
    expect(
      onboardingStepSchemas[1].safeParse({ ...baza, display_name: " " })
        .success,
    ).toBe(false);
  });
  it("krok 2: odrzuca nieznaną rolę i duplikaty", () => {
    expect(
      onboardingStepSchemas[2].safeParse({
        roles: ["student", "admin"],
        study_field: "",
      }).success,
    ).toBe(false);
    expect(
      onboardingStepSchemas[2].safeParse({
        roles: ["student", "student"],
        study_field: "",
      }).success,
    ).toBe(false);
  });
  it("krok 2: pusty kierunek daje null, a długi jest odrzucany", () => {
    expect(
      onboardingStepSchemas[2].parse({ roles: ["student"], study_field: "  " })
        .study_field,
    ).toBeNull();
    expect(
      onboardingStepSchemas[2].safeParse({
        roles: [],
        study_field: "a".repeat(81),
      }).success,
    ).toBe(false);
  });
  const krok3 = {
    workouts_goal_on: true,
    km_goal_on: true,
    weekly_workouts_goal: 3,
    weekly_km_goal: 25,
    sleep_goal_min: 480,
  };
  it("krok 3: treningi tylko całe 1–14", () => {
    expect(onboardingStepSchemas[3].safeParse(krok3).success).toBe(true);
    expect(
      onboardingStepSchemas[3].safeParse({ ...krok3, weekly_workouts_goal: 14 })
        .success,
    ).toBe(true);
    for (const zle of [0, 15, 2.5]) {
      const wynik = onboardingStepSchemas[3].safeParse({
        ...krok3,
        weekly_workouts_goal: zle,
      });
      expect(komunikaty(wynik)).toEqual(["Podaj liczbę 1–14."]);
    }
  });
  it("krok 3: kilometry 1–300, także ułamki jak w ustawieniach", () => {
    expect(
      onboardingStepSchemas[3].safeParse({ ...krok3, weekly_km_goal: 42 })
        .success,
    ).toBe(true);
    expect(
      onboardingStepSchemas[3].safeParse({ ...krok3, weekly_km_goal: 22.5 })
        .success,
    ).toBe(true);
    expect(
      onboardingStepSchemas[3].safeParse({ ...krok3, weekly_km_goal: 300 })
        .success,
    ).toBe(true);
    for (const zle of [0, 301, 0.5]) {
      const wynik = onboardingStepSchemas[3].safeParse({
        ...krok3,
        weekly_km_goal: zle,
      });
      expect(komunikaty(wynik)).toEqual(["Podaj liczbę 1–300."]);
    }
  });
  it("krok 3: odrzuca oba cele treningowe wyłączone", () => {
    expect(
      komunikaty(
        onboardingStepSchemas[3].safeParse({
          ...krok3,
          workouts_goal_on: false,
          km_goal_on: false,
        }),
      ),
    ).toEqual(["Włącz co najmniej jeden cel."]);
  });
  it("krok 3: dawne pole goals jest pomijane", () => {
    const wynik = onboardingStepSchemas[3].safeParse({
      ...krok3,
      goals: ["plan"],
    });
    expect(wynik.success).toBe(true);
    expect(wynik.data).not.toHaveProperty("goals");
  });
  it('krok 4: referral_other zostaje tylko dla "other"', () => {
    const inny = onboardingStepSchemas[4].parse({
      referral_source: "friend",
      referral_other: "x",
    });
    expect(inny.referral_other).toBeNull();
    const other = onboardingStepSchemas[4].parse({
      referral_source: "other",
      referral_other: " blog ",
    });
    expect(other.referral_other).toBe("blog");
    const brak = onboardingStepSchemas[4].parse({
      referral_source: null,
      referral_other: "",
    });
    expect(brak).toEqual({ referral_source: null, referral_other: null });
  });
  it('krok 4: odrzuca zbyt długie "inne" i nieznane źródło', () => {
    expect(
      onboardingStepSchemas[4].safeParse({
        referral_source: "other",
        referral_other: "a".repeat(81),
      }).success,
    ).toBe(false);
    expect(
      onboardingStepSchemas[4].safeParse({
        referral_source: "radio",
        referral_other: "",
      }).success,
    ).toBe(false);
  });
  it("krok 5: odrzuca Passwords i Subscriptions (tylko 3 szablony)", () => {
    for (const nazwa of ["Passwords", "Subscriptions"]) {
      expect(
        onboardingStepSchemas[5].safeParse({ pending_pages: [nazwa] }).success,
      ).toBe(false);
    }
  });
  it("krok 5: przyjmuje podzbiór stron, odrzuca nieznaną", () => {
    expect(
      onboardingStepSchemas[5].safeParse({
        pending_pages: ["Books", "Projects"],
      }).success,
    ).toBe(true);
    expect(
      onboardingStepSchemas[5].safeParse({ pending_pages: ["Nope"] }).success,
    ).toBe(false);
    expect(
      onboardingStepSchemas[5].safeParse({ pending_pages: ["Books", "Books"] })
        .success,
    ).toBe(false);
  });
  it("krok 6: wymaga wartości logicznych", () => {
    const ok = {
      push_enabled: true,
      before: true,
      renew: false,
      weekly: true,
      habits: false,
    };
    expect(onboardingStepSchemas[6].safeParse(ok).success).toBe(true);
    expect(
      onboardingStepSchemas[6].safeParse({ ...ok, before: "yes" }).success,
    ).toBe(false);
  });
});
