"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { Button, FormDialog, TextField } from "@/components/controls";

import { operatorsFor } from "../table-model";
import { planTypeChange, type FieldType, type PageField } from "../fields";
import { TypeChangeDialog } from "../editor/type-change-dialog";
import type { LoadedBlock, LoadedPage } from "../load-page";
import type { PageSummary } from "../load-pages";
import { PageIcon } from "../page-icon";
import { PageMenu } from "../page-menu";
import { usePagesStore } from "../use-pages-store";
import { rowsForm, rowsLabel } from "../rows-label";
import { visibleRows } from "../table-model";
import { TEMPLATES } from "../templates";
import { AddFieldDialog } from "./add-field-dialog";
import { ColumnMenu } from "./column-menu";
import { FilterPopover } from "./filter-popover";
import { SummaryCell } from "./summary-cell";
import { MRowSheet } from "./mobile/m-row-sheet";
import { PinnedCards } from "./pinned-cards";
import { RowEdit } from "./row-edit";
import { RowPreview } from "./row-preview";
import { PREFIKS_TYMCZASOWY, useTableStore } from "./use-table-store";

// Nazwa szablonu w metadanych pod tytułem — dosłownie z makiet (Books: „Book tracker”)
const NAZWA_SZABLONU = {
  empty: TEMPLATES.empty.name,
  books: "Book tracker",
  projects: TEMPLATES.projects.name,
  websites: TEMPLATES.websites.name,
};

// Zastępczy blok, gdy strona nie ma tabeli (stała — nowy obiekt w renderze zapętliłby resync magazynu)
const PUSTY_BLOK: LoadedBlock = {
  id: "",
  type: "table",
  position: 0,
  content: {},
  fields: [],
  rows: [],
};

// Liczba kolumn w makietach szablonów (min-width tabeli 760 / 820 px)
const KOLUMNY_MAKIETY = 5;

// Przycisk paska telefonu (jak w MEditor)
const PRZYCISK_PASKA =
  "inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent p-0 font-[inherit] text-[#171717] hover:bg-[#f5f5f5]";

// Strona z szablonu (Books / Projects / Websites.dc.html, Pusta strona bez kart): nagłówek
// z Filtruj / „+ Pole” / „Nowy wiersz”, metadane, przypięte karty, tabela z podglądem i trybem
// edycji wiersza, stopka z podsumowaniami. Na telefonie wiersz edytuje się w arkuszu, a nagłówek
// ma powrót do listy i menu strony (jak MEditor). `pages` — cała lista stron dla „Przenieś wyżej / niżej”.
export function TemplatePageView({ data, pages }: { data: LoadedPage; pages?: PageSummary[] }) {
  const { today } = data;
  // Menu strony na telefonie działa na całej liście stron (bez niej — tylko na tej stronie)
  const listaStron = React.useMemo(
    () => (pages?.some((p) => p.id === data.page.id) ? pages : [data.page]),
    [pages, data.page],
  );
  const pagesStore = usePagesStore(listaStron);
  const page = pagesStore.pages.find((p) => p.id === data.page.id) ?? data.page;
  // Telefon: „Zmień nazwę” z menu strony otwiera okno z nazwą
  const [zmianaNazwy, setZmianaNazwy] = React.useState(false);
  const [szkicNazwy, setSzkicNazwy] = React.useState("");
  const blok = data.blocks.find((b) => b.type === "table") ?? PUSTY_BLOK;
  const store = useTableStore(blok);
  const { fields, rows, settings, editing } = store;
  // Edycja w arkuszu (telefon) zamiast w wierszu tabeli
  const [wArkuszu, setWArkuszu] = React.useState(false);
  // Otwarte menu kolumny (id pola), filtr i zmiana typu czekająca na potwierdzenie (ze stratą wartości)
  const [menuPola, setMenuPola] = React.useState<string | null>(null);
  const [filtrOtwarty, setFiltrOtwarty] = React.useState(false);
  const [zmianaTypu, setZmianaTypu] = React.useState<{
    field: PageField;
    type: FieldType;
    plan: ReturnType<typeof planTypeChange>;
  } | null>(null);
  // „Filtruj po tym polu” zamyka menu i od razu otwiera filtr — bez zwrotu fokusu na nagłówek
  const bezZwrotuFokusu = React.useRef(false);

  const tytul = page.title.trim() === "" ? "Bez tytułu" : page.title;
  const zywe = rows.filter((r) => r.deletedAt === null);
  const ukryte = new Set(settings.hidden_field_ids);
  const widocznePola = fields.filter((f) => !ukryte.has(f.id));
  const widoczneWiersze = visibleRows(fields, rows, settings, store.tempFilters);
  // Filtr w edycji (stan klienta) albo zapisany domyślny
  const filtry = store.tempFilters ?? settings.filters;
  const liczbaUkrytych = fields.filter((f) => ukryte.has(f.id)).length;

  // Metadane: „{N} wierszy · {M} pól · szablon „…” · sort: …”
  const formaPol = rowsForm(fields.length);
  const pola = `${fields.length} ${formaPol === "one" ? "pole" : formaPol === "few" ? "pola" : "pól"}`;
  const polaSortu = settings.sort
    .map((s) => fields.find((f) => f.id === s.field_id)?.name.toLowerCase())
    .filter((n): n is string => n !== undefined);
  const szablon = page.templateKey ? NAZWA_SZABLONU[page.templateKey] : "Pusta strona";
  const meta = `${rowsLabel(zywe.length)} · ${pola} · szablon „${szablon}”${
    polaSortu.length > 0 ? ` · sort: ${polaSortu.join(", ")}` : ""
  }`;

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

  const btn =
    "cursor-pointer rounded-md border border-[#e0e0e0] bg-white px-3 py-[7px] font-[inherit] text-sm text-[#171717] max-[799px]:min-h-11";
  const kolumnaAkcji = <th scope="col" className="w-[120px] border-b border-[#eaeaea] px-3.5 py-2.5" />;

  function zapiszNazwe(e: React.FormEvent) {
    e.preventDefault();
    setZmianaNazwy(false);
    if (szkicNazwy !== page.title) void pagesStore.rename(page.id, szkicNazwy);
  }

  return (
    <>
      {/* Telefon: powrót do listy stron i menu strony (jak w MEditor) */}
      <div className="flex min-h-[60px] flex-none items-center gap-1 p-2 min-[800px]:hidden">
        <Link href="/strony" aria-label="Strony" className={PRZYCISK_PASKA}>
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        <div className="flex-1" />
        <PageMenu
          page={page}
          pages={pagesStore.pages}
          store={pagesStore}
          onRename={() => {
            setSzkicNazwy(page.title);
            setZmianaNazwy(true);
          }}
          sheet
          triggerLabel="Menu strony"
          triggerClassName={PRZYCISK_PASKA}
        />
      </div>
      <FormDialog
        open={zmianaNazwy}
        onOpenChange={setZmianaNazwy}
        title="Zmień nazwę"
        footer={
          <>
            <Button onClick={() => setZmianaNazwy(false)}>Anuluj</Button>
            <Button variant="primary" type="submit" form="zmiana-nazwy-strony">
              Zapisz
            </Button>
          </>
        }
      >
        <form id="zmiana-nazwy-strony" onSubmit={zapiszNazwe}>
          <TextField
            label="Nazwa strony"
            value={szkicNazwy}
            onChange={(e) => setSzkicNazwy(e.target.value)}
            placeholder="Bez tytułu"
            autoFocus
          />
        </form>
      </FormDialog>

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaeaea] px-6 py-3 max-[799px]:px-4">
        <div className="font-mono text-[13px] text-[#666666] max-[799px]:hidden">
          Strony <span className="text-[#b0b0b0]">/</span> <span className="text-[#171717]">{tytul}</span>
        </div>
        <div className="flex gap-2">
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
            triggerClassName={btn}
          />
          <AddFieldDialog onAdd={(input) => void store.addField(input)} />
          <button
            type="button"
            onClick={nowyWiersz}
            className="cursor-pointer rounded-md border border-[#171717] bg-[#171717] px-3 py-[7px] font-[inherit] text-sm font-medium text-white max-[799px]:min-h-11"
          >
            Nowy wiersz
          </button>
        </div>
      </header>

      <div className="box-border flex w-full flex-col gap-6 px-6 py-7 max-[799px]:px-4">
        <div>
          {/* Telefon: ikona strony przy tytule (web bez zmian) */}
          <h1 className="m-0 flex items-center gap-2.5 text-2xl font-semibold tracking-[-0.02em]">
            <span className="min-[800px]:hidden">
              <PageIcon icon={page.icon} size={26} />
            </span>
            {tytul}
          </h1>
          <p className="mt-1.5 mb-0 font-mono text-xs text-[#6b6b6b]">
            {meta}
            {liczbaUkrytych > 0 && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => void store.patchSettings({ hidden_field_ids: [] })}
                  className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[inherit] underline decoration-dotted underline-offset-2 hover:text-[#171717] max-[799px]:min-h-11"
                >
                  {`· ${liczbaUkrytych} ${rowsForm(liczbaUkrytych) === "many" ? "ukrytych" : "ukryte"}`}
                </button>
              </>
            )}
          </p>
        </div>

        <PinnedCards
          cards={settings.pinned_cards}
          fields={fields}
          rows={widoczneWiersze}
          today={today}
          bold={page.templateKey !== "websites"}
        />

        {/* Przewijanie poziome poniżej 1100 px; przy większej liczbie kolumn niż w makiecie — zawsze */}
        <div
          className={`rounded-lg border border-[#eaeaea] ${
            widocznePola.length > KOLUMNY_MAKIETY ? "overflow-x-auto" : "max-[1099px]:overflow-x-auto"
          }`}
        >
          <table
            className="w-full border-collapse text-[13px]"
            style={{ minWidth: page.templateKey === "projects" ? 820 : 760 }}
          >
            <thead>
              <tr className="bg-[#fafafa]">
                {widocznePola.map((f) => (
                  <th
                    key={f.id}
                    scope="col"
                    className="border-b border-[#eaeaea] px-3.5 py-2.5 text-left font-medium whitespace-nowrap text-[#666666]"
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
                    />
                    {f.type === "date" && f.config.show_in_calendar === true && (
                      <span className="ml-1.5 rounded-[4px] border border-[#bbe5cc] px-[5px] py-px font-mono text-[10px] text-[#15803d]">
                        w kalendarzu
                      </span>
                    )}
                  </th>
                ))}
                {kolumnaAkcji}
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
                />
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#fafafa]">
                {widocznePola.map((f, i) => {
                  if (i === 0) {
                    return (
                      <td key={f.id} className="px-3.5 py-2.5">
                        <button
                          type="button"
                          onClick={nowyWiersz}
                          className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[#666666] max-[799px]:min-h-11"
                        >
                          + Nowy wiersz
                        </button>
                      </td>
                    );
                  }
                  return (
                    <SummaryCell
                      key={f.id}
                      field={f}
                      rows={widoczneWiersze}
                      summary={settings.column_summaries[f.id]}
                      today={today}
                    />
                  );
                })}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
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
    </>
  );
}
