// Logika tabeli stron: sort, filtr, podsumowania stopki, karty i stopka edytora.
// Czyste funkcje bez bazy i UI; ustawienia wskazujące nieistniejące pole są pomijane.
import { isUrgent, normalizeValue, relativeDue, formatValue } from "./fields";
import type { FieldType, PageField } from "./fields";

export type PageRow = {
  id: string;
  values: Record<string, unknown>;
  position: number;
  deletedAt: string | null;
};

export type SortKey = { field_id: string; dir: "asc" | "desc" };

export type FilterCond = {
  field_id: string;
  op:
    | "checked"
    | "unchecked"
    | "in"
    | "gte"
    | "lte"
    | "contains"
    | "before"
    | "after"
    | "empty"
    | "not_empty";
  value?: unknown;
};

export type SummaryKind =
  | "none"
  | "count"
  | "filled"
  | "empty"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "checked"
  | "earliest"
  | "latest"
  | "nearest";

export type PinnedCard = {
  // Etykieta; „{year}” zamieniamy na bieżący rok w computeCard
  label: string;
  field_id: string;
  aggregation:
    | "count_option"
    | "count_option_of_total"
    | "count_option_in_year"
    | "avg"
    | "nearest_date"
    | "count_distinct";
  option_id?: string;
  date_field_id?: string;
  title_field_id?: string;
  done_option_id?: string;
  // Odmiana rzeczownika pod liczbą (1 / 2-4 / 5+), np. książka, książki, książek
  unit?: [string, string, string];
};

export type TableSettings = {
  sort: SortKey[];
  filters: FilterCond[];
  hidden_field_ids: string[];
  column_summaries: Record<string, SummaryKind>;
  pinned_cards: PinnedCard[];
};

// Odmiana polska: 1 / 2-4 (poza 12-14) / reszta
function odmien(n: number, jeden: string, kilka: string, wiele: string): string {
  const koncowka = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `${n} ${n === 1 ? jeden : koncowka ? kilka : wiele}`;
}

// Liczba z przecinkiem i podaną liczbą miejsc po przecinku
function liczba(n: number, miejsca: number): string {
  return n.toFixed(miejsca).replace(".", ",");
}

export function operatorsFor(type: FieldType): FilterCond["op"][] {
  switch (type) {
    case "checkbox":
      return ["checked", "unchecked"];
    case "select":
    case "status":
      return ["in", "empty"];
    case "number":
    case "rating":
      return ["gte", "lte", "empty"];
    case "text":
    case "url":
      return ["contains", "empty"];
    case "date":
      return ["before", "after", "empty"];
  }
}

export function visibleRows(
  fields: PageField[],
  rows: PageRow[],
  settings: TableSettings,
  extraFilters: FilterCond[] | null = null,
): PageRow[] {
  const poId = new Map(fields.map((f) => [f.id, f]));
  const filtry = extraFilters ?? settings.filters;

  // Usunięte wiersze nigdy nie wchodzą do widoku
  let wynik = rows.filter((r) => r.deletedAt === null);

  for (const cond of filtry) {
    const field = poId.get(cond.field_id);
    if (!field) continue;
    wynik = wynik.filter((r) => {
      const v = normalizeValue(field, r.values[field.id]);
      switch (cond.op) {
        case "checked":
          return v === true;
        case "unchecked":
          return v !== true;
        case "empty":
          return v === null;
        case "not_empty":
          return v !== null;
        case "in": {
          if (!Array.isArray(cond.value) || cond.value.length === 0) return true;
          return v !== null && cond.value.includes(v);
        }
        case "gte":
        case "lte": {
          if (typeof cond.value !== "number" || !Number.isFinite(cond.value)) return true;
          if (typeof v !== "number") return false;
          return cond.op === "gte" ? v >= cond.value : v <= cond.value;
        }
        case "contains": {
          if (typeof cond.value !== "string" || cond.value.trim() === "") return true;
          if (typeof v !== "string") return false;
          return v.toLowerCase().includes(cond.value.trim().toLowerCase());
        }
        case "before":
        case "after": {
          if (typeof cond.value !== "string" || cond.value === "") return true;
          if (typeof v !== "string") return false;
          return cond.op === "before" ? v < cond.value : v > cond.value;
        }
      }
    });
  }

  const klucze = settings.sort.filter((k) => poId.has(k.field_id));
  return wynik.slice().sort((a, b) => {
    for (const k of klucze) {
      const field = poId.get(k.field_id) as PageField;
      const va = normalizeValue(field, a.values[field.id]);
      const vb = normalizeValue(field, b.values[field.id]);
      // Puste zawsze na końcu, niezależnie od kierunku
      if (va === null && vb === null) continue;
      if (va === null) return 1;
      if (vb === null) return -1;
      let cmp = 0;
      if (field.type === "select" || field.type === "status") {
        const opcje = field.config.options ?? [];
        cmp = opcje.findIndex((o) => o.id === va) - opcje.findIndex((o) => o.id === vb);
      } else if (typeof va === "number" && typeof vb === "number") {
        cmp = va - vb;
      } else if (typeof va === "boolean" && typeof vb === "boolean") {
        cmp = Number(va) - Number(vb);
      } else {
        cmp = String(va).localeCompare(String(vb), "pl");
      }
      if (cmp !== 0) return k.dir === "asc" ? cmp : -cmp;
    }
    return a.position - b.position;
  });
}

export function summaryOptions(type: FieldType): SummaryKind[] {
  switch (type) {
    case "number":
      return ["none", "count", "filled", "empty", "sum", "avg", "min", "max"];
    case "rating":
      return ["none", "count", "filled", "empty", "avg", "min", "max"];
    case "checkbox":
      return ["none", "count", "checked"];
    case "date":
      return ["none", "count", "filled", "empty", "earliest", "latest", "nearest"];
    case "text":
    case "url":
    case "select":
    case "status":
      return ["none", "count", "filled", "empty"];
  }
}

// Tekst stopki kolumny; "" dla none, "—" gdy nie ma z czego policzyć
export function summarize(
  field: PageField,
  rows: PageRow[],
  kind: SummaryKind,
  today: string,
): string {
  const zywe = rows.filter((r) => r.deletedAt === null);
  const wartosci = zywe.map((r) => normalizeValue(field, r.values[field.id]));
  const wypelnione = wartosci.filter((v) => v !== null);
  const liczby = wypelnione.filter((v): v is number => typeof v === "number");
  const daty = wypelnione.filter((v): v is string => typeof v === "string").sort();

  switch (kind) {
    case "none":
      return "";
    case "count":
      return odmien(zywe.length, "wiersz", "wiersze", "wierszy");
    case "filled": {
      const n = wypelnione.length;
      if (field.type === "date") return odmien(n, "termin", "terminy", "terminów");
      if (field.type === "url") return odmien(n, "link", "linki", "linków");
      return odmien(n, "wypełniony", "wypełnione", "wypełnionych");
    }
    case "empty":
      return odmien(wartosci.length - wypelnione.length, "pusty", "puste", "pustych");
    case "checked":
      return `${wartosci.filter((v) => v === true).length} / ${zywe.length}`;
    case "sum":
      return liczby.length === 0
        ? "—"
        : formatValue(field, liczby.reduce((s, n) => s + n, 0));
    case "avg": {
      if (liczby.length === 0) return "—";
      const srednia = liczby.reduce((s, n) => s + n, 0) / liczby.length;
      if (field.type === "rating") return `śr. ${liczba(srednia, 1)}`;
      const miejsca = field.config.number_format === "pln" ? 2 : 1;
      const zaokraglona = Number(srednia.toFixed(miejsca));
      return `śr. ${formatValue(field, zaokraglona)}`;
    }
    case "min":
    case "max": {
      if (liczby.length === 0) return "—";
      const n = kind === "min" ? Math.min(...liczby) : Math.max(...liczby);
      return field.type === "rating" ? String(n) : formatValue(field, n);
    }
    case "earliest":
      return daty.length === 0 ? "—" : formatValue(field, daty[0]);
    case "latest":
      return daty.length === 0 ? "—" : formatValue(field, daty[daty.length - 1]);
    case "nearest": {
      const najblizsza = daty.find((d) => d >= today);
      return najblizsza === undefined ? "—" : formatValue(field, najblizsza);
    }
  }
}

export function computeCard(
  card: PinnedCard,
  fields: PageField[],
  rows: PageRow[],
  today: string,
): { label: string; value: string; sub: string; urgent?: boolean } {
  const label = card.label.replace("{year}", today.slice(0, 4));
  const brak = { label, value: "—", sub: "" };
  const field = fields.find((f) => f.id === card.field_id);
  if (!field) return brak;
  const zywe = rows.filter((r) => r.deletedAt === null);

  switch (card.aggregation) {
    case "count_option": {
      const n = zywe.filter(
        (r) => normalizeValue(field, r.values[field.id]) === card.option_id,
      ).length;
      return { label, value: String(n), sub: "" };
    }
    case "count_option_of_total": {
      const n = zywe.filter(
        (r) => normalizeValue(field, r.values[field.id]) === card.option_id,
      ).length;
      return { label, value: `${n} / ${zywe.length}`, sub: "" };
    }
    case "count_option_in_year": {
      const dateField = fields.find((f) => f.id === card.date_field_id);
      if (!dateField) return brak;
      const rok = today.slice(0, 4);
      const n = zywe.filter((r) => {
        if (normalizeValue(field, r.values[field.id]) !== card.option_id) return false;
        const d = normalizeValue(dateField, r.values[dateField.id]);
        return typeof d === "string" && d.slice(0, 4) === rok;
      }).length;
      const sub = card.unit ? odmien(n, ...card.unit).replace(/^\d+ /, "") : "";
      return { label, value: String(n), sub };
    }
    case "avg": {
      const liczby = zywe
        .map((r) => normalizeValue(field, r.values[field.id]))
        .filter((v): v is number => typeof v === "number");
      if (liczby.length === 0) return brak;
      const srednia = liczby.reduce((s, n) => s + n, 0) / liczby.length;
      return { label, value: liczba(srednia, 1), sub: field.type === "rating" ? "/ 5" : "" };
    }
    case "nearest_date": {
      const dateField = fields.find((f) => f.id === card.date_field_id);
      const titleField = fields.find((f) => f.id === card.title_field_id);
      if (!dateField || !titleField) return brak;
      // Najbliższy termin dziś lub później wśród wierszy, które nie są zrobione
      let najblizszy: { row: PageRow; data: string } | null = null;
      for (const r of zywe) {
        const d = normalizeValue(dateField, r.values[dateField.id]);
        if (typeof d !== "string" || d < today) continue;
        if (normalizeValue(field, r.values[field.id]) === card.done_option_id) continue;
        if (najblizszy === null || d < najblizszy.data) najblizszy = { row: r, data: d };
      }
      if (najblizszy === null) return { label, value: "Brak terminów", sub: "" };
      const nazwa = normalizeValue(titleField, najblizszy.row.values[titleField.id]);
      return {
        label,
        value: typeof nazwa === "string" ? nazwa : (titleField.config.empty_label ?? ""),
        sub: relativeDue(najblizszy.data, today).text,
        urgent: isUrgent(najblizszy.data, today, false),
      };
    }
    case "count_distinct": {
      const rozne = new Set<string>();
      for (const r of zywe) {
        const v = normalizeValue(field, r.values[field.id]);
        if (v === null) continue;
        rozne.add(String(v).trim().toLowerCase());
      }
      rozne.delete("");
      return { label, value: String(rozne.size), sub: "" };
    }
  }
}

// Stała stopka edytora: suma dla Liczby, „x / y” dla Checkboxa
export function editorFooter(field: PageField, rows: PageRow[]): string | null {
  const zywe = rows.filter((r) => r.deletedAt === null);
  if (field.type === "number") {
    const liczby = zywe
      .map((r) => normalizeValue(field, r.values[field.id]))
      .filter((v): v is number => typeof v === "number");
    return formatValue(field, liczby.reduce((s, n) => s + n, 0));
  }
  if (field.type === "checkbox") {
    const zaznaczone = zywe.filter((r) => normalizeValue(field, r.values[field.id]) === true);
    return `${zaznaczone.length} / ${zywe.length}`;
  }
  return null;
}
