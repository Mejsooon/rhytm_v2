// Logika tabeli stron: sort, filtr, podsumowania stopki, karty i stopka edytora.
// Czyste funkcje bez bazy i UI; ustawienia wskazujące nieistniejące pole są pomijane.
import {
  formatMoney,
  formatValue,
  isRecurringValue,
  isUrgent,
  monthlyAmount,
  nextRenewal,
  normalizeValue,
  relativeDue,
  rowActive,
  rowCycle,
  yearlyAmount,
} from "./fields";
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
  | "nearest"
  | "sum_month"
  | "sum_year"
  | "in_calendar";

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
    | "count_distinct"
    | "sum_month"
    | "sum_year"
    | "next_renewal";
  option_id?: string;
  date_field_id?: string;
  title_field_id?: string;
  done_option_id?: string;
  // Odmiana rzeczownika pod liczbą (1 / 2-4 / 5+), np. książka, książki, książek
  unit?: [string, string, string];
  // Szerokość karty w px (min. 180); brak = domyślna 220
  width?: number;
};

// Podsumowanie kolumny: rodzaj ogólny albo licznik opcji / roku z własną odmianą rzeczownika
export type ColumnSummary = {
  kind: SummaryKind | "count_option" | "count_in_year";
  option_id?: string;
  unit?: [string, string, string];
  // Dodatkowy warunek wierszy przed liczeniem: pole = opcja (np. Status = Przeczytane)
  where?: { field_id: string; option_id: string };
};

export type TableSettings = {
  sort: SortKey[];
  filters: FilterCond[];
  hidden_field_ids: string[];
  column_summaries: Record<string, ColumnSummary>;
  pinned_cards: PinnedCard[];
  // Szerokości kolumn w px (id pola → szerokość, min. 80); brak wpisu = domyślna
  column_widths: Record<string, number>;
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
    case "renewal":
      return ["before", "after", "empty"];
    case "recurring":
      return ["gte", "lte", "empty"];
    // Sekret: serwer i widok widzą tylko szyfrogram, więc można filtrować jedynie puste / niepuste
    case "secret":
      return ["empty", "not_empty"];
  }
}

export function visibleRows(
  fields: PageField[],
  rows: PageRow[],
  settings: TableSettings,
  extraFilters: FilterCond[] | null = null,
  // Dziś (RRRR-MM-DD): Data odnowienia filtruje i sortuje po następnym odnowieniu; bez niego po kotwicy
  today: string | null = null,
): PageRow[] {
  const poId = new Map(fields.map((f) => [f.id, f]));
  const filtry = extraFilters ?? settings.filters;

  // Usunięte wiersze nigdy nie wchodzą do widoku
  let wynik = rows.filter((r) => r.deletedAt === null);

  for (const cond of filtry) {
    const field = poId.get(cond.field_id);
    if (!field) continue;
    // Sekret: poza pusty / niepusty żaden operator nie ma sensu (nic nie porównujemy z szyfrogramem)
    if (field.type === "secret" && cond.op !== "empty" && cond.op !== "not_empty") continue;
    wynik = wynik.filter((r) => {
      let v = normalizeValue(field, r.values[field.id]);
      // Kwota cykliczna porównuje się na skali miesięcznej, Data odnowienia po następnym odnowieniu
      if (field.type === "recurring" && isRecurringValue(v)) v = monthlyAmount(v);
      if (field.type === "renewal" && typeof v === "string" && today !== null) {
        v = nextRenewal(v, rowCycle(field, fields, r.values), today);
      }
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

  // Sort po Sekrecie jest niedostępny: takie klucze są pomijane (zostaje kolejność position)
  const klucze = settings.sort.filter((k) => poId.has(k.field_id) && poId.get(k.field_id)?.type !== "secret");
  return wynik.slice().sort((a, b) => {
    for (const k of klucze) {
      const field = poId.get(k.field_id) as PageField;
      let va = normalizeValue(field, a.values[field.id]);
      let vb = normalizeValue(field, b.values[field.id]);
      if (field.type === "recurring") {
        if (isRecurringValue(va)) va = monthlyAmount(va);
        if (isRecurringValue(vb)) vb = monthlyAmount(vb);
      }
      if (field.type === "renewal" && today !== null) {
        if (typeof va === "string") va = nextRenewal(va, rowCycle(field, fields, a.values), today);
        if (typeof vb === "string") vb = nextRenewal(vb, rowCycle(field, fields, b.values), today);
      }
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
    case "recurring":
      return ["none", "count", "filled", "empty", "sum_month", "sum_year"];
    case "renewal":
      return ["none", "count", "filled", "empty", "nearest", "in_calendar"];
    case "text":
    case "url":
    case "select":
    case "status":
      return ["none", "count", "filled", "empty"];
    // Sekret: tylko „wypełnione” / „puste”
    case "secret":
      return ["none", "filled", "empty"];
  }
}

// Tekst stopki kolumny; "" dla none, "—" gdy nie ma z czego policzyć
export function summarize(
  field: PageField,
  rows: PageRow[],
  summary: ColumnSummary,
  today: string,
  // Wszystkie pola tabeli: sumy Kwoty cyklicznej i podsumowania Daty odnowienia szukają w nich „Aktywnej”
  fields: PageField[] = [],
): string {
  const kind = summary.kind;
  const unit = summary.unit;
  const where = summary.where;
  const zywe = rows.filter(
    (r) => r.deletedAt === null && (!where || r.values[where.field_id] === where.option_id),
  );
  const wartosci = zywe.map((r) => normalizeValue(field, r.values[field.id]));
  const wypelnione = wartosci.filter((v) => v !== null);
  const liczby = wypelnione.filter((v): v is number => typeof v === "number");
  const daty = wypelnione.filter((v): v is string => typeof v === "string").sort();

  // Wiersze aktywne: dla Kwoty według pierwszego pola Data odnowienia, które bierze z niej cykl;
  // dla Daty odnowienia według niej samej; bez takiego pola liczą się wszystkie wiersze
  const odnowienie =
    field.type === "renewal"
      ? field
      : fields.find((f) => f.type === "renewal" && f.config.cycle_field_id === field.id);
  const aktywne = odnowienie ? zywe.filter((r) => rowActive(odnowienie, fields, r.values)) : zywe;

  switch (kind) {
    case "none":
      return "";
    case "count":
      return unit ? odmien(zywe.length, ...unit) : odmien(zywe.length, "wiersz", "wiersze", "wierszy");
    case "count_option": {
      const n = wartosci.filter((v) => v === summary.option_id).length;
      return unit ? odmien(n, ...unit) : String(n);
    }
    case "count_in_year": {
      const rok = today.slice(0, 4);
      const n = daty.filter((d) => d.slice(0, 4) === rok).length;
      return unit ? odmien(n, ...unit) : String(n);
    }
    case "filled": {
      const n = wypelnione.length;
      if (unit) return odmien(n, ...unit);
      if (field.type === "date" || field.type === "renewal") {
        return odmien(n, "termin", "terminy", "terminów");
      }
      if (field.type === "url") return odmien(n, "link", "linki", "linków");
      return odmien(n, "wypełniony", "wypełnione", "wypełnionych");
    }
    case "empty": {
      const n = wartosci.length - wypelnione.length;
      return unit ? odmien(n, ...unit) : odmien(n, "pusty", "puste", "pustych");
    }
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
      if (field.type === "renewal") {
        // Najwcześniejsze następne odnowienie aktywnych wierszy
        const nastepne = aktywne
          .map((r) => {
            const d = normalizeValue(field, r.values[field.id]);
            return typeof d === "string" ? nextRenewal(d, rowCycle(field, fields, r.values), today) : null;
          })
          .filter((d): d is string => d !== null)
          .sort();
        return nastepne.length === 0 ? "—" : formatValue(field, nastepne[0]);
      }
      const najblizsza = daty.find((d) => d >= today);
      return najblizsza === undefined ? "—" : formatValue(field, najblizsza);
    }
    case "sum_month":
    case "sum_year": {
      const kwoty = aktywne
        .map((r) => normalizeValue(field, r.values[field.id]))
        .filter(isRecurringValue);
      if (kwoty.length === 0) return "—";
      const suma = kwoty.reduce(
        (s, k) => s + (kind === "sum_month" ? monthlyAmount(k) : yearlyAmount(k)),
        0,
      );
      return `Σ ${formatMoney(suma)} zł / ${kind === "sum_month" ? "mies." : "rok"}`;
    }
    case "in_calendar": {
      if (field.config.show_in_calendar === false) return "0 w kalendarzu";
      const n = aktywne.filter(
        (r) => normalizeValue(field, r.values[field.id]) !== null,
      ).length;
      return `${n} w kalendarzu`;
    }
  }
}

export function computeCard(
  card: PinnedCard,
  fields: PageField[],
  rows: PageRow[],
  today: string,
): { label: string; value: string; sub: string; urgent?: boolean; date?: string } {
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
    case "sum_month":
    case "sum_year": {
      // Aktywność według pierwszego pola Data odnowienia, które bierze cykl z tej kwoty
      const odnowienie = fields.find(
        (f) => f.type === "renewal" && f.config.cycle_field_id === field.id,
      );
      const kwoty = zywe
        .filter((r) => (odnowienie ? rowActive(odnowienie, fields, r.values) : true))
        .map((r) => normalizeValue(field, r.values[field.id]))
        .filter(isRecurringValue);
      const suma = kwoty.reduce(
        (s, k) => s + (card.aggregation === "sum_month" ? monthlyAmount(k) : yearlyAmount(k)),
        0,
      );
      return { label, value: formatMoney(suma), sub: "zł" };
    }
    case "next_renewal": {
      // Aktywny wiersz z najwcześniejszym następnym odnowieniem (przy remisie pierwszy w tabeli)
      let najblizszy: { row: PageRow; data: string } | null = null;
      for (const r of zywe) {
        if (!rowActive(field, fields, r.values)) continue;
        const d = normalizeValue(field, r.values[field.id]);
        if (typeof d !== "string") continue;
        const nastepne = nextRenewal(d, rowCycle(field, fields, r.values), today);
        if (najblizszy === null || nastepne < najblizszy.data) najblizszy = { row: r, data: nastepne };
      }
      if (najblizszy === null) return { label, value: "Brak odnowień", sub: "" };
      const titleField = fields.find((f) => f.isTitle);
      const nazwa = titleField ? normalizeValue(titleField, najblizszy.row.values[titleField.id]) : null;
      const dni = relativeDue(najblizszy.data, today);
      return {
        label,
        value: typeof nazwa === "string" ? nazwa : (titleField?.config.empty_label ?? ""),
        sub: dni.text,
        urgent: dni.days <= 10,
        date: najblizszy.data,
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
