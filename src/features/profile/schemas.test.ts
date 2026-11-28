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
  it("krok 2: odrzuca nieznany wybór i duplikaty", () => {
    const baza = { weekly_km_goal: 25, weekly_workouts_goal: 3, sleep_goal_min: 480 };
    expect(onboardingStepSchemas[2].safeParse({ ...baza, uses: ["run"] }).success).toBe(true);
    for (const uses of [["admin"], ["run", "run"]]) {
      expect(onboardingStepSchemas[2].safeParse({ ...baza, uses }).success).toBe(false);
    }
    expect(onboardingStepSchemas[2].safeParse({ ...baza, uses: [], weekly_km_goal: 301 }).success).toBe(false);
  });
  it("krok 3: koniec po początku, najwyżej 12 bloków", () => {
    const blok = { title: "A", category: "Dom", start_min: 600, end_min: 660 };
    expect(onboardingStepSchemas[3].safeParse({ blocks: [blok] }).success).toBe(true);
    expect(onboardingStepSchemas[3].safeParse({ blocks: [{ ...blok, end_min: 600 }] }).success).toBe(false);
    expect(onboardingStepSchemas[3].safeParse({ blocks: Array(13).fill(blok) }).success).toBe(false);
  });
});
