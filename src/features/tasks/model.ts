// Logika zadań: grupowanie luźnych zadań, postęp wystąpienia, przypinanie do bloku.
import type { Database } from "@/types/database";
import type { IsoDate } from "@/components/controls/calendar-math";
import type { Occurrence } from "@/features/calendar/occurrences";
import { addDays } from "@/features/calendar/view-range";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

// Luźne zadania (bez block_id) w grupach wg terminu.
// Zrobione zadania z przeszłości nie są zaległe i nie trafiają do żadnej grupy.
export function groupStandaloneTasks(tasks: TaskRow[], today: IsoDate) {
  const jutro = addDays(today, 1);
  const grupy = {
    overdue: [] as TaskRow[],
    today: [] as TaskRow[],
    tomorrow: [] as TaskRow[],
    later: [] as TaskRow[],
    noDate: [] as TaskRow[],
  };

  for (const zadanie of tasks) {
    if (zadanie.block_id !== null) continue;

    if (zadanie.due_date === null) {
      grupy.noDate.push(zadanie);
    } else if (zadanie.due_date < today) {
      if (!zadanie.done) grupy.overdue.push(zadanie);
    } else if (zadanie.due_date === today) {
      grupy.today.push(zadanie);
    } else if (zadanie.due_date === jutro) {
      grupy.tomorrow.push(zadanie);
    } else {
      grupy.later.push(zadanie);
    }
  }
  return grupy;
}

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

// Pola do zapisu przy przypięciu zadania do wystąpienia.
// occurrence_date to ORYGINALNA data (z klucza), due_date to dzień, na którym wystąpienie jest pokazane.
export function pinTask(
  _task: TaskRow,
  occurrence: Occurrence,
): Partial<TaskRow> {
  return {
    block_id: occurrence.blockId,
    occurrence_date: occurrence.key.slice(-10),
    due_date: occurrence.date,
  };
}

// Odpięcie: termin (due_date) zostaje
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parametr zostaje dla spójnego API
export function unpinTask(_task: TaskRow): Partial<TaskRow> {
  return { block_id: null, occurrence_date: null };
}
