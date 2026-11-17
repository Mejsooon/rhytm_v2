import { describe, expect, it } from "vitest";
import {
  isoWeekNumber,
  parseCalendarParams,
  shiftDate,
  viewRange,
  weekdayOf,
} from "./view-range";

describe("viewRange", () => {
  it("tydzień od poniedziałku", () => {
    const r = viewRange("tydzien", "2026-11-18", "mon");
    expect(r.from).toBe("2026-11-16");
    expect(r.to).toBe("2026-11-22");
    expect(r.days).toHaveLength(7);
  });

  it("tydzień od niedzieli", () => {
    const r = viewRange("tydzien", "2026-11-18", "sun");
    expect([r.from, r.to]).toEqual(["2026-11-15", "2026-11-21"]);
  });

  it("dzień to jeden dzień", () => {
    expect(viewRange("dzien", "2026-11-18", "mon")).toEqual({
      from: "2026-11-18",
      to: "2026-11-18",
      days: ["2026-11-18"],
    });
  });

  it("miesiąc to 6 pełnych tygodni siatki", () => {
    const r = viewRange("miesiac", "2026-11-18", "mon");
    expect([r.from, r.to]).toEqual(["2026-10-26", "2026-12-06"]);
    expect(r.days).toHaveLength(42);
  });
});

describe("parseCalendarParams", () => {
  it("zły widok i data dają domyślne wartości", () => {
    expect(
      parseCalendarParams({ widok: "x", data: "2026-13-40" }, "2026-11-17"),
    ).toEqual({
      view: "tydzien",
      date: "2026-11-17",
    });
  });

  it("poprawne parametry przechodzą", () => {
    expect(
      parseCalendarParams(
        { widok: "miesiac", data: "2026-02-28" },
        "2026-11-17",
      ),
    ).toEqual({
      view: "miesiac",
      date: "2026-02-28",
    });
  });

  it("nieistniejąca data (30 lutego) i brak parametrów", () => {
    expect(parseCalendarParams({ data: "2026-02-30" }, "2026-11-17").date).toBe(
      "2026-11-17",
    );
    expect(parseCalendarParams({}, "2026-11-17")).toEqual({
      view: "tydzien",
      date: "2026-11-17",
    });
  });
});

describe("shiftDate", () => {
  it("miesiąc przycina dzień do długości miesiąca", () => {
    expect(shiftDate("miesiac", "2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftDate("miesiac", "2026-01-15", -1)).toBe("2025-12-15");
  });
  it("dzień i tydzień", () => {
    expect(shiftDate("dzien", "2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftDate("tydzien", "2026-11-18", -1)).toBe("2026-11-11");
  });
});

describe("isoWeekNumber", () => {
  it("numery tygodni ISO", () => {
    expect(isoWeekNumber("2026-11-17")).toBe(47);
    expect(isoWeekNumber("2026-01-01")).toBe(1);
    expect(isoWeekNumber("2027-01-01")).toBe(53);
    expect(isoWeekNumber("2024-12-30")).toBe(1);
  });
});

describe("weekdayOf i widok miesiąca od niedzieli", () => {
  it("weekdayOf: 1 = pn … 7 = nd", () => {
    expect(weekdayOf("2026-11-16")).toBe(1);
    expect(weekdayOf("2026-11-22")).toBe(7);
  });

  it("miesiąc od niedzieli zaczyna się 1.11 (niedziela)", () => {
    const r = viewRange("miesiac", "2026-11-18", "sun");
    expect([r.from, r.to]).toEqual(["2026-11-01", "2026-12-12"]);
    expect(r.days).toHaveLength(42);
  });
});
