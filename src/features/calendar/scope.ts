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
  | { kind: "detachTasksAndCancel"; date: IsoDate };

// Zmiana dnia wystąpienia przesuwa całą serię: data startu bloku rusza o tyle dni, o ile
// przesunięto wystąpienie (tygodniowa seria przechodzi na nowy dzień tygodnia).
// Bez zmiany dnia data w patchu nie jest potrzebna.
function patchCalejSerii(
  block: BlockRow,
  dataOryginalna: IsoDate,
  patch: BlockPatch,
): BlockPatch {
  const { date, ...reszta } = patch;
  if (date === undefined || date === dataOryginalna) return reszta;
  const dni = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dataOryginalna}T00:00:00Z`)) / 86_400_000,
  );
  return { ...reszta, date: addDays(block.start_local.slice(0, 10), dni) };
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

  // Zakres "wszystkie": zmiana całej serii. Data startu serii zostaje (patch.date pomijamy).
  if (scope === "all") {
    if (usun) return { kind: "deleteBlock" };
    return { kind: "updateBlock", patch: patchCalejSerii(block, dataOryginalna, patch) };
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
    return { kind: "updateBlock", patch: patchCalejSerii(block, dataOryginalna, patch) };
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
