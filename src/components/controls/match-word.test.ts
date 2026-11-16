import { describe, expect, it } from "vitest";
import { matchesWord } from "./match-word";

describe("matchesWord", () => {
  it("ignoruje wielkość liter i białe znaki na brzegach", () => {
    expect(matchesWord("resetuj", "RESETUJ")).toBe(true);
    expect(matchesWord("RESETUJ  ", "RESETUJ")).toBe(true);
    expect(matchesWord("usuń", "USUŃ")).toBe(true);
  });

  it("wymaga polskich znaków i pełnego słowa", () => {
    expect(matchesWord("usun", "USUŃ")).toBe(false);
    expect(matchesWord("RESET", "RESETUJ")).toBe(false);
  });
});
