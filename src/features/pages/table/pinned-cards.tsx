"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ellipsis,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  ActionPopover,
  Button,
  Card,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  StatusBadge,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import {
  DOMYSLNA_SZEROKOSC_KARTY,
  MIN_SZEROKOSC_KARTY,
  type PageField,
} from "../fields";
import { computeCard, type PageRow, type PinnedCard } from "../table-model";

// Pozycja menu karty; wyłączona: opacity .64
const POZYCJA = cn(
  MENU_ITEM,
  "disabled:cursor-not-allowed disabled:opacity-[.64] disabled:hover:bg-transparent",
);
// Uchwyt szerokości (.kresize z S2Books): na prawej krawędzi, kreska 2 × 24 px po najechaniu na kartę albo fokusie;
// na telefonie bez uchwytu
const UCHWYT_KARTY =
  "absolute top-2 -right-[7px] bottom-2 z-[2] w-3 cursor-ew-resize touch-none rounded-md outline-none after:absolute after:top-1/2 after:left-[5px] after:-mt-3 after:h-6 after:w-0.5 after:rounded-sm after:bg-transparent after:transition-colors after:duration-[120ms] after:content-[''] group-hover/karta:after:bg-black/[.24] focus-visible:after:bg-black/[.24] data-[on=true]:after:bg-black/[.24] max-[799px]:hidden";

// Przypięte karty nad tabelą (CBooks / CProjects / CWebsites.dc.html, S2Books, S2CardMenu): .card z etykietą .lbl
// i liczbą 26 px; wartości z computeCard. Rząd zawija się, karta ma szerokość (domyślnie 220, min. 180, max 100%),
// uchwyt na prawej krawędzi zmienia ją jak uchwyt kolumny, a na końcu rzędu jest przycisk „Karta”.
export function PinnedCards({
  cards,
  fields,
  rows,
  today,
  onChange,
  onAdd,
  onEdit,
}: {
  cards: PinnedCard[];
  fields: PageField[];
  rows: PageRow[];
  today: string;
  // Zapis całej listy kart
  onChange: (next: PinnedCard[]) => void;
  // Okno nowej karty i okno edycji karty o danym indeksie
  onAdd: () => void;
  onEdit: (index: number) => void;
}) {
  // Przeciąganie uchwytu: szkic szerokości w stanie, a start (wskaźnik, x, szerokość, ostatnia) w refie
  const [przeciaganie, setPrzeciaganie] = React.useState<{
    i: number;
    szer: number;
  } | null>(null);
  const start = React.useRef<{
    pointerId: number;
    x: number;
    szer: number;
    aktualna: number;
  } | null>(null);
  // Otwarte menu karty (indeks) i najnowsza lista kart dla „Cofnij”
  const [menu, setMenu] = React.useState<number | null>(null);
  const najnowsze = React.useRef(cards);
  React.useEffect(() => {
    najnowsze.current = cards;
  }, [cards]);

  // Karta usunięta albo lista skrócona w trakcie przeciągania: uchwyt znika bez pointerup, więc zerujemy szkic
  if (przeciaganie && przeciaganie.i >= cards.length) setPrzeciaganie(null);

  return (
    <div
      data-testid="przypiete-karty"
      className="flex flex-wrap items-stretch gap-3"
    >
      {cards.map((card, i) => {
        // Szerokość: szkic z przeciągania, zapisana (tylko skończona i ≥ 180, całkowita, do 4000), inaczej 220
        let szerokosc = DOMYSLNA_SZEROKOSC_KARTY;
        if (przeciaganie?.i === i) {
          szerokosc = przeciaganie.szer;
        } else if (
          typeof card.width === "number" &&
          Number.isFinite(card.width) &&
          card.width >= MIN_SZEROKOSC_KARTY
        ) {
          szerokosc = Math.min(4000, Math.round(card.width));
        }
        const wynik = computeCard(card, fields, rows, today);
        // Średnia ocena bez ocen: „— / 5” jak w makiecie
        const skala =
          card.aggregation === "avg" &&
          fields.find((f) => f.id === card.field_id)?.type === "rating"
            ? "/ 5"
            : "";
        return (
          <Card
            key={i}
            data-testid="karta"
            // Telefon (< 800 px): pełna szerokość
            className="group/karta flex-[0_1_auto] px-[18px] py-4 max-[799px]:w-full!"
            style={{
              width: szerokosc,
              minWidth: MIN_SZEROKOSC_KARTY,
              maxWidth: "100%",
            }}
          >
            {/* Menu karty: widoczne po najechaniu, z fokusem albo gdy otwarte; na telefonie zawsze */}
            <div
              className={cn(
                "absolute top-2.5 right-2.5 opacity-0 transition-opacity duration-[120ms] group-hover/karta:opacity-100 focus-within:opacity-100 max-[799px]:opacity-100",
                menu === i && "opacity-100",
              )}
            >
              <ActionPopover
                open={menu === i}
                onOpenChange={(o) => setMenu(o ? i : null)}
                width={220}
                align="end"
                className="p-1"
                ariaLabel="Menu karty"
                trigger={
                  <Button
                    variant="ghost"
                    size="xs"
                    icon
                    aria-label="Menu karty"
                    aria-haspopup="menu"
                    aria-expanded={menu === i}
                  >
                    <Ellipsis aria-hidden="true" size={14} />
                  </Button>
                }
              >
                <div role="menu" aria-label="Menu karty">
                  <button
                    type="button"
                    role="menuitem"
                    className={POZYCJA}
                    onClick={() => {
                      setMenu(null);
                      onEdit(i);
                    }}
                  >
                    <Pencil
                      aria-hidden="true"
                      className="size-4 flex-none text-muted-foreground"
                    />
                    <span className="flex-1">Edytuj kartę</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={i === 0}
                    className={POZYCJA}
                    onClick={() => {
                      setMenu(null);
                      const next = [...cards];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      onChange(next);
                    }}
                  >
                    <ArrowLeft
                      aria-hidden="true"
                      className="size-4 flex-none text-muted-foreground"
                    />
                    <span className="flex-1">Przesuń w lewo</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={i === cards.length - 1}
                    className={POZYCJA}
                    onClick={() => {
                      setMenu(null);
                      const next = [...cards];
                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                      onChange(next);
                    }}
                  >
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 flex-none text-muted-foreground"
                    />
                    <span className="flex-1">Przesuń w prawo</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={card.width === undefined}
                    className={POZYCJA}
                    onClick={() => {
                      setMenu(null);
                      // Bez width karta wraca do 220 px
                      const bez = { ...card };
                      delete bez.width;
                      onChange(cards.map((c, j) => (j === i ? bez : c)));
                    }}
                  >
                    <RotateCcw
                      aria-hidden="true"
                      className="size-4 flex-none text-muted-foreground"
                    />
                    <span className="flex-1">Domyślna szerokość</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={cn(POZYCJA, MENU_ITEM_DANGER)}
                    onClick={() => {
                      setMenu(null);
                      onChange(cards.filter((_, j) => j !== i));
                      // „Cofnij” wstawia kartę na dawne miejsce w aktualnej liście
                      toast("Usunięto", {
                        action: {
                          label: "Cofnij",
                          onClick: () => {
                            const lista = [...najnowsze.current];
                            lista.splice(Math.min(i, lista.length), 0, card);
                            onChange(lista);
                          },
                        },
                      });
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-4 flex-none" />
                    <span className="flex-1">Usuń kartę</span>
                  </button>
                </div>
              </ActionPopover>
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {wynik.label}
            </div>
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
                        <span className="text-sm font-normal text-muted-foreground">
                          {wynik.sub || skala}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            {/* Uchwyt szerokości: przeciąganie (pointer events) albo ←/→ co 20 px; min. 180 px */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={`Zmień szerokość karty „${wynik.label}” (strzałki w lewo i w prawo)`}
              aria-valuenow={szerokosc}
              aria-valuemin={MIN_SZEROKOSC_KARTY}
              tabIndex={0}
              data-on={przeciaganie?.i === i}
              className={UCHWYT_KARTY}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                // preventDefault wyłącza domyślny fokus, a strzałki mają działać zaraz po kliknięciu
                e.currentTarget.focus();
                e.currentTarget.setPointerCapture(e.pointerId);
                start.current = {
                  pointerId: e.pointerId,
                  x: e.clientX,
                  szer: szerokosc,
                  aktualna: szerokosc,
                };
                setPrzeciaganie({ i, szer: szerokosc });
              }}
              onPointerMove={(e) => {
                if (!start.current || start.current.pointerId !== e.pointerId)
                  return;
                // Ruch bez wciśniętego przycisku (np. po zniknięciu uchwytu w trakcie): kończymy bez zapisu
                if (e.buttons === 0) {
                  start.current = null;
                  setPrzeciaganie(null);
                  return;
                }
                const szer = Math.min(
                  4000,
                  Math.max(
                    MIN_SZEROKOSC_KARTY,
                    Math.round(
                      start.current.szer + e.clientX - start.current.x,
                    ),
                  ),
                );
                start.current.aktualna = szer;
                setPrzeciaganie({ i, szer });
              }}
              onPointerUp={(e) => {
                if (!start.current || start.current.pointerId !== e.pointerId)
                  return;
                const { szer, aktualna } = start.current;
                start.current = null;
                setPrzeciaganie(null);
                e.currentTarget.releasePointerCapture?.(e.pointerId);
                if (aktualna !== szer)
                  onChange(
                    cards.map((c, j) =>
                      j === i ? { ...c, width: aktualna } : c,
                    ),
                  );
              }}
              // Przeglądarka zerwała capture bez pointerup: kończymy jak puszczenie (zapis, jeśli była zmiana)
              onLostPointerCapture={(e) => {
                if (!start.current || start.current.pointerId !== e.pointerId)
                  return;
                const { szer, aktualna } = start.current;
                start.current = null;
                setPrzeciaganie(null);
                if (aktualna !== szer)
                  onChange(
                    cards.map((c, j) =>
                      j === i ? { ...c, width: aktualna } : c,
                    ),
                  );
              }}
              onPointerCancel={(e) => {
                if (!start.current || start.current.pointerId !== e.pointerId)
                  return;
                start.current = null;
                setPrzeciaganie(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                const nowa = Math.min(
                  4000,
                  Math.max(
                    MIN_SZEROKOSC_KARTY,
                    szerokosc + (e.key === "ArrowRight" ? 20 : -20),
                  ),
                );
                if (nowa !== szerokosc)
                  onChange(
                    cards.map((c, j) => (j === i ? { ...c, width: nowa } : c)),
                  );
              }}
            />
          </Card>
        );
      })}
      {/* „Karta” na końcu rzędu (.addcard): widoczna także przy 0 kart */}
      <button
        type="button"
        aria-label="Dodaj kartę"
        onClick={onAdd}
        className="flex min-h-[88px] flex-[0_0_140px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/[.16] bg-transparent text-sm font-medium text-muted-foreground outline-none transition-colors hover:border-black/[.24] hover:bg-black/[.02] hover:text-foreground focus-visible:shadow-focus max-[799px]:w-full max-[799px]:flex-[1_1_100%]"
      >
        <Plus aria-hidden="true" size={16} />
        Karta
      </button>
    </div>
  );
}
