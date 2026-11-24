import { summarize, type ColumnSummary, type PageRow, type SummaryKind } from "../table-model";
import type { PageField } from "../fields";

// Nazwy rodzajów podsumowania w menu kolumny (z makiety: „Brak”, „Liczba wierszy”, „Wypełnione”,
// „Puste”, „Najbliższa”)
export const NAZWY_PODSUMOWAN: Record<SummaryKind, string> = {
  none: "Brak",
  count: "Liczba wierszy",
  filled: "Wypełnione",
  empty: "Puste",
  sum: "Suma",
  avg: "Średnia",
  min: "Minimum",
  max: "Maksimum",
  checked: "Zaznaczone",
  earliest: "Najwcześniejsza",
  latest: "Najpóźniejsza",
  nearest: "Najbliższa",
  sum_month: "Suma / mies.",
  sum_year: "Suma / rok",
  in_calendar: "W kalendarzu",
};

// Komórka stopki tabeli: wynik podsumowania kolumny z wierszy po filtrze (puste dla „Brak”).
// `fields` to wszystkie pola tabeli: sumy Kwoty cyklicznej i podsumowania Daty odnowienia szukają w nich „Aktywnej”.
export function SummaryCell({
  field,
  fields,
  rows,
  summary,
  today,
}: {
  field: PageField;
  fields: PageField[];
  rows: PageRow[];
  summary: ColumnSummary | undefined;
  today: string;
}) {
  const tekst = summary ? summarize(field, rows, summary, today, fields) : "";
  // Średnia i sumy Kwoty cyklicznej wyróżnione: pogrubione i ciemne (S2Books, S2Main tfoot)
  const wyrozniona =
    summary?.kind === "avg" || summary?.kind === "sum_month" || summary?.kind === "sum_year";
  return (
    <td
      // Stopka jak w S2Books.dc.html: padding 8 × 12 px (wiersz ok. 37 px), linia nad komórką, liczby i kwoty do prawej
      className={`border-t border-border px-3 py-2 tabular-nums ${
        field.type === "number" || field.type === "recurring" ? "text-right" : ""
      } ${wyrozniona ? "font-semibold text-foreground" : "text-muted-foreground"}`}
    >
      {tekst}
    </td>
  );
}
