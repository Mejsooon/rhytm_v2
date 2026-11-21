"use client";

import * as React from "react";

import {
  ActionPopover,
  Button,
  Checkbox,
  DatePicker,
  MENU_ITEM,
  MENU_SEPARATOR,
  type IsoDate,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { normalizeValue, type CellValue, type FieldOption, type PageField } from "../fields";

// Kolory plakietek (dane wybrane przez użytkownika — zostają jak są): tekst → tło; inne kolory dostają półprzezroczyste tło.
// Kształt jak .bdg z coss.css (18 px, promień 6 px, bez widocznej ramki).
// Szary z palety (#525252) ma tekst #404040 jak plakietki w Books / Projects.dc.html
const TLA_PLAKIETEK: Record<string, { tlo: string; ramka: string; tekst?: string }> = {
  "#404040": { tlo: "#f5f5f5", ramka: "#e0e0e0" },
  "#525252": { tlo: "#f5f5f5", ramka: "#e0e0e0", tekst: "#404040" },
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
      className="inline-flex h-[18px] items-center justify-center gap-1 rounded-sm border border-transparent px-[5px] text-xs leading-none font-medium whitespace-nowrap"
      style={{ color: tlo.tekst ?? option.color, background: tlo.tlo }}
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
  const bezZwrotuFokusu = React.useRef(false);

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
        variant="bare"
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
        width={210}
        className="p-1"
        onCloseAutoFocus={(e) => {
          if (bezZwrotuFokusu.current) {
            e.preventDefault();
            bezZwrotuFokusu.current = false;
          }
        }}
        trigger={
          <button
            type="button"
            aria-label={label}
            aria-haspopup="listbox"
            aria-expanded={listaOtwarta}
            className="inline-flex min-h-[22px] cursor-pointer items-center rounded-sm border-0 bg-transparent p-0 font-[inherit] outline-none focus-visible:shadow-focus max-[799px]:min-h-11"
          >
            {wybrana ? (
              <OptionBadge option={wybrana} />
            ) : (
              <span className="text-faint-foreground">—</span>
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
              className={cn(MENU_ITEM, "justify-between", o.id === aktualna && "bg-active")}
            >
              <OptionBadge option={o} />
              <span aria-hidden="true" className="text-sm">
                {o.id === aktualna ? "✓" : ""}
              </span>
            </button>
          ))}
          <div className={MENU_SEPARATOR} />
          <div className="flex justify-between">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setListaOtwarta(false);
                if (aktualna !== null) onCommit(null);
              }}
              className="text-muted-foreground max-[799px]:h-11"
            >
              Wyczyść
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setListaOtwarta(false);
                // Bez zwrotu fokusu na komórkę — zamknąłby on od razu otwierany dymek kolumny
                bezZwrotuFokusu.current = true;
                onEditOptions();
              }}
              className="max-[799px]:h-11"
            >
              Edytuj opcje
            </Button>
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
      // .ed-in: bez ramki, po fokusie delikatne tło i obrys; liczby do prawej z tabular-nums
      className={`w-full min-w-0 rounded-md border-0 bg-transparent p-0 font-[inherit] outline-none placeholder:text-faint-foreground focus:bg-black/[.02] focus:shadow-focus max-[799px]:min-h-11 ${
        field.type === "number"
          ? "text-right text-foreground tabular-nums"
          : field.type === "url"
            ? "text-info-foreground"
            : "text-foreground"
      }`}
    />
  );
}
