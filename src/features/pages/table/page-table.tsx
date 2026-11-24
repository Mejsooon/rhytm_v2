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
import { useVault } from "@/features/vault/vault-provider";
import { cn } from "@/lib/utils";

import {
  DOMYSLNA_SZEROKOSC,
  MIN_SZEROKOSC_KOLUMNY,
  SZEROKOSC_TYTULU,
  planTypeChange,
  rowActive,
  type FieldConfig,
  type FieldType,
  type PageField,
} from "../fields";
import { TypeChangeDialog } from "../editor/type-change-dialog";
import type { LoadedBlock } from "../load-page";
import { rowsLabel } from "../rows-label";
import { operatorsFor, visibleRows, type PageRow, type PinnedCard } from "../table-model";
import { AddFieldDialog } from "./add-field-dialog";
import { CardDialog } from "./card-dialog";
import { ColumnMenu } from "./column-menu";
import { FilterPopover } from "./filter-popover";
import { MRowSheet } from "./mobile/m-row-sheet";
import { PinnedCards } from "./pinned-cards";
import { SummaryCell } from "./summary-cell";
import { TableCell } from "./table-cell";
import { PREFIKS_TYMCZASOWY, useTableStore } from "./use-table-store";

// Nagłówek tabeli (.th): 40 px, ikona typu i nazwa; liczby do prawej
// Telefon (th-cell z CMEditor): 44 px, tło .02, linia pod spodem .08 i prawa linia komórki
const NAGLOWEK =
  "h-10 border-b border-border px-3 font-medium whitespace-nowrap text-muted-foreground max-[799px]:h-11 max-[799px]:border-r max-[799px]:border-b-black/[.08] max-[799px]:border-r-border max-[799px]:bg-black/[.02]";

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

// Po tylu ms od skopiowania hasła czyścimy schowek
const SCHOWEK_MS = 30_000;

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

// Jeden blok tabeli (S2Books.dc.html): przypięte karty, pasek z nazwą tabeli, plakietką sortu, „Filtruj”
// i menu „⋯”, ramka z tabelą (menu kolumn, „+” dodające pole, wiersze z komórkami edytowanymi wprost
// jak w Notion, kosz po najechaniu, stopka z liczbą wierszy i podsumowaniami) i „+ Nowy” pod ramką.
// Na telefonie dotknięcie wiersza otwiera arkusz.
// Działa tylko na danych bloku — bez tytułu strony. `onRemove` (z edytora) usuwa cały blok tabeli.
// `module="passwords"` (moduł Hasła, S2Passwords.dc.html): stałe kolumny (menu kolumny zablokowane, bez „+”
// dodającego kolumnę), kolumna „Akcje” z oczkiem i „Kopiuj hasło”, a przy zamkniętym sejfie cała tabela
// jest tylko do odczytu (bez „+ Nowy”, kosza i arkusza). Tekst jawny żyje tylko w komórkach i arkuszu.
// W module nazwa tabeli nie jest pokazywana (S2Passwords nie ma paska nazwy); w jej miejscu `moduleTools`.
export function PageTable({
  block,
  today,
  onRemove,
  module,
  moduleTools,
  moduleRowFilter,
  onLiveRowCount,
  renderPhone,
}: {
  block: LoadedBlock;
  today: IsoDate;
  onRemove?: () => void;
  module?: "passwords";
  // Tylko w trybie modułu: zawartość paska po lewej (w miejscu nazwy tabeli), np. podpis i „Kategorie”.
  // Dostaje te same funkcje magazynu co komórki, więc opcje Kategorii nie rozjeżdżają się z tabelą.
  moduleTools?: (api: {
    fields: PageField[];
    readOnly: boolean;
    createOption: (field: PageField, label: string) => Promise<string | null>;
    removeOption: (field: PageField, optionId: string) => Promise<boolean>;
  }) => React.ReactNode;
  // Tylko w trybie modułu: dodatkowy, tymczasowy warunek na wiersze (wyszukiwarka i segment Kategorii z paska).
  // Stan zostaje u wywołującego (nie jest zapisywany), a warunek działa też przy zamkniętym sejfie;
  // dostaje tylko pola i wartości jawnych kolumn (wartości sekretów to szyfrogramy).
  moduleRowFilter?: (row: PageRow, fields: PageField[]) => boolean;
  // Tylko w trybie modułu: liczba żywych wierszy (bez filtrów), np. do plakietki w nagłówku ekranu
  onLiveRowCount?: (n: number) => void;
  // Tylko w trybie modułu: układ telefonu (CMPasswords) z tego samego magazynu co tabela. Oba układy są w DOM:
  // wynik funkcji widać poniżej 800 px, a tabelę webu (z paskiem, kartami i „+ Nowy”) tylko od 800 px.
  // Arkusz wiersza (MRowSheet) i okna zostają wspólne.
  renderPhone?: (api: PhoneTableApi) => React.ReactNode;
}) {
  const vault = useVault();
  // Zapis Sekretu odrzucony przez inną generację sejfu blokuje sejf
  const store = useTableStore(block, vault.onStaleGeneration);
  const { fields, rows, settings, editing } = store;
  const modul = module === "passwords";
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
  // „+ Nowy” czeka na serwer (przycisk wyłączony); id nowego wiersza dostaje kursor w komórce tytułu
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
  // Szkic nazwy tabeli; nowa nazwa ze store (zapis, cofnięcie po błędzie) zastępuje szkic
  const [szkicNazwy, setSzkicNazwy] = React.useState(store.tableName);
  const [zrodloNazwy, setZrodloNazwy] = React.useState(store.tableName);
  if (zrodloNazwy !== store.tableName) {
    setZrodloNazwy(store.tableName);
    setSzkicNazwy(store.tableName);
  }

  const zywe = rows.filter((r) => r.deletedAt === null);
  const liczbaZywych = zywe.length;
  React.useEffect(() => {
    onLiveRowCount?.(liczbaZywych);
  }, [onLiveRowCount, liczbaZywych]);
  const ukryte = new Set(settings.hidden_field_ids);
  const widocznePola = fields.filter((f) => !ukryte.has(f.id));
  // Widok wg filtra i sortu; przy przypiętym wierszu kolejność z chwili przypięcia (patrz `przypiety`)
  const wedlugUstawien = visibleRows(fields, rows, settings, store.tempFilters, today).filter(
    (r) => !modul || !moduleRowFilter || moduleRowFilter(r, fields),
  );
  // Przypięty wiersz usunięty (kosz, odświeżenie): przypięcie znika, widok liczy się normalnie
  if (przypiety && !zywe.some((r) => r.id === przypiety.id)) setPrzypiety(null);
  let widoczneWiersze = wedlugUstawien;
  if (przypiety && zywe.some((r) => r.id === przypiety.id)) {
    const poId = new Map(zywe.map((r) => [r.id, r]));
    const wFiltrze = new Set(wedlugUstawien.map((r) => r.id));
    // Wiersze z zapamiętanej kolejności: te, które nadal spełniają filtr, i zawsze przypięty
    const zamrozone = przypiety.kolejnosc.flatMap((id) => {
      const r = poId.get(id);
      return r && (id === przypiety.id || wFiltrze.has(id)) ? [r] : [];
    });
    const wZamrozonych = new Set(zamrozone.map((r) => r.id));
    // Wiersze, które dopiero teraz spełniają filtr (np. „Cofnij” usunięcia), dochodzą na końcu
    widoczneWiersze = [...zamrozone, ...wedlugUstawien.filter((r) => !wZamrozonych.has(r.id))];
  }
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

  // Czyszczenie schowka po skopiowaniu hasła: plan nie trzyma skopiowanego tekstu. Schowek da się zapisać tylko
  // z fokusem, więc bez fokusu czekamy jednorazowo na powrót do karty. Nowe kopiowanie zastępuje stary plan.
  // Nie sprawdzamy, co jest w schowku (readText wymaga uprawnienia), więc czyszczenie nadpisuje go bezwarunkowo.
  // Używają go komórki webu i lista telefonu. Zwraca false, gdy sejf zablokował się albo tabela zniknęła
  // w trakcie zapisu do schowka (czyścimy od razu).
  function zaplanujSchowek(): boolean {
    if (schowekRef.current) clearTimeout(schowekRef.current.timer);
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

  const edytowany = editing?.rowId ? rows.find((r) => r.id === editing.rowId) : undefined;
  const tytulowe = fields.find((f) => f.isTitle);
  const tytulArkusza =
    editing?.rowId === null
      ? "Nowy wiersz"
      : edytowany && tytulowe && typeof edytowany.values[tytulowe.id] === "string"
        ? (edytowany.values[tytulowe.id] as string)
        : (tytulowe?.config.empty_label ?? "Bez tytułu");

  return (
    <>
    {renderPhone && modul && (
      <div className="min-[800px]:hidden">
        <UkladTelefonu render={renderPhone} api={{
          fields,
          rows: widoczneWiersze,
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
    <div className={cn("flex min-w-0 flex-col gap-3", renderPhone && modul && "max-[799px]:hidden")}>
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

      {/* Pasek tabeli: nazwa (h2 16 px) po lewej, sort / Filtruj / ⋯ po prawej */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        {modul ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {moduleTools?.({
              fields,
              readOnly: tylkoOdczyt,
              createOption: store.createOption,
              removeOption: store.removeOption,
            })}
          </div>
        ) : (
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
        )}
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
            // Telefon: sortowanie w tym samym arkuszu co filtr (zapis od razu, jak w menu „⋯” tabeli)
            sort={settings.sort}
            onSortChange={(sort) => void store.patchSettings({ sort })}
          />
          <ActionPopover
            open={menuTabeli}
            onOpenChange={(o) => {
              // Zamknięcie menu (Esc, klik obok) zapisuje szkic nazwy z pola w menu
              if (!o && !modul) void store.renameTable(szkicNazwy);
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
            {/* W module nazwy tabeli się nie zmienia */}
            {!modul && (
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
            )}
            <div className={cn(MENU_LABEL, modul ? "pt-1" : "pt-2")}>Sortowanie</div>
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
        {/* table-layout: fixed; szerokość = suma kolumn + 56 px (kolumna „+” albo „Akcje” z koszem), nie węższa niż ramka */}
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
                      onHide={() =>
                        void store.patchSettings({ hidden_field_ids: [...settings.hidden_field_ids, f.id] })
                      }
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
                    allowSecret={false}
                    fields={fields}
                    onAdd={(input) => void store.addField(input)}
                  />
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {widoczneWiersze.map((r) => (
              <tr
                key={r.id}
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
                // Na telefonie pola i przyciski komórek nie łapią dotyku: dostaje go wiersz
                className="group/wiersz max-[799px]:cursor-pointer max-[799px]:[&_a]:pointer-events-none max-[799px]:[&_button]:pointer-events-none max-[799px]:[&_input]:pointer-events-none"
              >
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
            ))}
          </tbody>
          <tfoot>
            {/* Stopka: liczba wierszy (po filtrze) w pierwszej kolumnie, dalej podsumowania kolumn; padding 8 × 12 px jak w S2Books */}
            <tr className="bg-black/[.02]">
              {widocznePola.map((f, i) =>
                i === 0 ? (
                  <td key={f.id} className="border-t border-border px-3 py-2 text-muted-foreground tabular-nums">
                    {rowsLabel(widoczneWiersze.length)}
                  </td>
                ) : (
                  <SummaryCell
                    key={f.id}
                    field={f}
                    fields={fields}
                    rows={widoczneWiersze}
                    summary={settings.column_summaries[f.id]}
                    today={today}
                  />
                ),
              )}
              <td className="border-t border-border" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* „+ Nowy” pod ramką (.btng.sm, szary tekst); w module przy zamkniętym sejfie go nie ma.
          Telefon (CMEditor): „Nowy wiersz” (.btng muted) i plakietka z liczbą wierszy po prawej */}
      {!tylkoOdczyt && (
        <div className="flex items-center gap-3 max-[799px]:justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={dodawanie}
            onClick={() => void nowyWiersz()}
            className="text-muted-foreground max-[799px]:hidden"
          >
            <Plus aria-hidden="true" className="size-4" />
            Nowy
          </Button>
          <Button
            variant="ghost"
            size="md"
            disabled={dodawanie}
            onClick={() => void nowyWiersz()}
            className="text-muted-foreground min-[800px]:hidden"
          >
            <Plus aria-hidden="true" className="size-4" />
            Nowy wiersz
          </Button>
          <StatusBadge tone="gray" className="min-[800px]:hidden">
            {rowsLabel(widoczneWiersze.length)}
          </StatusBadge>
        </div>
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
        onSave={(secrets) => void store.saveRow(secrets)}
        onCancel={store.cancelEdit}
        onDelete={edytowany ? () => void store.removeRow(edytowany) : undefined}
      />
    </div>
    </>
  );
}
