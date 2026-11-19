"use client";

// Stan tabeli strony z szablonu: pola, wiersze, ustawienia, filtr tymczasowy i edytowany wiersz.
// Każda zmiana od razu zmienia widok; błąd zapisu cofa ją i pokazuje toast. Nowe dane z serwera
// zastępują kopię bez gubienia wierszy/pól tymczasowych i zapisów w toku (wzorzec „poprzednie props”).
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  addField as addFieldAction,
  addRow,
  deleteRow,
  restoreRow,
  saveTableSettings,
  updateRow,
} from "../actions";
import { normalizeValue, type CellValue, type FieldConfig, type FieldType, type PageField } from "../fields";
import type { LoadedBlock } from "../load-page";
import { BLAD_ZAPISU } from "../messages";
import type { FilterCond, PageRow, TableSettings } from "../table-model";

export type TableStore = ReturnType<typeof useTableStore>;

// Wiersz albo pole czekające na odpowiedź serwera ma tymczasowe id z tym prefiksem
export const PREFIKS_TYMCZASOWY = "tmp-";

// Edytowany wiersz: rowId null = nowy wiersz (szkic, jeszcze bez zapisu)
export type RowEditing = { rowId: string | null; values: Record<string, unknown> };

export function useTableStore(block: LoadedBlock) {
  // Ustawienia z content.settings; brakujące klucze dostają puste wartości
  const surowe = (block.content.settings ?? {}) as Partial<TableSettings>;
  const zSerwera: TableSettings = {
    sort: Array.isArray(surowe.sort) ? surowe.sort : [],
    filters: Array.isArray(surowe.filters) ? surowe.filters : [],
    hidden_field_ids: Array.isArray(surowe.hidden_field_ids) ? surowe.hidden_field_ids : [],
    column_summaries:
      surowe.column_summaries && typeof surowe.column_summaries === "object"
        ? surowe.column_summaries
        : {},
    pinned_cards: Array.isArray(surowe.pinned_cards) ? surowe.pinned_cards : [],
  };

  const [fields, setFields] = useState<PageField[]>(block.fields);
  const [rows, setRows] = useState<PageRow[]>(block.rows);
  const [settings, setSettings] = useState<TableSettings>(zSerwera);
  const [zrodloPol, setZrodloPol] = useState(block.fields);
  const [zrodloWierszy, setZrodloWierszy] = useState(block.rows);
  const [zrodloUstawien, setZrodloUstawien] = useState(block.content.settings);
  const [tempFilters, setTempFilters] = useState<FilterCond[] | null>(null);
  const [editing, setEditing] = useState<RowEditing | null>(null);

  // Zapisy w toku: pola i ustawienia (liczniki), wiersze (id → zmiany do nałożenia na dane z serwera)
  const polaWToku = useRef(0);
  const ustawieniaWToku = useRef(0);
  const wierszeWToku = useRef(new Map<string, { n: number; zmiany: Record<string, unknown> }>());
  const licznik = useRef(0);

  if (zrodloPol !== block.fields) {
    setZrodloPol(block.fields);
    setFields((l) =>
      polaWToku.current > 0
        ? l
        : [...block.fields, ...l.filter((f) => f.id.startsWith(PREFIKS_TYMCZASOWY))],
    );
  }
  if (zrodloWierszy !== block.rows) {
    setZrodloWierszy(block.rows);
    setRows((l) => [
      ...block.rows.map((r) => {
        const wToku = wierszeWToku.current.get(r.id);
        return wToku ? { ...r, values: { ...r.values, ...wToku.zmiany } } : r;
      }),
      ...l.filter((r) => r.id.startsWith(PREFIKS_TYMCZASOWY)),
    ]);
  }
  if (zrodloUstawien !== block.content.settings) {
    setZrodloUstawien(block.content.settings);
    setSettings((s) => (ustawieniaWToku.current > 0 ? s : zSerwera));
  }

  const posortowanePola = [...fields].sort((a, b) => a.position - b.position);

  // Tryb edycji istniejącego wiersza (tylko jeden naraz; wiersz bez prawdziwego id czeka)
  function startEdit(row: PageRow) {
    if (row.id.startsWith(PREFIKS_TYMCZASOWY)) return;
    setEditing({ rowId: row.id, values: { ...row.values } });
  }

  // „Nowy wiersz”: szkic w trybie edycji na końcu tabeli
  function addRowDraft() {
    setEditing({ rowId: null, values: {} });
  }

  function setEditValue(fieldId: string, value: unknown) {
    setEditing((e) => (e ? { ...e, values: { ...e.values, [fieldId]: value } } : e));
  }

  function cancelEdit() {
    setEditing(null);
  }

  // „Zapisz”: wartości przez normalizeValue, pusty tytuł → empty_label (jak na serwerze)
  async function saveRow() {
    const e = editing;
    if (!e) return;
    const nowe: Record<string, CellValue> = {};
    for (const f of posortowanePola) {
      if (f.id.startsWith(PREFIKS_TYMCZASOWY)) continue;
      let v = normalizeValue(f, e.values[f.id]);
      if (f.isTitle && v === null) v = f.config.empty_label ?? "Bez tytułu";
      nowe[f.id] = v;
    }
    setEditing(null);

    if (e.rowId === null) {
      const tymczasoweId = `${PREFIKS_TYMCZASOWY}w${++licznik.current}`;
      const pozycja = rows.reduce((m, r) => Math.max(m, r.position), -1) + 1;
      setRows((l) => [...l, { id: tymczasoweId, values: nowe, position: pozycja, deletedAt: null }]);
      let wynik: Awaited<ReturnType<typeof addRow>> | null = null;
      try {
        wynik = await addRow(block.id, nowe);
      } catch {
        wynik = null;
      }
      if (!wynik || !wynik.ok) {
        setRows((l) => l.filter((r) => r.id !== tymczasoweId));
        toast.error(BLAD_ZAPISU);
        return;
      }
      const prawdziwy = wynik.row;
      setRows((l) => {
        // Odświeżenie danych mogło już dodać prawdziwy wiersz — bez duplikatów
        const bezDuplikatu = l.filter((r) => r.id !== prawdziwy.id);
        return bezDuplikatu.some((r) => r.id === tymczasoweId)
          ? bezDuplikatu.map((r) => (r.id === tymczasoweId ? prawdziwy : r))
          : [...bezDuplikatu, prawdziwy];
      });
      return;
    }

    const rowId = e.rowId;
    const stary = rows.find((r) => r.id === rowId);
    if (!stary) return;
    const poprzednie: Record<string, unknown> = {};
    for (const k of Object.keys(nowe)) poprzednie[k] = stary.values[k];
    setRows((l) => l.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, ...nowe } } : r)));

    const wToku = wierszeWToku.current.get(rowId) ?? { n: 0, zmiany: {} };
    wToku.n += 1;
    Object.assign(wToku.zmiany, nowe);
    wierszeWToku.current.set(rowId, wToku);
    let udane = false;
    try {
      udane = (await updateRow(rowId, nowe)).ok;
    } catch {
      udane = false;
    }
    wToku.n -= 1;
    if (wToku.n === 0) wierszeWToku.current.delete(rowId);
    if (!udane) {
      // Cofamy tylko komórki tego zapisu
      setRows((l) =>
        l.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, ...poprzednie } } : r)),
      );
      toast.error(BLAD_ZAPISU);
    }
  }

  // „Usuń”: wiersz od razu znika, toast „Usunięto” z „Cofnij” (restoreRow)
  async function removeRow(row: PageRow) {
    if (row.id.startsWith(PREFIKS_TYMCZASOWY)) return;
    setEditing((e) => (e?.rowId === row.id ? null : e));
    setRows((l) => l.filter((r) => r.id !== row.id));
    let udane = false;
    try {
      udane = (await deleteRow(row.id)).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setRows((l) => (l.some((r) => r.id === row.id) ? l : [...l, row]));
      toast.error(BLAD_ZAPISU);
      return;
    }
    toast("Usunięto", {
      action: {
        label: "Cofnij",
        onClick: async () => {
          setRows((l) => (l.some((r) => r.id === row.id) ? l : [...l, row]));
          let przywrocono = false;
          try {
            przywrocono = (await restoreRow(row.id)).ok;
          } catch {
            przywrocono = false;
          }
          if (!przywrocono) {
            setRows((l) => l.filter((r) => r.id !== row.id));
            toast.error(BLAD_ZAPISU);
          }
        },
      },
    });
  }

  // „Dodaj pole” w AddField: kolumna na końcu, do odpowiedzi serwera z tymczasowym id
  async function addField(input: { name: string; type: FieldType; config: FieldConfig }) {
    const tymczasoweId = `${PREFIKS_TYMCZASOWY}k${++licznik.current}`;
    const pozycja = fields.reduce((m, f) => Math.max(m, f.position), -1) + 1;
    setFields((l) => [
      ...l,
      { id: tymczasoweId, name: input.name, type: input.type, config: input.config, position: pozycja, isTitle: false },
    ]);
    polaWToku.current += 1;
    let wynik: Awaited<ReturnType<typeof addFieldAction>> | null = null;
    try {
      wynik = await addFieldAction(block.id, input);
    } catch {
      wynik = null;
    }
    polaWToku.current -= 1;
    if (!wynik || !wynik.ok) {
      setFields((l) => l.filter((f) => f.id !== tymczasoweId));
      toast.error(BLAD_ZAPISU);
      return;
    }
    const prawdziwe = wynik.field;
    setFields((l) => {
      const bezDuplikatu = l.filter((f) => f.id !== prawdziwe.id);
      return bezDuplikatu.some((f) => f.id === tymczasoweId)
        ? bezDuplikatu.map((f) => (f.id === tymczasoweId ? prawdziwe : f))
        : [...bezDuplikatu, prawdziwe];
    });
  }

  // Zmiana ustawień (sort, ukryte kolumny, podsumowania…): od razu lokalnie, błąd cofa te klucze
  async function patchSettings(patch: Partial<TableSettings>) {
    const poprzednie: Partial<TableSettings> = {};
    for (const k of Object.keys(patch) as (keyof TableSettings)[]) {
      (poprzednie as Record<string, unknown>)[k] = settings[k];
    }
    setSettings((s) => ({ ...s, ...patch }));
    ustawieniaWToku.current += 1;
    let udane = false;
    try {
      udane = (await saveTableSettings(block.id, patch)).ok;
    } catch {
      udane = false;
    }
    ustawieniaWToku.current -= 1;
    if (!udane) {
      setSettings((s) => ({ ...s, ...poprzednie }));
      toast.error(BLAD_ZAPISU);
    }
  }

  return {
    fields: posortowanePola,
    rows,
    settings,
    tempFilters,
    editing,
    startEdit,
    addRowDraft,
    setEditValue,
    cancelEdit,
    saveRow,
    removeRow,
    addField,
    patchSettings,
    setTempFilters,
  };
}
