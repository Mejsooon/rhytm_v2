import { describe, expect, it } from "vitest";
import {
  goalText,
  nightTitle,
  sleepMinutes,
  sleepStats,
  type SleepLog,
} from "./sleep";

describe("sleepMinutes", () => {
  it("liczy przez północ i zwraca null dla równych godzin", () => {
    expect(sleepMinutes("23:30", "00:15")).toBe(45);
    expect(sleepMinutes("00:30", "07:00")).toBe(390);
    expect(sleepMinutes("23:48", "07:00")).toBe(432);
    expect(sleepMinutes("07:00", "07:00")).toBeNull();
  });
});

describe("goalText", () => {
  it("poniżej celu", () => {
    expect(goalText(432, 480)).toEqual({
      web: "90% celu 8:00 · brakuje 48 min",
      phone: "Brakuje 48 min do celu 8:00",
    });
    expect(goalText(432, 450).phone).toBe("Brakuje 18 min do celu 7:30");
  });

  it("cel ≤ 0: sam czas snu, bez procentów", () => {
    expect(goalText(432, 0)).toEqual({ web: "7:12", phone: "7:12" });
    expect(goalText(432, -30)).toEqual({ web: "7:12", phone: "7:12" });
  });

  it("cel osiągnięty albo przekroczony", () => {
    expect(goalText(480, 480)).toEqual({
      web: "100% celu 8:00 · powyżej celu",
      phone: "Powyżej celu 8:00",
    });
    expect(goalText(465, 450).phone).toBe("Powyżej celu 7:30");
  });
});

describe("nightTitle", () => {
  it("„ze” przed „środy”", () => {
    expect(nightTitle("2026-11-19").web).toBe("Noc ze środy na czwartek");
    expect(nightTitle("2026-11-18").web).toBe("Noc z wtorku na środę");
  });

  it("web: dni tygodnia, phone: daty", () => {
    expect(nightTitle("2026-11-17").web).toBe("Noc z poniedziałku na wtorek");
    expect(nightTitle("2026-11-15").web).toBe("Noc z soboty na niedzielę");
    expect(nightTitle("2026-11-15").phone).toBe("Noc 14 → 15 listopada");
    expect(nightTitle("2026-11-01").phone).toBe(
      "Noc 31 października → 1 listopada",
    );
  });
});

describe("sleepStats", () => {
  const wpis = (date: string, sleptAt: string, wokeAt: string): SleepLog => ({
    date,
    sleptAt,
    wokeAt,
    feeling: null,
    tags: [],
    note: null,
  });

  it("średnia tylko z dni z wpisem", () => {
    const logs = [
      wpis("2026-11-17", "23:00", "07:00"), // 480
      wpis("2026-11-15", "00:00", "07:00"), // 420
      wpis("2026-10-01", "22:00", "08:00"), // poza zakresem
    ];
    const s = sleepStats(logs, "2026-11-17", 14, 450);
    expect(s.avg).toBe(450);
    expect(s.metGoal).toBe(1);
    expect(s.bars).toHaveLength(14);
    expect(s.bars[0].date).toBe("2026-11-04");
    expect(s.bars[13]).toEqual({ date: "2026-11-17", minutes: 480, met: true });
    expect(s.bars[12]).toEqual({
      date: "2026-11-16",
      minutes: null,
      met: false,
    });
    expect(s.bars[11]).toEqual({
      date: "2026-11-15",
      minutes: 420,
      met: false,
    });
  });

  it("brak wpisów: avg null", () => {
    const s = sleepStats([], "2026-11-17", 30, 480);
    expect(s.avg).toBeNull();
    expect(s.metGoal).toBe(0);
    expect(s.bars).toHaveLength(30);
  });
});
