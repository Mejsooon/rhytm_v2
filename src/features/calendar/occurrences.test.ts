import { describe, expect, it } from "vitest";
import { expandOccurrences, type BlockRow, type ExceptionRow } from "./occurrences";

// Pełny wiersz bloku z sensownymi domyślnymi wartościami
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

function wyjatek(nadpisz: Partial<ExceptionRow>): ExceptionRow {
  return {
    block_id: "b1",
    user_id: "u1",
    occurrence_date: "2026-11-10",
    kind: "cancelled",
    new_start_local: null,
    new_duration_min: null,
    new_title: null,
    ...nadpisz,
  };
}

const daty = (o: { date: string }[]) => o.map((x) => x.date);

describe("expandOccurrences", () => {
  it("weekly: 4 wtorki w listopadzie", () => {
    const wyniki = expandOccurrences(
      [blok({ recurrence: { freq: "weekly" } })],
      [],
      "2026-11-01",
      "2026-11-30",
    );
    expect(daty(wyniki)).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
    expect(wyniki[0]).toMatchObject({
      key: "b1:2026-11-03",
      startMin: 480,
      durationMin: 60,
      recurring: true,
      modified: false,
    });
  });

  it("weekly z until włącznie", () => {
    const wyniki = expandOccurrences(
      [blok({ recurrence: { freq: "weekly", until: "2026-11-17" } })],
      [],
      "2026-11-01",
      "2026-11-30",
    );
    expect(daty(wyniki)).toEqual(["2026-11-03", "2026-11-10", "2026-11-17"]);
  });

  it("weekdays: pn–pt w tygodniu 16–22.11", () => {
    const wyniki = expandOccurrences(
      [blok({ recurrence: { freq: "weekdays" } })],
      [],
      "2026-11-16",
      "2026-11-22",
    );
    expect(daty(wyniki)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
    ]);
  });

  it("custom [1,3]: poniedziałki i środy", () => {
    const wyniki = expandOccurrences(
      [blok({ recurrence: { freq: "custom", byWeekday: [1, 3] } })],
      [],
      "2026-11-16",
      "2026-11-22",
    );
    expect(daty(wyniki)).toEqual(["2026-11-16", "2026-11-18"]);
  });

  it("daily z until przed startem daje 0 wystąpień", () => {
    const wyniki = expandOccurrences(
      [blok({ recurrence: { freq: "daily", until: "2026-10-01" } })],
      [],
      "2026-11-01",
      "2026-11-30",
    );
    expect(wyniki).toHaveLength(0);
  });

  it("daily nie wychodzi przed start_local", () => {
    const wyniki = expandOccurrences(
      [blok({ recurrence: { freq: "daily" } })],
      [],
      "2026-11-01",
      "2026-11-05",
    );
    expect(daty(wyniki)).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
  });

  it("wyjątek cancelled usuwa wystąpienie", () => {
    const wyniki = expandOccurrences(
      [blok({ recurrence: { freq: "weekly" } })],
      [wyjatek({ occurrence_date: "2026-11-10" })],
      "2026-11-01",
      "2026-11-30",
    );
    expect(daty(wyniki)).toEqual(["2026-11-03", "2026-11-17", "2026-11-24"]);
  });

  it("wyjątek modified nadpisuje start, czas i tytuł", () => {
    const wyniki = expandOccurrences(
      [blok({ recurrence: { freq: "weekly" } })],
      [
        wyjatek({
          occurrence_date: "2026-11-17",
          kind: "modified",
          new_start_local: "2026-11-17T09:30:00",
          new_duration_min: 30,
          new_title: "Inny",
        }),
      ],
      "2026-11-17",
      "2026-11-17",
    );
    expect(wyniki).toHaveLength(1);
    expect(wyniki[0]).toMatchObject({
      date: "2026-11-17",
      startMin: 570,
      durationMin: 30,
      title: "Inny",
      modified: true,
    });
  });

  it("blok jednorazowy poza zakresem nie wchodzi", () => {
    expect(
      expandOccurrences([blok({})], [], "2026-11-10", "2026-11-30"),
    ).toHaveLength(0);
    expect(expandOccurrences([blok({})], [], "2026-11-01", "2026-11-30")).toHaveLength(1);
  });

  it("jednorazowy blok nie jest recurring", () => {
    const [o] = expandOccurrences([blok({})], [], "2026-11-01", "2026-11-30");
    expect(o.recurring).toBe(false);
    expect(o.recurrence).toBeNull();
  });

  it("seria zaczęta przed zakresem daje wystąpienia w zakresie", () => {
    const wyniki = expandOccurrences(
      [blok({ start_local: "2026-01-06T08:00:00", recurrence: { freq: "weekly" } })],
      [],
      "2026-11-01",
      "2026-11-30",
    );
    expect(daty(wyniki)).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
  });

  it("DST: godzina 08:00 nie przesuwa się przez zmianę czasu", () => {
    const wiosna = expandOccurrences(
      [blok({ start_local: "2026-03-24T08:00:00", recurrence: { freq: "weekly" } })],
      [],
      "2026-03-22",
      "2026-04-05",
    );
    expect(daty(wiosna)).toEqual(["2026-03-24", "2026-03-31"]);
    expect(wiosna.map((o) => o.startMin)).toEqual([480, 480]);

    const jesien = expandOccurrences(
      [blok({ start_local: "2026-10-20T08:00:00", recurrence: { freq: "weekly" } })],
      [],
      "2026-10-18",
      "2026-11-01",
    );
    expect(daty(jesien)).toContain("2026-10-27");
    expect(jesien.every((o) => o.startMin === 480)).toBe(true);
  });

  it("sortuje po dacie i godzinie", () => {
    const wyniki = expandOccurrences(
      [
        blok({ id: "a", start_local: "2026-11-03T10:00:00" }),
        blok({ id: "b", start_local: "2026-11-03T08:00:00" }),
        blok({ id: "c", start_local: "2026-11-02T20:00:00" }),
      ],
      [],
      "2026-11-01",
      "2026-11-30",
    );
    expect(wyniki.map((o) => o.blockId)).toEqual(["c", "b", "a"]);
  });
});
