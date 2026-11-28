// Szablony stron-tabel (NewPage) i dane wstawiane do RPC create_page.
// Pola, opcje i kolory pochodzą z makiet Books / Projects / Websites.
import { PALETA } from "./fields";
import type { FieldConfig, FieldType, PageField } from "./fields";
import type { ColumnSummary, FilterCond, PinnedCard, SortKey, StoredTableSettings, TableView } from "./table-model";

export const TEMPLATE_KEYS = ["empty", "books", "projects", "websites", "subscriptions"] as const;
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
  // default_option to klucz opcji szablonu, a cycle_field_id i active_field_id to klucze pól szablonu;
  // buildTemplateBlocks zamienia je na prawdziwe id
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

// Widok szablonu: filtry po kluczach pól; option to klucze opcji (op in / not_in), value to liczba dni albo tekst.
// W nazwie {year} zamienia się na bieżący rok
export type TemplateView = {
  name: string;
  filters: { field: string; op: FilterCond["op"]; value?: unknown; option?: string[] }[];
};

export type TemplateConfig = {
  name: string;
  icon: string;
  // Opis pod tytułem strony (S2Table)
  desc: string;
  // Krótki podpis karty szablonu w oknie „Nowa strona” (S2NewPage)
  hint: string;
  // Tekst przycisku „Nowy …” i odmiana rzeczownika do licznika wierszy (1 / 2–4 / 5+)
  newLabel: string;
  noun: [string, string, string];
  // Gotowe widoki (zakładki) i grupowanie „Wszystkich”: pole grupy, pole tablicy, zwinięte grupy (klucze opcji)
  views: TemplateView[];
  group: string | null;
  board: string | null;
  collapsed: string[];
  // „Dodatkowo” w oknie „Nowa strona” (S2NewPage): linie oddzielone \n; pusty tekst = bez sekcji
  extra: string;
  fields: TemplateField[];
  cards: TemplateCard[];
  sort: { field: string; dir: "asc" | "desc" }[];
  // Opis pod tabelą po liczbie wierszy (S2Table, `foot`): licznik opcji z odmianą albo suma miesięczna Kwoty
  footer: { field: string; kind: "count_option" | "sum_month"; option?: string; unit?: [string, string, string] } | null;
  // Podsumowanie w nagłówku grupy (S2Table, `gsum`): średnia ocena z etykietą, suma miesięczna albo najbliższy
  // termin (skip: klucz opcji pola grupy, której grupa nie ma podsumowania, np. „Zrobione”)
  groupSummary: { field: string; kind: "avg" | "sum_month" | "nearest"; label?: string; skip?: string } | null;
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
    // Ikona karty w oknie „Nowa strona”; sama pusta strona powstaje bez ikony (S2EmptyPage: „Dodaj ikonę”)
    icon: "lucide:file-text",
    desc: "Zacznij od zera",
    hint: "Zacznij od zera",
    newLabel: "Nowy wiersz",
    noun: ["wiersz", "wiersze", "wierszy"],
    views: [],
    group: null,
    board: null,
    collapsed: [],
    extra: "",
    fields: [
      { key: "name", name: "Nazwa", type: "text", is_title: true, config: { empty_label: "Bez tytułu" } },
    ],
    cards: [],
    sort: [],
    footer: null,
    groupSummary: null,
    summaries: {},
  },
  books: {
    name: "Książki",
    icon: "lucide:book-open",
    desc: "Twoje książki: czytane, przeczytane i na później.",
    hint: "Twoje książki",
    newLabel: "Nowa książka",
    noun: ["książka", "książki", "książek"],
    views: [
      { name: "Czytam", filters: [{ field: "status", op: "in", option: ["reading"] }] },
      { name: "Do przeczytania", filters: [{ field: "status", op: "in", option: ["want"] }] },
      {
        name: "Przeczytane w {year}",
        filters: [
          { field: "status", op: "in", option: ["read"] },
          { field: "date", op: "this_year" },
        ],
      },
    ],
    group: "status",
    board: "status",
    collapsed: [],
    extra: "Średnia ocena w stopce tabeli.",
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
    footer: { field: "status", kind: "count_option", option: "reading", unit: ["w trakcie", "w trakcie", "w trakcie"] },
    groupSummary: { field: "rating", kind: "avg", label: "śr. ocena" },
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
    name: "Projekty",
    icon: "lucide:rocket",
    desc: "Projekty na studia, własne i dla klientów.",
    hint: "Twoje projekty",
    newLabel: "Nowy projekt",
    noun: ["projekt", "projekty", "projektów"],
    views: [
      { name: "W toku", filters: [{ field: "status", op: "in", option: ["wip"] }] },
      { name: "Archiwum", filters: [{ field: "status", op: "in", option: ["done"] }] },
    ],
    group: "status",
    board: "status",
    collapsed: ["done"],
    extra: "Terminy trafią do kalendarza głównego.\nWidok Tablica z kolumnami statusów.",
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
    footer: { field: "status", kind: "count_option", option: "wip", unit: ["w toku", "w toku", "w toku"] },
    groupSummary: { field: "due", kind: "nearest", label: "najbliższy termin", skip: "done" },
    summaries: {
      status: { kind: "count_option", option: "wip", unit: ["w toku", "w toku", "w toku"] },
      due: { kind: "filled", unit: ["termin", "terminy", "terminów"] },
      repo: { kind: "filled", unit: ["link", "linki", "linków"] },
    },
  },
  websites: {
    name: "Strony WWW",
    icon: "lucide:globe",
    desc: "Strony, które zbudowałeś albo budujesz dla klientów.",
    hint: "Twoje strony WWW",
    newLabel: "Nowa strona",
    noun: ["strona", "strony", "stron"],
    views: [
      { name: "Na żywo", filters: [{ field: "status", op: "in", option: ["live"] }] },
      { name: "W budowie", filters: [{ field: "status", op: "in", option: ["building"] }] },
      { name: "Dla klientów", filters: [{ field: "client", op: "not_equals", value: "ja" }] },
    ],
    group: "status",
    board: "status",
    collapsed: [],
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
    footer: { field: "status", kind: "count_option", option: "live", unit: ["na żywo", "na żywo", "na żywo"] },
    groupSummary: null,
    summaries: {
      url: { kind: "filled", unit: ["link", "linki", "linków"] },
      status: { kind: "count_option", option: "live", unit: ["na żywo", "na żywo", "na żywo"] },
    },
  },
  subscriptions: {
    name: "Subskrypcje",
    icon: "lucide:wallet",
    desc: "Twoje subskrypcje i ich odnowienia.",
    hint: "Twoje subskrypcje",
    newLabel: "Nowa subskrypcja",
    noun: ["subskrypcja", "subskrypcje", "subskrypcji"],
    views: [
      { name: "Aktywne", filters: [{ field: "active", op: "checked" }] },
      {
        name: "Odnowienie w 14 dni",
        filters: [
          { field: "active", op: "checked" },
          { field: "renewal", op: "within_days", value: 14 },
        ],
      },
      { name: "Wstrzymane", filters: [{ field: "active", op: "unchecked" }] },
    ],
    group: "cat",
    board: "cat",
    collapsed: [],
    extra:
      "Karty: miesięcznie, rocznie i najbliższe odnowienie.\nOdnowienia w kalendarzu i przypomnienie dzień wcześniej.\nSuma miesięczna w stopce tabeli.",
    fields: [
      { key: "name", name: "Nazwa", type: "text", is_title: true, config: { empty_label: "Bez nazwy" } },
      { key: "price", name: "Kwota cykliczna", type: "recurring", config: { default_cycle: "month" } },
      {
        key: "renewal",
        name: "Data odnowienia",
        type: "renewal",
        config: { cycle_field_id: "price", active_field_id: "active", show_in_calendar: true },
      },
      {
        key: "cat",
        name: "Kategoria",
        type: "select",
        config: {
          options: [
            { key: "fun", label: "Rozrywka", color: "" },
            { key: "cloud", label: "Chmura", color: "" },
            { key: "health", label: "Zdrowie", color: "" },
            { key: "work", label: "Praca", color: "" },
            { key: "sport", label: "Sport", color: "" },
            { key: "learn", label: "Nauka", color: "" },
            { key: "other", label: "Inne", color: "" },
          ],
          default_option: "other",
        },
      },
      { key: "active", name: "Aktywna", type: "checkbox", config: { default_checked: true } },
    ],
    cards: [
      { label: "Σ miesięcznie", field: "price", aggregation: "sum_month" },
      { label: "Σ rocznie", field: "price", aggregation: "sum_year" },
      { label: "Najbliższe odnowienie", field: "renewal", aggregation: "next_renewal" },
    ],
    sort: [{ field: "renewal", dir: "asc" }],
    footer: { field: "price", kind: "sum_month" },
    groupSummary: { field: "price", kind: "sum_month" },
    summaries: {
      name: { kind: "count", unit: ["subskrypcja", "subskrypcje", "subskrypcji"] },
      price: { kind: "sum_month" },
      renewal: { kind: "in_calendar" },
    },
  },
};

// Stare angielskie tytuły stron z szablonów (przed polonizacją); migracja zmienia tylko strony z takim tytułem
export const LEGACY_TEMPLATE_TITLES: Record<"books" | "projects" | "websites" | "subscriptions", string> = {
  books: "Books",
  projects: "Projects",
  websites: "Websites",
  subscriptions: "Subscriptions",
};

// Dawne zdania pod tytułem (blok tekstu na początku strony z szablonu, przed Tabelami v3). Edytor ukrywa taki
// niezmieniony blok, bo opis szablonu stoi teraz pod tytułem (S2Table); zmieniony tekst zostaje
export const LEGACY_TEMPLATE_INTROS: Record<"books" | "projects" | "websites" | "subscriptions", string> = {
  books: "Co czytam, co przeczytałem i co chcę przeczytać.",
  projects: "Projekty na studia, własne i dla klientów.",
  websites: "Strony klientów: URL, klient, status.",
  subscriptions: "Twoje subskrypcje i ich odnowienia.",
};

// Widoki Haseł (S2Passwords: zakładki po Kategorii); strona systemowa nie ma szablonu w TEMPLATES
const WIDOKI_HASEL = ["Praca", "Studia", "Prywatne"];

// Gotowe widoki, grupowanie i zwinięte grupy „Wszystkich” z prawdziwymi id pól i opcji tabeli.
// Pola i opcje wskazuje nazwa i etykieta (id nadaje baza); widok, którego pole lub opcja zniknęły, jest pomijany.
// year trafia do nazwy „Przeczytane w {year}”
export function templateDefaults(
  key: TemplateKey | "passwords",
  fields: PageField[],
  year: number = new Date().getFullYear(),
): { views: TableView[]; group_by: string | null; collapsed_groups: Record<string, string[]> } {
  const views: TableView[] = [];
  let groupBy: string | null = null;
  let zwiniete: string[] = [];

  if (key === "passwords") {
    const kategoria = fields.find((f) => f.name === "Kategoria" && f.type === "select");
    if (!kategoria) return { views, group_by: null, collapsed_groups: {} };
    for (const nazwa of WIDOKI_HASEL) {
      const opcja = (kategoria.config.options ?? []).find((o) => o.label === nazwa);
      if (!opcja) continue;
      views.push({
        id: crypto.randomUUID(),
        name: nazwa,
        filters: [{ field_id: kategoria.id, op: "in", value: [opcja.id] }],
        sort: [],
        group_by: null,
        layout: "table",
        hidden_field_ids: [],
      });
    }
    return { views, group_by: kategoria.id, collapsed_groups: {} };
  }

  const tpl = TEMPLATES[key];
  const polaSzablonu: Record<string, PageField | undefined> = {};
  for (const f of tpl.fields) polaSzablonu[f.key] = fields.find((p) => p.name === f.name && p.type === f.type);

  for (const w of tpl.views) {
    const filters: FilterCond[] = [];
    let komplet = true;
    for (const c of w.filters) {
      const pole = polaSzablonu[c.field];
      if (!pole) {
        komplet = false;
        break;
      }
      const cond: FilterCond = { field_id: pole.id, op: c.op };
      if (c.option) {
        const etykiety = (tpl.fields.find((f) => f.key === c.field)?.config?.options ?? [])
          .filter((o) => c.option!.includes(o.key))
          .map((o) => o.label);
        const ids = (pole.config.options ?? []).filter((o) => etykiety.includes(o.label)).map((o) => o.id);
        if (ids.length !== c.option.length) {
          komplet = false;
          break;
        }
        cond.value = ids;
      } else if (c.value !== undefined) {
        cond.value = c.value;
      }
      filters.push(cond);
    }
    if (!komplet) continue;
    views.push({
      id: crypto.randomUUID(),
      name: w.name.replace("{year}", String(year)),
      filters,
      sort: [],
      group_by: null,
      layout: "table",
      hidden_field_ids: [],
    });
  }

  const poleGrupy = tpl.group === null ? undefined : polaSzablonu[tpl.group];
  if (poleGrupy) {
    groupBy = poleGrupy.id;
    const etykiety = (tpl.fields.find((f) => f.key === tpl.group)?.config?.options ?? [])
      .filter((o) => tpl.collapsed.includes(o.key))
      .map((o) => o.label);
    zwiniete = (poleGrupy.config.options ?? []).filter((o) => etykiety.includes(o.label)).map((o) => o.id);
  }
  return { views, group_by: groupBy, collapsed_groups: zwiniete.length > 0 ? { all: zwiniete } : {} };
}

// Opis pod tabelą i podsumowanie grupy szablonu z prawdziwymi id pól i opcji (pole po nazwie i typie, opcja po
// etykiecie — jak w templateDefaults). Brak szablonu, Hasła, brakujące pole albo opcja → null (ogólne podsumowanie)
export function templateSummaries(
  key: TemplateKey | "passwords" | null,
  fields: PageField[],
): {
  footer: { field_id: string; summary: ColumnSummary } | null;
  group: { field_id: string; kind: "avg" | "sum_month" | "nearest"; label?: string; skip_option_id?: string } | null;
} {
  if (key === null || key === "passwords") return { footer: null, group: null };
  const tpl = TEMPLATES[key];
  // Pole szablonu po kluczu i id opcji po kluczu (przez etykietę z szablonu)
  const pole = (k: string) => {
    const t = tpl.fields.find((f) => f.key === k);
    return t ? fields.find((p) => p.name === t.name && p.type === t.type) : undefined;
  };
  const opcja = (k: string, klucz: string) => {
    const etykieta = tpl.fields.find((f) => f.key === k)?.config?.options?.find((o) => o.key === klucz)?.label;
    return (pole(k)?.config.options ?? []).find((o) => o.label === etykieta)?.id;
  };

  let footer: { field_id: string; summary: ColumnSummary } | null = null;
  const st = tpl.footer;
  const poleStopki = st ? pole(st.field) : undefined;
  if (st && poleStopki) {
    const summary: ColumnSummary = { kind: st.kind };
    const idOpcji = st.option !== undefined ? opcja(st.field, st.option) : undefined;
    if (st.option === undefined || idOpcji !== undefined) {
      if (idOpcji !== undefined) summary.option_id = idOpcji;
      if (st.unit) summary.unit = st.unit;
      footer = { field_id: poleStopki.id, summary };
    }
  }

  let group: { field_id: string; kind: "avg" | "sum_month" | "nearest"; label?: string; skip_option_id?: string } | null = null;
  const gr = tpl.groupSummary;
  const poleGrupy = gr ? pole(gr.field) : undefined;
  if (gr && poleGrupy) {
    group = { field_id: poleGrupy.id, kind: gr.kind };
    if (gr.label) group.label = gr.label;
    const pomin = gr.skip !== undefined && tpl.group !== null ? opcja(tpl.group, gr.skip) : undefined;
    if (pomin !== undefined) group.skip_option_id = pomin;
  }
  return { footer, group };
}

// Same widoki szablonu (kontrakt z planu)
export function templateViews(key: TemplateKey | "passwords", fields: PageField[], year?: number): TableView[] {
  return templateDefaults(key, fields, year).views;
}

// Nazwy z profiles.pending_pages (onboarding) -> szablon
export const PENDING_TO_TEMPLATE: Record<string, TemplateKey> = {
  Subscriptions: "subscriptions",
  Books: "books",
  Projects: "projects",
  Websites: "websites",
};

// Blok tabeli z szablonu: pola z nowymi id, a ustawienia (sort, karty, podsumowania) wskazują te id
export function buildTemplateBlocks(key: TemplateKey, newId: () => string): CreatePageBlock[] {
  const tpl = TEMPLATES[key];

  // Przejście 1: id wszystkich pól (pole „renewal” wskazuje „active”, które stoi za nim)
  const idPola: Record<string, string> = {};
  for (const f of tpl.fields) idPola[f.key] = newId();

  // Przejście 2: configi z opcjami i odwołaniami do innych pól zamienionymi na id
  const idOpcji: Record<string, string> = {};
  const fields: CreatePageBlock["fields"] = tpl.fields.map((f) => {
    const { options, default_option, cycle_field_id, active_field_id, ...reszta } = f.config ?? {};
    const config: FieldConfig = { ...reszta };
    if (options) {
      config.options = options.map((o) => {
        const id = newId();
        idOpcji[`${f.key}.${o.key}`] = id;
        return { id, label: o.label, color: o.color };
      });
    }
    if (default_option !== undefined) config.default_option = idOpcji[`${f.key}.${default_option}`];
    if (cycle_field_id !== undefined) config.cycle_field_id = idPola[cycle_field_id];
    if (active_field_id !== undefined) config.active_field_id = idPola[active_field_id];
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
  const settings: StoredTableSettings = {
    sort,
    filters: [],
    hidden_field_ids: [],
    column_summaries,
    pinned_cards,
    column_widths: {},
  };

  // Pusta strona: bez bloków — edytor pokazuje szybki start „albo zacznij od:” (decyzja po kroku 2)
  if (key === "empty") return [];

  // Sama tabela: opis szablonu stoi pod tytułem strony (S2Table), nie w bloku tekstu
  return [{ id: newId(), type: "table", content: { name: tpl.name, settings }, fields, rows: [] }];
}

// Nowa tabela z menu „/” (spec 6.8): Nazwa, Status (Wybór), Data i dwa puste wiersze
export function NEW_TABLE_BLOCK(newId: () => string): CreatePageBlock {
  const settings: StoredTableSettings = {
    sort: [],
    filters: [],
    hidden_field_ids: [],
    column_summaries: {},
    pinned_cards: [],
    column_widths: {},
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
