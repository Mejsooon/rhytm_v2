import { describe, expect, it } from "vitest";
import {
  groupStandaloneTasks,
  occurrenceProgress,
  pinTask,
  unpinTask,
  type TaskRow,
} from "./model";
import type { Occurrence } from "@/features/calendar/occurrences";

function zadanie(nadpisz: Partial<TaskRow>): TaskRow {
  return {
    id: "t",
    user_id: "u1",
    title: "Zadanie",
    done: false,
    done_at: null,
    due_date: null,
    block_id: null,
    occurrence_date: null,
    position: 0,
    created_at: null,
    ...nadpisz,
  };
}

describe("groupStandaloneTasks", () => {
  it("dzieli na grupy i pomija zadania z block_id oraz zrobione zaległe", () => {
    const grupy = groupStandaloneTasks(
      [
        zadanie({ id: "a", due_date: "2026-11-15" }),
        zadanie({ id: "b", due_date: "2026-11-15", done: true }),
        zadanie({ id: "c", due_date: "2026-11-17" }),
        zadanie({ id: "d", due_date: "2026-11-18" }),
        zadanie({ id: "e", due_date: "2026-11-25" }),
        zadanie({ id: "f", due_date: null }),
        zadanie({ id: "g", due_date: "2026-11-17", block_id: "b1" }),
      ],
      "2026-11-17",
    );
    expect(grupy.overdue.map((t) => t.id)).toEqual(["a"]);
    expect(grupy.today.map((t) => t.id)).toEqual(["c"]);
    expect(grupy.tomorrow.map((t) => t.id)).toEqual(["d"]);
    expect(grupy.later.map((t) => t.id)).toEqual(["e"]);
    expect(grupy.noDate.map((t) => t.id)).toEqual(["f"]);
  });
});

describe("occurrenceProgress", () => {
  it("liczy tylko zadania danego bloku i daty", () => {
    const zadania = [
      zadanie({ block_id: "b1", occurrence_date: "2026-11-17", done: true }),
      zadanie({ block_id: "b1", occurrence_date: "2026-11-17" }),
      zadanie({ block_id: "b1", occurrence_date: "2026-11-24", done: true }),
      zadanie({ block_id: "b2", occurrence_date: "2026-11-17", done: true }),
      zadanie({}),
    ];
    expect(occurrenceProgress(zadania, "b1", "2026-11-17")).toEqual({
      done: 1,
      total: 2,
    });
  });
});

describe("pinTask / unpinTask", () => {
  const wystapienie: Occurrence = {
    key: "b1:2026-11-17",
    blockId: "b1",
    date: "2026-11-18", // przesunięte na inny dzień
    startMin: 480,
    durationMin: 60,
    title: "Blok",
    categoryId: null,
    note: null,
    remind: false,
    recurring: true,
    recurrence: { freq: "weekly" },
    modified: true,
  };

  it("pinTask ustawia block_id, oryginalną occurrence_date i due_date", () => {
    expect(pinTask(zadanie({}), wystapienie)).toEqual({
      block_id: "b1",
      occurrence_date: "2026-11-17",
      due_date: "2026-11-18",
    });
  });

  it("unpinTask zeruje block_id i occurrence_date, due_date zostaje", () => {
    expect(
      unpinTask(
        zadanie({
          block_id: "b1",
          occurrence_date: "2026-11-17",
          due_date: "2026-11-18",
        }),
      ),
    ).toEqual({ block_id: null, occurrence_date: null });
  });
});
