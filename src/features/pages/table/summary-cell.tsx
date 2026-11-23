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
};

// Komórka stopki tabeli: wynik podsumowania kolumny z wierszy po filtrze (puste dla „Brak”)
export function SummaryCell({
  field,
  rows,
  summary,
  today,
}: {
  field: PageField;
  rows: PageRow[];
  summary: ColumnSummary | undefined;
  today: string;
}) {
  const tekst = summary ? summarize(field, rows, summary, today) : "";
  return (
    <td
      // Stopka jak w S2Books.dc.html: padding 8 × 12 px (wiersz ok. 37 px), linia nad komórką, liczby do prawej; średnia wyróżniona
      className={`border-t py-2 border-border px-3 tabular-nums ${field.type === "number" ? "text-right" : ""} ${
        summary?.kind === "avg" ? "font-semibold text-foreground" : "text-muted-foreground"
      }`}
    >
      {tekst}
    </td>
  );
}
