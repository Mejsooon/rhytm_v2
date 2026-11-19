// Walidacja danych stron (lustro reguł z migracji 20261120120000_pages.sql).
import { z } from "zod";
import { idSchema } from "@/features/calendar/schemas";

export { idSchema };

export const pageTitleSchema = z
  .string()
  .max(200, "Tytuł może mieć maksymalnie 200 znaków.");

// Emoji, `lucide:<nazwa>:<kolor>` albo '' (brak ikony → domyślna tabela); format sprawdza parsePageIcon przy wyświetlaniu
export const pageIconSchema = z.string().trim().max(64, "Ikona jest zbyt długa.");

export const fieldNameSchema = z
  .string()
  .trim()
  .min(1, "Podaj nazwę pola.")
  .max(60, "Nazwa pola może mieć maksymalnie 60 znaków.");

export const blockTypeSchema = z.enum(["text", "heading", "todo", "divider", "table"]);

export const fieldTypeSchema = z.enum([
  "text",
  "number",
  "checkbox",
  "url",
  "select",
  "status",
  "date",
  "rating",
]);

export const fieldConfigSchema = z.object({
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().max(60),
        color: z.string().max(16),
      }),
    )
    .max(100)
    .optional(),
  number_format: z.enum(["plain", "pln", "percent"]).optional(),
  show_in_calendar: z.boolean().optional(),
  empty_label: z.string().max(60).optional(),
  // Id opcji wstawianej do nowego wiersza (Select / Status)
  default_option: z.string().min(1).max(64).optional(),
});

// Zawartość bloku zależy od typu (tekst, zadanie, tabela z ustawieniami) — tu tylko obiekt
export const blockContentSchema = z.record(z.string(), z.unknown());

const sortKey = z.object({ field_id: z.string().min(1), dir: z.enum(["asc", "desc"]) });

const filterCond = z.object({
  field_id: z.string().min(1),
  op: z.enum([
    "checked",
    "unchecked",
    "in",
    "gte",
    "lte",
    "contains",
    "before",
    "after",
    "empty",
    "not_empty",
  ]),
  value: z.unknown().optional(),
});

const unit = z.tuple([z.string(), z.string(), z.string()]);

const columnSummary = z.object({
  kind: z.string().min(1),
  option_id: z.string().optional(),
  unit: unit.optional(),
  where: z.object({ field_id: z.string(), option_id: z.string() }).optional(),
});

const pinnedCard = z.object({
  label: z.string().max(80),
  field_id: z.string().min(1),
  aggregation: z.enum([
    "count_option",
    "count_option_of_total",
    "count_option_in_year",
    "avg",
    "nearest_date",
    "count_distinct",
  ]),
  option_id: z.string().optional(),
  date_field_id: z.string().optional(),
  title_field_id: z.string().optional(),
  done_option_id: z.string().optional(),
  unit: unit.optional(),
});

export const tableSettingsPatchSchema = z.object({
  sort: z.array(sortKey).max(10).optional(),
  filters: z.array(filterCond).max(50).optional(),
  hidden_field_ids: z.array(z.string()).max(200).optional(),
  column_summaries: z.record(z.string(), columnSummary).optional(),
  pinned_cards: z.array(pinnedCard).max(20).optional(),
});

export const rowValuesSchema = z.record(z.string(), z.unknown());
