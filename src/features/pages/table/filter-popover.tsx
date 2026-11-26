"use client";

import * as React from "react";
import { Funnel, ListFilter, Plus, X } from "lucide-react";

import {
  ActionPopover,
  Button,
  Card,
  Chip,
  DatePicker,
  Dropdown,
  FIELD,
  FormDialog,
  Segment,
  StatusBadge,
  TextField,
  type IsoDate,
} from "@/components/controls";
import type { PageField } from "../fields";
import { cn } from "@/lib/utils";
import { operatorsFor, type FilterCond, type SortKey } from "../table-model";
import { PLAKIETKA } from "./table-toolbar";

// Nazwy operatorów w liście „Operator” (makieta: „jest”, „jest jednym z”, „≥”); dla Checkboxa
// operator to zawsze „jest”, a wartość („zaznaczone” / „niezaznaczone”) wybiera op
const NAZWY_OPERATOROW: Record<FilterCond["op"], string> = {
  checked: "jest",
  unchecked: "jest",
  in: "jest jednym z",
  gte: "≥",
  lte: "≤",
  contains: "zawiera",
  before: "przed",
  after: "po",
  empty: "jest puste",
  not_empty: "nie jest puste",
  within_days: "w ciągu dni",
  this_year: "w tym roku",
  not_in: "nie jest żadnym z",
  not_equals: "nie jest równe",
};

// Web: jeden wiersz siatki na warunek (jak w makiecie); telefon: warunek jako karta z polem i ✕ w jednym rzędzie
const SIATKA = "flex flex-col gap-2 min-[800px]:gap-3";
const WARUNEK =
  "grid items-center gap-1.5 min-[800px]:grid-cols-[48px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_32px] max-[799px]:grid-cols-[minmax(0,1fr)_44px] max-[799px]:rounded-lg max-[799px]:border max-[799px]:border-border max-[799px]:p-2";

// Telefon (poniżej 800 px) według mediów; po stronie serwera i w testach (bez matchMedia) false = dymek weba
function subskrybujTelefon(wywolaj: () => void) {
  const mq = window.matchMedia("(max-width: 799px)");
  mq.addEventListener?.("change", wywolaj);
  return () => mq.removeEventListener?.("change", wywolaj);
}
function czyTelefon() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 799px)").matches;
}

// Filtr tabeli z FilterPopover.dc.html: warunki „Gdzie … i …”, operatory zależne od typu pola,
// licznik „x z N wierszy”, „Wyczyść” i „Zapisz jako domyślny”. Zmiany idą do stanu klienta —
// zapisuje je dopiero „Zapisz jako domyślny”. Wyzwalaczem jest przycisk „Filtruj” w nagłówku strony.
// Telefon (CMFilterSheet): przycisk „Filtr i sortowanie” 44 px i arkusz „Wyczyść · Filtr i sortowanie · Gotowe”
// z warunkami (te same kontrolki co w dymku), sortowaniem (pole + „Rosnąco / Malejąco”) i „Zapisz jako domyślny”.
export function FilterPopover({
  fields,
  filters,
  today,
  shown,
  total,
  open,
  onOpenChange,
  onChange,
  onSave,
  onSaveAsView,
  triggerClassName,
  sort,
  onSortChange,
}: {
  fields: PageField[];
  filters: FilterCond[];
  today: IsoDate;
  // Wiersze po filtrze i wszystkie (bez usuniętych)
  shown: number;
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (filters: FilterCond[]) => void;
  onSave: () => void;
  // „Zapisz jako widok”: nowy zapisany widok z bieżącymi warunkami (bez tej funkcji przycisku nie ma)
  onSaveAsView?: () => void;
  triggerClassName: string;
  // Telefon: klucze sortowania tabeli i ich zmiana (zapis od razu, jak w menu „⋯” tabeli); bez nich arkusz nie ma sekcji sortowania
  sort?: SortKey[];
  onSortChange?: (sort: SortKey[]) => void;
}) {
  const telefon = React.useSyncExternalStore(
    (wywolaj) => (typeof window.matchMedia === "function" ? subskrybujTelefon(wywolaj) : () => {}),
    czyTelefon,
    () => false,
  );
  // Teksty liczb w trakcie wpisywania (np. „20,”) — wartość warunku trzyma już liczbę
  const [szkice, setSzkice] = React.useState<Record<number, string>>({});

  const warunki = filters.flatMap((c, i) => {
    const pole = fields.find((f) => f.id === c.field_id);
    return pole ? [{ c, i, pole }] : [];
  });

  function zmien(i: number, patch: Partial<FilterCond>) {
    onChange(filters.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  function dodaj(pole: PageField | undefined) {
    if (!pole) return;
    onChange([...filters, { field_id: pole.id, op: operatorsFor(pole.type)[0] }]);
  }

  const listaWarunkow = (
    <>
        <div className={SIATKA}>
          {warunki.map(({ c, i, pole }, n) => {
            const operatory = operatorsFor(pole.type);
            const opcje = pole.config.options ?? [];
            const nazwaWartosci = `Wartość warunku ${n + 1}`;
            return (
              <div key={i} className={WARUNEK}>
                <span className="text-xs font-medium text-muted-foreground max-[799px]:col-span-2 min-[800px]:pr-1 min-[800px]:text-right">
                  {n === 0 ? "Gdzie" : "i"}
                </span>
                <div className="min-w-0 max-[799px]:order-1">
                  <Dropdown
                    ariaLabel={`Pole warunku ${n + 1}`}
                    value={pole.id}
                    onChange={(id) => {
                      const nowe = fields.find((f) => f.id === id);
                      if (!nowe || nowe.id === pole.id) return;
                      setSzkice({});
                      zmien(i, { field_id: nowe.id, op: operatorsFor(nowe.type)[0], value: undefined });
                    }}
                    options={fields.map((f) => ({ value: f.id, label: f.name }))}
                  />
                </div>
                <div className="min-w-0 max-[799px]:order-3 max-[799px]:col-span-2">
                  {pole.type === "checkbox" ? (
                    <Dropdown
                      ariaLabel={`Operator warunku ${n + 1}`}
                      value="jest"
                      onChange={() => {}}
                      options={[{ value: "jest", label: "jest" }]}
                    />
                  ) : (
                    <Dropdown
                      ariaLabel={`Operator warunku ${n + 1}`}
                      value={c.op}
                      onChange={(op) => {
                        setSzkice({});
                        // Nowy operator zaczyna od pustej wartości; „w ciągu dni” od 14 dni
                        zmien(i, { op: op as FilterCond["op"], value: op === "within_days" ? 14 : undefined });
                      }}
                      options={operatory.map((op) => ({ value: op, label: NAZWY_OPERATOROW[op] }))}
                    />
                  )}
                </div>

                <div className="min-w-0 max-[799px]:order-4 max-[799px]:col-span-2">
                  {pole.type === "checkbox" ? (
                    <Dropdown
                      ariaLabel={nazwaWartosci}
                      value={c.op}
                      onChange={(op) => zmien(i, { op: op as FilterCond["op"] })}
                      options={[
                        { value: "checked", label: "zaznaczone" },
                        { value: "unchecked", label: "niezaznaczone" },
                      ]}
                    />
                  ) : c.op === "empty" || c.op === "not_empty" || c.op === "this_year" ? null : c.op === "in" ||
                    c.op === "not_in" ? (
                    <div
                      role="group"
                      aria-label={nazwaWartosci}
                      className={cn(FIELD, "flex h-auto min-h-8 flex-wrap items-center gap-1 px-1.5 py-1 max-[799px]:h-auto max-[799px]:min-h-11")}
                    >
                      {opcje.map((o) => {
                        const wybrane = Array.isArray(c.value) && c.value.includes(o.id);
                        return (
                          <Chip
                            key={o.id}
                            selected={wybrane}
                            onClick={() => {
                              const obecne = Array.isArray(c.value) ? (c.value as string[]) : [];
                              zmien(i, {
                                value: wybrane ? obecne.filter((id) => id !== o.id) : [...obecne, o.id],
                              });
                            }}
                          >
                            {o.label}
                          </Chip>
                        );
                      })}
                    </div>
                  ) : c.op === "within_days" ? (
                    // Liczba dni od dziś (co najmniej 1); puste pole zostawia poprzednią wartość w warunku
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        aria-label={nazwaWartosci}
                        value={szkice[i] ?? (typeof c.value === "number" ? String(c.value) : "")}
                        onChange={(e) => {
                          const tekst = e.target.value;
                          setSzkice((s) => ({ ...s, [i]: tekst }));
                          const liczba = Math.round(Number(tekst));
                          if (tekst.trim() !== "" && Number.isFinite(liczba) && liczba >= 1) zmien(i, { value: liczba });
                        }}
                        className={cn(FIELD, "min-w-0 flex-1 font-mono")}
                      />
                      <span className="flex-none text-[13px] whitespace-nowrap text-muted-foreground">dni</span>
                    </div>
                  ) : pole.type === "date" || pole.type === "renewal" ? (
                    <DatePicker
                      size="sm"
                      ariaLabel={nazwaWartosci}
                      today={today}
                      value={typeof c.value === "string" ? (c.value as IsoDate) : null}
                      onChange={(d) => zmien(i, { value: d ?? undefined })}
                    />
                  ) : pole.type === "number" || pole.type === "rating" || pole.type === "recurring" ? (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <TextField
                          label={<span className="sr-only">{nazwaWartosci}</span>}
                          inputMode="decimal"
                          className="font-mono"
                          value={
                            szkice[i] ??
                            (typeof c.value === "number" ? String(c.value).replace(".", ",") : "")
                          }
                          onChange={(e) => {
                            const tekst = e.target.value;
                            setSzkice((s) => ({ ...s, [i]: tekst }));
                            const liczba = Number(tekst.trim().replace(",", "."));
                            zmien(i, {
                              value: tekst.trim() !== "" && Number.isFinite(liczba) ? liczba : undefined,
                            });
                          }}
                        />
                      </div>
                      {/* Kwota cykliczna porównuje się na kwocie przeliczonej na miesiąc */}
                      {pole.type === "recurring" && (
                        <span className="flex-none text-[13px] whitespace-nowrap text-muted-foreground">zł / mies.</span>
                      )}
                    </div>
                  ) : (
                    <TextField
                      label={<span className="sr-only">{nazwaWartosci}</span>}
                      value={typeof c.value === "string" ? c.value : ""}
                      onChange={(e) => zmien(i, { value: e.target.value })}
                    />
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  aria-label="Usuń warunek"
                  onClick={() => {
                    setSzkice({});
                    onChange(filters.filter((_, j) => j !== i));
                  }}
                  className="max-[799px]:order-2 max-[799px]:h-11 max-[799px]:w-11"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>

    </>
  );
  const brakWarunkow = (
    <>
        {/* .empty z paddingiem 18 px: stan bez warunków */}
        {warunki.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-[18px] text-center">
            Brak warunków. Tabela pokazuje wszystkie wiersze.
          </div>
        )}

    </>
  );

  // Telefon: arkusz zamiast dymku
  if (telefon) {
    const wolneDoSortu = fields.filter((f) => !(sort ?? []).some((k) => k.field_id === f.id));
    return (
      <>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => onOpenChange(true)}
          className={cn(triggerClassName, "max-[799px]:h-11", open && "bg-accent")}
        >
          <ListFilter aria-hidden="true" className="size-4 flex-none opacity-80" />
          Filtr i sortowanie
        </button>
        <FormDialog
          open={open}
          onOpenChange={onOpenChange}
          title="Filtr i sortowanie"
          phoneHeader="actions"
          phoneCancel={{
            label: "Wyczyść",
            onClick: () => {
              setSzkice({});
              onChange([]);
            },
          }}
          phoneSubmit={
            <Button variant="primary" onClick={() => onOpenChange(false)}>
              Gotowe
            </Button>
          }
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Filtr</span>
              <StatusBadge tone="gray" className="font-mono">
                {shown} z {total} {total === 1 ? "wiersza" : "wierszy"}
              </StatusBadge>
            </div>
            {listaWarunkow}
            {warunki.length === 0 && (
              <p className="m-0 text-xs text-muted-foreground">Brak warunków. Tabela pokazuje wszystkie wiersze.</p>
            )}
            <Button onClick={() => dodaj(fields[0])} className="border-dashed shadow-none">
              <Plus aria-hidden="true" className="size-4" />
              Dodaj warunek
            </Button>
            <span className="text-xs text-muted-foreground">Filtr zmienia tabelę i sumy. Nie wpływa na kalendarz.</span>
          </div>
          {sort && onSortChange && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Sortowanie</span>
              {sort.length > 0 && (
                <Card className="overflow-hidden">
                  {sort.map((klucz, i) => {
                    const pole = fields.find((f) => f.id === klucz.field_id);
                    if (!pole) return null;
                    return (
                      <div key={klucz.field_id} className="m-row py-1.5">
                        <span className="min-w-0 flex-1 truncate">{pole.name}</span>
                        <div className="w-[200px] flex-none">
                          <Segment
                            ariaLabel={`Kierunek sortowania: ${pole.name}`}
                            value={klucz.dir}
                            options={[
                              { value: "asc", label: "Rosnąco" },
                              { value: "desc", label: "Malejąco" },
                            ]}
                            onChange={(dir) =>
                              onSortChange(sort.map((k, j) => (j === i ? { field_id: k.field_id, dir } : k)))
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          icon
                          aria-label={`Usuń sortowanie: ${pole.name}`}
                          onClick={() => onSortChange(sort.filter((_, j) => j !== i))}
                        >
                          <X aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </Card>
              )}
              {sort.length === 0 && <p className="m-0 text-xs text-muted-foreground">Wiersze w kolejności dodania.</p>}
              <Button
                disabled={wolneDoSortu.length === 0}
                onClick={() => onSortChange([...sort, { field_id: wolneDoSortu[0].id, dir: "asc" }])}
                className="border-dashed shadow-none"
              >
                <Plus aria-hidden="true" className="size-4" />
                Dodaj sortowanie
              </Button>
              <Button variant="ghost" onClick={onSave} className="self-start px-1">
                Zapisz jako domyślny
              </Button>
            </div>
          )}
        </FormDialog>
      </>
    );
  }

  return (
    <ActionPopover
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      ariaLabel="Filtr"
      // Dymek wg .pop: padding 14 px (cn = twMerge nadpisuje domyślne 10 px)
      className="p-3.5"
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          // Nazwa z liczbą warunków (plakietka sama nie czyta się jako część nazwy)
          aria-label={warunki.length > 0 ? `Filtruj · ${warunki.length}` : undefined}
          // Otwarty filtr: tło jak aria-expanded na przycisku w makiecie (rgba(0,0,0,.04))
          className={cn(triggerClassName, open && "bg-accent")}
        >
          <Funnel aria-hidden="true" className="size-3.5 flex-none" />
          Filtruj
          {warunki.length > 0 && <span className={PLAKIETKA}>{warunki.length}</span>}
        </button>
      }
    >
      <div className="flex w-[min(600px,calc(100vw-48px))] flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Filtr</span>
          <StatusBadge tone="gray" className="font-mono">
            {shown} z {total} {total === 1 ? "wiersza" : "wierszy"}
          </StatusBadge>
        </div>

        {listaWarunkow}
        {brakWarunkow}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button
            size="sm"
            onClick={() => dodaj(fields[0])}
            className="max-[799px]:h-11"
          >
            + Dodaj warunek
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSzkice({});
                onChange([]);
              }}
              className="max-[799px]:h-11"
            >
              Wyczyść
            </Button>
            {onSaveAsView && (
              <Button size="sm" onClick={onSaveAsView} className="max-[799px]:h-11">
                Zapisz jako widok
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onSave} className="max-[799px]:h-11">
              Zapisz jako domyślny
            </Button>
          </div>
        </div>
        <p className="m-0 text-xs text-muted-foreground">
          Filtr zmienia tabelę i sumy. Nie wpływa na kalendarz.
        </p>
      </div>
    </ActionPopover>
  );
}
