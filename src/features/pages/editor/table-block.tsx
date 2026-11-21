"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, StatusBadge, type IsoDate } from "@/components/controls";
import {
  addField,
  addRow,
  changeFieldType,
  deleteField,
  deleteRow,
  reorderFields,
  restoreRow,
  updateBlockContent,
  updateField,
  updateRow,
} from "../actions";
import {
  EDITOR_TYPES,
  FIELD_TYPE_META,
  PALETA,
  nextOptionId,
  planTypeChange,
  type CellValue,
  type FieldConfig,
  type FieldOption,
  type FieldType,
  type PageField,
} from "../fields";
import type { LoadedBlock } from "../load-page";
import { BLAD_ZAPISU } from "../messages";
import { rowsForm, rowsLabel } from "../rows-label";
import { editorFooter, type PageRow } from "../table-model";
import { CellEditor, OptionBadge } from "./cell-editor";
import { MColumnSheet } from "./mobile/m-column-sheet";
import { ColumnPopover } from "./column-popover";
import { TypeChangeDialog } from "./type-change-dialog";

// Pole albo wiersz czekający na odpowiedź serwera ma tymczasowe id z tym prefiksem
const PREFIKS_TYMCZASOWY = "tmp-";

// Odmiana „N kolumna / kolumny / kolumn” (jak pl() z EmptyPage.dc.html)
function kolumnyLabel(n: number): string {
  const forma = rowsForm(n);
  if (forma === "one") return `${n} kolumna`;
  if (forma === "few") return `${n} kolumny`;
  return `${n} kolumn`;
}

type PlanZmianyTypu = ReturnType<typeof planTypeChange>;

// Blok tabeli w edytorze (EmptyPage.dc.html): komórki edytowane w miejscu, dymek kolumny,
// „+” w nagłówku, „+ Nowy wiersz”, licznik i stopka z sumami. Pola i wiersze mają lokalną kopię
// z optymistycznymi zmianami; błąd zapisu cofa zmianę i pokazuje toast.
export function TableBlock({
  block,
  today,
}: {
  block: LoadedBlock;
  // Tryb edycji z interfejsu zadania; edytor zna tylko edycję bezpośrednio w komórkach
  editable?: "cell";
  today?: IsoDate;
}) {
  const [pola, setPola] = React.useState<PageField[]>(block.fields);
  const [wiersze, setWiersze] = React.useState<PageRow[]>(block.rows);
  const [zrodloPol, setZrodloPol] = React.useState(block.fields);
  const [zrodloWierszy, setZrodloWierszy] = React.useState(block.rows);
  // Zapisy w toku: pola (licznik operacji) i komórki wierszy (id → zmiany do nałożenia na dane z serwera)
  const polaWToku = React.useRef(0);
  const komorkiWToku = React.useRef(new Map<string, { n: number; zmiany: Record<string, unknown> }>());
  // Komórki zmienione w wierszu, który jeszcze nie ma prawdziwego id
  const oczekujaceKomorki = React.useRef(new Map<string, Record<string, unknown>>());
  const licznik = React.useRef(0);
  // Prawdziwe id → klucz Reacta z czasu tymczasowego id (dymek i fokus nie znikają po odpowiedzi serwera)
  const [klucze, setKlucze] = React.useState<Record<string, string>>({});

  // Nowe dane z serwera nie mogą zgubić pól i wierszy tymczasowych ani zapisów w toku
  if (zrodloPol !== block.fields) {
    setZrodloPol(block.fields);
    // Przy zmianach pól w toku zostaje lokalna kopia (serwer jeszcze ich nie widzi)
    setPola((l) =>
      polaWToku.current > 0
        ? l
        : [...block.fields, ...l.filter((f) => f.id.startsWith(PREFIKS_TYMCZASOWY))],
    );
  }
  if (zrodloWierszy !== block.rows) {
    setZrodloWierszy(block.rows);
    setWiersze((l) => [
      ...block.rows.map((r) => {
        const wToku = komorkiWToku.current.get(r.id);
        return wToku ? { ...r, values: { ...r.values, ...wToku.zmiany } } : r;
      }),
      ...l.filter((r) => r.id.startsWith(PREFIKS_TYMCZASOWY)),
    ]);
  }

  // Nazwa tabeli: szkic + ostatnia zapisana wartość
  const nazwaZSerwera = typeof block.content.name === "string" ? block.content.name : "";
  const [nazwa, setNazwa] = React.useState(nazwaZSerwera);
  const [zapisanaNazwa, setZapisanaNazwa] = React.useState(nazwaZSerwera);
  const [zrodloNazwy, setZrodloNazwy] = React.useState(nazwaZSerwera);
  if (zrodloNazwy !== nazwaZSerwera) {
    setZrodloNazwy(nazwaZSerwera);
    setNazwa(nazwaZSerwera);
    setZapisanaNazwa(nazwaZSerwera);
  }

  const [otwartaKolumna, setOtwartaKolumna] = React.useState<string | null>(null);
  // Telefon: ta sama kolumna otwiera się w arkuszu „Kolumna” (osobny stan, bo dymek jest tylko na webie)
  const [arkuszKolumny, setArkuszKolumny] = React.useState<string | null>(null);
  const [zmianaTypu, setZmianaTypu] = React.useState<{
    field: PageField;
    type: FieldType;
    plan: PlanZmianyTypu;
  } | null>(null);

  const posortowanePola = [...pola].sort((a, b) => a.position - b.position);
  const zywe = wiersze.filter((r) => r.deletedAt === null).sort((a, b) => a.position - b.position);
  const blokTymczasowy = block.id.startsWith(PREFIKS_TYMCZASOWY);

  async function zapiszNazwe() {
    if (nazwa === zapisanaNazwa) return;
    const poprzednia = zapisanaNazwa;
    setZapisanaNazwa(nazwa);
    let udane = false;
    try {
      udane = (await updateBlockContent(block.id, { ...block.content, name: nazwa })).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setNazwa(poprzednia);
      setZapisanaNazwa(poprzednia);
      toast.error(BLAD_ZAPISU);
    }
  }

  // Zmiana jednej komórki; błąd przywraca poprzednią wartość
  async function zmienKomorke(row: PageRow, field: PageField, value: CellValue) {
    const poprzednia = row.values[field.id];
    setWiersze((l) =>
      l.map((r) => (r.id === row.id ? { ...r, values: { ...r.values, [field.id]: value } } : r)),
    );

    // Wiersz bez prawdziwego id: zmiana zapisze się zaraz po odpowiedzi serwera
    if (row.id.startsWith(PREFIKS_TYMCZASOWY)) {
      oczekujaceKomorki.current.set(row.id, {
        ...oczekujaceKomorki.current.get(row.id),
        [field.id]: value,
      });
      return;
    }

    const wToku = komorkiWToku.current.get(row.id) ?? { n: 0, zmiany: {} };
    wToku.n += 1;
    wToku.zmiany[field.id] = value;
    komorkiWToku.current.set(row.id, wToku);
    let udane = false;
    try {
      udane = (await updateRow(row.id, { [field.id]: value })).ok;
    } catch {
      udane = false;
    }
    wToku.n -= 1;
    if (wToku.n === 0) komorkiWToku.current.delete(row.id);
    if (!udane) {
      setWiersze((l) =>
        l.map((r) =>
          r.id === row.id ? { ...r, values: { ...r.values, [field.id]: poprzednia } } : r,
        ),
      );
      toast.error(BLAD_ZAPISU);
    }
  }

  // Nowy pusty wiersz na końcu; do czasu odpowiedzi serwera ma tymczasowe id
  async function dodajWiersz() {
    const tymczasoweId = `${PREFIKS_TYMCZASOWY}w${++licznik.current}`;
    const pozycja = wiersze.reduce((m, r) => Math.max(m, r.position), -1) + 1;
    // Pole tytułowe od razu pokazuje etykietę, którą nada serwer
    const tytul = pola.find((f) => f.isTitle);
    const poczatkowe: Record<string, unknown> = tytul
      ? { [tytul.id]: tytul.config.empty_label ?? "Bez tytułu" }
      : {};
    setWiersze((l) => [
      ...l,
      { id: tymczasoweId, values: poczatkowe, position: pozycja, deletedAt: null },
    ]);

    let wynik: Awaited<ReturnType<typeof addRow>> | null = null;
    try {
      wynik = await addRow(block.id, {});
    } catch {
      wynik = null;
    }
    if (!wynik || !wynik.ok) {
      setWiersze((l) => l.filter((r) => r.id !== tymczasoweId));
      oczekujaceKomorki.current.delete(tymczasoweId);
      toast.error(BLAD_ZAPISU);
      return;
    }

    const prawdziwy = wynik.row;
    const zmienione = oczekujaceKomorki.current.get(tymczasoweId);
    oczekujaceKomorki.current.delete(tymczasoweId);
    setKlucze((k) => ({ ...k, [prawdziwy.id]: tymczasoweId }));
    setWiersze((l) => {
      // Odświeżenie danych mogło już dodać prawdziwy wiersz — bez duplikatów
      const gotowy = { ...prawdziwy, values: { ...prawdziwy.values, ...zmienione } };
      const bezDuplikatu = l.filter((r) => r.id !== prawdziwy.id);
      return bezDuplikatu.some((r) => r.id === tymczasoweId)
        ? bezDuplikatu.map((r) => (r.id === tymczasoweId ? gotowy : r))
        : [...bezDuplikatu, gotowy];
    });
    if (zmienione) {
      let zapisano = false;
      try {
        zapisano = (await updateRow(prawdziwy.id, zmienione)).ok;
      } catch {
        zapisano = false;
      }
      if (!zapisano) {
        setWiersze((l) => l.map((r) => (r.id === prawdziwy.id ? prawdziwy : r)));
        toast.error(BLAD_ZAPISU);
      }
    }
  }

  // Usunięcie wiersza: od razu znika, toast „Usunięto” z „Cofnij” (restoreRow)
  async function usunWiersz(row: PageRow) {
    if (row.id.startsWith(PREFIKS_TYMCZASOWY)) return;
    setWiersze((l) => l.filter((r) => r.id !== row.id));
    let udane = false;
    try {
      udane = (await deleteRow(row.id)).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setWiersze((l) => (l.some((r) => r.id === row.id) ? l : [...l, row]));
      toast.error(BLAD_ZAPISU);
      return;
    }
    toast("Usunięto", {
      action: {
        label: "Cofnij",
        onClick: async () => {
          setWiersze((l) => (l.some((r) => r.id === row.id) ? l : [...l, row]));
          let przywrocono = false;
          try {
            przywrocono = (await restoreRow(row.id)).ok;
          } catch {
            przywrocono = false;
          }
          if (!przywrocono) {
            setWiersze((l) => l.filter((r) => r.id !== row.id));
            toast.error(BLAD_ZAPISU);
          }
        },
      },
    });
  }

  // „+” w nagłówku: kolumna „Kolumna N” typu Tekst, od razu z otwartym dymkiem
  async function dodajKolumne(telefon = false) {
    const tymczasoweId = `${PREFIKS_TYMCZASOWY}k${++licznik.current}`;
    const nazwaKolumny = `Kolumna ${pola.length + 1}`;
    const pozycja = pola.reduce((m, f) => Math.max(m, f.position), -1) + 1;
    setPola((l) => [
      ...l,
      { id: tymczasoweId, name: nazwaKolumny, type: "text", config: {}, position: pozycja, isTitle: false },
    ]);
    if (telefon) setArkuszKolumny(tymczasoweId);
    else setOtwartaKolumna(tymczasoweId);

    polaWToku.current += 1;
    let wynik: Awaited<ReturnType<typeof addField>> | null = null;
    try {
      wynik = await addField(block.id, { name: nazwaKolumny, type: "text", config: {} });
    } catch {
      wynik = null;
    }
    polaWToku.current -= 1;
    if (!wynik || !wynik.ok) {
      setPola((l) => l.filter((f) => f.id !== tymczasoweId));
      setOtwartaKolumna((o) => (o === tymczasoweId ? null : o));
      setArkuszKolumny((o) => (o === tymczasoweId ? null : o));
      toast.error(BLAD_ZAPISU);
      return;
    }
    const prawdziwe = wynik.field;
    setKlucze((k) => ({ ...k, [prawdziwe.id]: tymczasoweId }));
    setPola((l) => {
      const bezDuplikatu = l.filter((f) => f.id !== prawdziwe.id);
      return bezDuplikatu.some((f) => f.id === tymczasoweId)
        ? bezDuplikatu.map((f) => (f.id === tymczasoweId ? prawdziwe : f))
        : [...bezDuplikatu, prawdziwe];
    });
    setOtwartaKolumna((o) => (o === tymczasoweId ? prawdziwe.id : o));
    setArkuszKolumny((o) => (o === tymczasoweId ? prawdziwe.id : o));
  }

  // Nazwa albo konfiguracja pola (opcje); błąd przywraca poprzednie pole
  async function zmienPole(field: PageField, zmiana: { name?: string; config?: FieldConfig }) {
    setPola((l) => l.map((f) => (f.id === field.id ? { ...f, ...zmiana } : f)));
    polaWToku.current += 1;
    let udane = false;
    try {
      udane = (await updateField(field.id, zmiana)).ok;
    } catch {
      udane = false;
    }
    polaWToku.current -= 1;
    if (!udane) {
      setPola((l) => l.map((f) => (f.id === field.id ? field : f)));
      toast.error(BLAD_ZAPISU);
    }
  }

  function dodajOpcje(field: PageField, etykieta: string) {
    const opcje = field.config.options ?? [];
    if (opcje.some((o) => o.label.trim().toLowerCase() === etykieta.toLowerCase())) return;
    const nowa: FieldOption = {
      id: crypto.randomUUID(),
      label: etykieta,
      color: PALETA[opcje.length % PALETA.length],
    };
    void zmienPole(field, { config: { ...field.config, options: [...opcje, nowa] } });
  }

  // Zapis nowego typu: wartości wszystkich wierszy i pole w jednym RPC. Bez strat — od razu
  // (błąd cofa), ze stratą — dopiero po odpowiedzi serwera (okno potwierdzenia czeka)
  async function zastosujTyp(
    field: PageField,
    type: FieldType,
    plan: PlanZmianyTypu,
    czekajNaSerwer: boolean,
  ): Promise<boolean> {
    // Stare wartości tej kolumny — przy błędzie cofamy tylko je (równoległe edycje zostają)
    const stareWartosci = new Map(wiersze.map((r) => [r.id, r.values[field.id]]));
    const zastosuj = () => {
      setPola((l) => l.map((f) => (f.id === field.id ? { ...f, type, config: plan.config } : f)));
      setWiersze((l) =>
        l.map((r) =>
          r.id in plan.values ? { ...r, values: { ...r.values, [field.id]: plan.values[r.id] } } : r,
        ),
      );
    };
    if (!czekajNaSerwer) zastosuj();

    // Wiersze z tymczasowym id nie istnieją jeszcze na serwerze
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
        setPola((l) =>
          l.map((f) => (f.id === field.id ? { ...f, type: field.type, config: field.config } : f)),
        );
        setWiersze((l) =>
          l.map((r) =>
            stareWartosci.has(r.id)
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

  function wybierzTyp(field: PageField, type: FieldType) {
    // Wiersze bez prawdziwego id mogłyby zapisać zmiany w starym typie po odpowiedzi serwera
    if (wiersze.some((r) => r.id.startsWith(PREFIKS_TYMCZASOWY))) return;
    const plan = planTypeChange(
      field,
      type,
      wiersze.map((r) => ({ id: r.id, values: r.values })),
    );
    if (plan.lost > 0) {
      setOtwartaKolumna(null);
      setArkuszKolumny(null);
      setZmianaTypu({ field, type, plan });
      return;
    }
    void zastosujTyp(field, type, plan, false);
  }

  // Przesunięcie kolumny o jedno miejsce; kolejność zapisuje jedno RPC
  async function przesunKolumne(field: PageField, kierunek: -1 | 1) {
    // Kolumny bez prawdziwego id nie wejdą jeszcze w kolejność na serwerze
    if (posortowanePola.some((f) => f.id.startsWith(PREFIKS_TYMCZASOWY))) return;
    const i = posortowanePola.findIndex((f) => f.id === field.id);
    const j = i + kierunek;
    if (i < 0 || j < 0 || j >= posortowanePola.length) return;
    const nowaKolejnosc = [...posortowanePola];
    [nowaKolejnosc[i], nowaKolejnosc[j]] = [nowaKolejnosc[j], nowaKolejnosc[i]];
    const poprzednie = pola;
    setPola(nowaKolejnosc.map((f, indeks) => ({ ...f, position: indeks })));
    polaWToku.current += 1;
    let udane = false;
    try {
      udane = (await reorderFields(block.id, nowaKolejnosc.map((f) => f.id))).ok;
    } catch {
      udane = false;
    }
    polaWToku.current -= 1;
    if (!udane) {
      setPola(poprzednie);
      toast.error(BLAD_ZAPISU);
    }
  }

  async function usunKolumne(field: PageField) {
    if (field.isTitle || posortowanePola.length <= 1) return;
    setOtwartaKolumna(null);
    setArkuszKolumny(null);
    setPola((l) => l.filter((f) => f.id !== field.id));
    polaWToku.current += 1;
    let udane = false;
    try {
      udane = (await deleteField(field.id)).ok;
    } catch {
      udane = false;
    }
    polaWToku.current -= 1;
    if (!udane) {
      setPola((l) => (l.some((f) => f.id === field.id) ? l : [...l, field]));
      toast.error(BLAD_ZAPISU);
    }
  }

  const liczbaKolumn = posortowanePola.length;
  const aktywnaKolumna = posortowanePola.find((f) => f.id === arkuszKolumny) ?? null;
  const siatka: React.CSSProperties = {
    gridTemplateColumns: `minmax(200px,2fr)${
      liczbaKolumn > 1 ? ` repeat(${liczbaKolumn - 1},minmax(140px,1fr))` : ""
    } 44px`,
    minWidth: 244 + 140 * Math.max(0, liczbaKolumn - 1),
  };
  const maStopke = posortowanePola.some((f) => f.type === "number" || f.type === "checkbox");

  return (
    <div className="my-1.5 flex flex-col gap-2">
      <input
        type="text"
        value={nazwa}
        onChange={(e) => setNazwa(e.target.value)}
        onBlur={() => void zapiszNazwe()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="Tabela bez nazwy"
        aria-label="Nazwa tabeli"
        className="w-full min-w-0 rounded-md border-0 bg-transparent p-0 font-[inherit] text-base font-semibold text-foreground outline-none placeholder:text-faint-foreground focus:bg-black/[.02] focus:shadow-focus max-[799px]:min-h-11"
      />

      {!blokTymczasowy && (
        <>
          {/* .frame > .inner: ramka 1,5 px, promień 12 px; poniżej 1100 px tabela przewija się poziomo */}
          <div className="rounded-xl border-[1.5px] border-black/[.14] bg-white text-sm max-[1100px]:overflow-x-auto">
            <div role="row" style={siatka} className="grid items-stretch rounded-t-[10px] border-b border-border bg-black/[.02]">
              {posortowanePola.map((f, i) => (
                <div
                  key={klucze[f.id] ?? f.id}
                  role="columnheader"
                  className="relative flex min-w-0 items-center px-3 py-2 font-medium whitespace-nowrap text-muted-foreground"
                >
                  <ColumnPopover
                    field={f}
                    index={i}
                    count={liczbaKolumn}
                    open={otwartaKolumna === f.id}
                    onOpenChange={(o) => setOtwartaKolumna(o ? f.id : null)}
                    pending={f.id.startsWith(PREFIKS_TYMCZASOWY)}
                    onRename={(n) => void zmienPole(f, { name: n })}
                    onPickType={(t) => wybierzTyp(f, t)}
                    onAddOption={(etykieta) => dodajOpcje(f, etykieta)}
                    onRemoveOption={(id) =>
                      void zmienPole(f, {
                        config: {
                          ...f.config,
                          options: (f.config.options ?? []).filter((o) => o.id !== id),
                        },
                      })
                    }
                    onMove={(kierunek) => void przesunKolumne(f, kierunek)}
                    onDelete={() => void usunKolumne(f)}
                  />
                  {/* Telefon: przezroczysta nakładka nad nagłówkiem otwiera arkusz „Kolumna” zamiast dymka */}
                  {/* Ikona i nazwa to pseudo-elementy (tekst nie dubluje się w DOM); dymek web jest ukryty na telefonie */}
                  <button
                    type="button"
                    aria-label={`Kolumna ${f.name} — ustawienia`}
                    data-icon={EDITOR_TYPES.find((t) => t.type === f.type)?.icon ?? FIELD_TYPE_META[f.type].icon}
                    data-name={f.name}
                    onClick={() => setArkuszKolumny(f.id)}
                    className="-mx-1 inline-flex min-h-11 cursor-pointer items-center gap-1.5 border-0 bg-transparent px-1 font-[inherit] font-medium whitespace-nowrap text-muted-foreground before:font-mono before:text-muted-foreground before:content-[attr(data-icon)] after:content-[attr(data-name)] min-[800px]:hidden"
                  />
                </div>
              ))}
              <div className="flex min-w-0 items-stretch">
                <button
                  type="button"
                  aria-label="Dodaj kolumnę"
                  onClick={() => void dodajKolumne()}
                  className="grid min-h-[38px] w-full cursor-pointer place-items-center border-0 bg-transparent text-faint-foreground outline-none hover:bg-black/[.04] hover:text-foreground focus-visible:shadow-focus-inset max-[799px]:hidden"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Nowa kolumna"
                  onClick={() => void dodajKolumne(true)}
                  className="min-h-11 w-full cursor-pointer border-0 bg-transparent font-[inherit] text-lg text-muted-foreground min-[800px]:hidden"
                >
                  +
                </button>
              </div>
            </div>

            {zywe.map((r) => (
              <div
                key={klucze[r.id] ?? r.id}
                role="row"
                style={siatka}
                className="group/wiersz grid items-center border-b border-border last:border-b-0 hover:bg-black/[.02]"
              >
                {posortowanePola.map((f, i) => (
                  <div
                    key={klucze[f.id] ?? f.id}
                    role="cell"
                    className={`relative flex min-h-[38px] min-w-0 items-center px-3 py-2 max-[799px]:min-h-11 ${
                      i === 0 ? "font-medium" : ""
                    }`}
                  >
                    {/* Wybór na telefonie przełącza opcje stuknięciem, więc dymek web jest tam ukryty */}
                    <div
                      className={
                        f.type === "status" || f.type === "select" ? "max-[799px]:hidden" : "contents"
                      }
                    >
                      <CellEditor
                        field={f}
                        value={r.values[f.id]}
                        label={f.name || "Pole"}
                        today={today}
                        onCommit={(v) => void zmienKomorke(r, f, v)}
                        onEditOptions={() => setOtwartaKolumna(f.id)}
                      />
                    </div>
                    {/* Telefon: stuknięcie komórki Wyboru przełącza na następną opcję (po ostatniej — pusta) */}
                    {(f.type === "status" || f.type === "select") && (
                      <button
                        type="button"
                        aria-label={`${f.name || "Pole"}: ${
                          (f.config.options ?? []).find((o) => o.id === r.values[f.id])?.label ?? "brak"
                        }, stuknij by zmienić`}
                        onClick={() =>
                          void zmienKomorke(r, f, nextOptionId(f.config.options ?? [], r.values[f.id]))
                        }
                        className="inline-flex min-h-11 w-full cursor-pointer items-center border-0 bg-transparent p-0 font-[inherit] min-[800px]:hidden"
                      >
                        {(() => {
                          const wybrana = (f.config.options ?? []).find((o) => o.id === r.values[f.id]);
                          return wybrana ? (
                            <OptionBadge option={wybrana} />
                          ) : (
                            <span className="text-faint-foreground">—</span>
                          );
                        })()}
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="xs"
                    icon
                    aria-label="Usuń wiersz"
                    disabled={r.id.startsWith(PREFIKS_TYMCZASOWY)}
                    onClick={() => void usunWiersz(r)}
                    className="text-destructive-foreground opacity-0 transition-opacity duration-[120ms] group-hover/wiersz:opacity-100 hover:text-destructive-foreground focus-visible:opacity-100 max-[799px]:size-11 max-[799px]:opacity-100"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}

            {maStopke && (
              <div role="row" style={siatka} className="grid items-stretch rounded-b-[10px] bg-black/[.02]">
                {posortowanePola.map((f) => {
                  const suma = editorFooter(f, zywe);
                  return (
                    <div
                      key={klucze[f.id] ?? f.id}
                      className={`px-3 py-2 text-sm text-muted-foreground tabular-nums ${
                        f.type === "number" ? "text-right" : ""
                      }`}
                    >
                      {suma === null ? "" : f.type === "number" ? `Suma ${suma}` : suma}
                    </div>
                  );
                })}
                <div />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => void dodajWiersz()} className="text-muted-foreground">
              + Nowy wiersz
            </Button>
            <StatusBadge tone="gray" className="tabular-nums">
              {rowsLabel(zywe.length)} · {kolumnyLabel(liczbaKolumn)}
            </StatusBadge>
          </div>
        </>
      )}

      {aktywnaKolumna && (
        <MColumnSheet
          key={klucze[aktywnaKolumna.id] ?? aktywnaKolumna.id}
          field={aktywnaKolumna}
          index={posortowanePola.indexOf(aktywnaKolumna)}
          count={liczbaKolumn}
          open
          onOpenChange={(o) => setArkuszKolumny(o ? aktywnaKolumna.id : null)}
          pending={aktywnaKolumna.id.startsWith(PREFIKS_TYMCZASOWY)}
          onRename={(n) => void zmienPole(aktywnaKolumna, { name: n })}
          onPickType={(t) => wybierzTyp(aktywnaKolumna, t)}
          onAddOption={(etykieta) => dodajOpcje(aktywnaKolumna, etykieta)}
          onRemoveOption={(id) =>
            void zmienPole(aktywnaKolumna, {
              config: {
                ...aktywnaKolumna.config,
                options: (aktywnaKolumna.config.options ?? []).filter((o) => o.id !== id),
              },
            })
          }
          onMove={(kierunek) => void przesunKolumne(aktywnaKolumna, kierunek)}
          onDelete={() => void usunKolumne(aktywnaKolumna)}
        />
      )}

      {zmianaTypu && (
        <TypeChangeDialog
          lost={zmianaTypu.plan.lost}
          onCancel={() => setZmianaTypu(null)}
          onConfirm={async () => {
            const udane = await zastosujTyp(zmianaTypu.field, zmianaTypu.type, zmianaTypu.plan, true);
            if (udane) setZmianaTypu(null);
          }}
        />
      )}
    </div>
  );
}
