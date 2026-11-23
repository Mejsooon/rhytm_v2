// Logika zadań: postęp wystąpienia.
import type { Database } from "@/types/database";
import type { IsoDate } from "@/components/controls/calendar-math";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

// Ile zadań przypiętych do danego wystąpienia jest zrobionych (date = oryginalna data wystąpienia)
export function occurrenceProgress(
  tasks: TaskRow[],
  blockId: string,
  date: IsoDate,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const zadanie of tasks) {
    if (zadanie.block_id !== blockId || zadanie.occurrence_date !== date) {
      continue;
    }
    total += 1;
    if (zadanie.done) done += 1;
  }
  return { done, total };
}
