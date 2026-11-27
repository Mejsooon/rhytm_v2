import { describe, expect, it } from "vitest";

import type { SportItem } from "./model";
import { metric, periodRange, runRecords, shiftPeriod, stats } from "./overview-model";

function wpis(over: Partial<SportItem>): SportItem {
  return {
    key: "k", kind: "run", sessionId: "s", templateId: null, date: "2026-11-10", startMin: 600, durationMin: 60,
    title: "Spokojny", planned: false, showInCalendar: true, distanceKm: 10, durationS: 3600, kcal: null,
    difficulty: null, runKind: null, note: null, ...over,
  };
}

describe("periodRange", () => {
  it("miesiąc: tygodnie przycięte do miesiąca", () => {
    const z = periodRange("miesiac", "2026-11-17", "mon");
    expect(z.title).toBe("Listopad 2026");
    expect(z.bins[0]).toEqual({ from: "2026-11-01", to: "2026-11-01", label: "tydz. 44" });
    expect(z.bins.at(-1)).toMatchObject({ from: "2026-11-30", to: "2026-11-30" });
  });
  it("rok ma 12 miesięcy, a przesunięcie miesiąca nie przeskakuje lutego", () => {
    expect(periodRange("rok", "2026-11-17", "mon").bins).toHaveLength(12);
    expect(shiftPeriod("miesiac", "2027-01-31", 1)).toBe("2027-02-01");
  });
});

describe("stats i metric", () => {
  const dane = [
    wpis({}),
    wpis({ distanceKm: 14, planned: true, durationS: null }),
    wpis({ kind: "gym", distanceKm: null, durationS: null }),
    wpis({ kind: "other", title: "Rower", distanceKm: 20 }),
  ];
  it("liczy wykonane", () => {
    expect(stats(dane)).toMatchObject({ km: 10, runs: 1, gym: 1, other: 1, paceS: 360, totalS: 10800 });
  });
  it("słupek: km biegu albo liczba treningów, plan osobno", () => {
    expect(metric(dane, "all")).toBe(10);
    expect(metric(dane, "all", true)).toBe(14);
    expect(metric(dane, "gym")).toBe(1);
  });
});

describe("runRecords", () => {
  it("najlepszy czas na 10 km, najdłuższy bieg i trasa aktywności", () => {
    const r = runRecords(
      [wpis({ durationS: 3700 }), wpis({ durationS: 3500 }), wpis({ distanceKm: 16 }), wpis({ kind: "other", title: "Rower", distanceKm: 42 })],
      (s) => `${s}`,
    );
    expect(r.map((x) => [x.label, x.value])).toEqual([
      ["10 km", "3500"],
      ["Najdłuższy bieg", "16,0 km"],
      ["Rower · najdłuższa trasa", "42,0 km"],
    ]);
  });
});
