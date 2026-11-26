"use client";

// Stan tabeli strony z szablonu: pola, wiersze, ustawienia, filtr tymczasowy i edytowany wiersz.
// Każda zmiana od razu zmienia widok; błąd zapisu cofa ją i pokazuje toast. Nowe dane z serwera
// zastępują kopię bez gubienia wierszy/pól tymczasowych i zapisów w toku (wzorzec „poprzednie props”).
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { BLAD_ZAPISU, SEJF_ZMIENIL_SIE, ZAPIS_W_TOKU } from "../messages";
import type { FilterCond, PageRow, TableSettings, TableView } from "../table-model";
import { effectiveView, type EffectiveView } from "../table-views";
import { templateDefaults, type TemplateKey } from "../templates";

export type TableStore = ReturnType<typeof useTableStore>;

// Wiersz albo pole czekające na odpowiedź serwera ma tymczasowe id z tym prefiksem
export const PREFIKS_TYMCZASOWY = "tmp-";

// Edytowany wiersz: rowId null = nowy wiersz (szkic, jeszcze bez zapisu); original to wartości
// z chwili otwarcia edycji — zapis wysyła tylko klucze, które się od nich różnią
export type RowEditing = {
  rowId: string | null;
  values: Record<string, unknown>;
  original: Record<string, unknown>;
};

// onStaleGeneration: wołane, gdy serwer odrzuci zapis Sekretu z powodu innej generacji sejfu
// templateKey: szablon strony bloku; tabela szablonu bez klucza `views` w zapisanych ustawieniach dostaje
// jednorazowo gotowe widoki (pusta lista `views: []` = użytkownik je usunął, więc nic nie dopisujemy)
export function useTableStore(
  block: LoadedBlock,
  onStaleGeneration?: () => void,
  templateKey: TemplateKey | "passwords" | null = null,
) {
  // Ustawienia z content.settings; brakujące klucze dostają puste wartości
  const surowe = (block.content.settings ?? {}) as Partial<TableSettings>;
  const zSerwera: TableSettings = {
    sort: Array.isArray(surowe.sort) ? surowe.sort : [],
    filters: Array.isArray(surowe.filters) ? surowe.filters : [],
    hidden_field_ids: Array.isArray(surowe.hidden_field_ids) ? surowe.hidden_field_ids : [],
    column_summaries:
      surowe.column_summaries && typeof surowe.column_summaries === "object" && !Array.isArray(surowe.column_summaries)
        ? surowe.column_summaries
        : {},
    pinned_cards: Array.isArray(surowe.pinned_cards) ? surowe.pinned_cards : [],
    column_widths:
      surowe.column_widths && typeof surowe.column_widths === "object" && !Array.isArray(surowe.column_widths)
        ? Object.fromEntries(
            // Martwe klucze (pola, których już nie ma w bloku) odpadają przy wczytaniu
            Object.entries(surowe.column_widths).filter(([id]) => block.fields.some((f) => f.id === id)),
          )
        : {},
    // Nowe klucze (widoki, grupy): brak w starych ustawieniach = wartości domyślne.
    // Surowe content.settings zostaje nietknięte, więc „brak klucza views” da się odróżnić od pustej listy
    views: Array.isArray(surowe.views) ? surowe.views : [],
    active_view_id: typeof surowe.active_view_id === "string" ? surowe.active_view_id : null,
    group_by: typeof surowe.group_by === "string" ? surowe.group_by : null,
    layout: surowe.layout === "board" ? "board" : "table",
    collapsed_groups:
      surowe.collapsed_groups && typeof surowe.collapsed_groups === "object" && !Array.isArray(surowe.collapsed_groups)
        ? surowe.collapsed_groups
        : {},
  };

  const [fields, setFields] = useState<PageField[]>(block.fields);
  const [rows, setRows] = useState<PageRow[]>(block.rows);
  const [settings, setSettings] = useState<TableSettings>(zSerwera);
  const router = useRouter();
  const [zrodloPol, setZrodloPol] = useState(block.fields);
  const [zrodloWierszy, setZrodloWierszy] = useState(block.rows);
  const [zrodloUstawien, setZrodloUstawien] = useState(block.content.settings);
  const [tempFilters, setTempFilters] = useState<FilterCond[] | null>(null);
  const [editing, setEditing] = useState<RowEditing | null>(null);
  // Szukana fraza: tylko stan klienta, nie trafia do ustawień
  const [query, setQuery] = useState("");

  // Zapisy w toku: pola i ustawienia (liczniki), wiersze (id → zmiany do nałożenia na dane z serwera)
  const polaWToku = useRef(0);
  const ustawieniaWToku = useRef(0);
  // Błąd zapisu ustawień w trakcie innych zapisów: po ostatnim zapisie wyrównujemy ustawienia z serwerem
  // (router.refresh → nowe props), zamiast cofać do nieaktualnej kopii
  const wyrownajRef = useRef(false);
  // Najnowsze ustawienia, także przed rerenderem (kolejne zmiany widoków w tym samym zdarzeniu albo po
  // czekaniu na zapis widoków szablonu)
  const ustawieniaRef = useRef(settings);
  // Zapis widoków szablonu w toku: zmiany widoków użytkownika czekają na jego koniec, żeby go nie nadpisać
  const zapisSzablonuRef = useRef<Promise<void> | null>(null);
  // Użytkownik zmienił widoki, grupowanie lub zwinięte grupy od wczytania: domyślne widoki szablonu ich nie nadpiszą
  const widokiZmienioneRef = useRef(false);
  // zatwierdzone (tylko updateCell): ostatnia wartość komórki potwierdzona przez serwer — do niej wraca błąd
  const wierszeWToku = useRef(
    new Map<string, { n: number; zmiany: Record<string, unknown>; zatwierdzone: Record<string, unknown> }>(),
  );
  // Zapisy pól w toku (patchField): config z ostatniej lokalnej zmiany (z niego budują kolejne zmiany opcji,
  // także przed rerenderem) i ostatni config / nazwa potwierdzone przez serwer — do nich wraca błąd
  const zapisyPol = useRef(
    new Map<string, { n: number; config: FieldConfig; zatwierdzonyConfig: FieldConfig; zatwierdzonaNazwa: string }>(),
  );
  const licznik = useRef(0);
  // Blokada drugiego zapisu w trakcie pierwszego i sam zapis w toku (nowe otwarcie wiersza czeka na jego koniec)
  const zapisujeRef = useRef(false);
  const zapisWTokuRef = useRef<Promise<boolean> | null>(null);
  // Tymczasowe id wiersza klikniętego w trakcie zapisu (edycja czeka na prawdziwe id)
  const edycjaPoZapisie = useRef<string | null>(null);

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

  // Najnowsze pola i wiersze dla wywołań ze starego domknięcia (np. komórka po „Utwórz «nazwa»”
  // woła updateCell z renderu sprzed utworzenia opcji)
  const polaRef = useRef(fields);
  const wierszeRef = useRef(rows);
  useEffect(() => {
    polaRef.current = fields;
    wierszeRef.current = rows;
    ustawieniaRef.current = settings;
  });

  // Otwarty szkic różni się od wartości z chwili otwarcia (nowy wiersz: od wartości startowych)
  function szkicZmieniony(): boolean {
    if (!editing) return false;
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
    // Wiersz jeszcze się zapisuje: klik nie ginie — edycja otworzy się, gdy serwer zwróci prawdziwe id
    if (row.id.startsWith(PREFIKS_TYMCZASOWY)) {
      edycjaPoZapisie.current = row.id;
      return;
    }
    edycjaPoZapisie.current = null;
    // Zapis poprzedniej zmiany trwa: nowe otwarcie czeka na jego koniec (nie dostanie starej wartości), a po błędzie
    // zapisu zostaje przywrócony szkic poprzedniego wiersza, więc tego nie otwieramy
    if (zapisWTokuRef.current && !(await zapisWTokuRef.current)) return;
    if (szkicZmieniony() && !(await zapiszSzkic())) return;
    setEditing({ rowId: row.id, values: { ...row.values }, original: { ...row.values } });
  }

  // „Nowy wiersz”: szkic w trybie edycji na końcu tabeli, z opcjami domyślnymi pól (z makiet).
  // original = wartości startowe, żeby nietknięty szkic nie liczył się jako zmieniony
  async function addRowDraft() {
    if (zapisWTokuRef.current && !(await zapisWTokuRef.current)) return;
    if (szkicZmieniony() && !(await zapiszSzkic())) return;
    const values: Record<string, unknown> = {};
    for (const f of fields) {
      const domyslna = f.config.default_option;
      if (domyslna !== undefined && (f.config.options ?? []).some((o) => o.id === domyslna)) {
        values[f.id] = domyslna;
      }
      if (f.type === "checkbox" && f.config.default_checked === true) values[f.id] = true;
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
  // `secrets`: pola Sekret zmienione w arkuszu, już zaszyfrowane przez arkusz (SecretValue albo null) —
  // tekst jawny nigdy nie trafia do store. Drugi zapis w trakcie pierwszego nie rusza, ale pokazuje toast.
  async function saveRow(secrets?: Record<string, unknown>): Promise<boolean> {
    if (zapisujeRef.current) {
      toast(ZAPIS_W_TOKU);
      return false;
    }
    zapisujeRef.current = true;
    const zapis = zapiszWiersz(secrets);
    zapisWTokuRef.current = zapis;
    try {
      return await zapis;
    } finally {
      zapisujeRef.current = false;
      if (zapisWTokuRef.current === zapis) zapisWTokuRef.current = null;
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
        if (edycjaPoZapisie.current === tymczasoweId) edycjaPoZapisie.current = null;
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
      // Klik w wiersz w trakcie zapisu: otwieramy edycję już z prawdziwym id (o ile nic innego nie jest edytowane)
      if (edycjaPoZapisie.current === tymczasoweId) {
        edycjaPoZapisie.current = null;
        setEditing(
          (cur) => cur ?? { rowId: prawdziwy.id, values: { ...prawdziwy.values }, original: { ...prawdziwy.values } },
        );
      }
      return true;
    }

    const rowId = e.rowId;
    const stary = rows.find((r) => r.id === rowId);
    if (!stary) return true;
    const poprzednie: Record<string, unknown> = {};
    for (const k of Object.keys(nowe)) poprzednie[k] = stary.values[k];
    setRows((l) => l.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, ...nowe } } : r)));

    const wToku = wierszeWToku.current.get(rowId) ?? { n: 0, zmiany: {}, zatwierdzone: {} };
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

  // Zapis jednej komórki (edycja w tabeli): wartość przez normalizeValue, pusty tytuł → empty_label.
  // Od razu lokalnie; błąd cofa tylko tę komórkę (o ile nikt jej w międzyczasie nie zmienił).
  // Wiersz z tymczasowym id → false bez zapisu; wartość bez zmian → true bez zapisu.
  async function updateCell(row: PageRow, field: PageField, value: unknown): Promise<boolean> {
    if (row.id.startsWith(PREFIKS_TYMCZASOWY)) return false;
    // Pole z najnowszego stanu (config z zapisu w toku albo z ostatniego renderu), nie przekazany
    // obiekt: inaczej opcja utworzona przed chwilą nie przeszłaby przez normalizeValue
    const aktualne = polaRef.current.find((f) => f.id === field.id) ?? field;
    const pole: PageField = { ...aktualne, config: zapisyPol.current.get(field.id)?.config ?? aktualne.config };
    let v = normalizeValue(pole, value);
    if (pole.isTitle && v === null) v = pole.config.empty_label ?? "Bez tytułu";
    const biezacy = wierszeRef.current.find((r) => r.id === row.id) ?? row;
    const poprzednia = biezacy.values[field.id];
    if (Object.is(v, normalizeValue(pole, poprzednia))) return true;

    setRows((l) => l.map((r) => (r.id === row.id ? { ...r, values: { ...r.values, [field.id]: v } } : r)));
    // Zapis w toku: dane z serwera w trakcie nie nadpiszą tej komórki
    const wToku = wierszeWToku.current.get(row.id) ?? { n: 0, zmiany: {}, zatwierdzone: {} };
    // Pierwszy zapis tej komórki w toku: bieżąca wartość jest tą potwierdzoną przez serwer
    if (!(field.id in wToku.zatwierdzone)) wToku.zatwierdzone[field.id] = poprzednia;
    wToku.n += 1;
    wToku.zmiany[field.id] = v;
    wierszeWToku.current.set(row.id, wToku);
    let udane = false;
    let nieAktualnySejf = false;
    try {
      const wynik = await updateRow(row.id, { [field.id]: v });
      udane = wynik.ok;
      nieAktualnySejf = !wynik.ok && wynik.code === "stale_generation";
    } catch {
      udane = false;
    }
    wToku.n -= 1;
    if (wToku.n === 0) wierszeWToku.current.delete(row.id);
    const zatwierdzona = wToku.zatwierdzone[field.id];
    if (udane) wToku.zatwierdzone[field.id] = v;
    if (!udane) {
      // Inne zapisy tego wiersza w toku nie przywrócą odrzuconej wartości z danych serwera
      if (wToku.n > 0 && Object.is(wToku.zmiany[field.id], v)) wToku.zmiany[field.id] = zatwierdzona;
      // Wracamy do ostatniej wartości potwierdzonej przez serwer (nie do lokalnej poprzedniej,
      // która też mogła się nie zapisać), i tylko gdy komórka nadal ma wartość z tego zapisu
      setRows((l) =>
        l.map((r) =>
          r.id === row.id && Object.is(r.values[field.id], v)
            ? { ...r, values: { ...r.values, [field.id]: zatwierdzona } }
            : r,
        ),
      );
      if (nieAktualnySejf) {
        // Inna generacja sejfu: blokujemy go i pokazujemy komunikat z serwera
        onStaleGeneration?.();
        toast.error(SEJF_ZMIENIL_SIE);
      } else {
        toast.error(BLAD_ZAPISU);
      }
    }
    return udane;
  }

  // „+ Nowy” w tabeli: wiersz od razu na serwerze (z opcjami domyślnymi pól, jak addRowDraft),
  // bez tymczasowego id. Zwraca id nowego wiersza albo null (toast pokazany).
  async function addRowInline(): Promise<string | null> {
    const values: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.id.startsWith(PREFIKS_TYMCZASOWY)) continue;
      const domyslna = f.config.default_option;
      if (domyslna !== undefined && (f.config.options ?? []).some((o) => o.id === domyslna)) {
        values[f.id] = domyslna;
      }
      if (f.type === "checkbox" && f.config.default_checked === true) values[f.id] = true;
    }
    let wynik: Awaited<ReturnType<typeof addRow>> | null = null;
    try {
      wynik = await addRow(block.id, values);
    } catch {
      wynik = null;
    }
    if (!wynik || !wynik.ok) {
      toast.error(BLAD_ZAPISU);
      return null;
    }
    const prawdziwy = wynik.row;
    // Odświeżenie danych mogło już dodać ten wiersz — bez duplikatów
    setRows((l) => (l.some((r) => r.id === prawdziwy.id) ? l : [...l, prawdziwy]));
    return prawdziwy.id;
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
    if ("views" in patch || "group_by" in patch || "collapsed_groups" in patch) widokiZmienioneRef.current = true;
    const poprzednie: Partial<TableSettings> = {};
    for (const k of Object.keys(patch) as (keyof TableSettings)[]) {
      (poprzednie as Record<string, unknown>)[k] = ustawieniaRef.current[k];
    }
    ustawieniaRef.current = { ...ustawieniaRef.current, ...patch };
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
      if (ustawieniaWToku.current === 0) {
        // Nic innego się nie zapisuje: cofamy klucze tej zmiany
        ustawieniaRef.current = { ...ustawieniaRef.current, ...poprzednie };
        setSettings((s) => ({ ...s, ...poprzednie }));
      } else {
        // Inne zapisy w toku: kopia sprzed zmiany jest już nieaktualna, więc wyrównamy z serwerem po ostatnim
        wyrownajRef.current = true;
      }
      toast.error(BLAD_ZAPISU);
    }
    if (ustawieniaWToku.current === 0 && wyrownajRef.current) {
      wyrownajRef.current = false;
      router.refresh();
    }
    return udane;
  }

  // Ustawienia bieżącego widoku (zapisany widok albo „Wszystkie”)
  const view: EffectiveView = effectiveView(settings);

  // Zmiany widoków czekają na jednorazowy zapis widoków szablonu (inaczej nadpisałyby go listą bez nich)
  // i liczą się od najnowszych ustawień. Bez zapisu w toku nie czekają wcale (pole filtra zmienia się od razu).
  async function poZapisieSzablonu(): Promise<void> {
    while (zapisSzablonuRef.current) await zapisSzablonuRef.current;
  }

  // Zmiana filtrów, sortu, grupowania, układu albo ukrytych pól: przy aktywnym zapisanym widoku zapisuje się
  // w tym widoku (cała lista views), przy „Wszystkich” w ustawieniach bazowych bloku
  async function patchView(patch: Partial<EffectiveView>): Promise<boolean> {
    if (zapisSzablonuRef.current) await poZapisieSzablonu();
    const s = ustawieniaRef.current;
    const aktywny = s.active_view_id === null ? undefined : s.views.find((v) => v.id === s.active_view_id);
    if (aktywny) {
      return patchSettings({ views: s.views.map((v) => (v.id === aktywny.id ? { ...v, ...patch } : v)) });
    }
    return patchSettings(patch);
  }

  // Zakładka widoku (null = „Wszystkie”)
  async function selectView(id: string | null): Promise<boolean> {
    setTempFilters(null);
    if (id === ustawieniaRef.current.active_view_id) return true;
    return patchSettings({ active_view_id: id });
  }

  // „+ Widok” i „Zapisz jako widok”: kopia bieżącego widoku (filtry, sort, grupowanie, układ, ukryte pola), od razu aktywna
  async function addView(name: string): Promise<boolean> {
    if (zapisSzablonuRef.current) await poZapisieSzablonu();
    const s = ustawieniaRef.current;
    const biezacy = effectiveView(s);
    const nowy: TableView = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 40) || "Mój widok",
      filters: biezacy.filters,
      sort: biezacy.sort,
      group_by: biezacy.group_by,
      layout: biezacy.layout,
      hidden_field_ids: biezacy.hidden_field_ids,
    };
    setTempFilters(null);
    return patchSettings({ views: [...s.views, nowy], active_view_id: nowy.id });
  }

  // Nowa nazwa widoku: przycięta, 1–40 znaków; pusta nic nie zmienia
  async function renameView(id: string, name: string): Promise<boolean> {
    const nazwa = name.trim().slice(0, 40);
    if (zapisSzablonuRef.current) await poZapisieSzablonu();
    const s = ustawieniaRef.current;
    const widok = s.views.find((v) => v.id === id);
    if (!widok || nazwa === "" || nazwa === widok.name) return true;
    return patchSettings({ views: s.views.map((v) => (v.id === id ? { ...v, name: nazwa } : v)) });
  }

  // „Duplikuj widok”: kopia „Nazwa (kopia)” na końcu listy (S2Table), od razu aktywna
  async function duplicateView(id: string): Promise<boolean> {
    if (zapisSzablonuRef.current) await poZapisieSzablonu();
    const s = ustawieniaRef.current;
    const widok = s.views.find((v) => v.id === id);
    if (!widok) return true;
    const kopia: TableView = { ...widok, id: crypto.randomUUID(), name: `${widok.name} (kopia)`.slice(0, 40) };
    setTempFilters(null);
    return patchSettings({ views: [...s.views, kopia], active_view_id: kopia.id });
  }

  // „Usuń widok”: usunięty aktywny wraca do „Wszystkich”; „Cofnij” wstawia widok z powrotem na jego miejsce
  // w BIEŻĄCEJ liście (zmiany innych widoków po usunięciu zostają)
  async function deleteView(id: string): Promise<boolean> {
    if (zapisSzablonuRef.current) await poZapisieSzablonu();
    const s = ustawieniaRef.current;
    const indeks = s.views.findIndex((v) => v.id === id);
    if (indeks < 0) return true;
    const widok = s.views[indeks];
    const bylAktywny = s.active_view_id === id;
    const patch: Partial<TableSettings> = { views: s.views.filter((v) => v.id !== id) };
    if (bylAktywny) {
      patch.active_view_id = null;
      setTempFilters(null);
    }
    const udane = await patchSettings(patch);
    if (!udane) return false;
    toast(`Usunięto widok „${widok.name}”`, {
      action: {
        label: "Cofnij",
        onClick: async () => {
          if (zapisSzablonuRef.current) await poZapisieSzablonu();
          const teraz = ustawieniaRef.current;
          if (teraz.views.some((v) => v.id === id)) return;
          const widoki = [...teraz.views.slice(0, indeks), widok, ...teraz.views.slice(indeks)];
          await patchSettings(bylAktywny ? { views: widoki, active_view_id: id } : { views: widoki });
        },
      },
    });
    return true;
  }

  // Grupowanie i układ (tabela / tablica) bieżącego widoku
  async function setGroupBy(fieldId: string | null): Promise<boolean> {
    return patchView({ group_by: fieldId });
  }
  async function setLayout(layout: TableView["layout"]): Promise<boolean> {
    return patchView({ layout });
  }

  // Zwinięcie / rozwinięcie grupy w bieżącym widoku (klucz widoku albo "all" dla „Wszystkich”)
  async function toggleGroup(key: string): Promise<boolean> {
    if (zapisSzablonuRef.current) await poZapisieSzablonu();
    const s = ustawieniaRef.current;
    const aktywny = s.active_view_id === null ? undefined : s.views.find((v) => v.id === s.active_view_id);
    const klucz = aktywny ? aktywny.id : "all";
    const zwiniete = s.collapsed_groups[klucz] ?? [];
    return patchSettings({
      collapsed_groups: {
        ...s.collapsed_groups,
        [klucz]: zwiniete.includes(key) ? zwiniete.filter((k) => k !== key) : [...zwiniete, key],
      },
    });
  }

  // Jednorazowe dopisanie widoków szablonu (brak klucza `views` w surowych ustawieniach bloku)
  const widokiSzablonuRef = useRef(false);
  useEffect(() => {
    if (widokiSzablonuRef.current) return;
    if (templateKey === null || templateKey === "empty") return;
    const surowaUstawienia = (block.content.settings ?? {}) as Record<string, unknown>;
    if ("views" in surowaUstawienia) return;
    widokiSzablonuRef.current = true;
    const domyslne = templateDefaults(templateKey, block.fields);
    if (domyslne.views.length === 0 && domyslne.group_by === null) return;
    const patch: Partial<TableSettings> = {
      views: domyslne.views,
      group_by: domyslne.group_by,
      collapsed_groups: domyslne.collapsed_groups,
    };
    // Zapis w tle bez toastu (to nie akcja użytkownika); lokalnie ustawiamy dopiero po potwierdzeniu serwera.
    // Przy błędzie następne wczytanie bloku spróbuje ponownie
    ustawieniaWToku.current += 1;
    const zapis = saveTableSettings(block.id, patch, { onlyIfMissing: "views" })
      .then((wynik) => {
        // Serwer pominął zapis (widoki już są) albo użytkownik zmienił widoki w międzyczasie: bez nadpisania
        if (wynik.ok && !wynik.skipped && !widokiZmienioneRef.current) {
          ustawieniaRef.current = { ...ustawieniaRef.current, ...patch };
          setSettings((s) => ({ ...s, ...patch }));
        }
      })
      .catch(() => {})
      .finally(() => {
        ustawieniaWToku.current -= 1;
        if (zapisSzablonuRef.current === zapis) zapisSzablonuRef.current = null;
      });
    zapisSzablonuRef.current = zapis;
    // Jednorazowo przy wczytaniu bloku
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const nazwa = name.trim();
    if (nazwa === tableName) return true;
    const poprzednia = tableName;
    setTableName(nazwa);
    let udane = false;
    try {
      udane = (await updateBlockContent(block.id, { ...block.content, name: nazwa })).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setTableName(poprzednia);
      toast.error(BLAD_ZAPISU);
    }
    return udane;
  }

  // Przesunięcie kolumny o jedno miejsce; kolejność zapisuje jedno RPC (jak w edytorze).
  // Kolumna tytułu stoi zawsze pierwsza: nie przesuwa się i nic nie wchodzi przed nią.
  // Lokalnie zamieniają się tylko pozycje dwóch pól — błąd cofa tylko je (np. zmiana nazwy w trakcie zostaje).
  async function moveField(field: PageField, dir: -1 | 1): Promise<boolean> {
    // Kolumny bez prawdziwego id nie wejdą jeszcze w kolejność na serwerze
    if (posortowanePola.some((f) => f.id.startsWith(PREFIKS_TYMCZASOWY))) return false;
    const i = posortowanePola.findIndex((f) => f.id === field.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= posortowanePola.length) return false;
    const a = posortowanePola[i];
    const b = posortowanePola[j];
    if (a.isTitle || b.isTitle) return false;
    const nowaKolejnosc = [...posortowanePola];
    [nowaKolejnosc[i], nowaKolejnosc[j]] = [nowaKolejnosc[j], nowaKolejnosc[i]];
    // Równe pozycje (stare dane) nie dałyby zamiany — wtedy b dostaje pozycję o jeden obok
    const pozycjaA = b.position === a.position ? a.position + dir : b.position;
    const pozycjaB = a.position;
    setFields((l) =>
      l.map((f) =>
        f.id === a.id ? { ...f, position: pozycjaA } : f.id === b.id ? { ...f, position: pozycjaB } : f,
      ),
    );
    polaWToku.current += 1;
    let udane = false;
    try {
      udane = (await reorderFields(block.id, nowaKolejnosc.map((f) => f.id))).ok;
    } catch {
      udane = false;
    }
    polaWToku.current -= 1;
    if (!udane) {
      // Cofamy tylko pozycje tych dwóch pól, o ile nadal są z tej zamiany
      setFields((l) =>
        l.map((f) =>
          f.id === a.id && f.position === pozycjaA
            ? { ...f, position: a.position }
            : f.id === b.id && f.position === pozycjaB
              ? { ...f, position: b.position }
              : f,
        ),
      );
      toast.error(BLAD_ZAPISU);
    }
    return udane;
  }

  // Nowa opcja z okienka opcji: szara (#525252), etykieta przycięta. Pusta nazwa albo duplikat
  // (bez wielkości liter) → null bez zapisu. Zwraca id nowej opcji albo null przy błędzie zapisu.
  async function createOption(field: PageField, label: string): Promise<string | null> {
    // Config z zapisu w toku (drugie wywołanie przed rerenderem nie zgubi opcji pierwszego)
    const pole = fields.find((f) => f.id === field.id) ?? field;
    const config = zapisyPol.current.get(field.id)?.config ?? pole.config;
    const etykieta = label.replace(/\s+/g, " ").trim();
    const opcje = config.options ?? [];
    if (etykieta === "" || opcje.some((o) => o.label.replace(/\s+/g, " ").trim().toLowerCase() === etykieta.toLowerCase())) {
      return null;
    }
    // Szary to ostatni kolor PALETA (#525252)
    const nowa: FieldOption = { id: crypto.randomUUID(), label: etykieta, color: PALETA[7] };
    const udane = await patchField(pole, { config: { ...config, options: [...opcje, nowa] } });
    return udane ? nowa.id : null;
  }

  // Zmiana etykiety albo koloru opcji (wiersze trzymają id, więc się nie zmieniają).
  // Pusta albo zduplikowana nazwa (bez wielkości liter, wśród innych opcji) → false bez zapisu.
  async function updateOption(
    field: PageField,
    optionId: string,
    patch: { label?: string; color?: string },
  ): Promise<boolean> {
    // Config z zapisu w toku (jak w createOption)
    const pole = fields.find((f) => f.id === field.id) ?? field;
    const config = zapisyPol.current.get(field.id)?.config ?? pole.config;
    const opcje = config.options ?? [];
    if (!opcje.some((o) => o.id === optionId)) return false;
    const zmiana: { label?: string; color?: string } = {};
    if (patch.label !== undefined) {
      const etykieta = patch.label.replace(/\s+/g, " ").trim();
      if (
        etykieta === "" ||
        opcje.some((o) => o.id !== optionId && o.label.replace(/\s+/g, " ").trim().toLowerCase() === etykieta.toLowerCase())
      ) {
        return false;
      }
      zmiana.label = etykieta;
    }
    if (patch.color !== undefined) zmiana.color = patch.color;
    const noweOpcje = opcje.map((o) => (o.id === optionId ? { ...o, ...zmiana } : o));
    return patchField(pole, { config: { ...config, options: noweOpcje } });
  }

  // Nowa opcja Wyboru: kolor to następny z PALETA; etykieta już istniejąca (bez wielkości liter) nic nie robi
  async function addOption(field: PageField, label: string): Promise<boolean> {
    const etykieta = label.replace(/\s+/g, " ").trim();
    // Pole i config z najnowszego stanu (polaRef) albo z zapisu w toku, nie z przekazanego obiektu
    const pole = polaRef.current.find((f) => f.id === field.id) ?? field;
    const config = zapisyPol.current.get(field.id)?.config ?? pole.config;
    const opcje = config.options ?? [];
    if (etykieta === "" || opcje.some((o) => o.label.replace(/\s+/g, " ").trim().toLowerCase() === etykieta.toLowerCase())) {
      return false;
    }
    const nowa: FieldOption = {
      id: crypto.randomUUID(),
      label: etykieta,
      color: PALETA[opcje.length % PALETA.length],
    };
    return patchField(pole, { config: { ...config, options: [...opcje, nowa] } });
  }

  // Usunięcie opcji Wyboru razem ze wszystkimi odwołaniami, w jednej optymistycznej zmianie:
  // wiersze z tą opcją stają się puste, znikają karty, podsumowania i warunki filtrów na tej opcji,
  // a na końcu sama opcja (i opcja domyślna nowego wiersza). Błąd któregokolwiek zapisu cofa wszystko.
  async function removeOption(field: PageField, optionId: string): Promise<boolean> {
    // Bazowy config z zapisu w toku albo z najnowszego stanu pola (nie z przekazanego obiektu),
    // żeby świeżo utworzona opcja nie została nadpisana starą listą
    const biezacePole = polaRef.current.find((f) => f.id === field.id) ?? field;
    const bazowyConfig = zapisyPol.current.get(field.id)?.config ?? biezacePole.config;
    const config: FieldConfig = {
      ...bazowyConfig,
      options: (bazowyConfig.options ?? []).filter((o) => o.id !== optionId),
    };
    if (config.default_option === optionId) delete config.default_option;

    // Warunek „jest jednym z” traci tę opcję; bez żadnej opcji znika cały warunek
    const bezOpcji = (warunki: FilterCond[]) =>
      warunki.flatMap((c) => {
        if (c.field_id !== field.id || !Array.isArray(c.value) || !c.value.includes(optionId)) return [c];
        const reszta = (c.value as string[]).filter((v) => v !== optionId);
        return reszta.length > 0 ? [{ ...c, value: reszta }] : [];
      });
    const noweFiltry = bezOpcji(settings.filters);
    const noweKarty = settings.pinned_cards.filter(
      (c) => c.option_id !== optionId && c.done_option_id !== optionId,
    );
    const nowePodsumowania = Object.fromEntries(
      Object.entries(settings.column_summaries).filter(
        ([, p]) => p.option_id !== optionId && p.where?.option_id !== optionId,
      ),
    );
    // Zapisujemy tylko klucze ustawień, które naprawdę się zmieniają
    const zmianyUstawien: Partial<TableSettings> = {};
    if (JSON.stringify(noweFiltry) !== JSON.stringify(settings.filters)) zmianyUstawien.filters = noweFiltry;
    if (noweKarty.length !== settings.pinned_cards.length) zmianyUstawien.pinned_cards = noweKarty;
    if (Object.keys(nowePodsumowania).length !== Object.keys(settings.column_summaries).length) {
      zmianyUstawien.column_summaries = nowePodsumowania;
    }
    const poprzednieUstawienia: Partial<TableSettings> = {};
    for (const k of Object.keys(zmianyUstawien) as (keyof TableSettings)[]) {
      (poprzednieUstawienia as Record<string, unknown>)[k] = settings[k];
    }
    const poprzednieTymczasowe = tempFilters;
    // Wiersze z najnowszego stanu (wierszeRef), nie z domknięcia
    const dotknieteWiersze = wierszeRef.current.filter((r) => r.values[field.id] === optionId).map((r) => r.id);

    // Od razu lokalnie
    setFields((l) => l.map((f) => (f.id === field.id ? { ...f, config } : f)));
    setRows((l) =>
      l.map((r) => (dotknieteWiersze.includes(r.id) ? { ...r, values: { ...r.values, [field.id]: null } } : r)),
    );
    setSettings((s) => ({ ...s, ...zmianyUstawien }));
    setTempFilters((t) => (t ? bezOpcji(t) : t));

    // Zapisy w toku: dane z serwera w trakcie nie nadpiszą zmiany
    const zapisywaneWiersze = dotknieteWiersze.filter((id) => !id.startsWith(PREFIKS_TYMCZASOWY));
    for (const id of zapisywaneWiersze) {
      const wToku = wierszeWToku.current.get(id) ?? { n: 0, zmiany: {}, zatwierdzone: {} };
      wToku.n += 1;
      wToku.zmiany[field.id] = null;
      wierszeWToku.current.set(id, wToku);
    }
    // Zapis pola zarejestrowany jak w patchField: kolejne zmiany opcji budują na tym configu
    const zapisPola = zapisyPol.current.get(field.id) ?? {
      n: 0,
      config: biezacePole.config,
      zatwierdzonyConfig: biezacePole.config,
      zatwierdzonaNazwa: biezacePole.name,
    };
    zapisPola.config = config;
    zapisPola.n += 1;
    zapisyPol.current.set(field.id, zapisPola);
    polaWToku.current += 1;
    ustawieniaWToku.current += 1;
    let udane = false;
    try {
      // Server Actions idą na serwer po kolei, w kolejności wywołań: najpierw pole (opcja znika z listy),
      // potem ustawienia, na końcu wiersze — błąd pola nie zostawia na serwerze wyczyszczonych wierszy
      // z opcją nadal na liście
      const wyniki = await Promise.all([
        updateField(field.id, { config }),
        ...(Object.keys(zmianyUstawien).length > 0 ? [saveTableSettings(block.id, zmianyUstawien)] : []),
        ...zapisywaneWiersze.map((id) => updateRow(id, { [field.id]: null })),
      ]);
      udane = wyniki.every((w) => w.ok);
    } catch {
      udane = false;
    }
    for (const id of zapisywaneWiersze) {
      const wToku = wierszeWToku.current.get(id);
      if (!wToku) continue;
      wToku.n -= 1;
      if (wToku.n === 0) wierszeWToku.current.delete(id);
    }
    polaWToku.current -= 1;
    ustawieniaWToku.current -= 1;
    zapisPola.n -= 1;
    if (zapisPola.n === 0) zapisyPol.current.delete(field.id);
    if (udane) {
      zapisPola.zatwierdzonyConfig = config;
      if (zapisPola.n === 0) {
        polaRef.current = polaRef.current.map((f) => (f.id === field.id ? { ...f, config } : f));
      }
    } else if (zapisPola.config === config) {
      // Kolejne zmiany w toku budują już na potwierdzonym configu, nie na odrzuconym
      zapisPola.config = zapisPola.zatwierdzonyConfig;
    }

    if (!udane) {
      // Cofamy tylko to, co nadal jest z tej zmiany, do ostatniego configu potwierdzonego przez serwer
      setFields((l) =>
        l.map((f) =>
          f.id === field.id && f.config === config ? { ...f, config: zapisPola.zatwierdzonyConfig } : f,
        ),
      );
      setRows((l) =>
        l.map((r) =>
          dotknieteWiersze.includes(r.id) && r.values[field.id] === null
            ? { ...r, values: { ...r.values, [field.id]: optionId } }
            : r,
        ),
      );
      setSettings((s) => ({ ...s, ...poprzednieUstawienia }));
      setTempFilters(poprzednieTymczasowe);
      toast.error(BLAD_ZAPISU);
    }
    return udane;
  }

  // Zmiana nazwy albo konfiguracji pola (np. „Pokaż w kalendarzu”): od razu lokalnie. Błąd cofa
  // do ostatniego stanu potwierdzonego przez serwer i tylko to, co nadal jest z tego zapisu
  // (późniejsza zmiana, która się zapisała, zostaje)
  async function patchField(field: PageField, patch: { name?: string; config?: FieldConfig }): Promise<boolean> {
    const biezace = fields.find((f) => f.id === field.id) ?? field;
    const zapis = zapisyPol.current.get(field.id) ?? {
      n: 0,
      config: biezace.config,
      zatwierdzonyConfig: biezace.config,
      zatwierdzonaNazwa: biezace.name,
    };
    if (patch.config !== undefined) zapis.config = patch.config;
    zapis.n += 1;
    zapisyPol.current.set(field.id, zapis);
    setFields((l) => l.map((f) => (f.id === field.id ? { ...f, ...patch } : f)));
    polaWToku.current += 1;
    let udane = false;
    try {
      udane = (await updateField(field.id, patch)).ok;
    } catch {
      udane = false;
    }
    polaWToku.current -= 1;
    zapis.n -= 1;
    if (zapis.n === 0) zapisyPol.current.delete(field.id);
    if (udane) {
      if (patch.config !== undefined) zapis.zatwierdzonyConfig = patch.config;
      if (patch.name !== undefined) zapis.zatwierdzonaNazwa = patch.name;
      // Ostatni zapis pola: polaRef dostaje config od razu (updateCell zaraz po createOption
      // może przyjść przed rerenderem)
      if (zapis.n === 0) {
        polaRef.current = polaRef.current.map((f) =>
          f.id === field.id ? { ...f, ...patch } : f,
        );
      }
      return true;
    }
    // Kolejne zmiany w toku budują już na potwierdzonym configu, nie na odrzuconym
    if (patch.config !== undefined && zapis.config === patch.config) zapis.config = zapis.zatwierdzonyConfig;
    setFields((l) =>
      l.map((f) =>
        f.id === field.id
          ? {
              ...f,
              ...(patch.name !== undefined && f.name === patch.name ? { name: zapis.zatwierdzonaNazwa } : {}),
              ...(patch.config !== undefined && f.config === patch.config ? { config: zapis.zatwierdzonyConfig } : {}),
            }
          : f,
      ),
    );
    toast.error(BLAD_ZAPISU);
    return false;
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
    const zabranaSzerokosc = field.id in settings.column_widths ? settings.column_widths[field.id] : undefined;
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
      column_widths: Object.fromEntries(Object.entries(s.column_widths).filter(([id]) => id !== field.id)),
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
        // Szerokość wraca tylko, jeśli w międzyczasie nikt nie ustawił nowej
        column_widths:
          zabranaSzerokosc !== undefined && !(field.id in s.column_widths)
            ? { ...s.column_widths, [field.id]: zabranaSzerokosc }
            : s.column_widths,
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
    view,
    query,
    setQuery,
    patchView,
    selectView,
    addView,
    saveFiltersAsView: addView,
    renameView,
    duplicateView,
    deleteView,
    setGroupBy,
    setLayout,
    toggleGroup,
    startEdit,
    addRowDraft,
    addRowInline,
    updateCell,
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
    createOption,
    updateOption,
    removeOption,
  };
}
