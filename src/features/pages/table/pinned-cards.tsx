import { Card, StatusBadge } from "@/components/controls";
import type { PageField } from "../fields";
import { computeCard, type PageRow, type PinnedCard } from "../table-model";

// Trzy przypięte karty nad tabelą (CBooks / CProjects / CWebsites.dc.html): .card z etykietą .lbl
// i liczbą 26 px; wartości z computeCard
export function PinnedCards({
  cards,
  fields,
  rows,
  today,
}: {
  cards: PinnedCard[];
  fields: PageField[];
  rows: PageRow[];
  today: string;
}) {
  // Bez kart nie ma siatki ani pustej ramki
  if (cards.length === 0) return null;
  return (
    <div data-testid="przypiete-karty" className="grid grid-cols-3 gap-3">
      {cards.map((card, i) => {
        const wynik = computeCard(card, fields, rows, today);
        // Średnia ocena bez ocen: „— / 5” jak w makiecie
        const skala =
          card.aggregation === "avg" &&
          fields.find((f) => f.id === card.field_id)?.type === "rating"
            ? "/ 5"
            : "";
        return (
          <Card key={i} className="min-w-0 px-[18px] py-4">
            <div className="text-xs font-medium text-muted-foreground">{wynik.label}</div>
            {card.aggregation === "nearest_date" ? (
              // Najbliższy termin: nazwa 18 px i czas do terminu w odznace, czerwonej przy ≤ 7 dniach
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-lg font-semibold">
                <span>{wynik.value}</span>
                {wynik.sub && (
                  <StatusBadge tone={wynik.urgent ? "red" : "gray"} size="lg">
                    {wynik.sub}
                  </StatusBadge>
                )}
              </div>
            ) : (
              <div className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">
                {card.aggregation === "count_option_of_total" ? (
                  // „1 / 8” z makiety: druga część mniejsza i szara
                  <>
                    {wynik.value.split(" / ")[0]}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {wynik.value.split(" / ")[1]}
                    </span>
                  </>
                ) : (
                  <>
                    {wynik.value}
                    {(wynik.sub || skala) && (
                      <>
                        {" "}
                        <span className="text-sm font-normal text-muted-foreground">{wynik.sub || skala}</span>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
