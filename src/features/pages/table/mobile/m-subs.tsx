"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, Plus } from "lucide-react";

import { Avatar, Button, Card, Segment, StatusBadge, type IsoDate } from "@/components/controls";
import { cn } from "@/lib/utils";
import {
  formatMoney,
  isRecurringValue,
  nextRenewal,
  normalizeValue,
  relativeDue,
  rowActive,
  rowCycle,
  type Cycle,
  type PageField,
} from "../../fields";
import { computeCard, type PageRow } from "../../table-model";
import { OptionBadge } from "../option-badge";

type Filtr = "all" | "month" | "year";

// Strona Subscriptions na telefonie (CMSubs.dc.html): nagłówek ze „Strony” i „Nowy wiersz”, tytuł 24 px,
// karty „Miesięcznie” i „Rocznie”, pasek „Najbliżej”, segment „Filtr” i lista posortowana po następnym odnowieniu.
// Dane to te same wiersze i pola co tabela webu (PageTable → renderPhone). Sumy liczy `computeCard` (sum_month /
// sum_year, tylko aktywne wiersze), a następne odnowienie, cykl i aktywność wiersza te same funkcje modelu
// co tabela i kalendarz (`nextRenewal`, `rowCycle`, `rowActive`, `relativeDue`). Filtr to tymczasowy stan klienta.
export function MSubs({
  title,
  fields,
  rows,
  today,
  menu,
  onNewRow,
  onEditRow,
}: {
  title: string;
  fields: PageField[];
  // Wiersze po filtrze i sorcie tabeli, bez usuniętych
  rows: PageRow[];
  today: IsoDate;
  // Przycisk „Więcej” (menu strony: nazwa, ikona, kolejność, kosz) między odstępem a „Nowy wiersz”
  menu?: React.ReactNode;
  onNewRow: () => void;
  onEditRow: (row: PageRow) => void;
}) {
  const [filtr, setFiltr] = React.useState<Filtr>("all");

  const kwotaPole = fields.find((f) => f.type === "recurring");
  const odnowieniePole = fields.find((f) => f.type === "renewal");
  const tytulowe = fields.find((f) => f.isTitle);
  const kategoriaPole = fields.find((f) => f.type === "select" || f.type === "status");

  // Sumy z modelu kart (aktywne wiersze według „Tylko gdy zaznaczone” pola Data odnowienia)
  const sumaMiesiac = kwotaPole
    ? computeCard({ label: "", field_id: kwotaPole.id, aggregation: "sum_month" }, fields, rows, today)
    : null;
  const sumaRok = kwotaPole
    ? computeCard({ label: "", field_id: kwotaPole.id, aggregation: "sum_year" }, fields, rows, today)
    : null;

  // Jedna pozycja listy: wszystko, co wiersz pokazuje, liczone funkcjami modelu
  const pozycje = rows.map((wiersz) => {
    const nazwaSurowa = tytulowe ? normalizeValue(tytulowe, wiersz.values[tytulowe.id]) : null;
    const nazwa =
      typeof nazwaSurowa === "string" && nazwaSurowa.trim() !== ""
        ? nazwaSurowa
        : (tytulowe?.config.empty_label ?? "Bez nazwy");
    const kwota = kwotaPole ? normalizeValue(kwotaPole, wiersz.values[kwotaPole.id]) : null;
    const kotwica = odnowieniePole ? normalizeValue(odnowieniePole, wiersz.values[odnowieniePole.id]) : null;
    const cykl: Cycle = odnowieniePole
      ? rowCycle(odnowieniePole, fields, wiersz.values)
      : isRecurringValue(kwota)
        ? kwota.cycle
        : "month";
    const aktywny = odnowieniePole ? rowActive(odnowieniePole, fields, wiersz.values) : true;
    const nastepne = odnowieniePole && typeof kotwica === "string" ? nextRenewal(kotwica, cykl, today) : null;
    const czas = nastepne === null ? null : relativeDue(nastepne, today);
    const opcjaId = kategoriaPole ? normalizeValue(kategoriaPole, wiersz.values[kategoriaPole.id]) : null;
    const kategoria = (kategoriaPole?.config.options ?? []).find((o) => o.id === opcjaId);
    return {
      wiersz,
      nazwa,
      kwota: isRecurringValue(kwota) ? kwota : null,
      cykl,
      aktywny,
      nastepne,
      czas,
      kategoria,
    };
  });

  // Sort po następnym odnowieniu (bez daty na końcu); remis zostawia kolejność tabeli
  const posortowane = pozycje
    .slice()
    .sort((a, b) => (a.nastepne === null ? (b.nastepne === null ? 0 : 1) : b.nastepne === null ? -1 : a.nastepne < b.nastepne ? -1 : a.nastepne > b.nastepne ? 1 : 0));
  const lista = posortowane.filter((p) => filtr === "all" || p.cykl === filtr);
  // Najbliższe odnowienie: pierwszy aktywny wiersz z datą (jak karta „Najbliższe odnowienie”)
  const najblizszy = posortowane.find((p) => p.aktywny && p.nastepne !== null) ?? null;

  return (
    <div className="-mx-4 -mt-2 flex flex-col">
      <header className="m-head border-b-0 px-2">
        <Button variant="ghost" icon asChild>
          <Link href="/strony" aria-label="Strony">
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
        </Button>
        <div className="flex-1" />
        {menu}
        <Button variant="ghost" icon aria-label="Nowy wiersz" onClick={onNewRow}>
          <Plus size={20} aria-hidden="true" />
        </Button>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-6">
        <h1 className="m-0 text-2xl font-semibold tracking-[-0.011em]">{title}</h1>

        {/* Dwie karty sum: .lbl + 20/600 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="px-4 py-3.5">
            <div className="text-xs font-medium text-muted-foreground">Miesięcznie</div>
            <div className="mt-1.5 text-xl font-semibold tracking-[-0.02em] tabular-nums">
              {sumaMiesiac ? `${sumaMiesiac.value} zł` : "—"}
            </div>
          </Card>
          <Card className="px-4 py-3.5">
            <div className="text-xs font-medium text-muted-foreground">Rocznie</div>
            <div className="mt-1.5 text-xl font-semibold tracking-[-0.02em] tabular-nums">
              {sumaRok ? `${sumaRok.value} zł` : "—"}
            </div>
          </Card>
        </div>

        {/* Pasek „Najbliżej”: ikona kalendarza, nazwa i kwota, plakietka z czasem do odnowienia */}
        <Card className="flex-row items-center gap-3 bg-black/[.025] px-3.5 py-3">
          <CalendarDays size={18} aria-hidden="true" className="flex-none text-muted-foreground" />
          {najblizszy === null || najblizszy.czas === null ? (
            <span className="flex-1 text-sm">Brak odnowień</span>
          ) : (
            <>
              <span className="min-w-0 flex-1 text-sm">
                Najbliżej:{" "}
                <b className="font-semibold">
                  {najblizszy.nazwa}
                  {najblizszy.kwota && ` · ${formatMoney(najblizszy.kwota.amount)} zł`}
                </b>
              </span>
              <StatusBadge tone="orange" className="flex-none tabular-nums">
                {najblizszy.czas.text}
              </StatusBadge>
            </>
          )}
        </Card>

        <Segment
          ariaLabel="Filtr"
          value={filtr}
          onChange={setFiltr}
          options={[
            { value: "all", label: "Wszystkie" },
            { value: "month", label: "Miesięczne" },
            { value: "year", label: "Roczne" },
          ]}
        />

        {lista.length === 0 ? (
          <p className="m-0 text-center text-xs text-muted-foreground">
            {rows.length === 0 ? "Brak subskrypcji. Dodaj pierwszą przyciskiem +." : "Brak subskrypcji w tym filtrze."}
          </p>
        ) : (
          <Card className="overflow-hidden">
            {lista.map((p) => (
              <button
                key={p.wiersz.id}
                type="button"
                onClick={() => onEditRow(p.wiersz)}
                className={cn(
                  "m-row w-full cursor-pointer bg-transparent py-2.5 text-left font-[inherit] hover:bg-black/[.02]",
                  !p.aktywny && "opacity-55",
                )}
              >
                <Avatar initials={p.nazwa.charAt(0).toUpperCase()} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.nazwa}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                    {p.nastepne === null || p.czas === null ? (
                      <span>brak daty</span>
                    ) : (
                      <>
                        <span>{`${p.nastepne.slice(8, 10)}.${p.nastepne.slice(5, 7)}`}</span>
                        <span aria-hidden="true">·</span>
                        {p.aktywny ? (
                          // Do 7 dni na czerwono (--destructive-foreground), jak w makiecie
                          <span className={cn(p.czas.days <= 7 && "text-destructive-foreground")}>{p.czas.text}</span>
                        ) : (
                          <StatusBadge tone="gray">anulowana</StatusBadge>
                        )}
                      </>
                    )}
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1">
                  <span className="font-semibold tabular-nums">
                    {p.kwota ? `${formatMoney(p.kwota.amount)} zł/${p.kwota.cycle === "year" ? "r" : "m"}` : "—"}
                  </span>
                  {p.kategoria && <OptionBadge option={p.kategoria} />}
                </span>
              </button>
            ))}
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground tabular-nums">
          {/* „N z M subskrypcji”: po „z” zawsze dopełniacz liczby mnogiej */}
          {`${lista.length} z ${rows.length} subskrypcji`}
        </div>
      </div>
    </div>
  );
}
