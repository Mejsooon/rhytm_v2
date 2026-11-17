// Walidacja danych z formularzy kalendarza (lustro reguł z migracji calendar.sql).
import { z } from "zod";

// Id wiersza w bazie (uuid)
export const idSchema = z.string().uuid("Nieprawidłowy identyfikator.");

// Data RRRR-MM-DD, która naprawdę istnieje (odrzuca np. 2026-13-45 i 2026-02-30)
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Nieprawidłowa data.")
  .refine((d) => {
    const data = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === d;
  }, "Nieprawidłowa data.");

export const recurrenceSchema = z
  .object({
    freq: z.enum(["daily", "weekdays", "weekly", "custom"]),
    byWeekday: z.array(z.number().int().min(1).max(7)).optional(),
    until: isoDateSchema.optional(),
  })
  .refine(
    (r) => r.freq !== "custom" || (r.byWeekday !== undefined && r.byWeekday.length > 0),
    { message: "Wybierz przynajmniej jeden dzień tygodnia." },
  );

// Pola współdzielone: tytuł 1–120 po trim, notatka do 2000 znaków, czas 15–1440 min
const tytul = z
  .string()
  .trim()
  .min(1, "Podaj tytuł.")
  .max(120, "Tytuł może mieć maksymalnie 120 znaków.");
const notatka = z
  .string()
  .max(2000, "Notatka może mieć maksymalnie 2000 znaków.")
  .transform((n) => (n.trim() === "" ? null : n));
const start = z.number().int().min(0).max(1439);
const czas = z
  .number()
  .int()
  .min(15, "Blok musi trwać co najmniej 15 minut.")
  .max(1440, "Blok może trwać maksymalnie 24 godziny.");
const idKategorii = idSchema.nullable();

export const zadanieTytul = z
  .string()
  .trim()
  .min(1, "Podaj tytuł zadania.")
  .max(200, "Tytuł zadania może mieć maksymalnie 200 znaków.");

export const createBlockSchema = z
  .object({
    title: tytul,
    categoryId: idKategorii,
    date: isoDateSchema,
    startMin: start,
    durationMin: czas,
    recurrence: recurrenceSchema.nullable(),
    note: notatka,
    remind: z.boolean(),
    tasks: z.array(zadanieTytul).max(50).optional(),
  })
  .refine((b) => b.startMin + b.durationMin <= 1440, {
    message: "Blok nie może przechodzić przez północ.",
    path: ["durationMin"],
  })
  .refine((b) => b.recurrence?.until === undefined || b.recurrence.until >= b.date, {
    message: "Koniec powtarzania nie może być przed początkiem.",
    path: ["recurrence"],
  });

export const blockPatchSchema = z.object({
  title: tytul.optional(),
  categoryId: idKategorii.optional(),
  note: notatka.nullable().optional(),
  remind: z.boolean().optional(),
  date: isoDateSchema.optional(),
  startMin: start.optional(),
  durationMin: czas.optional(),
  recurrence: recurrenceSchema.nullable().optional(),
});

export const changeOccurrenceSchema = z.object({
  blockId: idSchema,
  date: isoDateSchema,
  scope: z.enum(["this", "following", "all"]),
  patch: blockPatchSchema.optional(),
  delete: z.boolean().optional(),
});
