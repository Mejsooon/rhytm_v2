import { describe, expect, it } from "vitest";
import { describeSchedule, formatDuration, streakLabel } from "./text";

describe("describeSchedule", () => {
  it("teksty jak w makietach", () => {
    expect(
      describeSchedule({
        validFrom: "2026-11-01",
        type: "daily",
        weekdays: [],
        timesPerWeek: null,
      }),
    ).toBe("codziennie");
    expect(
      describeSchedule({
        validFrom: "2026-11-01",
        type: "weekdays",
        weekdays: [7, 1, 5, 3],
        timesPerWeek: null,
      }),
    ).toBe("pn, śr, pt, nd");
    expect(
      describeSchedule({
        validFrom: "2026-11-01",
        type: "times_per_week",
        weekdays: [],
        timesPerWeek: 4,
      }),
    ).toBe("4× w tygodniu");
  });
});

describe("formatDuration", () => {
  it("h:mm", () => {
    expect(formatDuration(432)).toBe("7:12");
    expect(formatDuration(441)).toBe("7:21");
    expect(formatDuration(480)).toBe("8:00");
    expect(formatDuration(45)).toBe("0:45");
  });
});

describe("streakLabel", () => {
  it("odmiana dni i tygodnie", () => {
    expect(streakLabel({ value: 1, unit: "days" })).toBe("1 dzień");
    expect(streakLabel({ value: 2, unit: "days" })).toBe("2 dni");
    expect(streakLabel({ value: 12, unit: "days" })).toBe("12 dni");
    expect(streakLabel({ value: 0, unit: "days" })).toBe("0 dni");
    expect(streakLabel({ value: 3, unit: "weeks" })).toBe("3 tyg.");
    expect(streakLabel({ value: 1, unit: "weeks" })).toBe("1 tyg.");
  });
});
