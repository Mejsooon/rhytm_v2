import { describe, expect, it } from "vitest";

import { dragResult, snapMinutes } from "./drag";

const D = "2026-11-17";

describe("snapMinutes", () => {
  it("zaokrągla do kroku 15 minut", () => {
    expect(snapMinutes(487)).toBe(480);
    expect(snapMinutes(488)).toBe(495);
  });
});

describe("dragResult — tworzenie", () => {
  it("zakres od 600 do 640 obejmuje ostatni skok: 600–645", () => {
    expect(dragResult("create", { date: D, min: 600 }, { date: D, min: 640 })).toEqual({
      date: D,
      startMin: 600,
      durationMin: 45,
    });
  });

  it("przeciągnięcie w górę (640 → 600) daje ten sam zakres 600–645", () => {
    expect(dragResult("create", { date: D, min: 640 }, { date: D, min: 600 })).toEqual({
      date: D,
      startMin: 600,
      durationMin: 45,
    });
  });

  it("bez ruchu daje minimum 15 minut", () => {
    expect(dragResult("create", { date: D, min: 600 }, { date: D, min: 601 })).toEqual({
      date: D,
      startMin: 600,
      durationMin: 15,
    });
  });

  it("nie wychodzi poza 24:00", () => {
    const wynik = dragResult("create", { date: D, min: 1400 }, { date: D, min: 1440 });
    expect(wynik).toEqual({ date: D, startMin: 1395, durationMin: 45 });
  });
});

describe("dragResult — przesuwanie", () => {
  it("blok 60 min z 1410 zostaje przycięty do 1380 (koniec 24:00)", () => {
    expect(
      dragResult(
        "move",
        { date: D, min: 1420 },
        { date: D, min: 1420 },
        { startMin: 1410, durationMin: 60 },
      ),
    ).toEqual({ date: D, startMin: 1380, durationMin: 60 });
  });

  it("przesunięcie o godzinę w dół", () => {
    expect(
      dragResult(
        "move",
        { date: D, min: 500 },
        { date: D, min: 560 },
        { startMin: 480, durationMin: 30 },
      ),
    ).toEqual({ date: D, startMin: 540, durationMin: 30 });
  });

  it("start nie spada poniżej 0", () => {
    expect(
      dragResult(
        "move",
        { date: D, min: 100 },
        { date: D, min: 0 },
        { startMin: 30, durationMin: 60 },
      ),
    ).toEqual({ date: D, startMin: 0, durationMin: 60 });
  });

  it("przesunięcie na inny dzień zachowuje czas trwania", () => {
    expect(
      dragResult(
        "move",
        { date: D, min: 500 },
        { date: "2026-11-19", min: 500 },
        { startMin: 480, durationMin: 90 },
      ),
    ).toEqual({ date: "2026-11-19", startMin: 480, durationMin: 90 });
  });

  it("bez oryginału zwraca null", () => {
    expect(dragResult("move", { date: D, min: 500 }, { date: D, min: 560 })).toBeNull();
  });
});

describe("dragResult — rozciąganie", () => {
  it("wydłuża koniec, start zostaje", () => {
    expect(
      dragResult(
        "resize",
        { date: D, min: 540 },
        { date: D, min: 600 },
        { startMin: 480, durationMin: 60 },
      ),
    ).toEqual({ date: D, startMin: 480, durationMin: 120 });
  });

  it("poniżej 15 minut daje 15", () => {
    expect(
      dragResult(
        "resize",
        { date: D, min: 540 },
        { date: D, min: 400 },
        { startMin: 480, durationMin: 60 },
      ),
    ).toEqual({ date: D, startMin: 480, durationMin: 15 });
  });

  it("koniec nie przekracza 24:00", () => {
    expect(
      dragResult(
        "resize",
        { date: D, min: 1380 },
        { date: D, min: 1440 },
        { startMin: 1320, durationMin: 60 },
      ),
    ).toEqual({ date: D, startMin: 1320, durationMin: 120 });
  });
});
