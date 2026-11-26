"use client";

import * as React from "react";
import { ChevronDown, Layers } from "lucide-react";

import { Button, FIELD, FormDialog, Switch } from "@/components/controls";
import { cn } from "@/lib/utils";
import { importCsvRows } from "../actions";
import { csvToValues, CSV_MAX_BYTES, parseCsv, suggestMapping, type CsvMapping } from "../csv";
import { FIELD_TYPE_META, type FieldType, type PageField } from "../fields";
import { rowsForm, rowsLabel } from "../rows-label";
import type { PageRow } from "../table-model";

// Typy, jakie można nadać nowemu polu z kolumny pliku (bez Sekretu i pól liczących)
const TYPY_NOWEGO: FieldType[] = ["text", "number", "date", "checkbox", "url", "select", "status", "rating"];

// Limit wierszy jednego importu (jak w akcji serwera)
const MAX_WIERSZY = 2000;

function kolumnLabel(n: number) {
  const forma = rowsForm(n);
  if (forma === "one") return `${n} kolumna`;
  if (forma === "few") return `${n} kolumny`;
  return `${n} kolumn`;
}

// Import z CSV (S2ImportCSV / S2ImportCSVMap): krok 1 „Plik” (wybór albo upuszczenie pliku), krok 2 „Kolumny”
// (kolumna pliku → pole tabeli / nowe pole z typem / „Nie importuj”, przełącznik pomijania duplikatów po tytule).
// Krok „Gotowe” z makiety zastępuje zamknięcie okna i toast wywołującego (`onImported`).
export function CsvImportDialog({
  open,
  onOpenChange,
  blockId,
  tableName,
  fields,
  rows,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockId: string;
  tableName: string;
  fields: PageField[];
  // Wiersze już w tabeli (do pomijania duplikatów po tytule)
  rows: PageRow[];
  // Liczba zaimportowanych i pominiętych jako duplikaty wierszy
  onImported: (count: number, pominiete: number) => void;
}) {
  const [nazwaPliku, setNazwaPliku] = React.useState("");
  const [naglowek, setNaglowek] = React.useState<string[]>([]);
  const [wiersze, setWiersze] = React.useState<string[][]>([]);
  const [mapowanie, setMapowanie] = React.useState<CsvMapping>([]);
  const [krok, setKrok] = React.useState<1 | 2>(1);
  const [pomijajDuplikaty, setPomijajDuplikaty] = React.useState(true);
  const [blad, setBlad] = React.useState<string | null>(null);
  const [zapisuje, setZapisuje] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function wczytaj(plik: File | undefined) {
    if (!plik) return;
    setBlad(null);
    if (plik.size > CSV_MAX_BYTES) {
      setBlad("Plik jest większy niż 1 MB.");
      return;
    }
    const wynik = parseCsv(await plik.text());
    if (wynik.rows.length === 0) {
      setBlad("Plik nie ma wierszy z danymi.");
      return;
    }
    if (wynik.rows.length > MAX_WIERSZY) {
      setBlad("Plik ma więcej niż 2 000 wierszy.");
      return;
    }
    setNazwaPliku(plik.name);
    setNaglowek(wynik.header);
    setWiersze(wynik.rows);
    setMapowanie(suggestMapping(wynik.header, fields));
    setKrok(2);
  }

  // Wartości do zapisu: konwersja z mapowania i pominięcie duplikatów po tytule (pole tytułowe, jeśli zmapowane)
  const wynikKonwersji = krok === 2 ? csvToValues(wiersze, mapowanie, fields) : null;
  const poleTytulu = fields.find((f) => f.isTitle) ?? fields[0];
  const istniejace = new Set(
    rows
      .map((w) => w.values[poleTytulu?.id ?? ""])
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .map((v) => v.trim().toLowerCase()),
  );
  const doZapisu = (wynikKonwersji?.rows ?? []).filter((w) => {
    const tytul = poleTytulu ? w[poleTytulu.id] : null;
    if (!pomijajDuplikaty || typeof tytul !== "string") return true;
    return !istniejace.has(tytul.trim().toLowerCase());
  });
  const pominiete = (wynikKonwersji?.rows.length ?? 0) - doZapisu.length;
  const zaimportowaneKolumny = mapowanie.filter((m) => m.target.kind !== "skip").length;

  async function importuj() {
    if (!wynikKonwersji || doZapisu.length === 0 || zapisuje) return;
    setZapisuje(true);
    setBlad(null);
    const nowePola: { name: string; type: FieldType }[] = [];
    for (const m of mapowanie) if (m.target.kind === "new") nowePola.push({ name: m.target.name, type: m.target.type });
    const wynik = await importCsvRows(blockId, nowePola, doZapisu, wynikKonwersji.newOptions);
    setZapisuje(false);
    if (!wynik.ok) {
      setBlad(wynik.message);
      return;
    }
    onOpenChange(false);
    onImported(wynik.count, pominiete);
  }

  const kroki = [
    { no: 1, t: "Plik" },
    { no: 2, t: "Kolumny" },
    { no: 3, t: "Gotowe" },
  ];

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Importuj z CSV"
      description={krok === 1 ? `Dodaj wiersze do tabeli ${tableName} z pliku CSV.` : "Sprawdź, które kolumny trafią do których pól."}
      contentClassName="min-[800px]:w-[min(640px,calc(100%-32px))]"
      footerClassName="justify-between"
      footer={
        <>
          <span className="text-xs text-muted-foreground">
            {krok === 2 ? `${rowsLabel(wiersze.length)} · ${zaimportowaneKolumny} z ${kolumnLabel(naglowek.length)}` : ""}
          </span>
          <span className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button
              variant="primary"
              aria-disabled={krok === 1 || doZapisu.length === 0 || zapisuje}
              onClick={() => {
                if (krok === 2) void importuj();
              }}
            >
              {krok === 1 ? "Dalej" : `Importuj ${rowsLabel(doZapisu.length)}`}
            </Button>
          </span>
        </>
      }
    >
      <ol className="m-0 flex list-none items-center gap-2 p-0 text-xs">
        {kroki.map((k) => (
          <li
            key={k.no}
            aria-current={k.no === krok ? "step" : undefined}
            className={cn("inline-flex items-center gap-1.5 font-medium", k.no <= krok ? "text-foreground" : "text-[#a3a3a3]", k.no === krok && "font-semibold")}
          >
            <span
              className={cn(
                "inline-flex size-[18px] items-center justify-center rounded-full text-[11px]",
                k.no < krok ? "bg-[#15803d] text-white" : k.no === krok ? "bg-foreground text-white" : "bg-black/[.06]",
              )}
            >
              {k.no}
            </span>
            {k.t}
          </li>
        ))}
      </ol>

      {blad && (
        <p role="alert" className="m-0 text-sm text-destructive-foreground">
          {blad}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="Plik CSV"
        className="hidden"
        onChange={(e) => {
          void wczytaj(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {krok === 1 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void wczytaj(e.dataTransfer.files?.[0]);
          }}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-black/[.18] bg-[#fafafa] px-4 py-9 font-[inherit] text-inherit"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-[9px] bg-white">
            <Layers size={16} aria-hidden="true" />
          </span>
          <b className="font-medium">Przeciągnij plik CSV albo kliknij, żeby wybrać</b>
          <span className="text-xs text-muted-foreground">Pierwszy wiersz to nazwy kolumn · UTF-8 · do 2 000 wierszy</span>
        </button>
      )}

      {krok === 2 && (
        <>
          <div className="flex items-center gap-2.5 rounded-[10px] bg-black/[.035] px-3 py-2.5">
            <span className="inline-flex size-[30px] flex-none items-center justify-center rounded-[9px] bg-white">
              <Layers size={14} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate font-medium">{nazwaPliku}</b>
              <span className="text-xs text-muted-foreground tabular-nums">
                {rowsLabel(wiersze.length)} · {kolumnLabel(naglowek.length)}
              </span>
            </span>
            <Button size="sm" variant="secondary" onClick={() => setKrok(1)}>
              Zmień plik
            </Button>
          </div>
          <span className="text-xs font-medium text-muted-foreground">Dopasuj kolumny z pliku do pól tabeli {tableName}</span>
          <div className="overflow-hidden rounded-xl border border-border">
            {mapowanie.map((m, i) => {
              const przyklad = wiersze.find((w) => (w[i] ?? "").trim() !== "")?.[i] ?? "";
              const wartosc = m.target.kind === "field" ? `field:${m.target.field_id}` : m.target.kind === "new" ? `new:${m.target.type}` : "skip";
              const nazwaKolumny = naglowek[i]?.trim() || `Kolumna ${i + 1}`;
              return (
                <div key={i} className="flex items-center gap-2.5 border-t border-black/[.06] px-3 py-2 first:border-t-0">
                  <span className="min-w-0 flex-1 truncate font-medium tabular-nums">{nazwaKolumny}</span>
                  <span className="text-xs text-muted-foreground" aria-hidden="true">
                    →
                  </span>
                  <div className="relative w-[200px] flex-none">
                    <select
                      aria-label={`Pole dla kolumny ${nazwaKolumny}`}
                      value={wartosc}
                      onChange={(e) => {
                        const v = e.target.value;
                        const nowe = mapowanie.slice();
                        if (v === "skip") nowe[i] = { column: i, target: { kind: "skip" } };
                        else if (v.startsWith("field:")) nowe[i] = { column: i, target: { kind: "field", field_id: v.slice(6) } };
                        else {
                          const nazwa = nazwaKolumny.replace(/^'+(?=[=+\-@])/, "").slice(0, 60);
                          nowe[i] = { column: i, target: { kind: "new", name: nazwa, type: v.slice(4) as FieldType } };
                        }
                        setMapowanie(nowe);
                      }}
                      className={cn(FIELD, "w-full appearance-none pr-8")}
                    >
                      <optgroup label="Pola tabeli">
                        {fields
                          .filter((f) => f.type !== "secret")
                          .map((f) => (
                            <option key={f.id} value={`field:${f.id}`}>
                              {f.name}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Nowe pole">
                        {TYPY_NOWEGO.map((t) => (
                          <option key={t} value={`new:${t}`}>
                            Nowe pole · {FIELD_TYPE_META[t].label}
                          </option>
                        ))}
                      </optgroup>
                      <option value="skip">Nie importuj</option>
                    </select>
                    <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2" />
                  </div>
                  <span className="w-[150px] flex-none truncate text-xs text-muted-foreground tabular-nums">{przyklad}</span>
                </div>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <Switch checked={pomijajDuplikaty} onChange={setPomijajDuplikaty} ariaLabel="Pomiń duplikaty" />
            Pomiń wiersze, które już są w tabeli (po tytule)
          </label>
        </>
      )}
    </FormDialog>
  );
}
