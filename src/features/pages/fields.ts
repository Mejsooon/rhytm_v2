// Typy pól silnika stron: wartości, formatowanie, konwersja i daty względne.
// Czyste funkcje bez bazy i UI — zapis do bazy robią RPC z Etapu 6.
import type { IsoDate } from "@/components/controls";

export type FieldType =
  | "text"
  | "number"
  | "checkbox"
  | "url"
  | "select"
  | "status"
  | "date"
  | "rating";

export type FieldOption = { id: string; label: string; color: string };

export type FieldConfig = {
  options?: FieldOption[];
  number_format?: "plain" | "pln" | "percent";
  show_in_calendar?: boolean;
  empty_label?: string;
};

export type PageField = {
  id: string;
  name: string;
  type: FieldType;
  config: FieldConfig;
  position: number;
  isTitle: boolean;
};

export type CellValue = string | number | boolean | null;

// Ikony nagłówków i etykiety z makiet (AddField)
export const FIELD_TYPE_META: Record<FieldType, { icon: string; label: string }> = {
  text: { icon: "Aa", label: "Tekst" },
  number: { icon: "#", label: "Liczba" },
  checkbox: { icon: "✓", label: "Checkbox" },
  url: { icon: "↗", label: "URL" },
  select: { icon: "◉", label: "Select" },
  status: { icon: "◐", label: "Status" },
  date: { icon: "▦", label: "Data" },
  rating: { icon: "★", label: "Ocena" },
};

// „Typ pola” w edytorze (EmptyPage): Wybór = status z kolorowymi plakietkami
export const EDITOR_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: "text", label: "Tekst", icon: "Aa" },
  { type: "number", label: "Liczba", icon: "#" },
  { type: "date", label: "Data", icon: "▦" },
  { type: "status", label: "Wybór", icon: "◐" },
  { type: "checkbox", label: "Checkbox", icon: "☑" },
  { type: "url", label: "Link", icon: "↗" },
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
      return typeof raw === "string" && dniOdEpoki(raw) !== null ? raw : null;
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
    case "date": {
      const [r, m, d] = (v as string).split("-");
      return `${d}.${m}.${r}`;
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

  // Tekstowa postać wartości źródłowej
  let tekst: string;
  if (from.type === "number") tekst = String(v).replace(".", ",");
  else if (from.type === "checkbox") tekst = v === true ? "tak" : "nie";
  else if (from.type === "date") tekst = formatValue(from, v);
  else if (from.type === "select" || from.type === "status") tekst = formatValue(from, v);
  else if (from.type === "rating") tekst = String(v);
  else tekst = String(v);

  switch (to) {
    case "text":
      return tekst;
    case "url": {
      if (from.type !== "text" && from.type !== "url") return null;
      return tekst.trim() === "" ? null : tekst.trim();
    }
    case "number": {
      if (from.type === "number" || from.type === "rating") return v as number;
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
    case "date": {
      if (from.type === "date") return v;
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
  if (to === "number" && field.config.number_format !== undefined) {
    config.number_format = field.config.number_format;
  }

  if (to === "select" || to === "status") {
    if (field.type === "select" || field.type === "status") {
      // Status <-> select zachowuje opcje i ich id
      config.options = field.config.options ?? [];
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
