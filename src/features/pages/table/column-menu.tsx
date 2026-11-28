"use client";

import * as React from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronRight,
  EyeOff,
  Funnel,
  Repeat,
  Sigma,
  SquareCheck,
  TextAlignStart,
  Trash2,
} from "lucide-react";

import {
  ActionPopover,
  Button,
  Chip,
  FIELD,
  FormDialog,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_LABEL,
  MENU_SEPARATOR,
  StatusBadge,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { OptionBadge } from "./option-badge";
import { FIELD_TYPE_META, type FieldConfig, type FieldType, type PageField } from "../fields";
import { summaryOptions, type ColumnSummary, type SummaryKind } from "../table-model";
import { NAZWY_PODSUMOWAN } from "./summary-cell";

// Pozycja menu (.mi); wyłączona: opacity .64
const POZYCJA = cn(MENU_ITEM, "disabled:cursor-not-allowed disabled:opacity-[.64] disabled:hover:bg-transparent");
// Ikona pozycji: lucide 16 px w kolorze muted-foreground
const IKONA = "size-4 flex-none text-muted-foreground";
// Podmenu (.pop): obok menu, odstęp 8 px (w prawo albo w lewo, gdy brakuje miejsca); na telefonie pod pozycją
const PODMENU =
  "absolute top-0 z-10 w-[210px] rounded-lg border border-border bg-white bg-clip-padding p-1 shadow-lg max-[799px]:static max-[799px]:mt-1 max-[799px]:w-auto max-[799px]:shadow-none";

// Menu kolumny z ColumnMenu.dc.html: nazwa, „Typ: … ›”, sort, „Filtruj po tym polu”, „Grupuj po tym polu” (Wybór,
// Status; S2Table), „Podsumowanie … ›”,
// „Pokaż w kalendarzu” (tylko Data), „Ukryj kolumnę” i „Usuń pole”. Wyzwalaczem jest nagłówek kolumny;
// podmenu (typy, podsumowania) otwierają się obok menu, na telefonie pod pozycją.
// Opcjonalnie (blok PageTable): „Przesuń w lewo / w prawo” i dla Wyboru sekcja „Opcje” z polem „Nowa opcja…”.
// `locked` (stałe kolumny modułu Hasła): bez zmiany nazwy, typu, przesuwania i usuwania; nagłówek Sekretu
// ma plakietkę „szyfr.” (S2Passwords.dc.html).
export function ColumnMenu({
  field,
  fields,
  open,
  onOpenChange,
  canHide,
  summary,
  onRename,
  onPickType,
  onSort,
  onFilter,
  onGroupBy,
  onSummary,
  onToggleCalendar,
  onConfig,
  onHide,
  onDelete,
  onCloseAutoFocus,
  onMoveLeft,
  onMoveRight,
  firstColumn = false,
  lastColumn = false,
  onAddOption,
  onRemoveOption,
  locked = false,
}: {
  field: PageField;
  // Wszystkie pola tabeli: Data odnowienia wskazuje w nich Kwotę cykliczną i Checkbox
  fields: PageField[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Ukryć można, dopóki zostaje choć jedna widoczna kolumna
  canHide: boolean;
  summary: ColumnSummary | undefined;
  onRename: (name: string) => void;
  onPickType: (type: FieldType) => void;
  onSort: (dir: "asc" | "desc") => void;
  onFilter: () => void;
  // „Grupuj po tym polu” (S2Table, każde pole poza Sekretem); bez niej pozycji nie ma
  onGroupBy?: () => void;
  onSummary: (kind: SummaryKind) => void;
  onToggleCalendar: () => void;
  // Zmiana configu pola (np. cykl Daty odnowienia); klucz z wartością undefined jest usuwany
  onConfig: (patch: Partial<FieldConfig>) => void;
  onHide: () => void;
  onDelete: () => void;
  // Pozwala wyłączyć zwrot fokusu na nagłówek (gdy zaraz otwiera się filtr)
  onCloseAutoFocus?: (e: Event) => void;
  // Przesuwanie kolumny (bez nich pozycji „Przesuń…” nie ma); skrajne kolumny mają jedną z nich wyłączoną
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  firstColumn?: boolean;
  lastColumn?: boolean;
  // Edycja opcji Wyboru w menu (bez nich sekcji „Opcje” nie ma)
  onAddOption?: (label: string) => void;
  onRemoveOption?: (optionId: string) => void;
  locked?: boolean;
}) {
  const [podmenu, setPodmenu] = React.useState<"typ" | "podsumowanie" | "cykl" | "aktywne" | "domyslnyCykl" | null>(null);
  // Strona otwarcia podmenu: w lewo, gdy menu stoi przy prawej krawędzi okna
  const [wLewo, setWLewo] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [nazwa, setNazwa] = React.useState(field.name);
  const [zrodloNazwy, setZrodloNazwy] = React.useState(field.name);
  if (zrodloNazwy !== field.name) {
    setZrodloNazwy(field.name);
    setNazwa(field.name);
  }

  const [nowaOpcja, setNowaOpcja] = React.useState("");
  // Telefon: zamiast dymku arkusz „Kolumna” (decyzja w chwili otwarcia)
  const [wArkuszu, setWArkuszu] = React.useState(false);

  const meta = FIELD_TYPE_META[field.type];
  const jestWyborem = field.type === "select" || field.type === "status";
  // Data odnowienia jest w kalendarzu domyślnie (brak klucza = włączone), zwykła data nie
  const wKalendarzu = field.type === "renewal" ? field.config.show_in_calendar !== false : field.config.show_in_calendar === true;
  const polaKwot = fields.filter((f) => f.type === "recurring");
  const polaCheckbox = fields.filter((f) => f.type === "checkbox");
  // Odwołanie do pola, którego nie ma albo które ma inny typ, to brak odwołania (jak w rowCycle / rowActive)
  const polaCykl = polaKwot.find((f) => f.id === field.config.cycle_field_id);
  const poleAktywne = polaCheckbox.find((f) => f.id === field.config.active_field_id);
  const cyklAktualny = polaCykl
    ? polaCykl.name
    : field.config.cycle === "year"
      ? "Własny: rok"
      : "Własny: miesiąc";
  const aktywneAktualne = poleAktywne ? poleAktywne.name : "— zawsze —";
  const domyslnyCyklAktualny = field.config.default_cycle === "year" ? "rok" : "miesiąc";

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

  const blokOpcje = (
    <>
        {jestWyborem && onAddOption && (
          <>
            <div className={MENU_SEPARATOR} />
            <div className={MENU_LABEL}>Opcje</div>
            <div className="flex flex-wrap gap-1 px-2">
              {(field.config.options ?? []).map((o) => (
                <OptionBadge key={o.id} option={o}>
                  <button
                    type="button"
                    aria-label={`Usuń opcję ${o.label}`}
                    onClick={() => onRemoveOption?.(o.id)}
                    className="cursor-pointer border-0 bg-transparent p-0 pl-0.5 font-[inherit] text-inherit opacity-60 outline-none focus-visible:shadow-focus max-[799px]:min-h-11 max-[799px]:min-w-11"
                  >
                    ×
                  </button>
                </OptionBadge>
              ))}
            </div>
            <div className="px-1 pt-2 pb-1">
              {/* Enter dodaje opcję i czyści pole; menu zostaje otwarte */}
              <input
                type="text"
                value={nowaOpcja}
                onChange={(e) => setNowaOpcja(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (nowaOpcja.trim() === "") return;
                    onAddOption(nowaOpcja.trim());
                    setNowaOpcja("");
                  }
                }}
                placeholder="Nowa opcja…"
                aria-label="Nowa opcja"
                className={FIELD}
              />
            </div>
          </>
        )}

    </>
  );

  const blokSortFiltr = (
    <>
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
        {/* S2Table: filtr weba zna tylko pola wyboru */}
        {jestWyborem && (
          <button type="button" role="menuitem" onClick={() => wykonaj(onFilter)} className={POZYCJA}>
            <Funnel aria-hidden="true" className={IKONA} />
            <span className="flex-1">Filtruj po tym polu</span>
          </button>
        )}
        {field.type !== "secret" && onGroupBy && (
          <button type="button" role="menuitem" onClick={() => wykonaj(onGroupBy)} className={POZYCJA}>
            <TextAlignStart aria-hidden="true" className={IKONA} />
            <span className="flex-1">Grupuj po tym polu</span>
          </button>
        )}

    </>
  );

  const blokPodsumowanie = (
    <>
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
        {(field.type === "date" || field.type === "renewal") && (
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
        {field.type === "renewal" && !locked && (
          <>
            <div className="relative">
              <button
                type="button"
                role="menuitem"
                aria-label={`Cykl z pola ${cyklAktualny} ›`}
                aria-haspopup="menu"
                aria-expanded={podmenu === "cykl"}
                onClick={() => {
                  const rect = menuRef.current?.getBoundingClientRect();
                  setWLewo(rect !== undefined && rect.right + 230 > window.innerWidth);
                  setPodmenu(podmenu === "cykl" ? null : "cykl");
                }}
                className={cn(POZYCJA, podmenu === "cykl" && "bg-accent")}
              >
                <Repeat aria-hidden="true" className={IKONA} />
                <span className="flex-1">Cykl z pola</span>
                <span className="max-w-[90px] truncate text-xs text-muted-foreground">{cyklAktualny}</span>
                <ChevronRight size={14} aria-hidden="true" className="flex-none" />
              </button>
              {podmenu === "cykl" && (
                <div role="menu" aria-label="Cykl z pola" className={cn(PODMENU, wLewo ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]")}>
                  <div className={MENU_LABEL}>Cykl z pola</div>
                  {polaKwot.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="menuitem"
                      onClick={() => wykonaj(() => onConfig({ cycle_field_id: f.id, cycle: undefined }))}
                      className={cn(POZYCJA, polaCykl?.id === f.id && "bg-accent")}
                    >
                      <span className="flex-1">{f.name}</span>
                      {polaCykl?.id === f.id && <Check size={14} aria-hidden="true" className="flex-none" />}
                    </button>
                  ))}
                  {(["month", "year"] as const).map((c) => {
                    const wybrane = !polaCykl && (field.config.cycle ?? "month") === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="menuitem"
                        onClick={() => wykonaj(() => onConfig({ cycle_field_id: undefined, cycle: c }))}
                        className={cn(POZYCJA, wybrane && "bg-accent")}
                      >
                        <span className="flex-1">{c === "month" ? "Własny: miesiąc" : "Własny: rok"}</span>
                        {wybrane && <Check size={14} aria-hidden="true" className="flex-none" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                role="menuitem"
                aria-label={`Tylko gdy zaznaczone ${aktywneAktualne} ›`}
                aria-haspopup="menu"
                aria-expanded={podmenu === "aktywne"}
                onClick={() => {
                  const rect = menuRef.current?.getBoundingClientRect();
                  setWLewo(rect !== undefined && rect.right + 230 > window.innerWidth);
                  setPodmenu(podmenu === "aktywne" ? null : "aktywne");
                }}
                className={cn(POZYCJA, podmenu === "aktywne" && "bg-accent")}
              >
                <SquareCheck aria-hidden="true" className={IKONA} />
                <span className="flex-1">Tylko gdy zaznaczone</span>
                <span className="max-w-[90px] truncate text-xs text-muted-foreground">{aktywneAktualne}</span>
                <ChevronRight size={14} aria-hidden="true" className="flex-none" />
              </button>
              {podmenu === "aktywne" && (
                <div role="menu" aria-label="Tylko gdy zaznaczone" className={cn(PODMENU, wLewo ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]")}>
                  <div className={MENU_LABEL}>Tylko gdy zaznaczone</div>
                  {polaCheckbox.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="menuitem"
                      onClick={() => wykonaj(() => onConfig({ active_field_id: f.id }))}
                      className={cn(POZYCJA, poleAktywne?.id === f.id && "bg-accent")}
                    >
                      <span className="flex-1">{f.name}</span>
                      {poleAktywne?.id === f.id && <Check size={14} aria-hidden="true" className="flex-none" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => wykonaj(() => onConfig({ active_field_id: undefined }))}
                    className={cn(POZYCJA, !poleAktywne && "bg-accent")}
                  >
                    <span className="flex-1">— zawsze —</span>
                    {!poleAktywne && <Check size={14} aria-hidden="true" className="flex-none" />}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {field.type === "recurring" && !locked && (
          <div className="relative">
            <button
              type="button"
              role="menuitem"
              aria-label={`Domyślny cykl ${domyslnyCyklAktualny} ›`}
              aria-haspopup="menu"
              aria-expanded={podmenu === "domyslnyCykl"}
              onClick={() => {
                const rect = menuRef.current?.getBoundingClientRect();
                setWLewo(rect !== undefined && rect.right + 230 > window.innerWidth);
                setPodmenu(podmenu === "domyslnyCykl" ? null : "domyslnyCykl");
              }}
              className={cn(POZYCJA, podmenu === "domyslnyCykl" && "bg-accent")}
            >
              <Repeat aria-hidden="true" className={IKONA} />
              <span className="flex-1">Domyślny cykl</span>
              <span className="text-xs text-muted-foreground">{domyslnyCyklAktualny}</span>
              <ChevronRight size={14} aria-hidden="true" className="flex-none" />
            </button>
            {podmenu === "domyslnyCykl" && (
              <div role="menu" aria-label="Domyślny cykl" className={cn(PODMENU, wLewo ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]")}>
                <div className={MENU_LABEL}>Domyślny cykl</div>
                {(["month", "year"] as const).map((c) => {
                  const wybrane = (field.config.default_cycle ?? "month") === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="menuitem"
                      onClick={() => wykonaj(() => onConfig({ default_cycle: c }))}
                      className={cn(POZYCJA, wybrane && "bg-accent")}
                    >
                      <span className="flex-1">{c === "month" ? "miesiąc" : "rok"}</span>
                      {wybrane && <Check size={14} aria-hidden="true" className="flex-none" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
    </>
  );

  const blokPrzesun = (
    <>
        {onMoveLeft && !locked && (
          <button type="button" role="menuitem" disabled={firstColumn} onClick={() => wykonaj(onMoveLeft)} className={POZYCJA}>
            <ArrowLeft aria-hidden="true" className={IKONA} />
            <span className="flex-1">Przesuń w lewo</span>
          </button>
        )}
        {onMoveRight && !locked && (
          <button type="button" role="menuitem" disabled={lastColumn} onClick={() => wykonaj(onMoveRight)} className={POZYCJA}>
            <ArrowRight aria-hidden="true" className={IKONA} />
            <span className="flex-1">Przesuń w prawo</span>
          </button>
        )}
    </>
  );

  const blokUkryj = (
    <>
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

    </>
  );

  const blokUsun = (
    <>
        {!locked && (
          <>
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
          </>
        )}
    </>
  );

  return (
    <>
    <ActionPopover
      open={open && !wArkuszu}
      onOpenChange={(o) => {
        if (!o) {
          setPodmenu(null);
          if (!locked) zapiszNazwe();
        }
        // Telefon (poniżej 800 px): zamiast dymku otwiera się arkusz „Kolumna”; sprawdzamy w chwili otwarcia
        if (o) setWArkuszu(typeof window.matchMedia === "function" && window.matchMedia("(max-width: 799px)").matches);
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
          // .colbtn: padding 3 × 6 px zjedzony ujemnym marginesem, tło rgba(0,0,0,.05) i ciemny tekst po najechaniu;
          // długa nazwa ucina się wielokropkiem w szerokości kolumny
          className="-mx-1.5 -my-[3px] inline-flex max-w-[calc(100%+12px)] min-w-0 cursor-pointer items-center rounded-md border-0 bg-transparent px-1.5 py-[3px] font-[inherit] font-medium text-muted-foreground outline-none hover:bg-black/5 hover:text-foreground focus-visible:shadow-focus aria-expanded:bg-black/5 aria-expanded:text-foreground max-[799px]:min-h-11"
        >
          {/* Ikona typu pola: 14 px, jasnoszara, odstęp 6 px jak w nagłówkach makiety */}
          <meta.Icon
            size={14}
            aria-hidden="true"
            className="mr-1.5 flex-none text-faint-foreground"
          />
          <span className="min-w-0 truncate">{field.name}</span>
          {locked && field.type === "secret" && (
            <StatusBadge tone="green" className="ml-1.5 flex-none">
              szyfr.
            </StatusBadge>
          )}
        </button>
      }
    >
      <div ref={menuRef} role="menu" aria-label={`Kolumna ${field.name}`} className="relative">
        {/* Stała kolumna (moduł): nazwa jako napis, bez typu — nie zmienia się ani jedno, ani drugie */}
        {locked ? (
          <div className={cn(MENU_LABEL, "pt-2")}>{field.name}</div>
        ) : (
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
        )}

        {!locked && (
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
        )}

{blokOpcje}
{blokSortFiltr}
{blokPodsumowanie}
{blokPrzesun}
{blokUkryj}
{blokUsun}
      </div>
    </ActionPopover>

      {/* Telefon (CMEditor, „Ustawienia kolumny”): arkusz „Kolumna” z „Gotowe”. Nazwa, typ pola jako chipy w 2 kolumnach,
          przesuwanie i usuwanie jak w makiecie; reszta menu (sortowanie, filtr, podsumowanie, kalendarz, cykle, opcje,
          ukrywanie) zostaje poniżej, żeby telefon niczego nie tracił względem webu. Stałe kolumny modułu bez typu, przesuwania i usuwania. */}
      <FormDialog
        open={open && wArkuszu}
        onOpenChange={(o) => {
          if (!o) {
            setPodmenu(null);
            if (!locked) zapiszNazwe();
          }
          onOpenChange(o);
        }}
        title="Kolumna"
        phoneClose={false}
        headerAction={
          <Button
            variant="ghost"
            onClick={() => {
              // Pole nazwy odmontuje się bez blur, więc zapisujemy nazwę przed zamknięciem
              setPodmenu(null);
              if (!locked) zapiszNazwe();
              onOpenChange(false);
            }}
            className="font-semibold"
          >
            Gotowe
          </Button>
        }
      >
        <div className="flex flex-col gap-4 pb-6">
          {locked ? (
            <div className="text-base font-medium">{field.name}</div>
          ) : (
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
          )}
          {!locked && (
            <>
              <span className="text-xs font-medium text-muted-foreground">Typ pola</span>
              <div className="grid grid-cols-2 gap-2">
                {/* Sekret wybiera się tylko przy dodawaniu pola; zmiana typu z i na Sekret jest zablokowana */}
                {(Object.keys(FIELD_TYPE_META) as FieldType[])
                  .filter((t) => t !== "secret")
                  .map((t) => (
                    <Chip
                      key={t}
                      selected={t === field.type}
                      disabled={field.isTitle || field.type === "secret"}
                      onClick={() => {
                        if (t === field.type) return;
                        wykonaj(() => onPickType(t));
                      }}
                      className="justify-start"
                    >
                      {React.createElement(FIELD_TYPE_META[t].Icon, {
                        size: 16,
                        "aria-hidden": true,
                        className: "flex-none text-muted-foreground",
                      })}
                      {FIELD_TYPE_META[t].label}
                    </Chip>
                  ))}
              </div>
              {onMoveLeft && onMoveRight && (
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={firstColumn} onClick={() => wykonaj(onMoveLeft)}>
                    ← W lewo
                  </Button>
                  <Button disabled={lastColumn} onClick={() => wykonaj(onMoveRight)}>
                    W prawo →
                  </Button>
                </div>
              )}
            </>
          )}
          <div ref={menuRef} role="menu" aria-label={`Więcej opcji kolumny ${field.name}`} className="-mx-2 flex flex-col">
            {blokOpcje}
            {blokSortFiltr}
            {blokPodsumowanie}
            {blokUkryj}
          </div>
          {!locked && (
            <Button variant="destructive-outline" disabled={field.isTitle} onClick={() => wykonaj(onDelete)}>
              Usuń kolumnę
            </Button>
          )}
        </div>
      </FormDialog>
    </>
  );
}
