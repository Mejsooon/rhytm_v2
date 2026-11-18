import { describe, expect, it } from "vitest";
import { habitInputSchema, sleepInputSchema, SLEEP_TAGS } from "./schemas";

const nawyk = {
  name: "Czytanie",
  schedule: { type: "daily" as const, weekdays: [], timesPerWeek: null },
  remindAt: null,
  showOnToday: true,
};

const sen = {
  date: "2026-11-18",
  sleptAt: "23:30",
  wokeAt: "07:00",
  feeling: 4 as const,
  tags: ["Kawa po 16"],
  note: null,
};

describe("habitInputSchema", () => {
  it("odrzuca pustą nazwę", () => {
    expect(habitInputSchema.safeParse({ ...nawyk, name: "   " }).success).toBe(false);
  });

  it("odrzuca times_per_week 0 i 8, przyjmuje 1 i 7", () => {
    const wersja = (n: number) => ({
      ...nawyk,
      schedule: { type: "times_per_week" as const, weekdays: [], timesPerWeek: n },
    });
    expect(habitInputSchema.safeParse(wersja(0)).success).toBe(false);
    expect(habitInputSchema.safeParse(wersja(8)).success).toBe(false);
    expect(habitInputSchema.safeParse(wersja(1)).success).toBe(true);
    expect(habitInputSchema.safeParse(wersja(7)).success).toBe(true);
  });

  it("odrzuca weekdays bez dni i z dniem spoza 1..7", () => {
    const wersja = (dni: number[]) => ({
      ...nawyk,
      schedule: { type: "weekdays" as const, weekdays: dni, timesPerWeek: null },
    });
    expect(habitInputSchema.safeParse(wersja([])).success).toBe(false);
    expect(habitInputSchema.safeParse(wersja([0, 1])).success).toBe(false);
    expect(habitInputSchema.safeParse(wersja([8])).success).toBe(false);
  });

  it("weekdays z 7 dniami zapisuje jako daily, a dni sortuje i usuwa duplikaty", () => {
    const siedem = habitInputSchema.parse({
      ...nawyk,
      schedule: { type: "weekdays", weekdays: [7, 6, 5, 4, 3, 2, 1], timesPerWeek: null },
    });
    expect(siedem.schedule).toEqual({ type: "daily", weekdays: [], timesPerWeek: null });

    const kilka = habitInputSchema.parse({
      ...nawyk,
      schedule: { type: "weekdays", weekdays: [5, 1, 5], timesPerWeek: null },
    });
    expect(kilka.schedule.weekdays).toEqual([1, 5]);
  });

  it("czyści dni i X dla typów, które ich nie używają", () => {
    const w = habitInputSchema.parse({
      ...nawyk,
      schedule: { type: "daily", weekdays: [1, 2], timesPerWeek: 3 },
    });
    expect(w.schedule).toEqual({ type: "daily", weekdays: [], timesPerWeek: null });
  });

  it("sprawdza format godziny przypomnienia", () => {
    expect(habitInputSchema.safeParse({ ...nawyk, remindAt: "07:30" }).success).toBe(true);
    expect(habitInputSchema.safeParse({ ...nawyk, remindAt: "25:00" }).success).toBe(false);
  });
});

describe("sleepInputSchema", () => {
  it("przyjmuje poprawny wpis", () => {
    expect(sleepInputSchema.safeParse(sen).success).toBe(true);
  });

  it("odrzuca nieznany tag, przyjmuje wszystkie 5 stałych", () => {
    expect(sleepInputSchema.safeParse({ ...sen, tags: ["Pizza"] }).success).toBe(false);
    expect(sleepInputSchema.safeParse({ ...sen, tags: [...SLEEP_TAGS] }).success).toBe(true);
    expect(SLEEP_TAGS).toHaveLength(5);
  });

  it("odrzuca równe godziny z właściwym komunikatem", () => {
    const w = sleepInputSchema.safeParse({ ...sen, sleptAt: "07:00", wokeAt: "07:00" });
    expect(w.success).toBe(false);
    expect(w.error?.issues[0]?.message).toBe("Godziny zaśnięcia i pobudki muszą się różnić.");
  });

  it("odrzuca ocenę poza 1..5 i zbyt długą notatkę", () => {
    expect(sleepInputSchema.safeParse({ ...sen, feeling: 6 }).success).toBe(false);
    expect(sleepInputSchema.safeParse({ ...sen, note: "x".repeat(1001) }).success).toBe(false);
  });

  it("pustą notatkę zamienia na null", () => {
    expect(sleepInputSchema.parse({ ...sen, note: "  " }).note).toBeNull();
  });
});
