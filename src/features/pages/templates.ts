// Szablony stron-tabel (NewPage) i dane wstawiane do RPC create_page.
// Pola, opcje i kolory pochodzą z makiet Books / Projects / Websites.
import { PALETA } from "./fields";
import type { FieldConfig, FieldType } from "./fields";
import type { ColumnSummary, PinnedCard, SortKey, TableSettings } from "./table-model";

export const TEMPLATE_KEYS = ["empty", "books", "projects", "websites"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

// Dokładnie kształt jsonb, który przyjmuje create_page(p_title, p_icon, p_template_key, p_blocks)
export type CreatePageBlock = {
  id: string;
  type: "text" | "heading" | "todo" | "divider" | "table";
  content: Record<string, unknown>;
  fields: { id: string; name: string; type: FieldType; config: FieldConfig; is_title: boolean }[];
  rows: { values: Record<string, unknown> }[];
};

// Opcja szablonu ma stały klucz; prawdziwe id nadaje buildTemplateBlocks
type TemplateOption = { key: string; label: string; color: string };

export type TemplateField = {
  key: string;
  name: string;
  type: FieldType;
  is_title?: boolean;
  // default_option to klucz opcji szablonu; buildTemplateBlocks zamienia go na id opcji
  config?: Omit<FieldConfig, "options"> & { options?: TemplateOption[] };
};

// Karta w szablonie wskazuje pola i opcje po kluczach
export type TemplateCard = {
  label: string;
  field: string;
  aggregation: PinnedCard["aggregation"];
  option?: string;
  date_field?: string;
  title_field?: string;
  done_option?: string;
  unit?: [string, string, string];
};

export type TemplateConfig = {
  name: string;
  icon: string;
  desc: string;
  extra: string;
  fields: TemplateField[];
  cards: TemplateCard[];
  sort: { field: string; dir: "asc" | "desc" }[];
  // Stopki kolumn po kluczu pola; option wskazuje klucz opcji tego pola
  summaries: Record<string, { kind: ColumnSummary["kind"]; option?: string; unit?: [string, string, string]; where?: { field: string; option: string } }>;
};

// Kolory plakietek z makiet na paletę 8 kolorów kategorii; neutralny szary zostaje #525252
const NIEBIESKI = PALETA[0];
const ZIELONY = PALETA[1];
const POMARANCZ = PALETA[3];
const SZARY = PALETA[7];

export const TEMPLATES: Record<TemplateKey, TemplateConfig> = {
  empty: {
    name: "Pusta strona",
    icon: "□",
    desc: "Tabela bez pól. Budujesz ją sama od zera.",
    extra: "",
    fields: [
      { key: "name", name: "Nazwa", type: "text", is_title: true, config: { empty_label: "Bez tytułu" } },
    ],
    cards: [],
    sort: [],
    summaries: {},
  },
  books: {
    name: "Books",
    icon: "▦",
    desc: "Status czytania, ocena, licznik przeczytanych.",
    extra: "Σ Liczba przeczytanych w tym roku.",
    fields: [
      { key: "title", name: "Tytuł", type: "text", is_title: true, config: { empty_label: "Bez tytułu" } },
      { key: "author", name: "Autor", type: "text" },
      {
        key: "status",
        name: "Status",
        type: "status",
        config: {
          options: [
            { key: "reading", label: "Czytam", color: NIEBIESKI },
            { key: "read", label: "Przeczytane", color: ZIELONY },
            { key: "want", label: "Chcę przeczytać", color: SZARY },
          ],
          default_option: "want",
        },
      },
      { key: "rating", name: "Ocena", type: "rating" },
      { key: "date", name: "Przeczytana", type: "date" },
    ],
    cards: [
      {
        label: "Przeczytane w {year}",
        field: "status",
        aggregation: "count_option_in_year",
        option: "read",
        date_field: "date",
        unit: ["książka", "książki", "książek"],
      },
      { label: "Czytam teraz", field: "status", aggregation: "count_option", option: "reading" },
      { label: "Średnia ocena", field: "rating", aggregation: "avg" },
    ],
    sort: [
      { field: "status", dir: "asc" },
      { field: "date", dir: "desc" },
    ],
    summaries: {
      status: { kind: "count_option", option: "read", unit: ["przeczytana", "przeczytane", "przeczytanych"] },
      rating: { kind: "avg" },
      date: {
        kind: "count_in_year",
        unit: ["w tym roku", "w tym roku", "w tym roku"],
        where: { field: "status", option: "read" },
      },
    },
  },
  projects: {
    name: "Projects",
    icon: "▦",
    desc: "Status i termin, terminy w kalendarzu.",
    extra: "↻ Terminy trafią do kalendarza głównego.",
    fields: [
      { key: "name", name: "Nazwa", type: "text", is_title: true, config: { empty_label: "Bez nazwy" } },
      {
        key: "status",
        name: "Status",
        type: "status",
        config: {
          options: [
            { key: "wip", label: "W toku", color: NIEBIESKI },
            { key: "todo", label: "Do zrobienia", color: SZARY },
            { key: "paused", label: "Wstrzymane", color: POMARANCZ },
            { key: "done", label: "Zrobione", color: ZIELONY },
          ],
          default_option: "todo",
        },
      },
      {
        key: "area",
        name: "Obszar",
        type: "select",
        config: {
          options: [
            { key: "study", label: "Studia", color: SZARY },
            { key: "own", label: "Własne", color: SZARY },
            { key: "client", label: "Klient", color: SZARY },
            { key: "job", label: "Praca", color: SZARY },
          ],
          default_option: "own",
        },
      },
      { key: "due", name: "Termin", type: "date", config: { show_in_calendar: true } },
      { key: "repo", name: "Repo", type: "url" },
    ],
    cards: [
      { label: "W toku", field: "status", aggregation: "count_option", option: "wip" },
      {
        label: "Najbliższy termin",
        field: "status",
        aggregation: "nearest_date",
        date_field: "due",
        title_field: "name",
        done_option: "done",
      },
      { label: "Zrobione", field: "status", aggregation: "count_option_of_total", option: "done" },
    ],
    sort: [{ field: "due", dir: "asc" }],
    summaries: {
      status: { kind: "count_option", option: "wip", unit: ["w toku", "w toku", "w toku"] },
      due: { kind: "filled", unit: ["termin", "terminy", "terminów"] },
      repo: { kind: "filled", unit: ["link", "linki", "linków"] },
    },
  },
  websites: {
    name: "Websites",
    icon: "▦",
    desc: "Strony klientów: URL, klient, status.",
    extra: "",
    fields: [
      { key: "name", name: "Nazwa", type: "text", is_title: true, config: { empty_label: "Bez nazwy" } },
      { key: "url", name: "URL", type: "url" },
      { key: "client", name: "Klient", type: "text" },
      {
        key: "status",
        name: "Status",
        type: "status",
        config: {
          options: [
            { key: "live", label: "Na żywo", color: ZIELONY },
            { key: "building", label: "W budowie", color: NIEBIESKI },
            { key: "quote", label: "Wycena", color: SZARY },
            { key: "paused", label: "Wstrzymana", color: POMARANCZ },
          ],
          default_option: "quote",
        },
      },
      {
        key: "host",
        name: "Hosting",
        type: "select",
        config: {
          options: [
            { key: "framer", label: "Framer", color: SZARY },
            { key: "next", label: "Next.js", color: SZARY },
            { key: "vercel", label: "Vercel", color: SZARY },
            { key: "netlify", label: "Netlify", color: SZARY },
            { key: "wordpress", label: "WordPress", color: SZARY },
            { key: "other", label: "Inny", color: SZARY },
          ],
          default_option: "framer",
        },
      },
    ],
    cards: [
      { label: "Na żywo", field: "status", aggregation: "count_option", option: "live" },
      { label: "W budowie", field: "status", aggregation: "count_option", option: "building" },
      { label: "Klienci", field: "client", aggregation: "count_distinct" },
    ],
    sort: [],
    summaries: {
      url: { kind: "filled", unit: ["link", "linki", "linków"] },
      status: { kind: "count_option", option: "live", unit: ["na żywo", "na żywo", "na żywo"] },
    },
  },
};

// Nazwy z profiles.pending_pages (onboarding) -> szablon
export const PENDING_TO_TEMPLATE: Record<string, TemplateKey> = {
  Books: "books",
  Projects: "projects",
  Websites: "websites",
};

// Blok tabeli z szablonu: pola z nowymi id, a ustawienia (sort, karty, podsumowania) wskazują te id
export function buildTemplateBlocks(key: TemplateKey, newId: () => string): CreatePageBlock[] {
  const tpl = TEMPLATES[key];

  const idPola: Record<string, string> = {};
  const idOpcji: Record<string, string> = {};
  const fields: CreatePageBlock["fields"] = tpl.fields.map((f) => {
    idPola[f.key] = newId();
    const { options, default_option, ...reszta } = f.config ?? {};
    const config: FieldConfig = { ...reszta };
    if (options) {
      config.options = options.map((o) => {
        const id = newId();
        idOpcji[`${f.key}.${o.key}`] = id;
        return { id, label: o.label, color: o.color };
      });
    }
    if (default_option !== undefined) config.default_option = idOpcji[`${f.key}.${default_option}`];
    return { id: idPola[f.key], name: f.name, type: f.type, config, is_title: f.is_title === true };
  });

  const sort: SortKey[] = tpl.sort.map((s) => ({ field_id: idPola[s.field], dir: s.dir }));
  const column_summaries: Record<string, ColumnSummary> = {};
  for (const [k, sm] of Object.entries(tpl.summaries)) {
    const wpis: ColumnSummary = { kind: sm.kind };
    if (sm.option) wpis.option_id = idOpcji[`${k}.${sm.option}`];
    if (sm.unit) wpis.unit = sm.unit;
    if (sm.where) {
      wpis.where = { field_id: idPola[sm.where.field], option_id: idOpcji[`${sm.where.field}.${sm.where.option}`] };
    }
    column_summaries[idPola[k]] = wpis;
  }
  const pinned_cards: PinnedCard[] = tpl.cards.map((c) => {
    const card: PinnedCard = { label: c.label, field_id: idPola[c.field], aggregation: c.aggregation };
    if (c.option) card.option_id = idOpcji[`${c.field}.${c.option}`];
    if (c.date_field) card.date_field_id = idPola[c.date_field];
    if (c.title_field) card.title_field_id = idPola[c.title_field];
    if (c.done_option) card.done_option_id = idOpcji[`${c.field}.${c.done_option}`];
    if (c.unit) card.unit = c.unit;
    return card;
  });
  const settings: TableSettings = {
    sort,
    filters: [],
    hidden_field_ids: [],
    column_summaries,
    pinned_cards,
  };

  return [
    {
      id: newId(),
      type: "table",
      // Pusta strona: tabela bez nazwy (w edytorze placeholder „Tabela bez nazwy”)
      content: { name: key === "empty" ? "" : tpl.name, settings },
      fields,
      rows: [],
    },
  ];
}

// Nowa tabela z menu „/” (spec 6.8): Nazwa, Status (Wybór), Data i dwa puste wiersze
export function NEW_TABLE_BLOCK(newId: () => string): CreatePageBlock {
  const settings: TableSettings = {
    sort: [],
    filters: [],
    hidden_field_ids: [],
    column_summaries: {},
    pinned_cards: [],
  };
  return {
    id: newId(),
    type: "table",
    content: { name: "", settings },
    fields: [
      { id: newId(), name: "Nazwa", type: "text", config: { empty_label: "Bez tytułu" }, is_title: true },
      {
        id: newId(),
        name: "Status",
        type: "status",
        config: {
          options: [
            { id: newId(), label: "Do zrobienia", color: SZARY },
            { id: newId(), label: "W toku", color: NIEBIESKI },
            { id: newId(), label: "Zrobione", color: ZIELONY },
          ],
        },
        is_title: false,
      },
      { id: newId(), name: "Data", type: "date", config: {}, is_title: false },
    ],
    rows: [{ values: {} }, { values: {} }],
  };
}
