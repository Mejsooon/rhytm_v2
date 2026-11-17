import { describe, expect, it } from "vitest";
import {
  formatClockTime,
  safeTimezone,
  timezoneOptions,
  utcOffsetLabel,
} from "./timezones";

const listopad = new Date("2026-11-17T12:00:00Z");
const lipiec = new Date("2026-07-17T12:00:00Z");

describe("utcOffsetLabel", () => {
  it("zwraca przesunięcie zimowe i letnie", () => {
    expect(utcOffsetLabel("Europe/Warsaw", listopad)).toBe("UTC+01:00");
    expect(utcOffsetLabel("Europe/Warsaw", lipiec)).toBe("UTC+02:00");
  });
  it("używa znaku minus U+2212", () => {
    expect(utcOffsetLabel("America/New_York", listopad)).toBe("UTC−05:00");
  });
  it("obsługuje pół godziny i UTC", () => {
    expect(utcOffsetLabel("Asia/Kolkata", listopad)).toBe("UTC+05:30");
    expect(utcOffsetLabel("UTC", listopad)).toBe("UTC+00:00");
  });
});

describe("timezoneOptions", () => {
  it("ma 6 stref, pierwsza to Warszawa", () => {
    const o = timezoneOptions(listopad);
    expect(o).toHaveLength(6);
    expect(o[0]).toEqual({
      value: "Europe/Warsaw",
      city: "Warszawa",
      offset: "UTC+01:00",
    });
  });
  it("dodaje wykrytą strefę spoza listy", () => {
    const o = timezoneOptions(listopad, "Asia/Kolkata");
    expect(o).toHaveLength(7);
    expect(o[6].city).toBe("Kolkata");
  });
  it("nie dubluje strefy z listy ani nie dodaje błędnej", () => {
    expect(timezoneOptions(listopad, "Europe/Berlin")).toHaveLength(6);
    expect(timezoneOptions(listopad, "Mars/Base")).toHaveLength(6);
  });
  it("zamienia _ na spację w mieście", () => {
    const o = timezoneOptions(listopad, "America/Los_Angeles");
    expect(o[6].city).toBe("Los Angeles");
  });
});

describe("safeTimezone", () => {
  it("zwraca poprawną strefę albo Europe/Warsaw", () => {
    expect(safeTimezone(undefined)).toBe("Europe/Warsaw");
    expect(safeTimezone(null)).toBe("Europe/Warsaw");
    expect(safeTimezone("Mars/Base")).toBe("Europe/Warsaw");
    expect(safeTimezone("Asia/Kolkata")).toBe("Asia/Kolkata");
  });
});

describe("formatClockTime", () => {
  it("formatuje 24h i 12h", () => {
    expect(formatClockTime(8, 0, "24")).toBe("08:00");
    expect(formatClockTime(17, 0, "12")).toBe("5:00 PM");
    expect(formatClockTime(0, 30, "12")).toBe("12:30 AM");
  });
});
