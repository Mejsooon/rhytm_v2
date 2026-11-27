// Walidacja danych nawyków i snu (lustro reguł z migracji habits_sleep.sql).
import { z } from "zod";
import { idSchema, isoDateSchema } from "@/features/calendar/schemas";

export { idSchema, isoDateSchema };

// Jedyne dozwolone tagi snu
export const SLEEP_TAGS = [
  "Kawa po 16",
  "Ekran w łóżku",
  "Trening",
  "Alkohol",
  "Stres",
] as const;

const godzina = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Podaj godzinę w formacie GG:MM.");

export const habitInputSchema = z.object({
  // Cel ilościowy; brak = „Zrobione / nie”
  goal: z
    .object({
      qty: z
        .number({ error: "Podaj ilość." })
        .positive("Ilość musi być większa od 0.")
        .max(100000, "Za duża ilość."),
      unit: z
        .string()
        .trim()
        .min(1, "Podaj jednostkę.")
        .max(12, "Jednostka może mieć maksymalnie 12 znaków."),
    })
    .nullish(),
  name: z
    .string()
    .trim()
    .min(1, "Podaj nazwę nawyku.")
    .max(80, "Nazwa może mieć maksymalnie 80 znaków."),
  schedule: z
    .object({
      type: z.enum(["daily", "weekdays", "times_per_week"]),
      weekdays: z.array(
        z
          .number()
          .int()
          .min(1, "Nieprawidłowy dzień tygodnia.")
          .max(7, "Nieprawidłowy dzień tygodnia."),
      ),
      timesPerWeek: z.number().int().nullable(),
    })
    .superRefine((s, ctx) => {
      if (s.type === "weekdays" && s.weekdays.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Wybierz przynajmniej jeden dzień.",
          path: ["weekdays"],
        });
      }
      if (
        s.type === "times_per_week" &&
        (s.timesPerWeek === null || s.timesPerWeek < 1 || s.timesPerWeek > 7)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Podaj od 1 do 7 razy w tygodniu.",
          path: ["timesPerWeek"],
        });
      }
    })
    // Normalizacja do postaci zgodnej z checkami w bazie: dni tylko przy weekdays, X tylko przy times_per_week,
    // a komplet 7 dni to po prostu daily
    .transform((s) => {
      if (s.type === "weekdays") {
        const dni = [...new Set(s.weekdays)].sort((a, b) => a - b);
        if (dni.length === 7)
          return {
            type: "daily" as const,
            weekdays: [] as number[],
            timesPerWeek: null,
          };
        return { type: "weekdays" as const, weekdays: dni, timesPerWeek: null };
      }
      if (s.type === "times_per_week") {
        return {
          type: "times_per_week" as const,
          weekdays: [] as number[],
          timesPerWeek: s.timesPerWeek,
        };
      }
      return {
        type: "daily" as const,
        weekdays: [] as number[],
        timesPerWeek: null,
      };
    }),
  remindAt: godzina.nullable(),
  showOnToday: z.boolean(),
});

export const sleepInputSchema = z
  .object({
    date: isoDateSchema,
    sleptAt: godzina,
    wokeAt: godzina,
    feeling: z
      .union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
      ])
      .nullable(),
    tags: z
      .array(z.enum(SLEEP_TAGS, { error: "Nieznany tag." }))
      .transform((t) => [...new Set(t)]),
    note: z
      .string()
      .max(1000, "Notatka może mieć maksymalnie 1000 znaków.")
      .nullable()
      .transform((n) => (n === null || n.trim() === "" ? null : n)),
  })
  .refine((s) => s.sleptAt !== s.wokeAt, {
    message: "Godziny zaśnięcia i pobudki muszą się różnić.",
    path: ["wokeAt"],
  });

export const noteTextSchema = z
  .string()
  .trim()
  .min(1, "Wpisz treść notatki.")
  .max(500, "Notatka może mieć maksymalnie 500 znaków.");

export const checkInputSchema = z.object({
  habitId: idSchema,
  date: isoDateSchema,
  done: z.boolean(),
});
