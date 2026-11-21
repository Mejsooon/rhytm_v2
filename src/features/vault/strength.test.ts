// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MASTER_MIN_STRENGTH, masterPasswordStrength } from "./strength";

describe("masterPasswordStrength", () => {
  it("11 znaków → 0", () => {
    expect(masterPasswordStrength("Aa1!Aa1!Aa1")).toBe(0);
  });

  it("aaaaaaaaaaaa → 1", () => {
    expect(masterPasswordStrength("aaaaaaaaaaaa")).toBe(1);
  });

  it("aaaaaaaaaaa1 → 2", () => {
    expect(masterPasswordStrength("aaaaaaaaaaa1")).toBe(2);
  });

  it("Aaaaaaaaaaa1! → 4 przy 20 znakach", () => {
    expect(masterPasswordStrength("Aaaaaaaaaaaaaaaaaa1!")).toBe(4);
  });

  it("wynik w zakresie 0..4", () => {
    const probki = ["", "a", "abc", "aaaaaaaaaaaa", "Aaaaaaaaaaa1!", "Zażółć gęślą jaźń 12345 !@#$%^&*()"];
    for (const p of probki) {
      const w = masterPasswordStrength(p);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(4);
    }
  });

  it("minimalna wymagana siła to 2", () => {
    expect(MASTER_MIN_STRENGTH).toBe(2);
  });
});
