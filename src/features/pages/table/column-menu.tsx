"use client";

import * as React from "react";

import { ActionPopover } from "@/components/controls";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_META, type FieldType, type PageField } from "../fields";
import { summaryOptions, type ColumnSummary, type SummaryKind } from "../table-model";
import { NAZWY_PODSUMOWAN } from "./summary-cell";

const POZYCJA =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-[7px] text-left font-[inherit] text-[13px] text-[#171717] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent max-[799px]:min-h-11";
const IKONA = "w-[18px] font-mono text-[#6b6b6b]";
const PODZIAL = "mx-1 my-1.5 h-px bg-[#eaeaea]";
const PODMENU =
  "absolute top-0 left-[calc(100%+16px)] z-10 w-[210px] rounded-[10px] border border-[#e0e0e0] bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.12),0_2px_6px_rgba(0,0,0,.06)] max-[799px]:static max-[799px]:mt-1 max-[799px]:w-auto max-[799px]:shadow-none";

// Menu kolumny z ColumnMenu.dc.html: nazwa, „Typ: … ›”, sort, „Filtruj po tym polu”, „Podsumowanie … ›”,
// „Pokaż w kalendarzu” (tylko Data), „Ukryj kolumnę” i „Usuń pole”. Wyzwalaczem jest nagłówek kolumny;
// podmenu (typy, podsumowania) otwierają się obok menu, na telefonie pod pozycją.
export function ColumnMenu({
  field,
  open,
  onOpenChange,
  canHide,
  summary,
  onRename,
  onPickType,
  onSort,
  onFilter,
  onSummary,
  onToggleCalendar,
  onHide,
  onDelete,
  onCloseAutoFocus,
}: {
  field: PageField;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Ukryć można, dopóki zostaje choć jedna widoczna kolumna
  canHide: boolean;
  summary: ColumnSummary | undefined;
  onRename: (name: string) => void;
  onPickType: (type: FieldType) => void;
  onSort: (dir: "asc" | "desc") => void;
  onFilter: () => void;
  onSummary: (kind: SummaryKind) => void;
  onToggleCalendar: () => void;
  onHide: () => void;
  onDelete: () => void;
  // Pozwala wyłączyć zwrot fokusu na nagłówek (gdy zaraz otwiera się filtr)
  onCloseAutoFocus?: (e: Event) => void;
}) {
  const [podmenu, setPodmenu] = React.useState<"typ" | "podsumowanie" | null>(null);
  const [nazwa, setNazwa] = React.useState(field.name);
  const [zrodloNazwy, setZrodloNazwy] = React.useState(field.name);
  if (zrodloNazwy !== field.name) {
    setZrodloNazwy(field.name);
    setNazwa(field.name);
  }

  const meta = FIELD_TYPE_META[field.type];
  const wKalendarzu = field.config.show_in_calendar === true;

  // Aktualne podsumowanie: rodzaj ogólny albo szablonowe (licznik opcji / roku) z własną etykietą
  let aktualne = "Brak";
  if (summary?.kind === "count_option") {
    const opcja = (field.config.options ?? []).find((o) => o.id === summary.option_id);
    aktualne = opcja ? `Liczba: ${opcja.label}` : "Liczba opcji";
  } else if (summary?.kind === "count_in_year") {
    aktualne = "Liczba w roku";
  } else if (summary) {
    aktualne = NAZWY_PODSUMOWAN[summary.kind as SummaryKind] ?? "Brak";
  }

  // Nazwa już wysłana (blur i zamknięcie menu nie zapisują jej dwa razy)
  const wyslana = React.useRef<string | null>(null);
  React.useEffect(() => {
    wyslana.current = null;
  }, [field.name]);

  function zapiszNazwe() {
    const czysta = nazwa.trim();
    if (czysta === "" || czysta === field.name) {
      setNazwa(field.name);
      return;
    }
    if (czysta === wyslana.current) return;
    wyslana.current = czysta;
    onRename(czysta);
  }

  // Po wybraniu pozycji dymek się zamyka (zwrot fokusu na nagłówek zostaje domyślny)
  function wykonaj(akcja: () => void) {
    setPodmenu(null);
    onOpenChange(false);
    akcja();
  }

  return (
    <ActionPopover
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPodmenu(null);
          zapiszNazwe();
        }
        onOpenChange(o);
      }}
      width={250}
      onCloseAutoFocus={onCloseAutoFocus}
      ariaLabel={`Kolumna ${field.name}`}
      trigger={
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] font-medium text-[#666666] max-[799px]:min-h-11"
        >
          <span aria-hidden="true" className="mr-1.5 font-mono text-[#6b6b6b]">
            {meta.icon}
          </span>
          {field.name}
        </button>
      }
    >
      <div role="menu" aria-label={`Kolumna ${field.name}`} className="relative">
        <input
          type="text"
          value={nazwa}
          onChange={(e) => setNazwa(e.target.value)}
          onBlur={zapiszNazwe}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          aria-label="Nazwa kolumny"
          className="mb-1.5 box-border w-full rounded-md border border-[#e0e0e0] bg-white px-2.5 py-2 font-[inherit] text-[13px] text-[#171717] outline-none focus:border-[#171717] max-[799px]:min-h-11"
        />

        <div className="relative">
          <button
            type="button"
            role="menuitem"
            disabled={field.isTitle}
            aria-label={`Typ: ${meta.label} ›`}
            aria-haspopup="menu"
            aria-expanded={podmenu === "typ"}
            onClick={() => setPodmenu(podmenu === "typ" ? null : "typ")}
            className={`${POZYCJA} ${podmenu === "typ" ? "bg-[#f5f5f5]" : ""}`}
          >
            <span aria-hidden="true" className={IKONA}>
              {meta.icon}
            </span>
            <span className="flex-1">Typ: {meta.label}</span>
            <span aria-hidden="true" className="font-mono text-[11px] text-[#6b6b6b]">
              ›
            </span>
          </button>
          {podmenu === "typ" && (
            <div role="menu" aria-label="Typ pola" className={PODMENU}>
              <div className="px-2.5 pt-1.5 pb-1 font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase">
                Typ pola
              </div>
              {(Object.keys(FIELD_TYPE_META) as FieldType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (t === field.type) {
                      setPodmenu(null);
                      return;
                    }
                    wykonaj(() => onPickType(t));
                  }}
                  className={`${POZYCJA} ${t === field.type ? "bg-[#f0f0f0] font-medium" : ""}`}
                >
                  <span aria-hidden="true" className={IKONA}>
                    {FIELD_TYPE_META[t].icon}
                  </span>
                  <span className="flex-1">{FIELD_TYPE_META[t].label}</span>
                  <span aria-hidden="true" className="text-[#15803d]">
                    {t === field.type ? "✓" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={PODZIAL} />
        <button type="button" role="menuitem" onClick={() => wykonaj(() => onSort("asc"))} className={POZYCJA}>
          <span aria-hidden="true" className={IKONA}>
            ↑
          </span>
          <span className="flex-1">Sortuj rosnąco</span>
        </button>
        <button type="button" role="menuitem" onClick={() => wykonaj(() => onSort("desc"))} className={POZYCJA}>
          <span aria-hidden="true" className={IKONA}>
            ↓
          </span>
          <span className="flex-1">Sortuj malejąco</span>
        </button>
        <button type="button" role="menuitem" onClick={() => wykonaj(onFilter)} className={POZYCJA}>
          <span aria-hidden="true" className={IKONA}>
            ⏚
          </span>
          <span className="flex-1">Filtruj po tym polu</span>
        </button>

        <div className={PODZIAL} />
        <div className="relative">
          <button
            type="button"
            role="menuitem"
            aria-label={`Podsumowanie ${aktualne} ›`}
            aria-haspopup="menu"
            aria-expanded={podmenu === "podsumowanie"}
            onClick={() => setPodmenu(podmenu === "podsumowanie" ? null : "podsumowanie")}
            className={`${POZYCJA} ${podmenu === "podsumowanie" ? "bg-[#f5f5f5]" : ""}`}
          >
            <span aria-hidden="true" className={IKONA}>
              Σ
            </span>
            <span className="flex-1">Podsumowanie</span>
            <span className="font-mono text-[11px] text-[#6b6b6b]">{aktualne} ›</span>
          </button>
          {podmenu === "podsumowanie" && (
            <div role="menu" aria-label="Podsumowanie" className={PODMENU}>
              <div className="px-2.5 pt-1.5 pb-1 font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase">
                Podsumowanie
              </div>
              {summaryOptions(field.type).map((kind) => {
                const wybrane = summary ? summary.kind === kind : kind === "none";
                return (
                  <button
                    key={kind}
                    type="button"
                    role="menuitem"
                    onClick={() => wykonaj(() => onSummary(kind))}
                    className={`${POZYCJA} ${wybrane ? "bg-[#f0f0f0]" : ""}`}
                  >
                    <span aria-hidden="true" className={IKONA}>
                      {wybrane ? "✓" : ""}
                    </span>
                    <span className="flex-1">{NAZWY_PODSUMOWAN[kind]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {field.type === "date" && (
          <button type="button" role="menuitem" onClick={() => wykonaj(onToggleCalendar)} className={POZYCJA}>
            <span aria-hidden="true" className={IKONA}>
              ▦
            </span>
            <span className="flex-1">Pokaż w kalendarzu</span>
            <span aria-hidden="true" className="font-mono text-[11px] text-[#6b6b6b]">
              {wKalendarzu ? "✓" : ""}
            </span>
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          disabled={!canHide}
          onClick={() => wykonaj(onHide)}
          className={POZYCJA}
        >
          <span aria-hidden="true" className={IKONA}>
            ◌
          </span>
          <span className="flex-1">Ukryj kolumnę</span>
        </button>

        <div className={PODZIAL} />
        <button
          type="button"
          role="menuitem"
          disabled={field.isTitle}
          onClick={() => wykonaj(onDelete)}
          className={cn(POZYCJA, "text-[#b91c1c]")}
        >
          <span aria-hidden="true" className={cn(IKONA, "text-[#b91c1c]")}>
            ✕
          </span>
          <span className="flex-1">Usuń pole</span>
        </button>
      </div>
    </ActionPopover>
  );
}
