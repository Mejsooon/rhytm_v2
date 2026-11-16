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

  it("Ń złożone z N + znaku łączącego (NFD, np. klawiatura macOS) pasuje do „USUŃ” (NFC)", () => {
    const nfd = "USUŃ".normalize("NFD");
    expect(nfd).not.toBe("USUŃ");
    expect(matchesWord(nfd, "USUŃ")).toBe(true);
    expect(matchesWord("usuń", "USUŃ".normalize("NFD"))).toBe(true);
    expect(matchesWord("USUN", "USUŃ".normalize("NFD"))).toBe(false);
  });
});
