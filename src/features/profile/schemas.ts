import { z } from "zod";
import {
  GOALS,
  PAGE_TEMPLATES,
  ROLES,
  SOURCES,
} from "@/features/onboarding/model";
import { safeTimezone } from "@/lib/time/timezones";

// "72,5" -> 72.5, "" -> null, "abc" -> NaN
export function parseDecimal(raw: string): number | null {
  const tekst = raw.trim().replace(",", ".");
  if (tekst === "") return null;
  return Number(tekst);
}

// Klucze z modelu onboardingu, żeby nie przepisywać ich drugi raz
const roleKey = z.enum(ROLES.map((r) => r.key) as [string, ...string[]]);
const goalKey = z.enum(GOALS.map((g) => g.key) as [string, ...string[]]);
const pageKey = z.enum(
  PAGE_TEMPLATES.map((p) => p.key) as [string, ...string[]],
);
const sourceKey = z.enum(SOURCES.map((s) => s.key) as [string, ...string[]]);

const bezDuplikatow = (lista: string[]) => new Set(lista).size === lista.length;

const displayName = z
  .string()
  .trim()
  .min(1, "Nazwa nie może być pusta.")
  .max(40, "Nazwa może mieć maksymalnie 40 znaków.");

// Strefa musi być prawdziwą strefą IANA (safeTimezone oddaje ją bez zmian tylko wtedy)
const timezone = z
  .string()
  .refine((tz) => safeTimezone(tz) === tz, "Nieznana strefa czasowa.");

const weekStart = z.enum(["mon", "sun"]);
const sleepGoal = z
  .number()
  .int()
  .min(300)
  .max(660)
  .refine((m) => m % 15 === 0, "Cel snu musi być wielokrotnością 15 minut.");

// Liczba z formularza (tekst z przecinkiem lub liczba); pusty tekst -> null albo błąd
function formNumber(
  min: number,
  max: number,
  message: string,
  optional: boolean,
) {
  return z.union([z.string(), z.number()]).transform((raw, ctx) => {
    const wartosc = typeof raw === "number" ? raw : parseDecimal(raw);
    if (wartosc === null && optional) return null;
    if (
      wartosc === null ||
      !Number.isFinite(wartosc) ||
      wartosc < min ||
      wartosc > max
    ) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return wartosc;
  });
}

// Rodzaj tygodniowego celu treningowego: liczba treningów albo kilometrów

// Treningi w tygodniu: tylko liczby całkowite 1–14
const weeklyWorkouts = formNumber(1, 14, "Podaj liczbę 1–14.", false).refine(
  (n) => Number.isInteger(n),
  "Podaj liczbę 1–14.",
);

export const profileSchema = z.object({
  display_name: displayName,
  timezone,
  weight_kg: formNumber(30, 250, "Podaj liczbę 30–250.", true),
  height_cm: formNumber(120, 230, "Podaj liczbę 120–230.", true),
});

export const goalsSchema = z
  .object({
    sleep_goal_min: z.coerce.number().pipe(sleepGoal),
    // Dwa cele treningowe: przełączniki i obie liczby (wyłączony cel zachowuje liczbę)
    workouts_goal_on: z.boolean(),
    km_goal_on: z.boolean(),
    weekly_workouts_goal: weeklyWorkouts,
    weekly_km_goal: formNumber(1, 300, "Podaj liczbę 1–300.", false),
    currency: z.enum(["PLN", "EUR", "USD", "GBP"]),
    week_start: weekStart,
  })
  .refine((v) => v.workouts_goal_on || v.km_goal_on, {
    message: "Włącz co najmniej jeden cel.",
    path: ["training_goals"],
  });

// Krótki tekst opcjonalny: przycięty, ≤ 80 znaków, pusty -> null
const krotkiTekst = z
  .string()
  .trim()
  .max(80, "Maksymalnie 80 znaków.")
  .transform((t) => (t === "" ? null : t));

// Kroki onboardingu dostają JSON z klienta (tablice, booleany, liczby).
// Prefiks avatar_path względem userId sprawdza akcja serwerowa.
export const onboardingStepSchemas = {
  1: z.object({
    display_name: displayName,
    timezone,
    week_start: weekStart,
    clock: z.enum(["24", "12"]),
    avatar_path: z.string().nullable(),
  }),
  2: z.object({
    roles: z
      .array(roleKey)
      .refine(bezDuplikatow, "Role nie mogą się powtarzać."),
    study_field: krotkiTekst,
  }),
  3: z
    .object({
      goals: z
        .array(goalKey)
        .refine(bezDuplikatow, "Cele nie mogą się powtarzać."),
      workouts_goal_on: z.boolean(),
      km_goal_on: z.boolean(),
      weekly_workouts_goal: z
        .number()
        .int("Podaj liczbę 1–14.")
        .min(1, "Podaj liczbę 1–14.")
        .max(14, "Podaj liczbę 1–14."),
      // Licznik na telefonie idzie co 5 (5–150), ale pole na webie przyjmuje każdą liczbę 1–300 (też ułamki, jak w ustawieniach)
      weekly_km_goal: z
        .number()
        .min(1, "Podaj liczbę 1–300.")
        .max(300, "Podaj liczbę 1–300."),
      sleep_goal_min: sleepGoal,
    })
    .refine((v) => v.workouts_goal_on || v.km_goal_on, {
      message: "Włącz co najmniej jeden cel.",
      path: ["training_goals"],
    }),
  4: z
    .object({
      referral_source: sourceKey.nullable(),
      referral_other: krotkiTekst,
    })
    // "Inne" ma sens tylko przy źródle "other"
    .transform((v) => ({
      ...v,
      referral_other: v.referral_source === "other" ? v.referral_other : null,
    })),
  5: z.object({
    pending_pages: z
      .array(pageKey)
      .refine(bezDuplikatow, "Strony nie mogą się powtarzać."),
  }),
  6: z.object({
    push_enabled: z.boolean(),
    before: z.boolean(),
    renew: z.boolean(),
    weekly: z.boolean(),
    habits: z.boolean(),
  }),
};

export type ProfileInput = z.infer<typeof profileSchema>;
export type GoalsInput = z.infer<typeof goalsSchema>;
