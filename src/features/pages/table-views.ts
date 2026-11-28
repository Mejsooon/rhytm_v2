// Widoki tabeli: aktywny widok, szukanie, grupy i liczniki zakładek. Czyste funkcje bez bazy i UI.
import { formatValue, isRecurringValue, normalizeValue } from "./fields";
import type { PageField } from "./fields";
import { visibleRows } from "./table-model";
import type { PageRow, TableSettings, TableView } from "./table-model";

export type EffectiveView = Pick<TableView, "filters" | "sort" | "group_by" | "layout" | "hidden_field_ids">;

// Aktywny widok; brak active_view_id albo id nieistniejącego widoku daje ustawienia „Wszystkich”
export function effectiveView(settings: TableSettings): EffectiveView {
  const widok = settings.active_view_id === null ? undefined : settings.views.find((v) => v.id === settings.active_view_id);
  if (widok) {
    return {
      filters: widok.filters,
      sort: widok.sort,
      group_by: widok.group_by,
      layout: widok.layout,
      hidden_field_ids: widok.hidden_field_ids,
    };
  }
  return {
    filters: settings.filters,
    sort: settings.sort,
    group_by: settings.group_by,
    layout: settings.layout,
    hidden_field_ids: settings.hidden_field_ids,
  };
}

// Tekst do porównań: małe litery bez polskich znaków diakrytycznych (ł nie rozkłada się w NFD)
function bezOgonkow(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");
}

// Szukanie po wszystkich polach poza sekretami (szyfrogram nigdy nie trafia do porównań)
export function searchRows(fields: PageField[], rows: PageRow[], q: string): PageRow[] {
  const fraza = bezOgonkow(q.trim());
  if (fraza === "") return rows;
  const jawne = fields.filter((f) => f.type !== "secret");
  return rows.filter((r) =>
    jawne.some((f) => {
      const v = normalizeValue(f, r.values[f.id]);
      if (v === null) return false;
      let tekst: string;
      if (f.type === "select" || f.type === "status") {
        tekst = (f.config.options ?? []).find((o) => o.id === v)?.label ?? "";
      } else if (typeof v === "object") {
        tekst = f.type === "recurring" ? String((v as { amount: number }).amount) : "";
      } else {
        tekst = String(v);
      }
      return bezOgonkow(tekst).includes(fraza);
    }),
  );
}

export type RowGroup = { key: string; label: string; color: string | null; rows: PageRow[] };

const MIESIACE = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

// Grupa wiersza w polu innym niż Wybór i Checkbox: nazwa i klucz kolejności; null = brak wartości
function grupaWartosci(pole: PageField, raw: unknown): [string, number | string] | null {
  const v = normalizeValue(pole, raw);
  if (v === null) return null;
  if (pole.type === "rating") return [`${"★".repeat(v as number)} ${v}`, -(v as number)];
  if (pole.type === "date" || pole.type === "renewal") {
    const [rok, miesiac] = (v as string).split("-");
    return [`${MIESIACE[Number(miesiac) - 1]} ${rok}`, -Number(`${rok}${miesiac}`)];
  }
  if (isRecurringValue(v)) {
    if (v.amount < 20) return ["do 20 zł", 0];
    return v.amount < 50 ? ["20–50 zł", 1] : ["50 zł i więcej", 2];
  }
  return [formatValue(pole, v), typeof v === "number" ? v : String(v).toLocaleLowerCase("pl")];
}

const BEZ_WARTOSCI: Partial<Record<PageField["type"], string>> = {
  rating: "Bez oceny",
  date: "Bez daty",
  renewal: "Bez daty",
  recurring: "Bez kwoty",
};

// Grupy po dowolnym polu poza Sekretem (S2Table); puste grupy pomijane, wiersze bez wartości (key "") na końcu.
// Wybór i Status w kolejności opcji, Checkbox zaznaczone → niezaznaczone, Ocena i Data malejąco, reszta rosnąco.
// groupBy null albo wskazujący nieistniejące pole (lub Sekret) daje jedną grupę key "*"
export function groupRows(fields: PageField[], rows: PageRow[], groupBy: string | null): RowGroup[] {
  const pole = groupBy === null ? undefined : fields.find((f) => f.id === groupBy);
  if (!pole || pole.type === "secret") {
    return [{ key: "*", label: "", color: null, rows }];
  }

  const grupy: RowGroup[] = [];
  if (pole.type === "checkbox") {
    grupy.push({ key: "true", label: "Zaznaczone", color: null, rows: [] });
    grupy.push({ key: "false", label: "Niezaznaczone", color: null, rows: [] });
    for (const r of rows) {
      const v = normalizeValue(pole, r.values[pole.id]);
      grupy[v === true ? 0 : 1].rows.push(r);
    }
  } else if (pole.type === "select" || pole.type === "status") {
    for (const o of pole.config.options ?? []) {
      grupy.push({ key: o.id, label: o.label, color: o.color, rows: [] });
    }
    const bezWartosci: RowGroup = { key: "", label: "Bez wartości", color: null, rows: [] };
    for (const r of rows) {
      const v = normalizeValue(pole, r.values[pole.id]);
      const grupa = grupy.find((g) => g.key === v);
      (grupa ?? bezWartosci).rows.push(r);
    }
    grupy.push(bezWartosci);
  } else {
    const wgNazwy = new Map<string, { grupa: RowGroup; kolejnosc: number | string }>();
    const bezWartosci: RowGroup = { key: "", label: BEZ_WARTOSCI[pole.type] ?? "Puste", color: null, rows: [] };
    for (const r of rows) {
      const w = grupaWartosci(pole, r.values[pole.id]);
      if (!w) {
        bezWartosci.rows.push(r);
        continue;
      }
      const [nazwa, kolejnosc] = w;
      let wpis = wgNazwy.get(nazwa);
      if (!wpis) {
        // Klucz zwiniętej grupy w bazie ma limit 64 znaków
        wpis = { grupa: { key: `v:${nazwa}`.slice(0, 64), label: nazwa, color: null, rows: [] }, kolejnosc };
        wgNazwy.set(nazwa, wpis);
      }
      wpis.grupa.rows.push(r);
    }
    const posortowane = [...wgNazwy.values()].sort((x, y) =>
      typeof x.kolejnosc === "number" && typeof y.kolejnosc === "number"
        ? x.kolejnosc - y.kolejnosc
        : String(x.kolejnosc).localeCompare(String(y.kolejnosc), "pl"),
    );
    grupy.push(...posortowane.map((w) => w.grupa), bezWartosci);
  }
  return grupy.filter((g) => g.rows.length > 0);
}

// Liczba wierszy widoku (filtry widoku, bez szukania) — licznik w zakładce
export function viewCount(fields: PageField[], rows: PageRow[], view: EffectiveView, today: string): number {
  const bezSortu: TableSettings = {
    sort: [],
    filters: view.filters,
    hidden_field_ids: [],
    column_summaries: {},
    pinned_cards: [],
    column_widths: {},
    views: [],
    active_view_id: null,
    group_by: null,
    layout: "table",
    collapsed_groups: {},
  };
  return visibleRows(fields, rows, bezSortu, view.filters, today).length;
}
