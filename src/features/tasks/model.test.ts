import { describe, expect, it } from "vitest";
import { occurrenceProgress, type TaskRow } from "./model";

function zadanie(nadpisz: Partial<TaskRow>): TaskRow {
  return {
    id: "t",
    user_id: "u1",
    title: "Zadanie",
    done: false,
    done_at: null,
    due_date: null,
    block_id: "b1",
    occurrence_date: "2026-11-17",
    position: 0,
    created_at: null,
    ...nadpisz,
  };
}

describe("occurrenceProgress", () => {
  it("liczy tylko zadania danego bloku i daty", () => {
    const zadania = [
      zadanie({ block_id: "b1", occurrence_date: "2026-11-17", done: true }),
      zadanie({ block_id: "b1", occurrence_date: "2026-11-17" }),
      zadanie({ block_id: "b1", occurrence_date: "2026-11-24", done: true }),
      zadanie({ block_id: "b2", occurrence_date: "2026-11-17", done: true }),
      zadanie({ block_id: "b3", occurrence_date: "2026-11-17" }),
    ];
    expect(occurrenceProgress(zadania, "b1", "2026-11-17")).toEqual({
      done: 1,
      total: 2,
    });
  });
});
