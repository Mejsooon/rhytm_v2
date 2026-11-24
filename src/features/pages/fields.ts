// Typy pól silnika stron: wartości, formatowanie, konwersja i daty względne.
// Czyste funkcje bez bazy i UI — zapis do bazy robią RPC z Etapu 6.
import {
  Calendar,
  CaseSensitive,
  CircleDot,
  Contrast,
  Hash,
  KeyRound,
  Link,
  SquareCheck,
  Star,
  type LucideIcon,
} from "lucide-react";

import type { IsoDate } from "@/components/controls";
import { isSecretValue, type SecretValue } from "@/features/vault/crypto";

export type FieldType =
  | "text"
  | "number"
  | "checkbox"
  | "url"
  | "select"
  | "status"
  | "date"
  | "rating"
  | "secret"
  | "recurring"
  | "renewal";

// Cykl Kwoty cyklicznej i Daty odnowienia (spec Subscriptions, D1: tylko miesiąc i rok)
export type Cycle = "month" | "year";

// Wartość Kwoty cyklicznej: kwota w zł i cykl, w którym ją płacimy
export type RecurringValue = { amount: number; cycle: Cycle };

export type FieldOption = { id: string; label: string; color: string };

export type FieldConfig = {
  options?: FieldOption[];
  number_format?: "plain" | "pln" | "percent";
  show_in_calendar?: boolean;
  empty_label?: string;
  // Id opcji, którą dostaje nowy wiersz (Select / Status; z makiet szablonów)
  default_option?: string;
  // Kwota cykliczna: cykl nowej kwoty (domyślnie miesiąc)
  default_cycle?: Cycle;
  // Data odnowienia: pole Kwota cykliczna, z którego bierze się cykl wiersza
  cycle_field_id?: string;
  // Data odnowienia: własny cykl, gdy brak (albo zły) cycle_field_id
  cycle?: Cycle;
  // Data odnowienia: pole Checkbox „Aktywna”; brak = wiersz zawsze aktywny
  active_field_id?: string;
  // Checkbox: nowy wiersz dostaje zaznaczone (ustawia szablon)
  default_checked?: boolean;
};

export type PageField = {
  id: string;
  name: string;
  type: FieldType;
  config: FieldConfig;
  position: number;
  isTitle: boolean;
};

// Sekret to szyfrogram {v, g, iv, ct}; serwer i tabela nigdy nie widzą tekstu jawnego
export type CellValue = string | number | boolean | SecretValue | RecurringValue | null;

// Ikony nagłówków i etykiety z makiet (AddField). Icon to ikona lucide z makiet (web);
// icon to dawny znak, który zostaje dla telefonu (mobile/ czyta go bez zmian wyglądu).
export const FIELD_TYPE_META: Record<
  FieldType,
  { icon: string; Icon: LucideIcon; label: string }
> = {
  text: { icon: "Aa", Icon: CaseSensitive, label: "Tekst" },
  number: { icon: "#", Icon: Hash, label: "Liczba" },
  checkbox: { icon: "✓", Icon: SquareCheck, label: "Checkbox" },
  url: { icon: "↗", Icon: Link, label: "URL" },
  select: { icon: "◉", Icon: CircleDot, label: "Select" },
  status: { icon: "◐", Icon: Contrast, label: "Status" },
  date: { icon: "▦", Icon: Calendar, label: "Data" },
  rating: { icon: "★", Icon: Star, label: "Ocena" },
  secret: { icon: "🔑", Icon: KeyRound, label: "Sekret" },
  recurring: { icon: "↻zł", Icon: Hash, label: "Kwota cykliczna" },
  renewal: { icon: "↻", Icon: Calendar, label: "Data odnowienia" },
};

// „Typ pola” w edytorze (EmptyPage): Wybór = status z kolorowymi plakietkami
export const EDITOR_TYPES: { type: FieldType; label: string; icon: string; Icon: LucideIcon }[] = [
  { type: "text", label: "Tekst", icon: "Aa", Icon: CaseSensitive },
  { type: "number", label: "Liczba", icon: "#", Icon: Hash },
  { type: "date", label: "Data", icon: "▦", Icon: Calendar },
  { type: "status", label: "Wybór", icon: "◐", Icon: Contrast },
  { type: "checkbox", label: "Checkbox", icon: "☑", Icon: SquareCheck },
  { type: "url", label: "Link", icon: "↗", Icon: Link },
];

// 8 kolorów kategorii (spec 3.1), przydzielanych opcjom po kolei
export const PALETA = [
  "#0070f3",
  "#15803d",
  "#7c3aed",
  "#c2410c",
  "#b91c1c",
  "#0e7490",
  "#a16207",
  "#525252",
];

// Kolory do wyboru w panelu opcji: „Bez koloru” i 8 kolorów PALETA (nazwy w tej samej kolejności)
export const KOLORY_OPCJI: { color: string; name: string }[] = [
  { color: "", name: "Bez koloru" },
  { color: PALETA[0], name: "Niebieski" },
  { color: PALETA[1], name: "Zielony" },
  { color: PALETA[2], name: "Fioletowy" },
  { color: PALETA[3], name: "Pomarańczowy" },
  { color: PALETA[4], name: "Czerwony" },
  { color: PALETA[5], name: "Turkusowy" },
  { color: PALETA[6], name: "Żółty" },
  { color: PALETA[7], name: "Szary" },
];

// Szerokości kolumn w px (tytuł osobno), gdy brak wpisu w column_widths
export const SZEROKOSC_TYTULU = 300;
export const DOMYSLNA_SZEROKOSC: Record<FieldType, number> = {
  text: 220,
  url: 220,
  select: 180,
  status: 180,
  secret: 180,
  date: 140,
  rating: 130,
  number: 120,
  checkbox: 90,
  recurring: 200,
  renewal: 230,
};
export const MIN_SZEROKOSC_KOLUMNY = 80;

// Szerokości kart podsumowań w px
export const MIN_SZEROKOSC_KARTY = 180;
export const DOMYSLNA_SZEROKOSC_KARTY = 220;

// Liczba dni od 1970-01-01 dla poprawnej daty ISO albo null (bez strefy czasowej)
function dniOdEpoki(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const r = Number(m[1]);
  const mies = Number(m[2]);
  const dz = Number(m[3]);
  const t = Date.UTC(r, mies - 1, dz);
  const d = new Date(t);
  if (
    d.getUTCFullYear() !== r ||
    d.getUTCMonth() !== mies - 1 ||
    d.getUTCDate() !== dz
  ) {
    return null;
  }
  return Math.round(t / 86_400_000);
}

// Liczba z tekstu: przecinek lub kropka, tylko skończone wartości
function parsujLiczbe(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Czy to obiekt {amount, cycle} (kształt wartości Kwoty cyklicznej)
export function isRecurringValue(raw: unknown): raw is RecurringValue {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.amount === "number" &&
    Number.isFinite(o.amount) &&
    (o.cycle === "month" || o.cycle === "year")
  );
}

// „5 255,28”: 2 miejsca, przecinek, tysiące oddzielone twardą spacją, bez „zł”
export function formatMoney(n: number): string {
  // NaN i nieskończoność nie są kwotą: pokazujemy zero zamiast „NaN,undefined”
  if (!Number.isFinite(n)) return "0,00";
  const [calkowite, ulamek] = Math.abs(n).toFixed(2).split(".");
  const grupy = calkowite.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  // Minus tylko wtedy, gdy po zaokrągleniu do grosza zostaje coś poza zerem (bez „-0,00”)
  const ujemna = n < 0 && (calkowite !== "0" || ulamek !== "00");
  return `${ujemna ? "-" : ""}${grupy},${ulamek}`;
}

// Kwota na miesiąc / na rok (bez zaokrąglania; do grosza dopiero przy wyświetlaniu)
export function monthlyAmount(v: RecurringValue): number {
  return v.cycle === "month" ? v.amount : v.amount / 12;
}
export function yearlyAmount(v: RecurringValue): number {
  return v.cycle === "year" ? v.amount : v.amount * 12;
}

// k-te wystąpienie serii od kotwicy (k ≥ 0): zawsze liczone od kotwicy, dzień obcięty do długości miesiąca
export function addCycle(anchor: string, cycle: Cycle, k: number): string {
  if (dniOdEpoki(anchor) === null) return anchor;
  const [r, m, d] = anchor.split("-").map(Number);
  const razem = r * 12 + (m - 1) + k * (cycle === "month" ? 1 : 12);
  const rok = Math.floor(razem / 12);
  const mies = razem % 12;
  const dniWMiesiacu = new Date(Date.UTC(rok, mies + 1, 0)).getUTCDate();
  const dzien = Math.min(d, dniWMiesiacu);
  return `${String(rok).padStart(4, "0")}-${String(mies + 1).padStart(2, "0")}-${String(dzien).padStart(2, "0")}`;
}

// Następne odnowienie: kotwica, gdy jest dziś lub później, inaczej najbliższe k ≥ 1 z terminem ≥ dziś
export function nextRenewal(anchor: string, cycle: Cycle, today: string): string {
  if (dniOdEpoki(anchor) === null || dniOdEpoki(today) === null) return anchor;
  if (anchor >= today) return anchor;
  const krok = cycle === "month" ? 1 : 12;
  const [ra, ma] = anchor.split("-").map(Number);
  const [rt, mt] = today.split("-").map(Number);
  // Przybliżenie z różnicy miesięcy, potem dosunięcie do pierwszego terminu ≥ dziś
  let k = Math.max(1, Math.floor((rt * 12 + mt - (ra * 12 + ma)) / krok) - 1);
  while (addCycle(anchor, cycle, k) < today) k += 1;
  return addCycle(anchor, cycle, k);
}

// Wszystkie wystąpienia serii (k ≥ 0) w zakresie [from, to]; przed kotwicą nic
export function renewalDates(anchor: string, cycle: Cycle, from: string, to: string): string[] {
  if (dniOdEpoki(anchor) === null || anchor > to || from > to) return [];
  const krok = cycle === "month" ? 1 : 12;
  const [ra, ma] = anchor.split("-").map(Number);
  const [rf, mf] = from.split("-").map(Number);
  let k = anchor < from ? Math.max(0, Math.floor((rf * 12 + mf - (ra * 12 + ma)) / krok) - 1) : 0;
  const wynik: string[] = [];
  for (let d = addCycle(anchor, cycle, k); d <= to && k < 10_000; d = addCycle(anchor, cycle, ++k)) {
    if (d >= from) wynik.push(d);
  }
  return wynik;
}

// Cykl wiersza dla pola Data odnowienia: wartość kwoty z cycle_field_id, potem default_cycle tego pola,
// potem własny cycle. Odwołanie do pola, którego nie ma albo które nie jest Kwotą cykliczną, to brak odwołania
export function rowCycle(
  renewal: PageField,
  fields: PageField[],
  values: Record<string, unknown>,
): Cycle {
  const id = renewal.config.cycle_field_id;
  const kwota = id ? fields.find((f) => f.id === id && f.type === "recurring") : undefined;
  if (kwota) {
    const v = normalizeValue(kwota, values[kwota.id]);
    return isRecurringValue(v) ? v.cycle : (kwota.config.default_cycle ?? "month");
  }
  return renewal.config.cycle ?? "month";
}

// Czy wiersz jest aktywny dla pola Data odnowienia (active_field_id wskazuje Checkbox i wartość to true;
// brak odwołania albo odwołanie do pola innego typu to „zawsze aktywny”)
export function rowActive(
  renewal: PageField,
  fields: PageField[],
  values: Record<string, unknown>,
): boolean {
  const id = renewal.config.active_field_id;
  const pole = id ? fields.find((f) => f.id === id && f.type === "checkbox") : undefined;
  return pole ? values[pole.id] === true : true;
}

// Zwraca wartość poprawnego typu albo null; niczego nie zgaduje (checkbox tylko boolean)
export function normalizeValue(field: PageField, raw: unknown): CellValue {
  switch (field.type) {
    case "text":
    case "url": {
      if (typeof raw !== "string") return null;
      const t = raw.trim();
      return t === "" ? null : field.type === "url" ? t : raw;
    }
    case "number": {
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
      if (typeof raw === "string") return parsujLiczbe(raw);
      return null;
    }
    case "checkbox":
      return typeof raw === "boolean" ? raw : null;
    case "rating": {
      const n =
        typeof raw === "number" ? raw : typeof raw === "string" ? parsujLiczbe(raw) : null;
      return n !== null && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
    }
    case "date":
    case "renewal":
      return typeof raw === "string" && dniOdEpoki(raw) !== null ? raw : null;
    case "recurring": {
      // Obiekt {amount, cycle} albo goła liczba / tekst („43,5”) z cyklem domyślnym pola
      let amount: number | null = null;
      let cycle: Cycle = field.config.default_cycle ?? "month";
      if (isRecurringValue(raw)) {
        amount = raw.amount;
        cycle = raw.cycle;
      } else if (typeof raw === "number") amount = Number.isFinite(raw) ? raw : null;
      else if (typeof raw === "string") amount = parsujLiczbe(raw);
      if (amount === null || amount < 0 || amount > 1_000_000_000) return null;
      // Nowy obiekt tylko z dwoma kluczami, kwota do 2 miejsc
      return { amount: Math.round(amount * 100) / 100, cycle };
    }
    case "secret":
      // Nowy obiekt tylko z czterema kluczami: nic dodatkowego (np. tekst jawny) nie trafia do bazy
      return isSecretValue(raw) ? { v: 1, g: raw.g, iv: raw.iv, ct: raw.ct } : null;
    case "select":
    case "status": {
      if (typeof raw !== "string") return null;
      const opcje = field.config.options ?? [];
      return opcje.some((o) => o.id === raw) ? raw : null;
    }
  }
}

// Tekst do podglądu; błędne wartości dają "" zamiast wyjątku
export function formatValue(field: PageField, raw: unknown): string {
  const v = normalizeValue(field, raw);
  if (v === null) return "";
  switch (field.type) {
    // Szyfrogram nigdy nie trafia do tekstu komórki
    case "secret":
      return "";
    case "text":
      return String(v);
    case "number": {
      const n = v as number;
      const format = field.config.number_format ?? "plain";
      if (format === "pln") return `${n.toFixed(2).replace(".", ",")} zł`;
      if (format === "percent") return `${String(n).replace(".", ",")}%`;
      return String(n).replace(".", ",");
    }
    case "checkbox":
      return v === true ? "✓" : "";
    case "url":
      return (v as string).replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    case "rating":
      return "★".repeat(v as number) + "☆".repeat(5 - (v as number));
    case "date":
    case "renewal": {
      const [r, m, d] = (v as string).split("-");
      return `${d}.${m}.${r}`;
    }
    case "recurring": {
      const k = v as RecurringValue;
      return `${formatMoney(k.amount)} zł / ${k.cycle === "month" ? "mies." : "rok"}`;
    }
    case "select":
    case "status":
      return (field.config.options ?? []).find((o) => o.id === v)?.label ?? "";
  }
}

// Przelicza wartość ze starego typu na nowy (spec 6.8); null = nie da się przenieść
export function convertValue(
  from: PageField,
  to: FieldType,
  raw: unknown,
  newOptions: FieldOption[],
): CellValue {
  const v = normalizeValue(from, raw);
  if (v === null) return null;
  // Typu Sekret nie zmienia się w żadną stronę (szyfrogramu nie da się przeliczyć)
  if (from.type === "secret" || to === "secret") return null;

  // Tekstowa postać wartości źródłowej
  let tekst: string;
  if (from.type === "number") tekst = String(v).replace(".", ",");
  else if (from.type === "checkbox") tekst = v === true ? "tak" : "nie";
  else if (from.type === "date" || from.type === "renewal" || from.type === "recurring") {
    tekst = formatValue(from, v);
  } else if (from.type === "select" || from.type === "status") tekst = formatValue(from, v);
  else if (from.type === "rating") tekst = String(v);
  else tekst = String(v);

  // Z i do nowych typów przechodzą tylko ścieżki ze specu; reszta to null
  if (from.type === "recurring" && to !== "text" && to !== "number" && to !== "recurring") return null;
  if (from.type === "renewal" && to !== "text" && to !== "date" && to !== "renewal") return null;
  if (to === "recurring" && from.type !== "number" && from.type !== "text" && from.type !== "recurring") {
    return null;
  }
  if (to === "renewal" && from.type !== "date" && from.type !== "text" && from.type !== "renewal") {
    return null;
  }

  switch (to) {
    case "text":
      return tekst;
    case "recurring": {
      if (from.type === "recurring") return v;
      const n = from.type === "number" ? (v as number) : parsujLiczbe(tekst);
      if (n === null || n < 0 || n > 1_000_000_000) return null;
      return { amount: Math.round(n * 100) / 100, cycle: "month" };
    }
    case "url": {
      if (from.type !== "text" && from.type !== "url") return null;
      return tekst.trim() === "" ? null : tekst.trim();
    }
    case "number": {
      if (from.type === "number" || from.type === "rating") return v as number;
      if (from.type === "recurring") return (v as RecurringValue).amount;
      if (from.type === "text" || from.type === "url") return parsujLiczbe(tekst);
      return null;
    }
    case "rating": {
      const n =
        from.type === "number" || from.type === "rating"
          ? (v as number)
          : from.type === "text"
            ? parsujLiczbe(tekst)
            : null;
      return n !== null && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
    }
    case "checkbox": {
      if (from.type === "checkbox") return v;
      if (from.type !== "text") return null;
      const t = tekst.trim().toLowerCase();
      if (["tak", "1", "x", "true"].includes(t)) return true;
      if (["nie", "0", "false"].includes(t)) return false;
      return null;
    }
    case "date":
    case "renewal": {
      if (from.type === "date" || from.type === "renewal") return v;
      if (from.type !== "text") return null;
      const t = tekst.trim();
      if (dniOdEpoki(t) !== null) return t;
      const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
      if (!m) return null;
      const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      return dniOdEpoki(iso) !== null ? iso : null;
    }
    case "select":
    case "status": {
      // To samo id (status <-> select) zostaje; resztę dopasowujemy po etykiecie
      if (
        (from.type === "select" || from.type === "status") &&
        newOptions.some((o) => o.id === v)
      ) {
        return v;
      }
      const t = tekst.trim().toLowerCase();
      if (t === "") return null;
      return newOptions.find((o) => o.label.trim().toLowerCase() === t)?.id ?? null;
    }
  }
}

// Plan zmiany typu: nowa konfiguracja, nowe wartości wszystkich wierszy i liczba utraconych
export function planTypeChange(
  field: PageField,
  to: FieldType,
  rows: { id: string; values: Record<string, unknown> }[],
  newId: () => string = () => crypto.randomUUID(),
): { config: FieldConfig; values: Record<string, CellValue>; lost: number } {
  // Config: zostaje tylko to, co ma sens dla nowego typu
  const config: FieldConfig = {};
  if (field.config.empty_label !== undefined) config.empty_label = field.config.empty_label;
  if (to === "date" && field.config.show_in_calendar !== undefined) {
    config.show_in_calendar = field.config.show_in_calendar;
  }
  // Nowa Data odnowienia: pokazuje się w kalendarzu (z daty przejmuje ustawienie) i ma własny cykl miesięczny
  if (to === "renewal") {
    config.show_in_calendar =
      field.type === "date" || field.type === "renewal"
        ? (field.config.show_in_calendar ?? true)
        : true;
    config.cycle = "month";
  }
  if (to === "recurring") config.default_cycle = "month";
  if (to === "number" && field.config.number_format !== undefined) {
    config.number_format = field.config.number_format;
  }

  if (to === "select" || to === "status") {
    if (field.type === "select" || field.type === "status") {
      // Status <-> select zachowuje opcje i ich id (i opcję domyślną)
      config.options = field.config.options ?? [];
      if (field.config.default_option !== undefined) {
        config.default_option = field.config.default_option;
      }
    } else {
      // Z innych typów: osobne opcje z unikalnych wartości, w kolejności pierwszego wystąpienia
      const opcje: FieldOption[] = [];
      for (const row of rows) {
        const tekst = convertValue(field, "text", row.values[field.id], []);
        if (typeof tekst !== "string" || tekst.trim() === "") continue;
        const etykieta = tekst.trim();
        if (opcje.some((o) => o.label.toLowerCase() === etykieta.toLowerCase())) continue;
        opcje.push({
          id: newId(),
          label: etykieta,
          color: PALETA[opcje.length % PALETA.length],
        });
      }
      config.options = opcje;
    }
  }

  const values: Record<string, CellValue> = {};
  let lost = 0;
  for (const row of rows) {
    const raw = row.values[field.id];
    const nowa = convertValue(field, to, raw, config.options ?? []);
    values[row.id] = nowa;
    if (nowa === null && normalizeValue(field, raw) !== null) lost += 1;
  }
  return { config, values, lost };
}

// Różnica dni między datą a „dziś” (dni kalendarzowe, bez stref)
function roznicaDni(iso: IsoDate, today: IsoDate): number {
  const a = dniOdEpoki(iso);
  const b = dniOdEpoki(today);
  return a === null || b === null ? Number.NaN : a - b;
}

// Jak `rel` w makiecie Projects
export function relativeDue(iso: string, today: string): { text: string; days: number } {
  const d = roznicaDni(iso, today);
  if (Number.isNaN(d)) return { text: "", days: d };
  const text =
    d < 0
      ? "minął"
      : d === 0
        ? "dziś"
        : d === 1
          ? "jutro"
          : d <= 60
            ? `za ${d} dni`
            : `za ${Math.round(d / 30)} mies.`;
  return { text, days: d };
}

// Pilne: termin dziś lub w ciągu 7 dni, jeśli nie zrobione
export function isUrgent(iso: string | null, today: string, done: boolean): boolean {
  if (iso === null || done) return false;
  const d = roznicaDni(iso, today);
  return d >= 0 && d <= 7;
}

// Stuknięcie komórki Wyboru na telefonie: następna opcja po kolei, po ostatniej pusta,
// z pustej pierwsza. Nieznana wartość (usunięta opcja) liczy się jak pusta.
export function nextOptionId(options: FieldOption[], current: unknown): string | null {
  if (options.length === 0) return null;
  const indeks = options.findIndex((o) => o.id === current);
  if (indeks === -1) return options[0].id;
  return indeks + 1 < options.length ? options[indeks + 1].id : null;
}
