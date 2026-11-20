import type { PageField } from "../fields";
import { computeCard, type PageRow, type PinnedCard } from "../table-model";

// Trzy przypięte karty nad tabelą (Books / Projects / Websites.dc.html); wartości z computeCard
export function PinnedCards({
  cards,
  fields,
  rows,
  today,
  bold = true,
}: {
  cards: PinnedCard[];
  fields: PageField[];
  rows: PageRow[];
  today: string;
  // Websites.dc.html ma liczby bez pogrubienia
  bold?: boolean;
}) {
  if (cards.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
      {cards.map((card, i) => {
        const wynik = computeCard(card, fields, rows, today);
        // Średnia ocena bez ocen: „— / 5” jak w makiecie
        const skala =
          card.aggregation === "avg" &&
          fields.find((f) => f.id === card.field_id)?.type === "rating"
            ? "/ 5"
            : "";
        return (
          <div key={i} className="bg-white px-[18px] py-4">
            <div className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
              {wynik.label}
            </div>
            {card.aggregation === "nearest_date" ? (
              // Najbliższy termin: nazwa 18 px i czas do terminu, czerwony przy ≤ 7 dniach
              <div className="mt-2.5 text-lg font-medium">
                {wynik.value}{" "}
                {wynik.sub && (
                  <span
                    className={`font-mono text-[13px] ${wynik.urgent ? "text-destructive-foreground" : "text-muted-foreground"}`}
                  >
                    {wynik.sub}
                  </span>
                )}
              </div>
            ) : (
              <div className={`mt-2 font-mono text-[26px] ${bold ? "font-medium" : ""}`}>
                {card.aggregation === "count_option_of_total" ? (
                  // „1 / 8” z makiety: druga część mniejsza i szara
                  <>
                    {wynik.value.split(" / ")[0]}{" "}
                    <span className="text-sm text-muted-foreground">/ {wynik.value.split(" / ")[1]}</span>
                  </>
                ) : (
                  <>
                    {wynik.value}
                    {(wynik.sub || skala) && (
                      <>
                        {" "}
                        <span className="text-sm text-muted-foreground">{wynik.sub || skala}</span>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
