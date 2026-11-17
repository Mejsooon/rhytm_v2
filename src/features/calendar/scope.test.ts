import { describe, expect, it } from "vitest";
import { planScopeChange } from "./scope";
import { expandOccurrences, type BlockRow } from "./occurrences";

function blok(nadpisz: Partial<BlockRow>): BlockRow {
  return {
    id: "b1",
    user_id: "u1",
    title: "Blok",
    category_id: null,
    note: null,
    start_local: "2026-11-03T08:00:00",
    duration_min: 60,
    timezone: "Europe/Warsaw",
    recurrence: null,
    remind: false,
    created_at: null,
    updated_at: null,
    ...nadpisz,
  };
}

// Wystąpienie bloku w danym dniu (z prawdziwego rozwijania)
function wystapienie(b: BlockRow, data: string) {
  const w = expandOccurrences([b], [], data, data)[0];
  if (!w) throw new Error("brak wystąpienia " + data);
  return w;
}

describe("planScopeChange", () => {
  it("blok jednorazowy + this + patch -> updateBlock", () => {
    const b = blok({});
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-03"),
      scope: "this",
      patch: { title: "Nowy" },
    });
    expect(plan).toEqual({ kind: "updateBlock", patch: { title: "Nowy" } });
  });

  it("blok jednorazowy + usunięcie -> deleteBlock", () => {
    const b = blok({});
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-03"),
      scope: "following",
      delete: true,
    });
    expect(plan).toEqual({ kind: "deleteBlock" });
  });

  it("cykliczny + this + przesunięcie na 09:00 -> wyjątek modified", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "this",
      patch: { startMin: 540 },
    });
    expect(plan).toEqual({
      kind: "upsertException",
      row: {
        block_id: "b1",
        user_id: "u1",
        occurrence_date: "2026-11-17",
        kind: "modified",
        new_start_local: "2026-11-17T09:00:00",
        new_duration_min: 60,
        new_title: "Blok",
      },
    });
  });

  it("wyjątek używa ORYGINALNEJ daty z klucza, gdy wystąpienie było przeniesione", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const przeniesione = {
      ...wystapienie(b, "2026-11-17"),
      date: "2026-11-18",
    };
    const plan = planScopeChange({
      block: b,
      occurrence: przeniesione,
      scope: "this",
      patch: { title: "X" },
    });
    expect(plan.kind).toBe("upsertException");
    if (plan.kind === "upsertException") {
      expect(plan.row.occurrence_date).toBe("2026-11-17");
      expect(plan.row.new_start_local).toBe("2026-11-18T08:00:00");
    }
  });

  it("cykliczny + this + usunięcie -> detachTasksAndCancel", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "this",
      delete: true,
    });
    expect(plan).toEqual({ kind: "detachTasksAndCancel", date: "2026-11-17" });
  });

  it("following na pierwszym wystąpieniu -> updateBlock / deleteBlock", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const o = wystapienie(b, "2026-11-03");
    expect(
      planScopeChange({
        block: b,
        occurrence: o,
        scope: "following",
        patch: { title: "Nowy" },
      }),
    ).toEqual({ kind: "updateBlock", patch: { title: "Nowy" } });
    expect(
      planScopeChange({
        block: b,
        occurrence: o,
        scope: "following",
        delete: true,
      }),
    ).toEqual({ kind: "deleteBlock" });
  });

  it("pierwsze wystąpienie liczone, gdy data startu nie pasuje do serii (weekdays)", () => {
    // 2026-11-01 to niedziela, pierwsze wystąpienie weekdays to poniedziałek 2026-11-02
    const b = blok({
      start_local: "2026-11-01T08:00:00",
      recurrence: { freq: "weekdays" },
    });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-02"),
      scope: "following",
      delete: true,
    });
    expect(plan).toEqual({ kind: "deleteBlock" });
  });

  it("following na środkowym -> split z from i kluczami SQL", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "following",
      patch: {
        title: "Nowy",
        startMin: 570,
        categoryId: "c1",
        durationMin: 30,
      },
    });
    expect(plan).toEqual({
      kind: "split",
      from: "2026-11-17",
      patch: {
        title: "Nowy",
        start_time: "09:30",
        category_id: "c1",
        duration_min: 30,
      },
      delete: false,
    });
  });

  it("following + usunięcie na środkowym -> split z delete", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "following",
      delete: true,
    });
    expect(plan).toEqual({
      kind: "split",
      from: "2026-11-17",
      patch: {},
      delete: true,
    });
  });

  it("all ze zmianą godziny -> updateBlock z nową godziną", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "all",
      patch: { startMin: 600 },
    });
    expect(plan).toEqual({ kind: "updateBlock", patch: { startMin: 600 } });
  });

  it("all + usunięcie -> deleteBlock", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "all",
      delete: true,
    });
    expect(plan).toEqual({ kind: "deleteBlock" });
  });
});
