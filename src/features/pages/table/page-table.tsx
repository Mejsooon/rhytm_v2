"use client";

import * as React from "react";
import { ChevronDown, Ellipsis, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ActionPopover,
  Button,
  Checkbox,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_SEPARATOR,
  StatusBadge,
  type IsoDate,
} from "@/components/controls";
import { SCHOWEK_MS } from "@/features/vault/clipboard-timeout";
import { VaultResetDialog } from "@/features/vault/vault-reset-dialog";
import { useVault } from "@/features/vault/vault-provider";
import { cn } from "@/lib/utils";

import {
  DOMYSLNA_SZEROKOSC,
  MIN_SZEROKOSC_KOLUMNY,
  SZEROKOSC_TYTULU,
  normalizeValue,
  planTypeChange,
  relativeDue,
  rowActive,
  type FieldConfig,
  type FieldType,
  type PageField,
} from "../fields";
import { TypeChangeDialog } from "../editor/type-change-dialog";
import type { LoadedBlock } from "../load-page";
import { TEMPLATES, templateSummaries, type TemplateKey } from "../templates";
import { rowsForm, rowsLabel } from "../rows-label";
import { summarize, visibleRows, type PageRow, type PinnedCard } from "../table-model";
import { toCsv } from "../csv";
import { effectiveView, groupRows, searchRows, viewCount } from "../table-views";
import { AddFieldDialog } from "./add-field-dialog";
import { BoardView } from "./board-view";
import { BulkBar } from "./bulk-bar";
import { CardDialog } from "./card-dialog";
import { ColumnMenu } from "./column-menu";
import { CsvImportDialog } from "./csv-import-dialog";
import { FilterPopover } from "./filter-popover";
import { MRowSheet } from "./mobile/m-row-sheet";
import { OptionBadge } from "./option-badge";
import { PinnedCards } from "./pinned-cards";
import { SummaryCell } from "./summary-cell";
import { TableCell } from "./table-cell";
import { PRZYCISK_PASKA, PRZYCISK_PASKA_ON, TableToolbar } from "./table-toolbar";
import { PREFIKS_TYMCZASOWY, useTableStore } from "./use-table-store";
import { ViewTabs } from "./view-tabs";

// Nagłówek tabeli (.th): 40 px, ikona typu i nazwa; liczby do prawej
// Telefon (th-cell z CMEditor): 44 px, tło .02, linia pod spodem .08 i prawa linia komórki
const NAGLOWEK =
  "h-10 border-b border-border px-3 font-medium whitespace-nowrap text-muted-foreground max-[799px]:h-11 max-[799px]:border-r max-[799px]:border-b-black/[.08] max-[799px]:border-r-border max-[799px]:bg-black/[.02]";

// Uchwyt zmiany szerokości (.colrs): 8 px na prawej krawędzi nagłówka, niebieska kreska 2 px po najechaniu,
// przy fokusie z klawiatury i w trakcie przeciągania (data-on); na telefonie bez uchwytu
const UCHWYT_KOLUMNY =
  "absolute top-0 -right-1 bottom-0 z-[3] w-2 cursor-col-resize touch-none outline-none after:absolute after:top-1.5 after:bottom-1.5 after:left-[3px] after:w-0.5 after:rounded-sm after:bg-transparent after:transition-colors after:duration-[120ms] after:content-[''] group-hover/kol:after:bg-[rgba(59,130,246,.6)] focus-visible:after:bg-[rgba(59,130,246,.6)] data-[on=true]:after:bg-[rgba(59,130,246,.6)] max-[799px]:hidden";

// Ramka tabeli (.frame): obramowanie 1,5 px, promień 12 px; w środku tabela z przewijaniem i stopka „Nowy wiersz”
const RAMKA = "min-w-0 rounded-xl border-[1.5px] border-black/[.14] bg-white";
// Poziome przewijanie tabeli z cienkim suwakiem (.tbl-wrap)
const RAMKA_PRZEWIJANA =
  "overflow-x-auto overflow-y-hidden rounded-t-xl [scrollbar-color:rgba(0,0,0,.2)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-white [&::-webkit-scrollbar-thumb]:bg-black/[.18] [&::-webkit-scrollbar-thumb:hover]:bg-black/30 [&::-webkit-scrollbar-track]:bg-transparent";

// Co moduł Hasła dostaje od tabeli na telefonie (prop `renderPhone`): te same wiersze i pola co tabela webu,
// czyli jeden stan (bez drugiego wczytywania), oraz akcje magazynu i arkusza wiersza
export type PhoneTableApi = {
  fields: PageField[];
  // Wiersze po filtrze modułu (wyszukiwarka i Kategoria), bez usuniętych
  rows: PageRow[];
  readOnly: boolean;
  createOption: (field: PageField, label: string) => Promise<string | null>;
  removeOption: (field: PageField, optionId: string) => Promise<boolean>;
  // „Nowe hasło”: pusty szkic w arkuszu wiersza
  newRow: () => void;
  // „Edytuj”: arkusz wiersza z polami modułu
  editRow: (row: PageRow) => void;
  // Hasło trafiło do schowka (bez tekstu): tabela planuje czyszczenie po 30 s tym samym mechanizmem co komórki webu.
  // Zwraca false, gdy sejf zablokował się albo tabela zniknęła w trakcie zapisu (schowek wyczyszczony od razu).
  planClipboardClear: () => boolean;
};

// Układ telefonu modułu (prop `renderPhone`) jako osobny komponent: funkcja renderująca dostaje akcje oparte na
// refach tabeli (schowek), więc wywołujemy ją tu, a nie w ciele PageTable
function UkladTelefonu({
  render,
  api,
}: {
  render: (api: PhoneTableApi) => React.ReactNode;
  api: PhoneTableApi;
}) {
  return <>{render(api)}</>;
}

// Przycisk akcji wiersza (.row-del): widoczny po najechaniu na wiersz i przy fokusie w wierszu;
// na telefonie zawsze, 44 px, #a3a3a3 (CMEditor); „pointer-events-auto” przebija regułę wiersza z [&_button]
const AKCJA_WIERSZA =
  "opacity-0 transition-opacity duration-[120ms] group-focus-within/wiersz:opacity-100 group-hover/wiersz:opacity-100 focus-visible:opacity-100 max-[799px]:size-11 max-[799px]:rounded-none max-[799px]:text-faint-foreground max-[799px]:opacity-100 max-[799px]:pointer-events-auto!";

// Pozycja menu „⋯”; wyłączona: opacity .64
const POZYCJA = cn(MENU_ITEM, "disabled:cursor-not-allowed disabled:opacity-[.64] disabled:hover:bg-transparent");

// Jeden blok tabeli (S2Table.dc.html): przypięte karty, zakładki widoków („Wszystkie” i zapisane widoki),
// pasek narzędzi (Tabela/Tablica, Grupuj, Filtruj, sort, Pola, szukajka, menu „⋯”), ramka z tabelą (zaznaczanie i „#”,
// menu kolumn, „+” dodające pole, zwijane grupy, wiersze z komórkami edytowanymi wprost jak w Notion, kosz po najechaniu,
// puste stany, podsumowania kolumn) i stopką ramki („Nowy wiersz” i „11 książek · …”) oraz pasek akcji zaznaczonych.
// Na telefonie dotknięcie wiersza otwiera arkusz.
// Działa tylko na danych bloku — bez tytułu strony. `onRemove` (z edytora) usuwa cały blok tabeli.
// `module="passwords"` (moduł Hasła, S2Passwords.dc.html): stałe kolumny (menu kolumny zablokowane, bez „+”
// dodającego kolumnę), kolumna „Akcje” z oczkiem i „Kopiuj hasło”, a przy zamkniętym sejfie cała tabela
// jest tylko do odczytu (bez „Nowy wiersz”, kosza i arkusza). Tekst jawny żyje tylko w komórkach i arkuszu.
// Filtry, sort, grupowanie, układ i ukryte pola należą do bieżącego widoku (store.view / store.patchView).
export function PageTable({
  block,
  today,
  onRemove,
  module,
  templateKey = null,
  renderPhone,
  newRowRef,
  title,
  onImportCsv,
  onExportCsv,
  onExportRowsCsv,
}: {
  block: LoadedBlock;
  today: IsoDate;
  onRemove?: () => void;
  module?: "passwords";
  // Szablon strony bloku (strona Haseł: "passwords"); tabela bez zapisanych widoków dostaje te z szablonu
  templateKey?: TemplateKey | "passwords" | null;
  // Układ telefonu z tego samego magazynu co tabela (moduł Hasła: CMPasswords; strona Subscriptions: CMSubs).
  // Oba układy są w DOM:
  // wynik funkcji widać poniżej 800 px, a tabelę webu (z paskiem, kartami i „Nowy wiersz”) tylko od 800 px.
  // Arkusz wiersza (MRowSheet) i okna zostają wspólne.
  renderPhone?: (api: PhoneTableApi) => React.ReactNode;
  // Przycisk główny w nagłówku strony („Nowa książka”): tabela wpisuje tu funkcję dodającą wiersz jak „Nowy wiersz”
  newRowRef?: React.RefObject<(() => void) | null>;
  // Tytuł strony: nazwa pobieranego pliku CSV i tabeli w oknie importu (bez niego: nazwa tabeli)
  title?: string;
  // Własna obsługa CSV zamiast wbudowanej (import: okno „Importuj z CSV”, eksport: pobranie pliku)
  onImportCsv?: () => void;
  onExportCsv?: () => void;
  // „Eksport CSV” w pasku zaznaczonych (id zaznaczonych wierszy); bez niego pozycja jest wyłączona
  onExportRowsCsv?: (ids: string[]) => void;
}) {
  const vault = useVault();
  // Zapis Sekretu odrzucony przez inną generację sejfu blokuje sejf
  const store = useTableStore(block, vault.onStaleGeneration, templateKey);
  const { fields, rows, settings, editing } = store;
  const router = useRouter();
  // Okno importu CSV montujemy dopiero po otwarciu (każde zaczyna od kroku „Plik”)
  const [importCsvOtwarty, setImportCsvOtwarty] = React.useState(false);
  const modul = module === "passwords";
  const nazwaTabeli = title ?? store.tableName;

  // Eksport CSV: plik „<tytuł strony>.csv” (całość) albo „<tytuł strony> — zaznaczone.csv” (podane id wierszy);
  // pola Sekret pomija toCsv. Pobranie przez tymczasowy link z Blob, adres zwalniamy zaraz po kliknięciu.
  const pobierzCsv = (idWierszy: string[] | null) => {
    const zaznaczone = idWierszy ? new Set(idWierszy) : null;
    const doEksportu = rows.filter((r) => !r.id.startsWith(PREFIKS_TYMCZASOWY) && (!zaznaczone || zaznaczone.has(r.id)));
    const baza = nazwaTabeli.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim() || "Tabela";
    const blob = new Blob([toCsv(fields, doEksportu)], { type: "text/csv;charset=utf-8" });
    const adres = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = adres;
    link.download = zaznaczone ? `${baza} — zaznaczone.csv` : `${baza}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(adres);
    toast(`Wyeksportowano ${rowsLabel(doEksportu.length)} do ${link.download}`);
  };
  const importujCsv = onImportCsv ?? (modul ? undefined : () => setImportCsvOtwarty(true));
  const eksportujCsv = onExportCsv ?? (() => pobierzCsv(null));
  const eksportujZaznaczone = onExportRowsCsv ?? ((ids: string[]) => pobierzCsv(ids));
  const odblokowany = vault.status === "odblokowany";
  // Moduł przy zamkniętym sejfie: nic się nie edytuje
  const tylkoOdczyt = modul && !odblokowany;

  // Wiersze z odsłoniętymi sekretami (oczko); same id, bez tekstu. Blokada sejfu chowa wszystko.
  const [odsloniete, setOdsloniete] = React.useState<string[]>([]);
  const [poprzedniStatus, setPoprzedniStatus] = React.useState(vault.status);
  if (poprzedniStatus !== vault.status) {
    setPoprzedniStatus(vault.status);
    setOdsloniete([]);
  }
  // Zmiana układu (próg 800 px) chowa odsłonięte sekrety, żeby tekst nie zostawał w ukrytym układzie
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const zapytanie = window.matchMedia("(min-width: 800px)");
    if (typeof zapytanie?.addEventListener !== "function") return;
    const schowaj = () => setOdsloniete([]);
    zapytanie.addEventListener("change", schowaj);
    return () => zapytanie.removeEventListener("change", schowaj);
  }, []);
  // Status widziany po await (po blokadzie nic nie trafia do schowka)
  const statusRef = React.useRef(vault.status);
  React.useEffect(() => {
    statusRef.current = vault.status;
  }, [vault.status]);
  // Zaplanowane czyszczenie schowka (bez skopiowanego tekstu): licznik 30 s i funkcja „wyczyść teraz”
  const schowekRef = React.useRef<{ timer: ReturnType<typeof setTimeout>; wyczysc: () => void } | null>(null);
  // Blokada sejfu przed upływem 30 s: czyścimy od razu (albo przy powrocie fokusu)
  React.useEffect(() => {
    if (!odblokowany) schowekRef.current?.wyczysc();
  }, [odblokowany]);
  // Odmontowanie tabeli z zaplanowanym czyszczeniem: tak samo (kopiowanie kończące się po odmontowaniu
  // widzi `zamontowana` i czyści od razu)
  const zamontowana = React.useRef(true);
  React.useEffect(() => {
    const plan = schowekRef;
    zamontowana.current = true;
    return () => {
      zamontowana.current = false;
      plan.current?.wyczysc();
    };
  }, []);

  // Edycja w arkuszu (telefon); na webie komórki edytują się wprost
  const [wArkuszu, setWArkuszu] = React.useState(false);
  // Moduł: zamknięty sejf kończy edycję w arkuszu (po odblokowaniu arkusz nie wraca sam ze starym szkicem)
  if (tylkoOdczyt && (wArkuszu || editing !== null)) {
    setWArkuszu(false);
    if (editing !== null) store.cancelEdit();
  }
  // „Nowy wiersz” czeka na serwer (przycisk wyłączony); id nowego wiersza dostaje kursor w komórce tytułu
  const [dodawanie, setDodawanie] = React.useState(false);
  const [nowyId, setNowyId] = React.useState<string | null>(null);
  // Wiersz z fokusem albo świeżo dodany („przypięty”) i kolejność wierszy (id) z chwili przypięcia.
  // Dopóki fokus jest w wierszach tabeli, kolejność stoi w miejscu, a przypięty wiersz nie znika przez filtr:
  // zapis w trakcie pisania nie przesuwa ani nie chowa wiersza (React przenosząc węzeł DOM gubi fokus).
  const [przypiety, setPrzypiety] = React.useState<{ id: string; kolejnosc: string[] } | null>(null);
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

  // Okno karty: karta null = nowa karta, inaczej edycja tej karty (obiekt z chwili otwarcia, nie indeks —
  // lista może się zmienić przy otwartym oknie, np. „Cofnij” usunięcia karty)
  const [oknoKarty, setOknoKarty] = React.useState<{ karta: PinnedCard | null } | null>(null);
  // Okno resetu sejfu z menu „⋯” modułu Hasła
  const [resetSejfu, setResetSejfu] = React.useState(false);
  // „Nowa kolumna” z menu „⋯” otwiera okno pola przy „+” w nagłówku
  const otworzNowePole = React.useRef<(() => void) | null>(null);

  const zywe = React.useMemo(() => rows.filter((r) => r.deletedAt === null), [rows]);
  // Bieżący widok (zapisany albo „Wszystkie”): filtry, sort, grupowanie, układ i ukryte pola
  const widok = store.view;
  const widokWszystkich = {
    filters: settings.filters,
    sort: settings.sort,
    group_by: settings.group_by,
    layout: settings.layout,
    hidden_field_ids: settings.hidden_field_ids,
  };
  const ukryte = new Set(widok.hidden_field_ids);
  const widocznePola = fields.filter((f) => !ukryte.has(f.id));
  // Widok wg filtra i sortu; przy przypiętym wierszu kolejność z chwili przypięcia (patrz `przypiety`)
  // Szukana fraza (stan klienta) zawęża wiersze po filtrach widoku; sekrety nie są przeszukiwane.
  const wedlugUstawien = React.useMemo(() => {
    const v = effectiveView(settings);
    return searchRows(fields, visibleRows(fields, rows, { ...settings, filters: v.filters, sort: v.sort }, null, today), store.query);
  }, [fields, rows, settings, store.query, today]);
  // Telefon (MSubs, MPasswords) nie zna zakładek webu ani szukajki: dostaje wiersze po samych filtrach i sorcie „Wszystkich”
  const wierszeTelefonu = React.useMemo(
    () => visibleRows(fields, rows, { ...settings, filters: settings.filters, sort: settings.sort }, null, today),
    [fields, rows, settings, today],
  );
  // Przypięty wiersz usunięty (kosz, odświeżenie): przypięcie znika, widok liczy się normalnie
  if (przypiety && !zywe.some((r) => r.id === przypiety.id)) setPrzypiety(null);
  const widoczneWiersze = React.useMemo(() => {
    if (!przypiety || !zywe.some((r) => r.id === przypiety.id)) return wedlugUstawien;
    const poId = new Map(zywe.map((r) => [r.id, r]));
    const wFiltrze = new Set(wedlugUstawien.map((r) => r.id));
    // Wiersze z zapamiętanej kolejności: te, które nadal spełniają filtr, i zawsze przypięty
    const zamrozone = przypiety.kolejnosc.flatMap((id) => {
      const r = poId.get(id);
      return r && (id === przypiety.id || wFiltrze.has(id)) ? [r] : [];
    });
    const wZamrozonych = new Set(zamrozone.map((r) => r.id));
    // Wiersze, które dopiero teraz spełniają filtr (np. „Cofnij” usunięcia), dochodzą na końcu
    return [...zamrozone, ...wedlugUstawien.filter((r) => !wZamrozonych.has(r.id))];
  }, [przypiety, zywe, wedlugUstawien]);
  // Filtr działa od razu i zapisuje się w bieżącym widoku (jak sort, grupowanie i pola)
  const filtry = widok.filters;
  // Opcja „zrobione” z karty najbliższego terminu (zrobione terminy nie są pilne)
  const kartaTerminu = settings.pinned_cards.find((c) => c.aggregation === "nearest_date");
  const zrobione =
    kartaTerminu?.done_option_id !== undefined
      ? { fieldId: kartaTerminu.field_id, optionId: kartaTerminu.done_option_id }
      : null;

  // Zaznaczone wiersze (id). Zmiana widoku, filtrów albo szukanej frazy czyści zaznaczenie, zamknięty sejf też.
  const [zaznaczone, setZaznaczone] = React.useState<string[]>([]);
  // Przełączenie na Tablicę też czyści zaznaczenie (tablica nie ma zaznaczania ani paska akcji)
  const kluczZaznaczenia = JSON.stringify([settings.active_view_id, filtry, store.query, tylkoOdczyt, widok.layout]);
  const [poprzedniKluczZaznaczenia, setPoprzedniKluczZaznaczenia] = React.useState(kluczZaznaczenia);
  if (poprzedniKluczZaznaczenia !== kluczZaznaczenia) {
    setPoprzedniKluczZaznaczenia(kluczZaznaczenia);
    setZaznaczone([]);
  }
  // Zaznaczenie obejmuje tylko wiersze bieżącego widoku (także w zwiniętych grupach, jak visIds w S2Table):
  // wiersz, który z niego wypada (filtr, szukanie, „Zmień”, kosz), wypada też z zaznaczenia
  const widoczneIds = React.useMemo(() => new Set(widoczneWiersze.map((r) => r.id)), [widoczneWiersze]);
  if (zaznaczone.some((id) => !widoczneIds.has(id))) setZaznaczone(zaznaczone.filter((id) => widoczneIds.has(id)));
  const zaznaczoneSet = React.useMemo(() => new Set(zaznaczone), [zaznaczone]);
  // Do akcji idą tylko widoczne wiersze z prawdziwym id
  const wybrane = widoczneWiersze
    .filter((r) => zaznaczoneSet.has(r.id) && !r.id.startsWith(PREFIKS_TYMCZASOWY))
    .map((r) => r.id);
  const wszystkieZaznaczone = widoczneWiersze.length > 0 && widoczneWiersze.every((r) => zaznaczoneSet.has(r.id));
  // „Zmień: pole” w pasku: pole grupy, inaczej pierwsze pole Wyboru albo Statusu (Sekret nigdy)
  const poleGrupy = fields.find((f) => f.id === widok.group_by);
  const poleZmiany =
    poleGrupy && (poleGrupy.type === "select" || poleGrupy.type === "status" || poleGrupy.type === "checkbox")
      ? poleGrupy
      : (fields.find((f) => f.type === "select" || f.type === "status") ?? null);

  // Grupy bieżącego widoku (pole Wyboru, Statusu albo Checkbox; bez grupowania jedna grupa "*")
  const grupy = React.useMemo(() => groupRows(fields, widoczneWiersze, widok.group_by), [fields, widoczneWiersze, widok.group_by]);
  // Pole kolumn Tablicy: grupowanie widoku, gdy to Wybór albo Status; inaczej pole tablicy szablonu
  // (klucz szablonu → prawdziwe pole po nazwie i typie, jak templateSummaries); inaczej pierwszy Wybór albo Status
  const tablica = widok.layout === "board";
  const poleGrupyTablicy = fields.find(
    (f) => f.id === widok.group_by && (f.type === "select" || f.type === "status"),
  );
  const szablonTablicy = templateKey !== null && templateKey !== "passwords" ? TEMPLATES[templateKey] : null;
  const polaSzablonuTablicy = szablonTablicy?.fields.find((f) => f.key === szablonTablicy.board);
  const poleTablicy =
    poleGrupyTablicy ??
    (polaSzablonuTablicy
      ? fields.find((f) => f.name === polaSzablonuTablicy.name && f.type === polaSzablonuTablicy.type)
      : undefined) ??
    fields.find((f) => f.type === "select" || f.type === "status") ??
    null;
  // Pole „Repo” szablonu (klucz repo → prawdziwe pole po nazwie i typie)
  const polaSzablonuRepo = szablonTablicy?.fields.find((f) => f.key === "repo");
  const poleRepoTablicy = polaSzablonuRepo
    ? fields.find((f) => f.name === polaSzablonuRepo.name && f.type === polaSzablonuRepo.type)
    : undefined;
  // Podsumowania liczą się dla grup tabeli albo kolumn tablicy
  const grupyPodsumowan = React.useMemo(
    () => (tablica && poleTablicy ? groupRows(fields, widoczneWiersze, poleTablicy.id) : grupy),
    [tablica, poleTablicy, fields, widoczneWiersze, grupy],
  );
  // Zwinięte grupy zapisują się pod id aktywnego widoku albo "all" (jak store.toggleGroup)
  const kluczWidoku =
    settings.active_view_id !== null && settings.views.some((v) => v.id === settings.active_view_id)
      ? settings.active_view_id
      : "all";
  const zwiniete = settings.collapsed_groups[kluczWidoku] ?? [];
  // Opis pod tabelą i podsumowania grup z szablonu (S2Table: foot, gsum), z prawdziwymi id pól i opcji
  const podsumowaniaSzablonu = React.useMemo(() => templateSummaries(templateKey, fields), [templateKey, fields]);
  // Podsumowanie w nagłówku grupy (klucz grupy → tekst). Szablon: średnia ocena „śr. ocena 4,1”, suma miesięczna
  // „96,98 zł / mies.” albo „najbliższy termin: nazwa · za 4 dni”. Bez szablonu: pierwsza widoczna kolumna
  // z podsumowaniem (poza polem grupy i samą liczbą wierszy), bez „Σ” i bez „—”.
  const sumyGrup = React.useMemo(() => {
    const wynik = new Map<string, string>();
    const sz = podsumowaniaSzablonu.group;
    const poleSzablonu = sz ? fields.find((f) => f.id === sz.field_id) : undefined;
    const ukryteGr = new Set(effectiveView(settings).hidden_field_ids);
    const grupowanePo = tablica && poleTablicy ? poleTablicy.id : effectiveView(settings).group_by;
    const poleOgolne = fields.find((f) => {
      const p = settings.column_summaries[f.id];
      return !ukryteGr.has(f.id) && f.id !== grupowanePo && p !== undefined && p.kind !== "none" && p.kind !== "count";
    });
    const tytul = fields.find((f) => f.isTitle);
    // Hasła (S2Passwords gsum): „2 z notatkami” — liczy tylko, czy Notatka jest wypełniona (szyfrogram albo null),
    // treści sekretu nie czyta
    const notatka = templateKey === "passwords" ? fields.find((f) => f.name === "Notatka" && f.type === "secret") : undefined;
    for (const g of grupyPodsumowan) {
      let tekst = "";
      if (notatka) {
        const n = g.rows.filter((r) => r.values[notatka.id] !== null && r.values[notatka.id] !== undefined).length;
        tekst = n === 0 ? "" : `${n} ${n === 1 ? "z notatką" : "z notatkami"}`;
      } else if (sz && poleSzablonu) {
        if (sz.kind === "avg") {
          const oceny = g.rows
            .map((r) => normalizeValue(poleSzablonu, r.values[poleSzablonu.id]))
            .filter((v): v is number => typeof v === "number" && v > 0);
          if (oceny.length > 0) {
            const srednia = oceny.reduce((a, b) => a + b, 0) / oceny.length;
            tekst = `${sz.label ?? "śr."} ${srednia.toFixed(1).replace(".", ",")}`;
          }
        } else if (sz.kind === "sum_month") {
          const suma = summarize(poleSzablonu, g.rows, { kind: "sum_month" }, today, fields).replace(/^Σ /, "");
          tekst = suma.startsWith("0,00") ? "" : suma;
        } else if (g.key !== sz.skip_option_id) {
          const terminy = g.rows
            .map((r) => ({ r, d: normalizeValue(poleSzablonu, r.values[poleSzablonu.id]) }))
            .filter((x): x is { r: PageRow; d: string } => typeof x.d === "string" && x.d >= today)
            .sort((a, b) => a.d.localeCompare(b.d));
          const pierwszy = terminy[0];
          if (pierwszy) {
            const nazwa =
              tytul && typeof pierwszy.r.values[tytul.id] === "string" && pierwszy.r.values[tytul.id] !== ""
                ? (pierwszy.r.values[tytul.id] as string)
                : (tytul?.config.empty_label ?? "Bez nazwy");
            tekst = `${sz.label ?? "najbliższy termin"}: ${nazwa} · ${relativeDue(pierwszy.d, today).text}`;
          }
        }
      } else if (poleOgolne) {
        const t = summarize(poleOgolne, g.rows, settings.column_summaries[poleOgolne.id], today, fields).replace(/^Σ /, "");
        tekst = t === "—" ? "" : t;
      }
      wynik.set(g.key, tekst);
    }
    return wynik;
  }, [grupyPodsumowan, tablica, poleTablicy, podsumowaniaSzablonu, fields, settings, today, templateKey]);
  // Stopka pod tabelą (S2Table foot): „11 książek · 2 w trakcie” — rzeczownik szablonu i opis szablonu;
  // bez szablonu pierwsze podsumowanie kolumny (bez samej liczby wierszy, którą już mówi rzeczownik), bez „Σ”
  const tekstStopki = React.useMemo(() => {
    const rzeczownik: [string, string, string] =
      templateKey === "passwords" ? ["hasło", "hasła", "haseł"] : TEMPLATES[templateKey ?? "empty"].noun;
    const forma = rowsForm(widoczneWiersze.length);
    const sz = podsumowaniaSzablonu.footer;
    const poleSzablonu = sz ? fields.find((f) => f.id === sz.field_id) : undefined;
    const ukryteSt = new Set(effectiveView(settings).hidden_field_ids);
    const poleOgolne = fields.find((f) => {
      const p = settings.column_summaries[f.id];
      return !ukryteSt.has(f.id) && p !== undefined && p.kind !== "none" && p.kind !== "count";
    });
    const suma =
      sz && poleSzablonu
        ? summarize(poleSzablonu, widoczneWiersze, sz.summary, today, fields)
        : poleOgolne
          ? summarize(poleOgolne, widoczneWiersze, settings.column_summaries[poleOgolne.id], today, fields)
          : "";
    const bezSigmy = suma.replace(/^Σ /, "");
    // Hasła (S2Passwords foot): stały dopisek zamiast podsumowania
    if (templateKey === "passwords")
      return `${widoczneWiersze.length} ${rzeczownik[forma === "one" ? 0 : forma === "few" ? 1 : 2]} · sekrety nie są przeszukiwane`;
    return `${widoczneWiersze.length} ${rzeczownik[forma === "one" ? 0 : forma === "few" ? 1 : 2]}${
      bezSigmy !== "" && bezSigmy !== "—" ? ` · ${bezSigmy}` : ""
    }`;
  }, [templateKey, widoczneWiersze, podsumowaniaSzablonu, fields, settings, today]);
  // Stopka z podsumowaniami kolumn tylko wtedy, gdy któraś widoczna kolumna ma podsumowanie
  const saPodsumowania = widocznePola.some((f) => {
    const p = settings.column_summaries[f.id];
    return p !== undefined && p.kind !== "none";
  });

  // Nowy wiersz (z „Nowy wiersz” albo przycisku nagłówka) w zwiniętej grupie rozwija ją (Review Focus 5)
  React.useEffect(() => {
    if (nowyId === null) return;
    const nowy = zywe.find((r) => r.id === nowyId);
    if (!nowy) return;
    const grupa = groupRows(fields, [nowy], widok.group_by)[0];
    if (grupa && grupa.key !== "*" && zwiniete.includes(grupa.key)) void store.toggleGroup(grupa.key);
    // Tylko przy nowym wierszu (zmiana nowyId); zwinięcie później zostaje wyborem użytkownika
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowyId]);

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

  // Czyszczenie schowka po skopiowaniu hasła: plan nie trzyma skopiowanego tekstu. Schowek da się zapisać tylko
  // z fokusem, więc bez fokusu czekamy jednorazowo na powrót do karty. Nowe kopiowanie zastępuje stary plan.
  // Nie sprawdzamy, co jest w schowku (readText wymaga uprawnienia), więc czyszczenie nadpisuje go bezwarunkowo.
  // Używają go komórki webu i lista telefonu. Zwraca false, gdy sejf zablokował się albo tabela zniknęła
  // w trakcie zapisu do schowka (czyścimy od razu).
  function zaplanujSchowek(): boolean {
    if (schowekRef.current) clearTimeout(schowekRef.current.timer);
    // „Czyść schowek” wyłączone: nic nie planujemy (po blokadzie w trakcie kopiowania czyścimy mimo to)
    if (vault.settings?.clearClipboard === false && statusRef.current === "odblokowany" && zamontowana.current) {
      schowekRef.current = null;
      return true;
    }
    const plan = {
      timer: setTimeout(() => plan.wyczysc(), SCHOWEK_MS),
      wyczysc: () => {
        clearTimeout(plan.timer);
        if (schowekRef.current === plan) schowekRef.current = null;
        const pusty = () => {
          try {
            void navigator.clipboard.writeText("").catch(() => {});
          } catch {
            // Schowek niedostępny: nic więcej nie zrobimy
          }
        };
        if (document.hasFocus()) pusty();
        else window.addEventListener("focus", pusty, { once: true });
      },
    };
    schowekRef.current = plan;
    if (statusRef.current !== "odblokowany" || !zamontowana.current) {
      plan.wyczysc();
      return false;
    }
    return true;
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
    // Kolejność widoczna w chwili kliknięcia; nowy wiersz stanie na jej końcu, także gdy filtr go odrzuca
    const kolejnosc = widoczneWiersze.map((r) => r.id);
    const id = await store.addRowInline();
    setDodawanie(false);
    if (id !== null) {
      setNowyId(id);
      setPrzypiety({ id, kolejnosc: [...kolejnosc, id] });
    }
  }

  // „Dodaj” w kolumnie tablicy: wiersz od razu na serwerze z wartością kolumny (null = „Bez wartości”),
  // potem pole „Nazwa” na nowej karcie (S2Table: edit.fresh). Nowa karta jest przypięta jak „Nowy wiersz”
  // w tabeli, więc nie znika przez filtr, dopóki nazwa się nie zapisze.
  const [nowaKarta, setNowaKarta] = React.useState<string | null>(null);
  async function dodajNaTablicy(wartosc: string | null) {
    if (!poleTablicy) return;
    setDodawanie(true);
    const kolejnosc = widoczneWiersze.map((r) => r.id);
    const id = await store.addRowInline({ [poleTablicy.id]: wartosc });
    setDodawanie(false);
    if (id !== null) {
      setNowaKarta(id);
      setPrzypiety({ id, kolejnosc: [...kolejnosc, id] });
    }
  }

  // „+ Widok” i „Zapisz jako widok”: „Mój widok N” (pierwszy wolny numer, S2Table) z bieżącymi filtrami
  async function dodajWidok(zFiltra = false) {
    let n = 1;
    while (settings.views.some((v) => v.name === `Mój widok ${n}`)) n++;
    const nazwa = `Mój widok ${n}`;
    if (await (zFiltra ? store.saveFiltersAsView(nazwa) : store.addView(nazwa))) toast(`Zapisano „${nazwa}” z obecnymi filtrami`);
  }

  // Przycisk główny nagłówka strony dodaje wiersz tą samą drogą co „Nowy wiersz” (moduł przy zamkniętym sejfie: nic)
  React.useEffect(() => {
    if (!newRowRef) return;
    newRowRef.current = tylkoOdczyt ? null : () => void nowyWiersz();
    return () => {
      newRowRef.current = null;
    };
  });

  const edytowany = editing?.rowId ? rows.find((r) => r.id === editing.rowId) : undefined;
  const tytulowe = fields.find((f) => f.isTitle);
  const tytulArkusza =
    editing?.rowId === null
      ? "Nowy wiersz"
      : edytowany && tytulowe && typeof edytowany.values[tytulowe.id] === "string"
        ? (edytowany.values[tytulowe.id] as string)
        : (tytulowe?.config.empty_label ?? "Bez tytułu");

  // Licznik numerów wierszy (kolumna „#”) liczony w trakcie rysowania grup
  let numer = 0;

  return (
    <>
      {renderPhone && (
        <div className="min-[800px]:hidden">
          <UkladTelefonu render={renderPhone} api={{
            fields,
            rows: wierszeTelefonu,
            readOnly: tylkoOdczyt,
            createOption: store.createOption,
            removeOption: store.removeOption,
            newRow: () => {
              setWArkuszu(true);
              void store.addRowDraft();
            },
            editRow: (r) => {
              setWArkuszu(true);
              void store.startEdit(r);
            },
            planClipboardClear: () => zaplanujSchowek(),
          }} />
        </div>
      )}
      <div className={cn("flex min-w-0 flex-col gap-3", renderPhone && "max-[799px]:hidden")}>
        <PinnedCards
          cards={settings.pinned_cards}
          fields={fields}
          rows={widoczneWiersze}
          today={today}
          onChange={(next) => void store.patchSettings({ pinned_cards: next })}
          onAdd={() => setOknoKarty({ karta: null })}
          onEdit={(index) => setOknoKarty({ karta: settings.pinned_cards[index] ?? null })}
        />
        {/* Okno karty montujemy dopiero po otwarciu, żeby każde zaczynało od stanu startowego */}
        {importCsvOtwarty && (
          <CsvImportDialog
            open
            onOpenChange={(o) => {
              if (!o) setImportCsvOtwarty(false);
            }}
            blockId={block.id}
            tableName={nazwaTabeli}
            fields={fields}
            rows={rows}
            onImported={() => router.refresh()}
          />
        )}
        {oknoKarty && (
          <CardDialog
            open
            tableName={store.tableName}
            fields={fields}
            rows={widoczneWiersze}
            today={today}
            initial={oknoKarty.karta}
            onCancel={() => setOknoKarty(null)}
            onSave={(karta) => {
              const edytowana = oknoKarty.karta;
              // Nowa karta na końcu listy
              if (edytowana === null) {
                void store.patchSettings({ pinned_cards: [...settings.pinned_cards, karta] });
                setOknoKarty(null);
                return;
              }
              // Edycja: karta szukana w aktualnej liście — ten sam obiekt, a po odświeżeniu z serwera
              // (nowe obiekty) karta o tej samej treści
              let index = settings.pinned_cards.indexOf(edytowana);
              if (index === -1) {
                const tresc = JSON.stringify(edytowana);
                index = settings.pinned_cards.findIndex((c) => JSON.stringify(c) === tresc);
              }
              // Karty już nie ma (usunięta przy otwartym oknie): nie dodajemy jej z powrotem
              if (index === -1) {
                toast.error("Tej karty już nie ma.");
                setOknoKarty(null);
                return;
              }
              void store.patchSettings({
                pinned_cards: settings.pinned_cards.map((c, j) => (j === index ? karta : c)),
              });
              setOknoKarty(null);
            }}
          />
        )}


        {/* S2Table: zakładki widoków po lewej, pasek narzędzi po prawej, linia pod spodem */}
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2 border-b border-black/[.08]">
          <ViewTabs
            tabs={[
              { id: null, name: "Wszystkie", count: viewCount(fields, rows, widokWszystkich, today) },
              ...settings.views.map((v) => ({
                id: v.id,
                // Widok „Przeczytane w <rok>” z filtrem „ten rok” nie zamraża roku: na zakładce jest bieżący
                name:
                  /^Przeczytane w \d{4}$/.test(v.name) && v.filters.some((c) => c.op === "this_year")
                    ? `Przeczytane w ${today.slice(0, 4)}`
                    : v.name,
                count: viewCount(fields, rows, v, today),
              })),
            ]}
            activeId={settings.active_view_id !== null && settings.views.some((v) => v.id === settings.active_view_id) ? settings.active_view_id : null}
            readOnly={tylkoOdczyt}
            onSelect={(id) => void store.selectView(id)}
            onAdd={() => void dodajWidok()}
            onRename={(id, nazwa) => void store.renameView(id, nazwa)}
            onDuplicate={(id) => void store.duplicateView(id)}
            onDelete={(id) => void store.deleteView(id)}
          />
          <TableToolbar
            fields={fields}
            view={widok}
            query={store.query}
            onQuery={store.setQuery}
            onLayout={(layout) => void store.setLayout(layout)}
            onGroupBy={(id) => void store.setGroupBy(id)}
            onSort={(sort) => void store.patchView({ sort })}
            onHiddenChange={(ids) => void store.patchView({ hidden_field_ids: ids })}
            filter={
              <FilterPopover
                fields={fields}
                filters={filtry}
                today={today}
                rows={zywe}
                shown={widoczneWiersze.length}
                total={zywe.length}
                open={filtrOtwarty}
                onOpenChange={setFiltrOtwarty}
                onChange={(filters) => void store.patchView({ filters })}
                onSaveAsView={
                  tylkoOdczyt
                    ? undefined
                    : () => {
                        setFiltrOtwarty(false);
                        void dodajWidok(true);
                      }
                }
                triggerClassName={cn(PRZYCISK_PASKA, filtry.length > 0 && PRZYCISK_PASKA_ON, "max-[799px]:border max-[799px]:border-input")}
                // Telefon: sortowanie w tym samym arkuszu co filtr (zapis od razu do bieżącego widoku)
                sort={widok.sort}
                onSortChange={(sort) => void store.patchView({ sort })}
              />
            }
            menu={
              <ActionPopover
                open={menuTabeli}
                onOpenChange={setMenuTabeli}
                align="end"
                width={240}
                className="p-1"
                ariaLabel="Ustawienia tabeli"
                onCloseAutoFocus={(e) => {
                  // „Nowa kolumna” otwiera okno pola przy nagłówku: fokus nie wraca na „⋯”
                  if (bezZwrotuFokusu.current) {
                    e.preventDefault();
                    bezZwrotuFokusu.current = false;
                  }
                }}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    aria-label="Menu tabeli"
                    aria-expanded={menuTabeli}
                    className="size-[30px] aria-expanded:bg-accent max-[799px]:size-11"
                  >
                    <Ellipsis aria-hidden="true" className="size-4" />
                  </Button>
                }
              >
                {/* S2TableMenu.dc.html; moduł Hasła (S2Passwords): stałe kolumny i „Zresetuj sejf…” */}
                <div role="menu" aria-label="Menu tabeli">
                  {modul ? (
                    <p className="mx-2 mt-1 mb-1.5 text-xs text-muted-foreground">Kolumny modułu Hasła są stałe.</p>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        // Na tablicy okno „Nowe pole” jest tylko w pustym stanie (bez pola Wyboru i Statusu)
                        disabled={tablica && poleTablicy !== null}
                        onClick={() => {
                          bezZwrotuFokusu.current = true;
                          setMenuTabeli(false);
                          otworzNowePole.current?.();
                        }}
                        className={POZYCJA}
                      >
                        Nowa kolumna
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuTabeli(false);
                          setOknoKarty({ karta: null });
                        }}
                        className={POZYCJA}
                      >
                        Dodaj kartę statystyki
                      </button>
                    </>
                  )}
                  <div className={MENU_SEPARATOR} />
                  {/* CSV: obsługę dostarcza wywołujący (import i eksport w osobnym kroku); Hasła bez importu */}
                  {!modul && (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!importujCsv}
                      onClick={() => {
                        setMenuTabeli(false);
                        importujCsv?.();
                      }}
                      className={POZYCJA}
                    >
                      Importuj z CSV…
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuTabeli(false);
                      eksportujCsv();
                    }}
                    className={POZYCJA}
                  >
                    Eksportuj całą tabelę (CSV)
                  </button>
                  {((!modul && onRemove) || modul) && <div className={MENU_SEPARATOR} />}
                  {!modul && onRemove && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuTabeli(false);
                        onRemove();
                      }}
                      className={cn(POZYCJA, MENU_ITEM_DANGER)}
                    >
                      Usuń tabelę
                    </button>
                  )}
                  {modul && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuTabeli(false);
                        setResetSejfu(true);
                      }}
                      className={cn(POZYCJA, MENU_ITEM_DANGER)}
                    >
                      Zresetuj sejf…
                    </button>
                  )}
                </div>
              </ActionPopover>
            }
          />
        </div>
        {/* Okno resetu sejfu montujemy dopiero po wyborze z menu */}
        {resetSejfu && <VaultResetDialog open onOpenChange={(o) => setResetSejfu(o)} />}

        {/* Układ Tablica (S2Table, .kboard) zamiast ramki z tabelą */}
        {tablica && (
          <BoardView
            fields={fields}
            // Pole „Repo” szablonu Projektów nie trafia na kartę (S2Table: c.k !== 'repo')
            visibleFields={widocznePola.filter((f) => f.id !== poleRepoTablicy?.id)}
            rows={widoczneWiersze}
            boardField={poleTablicy}
            today={today}
            readOnly={tylkoOdczyt}
            passwords={modul}
            summaries={sumyGrup}
            adding={dodawanie}
            addField={
              modul ? undefined : (
                <AddFieldDialog
                  openRef={otworzNowePole}
                  allowSecret={false}
                  fields={fields}
                  onAdd={(input) => void store.addField(input)}
                />
              )
            }
            // Zapis z cofnięciem i toastem po błędzie (Review Focus 4) robi store.updateCell
            onMove={(r, wartosc) => {
              if (poleTablicy) void store.updateCell(r, poleTablicy, wartosc);
            }}
            onAdd={(wartosc) => void dodajNaTablicy(wartosc)}
            onOpen={(r) => {
              setWArkuszu(true);
              void store.startEdit(r);
            }}
            newCardId={nowaKarta}
            onNameNew={(r, nazwa) => {
              setNowaKarta(null);
              setPrzypiety(null);
              if (tytulowe) void store.updateCell(r, tytulowe, nazwa);
            }}
            // Pusta nowa karta znika po cichu (bez toastu „Usunięto”)
            onDiscardNew={(r) => {
              setNowaKarta(null);
              setPrzypiety(null);
              void store.removeRow(r, true);
            }}
          />
        )}

        {/* .frame > .inner: ramka 1,5 px, promień 12 px; tabela przewija się poziomo, gdy kolumny się nie mieszczą,
            a stopka „Nowy wiersz” z liczbą wierszy stoi pod nią w tej samej ramce */}
        {!tablica && (
        <div className={RAMKA}>
        <div className={RAMKA_PRZEWIJANA}>
          {/* table-layout: fixed; --szerokosc-tabeli = suma kolumn + 56 px (kolumna „+” albo „Akcje” z koszem); od 800 px
              klasa dolicza 76 px kolumn zaznaczania (36) i „#” (40), których na telefonie nie ma. Nie węższa niż ramka. */}
          <table
            className="w-[calc(var(--szerokosc-tabeli)+76px)] border-collapse text-sm max-[799px]:w-(--szerokosc-tabeli)"
            style={{ tableLayout: "fixed", "--szerokosc-tabeli": `${sumaSzerokosci + 56}px`, minWidth: "100%" } as React.CSSProperties}
          >
            <colgroup>
              <col className="max-[799px]:hidden" style={{ width: 36 }} />
              <col className="max-[799px]:hidden" style={{ width: 40 }} />
              {widocznePola.map((f, i) => (
                <col key={f.id} style={{ width: szerokosci[i] }} />
              ))}
              {/* Ostatnia kolumna („+” i kosz) bez szerokości: wypełnia ramkę */}
              <col />
            </colgroup>
            <thead>
              <tr>
                {/* „Zaznacz wszystkie widoczne” (.ck) i „#” (szary, #a3a3a3) */}
                <th scope="col" className={cn(NAGLOWEK, "w-9 pr-0 pl-3 max-[799px]:hidden")}>
                  {!tylkoOdczyt && (
                    <span className="inline-flex align-middle">
                      <Checkbox
                        checked={wszystkieZaznaczone}
                        ariaLabel="Zaznacz wszystkie widoczne"
                        onChange={(c) => setZaznaczone(c ? widoczneWiersze.map((r) => r.id) : [])}
                      />
                    </span>
                  )}
                </th>
                <th scope="col" className={cn(NAGLOWEK, "text-left font-normal text-faint-foreground max-[799px]:hidden")}>
                  #
                </th>
                {widocznePola.map((f, kolumna) => {
                  // Przesuwanie liczy się po wszystkich kolumnach (także ukrytych), jak kolejność na serwerze
                  const indeks = fields.indexOf(f);
                  return (
                    <th
                      key={f.id}
                      scope="col"
                      className={`group/kol relative ${NAGLOWEK} ${f.type === "number" || f.type === "recurring" ? "text-right" : "text-left"}`}
                    >
                      <ColumnMenu
                        field={f}
                        fields={fields}
                        // Kolumny modułu są stałe: bez zmiany nazwy, typu, przesuwania i usuwania
                        locked={modul}
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
                        onSort={(dir) => void store.patchView({ sort: [{ field_id: f.id, dir }] })}
                        onGroupBy={() => void store.setGroupBy(f.id)}
                        onFilter={() => {
                          bezZwrotuFokusu.current = true;
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
                            // Data odnowienia jest w kalendarzu domyślnie (brak klucza = włączone), zwykła data nie
                            config: {
                              ...f.config,
                              show_in_calendar:
                                f.type === "renewal"
                                  ? f.config.show_in_calendar === false
                                  : f.config.show_in_calendar !== true,
                            },
                          })
                        }
                        onConfig={(patch) => {
                          // Klucz z wartością undefined znika z configu (np. „— zawsze —” usuwa active_field_id)
                          const config: FieldConfig = { ...f.config, ...patch };
                          for (const klucz of Object.keys(patch) as (keyof FieldConfig)[]) {
                            if (patch[klucz] === undefined) delete config[klucz];
                          }
                          void store.patchField(f, { config });
                        }}
                        onHide={() => void store.patchView({ hidden_field_ids: [...widok.hidden_field_ids, f.id] })}
                        onDelete={() => void store.removeField(f)}
                        onMoveLeft={() => void store.moveField(f, -1)}
                        onMoveRight={() => void store.moveField(f, 1)}
                        // Kolumna tytułu się nie przesuwa i nic nie wchodzi przed nią (jak w store.moveField)
                        firstColumn={f.isTitle || indeks === 0 || fields[indeks - 1].isTitle}
                        lastColumn={f.isTitle || indeks === fields.length - 1 || fields[indeks + 1].isTitle}
                        // Moduł przy zamkniętym sejfie: opcji (Kategorii) nie zmienia się
                        onAddOption={tylkoOdczyt ? undefined : (etykieta) => void store.addOption(f, etykieta)}
                        onRemoveOption={tylkoOdczyt ? undefined : (id) => void store.removeOption(f, id)}
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
                {/* Ostatni nagłówek: „+” otwiera „Nowe pole” (bez Sekretu); pod nim kolumna akcji wiersza.
                    W module bez „+”: nagłówek „Akcje” tylko dla czytnika ekranu (S2Passwords) */}
                <th scope="col" className="h-10 border-b border-border px-1 text-left">
                  {modul ? (
                    <span className="sr-only">Akcje</span>
                  ) : (
                    <AddFieldDialog
                      iconTrigger
                      openRef={otworzNowePole}
                      allowSecret={false}
                      fields={fields}
                      onAdd={(input) => void store.addField(input)}
                    />
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Puste stany (S2Table): pusta tabela albo nic nie pasuje do filtrów i szukania */}
              {widoczneWiersze.length === 0 && (
                <tr>
                  <td colSpan={widocznePola.length + 3} className="h-20 text-center text-muted-foreground">
                    {zywe.length === 0 ? (
                      <>
                        Pusta tabela.{" "}
                        {!tylkoOdczyt && (
                          <Button variant="ghost" size="xs" disabled={dodawanie} onClick={() => void nowyWiersz()}>
                            Dodaj pierwszy wiersz
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        Nic nie pasuje do filtrów.{" "}
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            // Szukanie i filtry „Wszystkich” znikają, a tabela wraca do zakładki „Wszystkie”
                            store.setQuery("");
                            const patch: { filters?: []; active_view_id?: null } = {};
                            if (settings.filters.length > 0) patch.filters = [];
                            if (settings.active_view_id !== null) patch.active_view_id = null;
                            if (Object.keys(patch).length > 0) void store.patchSettings(patch);
                          }}
                        >
                          Wyczyść filtry i szukanie
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              )}
              {grupy.map((g) => {
                const zwinieta = g.key !== "*" && zwiniete.includes(g.key);
                const sumaGrupy = zwinieta ? "" : (sumyGrup.get(g.key) ?? "");
                return (
                  <React.Fragment key={g.key}>
                    {/* Nagłówek grupy (tr.grp): strzałka zwijania, odznaka opcji, liczba wierszy i podsumowanie grupy */}
                    {g.key !== "*" && (
                      <tr>
                        <td
                          colSpan={widocznePola.length + 3}
                          className="h-9 border-b border-black/[.06] bg-[#fafafa] px-3 max-[799px]:px-2"
                        >
                          <span className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="xs"
                              icon
                              aria-expanded={!zwinieta}
                              aria-label={`${zwinieta ? "Rozwiń" : "Zwiń"} grupę ${g.label}`}
                              onClick={() => void store.toggleGroup(g.key)}
                              className="text-muted-foreground"
                            >
                              <ChevronDown
                                aria-hidden="true"
                                className={cn("size-3.5 transition-transform", zwinieta && "-rotate-90")}
                              />
                            </Button>
                            <OptionBadge option={{ id: g.key, label: g.label, color: g.color ?? "" }} />
                            <span className="text-xs text-muted-foreground tabular-nums">{g.rows.length}</span>
                            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                              {zwinieta ? `zwinięte · ${g.rows.length} ukryte` : sumaGrupy}
                            </span>
                          </span>
                        </td>
                      </tr>
                    )}
                    {!zwinieta &&
                      g.rows.map((r) => {
                        // Numer wiersza: pozycja wśród pokazanych wierszy, ciągła przez grupy
                        numer += 1;
                        const nr = numer;
                        const zaznaczony = zaznaczoneSet.has(r.id);
                        return (
                <tr
                  key={r.id}
                  data-zaznaczony={zaznaczony || undefined}
                  // Wiersz nieaktywny (odznaczona „Aktywna” wskazana przez Datę odnowienia) jest przygaszony (S2Main)
                  style={
                    fields.some(
                      (f) =>
                        f.type === "renewal" &&
                        f.config.active_field_id !== undefined &&
                        !rowActive(f, fields, r.values),
                    )
                      ? { opacity: 0.55 }
                      : undefined
                  }
                  // Telefon: dotknięcie wiersza otwiera arkusz zamiast zmieniać komórkę (sprawdzamy w chwili dotknięcia)
                  onClickCapture={(e) => {
                    // Moduł przy zamkniętym sejfie: arkusz się nie otwiera
                    if (!naTelefonie() || tylkoOdczyt) return;
                    // Checkbox, plakietka Wyboru i kosz działają w wierszu od razu (CMEditor)
                    if (e.target instanceof Element && e.target.closest("[data-m-akcja]")) return;
                    e.preventDefault();
                    e.stopPropagation();
                    // Wiersz w trakcie zapisu (tymczasowe id) store otworzy sam po odpowiedzi serwera
                    if (editing?.rowId === r.id) return;
                    setWArkuszu(true);
                    void store.startEdit(r);
                  }}
                  // Fokus w wierszu przypina go (pozycja i widoczność). Przejście z innego wiersza zostawia
                  // zapamiętaną kolejność, żeby przeliczenie nie przeniosło w DOM wiersza z fokusem.
                  onFocus={() => {
                    setPrzypiety((p) =>
                      p?.id === r.id
                        ? p
                        : { id: r.id, kolejnosc: p ? p.kolejnosc : widoczneWiersze.map((w) => w.id) },
                    );
                  }}
                  // Wyjście fokusu z wierszy tabeli: widok liczy się znów wg filtra i sortu.
                  // Fokus w okienku komórki (portal) wraca tu przez onFocus z drzewa Reacta.
                  onBlur={(e) => {
                    const cel = e.relatedTarget;
                    if (cel instanceof Node && e.currentTarget.contains(cel)) return;
                    if (cel instanceof Element && cel.closest("tr")?.parentElement === e.currentTarget.parentElement) return;
                    setPrzypiety(null);
                  }}
                  // Na telefonie pola i przyciski komórek nie łapią dotyku: dostaje go wiersz.
                  // Zaznaczony wiersz ma niebieskawe tło (tr.row.sel td: #f5f8ff)
                  className="group/wiersz data-[zaznaczony=true]:[&>td]:bg-[#f5f8ff] max-[799px]:cursor-pointer max-[799px]:[&_a]:pointer-events-none max-[799px]:[&_button]:pointer-events-none max-[799px]:[&_input]:pointer-events-none"
                >
                  {/* Zaznaczanie wiersza (.ck) i numer („#”, szary) — tylko web */}
                  <td className="h-11 border-b border-border pr-0 pl-3 group-last/wiersz:border-b-0 max-[799px]:hidden">
                    {!tylkoOdczyt && (
                      <span className="inline-flex align-middle">
                        <Checkbox
                          checked={zaznaczony}
                          ariaLabel={`Zaznacz: ${
                            tytulowe && typeof r.values[tytulowe.id] === "string" && r.values[tytulowe.id] !== ""
                              ? (r.values[tytulowe.id] as string)
                              : "bez nazwy"
                          }`}
                          onChange={(c) =>
                            setZaznaczone((l) => (c ? [...l.filter((id) => id !== r.id), r.id] : l.filter((id) => id !== r.id)))
                          }
                        />
                      </span>
                    )}
                  </td>
                  <td className="h-11 border-b border-border px-3 text-xs text-muted-foreground tabular-nums group-last/wiersz:border-b-0 max-[799px]:hidden">
                    {nr}
                  </td>
                  {widocznePola.map((f) => (
                    <TableCell
                      key={f.id}
                      row={r}
                      field={f}
                      fields={fields}
                      today={today}
                      done={zrobione}
                      autoFocus={f.isTitle && r.id === nowyId}
                      readOnly={tylkoOdczyt}
                      revealed={odsloniete.includes(r.id)}
                      // Moduł: oczko w komórkach sekretów odsłania sekrety całego wiersza, kopiowanie planuje czyszczenie
                      onToggleReveal={
                        modul
                          ? () => setOdsloniete((l) => (l.includes(r.id) ? l.filter((id) => id !== r.id) : [...l, r.id]))
                          : undefined
                      }
                      onCopied={
                        modul
                          ? () => {
                              // Czyszczenie schowka po 30 s (plan nie trzyma skopiowanego tekstu); bez planu toast pomijamy
                              if (!zaplanujSchowek()) return;
                              const serwis =
                                tytulowe && typeof r.values[tytulowe.id] === "string" ? (r.values[tytulowe.id] as string) : "";
                              toast(f.name === "Hasło" ? `Skopiowano hasło ${serwis}`.trim() : `Skopiowano: ${f.name}`, {
                                description: "Schowek wyczyści się za 30 s.",
                              });
                            }
                          : undefined
                      }
                      onSave={(v) => void store.updateCell(r, f, v)}
                      onCreateOption={(etykieta) => store.createOption(f, etykieta)}
                      onUpdateOption={(id, patch) => void store.updateOption(f, id, patch)}
                      onRemoveOption={(id) => void store.removeOption(f, id)}
                      // Kursor w nowym wierszu ustawiamy raz: po pierwszym fokusie komórka nie kradnie go przy zmianie filtra czy sortu
                      onFocused={f.isTitle && r.id === nowyId ? () => setNowyId(null) : undefined}
                    />
                  ))}
                  {/* Kosz pod „+” (w module pod „Akcje”): widoczny po najechaniu na wiersz i przy fokusie w wierszu
                      (.row-del); w module przy zamkniętym sejfie go nie ma */}
                  <td className="h-11 border-b border-border px-1.5 text-right whitespace-nowrap group-last/wiersz:border-b-0">
                    {!tylkoOdczyt && (
                      <Button
                        variant="ghost"
                        size="xs"
                        icon
                        aria-label="Usuń wiersz"
                        data-m-akcja=""
                        // Telefon: bez potwierdzenia, z toastem „Cofnij” jak na webie (T17)
                        onClick={() => void store.removeRow(r)}
                        className={cn(AKCJA_WIERSZA, "text-destructive-foreground hover:text-destructive-foreground max-[799px]:text-faint-foreground")}
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
            {/* Stopka z podsumowaniami kolumn (S2Books: „średnio 4,1”), tylko gdy któraś kolumna ma podsumowanie */}
            {saPodsumowania && (
              <tfoot>
                <tr className="bg-black/[.02]">
                  <td className="border-t border-border max-[799px]:hidden" />
                  <td className="border-t border-border max-[799px]:hidden" />
                  {widocznePola.map((f) => (
                    <SummaryCell
                      key={f.id}
                      field={f}
                      fields={fields}
                      rows={widoczneWiersze}
                      summary={settings.column_summaries[f.id]}
                      today={today}
                    />
                  ))}
                  <td className="border-t border-border" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {/* Stopka ramki: „Nowy wiersz” (.tb) i opis liczby wierszy („11 książek · 9 przeczytanych”); w module przy
            zamkniętym sejfie bez przycisku. Telefon (CMEditor): plakietka z liczbą wierszy po prawej */}
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-black/[.06] px-3 py-1.5 text-[13px] text-muted-foreground">
          {!tylkoOdczyt ? (
            <button
              type="button"
              disabled={dodawanie}
              onClick={() => void nowyWiersz()}
              className={cn(PRZYCISK_PASKA, "-ml-2.5 disabled:cursor-not-allowed disabled:opacity-[.64] max-[799px]:h-11")}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              Nowy wiersz
            </button>
          ) : (
            <span />
          )}
          <span className="tabular-nums max-[799px]:hidden">{tekstStopki}</span>
          <StatusBadge tone="gray" className="min-[800px]:hidden">
            {rowsLabel(widoczneWiersze.length)}
          </StatusBadge>
        </div>
        </div>
        )}

        {/* Pasek akcji dla zaznaczonych (S2Table, .bulk) */}
        {wybrane.length > 0 && widok.layout !== "board" && (
          <BulkBar
            count={wybrane.length}
            field={poleZmiany}
            onSetValue={(wartosc, etykieta) => {
              // Akcje serwera przyjmują najwyżej 500 id naraz
              if (wybrane.length > 500) {
                toast.error("Maksymalnie 500 wierszy naraz");
                return;
              }
              if (poleZmiany) void store.setRowsValue(wybrane, poleZmiany, wartosc, etykieta);
            }}
            onDuplicate={() => {
              if (wybrane.length > 500) {
                toast.error("Maksymalnie 500 wierszy naraz");
                return;
              }
              setZaznaczone([]);
              void store.duplicateRows(wybrane);
            }}
            onExportCsv={() => eksportujZaznaczone(wybrane)}
            onDelete={() => {
              if (wybrane.length > 500) {
                toast.error("Maksymalnie 500 wierszy naraz");
                return;
              }
              setZaznaczone([]);
              void store.removeRows(wybrane);
            }}
            onClear={() => setZaznaczone([])}
          />
        )}

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
          allFields={fields}
          values={editing?.values ?? {}}
          today={today}
          onChange={store.setEditValue}
          // Arkusz szyfruje zmienione sekrety sam i oddaje tylko szyfrogramy
          // (obietnica kończy się z zapisem: „Zapisz” w arkuszu jest zajęty do tego czasu)
          onSave={(secrets) => store.saveRow(secrets)}
          planClipboardClear={() => zaplanujSchowek()}
          onCancel={store.cancelEdit}
          onDelete={edytowany ? () => void store.removeRow(edytowany) : undefined}
        />
      </div>
    </>
  );
}
