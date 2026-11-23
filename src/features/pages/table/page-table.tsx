"use client";

import * as React from "react";
import { Ellipsis, Eye, ListX, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  ActionPopover,
  Button,
  MENU_ITEM,
  StatusBadge,
  type IsoDate,
} from "@/components/controls";
import { cn } from "@/lib/utils";

import { planTypeChange, type FieldType, type PageField } from "../fields";
import { TypeChangeDialog } from "../editor/type-change-dialog";
import type { LoadedBlock } from "../load-page";
import { rowsLabel } from "../rows-label";
import { operatorsFor, visibleRows } from "../table-model";
import { AddFieldDialog } from "./add-field-dialog";
import { ColumnMenu } from "./column-menu";
import { FilterPopover } from "./filter-popover";
import { MRowSheet } from "./mobile/m-row-sheet";
import { PinnedCards } from "./pinned-cards";
import { RowEdit } from "./row-edit";
import { RowPreview } from "./row-preview";
import { SummaryCell } from "./summary-cell";
import { PREFIKS_TYMCZASOWY, useTableStore } from "./use-table-store";

// Nagłówek tabeli (.th): 40 px, ikona typu i nazwa; liczby do prawej
const NAGLOWEK = "h-10 border-b border-border px-3 font-medium whitespace-nowrap text-muted-foreground";

// Wyzwalacz „Filtruj” jak Button secondary sm (.btn.sm z coss.css): 28 px, cień btn, fokus shadow-focus
const PRZYCISK_FILTRA =
  "relative inline-flex h-7 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-white bg-clip-padding px-[9px] text-sm leading-none font-medium whitespace-nowrap text-foreground shadow-btn transition-[box-shadow,background-color] duration-150 outline-none hover:bg-panel focus-visible:shadow-focus max-[799px]:h-10";

// Pozycja menu „⋯”; wyłączona: opacity .64
const POZYCJA = cn(MENU_ITEM, "disabled:cursor-not-allowed disabled:opacity-[.64] disabled:hover:bg-transparent");

// Jeden blok tabeli (S2Books.dc.html): przypięte karty, pasek z nazwą tabeli, plakietką sortu, „Filtruj”
// i menu „⋯”, ramka z tabelą (menu kolumn, „+” dodające pole, podgląd / tryb edycji wiersza, stopka
// z liczbą wierszy i podsumowaniami) i „+ Nowy” pod ramką. Na telefonie wiersz edytuje się w arkuszu.
// Działa tylko na danych bloku — bez tytułu strony i sejfu.
export function PageTable({ block, today }: { block: LoadedBlock; today: IsoDate }) {
  const store = useTableStore(block);
  const { fields, rows, settings, editing } = store;

  // Edycja w arkuszu (telefon) zamiast w wierszu tabeli
  const [wArkuszu, setWArkuszu] = React.useState(false);
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
  const liczbaUkrytych = fields.filter((f) => ukryte.has(f.id)).length;
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

  // Telefon (poniżej 800 px) edytuje wiersz w arkuszu; sprawdzamy w chwili kliknięcia
  function naTelefonie() {
    return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 799px)").matches;
  }

  function nowyWiersz() {
    setWArkuszu(naTelefonie());
    void store.addRowDraft();
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
      <PinnedCards cards={settings.pinned_cards} fields={fields} rows={widoczneWiersze} today={today} />

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
            onOpenChange={setMenuTabeli}
            align="end"
            width={240}
            className="p-1"
            ariaLabel="Ustawienia tabeli"
            trigger={
              <Button size="sm" icon aria-label="Menu tabeli" aria-expanded={menuTabeli} className="aria-expanded:bg-accent">
                <Ellipsis aria-hidden="true" className="size-4" />
              </Button>
            }
          >
            <div role="menu" aria-label="Menu tabeli">
              <button
                type="button"
                role="menuitem"
                disabled={liczbaUkrytych === 0}
                onClick={() => {
                  setMenuTabeli(false);
                  void store.patchSettings({ hidden_field_ids: [] });
                }}
                className={POZYCJA}
              >
                <Eye aria-hidden="true" className="size-4 flex-none text-muted-foreground" />
                <span className="flex-1">Pokaż ukryte kolumny ({liczbaUkrytych})</span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={settings.sort.length === 0}
                onClick={() => {
                  setMenuTabeli(false);
                  void store.patchSettings({ sort: [] });
                }}
                className={POZYCJA}
              >
                <ListX aria-hidden="true" className="size-4 flex-none text-muted-foreground" />
                <span className="flex-1">Wyczyść sort</span>
              </button>
            </div>
          </ActionPopover>
        </div>
      </div>

      {/* .frame > .inner: ramka 1,5 px, promień 12 px; tabela przewija się poziomo, gdy kolumny się nie mieszczą */}
      <div className="overflow-x-auto rounded-xl border-[1.5px] border-black/[.14] bg-white">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 120 * widocznePola.length + 160 }}>
          <thead>
            <tr>
              {widocznePola.map((f) => {
                // Przesuwanie liczy się po wszystkich kolumnach (także ukrytych), jak kolejność na serwerze
                const indeks = fields.indexOf(f);
                return (
                  <th
                    key={f.id}
                    scope="col"
                    className={`${NAGLOWEK} ${f.type === "number" ? "text-right" : "text-left"}`}
                  >
                    <ColumnMenu
                      field={f}
                      open={menuPola === f.id}
                      // Kolumna czekająca na odpowiedź serwera (tymczasowe id) nie ma jeszcze menu
                      onOpenChange={(o) => {
                        if (o && f.id.startsWith(PREFIKS_TYMCZASOWY)) return;
                        setMenuPola(o ? f.id : null);
                      }}
                      canHide={widocznePola.length > 1}
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
                      firstColumn={indeks === 0}
                      lastColumn={indeks === fields.length - 1}
                      onAddOption={(etykieta) => void store.addOption(f, etykieta)}
                      onRemoveOption={(id) => void store.removeOption(f, id)}
                    />
                    {f.type === "date" && f.config.show_in_calendar === true && (
                      <StatusBadge tone="green" className="ml-1.5 align-middle">
                        w kalendarzu
                      </StatusBadge>
                    )}
                  </th>
                );
              })}
              {/* Ostatni nagłówek: „+” otwiera „Nowe pole” (bez Sekretu); pod nim kolumna akcji wiersza */}
              <th scope="col" className="h-10 w-[150px] border-b border-border px-1 text-left">
                <AddFieldDialog iconTrigger allowSecret={false} onAdd={(input) => void store.addField(input)} />
              </th>
            </tr>
          </thead>
          <tbody>
            {widoczneWiersze.map((r) =>
              editing?.rowId === r.id && !wArkuszu ? (
                <RowEdit
                  key={r.id}
                  fields={widocznePola}
                  values={editing.values}
                  today={today}
                  onChange={store.setEditValue}
                  onSave={() => void store.saveRow()}
                  onCancel={store.cancelEdit}
                  registerSecret={store.registerSecret}
                />
              ) : (
                <RowPreview
                  key={r.id}
                  row={r}
                  fields={widocznePola}
                  today={today}
                  done={zrobione}
                  onOpen={() => {
                    if (editing?.rowId === r.id || r.id.startsWith(PREFIKS_TYMCZASOWY)) return;
                    setWArkuszu(naTelefonie());
                    void store.startEdit(r);
                  }}
                  onEdit={() => {
                    setWArkuszu(naTelefonie());
                    void store.startEdit(r);
                  }}
                  onDelete={() => void store.removeRow(r)}
                />
              ),
            )}
            {editing?.rowId === null && !wArkuszu && (
              <RowEdit
                fields={widocznePola}
                values={editing.values}
                today={today}
                onChange={store.setEditValue}
                onSave={() => void store.saveRow()}
                onCancel={store.cancelEdit}
                registerSecret={store.registerSecret}
              />
            )}
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
        <Button variant="ghost" size="sm" onClick={nowyWiersz} className="text-muted-foreground">
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
