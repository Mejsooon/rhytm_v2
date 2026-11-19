"use client";

import * as React from "react";

import {
  ActionPopover,
  Chip,
  DatePicker,
  Dropdown,
  TextField,
  type IsoDate,
} from "@/components/controls";
import type { PageField } from "../fields";
import { operatorsFor, type FilterCond } from "../table-model";

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
};

// Web: jeden wiersz siatki na warunek (jak w makiecie); telefon: warunek jako karta z polem i ✕ w jednym rzędzie
const SIATKA = "flex flex-col gap-2 min-[800px]:gap-1.5";
const WARUNEK =
  "grid items-center gap-1.5 min-[800px]:grid-cols-[54px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_30px] max-[799px]:grid-cols-[minmax(0,1fr)_44px] max-[799px]:rounded-lg max-[799px]:border max-[799px]:border-[#eaeaea] max-[799px]:p-2";

// Filtr tabeli z FilterPopover.dc.html: warunki „Gdzie … i …”, operatory zależne od typu pola,
// licznik „x z N wierszy”, „Wyczyść” i „Zapisz jako domyślny”. Zmiany idą do stanu klienta —
// zapisuje je dopiero „Zapisz jako domyślny”. Wyzwalaczem jest przycisk „Filtruj” w nagłówku strony.
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
  triggerClassName,
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
  triggerClassName: string;
}) {
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

  return (
    <ActionPopover
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      ariaLabel="Filtr"
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`${triggerClassName} ${open ? "!bg-[#f0f0f0]" : ""}`}
        >
          {warunki.length > 0 ? `Filtruj · ${warunki.length}` : "Filtruj"}
        </button>
      }
    >
      <div className="flex w-[min(540px,calc(100vw-48px))] flex-col gap-2.5 p-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Filtr</span>
          <span className="font-mono text-xs text-[#6b6b6b]">
            {shown} z {total} {total === 1 ? "wiersza" : "wierszy"}
          </span>
        </div>

        <div className={SIATKA}>
          {warunki.map(({ c, i, pole }, n) => {
            const operatory = operatorsFor(pole.type);
            const opcje = pole.config.options ?? [];
            const nazwaWartosci = `Wartość warunku ${n + 1}`;
            return (
              <div key={i} className={WARUNEK}>
                <span className="font-mono text-xs text-[#6b6b6b] max-[799px]:col-span-2">
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
                        zmien(i, { op: op as FilterCond["op"], value: undefined });
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
                  ) : c.op === "empty" || c.op === "not_empty" ? null : c.op === "in" ? (
                    <div
                      role="group"
                      aria-label={nazwaWartosci}
                      className="flex flex-wrap gap-1 rounded-md border border-[#e0e0e0] bg-white px-1.5 py-[5px]"
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
                  ) : pole.type === "date" ? (
                    <DatePicker
                      size="sm"
                      ariaLabel={nazwaWartosci}
                      today={today}
                      value={typeof c.value === "string" ? (c.value as IsoDate) : null}
                      onChange={(d) => zmien(i, { value: d ?? undefined })}
                    />
                  ) : pole.type === "number" || pole.type === "rating" ? (
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
                  ) : (
                    <TextField
                      label={<span className="sr-only">{nazwaWartosci}</span>}
                      value={typeof c.value === "string" ? c.value : ""}
                      onChange={(e) => zmien(i, { value: e.target.value })}
                    />
                  )}
                </div>

                <button
                  type="button"
                  aria-label="Usuń warunek"
                  onClick={() => {
                    setSzkice({});
                    onChange(filters.filter((_, j) => j !== i));
                  }}
                  className="cursor-pointer border-0 bg-transparent text-[#6b6b6b] max-[799px]:order-2 max-[799px]:min-h-11"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-[#eaeaea] pt-2.5">
          <button
            type="button"
            onClick={() => dodaj(fields[0])}
            className="cursor-pointer rounded-md border border-[#e0e0e0] bg-white px-3 py-[7px] font-[inherit] text-[13px] text-[#171717] max-[799px]:min-h-11"
          >
            + Dodaj warunek
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSzkice({});
                onChange([]);
              }}
              className="cursor-pointer rounded-md border border-[#e0e0e0] bg-white px-3 py-[7px] font-[inherit] text-[13px] text-[#171717] max-[799px]:min-h-11"
            >
              Wyczyść
            </button>
            <button
              type="button"
              onClick={onSave}
              className="cursor-pointer rounded-md border border-[#171717] bg-[#171717] px-3 py-[7px] font-[inherit] text-[13px] font-medium text-white max-[799px]:min-h-11"
            >
              Zapisz jako domyślny
            </button>
          </div>
        </div>
        <p className="m-0 font-mono text-[11px] text-[#6b6b6b]">
          Filtr zmienia tabelę i sumy. Nie wpływa na kalendarz.
        </p>
      </div>
    </ActionPopover>
  );
}
