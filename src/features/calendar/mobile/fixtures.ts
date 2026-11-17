// Dane testowe wspólne dla testów widoków telefonu (nie trafia do bundla aplikacji).
import type { CategoryRow } from "../load-calendar";
import type { Occurrence } from "../occurrences";

export function kategoria(id: string, name: string, color: string): CategoryRow {
  return { id, name, color, hidden: false, is_system: false, position: 1, user_id: "u1", created_at: null };
}

export function wystapienie(
  key: string,
  date: string,
  startMin: number,
  durationMin: number,
  title: string,
  categoryId: string | null,
): Occurrence {
  return {
    key,
    blockId: key.split(":")[0],
    date,
    startMin,
    durationMin,
    title,
    categoryId,
    note: null,
    remind: false,
    recurring: false,
    recurrence: null,
    modified: false,
  };
}
