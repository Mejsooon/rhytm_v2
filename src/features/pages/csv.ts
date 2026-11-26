// Eksport i import CSV tabel stron: czyste funkcje bez dostępu do bazy.
import { normalizeValue, PALETA } from "./fields";
import type { FieldOption, FieldType, PageField, RecurringValue } from "./fields";
import type { PageRow } from "./table-model";

// Limit rozmiaru pliku importu (sprawdza interfejs przed wczytaniem)
export const CSV_MAX_BYTES = 1_048_576;

// Limit opcji pola wyboru (jak w fieldConfigSchema)
const MAX_OPCJI = 100;

export type CsvMapping = {
  column: number;
  target:
    | { kind: "field"; field_id: string }
    | { kind: "new"; name: string; type: FieldType }
    | { kind: "skip" };
}[];

// RFC 4180: separator „,”, CRLF, BOM UTF-8 na początku (Excel rozpoznaje wtedy UTF-8)
export function toCsv(fields: PageField[], rows: PageRow[]): string {
  const kolumny = fields.filter((f) => f.type !== "secret");
  // Komórki zaczynające się od = + - @ (tab, CR) Excel czyta jak formułę: prefiks ' (import zdejmuje go z powrotem)
  const bezFormul = (t: string) => (/^'*[=+\-@\t\r]/.test(t) ? `'${t}` : t);
  const cytuj = (t: string) => (/[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  const linie: string[] = [kolumny.map((f) => cytuj(bezFormul(f.name))).join(",")];
  for (const w of rows) {
    const komorki: string[] = [];
    for (const f of kolumny) {
      const v = normalizeValue(f, w.values[f.id]);
      let t = "";
      if (v === null) t = "";
      else if (f.type === "checkbox") t = v === true ? "tak" : "nie";
      else if (f.type === "recurring") {
        const k = v as RecurringValue;
        t = `${k.amount.toFixed(2)} / ${k.cycle === "month" ? "mies." : "rok"}`;
      } else if (f.type === "select" || f.type === "status") {
        t = bezFormul((f.config.options ?? []).find((o) => o.id === v)?.label ?? "");
      } else if (f.type === "text" || f.type === "url") t = bezFormul(String(v));
      else t = String(v);
      komorki.push(cytuj(t));
    }
    linie.push(komorki.join(","));
  }
  return "﻿" + linie.join("\r\n") + "\r\n";
}

export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const tekst = text.replace(/^﻿/, "");
  // Separator z pierwszej linii (poza cudzysłowami): więcej „;” niż „,” → „;”
  let przecinki = 0;
  let sredniki = 0;
  let wCudzyslowie = false;
  for (const z of tekst) {
    if (z === '"') wCudzyslowie = !wCudzyslowie;
    else if (!wCudzyslowie && (z === "\n" || z === "\r")) break;
    else if (!wCudzyslowie && z === ",") przecinki++;
    else if (!wCudzyslowie && z === ";") sredniki++;
  }
  const sep = sredniki > przecinki ? ";" : ",";

  const wszystkie: string[][] = [];
  let wiersz: string[] = [];
  let pole = "";
  let cudzyslow = false;
  for (let i = 0; i < tekst.length; i++) {
    const z = tekst[i];
    if (cudzyslow) {
      if (z === '"' && tekst[i + 1] === '"') {
        pole += '"';
        i++;
      } else if (z === '"') cudzyslow = false;
      else pole += z;
    } else if (z === '"') cudzyslow = true;
    else if (z === sep) {
      wiersz.push(pole);
      pole = "";
    } else if (z === "\n" || z === "\r") {
      if (z === "\r" && tekst[i + 1] === "\n") i++;
      wiersz.push(pole);
      wszystkie.push(wiersz);
      wiersz = [];
      pole = "";
    } else pole += z;
  }
  if (pole !== "" || wiersz.length > 0) {
    wiersz.push(pole);
    wszystkie.push(wiersz);
  }
  // Puste końcowe wiersze (same puste komórki) odpadają
  while (wszystkie.length > 0 && wszystkie[wszystkie.length - 1].every((k) => k.trim() === "")) {
    wszystkie.pop();
  }
  if (wszystkie.length === 0) return { header: [], rows: [] };
  return { header: wszystkie[0], rows: wszystkie.slice(1) };
}

export function suggestMapping(header: string[], fields: PageField[]): CsvMapping {
  const uzyte = new Set<string>();
  return header.map((nazwa, column) => {
    let czysta = nazwa.trim();
    if (/^'+[=+\-@\t\r]/.test(czysta)) czysta = czysta.slice(1);
    const pasuje = fields.find(
      (f) =>
        f.type !== "secret" &&
        !uzyte.has(f.id) &&
        f.name.trim().toLowerCase() === czysta.toLowerCase() &&
        czysta !== "",
    );
    if (pasuje) {
      uzyte.add(pasuje.id);
      return { column, target: { kind: "field", field_id: pasuje.id } };
    }
    return {
      column,
      target: { kind: "new", name: (czysta || `Kolumna ${column + 1}`).slice(0, 60), type: "text" },
    };
  });
}

// Zwraca wartości wierszy (klucz = id pola albo "new:<indeks>" dla nowych pól w kolejności mapowania)
// oraz nowe opcje wyboru znalezione w pliku (ten sam klucz); id nowych opcji nadaje ta funkcja
export function csvToValues(
  rows: string[][],
  mapping: CsvMapping,
  fields: PageField[],
): { rows: Record<string, unknown>[]; newOptions: Record<string, FieldOption[]> } {
  type Cel = { column: number; key: string; field: PageField };
  const cele: Cel[] = [];
  let numerNowego = 0;
  for (const m of mapping) {
    if (m.target.kind === "skip") continue;
    if (m.target.kind === "field") {
      const id = m.target.field_id;
      const f = fields.find((x) => x.id === id);
      if (f && f.type !== "secret") cele.push({ column: m.column, key: f.id, field: f });
      continue;
    }
    const klucz = `new:${numerNowego++}`;
    if (m.target.type === "secret") continue;
    cele.push({
      column: m.column,
      key: klucz,
      field: { id: klucz, name: m.target.name, type: m.target.type, config: {}, position: 0, isTitle: false },
    });
  }

  const noweOpcje: Record<string, FieldOption[]> = {};
  const wynik: Record<string, unknown>[] = [];
  for (const wiersz of rows) {
    const wartosci: Record<string, unknown> = {};
    for (const cel of cele) {
      let surowy = (wiersz[cel.column] ?? "").trim();
      // Zdejmuje prefiks ' dodany przez eksport (tylko przed znakiem formuły)
      if (/^'+[=+\-@\t\r]/.test(surowy)) surowy = surowy.slice(1);
      const f = cel.field;
      let v: unknown = null;
      if (surowy === "") v = null;
      else if (f.type === "text" || f.type === "url") v = normalizeValue(f, surowy);
      else if (f.type === "number" || f.type === "rating") {
        const liczba = liczbaZTekstu(surowy);
        v = liczba === null ? null : normalizeValue(f, liczba);
      } else if (f.type === "checkbox") {
        const m = surowy.toLowerCase();
        if (["tak", "true", "1", "x", "✓", "yes", "prawda"].includes(m)) v = true;
        else if (["nie", "false", "0", "no", "fałsz"].includes(m)) v = false;
      } else if (f.type === "date" || f.type === "renewal") {
        v = normalizeValue(f, dataZTekstu(surowy));
      } else if (f.type === "recurring") {
        const trafienie = /^([^/]*?)\s*(?:zł|pln)?\s*(?:\/\s*(mies\.?|miesiąc|rok|year|month))?$/i.exec(surowy);
        const liczba = trafienie ? liczbaZTekstu(trafienie[1]) : null;
        if (liczba !== null) {
          const cykl = trafienie?.[2]?.toLowerCase();
          v = normalizeValue(f, {
            amount: liczba,
            cycle: cykl === "rok" || cykl === "year" ? "year" : cykl ? "month" : (f.config.default_cycle ?? "month"),
          });
        }
      } else if (f.type === "select" || f.type === "status") {
        const znane = [...(f.config.options ?? []), ...(noweOpcje[cel.key] ?? [])];
        const szukana = surowy.toLowerCase();
        const trafiona = znane.find((o) => o.label.trim().toLowerCase() === szukana);
        if (trafiona) v = trafiona.id;
        else if (znane.length < MAX_OPCJI) {
          const nowa: FieldOption = {
            id: crypto.randomUUID(),
            label: surowy.slice(0, 60),
            color: PALETA[znane.length % PALETA.length],
          };
          noweOpcje[cel.key] = [...(noweOpcje[cel.key] ?? []), nowa];
          v = nowa.id;
        }
      }
      wartosci[cel.key] = v;
    }
    wynik.push(wartosci);
  }
  return { rows: wynik, newOptions: noweOpcje };
}

// „43,50”, „43.50”, „1 234,50”, „1.234,50”, „12 zł”, „7%”; inne → null
function liczbaZTekstu(tekst: string): number | null {
  let t = tekst.replace(/[\s  ]/g, "").replace(/(zł|pln|%)$/i, "");
  if (t === "" || !/^[-+]?[\d.,]+$/.test(t)) return null;
  const ostatniPrzecinek = t.lastIndexOf(",");
  const ostatniaKropka = t.lastIndexOf(".");
  if (ostatniPrzecinek >= 0 && ostatniaKropka >= 0) {
    // Ostatni z dwóch znaków to separator dziesiętny, drugi to tysiące
    t =
      ostatniPrzecinek > ostatniaKropka
        ? t.replace(/\./g, "").replace(",", ".")
        : t.replace(/,/g, "");
  } else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// „21.11.2026”, „2026-11-21”, „21/11/2026” → „2026-11-21”; inne → null (kalendarz sprawdza normalizeValue)
function dataZTekstu(tekst: string): string | null {
  const dmr = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(tekst);
  if (dmr) return `${dmr[3]}-${dmr[2].padStart(2, "0")}-${dmr[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(tekst) ? tekst : null;
}
