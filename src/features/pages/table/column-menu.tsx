"use client";

import * as React from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Calendar,
  Check,
  ChevronRight,
  EyeOff,
  Funnel,
  Sigma,
  Trash2,
} from "lucide-react";

import {
  ActionPopover,
  FIELD,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_LABEL,
  MENU_SEPARATOR,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_META, type FieldType, type PageField } from "../fields";
import { summaryOptions, type ColumnSummary, type SummaryKind } from "../table-model";
import { NAZWY_PODSUMOWAN } from "./summary-cell";

// Pozycja menu (.mi); wyłączona: opacity .64
const POZYCJA = cn(MENU_ITEM, "disabled:cursor-not-allowed disabled:opacity-[.64] disabled:hover:bg-transparent");
// Ikona pozycji: lucide 16 px w kolorze muted-foreground
const IKONA = "size-4 flex-none text-muted-foreground";
// Podmenu (.pop): obok menu, odstęp 8 px (w prawo albo w lewo, gdy brakuje miejsca); na telefonie pod pozycją
const PODMENU =
  "absolute top-0 z-10 w-[210px] rounded-lg border border-border bg-white bg-clip-padding p-1 shadow-lg max-[799px]:static max-[799px]:mt-1 max-[799px]:w-auto max-[799px]:shadow-none";

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
  // Strona otwarcia podmenu: w lewo, gdy menu stoi przy prawej krawędzi okna
  const [wLewo, setWLewo] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
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
      width={260}
      className="p-1"
      onCloseAutoFocus={onCloseAutoFocus}
      ariaLabel={`Kolumna ${field.name}`}
      trigger={
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          className="cursor-pointer rounded-sm border-0 bg-transparent p-0 font-[inherit] font-medium text-muted-foreground outline-none focus-visible:shadow-focus max-[799px]:min-h-11"
        >
          {/* Ikona typu pola: 14 px, jasnoszara, odstęp 6 px jak w nagłówkach makiety */}
          <meta.Icon
            size={14}
            aria-hidden="true"
            className="mr-1.5 inline align-[-2px] text-faint-foreground"
          />
          {field.name}
        </button>
      }
    >
      <div ref={menuRef} role="menu" aria-label={`Kolumna ${field.name}`} className="relative">
        <div className="p-1">
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
            className={FIELD}
          />
        </div>

        <div className="relative">
          <button
            type="button"
            role="menuitem"
            // Typu Sekret nie zmienia się w żadną stronę
            disabled={field.isTitle || field.type === "secret"}
            aria-label={`Typ: ${meta.label} ›`}
            aria-haspopup="menu"
            aria-expanded={podmenu === "typ"}
            onClick={() => {
              // Podmenu ma 210 px + odstęp 12 px; przy prawej krawędzi otwiera się w lewo
              const rect = menuRef.current?.getBoundingClientRect();
              setWLewo(rect !== undefined && rect.right + 230 > window.innerWidth);
              setPodmenu(podmenu === "typ" ? null : "typ");
            }}
            className={cn(POZYCJA, podmenu === "typ" && "bg-accent")}
          >
            {/* Ikona typu w kolumnie ikon (16 px), jak pozostałe pozycje */}
            <meta.Icon size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
            <span className="flex-1">Typ: {meta.label}</span>
            <ChevronRight size={14} aria-hidden="true" className="flex-none" />
          </button>
          {podmenu === "typ" && (
            <div role="menu" aria-label="Typ pola" className={cn(PODMENU, wLewo ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]")}>
              <div className={MENU_LABEL}>Typ pola</div>
              {/* Sekret wybiera się tylko przy dodawaniu pola; zmiana typu z i na Sekret jest zablokowana */}
              {(Object.keys(FIELD_TYPE_META) as FieldType[]).filter((t) => t !== "secret").map((t) => (
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
                  className={cn(POZYCJA, t === field.type && "bg-accent font-medium")}
                >
                  {React.createElement(FIELD_TYPE_META[t].Icon, {
                    size: 16,
                    "aria-hidden": true,
                    className: "flex-none text-muted-foreground",
                  })}
                  <span className="flex-1">{FIELD_TYPE_META[t].label}</span>
                  {t === field.type && <Check size={14} aria-hidden="true" className="flex-none" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={MENU_SEPARATOR} />
        {/* Szyfrogramu nie da się sortować: kolumna Sekret nie ma sortowania */}
        {field.type !== "secret" && (
          <>
            <button type="button" role="menuitem" onClick={() => wykonaj(() => onSort("asc"))} className={POZYCJA}>
              <ArrowUpNarrowWide aria-hidden="true" className={IKONA} />
              <span className="flex-1">Sortuj rosnąco</span>
            </button>
            <button type="button" role="menuitem" onClick={() => wykonaj(() => onSort("desc"))} className={POZYCJA}>
              <ArrowDownWideNarrow aria-hidden="true" className={IKONA} />
              <span className="flex-1">Sortuj malejąco</span>
            </button>
          </>
        )}
        <button type="button" role="menuitem" onClick={() => wykonaj(onFilter)} className={POZYCJA}>
          <Funnel aria-hidden="true" className={IKONA} />
          <span className="flex-1">Filtruj po tym polu</span>
        </button>

        <div className={MENU_SEPARATOR} />
        <div className="relative">
          <button
            type="button"
            role="menuitem"
            aria-label={`Podsumowanie ${aktualne} ›`}
            aria-haspopup="menu"
            aria-expanded={podmenu === "podsumowanie"}
            onClick={() => {
              const rect = menuRef.current?.getBoundingClientRect();
              setWLewo(rect !== undefined && rect.right + 230 > window.innerWidth);
              setPodmenu(podmenu === "podsumowanie" ? null : "podsumowanie");
            }}
            className={cn(POZYCJA, podmenu === "podsumowanie" && "bg-accent")}
          >
            <Sigma aria-hidden="true" className={IKONA} />
            <span className="flex-1">Podsumowanie</span>
            {/* .mi-sc: bieżąca wartość po prawej, bez rozstrzelenia liter */}
            <span className="text-xs text-muted-foreground">{aktualne}</span>
            <ChevronRight size={14} aria-hidden="true" className="flex-none" />
          </button>
          {podmenu === "podsumowanie" && (
            <div role="menu" aria-label="Podsumowanie" className={cn(PODMENU, wLewo ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]")}>
              <div className={MENU_LABEL}>Podsumowanie</div>
              {summaryOptions(field.type).map((kind) => {
                const wybrane = summary ? summary.kind === kind : kind === "none";
                return (
                  <button
                    key={kind}
                    type="button"
                    role="menuitem"
                    onClick={() => wykonaj(() => onSummary(kind))}
                    className={cn(POZYCJA, wybrane && "bg-accent")}
                  >
                    <span className="flex-1">{NAZWY_PODSUMOWAN[kind]}</span>
                    {wybrane && <Check size={14} aria-hidden="true" className="flex-none" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {field.type === "date" && (
          <button type="button" role="menuitem" onClick={() => wykonaj(onToggleCalendar)} className={POZYCJA}>
            <Calendar aria-hidden="true" className={IKONA} />
            <span className="flex-1">Pokaż w kalendarzu</span>
            {/* Dekoracyjny przełącznik (.sw 36×20 pomniejszony do .8); stan niesie sama pozycja */}
            <span
              aria-hidden="true"
              data-on={wKalendarzu}
              className={cn(
                "relative h-5 w-9 flex-none origin-right scale-[.8] rounded-full border-2 border-transparent bg-black/12 shadow-[inset_0_1px_1px_rgba(0,0,0,.04)] transition-colors duration-150",
                wKalendarzu && "bg-primary",
              )}
            >
              <span
                className={cn(
                  "absolute top-0 left-0 size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.16)] transition-transform duration-150",
                  wKalendarzu && "translate-x-4",
                )}
              />
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
          <EyeOff aria-hidden="true" className={IKONA} />
          <span className="flex-1">Ukryj kolumnę</span>
        </button>

        <div className={MENU_SEPARATOR} />
        <button
          type="button"
          role="menuitem"
          disabled={field.isTitle}
          onClick={() => wykonaj(onDelete)}
          className={cn(POZYCJA, MENU_ITEM_DANGER, "disabled:hover:bg-transparent")}
        >
          <Trash2 aria-hidden="true" className="size-4 flex-none" />
          <span className="flex-1">Usuń pole</span>
        </button>
      </div>
    </ActionPopover>
  );
}
