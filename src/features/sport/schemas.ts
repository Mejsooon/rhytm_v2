// Walidacja danych sportu (lustro reguł z migracji 20261119120000_sport.sql).
import { z } from "zod";
import { idSchema, isoDateSchema } from "@/features/calendar/schemas";

export { idSchema, isoDateSchema };

const godzina = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Podaj godzinę w formacie GG:MM.");

const notatka = z
  .string()
  .max(1000, "Notatka może mieć maksymalnie 1000 znaków.")
  .transform((n) => (n.trim() === "" ? null : n));

const trudnosc = z
  .number()
  .int("Trudność to liczba od 1 do 10.")
  .min(1, "Trudność to liczba od 1 do 10.")
  .max(10, "Trudność to liczba od 1 do 10.");

// Bieg: z czasem jest wykonany (wymaga dystansu > 0 i ≤ 300 oraz czasu > 0 i ≤ 24 h),
// bez czasu to plan (dystans opcjonalny, ale jeśli jest, to w tych samych granicach)
export const runInputSchema = z
  .object({
    id: idSchema.optional(),
    kind: z.enum(["easy", "tempo", "intervals", "long", "race"], {
      error: "Wybierz rodzaj biegu.",
    }),
    date: isoDateSchema,
    start: godzina,
    distanceKm: z.number().nullable(),
    durationS: z.number().int("Czas to pełne sekundy.").nullable(),
    difficulty: trudnosc.nullable(),
    note: notatka,
    showInCalendar: z.boolean(),
  })
  .superRefine((b, ctx) => {
    if (b.durationS !== null && (b.durationS <= 0 || b.durationS > 86400)) {
      ctx.addIssue({
        code: "custom",
        message: "Czas musi być dłuższy od 0 i krótszy niż 24 h.",
        path: ["durationS"],
      });
    }
    if (b.durationS !== null && b.distanceKm === null) {
      ctx.addIssue({
        code: "custom",
        message: "Podaj dystans.",
        path: ["distanceKm"],
      });
    }
    if (b.distanceKm !== null && (b.distanceKm <= 0 || b.distanceKm > 300)) {
      ctx.addIssue({
        code: "custom",
        message: "Dystans musi być większy od 0 i nie większy niż 300 km.",
        path: ["distanceKm"],
      });
    }
  });

export const gymSessionInputSchema = z.object({
  date: isoDateSchema,
  start: godzina,
  templateId: idSchema.optional(),
});

export const exerciseNameSchema = z
  .string()
  .trim()
  .min(1, "Podaj nazwę ćwiczenia.")
  .max(60, "Nazwa może mieć maksymalnie 60 znaków.");

export const setPatchSchema = z.object({
  weight_kg: z
    .number()
    .min(0, "Ciężar od 0 do 1000 kg.")
    .max(1000, "Ciężar od 0 do 1000 kg.")
    .nullable()
    .optional(),
  reps: z
    .number()
    .int("Powtórzenia to liczba całkowita.")
    .min(0, "Powtórzenia od 0 do 999.")
    .max(999, "Powtórzenia od 0 do 999.")
    .nullable()
    .optional(),
  done: z.boolean().optional(),
  set_type: z.enum(["N", "W", "D", "F"]).optional(),
  duration_s: z.number().int().min(1, "Czas od 1 s do 24 h.").max(86400, "Czas od 1 s do 24 h.").nullable().optional(),
  distance_km: z.number().positive("Dystans od 0 do 300 km.").max(300, "Dystans od 0 do 300 km.").nullable().optional(),
});

export const difficultySchema = trudnosc;

export const templateInputSchema = z.object({
  id: idSchema.optional(),
  name: z
    .string()
    .trim()
    .min(1, "Podaj nazwę.")
    .max(60, "Nazwa może mieć maksymalnie 60 znaków."),
  weekdays: z
    .array(
      z
        .number()
        .int()
        .min(1, "Nieprawidłowy dzień tygodnia.")
        .max(7, "Nieprawidłowy dzień tygodnia."),
    )
    .transform((d) => [...new Set(d)].sort((a, b) => a - b)),
  startTime: godzina,
  items: z
    .array(
      z.object({
        exerciseName: exerciseNameSchema,
        setsCount: z
          .number()
          .int()
          .min(1, "Serie od 1 do 10.")
          .max(10, "Serie od 1 do 10."),
        repsText: z
          .string()
          .trim()
          .max(20, "Powtórzenia mogą mieć maksymalnie 20 znaków."),
        restS: z
          .number()
          .int()
          .min(0, "Przerwa od 0 do 30 minut.")
          .max(1800, "Przerwa od 0 do 30 minut."),
      }),
    )
    .min(1, "Dodaj przynajmniej jedno ćwiczenie."),
});

export const templateNameSchema = templateInputSchema.shape.name;

// Własne i edytowane ćwiczenie z dziennika
export const exerciseInputSchema = z.object({
  id: idSchema.optional(),
  name: exerciseNameSchema,
  kind: z.enum(["wr", "bw", "wbw", "dur", "dist"]),
  group: z.string().max(30),
  equipment: z.string().max(30),
});

// Notatka i przerwa ćwiczenia
export const exerciseMetaSchema = z.object({
  note: z.string().max(500, "Notatka może mieć maksymalnie 500 znaków.").optional(),
  rest_s: z.number().int().min(0).max(1800).optional(),
});

export const finishSchema = z.object({
  difficulty: trudnosc.nullable().optional(),
  note: notatka.optional(),
});
