import { describe, expect, it } from "vitest";

import { exerciseRecords, exerciseSessions, nextGoal } from "./exercise-stats";
import { seriaTreningu } from "./gym-test-data";
import type { GymSetRow } from "./model";

const seria = (id: string, nr: number, kg: number | null, powt: number | null, zmiany: Partial<GymSetRow> = {}) => ({
  ...seriaTreningu(id, "s", "e", 1, nr, kg, powt, true),
  ...zmiany,
});
const sesja = (id: string, day: string, sets: GymSetRow[]) => ({
  sessionId: id,
  startLocal: `${day}T16:00:00`,
  title: "Push",
  completed: true,
  sets,
});

const historia = [
  sesja("a", "2026-11-05", [seria("a1", 1, 60, 8)]),
  sesja("b", "2026-11-12", [
    seria("b0", 1, 100, 5, { set_type: "W" }),
    seria("b1", 2, 70, 6),
    seria("b2", 3, 90, 3, { set_type: "D" }),
  ]),
];

describe("liczby ćwiczenia", () => {
  const sesje = exerciseSessions(historia, "e", "wr", null);

  it("rozgrzewka nie liczy się nigdzie, drop set tylko do objętości", () => {
    expect(sesje[1].volume).toBe(70 * 6 + 90 * 3);
    expect(sesje[1].heaviest?.kg).toBe(70);
    expect(sesje[1].rm).toBe(84);
    expect(sesje[1].working.map((s) => s.id)).toEqual(["b1"]);
  });

  it("rekordy z datą i plakietką „nowy” z ostatniego treningu", () => {
    const r = exerciseRecords(sesje, "wr");
    expect(r.map((x) => [x.label, x.value, x.day, x.fresh])).toEqual([
      ["Szacowany 1RM", "84 kg", "2026-11-12", true],
      ["Najcięższa seria", "70 × 6", "2026-11-12", true],
      ["Najwięcej powtórzeń", "60 × 8", "2026-11-05", false],
      ["Objętość treningu", "690 kg", "2026-11-12", true],
    ]);
  });

  it("czas: najdłuższa seria i łączny czas", () => {
    const plank = exerciseSessions(
      [sesja("a", "2026-11-05", [seria("p1", 1, null, null, { duration_s: 60 }), seria("p2", 2, null, null, { duration_s: 45 })])],
      "e",
      "dur",
      null,
    );
    expect(exerciseRecords(plank, "dur").map((x) => x.value)).toEqual(["01:00", "01:45"]);
    expect(nextGoal(plank[0], "8–10", "dur")).toBeNull();
  });

  const po = (kg: number | null, powt: number, zakres: string | null, kind: "wr" | "bw" | "wbw" = "wr") =>
    nextGoal(exerciseSessions([sesja("a", "2026-11-05", [seria("x", 1, kg, powt)])], "e", kind, 72)[0], zakres, kind);

  it("cel: +1 powtórzenie w zakresie, +2,5 kg po dojściu do góry", () => {
    expect(po(72.5, 5, "5–8")).toEqual({ goal: "72,5 × 6", last: "72,5 × 5", change: "+1 powtórzenie" });
    expect(po(72.5, 8, "5–8")).toEqual({ goal: "75 × 5", last: "72,5 × 8", change: "+2,5 kg" });
    expect(po(40, 5, "5")?.goal).toBe("42,5 × 5");
    expect(po(40, 5, null)?.goal).toBe("40 × 6");
    expect(po(40, 12, "AMRAP")?.goal).toBe("40 × 13");
    expect(po(null, 12, "8–10", "bw")?.goal).toBe("13 powt.");
    expect(po(10, 10, "8–10", "wbw")?.goal).toBe("mc + 12,5 × 8");
  });

  it("niezakończone treningi i treningi bez wyniku są pomijane", () => {
    expect(exerciseSessions([{ ...historia[0], completed: false }], "e", "wr", null)).toEqual([]);
    expect(exerciseSessions([sesja("c", "2026-11-05", [seria("c1", 1, 60, null)])], "e", "wr", null)).toEqual([]);
  });
});
