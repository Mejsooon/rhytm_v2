import { describe, expect, it } from "vitest";
import { dayNumbers, layoutDay, nowLine } from "./day-layout";
import type { Occurrence } from "./occurrences";

function wyst(key: string, startMin: number, durationMin: number): Occurrence {
  return {
    key,
    blockId: key,
    date: "2026-11-17",
    startMin,
    durationMin,
    title: key,
    categoryId: null,
    note: null,
    remind: false,
    recurring: false,
    recurrence: null,
    modified: false,
  };
}

describe("layoutDay", () => {
  it("3 nakładające się bloki dzielą szerokość na 3 kolumny", () => {
    const wynik = layoutDay([wyst("a", 600, 60), wyst("b", 600, 60), wyst("c", 600, 60)]);
    expect(wynik.map((w) => w.cols)).toEqual([3, 3, 3]);
    expect(wynik.map((w) => w.col).sort()).toEqual([0, 1, 2]);
  });

  it("bloki jeden po drugim nie dzielą szerokości", () => {
    const wynik = layoutDay([wyst("a", 600, 60), wyst("b", 660, 60)]);
    expect(wynik).toEqual([
      { key: "a", col: 0, cols: 1 },
      { key: "b", col: 0, cols: 1 },
    ]);
  });

  it("łańcuch nakładań tworzy jedną grupę, ale zwalnia kolumny", () => {
    // a 10-12, b 11-13 (nakłada się z a), c 12-13 (z b, nie z a) -> c wraca do kolumny 0
    const wynik = layoutDay([wyst("a", 600, 120), wyst("b", 660, 120), wyst("c", 720, 60)]);
    expect(wynik.find((w) => w.key === "c")).toEqual({ key: "c", col: 0, cols: 2 });
    expect(wynik.every((w) => w.cols === 2)).toBe(true);
  });
});

describe("dayNumbers", () => {
  it("zaplanowane liczy sumę połączonych przedziałów, wolne z okna 8–20", () => {
    const n = dayNumbers([wyst("a", 540, 120), wyst("b", 600, 120)], []);
    expect(n.plannedMin).toBe(240);
    expect(n.freeMin).toBe(540);
  });

  it("blok 07–09 odejmuje od wolnego tylko 08–09", () => {
    const n = dayNumbers([wyst("a", 420, 120)], []);
    expect(n.freeMin).toBe(660);
  });

  it("zadania", () => {
    const n = dayNumbers([], [{ done: true }, { done: false }, { done: true }]);
    expect(n).toEqual({ plannedMin: 0, freeMin: 720, tasksDone: 2, tasksTotal: 3 });
  });
});

describe("nowLine", () => {
  it("zwraca minuty dla dzisiejszego dnia, null dla innego", () => {
    expect(nowLine({ date: "2026-11-17", minutes: 615 }, "2026-11-17")).toBe(615);
    expect(nowLine({ date: "2026-11-17", minutes: 615 }, "2026-11-18")).toBeNull();
  });
});
