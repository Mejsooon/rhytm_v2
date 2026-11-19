"use client";

import * as React from "react";

import { FIELD_TYPE_META, type PageField } from "../fields";
import type { LoadedPage } from "../load-page";
import { rowsForm, rowsLabel } from "../rows-label";
import { summarize, visibleRows } from "../table-model";
import { TEMPLATES } from "../templates";
import { AddFieldDialog } from "./add-field-dialog";
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

// Strona z szablonu (Books / Projects / Websites.dc.html, Pusta strona bez kart): nagłówek
// z Filtruj / „+ Pole” / „Nowy wiersz”, metadane, przypięte karty, tabela z podglądem i trybem
// edycji wiersza, stopka z podsumowaniami. Na telefonie wiersz edytuje się w arkuszu.
export function TemplatePageView({ data }: { data: LoadedPage }) {
  const { page, today } = data;
  const blok = data.blocks.find((b) => b.type === "table") ?? {
    id: "",
    type: "table" as const,
    position: 0,
    content: {},
    fields: [],
    rows: [],
  };
  const store = useTableStore(blok);
  const { fields, rows, settings, editing } = store;
  // Edycja w arkuszu (telefon) zamiast w wierszu tabeli
  const [wArkuszu, setWArkuszu] = React.useState(false);

  const tytul = page.title.trim() === "" ? "Bez tytułu" : page.title;
  const zywe = rows.filter((r) => r.deletedAt === null);
  const ukryte = new Set(settings.hidden_field_ids);
  const widocznePola = fields.filter((f) => !ukryte.has(f.id));
  const widoczneWiersze = visibleRows(fields, rows, settings, store.tempFilters);

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
    store.addRowDraft();
  }

  // Punkty zaczepienia dla Task 9 (menu kolumny i filtr)
  function otworzMenuKolumny(field: PageField) {
    void field;
  }
  function otworzFiltr() {}

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

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaeaea] px-6 py-3 max-[799px]:px-4">
        <div className="font-mono text-[13px] text-[#666666]">
          Strony <span className="text-[#b0b0b0]">/</span> <span className="text-[#171717]">{tytul}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={otworzFiltr} className={btn}>
            Filtruj
          </button>
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

      <div className="box-border flex w-full max-w-[1160px] flex-col gap-6 px-6 py-7 max-[799px]:px-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">{tytul}</h1>
          <p className="mt-1.5 mb-0 font-mono text-xs text-[#6b6b6b]">{meta}</p>
        </div>

        <PinnedCards
          cards={settings.pinned_cards}
          fields={fields}
          rows={rows}
          today={today}
          bold={page.templateKey !== "websites"}
        />

        <div className="rounded-lg border border-[#eaeaea] max-[1099px]:overflow-x-auto">
          <table
            className="w-full border-collapse text-[13px]"
            style={{ minWidth: Math.max(page.templateKey === "projects" ? 820 : 760, 120 * widocznePola.length + 120) }}
          >
            <thead>
              <tr className="bg-[#fafafa]">
                {widocznePola.map((f) => (
                  <th
                    key={f.id}
                    scope="col"
                    className="border-b border-[#eaeaea] px-3.5 py-2.5 text-left font-medium whitespace-nowrap text-[#666666]"
                  >
                    <button
                      type="button"
                      onClick={() => otworzMenuKolumny(f)}
                      className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] font-medium text-[#666666]"
                    >
                      <span aria-hidden="true" className="mr-1.5 font-mono text-[#6b6b6b]">
                        {FIELD_TYPE_META[f.type].icon}
                      </span>
                      {f.name}
                    </button>
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
                      store.startEdit(r);
                    }}
                    onEdit={() => {
                      setWArkuszu(naTelefonie());
                      store.startEdit(r);
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
                  const podsumowanie = settings.column_summaries[f.id];
                  const tekst = podsumowanie ? summarize(f, widoczneWiersze, podsumowanie, today) : "";
                  return (
                    <td
                      key={f.id}
                      className={`px-3.5 py-2.5 font-mono ${podsumowanie?.kind === "avg" ? "text-[#171717]" : "text-[#6b6b6b]"}`}
                    >
                      {tekst}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

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
