"use client";

import * as React from "react";

import { ActionPopover, Checkbox, DatePicker, type IsoDate } from "@/components/controls";
import { normalizeValue, type CellValue, type FieldOption, type PageField } from "../fields";

// Kolory plakietek z makiety (PAL): tekst → tło i ramka; inne kolory dostają półprzezroczyste tło
const TLA_PLAKIETEK: Record<string, { tlo: string; ramka: string }> = {
  "#404040": { tlo: "#f5f5f5", ramka: "#e0e0e0" },
  "#525252": { tlo: "#f5f5f5", ramka: "#e0e0e0" },
  "#0070f3": { tlo: "#eef5ff", ramka: "#cfe2ff" },
  "#15803d": { tlo: "#f0faf4", ramka: "#bbe5cc" },
  "#c2410c": { tlo: "#fff4ed", ramka: "#fed7aa" },
  "#7c3aed": { tlo: "#f5f3ff", ramka: "#ddd6fe" },
  "#b91c1c": { tlo: "#fef2f2", ramka: "#fecaca" },
};

// Kolorowa plakietka opcji Wyboru (BADGE z EmptyPage.dc.html)
export function OptionBadge({
  option,
  children,
}: {
  option: FieldOption;
  children?: React.ReactNode;
}) {
  const kolor = option.color.toLowerCase();
  const tlo = TLA_PLAKIETEK[kolor] ?? { tlo: `${option.color}14`, ramka: `${option.color}40` };
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-[4px] border px-[7px] py-0.5 font-mono text-[11px] whitespace-nowrap"
      style={{ color: option.color, background: tlo.tlo, borderColor: tlo.ramka }}
    >
      {option.label}
      {children}
    </span>
  );
}

// Tekst pola liczbowego w komórce: przecinek zamiast kropki, bez formatu waluty (edycja)
function tekstLiczby(v: CellValue): string {
  return typeof v === "number" ? String(v).replace(".", ",") : "";
}

// Komórka tabeli edytowana w miejscu: tekst/liczba/link zapisują się po utracie fokusu albo Enterze,
// checkbox kliknięciem, data po wyborze, Wybór z listy (z „Wyczyść” i „Edytuj opcje”).
export function CellEditor({
  field,
  value,
  label,
  today,
  onCommit,
  onEditOptions,
}: {
  field: PageField;
  value: unknown;
  label: string;
  today?: IsoDate;
  onCommit: (value: CellValue) => void;
  onEditOptions: () => void;
}) {
  const aktualna = normalizeValue(field, value);
  const tekstZapisany = field.type === "number" ? tekstLiczby(aktualna) : aktualna === null ? "" : String(aktualna);

  // Szkic tekstu; nowa wartość z góry (zapis, cofnięcie błędu, odświeżenie) zastępuje szkic
  const [szkic, setSzkic] = React.useState(tekstZapisany);
  const [zrodlo, setZrodlo] = React.useState(tekstZapisany);
  if (zrodlo !== tekstZapisany) {
    setZrodlo(tekstZapisany);
    setSzkic(tekstZapisany);
  }
  const [listaOtwarta, setListaOtwarta] = React.useState(false);

  if (field.type === "checkbox") {
    return (
      <Checkbox
        checked={aktualna === true}
        ariaLabel={label}
        onChange={(v) => onCommit(v)}
      />
    );
  }

  if (field.type === "date") {
    return (
      <DatePicker
        value={(aktualna as IsoDate | null) ?? null}
        onChange={(v) => onCommit(v)}
        today={today}
        ariaLabel={label}
        placeholder="—"
      />
    );
  }

  if (field.type === "status" || field.type === "select") {
    const opcje = field.config.options ?? [];
    const wybrana = opcje.find((o) => o.id === aktualna) ?? null;
    return (
      <ActionPopover
        open={listaOtwarta}
        onOpenChange={setListaOtwarta}
        width={200}
        trigger={
          <button
            type="button"
            aria-label={label}
            aria-haspopup="listbox"
            aria-expanded={listaOtwarta}
            className="inline-flex min-h-5 cursor-pointer items-center border-0 bg-transparent p-0 font-[inherit] max-[799px]:min-h-11"
          >
            {wybrana ? (
              <OptionBadge option={wybrana} />
            ) : (
              <span className="font-mono text-[#a3a3a3]">—</span>
            )}
          </button>
        }
      >
        <div role="listbox" aria-label={label} className="flex flex-col gap-px">
          {opcje.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === aktualna}
              onClick={() => {
                setListaOtwarta(false);
                if (o.id !== aktualna) onCommit(o.id);
              }}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 px-2 py-1.5 text-left font-[inherit] text-[13px] text-[#171717] hover:bg-[#f5f5f5] max-[799px]:min-h-11 ${
                o.id === aktualna ? "bg-[#f0f0f0]" : "bg-transparent"
              }`}
            >
              <OptionBadge option={o} />
              <span aria-hidden="true" className="text-[#15803d]">
                {o.id === aktualna ? "✓" : ""}
              </span>
            </button>
          ))}
          <div className="mt-1 flex justify-between border-t border-[#f0f0f0] pt-1.5">
            <button
              type="button"
              onClick={() => {
                setListaOtwarta(false);
                if (aktualna !== null) onCommit(null);
              }}
              className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 font-[inherit] text-xs text-[#404040] hover:bg-[#f5f5f5] max-[799px]:min-h-11"
            >
              Wyczyść
            </button>
            <button
              type="button"
              onClick={() => {
                setListaOtwarta(false);
                // Dymek kolumny otwieramy po zamknięciu listy — zwrot fokusu z listy zamknąłby go od razu
                setTimeout(onEditOptions, 0);
              }}
              className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 font-[inherit] text-xs text-[#404040] hover:bg-[#f5f5f5] max-[799px]:min-h-11"
            >
              Edytuj opcje
            </button>
          </div>
        </div>
      </ActionPopover>
    );
  }

  // Tekst, liczba, link (rating nie występuje w edytorze — czytamy go jak tekst)
  function zapisz() {
    let nowa = normalizeValue(field, szkic);
    // Puste pole tytułowe dostaje etykietę, tak jak po stronie serwera
    if (field.isTitle && nowa === null) nowa = field.config.empty_label ?? "Bez tytułu";
    setSzkic(field.type === "number" ? tekstLiczby(nowa) : nowa === null ? "" : String(nowa));
    if (nowa !== aktualna) onCommit(nowa);
  }

  return (
    <input
      type="text"
      inputMode={field.type === "number" ? "decimal" : undefined}
      value={szkic}
      onChange={(e) => setSzkic(e.target.value)}
      onBlur={zapisz}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      placeholder={field.isTitle ? "Bez nazwy" : ""}
      aria-label={label}
      className={`w-full min-w-0 border-0 bg-transparent p-0 font-[inherit] outline-none placeholder:text-[#a3a3a3] max-[799px]:min-h-11 ${
        field.type === "number"
          ? "text-right font-mono text-[#171717]"
          : field.type === "url"
            ? "font-mono text-[#0070f3]"
            : "text-[#171717]"
      }`}
    />
  );
}
