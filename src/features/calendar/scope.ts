// Planowanie zmiany bloku z zakresem: tylko to / to i następne / wszystkie.
// Funkcja jest czysta — zwraca plan, a warstwa zapisu (server actions) go wykonuje.
import type { IsoDate } from "@/components/controls/calendar-math";
import {
  expandOccurrences,
  type BlockRow,
  type ExceptionRow,
  type Occurrence,
  type Recurrence,
} from "./occurrences";
import { addDays } from "./view-range";

export type Scope = "this" | "following" | "all";

export type BlockPatch = {
  title?: string;
  categoryId?: string | null;
  note?: string | null;
  remind?: boolean;
  date?: IsoDate;
  startMin?: number;
  durationMin?: number;
  recurrence?: Recurrence | null;
};

export type ScopePlan =
  | { kind: "upsertException"; row: ExceptionRow }
  | { kind: "updateBlock"; patch: BlockPatch }
  | { kind: "deleteBlock" }
  // patch ma nazwy kluczy jak w SQL split_block_series (snake_case, start_time 'HH:MM')
  | {
      kind: "split";
      from: IsoDate;
      patch: Record<string, unknown>;
      delete: boolean;
    }
  | { kind: "detachTasksAndCancel"; date: IsoDate }
  // Zmiana niemożliwa (np. inny dzień dla serii codziennej) — akcja zwraca komunikat
  | { kind: "reject"; message: string };

// Komunikaty odrzuconej zmiany dnia (te same podpowiedzi pokazuje okno zakresu)
export const ZMIANA_DNIA_TYLKO_TYGODNIOWA =
  "Zmiana dnia działa dla tego wystąpienia albo dla całej serii tygodniowej.";
export const ZMIANA_DNIA_NIE_DLA_NASTEPNYCH =
  "Zmiana dnia działa dla tego wystąpienia albo dla całej serii.";

// Zmiana dnia wystąpienia przy „Wszystkie” (albo „To i następne” na pierwszym wystąpieniu).
// Przesunięcie liczymy od WIDOCZNEJ daty wystąpienia (tej, którą użytkownik widział i przesunął).
// - co tydzień: data startu serii rusza o tyle samo dni (seria przechodzi na nowy dzień tygodnia);
// - własne: start rusza i dni tygodnia obracają się o tyle samo (z zawinięciem nd → pn);
// - codziennie / dni robocze: odrzucamy, bo wzorzec i tak wróciłby blok na stare miejsce;
// - nowe „bez powtarzania”: blok staje się jednorazowy w wybranym dniu.
// Bez zmiany dnia data w patchu nie jest potrzebna.
function patchCalejSerii(
  block: BlockRow,
  dataWidoczna: IsoDate,
  patch: BlockPatch,
):
  | { kind: "updateBlock"; patch: BlockPatch }
  | { kind: "reject"; message: string } {
  const { date, ...reszta } = patch;
  if (date === undefined || date === dataWidoczna)
    return { kind: "updateBlock", patch: reszta };

  // Liczy się powtarzanie po zmianie (jeśli patch je zmienia)
  const rec =
    patch.recurrence !== undefined
      ? patch.recurrence
      : (block.recurrence as Recurrence | null);
  if (rec === null) return { kind: "updateBlock", patch: { ...reszta, date } };
  if (rec.freq === "daily" || rec.freq === "weekdays") {
    return { kind: "reject", message: ZMIANA_DNIA_TYLKO_TYGODNIOWA };
  }

  const dni = Math.round(
    (Date.parse(`${date}T00:00:00Z`) -
      Date.parse(`${dataWidoczna}T00:00:00Z`)) /
      86_400_000,
  );
  const nowyStart = addDays(block.start_local.slice(0, 10), dni);
  if (rec.freq === "weekly")
    return { kind: "updateBlock", patch: { ...reszta, date: nowyStart } };

  // Własne: dni tygodnia obracamy tylko, gdy użytkownik sam ich nie zmienił w tym patchu
  if (patch.recurrence !== undefined) {
    return { kind: "updateBlock", patch: { ...reszta, date: nowyStart } };
  }
  // 1 = pn … 7 = nd; ((d - 1 + dni) mod 7) + 1, także dla ujemnych dni
  const obrocone = (rec.byWeekday ?? [])
    .map((d) => ((((d - 1 + dni) % 7) + 7) % 7) + 1)
    .sort((a, b) => a - b);
  return {
    kind: "updateBlock",
    patch: {
      ...reszta,
      date: nowyStart,
      recurrence: { ...rec, byWeekday: obrocone },
    },
  };
}

export function planScopeChange(input: {
  block: BlockRow;
  occurrence: Occurrence;
  scope: Scope;
  patch?: BlockPatch;
  delete?: boolean;
}): ScopePlan {
  const { block, occurrence, scope } = input;
  const patch = input.patch ?? {};
  const usun = input.delete === true;

  // Oryginalna data wystąpienia siedzi w kluczu (`date` może być dniem, na który je przesunięto).
  // Wyjątki, zadania i split_block_series używają właśnie tej oryginalnej daty.
  const dataOryginalna = occurrence.key.slice(-10);

  // Blok jednorazowy: zakres nie ma znaczenia, zawsze zmieniamy cały blok
  if (block.recurrence === null) {
    return usun ? { kind: "deleteBlock" } : { kind: "updateBlock", patch };
  }

  // Zakres "to wystąpienie"
  if (scope === "this") {
    if (usun) {
      return { kind: "detachTasksAndCancel", date: dataOryginalna };
    }
    const dzien = patch.date ?? occurrence.date;
    const minuty = patch.startMin ?? occurrence.startMin;
    const hh = String(Math.floor(minuty / 60)).padStart(2, "0");
    const mm = String(minuty % 60).padStart(2, "0");
    return {
      kind: "upsertException",
      row: {
        block_id: block.id,
        user_id: block.user_id,
        occurrence_date: dataOryginalna,
        kind: "modified",
        new_start_local: `${dzien}T${hh}:${mm}:00`,
        new_duration_min: patch.durationMin ?? occurrence.durationMin,
        new_title: patch.title ?? occurrence.title,
      },
    };
  }

  // Zakres "wszystkie": zmiana całej serii (zmiana dnia przesuwa serię — patrz patchCalejSerii)
  if (scope === "all") {
    if (usun) return { kind: "deleteBlock" };
    return patchCalejSerii(block, occurrence.date, patch);
  }

  // Zakres "to i następne": sprawdzamy, czy to pierwsze wystąpienie serii.
  // Pierwsze wystąpienie liczymy z rozwijania (data startu nie musi pasować do serii).
  const dataStartu = block.start_local.slice(0, 10);
  const pierwsze = expandOccurrences(
    [block],
    [],
    dataStartu,
    addDays(dataStartu, 14),
  )[0];
  const czyPierwsze = pierwsze !== undefined && pierwsze.key === occurrence.key;

  // Dla pierwszego wystąpienia "to i następne" = cała seria (SQL nie dzieli na pierwszym)
  if (czyPierwsze) {
    if (usun) return { kind: "deleteBlock" };
    return patchCalejSerii(block, occurrence.date, patch);
  }

  // Środkowe wystąpienie nie może zmienić dnia (nowa seria startuje w dniu tego wystąpienia)
  if (!usun && patch.date !== undefined && patch.date !== occurrence.date) {
    return { kind: "reject", message: ZMIANA_DNIA_NIE_DLA_NASTEPNYCH };
  }

  // Środkowe wystąpienie: dzielimy serię; patch zapisujemy kluczami SQL
  const patchSql: Record<string, unknown> = {};
  if (patch.title !== undefined) patchSql.title = patch.title;
  if (patch.categoryId !== undefined) patchSql.category_id = patch.categoryId;
  if (patch.note !== undefined) patchSql.note = patch.note;
  if (patch.remind !== undefined) patchSql.remind = patch.remind;
  if (patch.startMin !== undefined) {
    const hh = String(Math.floor(patch.startMin / 60)).padStart(2, "0");
    const mm = String(patch.startMin % 60).padStart(2, "0");
    patchSql.start_time = `${hh}:${mm}`;
  }
  if (patch.durationMin !== undefined)
    patchSql.duration_min = patch.durationMin;
  if (patch.recurrence !== undefined) patchSql.recurrence = patch.recurrence;

  return { kind: "split", from: dataOryginalna, patch: patchSql, delete: usun };
}
