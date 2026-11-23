"use client";

import * as React from "react";
import { Ellipsis, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  ActionPopover,
  Button,
  FIELD,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_LABEL,
  MENU_SEPARATOR,
  StatusBadge,
  type IsoDate,
} from "@/components/controls";
import { cn } from "@/lib/utils";

import {
  DOMYSLNA_SZEROKOSC,
  MIN_SZEROKOSC_KOLUMNY,
  SZEROKOSC_TYTULU,
  planTypeChange,
  type FieldType,
  type PageField,
} from "../fields";
import { TypeChangeDialog } from "../editor/type-change-dialog";
import type { LoadedBlock } from "../load-page";
import { rowsLabel } from "../rows-label";
import { operatorsFor, visibleRows } from "../table-model";
import { AddFieldDialog } from "./add-field-dialog";
import { ColumnMenu } from "./column-menu";
import { FilterPopover } from "./filter-popover";
import { MRowSheet } from "./mobile/m-row-sheet";
import { PinnedCards } from "./pinned-cards";
import { SummaryCell } from "./summary-cell";
import { TableCell } from "./table-cell";
import { PREFIKS_TYMCZASOWY, useTableStore } from "./use-table-store";

// Nagłówek tabeli (.th): 40 px, ikona typu i nazwa; liczby do prawej
const NAGLOWEK = "h-10 border-b border-border px-3 font-medium whitespace-nowrap text-muted-foreground";

// Wyzwalacz „Filtruj” jak Button secondary sm (.btn.sm z coss.css): 28 px, cień btn, fokus shadow-focus
const PRZYCISK_FILTRA =
  "relative inline-flex h-7 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-white bg-clip-padding px-[9px] text-sm leading-none font-medium whitespace-nowrap text-foreground shadow-btn transition-[box-shadow,background-color] duration-150 outline-none hover:bg-panel focus-visible:shadow-focus max-[799px]:h-10";

// Uchwyt zmiany szerokości (.colrs): 8 px na prawej krawędzi nagłówka, niebieska kreska 2 px po najechaniu,
// przy fokusie z klawiatury i w trakcie przeciągania (data-on); na telefonie bez uchwytu
const UCHWYT_KOLUMNY =
  "absolute top-0 -right-1 bottom-0 z-[3] w-2 cursor-col-resize touch-none outline-none after:absolute after:top-1.5 after:bottom-1.5 after:left-[3px] after:w-0.5 after:rounded-sm after:bg-transparent after:transition-colors after:duration-[120ms] after:content-[''] group-hover/kol:after:bg-[rgba(59,130,246,.6)] focus-visible:after:bg-[rgba(59,130,246,.6)] data-[on=true]:after:bg-[rgba(59,130,246,.6)] max-[799px]:hidden";

// Ramka z poziomym przewijaniem i cienkim suwakiem (.tbl-wrap)
const RAMKA_PRZEWIJANA =
  "overflow-x-auto overflow-y-hidden rounded-xl border-[1.5px] border-black/[.14] bg-white [scrollbar-color:rgba(0,0,0,.2)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-white [&::-webkit-scrollbar-thumb]:bg-black/[.18] [&::-webkit-scrollbar-thumb:hover]:bg-black/30 [&::-webkit-scrollbar-track]:bg-transparent";

// Pozycja menu „⋯”; wyłączona: opacity .64
const POZYCJA = cn(MENU_ITEM, "disabled:cursor-not-allowed disabled:opacity-[.64] disabled:hover:bg-transparent");

// Jeden blok tabeli (S2Books.dc.html): przypięte karty, pasek z nazwą tabeli, plakietką sortu, „Filtruj”
// i menu „⋯”, ramka z tabelą (menu kolumn, „+” dodające pole, wiersze z komórkami edytowanymi wprost
// jak w Notion, kosz po najechaniu, stopka z liczbą wierszy i podsumowaniami) i „+ Nowy” pod ramką.
// Na telefonie dotknięcie wiersza otwiera arkusz.
// Działa tylko na danych bloku — bez tytułu strony i sejfu. `onRemove` (z edytora) usuwa cały blok tabeli.
export function PageTable({
  block,
  today,
  onRemove,
}: {
  block: LoadedBlock;
  today: IsoDate;
  onRemove?: () => void;
}) {
  const store = useTableStore(block);
  const { fields, rows, settings, editing } = store;

  // Edycja w arkuszu (telefon); na webie komórki edytują się wprost
  const [wArkuszu, setWArkuszu] = React.useState(false);
  // „+ Nowy” czeka na serwer (przycisk wyłączony); id nowego wiersza dostaje kursor w komórce tytułu
  const [dodawanie, setDodawanie] = React.useState(false);
  const [nowyId, setNowyId] = React.useState<string | null>(null);
  // Otwarte menu kolumny (id pola), filtr, menu „⋯” i zmiana typu czekająca na potwierdzenie (ze stratą wartości)
  const [menuPola, setMenuPola] = React.useState<string | null>(null);
  const [filtrOtwarty, setFiltrOtwarty] = React.useState(false);
  const [menuTabeli, setMenuTabeli] = React.useState(false);
  const [zmianaTypu, setZmianaTypu] = React.useState<{
    field: PageField;
    type: FieldType;
    plan: ReturnType<typeof planTypeChange>;
  } | null>(null);
  // „Filtruj po tym polu” zamyka menu i od razu otwiera filtr — bez zwrotu fokusu na nagłówek
  const bezZwrotuFokusu = React.useRef(false);

  // Przeciąganie uchwytu kolumny: w trakcie szerokość jest tylko lokalna (stan do rysowania, ref do zapisu),
  // zapis idzie raz po puszczeniu
  const [przeciaganie, setPrzeciaganie] = React.useState<{ id: string; szer: number } | null>(null);
  const start = React.useRef<{ pointerId: number; x: number; szer: number; aktualna: number } | null>(null);

  // Szkic nazwy tabeli; nowa nazwa ze store (zapis, cofnięcie po błędzie) zastępuje szkic
  const [szkicNazwy, setSzkicNazwy] = React.useState(store.tableName);
  const [zrodloNazwy, setZrodloNazwy] = React.useState(store.tableName);
  if (zrodloNazwy !== store.tableName) {
    setZrodloNazwy(store.tableName);
    setSzkicNazwy(store.tableName);
  }

  const zywe = rows.filter((r) => r.deletedAt === null);
  const ukryte = new Set(settings.hidden_field_ids);
  const widocznePola = fields.filter((f) => !ukryte.has(f.id));
  const widoczneWiersze = visibleRows(fields, rows, settings, store.tempFilters);
  // Filtr w edycji (stan klienta) albo zapisany domyślny
  const filtry = store.tempFilters ?? settings.filters;
  // Pola, po których można jeszcze dodać sortowanie (bez tych już w sorcie)
  const wolneDoSortu = fields.filter((f) => !settings.sort.some((k) => k.field_id === f.id));
  // Plakietka „Sort: Status, Przeczytana” — nazwy pól sortu w kolejności kluczy
  const polaSortu = settings.sort
    .map((s) => fields.find((f) => f.id === s.field_id)?.name)
    .filter((n): n is string => n !== undefined);

  // Opcja „zrobione” z karty najbliższego terminu (zrobione terminy nie są pilne)
  const kartaTerminu = settings.pinned_cards.find((c) => c.aggregation === "nearest_date");
  const zrobione =
    kartaTerminu?.done_option_id !== undefined
      ? { fieldId: kartaTerminu.field_id, optionId: kartaTerminu.done_option_id }
      : null;

  // Szerokość każdej widocznej kolumny: szkic z przeciągania, zapisana (tylko skończona i ≥ 80), inaczej domyślna wg typu
  const szerokosci = widocznePola.map((f) => {
    if (przeciaganie?.id === f.id) return przeciaganie.szer;
    const zapisana = settings.column_widths[f.id];
    // Wartość z bazy: całkowita i przycięta do 4000, żeby zapis przez strzałki nigdy nie zwężał ani nie łamał schematu
    if (typeof zapisana === "number" && Number.isFinite(zapisana) && zapisana >= MIN_SZEROKOSC_KOLUMNY) {
      return Math.min(4000, Math.round(zapisana));
    }
    return f.isTitle ? SZEROKOSC_TYTULU : DOMYSLNA_SZEROKOSC[f.type];
  });
  const sumaSzerokosci = szerokosci.reduce((a, b) => a + b, 0);

  // Kolumna ukryta albo usunięta w trakcie przeciągania: uchwyt znika bez pointerup, więc zerujemy szkic
  // (wzorzec jak przy nazwie tabeli; ref czyści pierwszy ruch bez wciśniętego przycisku albo kolejny pointerdown)
  if (przeciaganie && !widocznePola.some((f) => f.id === przeciaganie.id)) setPrzeciaganie(null);

  // Zapis szerokości jednej kolumny: cała mapa column_widths (patch ustawień scala się płytko), bez śmieci z bazy
  function zapiszSzerokosc(id: string, szer: number) {
    const mapa: Record<string, number> = {};
    for (const [k, v] of Object.entries(settings.column_widths)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= MIN_SZEROKOSC_KOLUMNY) mapa[k] = Math.min(4000, Math.round(v));
    }
    mapa[id] = szer;
    void store.patchSettings({ column_widths: mapa });
  }

  // Telefon (poniżej 800 px) edytuje wiersz w arkuszu; sprawdzamy w chwili kliknięcia
  function naTelefonie() {
    return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 799px)").matches;
  }

  // Telefon: szkic w arkuszu, jak dotąd. Web: wiersz najpierw na serwerze, potem kursor w tytule.
  async function nowyWiersz() {
    if (naTelefonie()) {
      setWArkuszu(true);
      void store.addRowDraft();
      return;
    }
    setDodawanie(true);
    const id = await store.addRowInline();
    setDodawanie(false);
    if (id !== null) setNowyId(id);
  }

  const edytowany = editing?.rowId ? rows.find((r) => r.id === editing.rowId) : undefined;
  const tytulowe = fields.find((f) => f.isTitle);
  const tytulArkusza =
    editing?.rowId === null
      ? "Nowy wiersz"
      : edytowany && tytulowe && typeof edytowany.values[tytulowe.id] === "string"
        ? (edytowany.values[tytulowe.id] as string)
        : (tytulowe?.config.empty_label ?? "Bez tytułu");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PinnedCards
        cards={settings.pinned_cards}
        fields={fields}
        rows={widoczneWiersze}
        today={today}
        onChange={(next) => void store.patchSettings({ pinned_cards: next })}
        // Okno karty (nowa i edycja) dochodzi w zadaniu 7
        onAdd={() => {}}
        onEdit={() => {}}
      />

      {/* Pasek tabeli: nazwa (h2 16 px) po lewej, sort / Filtruj / ⋯ po prawej */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          value={szkicNazwy}
          onChange={(e) => setSzkicNazwy(e.target.value)}
          onBlur={() => void store.renameTable(szkicNazwy)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder="Tabela bez nazwy"
          aria-label="Nazwa tabeli"
          className="min-w-0 flex-1 rounded-md border-0 bg-transparent p-0 font-[inherit] text-base font-semibold text-foreground outline-none placeholder:text-faint-foreground focus-visible:bg-black/[.02] focus-visible:shadow-focus max-[799px]:min-h-11"
        />
        <div className="flex flex-wrap items-center gap-2">
          {polaSortu.length > 0 && <StatusBadge tone="gray">Sort: {polaSortu.join(", ")}</StatusBadge>}
          <FilterPopover
            fields={fields}
            filters={filtry}
            today={today}
            shown={widoczneWiersze.length}
            total={zywe.length}
            open={filtrOtwarty}
            onOpenChange={setFiltrOtwarty}
            onChange={store.setTempFilters}
            onSave={() => {
              // Filtr tymczasowy znika dopiero po udanym zapisie
              void store.patchSettings({ filters: filtry }).then((udane) => {
                if (udane) store.setTempFilters(null);
              });
            }}
            triggerClassName={PRZYCISK_FILTRA}
          />
          <ActionPopover
            open={menuTabeli}
            onOpenChange={(o) => {
              // Zamknięcie menu (Esc, klik obok) zapisuje szkic nazwy z pola w menu
              if (!o) void store.renameTable(szkicNazwy);
              setMenuTabeli(o);
            }}
            align="end"
            width={300}
            className="p-1"
            ariaLabel="Ustawienia tabeli"
            trigger={
              <Button
                size="sm"
                icon
                aria-label="Menu tabeli"
                aria-expanded={menuTabeli}
                className="aria-expanded:bg-accent"
              >
                <Ellipsis aria-hidden="true" className="size-4" />
              </Button>
            }
          >
            {/* S2TableMenu.dc.html: nazwa tabeli, sortowanie, widoczne kolumny i „Usuń tabelę” */}
            <div className="p-1">
              <input
                type="text"
                value={szkicNazwy}
                onChange={(e) => setSzkicNazwy(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Enter zapisuje od razu; menu zostaje otwarte (bez onBlur — zapis robi też zamknięcie menu)
                    e.preventDefault();
                    void store.renameTable(szkicNazwy);
                  }
                }}
                placeholder="Tabela bez nazwy"
                aria-label="Nazwa tabeli"
                className={FIELD}
              />
            </div>
            <div className={cn(MENU_LABEL, "pt-2")}>Sortowanie</div>
            {settings.sort.map((klucz, i) => {
              const pole = fields.find((f) => f.id === klucz.field_id);
              if (!pole) return null;
              return (
                <div
                  key={klucz.field_id}
                  className="flex min-h-9 items-center gap-1.5 py-0.5 pr-1 pl-2.5"
                >
                  <span className="flex-1">{pole.name}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`Odwróć kierunek: ${pole.name}`}
                    onClick={() =>
                      void store.patchSettings({
                        sort: settings.sort.map((k, j) =>
                          j === i
                            ? {
                                field_id: k.field_id,
                                dir: k.dir === "asc" ? "desc" : "asc",
                              }
                            : k,
                        ),
                      })
                    }
                  >
                    {klucz.dir === "asc" ? "A → Z" : "Z → A"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    icon
                    aria-label={`Usuń sortowanie: ${pole.name}`}
                    onClick={() =>
                      void store.patchSettings({
                        sort: settings.sort.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </Button>
                </div>
              );
            })}
            {settings.sort.length === 0 && (
              <div className="px-2.5 py-1.5 text-[13px] text-muted-foreground">
                Wiersze w kolejności dodania.
              </div>
            )}
            <button
              type="button"
              disabled={wolneDoSortu.length === 0}
              onClick={() =>
                void store.patchSettings({
                  sort: [
                    ...settings.sort,
                    { field_id: wolneDoSortu[0].id, dir: "asc" },
                  ],
                })
              }
              className={POZYCJA}
            >
              <Plus aria-hidden="true" className="size-4 flex-none" />
              <span className="flex-1">Dodaj sortowanie</span>
            </button>
            <div className={MENU_SEPARATOR} />
            <div className={MENU_LABEL}>Widoczne kolumny</div>
            {fields.map((f) => {
              const widoczna = !ukryte.has(f.id);
              // Blokada dotyczy tylko ukrywania: kolumny tytułu i ostatniej widocznej. Ukrytą kolumnę zawsze da się przywrócić.
              const zablokowana =
                widoczna && (f.isTitle || widocznePola.length === 1);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={widoczna}
                  disabled={zablokowana}
                  onClick={() =>
                    void store.patchSettings({
                      hidden_field_ids: widoczna
                        ? [...settings.hidden_field_ids, f.id]
                        : settings.hidden_field_ids.filter((id) => id !== f.id),
                    })
                  }
                  className={cn(POZYCJA, !widoczna && "text-muted-foreground")}
                >
                  <span className="flex-1">{f.name}</span>
                  {widoczna ? (
                    <Eye
                      aria-hidden="true"
                      className="size-4 flex-none opacity-70"
                    />
                  ) : (
                    <EyeOff
                      aria-hidden="true"
                      className="size-4 flex-none opacity-35"
                    />
                  )}
                </button>
              );
            })}
            {onRemove && (
              <>
                <div className={MENU_SEPARATOR} />
                <button
                  type="button"
                  onClick={() => {
                    setMenuTabeli(false);
                    onRemove();
                  }}
                  className={cn(POZYCJA, MENU_ITEM_DANGER)}
                >
                  <Trash2 aria-hidden="true" className="size-4 flex-none" />
                  <span className="flex-1">Usuń tabelę</span>
                </button>
              </>
            )}
          </ActionPopover>
        </div>
      </div>

      {/* .frame > .inner: ramka 1,5 px, promień 12 px; tabela przewija się poziomo, gdy kolumny się nie mieszczą */}
      <div className={RAMKA_PRZEWIJANA}>
        {/* table-layout: fixed; szerokość = suma kolumn + 56 px (kolumna „+” i kosza), nie węższa niż ramka */}
        <table
          className="border-collapse text-sm"
          style={{ tableLayout: "fixed", width: sumaSzerokosci + 56, minWidth: "100%" }}
        >
          <colgroup>
            {widocznePola.map((f, i) => (
              <col key={f.id} style={{ width: szerokosci[i] }} />
            ))}
            {/* Ostatnia kolumna („+” i kosz) bez szerokości: wypełnia ramkę */}
            <col />
          </colgroup>
          <thead>
            <tr>
              {widocznePola.map((f, kolumna) => {
                // Przesuwanie liczy się po wszystkich kolumnach (także ukrytych), jak kolejność na serwerze
                const indeks = fields.indexOf(f);
                return (
                  <th
                    key={f.id}
                    scope="col"
                    className={`group/kol relative ${NAGLOWEK} ${f.type === "number" ? "text-right" : "text-left"}`}
                  >
                    <ColumnMenu
                      field={f}
                      open={menuPola === f.id}
                      // Kolumna czekająca na odpowiedź serwera (tymczasowe id) nie ma jeszcze menu
                      onOpenChange={(o) => {
                        if (o && f.id.startsWith(PREFIKS_TYMCZASOWY)) return;
                        setMenuPola(o ? f.id : null);
                      }}
                      // Nie ukrywamy kolumny tytułu ani ostatniej widocznej
                      canHide={widocznePola.length > 1 && !f.isTitle}
                      summary={settings.column_summaries[f.id]}
                      onCloseAutoFocus={(e) => {
                        if (bezZwrotuFokusu.current) {
                          e.preventDefault();
                          bezZwrotuFokusu.current = false;
                        }
                      }}
                      onRename={(nazwa) => void store.patchField(f, { name: nazwa })}
                      onPickType={(typ) => {
                        const plan = store.planTypeChangeFor(f, typ);
                        if (!plan) {
                          toast.error("Poczekaj, aż wiersze się zapiszą.");
                          return;
                        }
                        if (plan.lost > 0) setZmianaTypu({ field: f, type: typ, plan });
                        else void store.applyTypeChange(f, typ, plan, false);
                      }}
                      onSort={(dir) => void store.patchSettings({ sort: [{ field_id: f.id, dir }] })}
                      onFilter={() => {
                        bezZwrotuFokusu.current = true;
                        store.setTempFilters([...filtry, { field_id: f.id, op: operatorsFor(f.type)[0] }]);
                        setFiltrOtwarty(true);
                      }}
                      onSummary={(kind) => {
                        const nowe = { ...settings.column_summaries };
                        if (kind === "none") delete nowe[f.id];
                        else nowe[f.id] = { kind };
                        void store.patchSettings({ column_summaries: nowe });
                      }}
                      onToggleCalendar={() =>
                        void store.patchField(f, {
                          config: { ...f.config, show_in_calendar: f.config.show_in_calendar !== true },
                        })
                      }
                      onHide={() =>
                        void store.patchSettings({ hidden_field_ids: [...settings.hidden_field_ids, f.id] })
                      }
                      onDelete={() => void store.removeField(f)}
                      onMoveLeft={() => void store.moveField(f, -1)}
                      onMoveRight={() => void store.moveField(f, 1)}
                      // Kolumna tytułu się nie przesuwa i nic nie wchodzi przed nią (jak w store.moveField)
                      firstColumn={f.isTitle || indeks === 0 || fields[indeks - 1].isTitle}
                      lastColumn={f.isTitle || indeks === fields.length - 1 || fields[indeks + 1].isTitle}
                      onAddOption={(etykieta) => void store.addOption(f, etykieta)}
                      onRemoveOption={(id) => void store.removeOption(f, id)}
                    />
                    {/* Uchwyt szerokości: przeciąganie (pointer events) albo ←/→ co 20 px; min. 80 px */}
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Zmień szerokość kolumny ${f.name} (strzałki w lewo i w prawo)`}
                      aria-valuenow={szerokosci[kolumna]}
                      aria-valuemin={MIN_SZEROKOSC_KOLUMNY}
                      tabIndex={0}
                      data-on={przeciaganie?.id === f.id}
                      className={UCHWYT_KOLUMNY}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        // preventDefault wyłącza domyślny fokus, a strzałki mają działać zaraz po kliknięciu
                        e.currentTarget.focus();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        start.current = {
                          pointerId: e.pointerId,
                          x: e.clientX,
                          szer: szerokosci[kolumna],
                          aktualna: szerokosci[kolumna],
                        };
                        setPrzeciaganie({ id: f.id, szer: szerokosci[kolumna] });
                      }}
                      onPointerMove={(e) => {
                        if (!start.current || start.current.pointerId !== e.pointerId) return;
                        // Ruch bez wciśniętego przycisku (np. po zniknięciu uchwytu w trakcie): kończymy bez zapisu
                        if (e.buttons === 0) {
                          start.current = null;
                          setPrzeciaganie(null);
                          return;
                        }
                        const szer = Math.min(
                          4000,
                          Math.max(MIN_SZEROKOSC_KOLUMNY, Math.round(start.current.szer + e.clientX - start.current.x)),
                        );
                        start.current.aktualna = szer;
                        setPrzeciaganie({ id: f.id, szer });
                      }}
                      onPointerUp={(e) => {
                        if (!start.current || start.current.pointerId !== e.pointerId) return;
                        const { szer, aktualna } = start.current;
                        start.current = null;
                        setPrzeciaganie(null);
                        e.currentTarget.releasePointerCapture?.(e.pointerId);
                        if (aktualna !== szer) zapiszSzerokosc(f.id, aktualna);
                      }}
                      // Przeglądarka zerwała capture bez pointerup: kończymy jak puszczenie (zapis, jeśli była zmiana)
                      onLostPointerCapture={(e) => {
                        if (!start.current || start.current.pointerId !== e.pointerId) return;
                        const { szer, aktualna } = start.current;
                        start.current = null;
                        setPrzeciaganie(null);
                        if (aktualna !== szer) zapiszSzerokosc(f.id, aktualna);
                      }}
                      onPointerCancel={(e) => {
                        if (!start.current || start.current.pointerId !== e.pointerId) return;
                        start.current = null;
                        setPrzeciaganie(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                        e.preventDefault();
                        const nowa = Math.min(
                          4000,
                          Math.max(MIN_SZEROKOSC_KOLUMNY, szerokosci[kolumna] + (e.key === "ArrowRight" ? 20 : -20)),
                        );
                        if (nowa !== szerokosci[kolumna]) zapiszSzerokosc(f.id, nowa);
                      }}
                    />
                    {/* Bez plakietki „w kalendarzu” w nagłówku: S2Projects pokazuje Termin bez niej (stan jest w menu kolumny) */}
                  </th>
                );
              })}
              {/* Ostatni nagłówek: „+” otwiera „Nowe pole” (bez Sekretu); pod nim kolumna akcji wiersza */}
              <th scope="col" className="h-10 border-b border-border px-1 text-left">
                <AddFieldDialog iconTrigger allowSecret={false} onAdd={(input) => void store.addField(input)} />
              </th>
            </tr>
          </thead>
          <tbody>
            {widoczneWiersze.map((r) => (
              <tr
                key={r.id}
                // Telefon: dotknięcie wiersza otwiera arkusz zamiast zmieniać komórkę (sprawdzamy w chwili dotknięcia)
                onClickCapture={(e) => {
                  if (!naTelefonie()) return;
                  e.preventDefault();
                  e.stopPropagation();
                  // Wiersz w trakcie zapisu (tymczasowe id) store otworzy sam po odpowiedzi serwera
                  if (editing?.rowId === r.id) return;
                  setWArkuszu(true);
                  void store.startEdit(r);
                }}
                // Na telefonie pola i przyciski komórek nie łapią dotyku: dostaje go wiersz
                className="group/wiersz max-[799px]:cursor-pointer max-[799px]:[&_a]:pointer-events-none max-[799px]:[&_button]:pointer-events-none max-[799px]:[&_input]:pointer-events-none"
              >
                {widocznePola.map((f) => (
                  <TableCell
                    key={f.id}
                    row={r}
                    field={f}
                    today={today}
                    done={zrobione}
                    autoFocus={f.isTitle && r.id === nowyId}
                    onSave={(v) => void store.updateCell(r, f, v)}
                    onCreateOption={(etykieta) => store.createOption(f, etykieta)}
                    onUpdateOption={(id, patch) => void store.updateOption(f, id, patch)}
                    onRemoveOption={(id) => void store.removeOption(f, id)}
                    // Kursor w nowym wierszu ustawiamy raz: po pierwszym fokusie komórka nie kradnie go przy zmianie filtra czy sortu
                    onFocused={f.isTitle && r.id === nowyId ? () => setNowyId(null) : undefined}
                  />
                ))}
                {/* Kosz pod „+”: widoczny po najechaniu na wiersz i przy fokusie w wierszu (.row-del) */}
                <td className="h-11 border-b border-border px-1.5 text-right whitespace-nowrap group-last/wiersz:border-b-0">
                  <Button
                    variant="ghost"
                    size="xs"
                    icon
                    aria-label="Usuń wiersz"
                    onClick={() => void store.removeRow(r)}
                    className="text-destructive-foreground opacity-0 transition-opacity duration-[120ms] group-focus-within/wiersz:opacity-100 group-hover/wiersz:opacity-100 hover:text-destructive-foreground focus-visible:opacity-100 max-[799px]:hidden"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* Stopka: liczba wierszy (po filtrze) w pierwszej kolumnie, dalej podsumowania kolumn */}
            <tr className="bg-black/[.02]">
              {widocznePola.map((f, i) =>
                i === 0 ? (
                  <td key={f.id} className="h-11 border-t border-border px-3 text-muted-foreground tabular-nums">
                    {rowsLabel(widoczneWiersze.length)}
                  </td>
                ) : (
                  <SummaryCell
                    key={f.id}
                    field={f}
                    rows={widoczneWiersze}
                    summary={settings.column_summaries[f.id]}
                    today={today}
                  />
                ),
              )}
              <td className="h-11 border-t border-border" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* „+ Nowy” pod ramką (.btng.sm, szary tekst) */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={dodawanie}
          onClick={() => void nowyWiersz()}
          className="text-muted-foreground"
        >
          <Plus aria-hidden="true" className="size-4" />
          Nowy
        </Button>
      </div>

      {zmianaTypu && (
        <TypeChangeDialog
          lost={zmianaTypu.plan.lost}
          onCancel={() => setZmianaTypu(null)}
          onConfirm={async () => {
            const udane = await store.applyTypeChange(zmianaTypu.field, zmianaTypu.type, zmianaTypu.plan, true);
            if (udane) setZmianaTypu(null);
          }}
        />
      )}

      <MRowSheet
        open={editing !== null && wArkuszu}
        title={tytulArkusza}
        fields={widocznePola}
        values={editing?.values ?? {}}
        today={today}
        onChange={store.setEditValue}
        onSave={() => void store.saveRow()}
        onCancel={store.cancelEdit}
        onDelete={edytowany ? () => void store.removeRow(edytowany) : undefined}
      />
    </div>
  );
}
