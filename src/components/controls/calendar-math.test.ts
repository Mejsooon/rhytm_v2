import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  formatDatePl,
  monthTitlePl,
  todayIso,
} from "./calendar-math";

describe("calendar-math", () => {
  it("siatka listopada 2026 zaczyna się od poniedziałku", () => {
    const g = buildMonthGrid(2026, 10, "mon"); // 1.11.2026 to niedziela
    expect(g).toHaveLength(42);
    expect(g[0]).toEqual({ date: "2026-10-26", inMonth: false });
    expect(g[6]).toEqual({ date: "2026-11-01", inMonth: true });
  });

  it("tydzień od niedzieli", () => {
    expect(buildMonthGrid(2026, 10, "sun")[0]).toEqual({
      date: "2026-11-01",
      inMonth: true,
    });
  });

  it("liczba dni lutego, także w roku przestępnym", () => {
    expect(
      buildMonthGrid(2027, 1, "mon").filter((c) => c.inMonth),
    ).toHaveLength(28);
    expect(
      buildMonthGrid(2028, 1, "mon").filter((c) => c.inMonth),
    ).toHaveLength(29);
  });

  it("formatuje daty i tytuły miesięcy po polsku", () => {
    expect(formatDatePl("2026-11-16")).toBe("16.11.2026");
    expect(monthTitlePl(2026, 0)).toBe("styczeń 2026");
    expect(monthTitlePl(2026, 11)).toBe("grudzień 2026");
  });

  it("todayIso zwraca YYYY-MM-DD w podanej strefie", () => {
    expect(todayIso("Pacific/Kiritimati")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
