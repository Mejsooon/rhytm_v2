// Widoki tabeli: aktywny widok, szukanie, grupy i liczniki zakładek. Czyste funkcje bez bazy i UI.
import { normalizeValue } from "./fields";
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

// Grupy w kolejności opcji pola, wiersze bez wartości („Bez wartości”, key "") na końcu; puste grupy pomijane.
// groupBy null albo wskazujący nieistniejące (lub niegrupowalne) pole daje jedną grupę key "*" ze wszystkimi wierszami
export function groupRows(fields: PageField[], rows: PageRow[], groupBy: string | null): RowGroup[] {
  const pole = groupBy === null ? undefined : fields.find((f) => f.id === groupBy);
  if (!pole || (pole.type !== "select" && pole.type !== "status" && pole.type !== "checkbox")) {
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
  } else {
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
