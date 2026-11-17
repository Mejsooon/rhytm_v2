import { describe, expect, it } from "vitest";
import { firstSteps } from "./first-steps";

const zera = { blocks: 0, habits: 0, workouts: 0, sleepLogs: 0 };

describe("firstSteps", () => {
  it("same zera → cztery niezrobione kroki, doneCount 0", () => {
    const wynik = firstSteps(zera);
    expect(wynik.doneCount).toBe(0);
    expect(wynik.steps.map((s) => s.done)).toEqual([false, false, false, false]);
    expect(wynik.steps.map((s) => [s.key, s.title, s.hint, s.href])).toEqual([
      ["block", "Dodaj pierwszy blok w kalendarzu", null, "/kalendarz"],
      ["habit", "Dodaj nawyk", "np. woda, czytanie, rozciąganie", "/nawyki"],
      ["workout", "Zapisz trening", "bieg albo siłownia", "/sport"],
      ["sleep", "Wpisz ostatnią noc", "godzina zaśnięcia i pobudki", "/nawyki"],
    ]);
  });

  it("2 bloki → pierwszy krok zrobiony, doneCount 1", () => {
    const wynik = firstSteps({ ...zera, blocks: 2 });
    expect(wynik.steps[0].done).toBe(true);
    expect(wynik.doneCount).toBe(1);
  });
});
