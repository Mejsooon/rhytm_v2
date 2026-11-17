import { describe, expect, it } from "vitest";
import { normalizeSeriesStart } from "./series-start";

describe("normalizeSeriesStart", () => {
  it("weekdays zaczęte w sobotę → najbliższy poniedziałek", () => {
    // 2026-11-21 to sobota
    expect(normalizeSeriesStart("2026-11-21", { freq: "weekdays" })).toBe("2026-11-23");
  });
  it("weekdays w dzień roboczy zostaje bez zmian", () => {
    expect(normalizeSeriesStart("2026-11-17", { freq: "weekdays" })).toBe("2026-11-17");
  });
  it("custom pn+śr zaczęte we wtorek → środa", () => {
    expect(
      normalizeSeriesStart("2026-11-17", { freq: "custom", byWeekday: [1, 3] }),
    ).toBe("2026-11-18");
  });
  it("daily i weekly zostają bez zmian", () => {
    expect(normalizeSeriesStart("2026-11-21", { freq: "daily" })).toBe("2026-11-21");
    expect(normalizeSeriesStart("2026-11-21", { freq: "weekly" })).toBe("2026-11-21");
  });
  it("brak powtarzania → bez zmian", () => {
    expect(normalizeSeriesStart("2026-11-21", null)).toBe("2026-11-21");
  });
});
