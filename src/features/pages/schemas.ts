// Walidacja danych stron (lustro reguł z migracji 20261120120000_pages.sql).
import { z } from "zod";
import { idSchema } from "@/features/calendar/schemas";
import { IMPORT_ZA_DUZO, ZA_DUZO_WIERSZY } from "./messages";

export { idSchema };

export const pageTitleSchema = z
  .string()
  .max(200, "Tytuł może mieć maksymalnie 200 znaków.");

// '' (brak ikony → domyślna tabela) albo `lucide:<nazwa>`; regex jak w constraincie `pages_icon_format`
export const pageIconSchema = z
  .string()
  .trim()
  .max(64, "Ikona jest zbyt długa.")
  .regex(/^(lucide:[a-z0-9]+(-[a-z0-9]+)*)?$/, "Ikona ma nieprawidłowy format.");

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
  "secret",
  "recurring",
  "renewal",
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
  // Kwota cykliczna / Data odnowienia (Subscriptions)
  default_cycle: z.enum(["month", "year"]).optional(),
  cycle: z.enum(["month", "year"]).optional(),
  cycle_field_id: z.string().min(1).max(64).optional(),
  active_field_id: z.string().min(1).max(64).optional(),
  // Checkbox: nowy wiersz zaznaczony
  default_checked: z.boolean().optional(),
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
    "within_days",
    "this_year",
    "not_in",
    "not_equals",
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
    "sum_month",
    "sum_year",
    "next_renewal",
  ]),
  option_id: z.string().optional(),
  date_field_id: z.string().optional(),
  title_field_id: z.string().optional(),
  done_option_id: z.string().optional(),
  unit: unit.optional(),
  width: z.number().int().min(180).max(4000).optional(),
});

const tableView = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  filters: z.array(filterCond).max(50),
  sort: z.array(sortKey).max(10),
  group_by: z.string().min(1).max(64).nullable(),
  layout: z.enum(["table", "board"]),
  hidden_field_ids: z.array(z.string()).max(200),
});

export const tableSettingsPatchSchema = z.object({
  sort: z.array(sortKey).max(10).optional(),
  filters: z.array(filterCond).max(50).optional(),
  hidden_field_ids: z.array(z.string()).max(200).optional(),
  column_summaries: z.record(z.string(), columnSummary).optional(),
  pinned_cards: z.array(pinnedCard).max(20).optional(),
  column_widths: z.record(z.string(), z.number().int().min(80).max(4000)).optional(),
  views: z.array(tableView).max(20).optional(),
  active_view_id: z.string().min(1).max(64).nullable().optional(),
  group_by: z.string().min(1).max(64).nullable().optional(),
  layout: z.enum(["table", "board"]).optional(),
  collapsed_groups: z.record(z.string(), z.array(z.string().max(64)).max(200)).optional(),
});

export const rowValuesSchema = z.record(z.string(), z.unknown());

// Akcje na wielu wierszach: od 1 do 500 id
export const rowIdsSchema = z.array(idSchema).min(1, ZA_DUZO_WIERSZY).max(500, ZA_DUZO_WIERSZY);

// Import CSV: do 5000 wierszy, nowe pola bez typu Sekret, nowe opcje wyboru (klucz = id pola albo „new:<indeks>”)
export const importRowsSchema = z.array(rowValuesSchema).max(5000, IMPORT_ZA_DUZO);
export const importNewFieldsSchema = z
  .array(z.object({ name: fieldNameSchema, type: fieldTypeSchema.exclude(["secret"]) }))
  .max(100);
// Kolor opcji: pusty („Bez koloru”) albo hex jak w PALETA; id jak w istniejących opcjach (niepusty tekst do 64 znaków)
export const importOptionsSchema = z.record(
  z.string().max(64),
  z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().max(60),
        color: z.string().max(16).regex(/^(#[0-9a-fA-F]{3,8})?$/, "Kolor ma nieprawidłowy format."),
      }),
    )
    .max(100),
);
