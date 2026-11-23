"use client";

// Stan tabeli strony z szablonu: pola, wiersze, ustawienia, filtr tymczasowy i edytowany wiersz.
// Każda zmiana od razu zmienia widok; błąd zapisu cofa ją i pokazuje toast. Nowe dane z serwera
// zastępują kopię bez gubienia wierszy/pól tymczasowych i zapisów w toku (wzorzec „poprzednie props”).
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  addField as addFieldAction,
  addRow,
  changeFieldType,
  deleteField,
  deleteRow,
  reorderFields,
  restoreRow,
  saveTableSettings,
  updateBlockContent,
  updateField,
  updateRow,
} from "../actions";
import {
  PALETA,
  normalizeValue,
  planTypeChange,
  type CellValue,
  type FieldConfig,
  type FieldOption,
  type FieldType,
  type PageField,
} from "../fields";
import type { LoadedBlock } from "../load-page";
import { BLAD_ZAPISU, SEJF_ZMIENIL_SIE } from "../messages";
import type { FilterCond, PageRow, TableSettings } from "../table-model";

export type TableStore = ReturnType<typeof useTableStore>;

// Wiersz albo pole czekające na odpowiedź serwera ma tymczasowe id z tym prefiksem
export const PREFIKS_TYMCZASOWY = "tmp-";

// Rejestracja z RowEdit: czy hasło zostało zmienione i funkcja szyfrująca zmienione pola Sekret
// (zwraca zaszyfrowane wartości albo null, gdy szyfrowanie się nie udało). Bez tekstu jawnego.
export type SecretRegistration = {
  changed: boolean;
  encrypt: () => Promise<Record<string, unknown> | null>;
};

// Edytowany wiersz: rowId null = nowy wiersz (szkic, jeszcze bez zapisu); original to wartości
// z chwili otwarcia edycji — zapis wysyła tylko klucze, które się od nich różnią
export type RowEditing = {
  rowId: string | null;
  values: Record<string, unknown>;
  original: Record<string, unknown>;
};

// onStaleGeneration: wołane, gdy serwer odrzuci zapis Sekretu z powodu innej generacji sejfu
export function useTableStore(block: LoadedBlock, onStaleGeneration?: () => void) {
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
  // Rejestracja pól Sekret z otwartego RowEdit i blokada drugiego zapisu w trakcie szyfrowania / zapisu
  const sekretRef = useRef<SecretRegistration | null>(null);
  const zapisujeRef = useRef(false);

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
  // Nazwa tabeli z content.name; nowa nazwa z serwera zastępuje lokalną
  const nazwaZSerwera = typeof block.content.name === "string" ? block.content.name : "";
  const [tableName, setTableName] = useState(nazwaZSerwera);
  const [zrodloNazwy, setZrodloNazwy] = useState(nazwaZSerwera);
  if (zrodloNazwy !== nazwaZSerwera) {
    setZrodloNazwy(nazwaZSerwera);
    setTableName(nazwaZSerwera);
  }

  const posortowanePola = [...fields].sort((a, b) => a.position - b.position);

  // Otwarty szkic różni się od wartości z chwili otwarcia (nowy wiersz: od wartości startowych)
  function szkicZmieniony(): boolean {
    if (!editing) return false;
    if (sekretRef.current?.changed) return true;
    const klucze = new Set([...Object.keys(editing.values), ...Object.keys(editing.original)]);
    return [...klucze].some((k) => !Object.is(editing.values[k], editing.original[k]));
  }

  // Przed otwarciem innego wiersza zmieniony szkic zapisuje się zwykłym „Zapisz”; nietknięty po prostu
  // się zamyka. Błąd zapisu (toast już był) przywraca szkic i nie przełącza wiersza.
  async function zapiszSzkic(): Promise<boolean> {
    const e = editing;
    const udane = await saveRow();
    // Szkic przywrócony już przez zapiszWiersz (z szyfrogramem nowego hasła) zostaje bez zmian
    if (!udane) setEditing((cur) => cur ?? e);
    return udane;
  }

  // Tryb edycji istniejącego wiersza (tylko jeden naraz; wiersz bez prawdziwego id czeka)
  async function startEdit(row: PageRow) {
    if (row.id.startsWith(PREFIKS_TYMCZASOWY)) return;
    if (szkicZmieniony() && !(await zapiszSzkic())) return;
    setEditing({ rowId: row.id, values: { ...row.values }, original: { ...row.values } });
  }

  // „Nowy wiersz”: szkic w trybie edycji na końcu tabeli, z opcjami domyślnymi pól (z makiet).
  // original = wartości startowe, żeby nietknięty szkic nie liczył się jako zmieniony
  async function addRowDraft() {
    if (szkicZmieniony() && !(await zapiszSzkic())) return;
    const values: Record<string, unknown> = {};
    for (const f of fields) {
      const domyslna = f.config.default_option;
      if (domyslna !== undefined && (f.config.options ?? []).some((o) => o.id === domyslna)) {
        values[f.id] = domyslna;
      }
    }
    setEditing({ rowId: null, values, original: { ...values } });
  }

  function setEditValue(fieldId: string, value: unknown) {
    setEditing((e) => (e ? { ...e, values: { ...e.values, [fieldId]: value } } : e));
  }

  function cancelEdit() {
    setEditing(null);
  }

  // „Zapisz”: wartości przez normalizeValue, pusty tytuł → empty_label (jak na serwerze).
  // Istniejący wiersz wysyła tylko zmienione komórki — nietknięte (także „brudne” z bazy) zostają.
  // Zwraca false, gdy zapis się nie udał (zmiana cofnięta, toast pokazany).
  // Pola Sekret zmienione w RowEdit są szyfrowane przed zapisem (przy „Zapisz”, przełączaniu wiersza i „Nowy wiersz”);
  // nie uda się szyfrowanie → nic się nie zapisuje i edycja zostaje. Drugi zapis w trakcie pierwszego jest ignorowany.
  async function saveRow(): Promise<boolean> {
    if (zapisujeRef.current) return false;
    zapisujeRef.current = true;
    try {
      let nadpisane: Record<string, unknown> | undefined;
      if (sekretRef.current?.changed) {
        const zaszyfrowane = await sekretRef.current.encrypt();
        if (zaszyfrowane === null) return false;
        nadpisane = zaszyfrowane;
      }
      return await zapiszWiersz(nadpisane);
    } finally {
      zapisujeRef.current = false;
    }
  }

  // nadpisane: zaszyfrowane wartości pól Sekret (SecretValue albo null) — tekst jawny nigdy tu nie trafia.
  async function zapiszWiersz(nadpisane?: Record<string, unknown>): Promise<boolean> {
    const e = editing;
    if (!e) return true;
    const nowe: Record<string, CellValue> = {};
    const wartosci = nadpisane ? { ...e.values, ...nadpisane } : e.values;
    for (const f of posortowanePola) {
      if (f.id.startsWith(PREFIKS_TYMCZASOWY)) continue;
      const zmieniona = !Object.is(wartosci[f.id], e.original[f.id]);
      if (e.rowId !== null && !zmieniona) continue;
      let v = normalizeValue(f, wartosci[f.id]);
      if (f.isTitle && v === null) v = f.config.empty_label ?? "Bez tytułu";
      nowe[f.id] = v;
    }
    setEditing(null);
    if (e.rowId !== null && Object.keys(nowe).length === 0) return true;

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
        // Inna generacja sejfu: blokujemy go i pokazujemy komunikat z serwera
        if (wynik && !wynik.ok && wynik.code === "stale_generation") {
          onStaleGeneration?.();
          toast.error(SEJF_ZMIENIL_SIE);
          // Edycja zostaje otwarta z dotychczasowymi wartościami (sejf i tak się blokuje)
          setEditing((cur) => cur ?? e);
        } else {
          toast.error(BLAD_ZAPISU);
          // Edycja zostaje otwarta z szyfrogramem nowego hasła (nigdy z tekstem jawnym): pole pokaże
          // NOWE hasło, a ponowne „Zapisz” je wyśle
          setEditing((cur) => cur ?? { ...e, values: wartosci });
        }
        return false;
      }
      const prawdziwy = wynik.row;
      setRows((l) => {
        // Odświeżenie danych mogło już dodać prawdziwy wiersz — bez duplikatów
        const bezDuplikatu = l.filter((r) => r.id !== prawdziwy.id);
        return bezDuplikatu.some((r) => r.id === tymczasoweId)
          ? bezDuplikatu.map((r) => (r.id === tymczasoweId ? prawdziwy : r))
          : [...bezDuplikatu, prawdziwy];
      });
      return true;
    }

    const rowId = e.rowId;
    const stary = rows.find((r) => r.id === rowId);
    if (!stary) return true;
    const poprzednie: Record<string, unknown> = {};
    for (const k of Object.keys(nowe)) poprzednie[k] = stary.values[k];
    setRows((l) => l.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, ...nowe } } : r)));

    const wToku = wierszeWToku.current.get(rowId) ?? { n: 0, zmiany: {} };
    wToku.n += 1;
    Object.assign(wToku.zmiany, nowe);
    wierszeWToku.current.set(rowId, wToku);
    let udane = false;
    let nieAktualnySejf = false;
    try {
      const wynik = await updateRow(rowId, nowe);
      udane = wynik.ok;
      nieAktualnySejf = !wynik.ok && wynik.code === "stale_generation";
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
      if (nieAktualnySejf) {
        // Inna generacja sejfu: blokujemy go i pokazujemy komunikat z serwera
        onStaleGeneration?.();
        toast.error(SEJF_ZMIENIL_SIE);
        // Edycja zostaje otwarta z dotychczasowymi wartościami (o ile nie otwarto już innego wiersza)
        setEditing((cur) => cur ?? e);
      } else {
        toast.error(BLAD_ZAPISU);
        // Edycja zostaje otwarta z szyfrogramem nowego hasła (o ile nie otwarto już innego wiersza):
        // pole pokaże NOWE hasło, a ponowne „Zapisz” wyśle je jeszcze raz (różni się od original)
        setEditing((cur) => cur ?? { ...e, values: wartosci });
      }
    }
    return udane;
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
  async function patchSettings(patch: Partial<TableSettings>): Promise<boolean> {
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
    return udane;
  }

  // Plan zmiany typu kolumny z menu; null, gdy któryś wiersz czeka jeszcze na odpowiedź serwera
  // (zapisałby zmiany w starym typie)
  function planTypeChangeFor(field: PageField, type: FieldType) {
    if (rows.some((r) => r.id.startsWith(PREFIKS_TYMCZASOWY))) return null;
    return planTypeChange(
      field,
      type,
      rows.map((r) => ({ id: r.id, values: r.values })),
    );
  }

  // Zapis nowego typu: wartości wszystkich wierszy i pole w jednym RPC. Bez strat — od razu
  // (błąd cofa tylko tę kolumnę), ze stratą — dopiero po odpowiedzi serwera (okno potwierdzenia czeka)
  async function applyTypeChange(
    field: PageField,
    type: FieldType,
    plan: NonNullable<ReturnType<typeof planTypeChangeFor>>,
    czekajNaSerwer: boolean,
  ): Promise<boolean> {
    const stareWartosci = new Map(rows.map((r) => [r.id, r.values[field.id]]));
    const zastosuj = () => {
      setFields((l) => l.map((f) => (f.id === field.id ? { ...f, type, config: plan.config } : f)));
      setRows((l) =>
        l.map((r) =>
          r.id in plan.values ? { ...r, values: { ...r.values, [field.id]: plan.values[r.id] } } : r,
        ),
      );
    };
    if (!czekajNaSerwer) zastosuj();

    const wartosci: Record<string, CellValue> = {};
    for (const [id, v] of Object.entries(plan.values)) {
      if (!id.startsWith(PREFIKS_TYMCZASOWY)) wartosci[id] = v;
    }
    polaWToku.current += 1;
    let udane = false;
    try {
      udane = (await changeFieldType(field.id, type, plan.config, wartosci)).ok;
    } catch {
      udane = false;
    }
    polaWToku.current -= 1;
    if (!udane) {
      if (!czekajNaSerwer) {
        // Cofamy tylko to, co nadal jest ze zmiany: równoległa edycja komórki albo pola zostaje
        setFields((l) =>
          l.map((f) =>
            f.id === field.id && f.type === type && f.config === plan.config
              ? { ...f, type: field.type, config: field.config }
              : f,
          ),
        );
        setRows((l) =>
          l.map((r) =>
            stareWartosci.has(r.id) && Object.is(r.values[field.id], plan.values[r.id])
              ? { ...r, values: { ...r.values, [field.id]: stareWartosci.get(r.id) } }
              : r,
          ),
        );
      }
      toast.error(BLAD_ZAPISU);
      return false;
    }
    if (czekajNaSerwer) zastosuj();
    return true;
  }

  // Nazwa tabeli (content.name): od razu lokalnie, zapis z zachowaniem content.settings; błąd cofa
  async function renameTable(name: string): Promise<boolean> {
    if (name === tableName) return true;
    const poprzednia = tableName;
    setTableName(name);
    let udane = false;
    try {
      udane = (await updateBlockContent(block.id, { ...block.content, name })).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setTableName(poprzednia);
      toast.error(BLAD_ZAPISU);
    }
    return udane;
  }

  // Przesunięcie kolumny o jedno miejsce; kolejność zapisuje jedno RPC (jak w edytorze)
  async function moveField(field: PageField, dir: -1 | 1): Promise<boolean> {
    // Kolumny bez prawdziwego id nie wejdą jeszcze w kolejność na serwerze
    if (posortowanePola.some((f) => f.id.startsWith(PREFIKS_TYMCZASOWY))) return false;
    const i = posortowanePola.findIndex((f) => f.id === field.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= posortowanePola.length) return false;
    const nowaKolejnosc = [...posortowanePola];
    [nowaKolejnosc[i], nowaKolejnosc[j]] = [nowaKolejnosc[j], nowaKolejnosc[i]];
    const poprzednie = fields;
    setFields(nowaKolejnosc.map((f, indeks) => ({ ...f, position: indeks })));
    polaWToku.current += 1;
    let udane = false;
    try {
      udane = (await reorderFields(block.id, nowaKolejnosc.map((f) => f.id))).ok;
    } catch {
      udane = false;
    }
    polaWToku.current -= 1;
    if (!udane) {
      setFields(poprzednie);
      toast.error(BLAD_ZAPISU);
    }
    return udane;
  }

  // Nowa opcja Wyboru: kolor to następny z PALETA; etykieta już istniejąca (bez wielkości liter) nic nie robi
  async function addOption(field: PageField, label: string): Promise<boolean> {
    const etykieta = label.trim();
    const opcje = field.config.options ?? [];
    if (etykieta === "" || opcje.some((o) => o.label.trim().toLowerCase() === etykieta.toLowerCase())) {
      return false;
    }
    const nowa: FieldOption = {
      id: crypto.randomUUID(),
      label: etykieta,
      color: PALETA[opcje.length % PALETA.length],
    };
    return patchField(field, { config: { ...field.config, options: [...opcje, nowa] } });
  }

  // Usunięcie opcji Wyboru; opcja domyślna nowego wiersza znika razem z nią
  async function removeOption(field: PageField, optionId: string): Promise<boolean> {
    const config: FieldConfig = {
      ...field.config,
      options: (field.config.options ?? []).filter((o) => o.id !== optionId),
    };
    if (config.default_option === optionId) delete config.default_option;
    return patchField(field, { config });
  }

  // Zmiana nazwy albo konfiguracji pola (np. „Pokaż w kalendarzu”): od razu lokalnie, błąd cofa
  async function patchField(field: PageField, patch: { name?: string; config?: FieldConfig }): Promise<boolean> {
    setFields((l) => l.map((f) => (f.id === field.id ? { ...f, ...patch } : f)));
    polaWToku.current += 1;
    let udane = false;
    try {
      udane = (await updateField(field.id, patch)).ok;
    } catch {
      udane = false;
    }
    polaWToku.current -= 1;
    if (!udane) {
      setFields((l) =>
        l.map((f) =>
          f.id === field.id
            ? {
                ...f,
                ...(patch.name !== undefined ? { name: field.name } : {}),
                ...(patch.config !== undefined ? { config: field.config } : {}),
              }
            : f,
        ),
      );
      toast.error(BLAD_ZAPISU);
    }
    return udane;
  }

  // „Usuń pole”: kolumna znika od razu razem ze śladami w ustawieniach (jak w RPC delete_field);
  // błąd przywraca pole i ustawienia
  async function removeField(field: PageField) {
    if (field.isTitle || field.id.startsWith(PREFIKS_TYMCZASOWY)) return;
    // Wpisy ustawień i filtru tymczasowego, które usunięcie zabiera — tylko je cofamy przy błędzie
    const nalezy = (id: string) => id === field.id;
    const zabranySort = settings.sort.filter((k) => nalezy(k.field_id));
    const sortPoUsunieciu = JSON.stringify(settings.sort.filter((k) => !nalezy(k.field_id)));
    const zabraneFiltry = settings.filters.filter((c) => nalezy(c.field_id));
    const zabranyUkryty = settings.hidden_field_ids.includes(field.id);
    const zabranePodsumowania = Object.entries(settings.column_summaries).filter(
      ([id, p]) => nalezy(id) || p.where?.field_id === field.id,
    );
    const zabraneKarty = settings.pinned_cards.filter(
      (c) => nalezy(c.field_id) || c.date_field_id === field.id || c.title_field_id === field.id,
    );
    const zabraneFiltryTymczasowe = (tempFilters ?? []).filter((c) => nalezy(c.field_id));

    setFields((l) => l.filter((f) => f.id !== field.id));
    setSettings((s) => ({
      ...s,
      sort: s.sort.filter((k) => !nalezy(k.field_id)),
      filters: s.filters.filter((c) => !nalezy(c.field_id)),
      hidden_field_ids: s.hidden_field_ids.filter((id) => id !== field.id),
      column_summaries: Object.fromEntries(
        Object.entries(s.column_summaries).filter(
          ([id, podsumowanie]) => id !== field.id && podsumowanie.where?.field_id !== field.id,
        ),
      ),
      pinned_cards: s.pinned_cards.filter(
        (c) =>
          c.field_id !== field.id && c.date_field_id !== field.id && c.title_field_id !== field.id,
      ),
    }));
    setTempFilters((t) => (t ? t.filter((c) => !nalezy(c.field_id)) : t));
    polaWToku.current += 1;
    ustawieniaWToku.current += 1;
    let udane = false;
    try {
      udane = (await deleteField(field.id)).ok;
    } catch {
      udane = false;
    }
    polaWToku.current -= 1;
    ustawieniaWToku.current -= 1;
    if (!udane) {
      setFields((l) => (l.some((f) => f.id === field.id) ? l : [...l, field]));
      setSettings((s) => ({
        ...s,
        // Sort wraca tylko, jeśli w międzyczasie nie został zmieniony
        sort: JSON.stringify(s.sort) === sortPoUsunieciu ? [...s.sort, ...zabranySort] : s.sort,
        filters: [...s.filters, ...zabraneFiltry],
        hidden_field_ids:
          zabranyUkryty && !s.hidden_field_ids.includes(field.id)
            ? [...s.hidden_field_ids, field.id]
            : s.hidden_field_ids,
        column_summaries: {
          ...Object.fromEntries(zabranePodsumowania.filter(([id]) => !(id in s.column_summaries))),
          ...s.column_summaries,
        },
        pinned_cards: [...s.pinned_cards, ...zabraneKarty],
      }));
      if (zabraneFiltryTymczasowe.length > 0) {
        setTempFilters((t) => (t ? [...t, ...zabraneFiltryTymczasowe] : t));
      }
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
    registerSecret: (r: SecretRegistration | null) => {
      sekretRef.current = r;
    },
    addRowDraft,
    setEditValue,
    cancelEdit,
    saveRow,
    removeRow,
    addField,
    patchSettings,
    setTempFilters,
    planTypeChangeFor,
    applyTypeChange,
    patchField,
    removeField,
    tableName,
    renameTable,
    moveField,
    addOption,
    removeOption,
  };
}
