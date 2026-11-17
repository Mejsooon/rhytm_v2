import { describe, expect, it } from "vitest";
import { describeRecurrence, recurrenceBadge } from "./recurrence-text";

const DOPISEK = "Każde powtórzenie ma własną, pustą listę zadań.";

describe("describeRecurrence", () => {
  it("brak powtarzania", () => {
    expect(describeRecurrence(null, "2026-11-17")).toBe(`Jednorazowy blok. ${DOPISEK}`);
  });
  it("codziennie", () => {
    expect(describeRecurrence({ freq: "daily" }, "2026-11-17")).toBe(
      `Każdego dnia, bez końca. ${DOPISEK}`,
    );
  });
  it("dni robocze", () => {
    expect(describeRecurrence({ freq: "weekdays" }, "2026-11-17")).toBe(
      `Pon–pt, bez końca. ${DOPISEK}`,
    );
  });
  it("co tydzień z końcem (17.11.2026 to wtorek)", () => {
    expect(describeRecurrence({ freq: "weekly", until: "2027-01-31" }, "2026-11-17")).toBe(
      "Co tydzień we wtorki, do 31.01.2027. Każde powtórzenie ma własną, pustą listę zadań.",
    );
  });
  it("co tydzień bez końca, inny dzień tygodnia", () => {
    expect(describeRecurrence({ freq: "weekly" }, "2026-11-16")).toBe(
      `Co tydzień w poniedziałki, bez końca. ${DOPISEK}`,
    );
  });
  it("własne dni", () => {
    expect(
      describeRecurrence({ freq: "custom", byWeekday: [1, 3], until: "2027-01-31" }, "2026-11-17"),
    ).toBe(`Co tydzień w dni: pn, śr, do 31.01.2027. ${DOPISEK}`);
  });
});

describe("recurrenceBadge", () => {
  it("etykiety", () => {
    expect(recurrenceBadge({ freq: "weekly" })).toBe("↻ co tydzień");
    expect(recurrenceBadge({ freq: "daily" })).toBe("↻ codziennie");
    expect(recurrenceBadge({ freq: "weekdays" })).toBe("↻ dni robocze");
    expect(recurrenceBadge({ freq: "custom", byWeekday: [1] })).toBe("↻ własne");
  });
});
