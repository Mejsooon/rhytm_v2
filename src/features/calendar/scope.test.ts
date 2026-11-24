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

  it("cykliczny + this + usunięcie -> deleteTasksAndCancel", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "this",
      delete: true,
    });
    expect(plan).toEqual({ kind: "deleteTasksAndCancel", date: "2026-11-17" });
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

  it("all ze zmianą dnia o +1 -> updateBlock z datą startu serii przesuniętą o +1 dzień", () => {
    const b = blok({ recurrence: { freq: "weekly" } }); // start 2026-11-03 (wt)
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "all",
      patch: { date: "2026-11-18", title: "X" },
    });
    expect(plan).toEqual({
      kind: "updateBlock",
      patch: { date: "2026-11-04", title: "X" },
    });
  });

  it("all bez zmiany dnia nie dokłada daty do patcha", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "all",
      patch: { date: "2026-11-17", title: "X" },
    });
    expect(plan).toEqual({ kind: "updateBlock", patch: { title: "X" } });
  });

  it("following na pierwszym wystąpieniu ze zmianą dnia przesuwa start serii", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-03"),
      scope: "following",
      patch: { date: "2026-11-05" },
    });
    expect(plan).toEqual({
      kind: "updateBlock",
      patch: { date: "2026-11-05" },
    });
  });

  it("blok jednorazowy zachowuje datę z patcha bez zmian", () => {
    const b = blok({});
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-03"),
      scope: "all",
      patch: { date: "2026-11-09" },
    });
    expect(plan).toEqual({
      kind: "updateBlock",
      patch: { date: "2026-11-09" },
    });
  });
  it("all ze zmianą dnia w serii codziennej -> odrzucone", () => {
    const b = blok({ recurrence: { freq: "daily" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "all",
      patch: { date: "2026-11-18" },
    });
    expect(plan).toEqual({
      kind: "reject",
      message:
        "Zmiana dnia działa dla tego wystąpienia albo dla całej serii tygodniowej.",
    });
  });

  it("following na pierwszym wystąpieniu dni roboczych ze zmianą dnia -> odrzucone", () => {
    const b = blok({
      start_local: "2026-11-02T08:00:00",
      recurrence: { freq: "weekdays" },
    });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-02"),
      scope: "following",
      patch: { date: "2026-11-03" },
    });
    expect(plan.kind).toBe("reject");
  });

  it("all ze zmianą dnia w serii własnej obraca dni tygodnia (z zawinięciem)", () => {
    // pn + nd, start pn 2026-11-02; przesunięcie o +1: wt + pn
    const b = blok({
      start_local: "2026-11-02T08:00:00",
      recurrence: { freq: "custom", byWeekday: [1, 7], until: "2026-12-31" },
    });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-09"),
      scope: "all",
      patch: { date: "2026-11-10" },
    });
    expect(plan).toEqual({
      kind: "updateBlock",
      patch: {
        date: "2026-11-03",
        recurrence: { freq: "custom", byWeekday: [1, 2], until: "2026-12-31" },
      },
    });
  });

  it("all ze zmianą dnia w serii własnej o -1 zawija pn na nd", () => {
    const b = blok({
      start_local: "2026-11-02T08:00:00",
      recurrence: { freq: "custom", byWeekday: [1, 3] },
    });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-04"),
      scope: "all",
      patch: { date: "2026-11-03" },
    });
    expect(plan).toEqual({
      kind: "updateBlock",
      patch: {
        date: "2026-11-01",
        recurrence: { freq: "custom", byWeekday: [2, 7] },
      },
    });
  });

  it("all ze zmianą dnia w serii tygodniowej przesuwa tylko start (bez recurrence)", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-10"),
      scope: "all",
      patch: { date: "2026-11-12" },
    });
    expect(plan).toEqual({
      kind: "updateBlock",
      patch: { date: "2026-11-05" },
    });
  });

  it("all na przeniesionym wystąpieniu liczy przesunięcie od widocznej daty", () => {
    // Wystąpienie z wt 17.11 przeniesione na śr 18.11; użytkownik przesuwa je na czw 19.11
    const b = blok({ recurrence: { freq: "weekly" } }); // start wt 2026-11-03
    const przeniesione = {
      ...wystapienie(b, "2026-11-17"),
      date: "2026-11-18",
    };
    const plan = planScopeChange({
      block: b,
      occurrence: przeniesione,
      scope: "all",
      patch: { date: "2026-11-19" },
    });
    // +1 dzień od widocznej daty (nie +2 od oryginalnej)
    expect(plan).toEqual({
      kind: "updateBlock",
      patch: { date: "2026-11-04" },
    });
  });

  it("all na przeniesionym wystąpieniu z datą równą widocznej nie przesuwa serii", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const przeniesione = {
      ...wystapienie(b, "2026-11-17"),
      date: "2026-11-18",
    };
    const plan = planScopeChange({
      block: b,
      occurrence: przeniesione,
      scope: "all",
      patch: { date: "2026-11-18", title: "X" },
    });
    expect(plan).toEqual({ kind: "updateBlock", patch: { title: "X" } });
  });

  it("following ze zmianą dnia na środkowym wystąpieniu -> odrzucone (zamiast cichego pominięcia)", () => {
    const b = blok({ recurrence: { freq: "weekly" } });
    const plan = planScopeChange({
      block: b,
      occurrence: wystapienie(b, "2026-11-17"),
      scope: "following",
      patch: { date: "2026-11-18", title: "X" },
    });
    expect(plan).toEqual({
      kind: "reject",
      message: "Zmiana dnia działa dla tego wystąpienia albo dla całej serii.",
    });
  });
});
