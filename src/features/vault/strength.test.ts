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

  it("wynik ma konkretne wartości dla znanych haseł", () => {
    expect(masterPasswordStrength("")).toBe(0);
    expect(masterPasswordStrength("abc")).toBe(0);
    expect(masterPasswordStrength("aaaaaaaaaaaa")).toBe(1);
    expect(masterPasswordStrength("Aaaaaaaaaaa1!")).toBe(4);
    expect(masterPasswordStrength("Zażółć gęślą jaźń 12345 !@#$%^&*()")).toBe(4);
  });

  it("progi długości: 15 → 1, 16 → 2, 19 → 2, 20 → 3 (jedna klasa)", () => {
    expect(masterPasswordStrength("a".repeat(15))).toBe(1);
    expect(masterPasswordStrength("a".repeat(16))).toBe(2);
    expect(masterPasswordStrength("a".repeat(19))).toBe(2);
    expect(masterPasswordStrength("a".repeat(20))).toBe(3);
  });

  it("dokładnie 3: 16 znaków i dwie klasy", () => {
    expect(masterPasswordStrength("a".repeat(15) + "1")).toBe(3);
  });

  it("długość liczona w punktach kodowych: 6 emoji to 6 znaków, 12 emoji to 12", () => {
    expect(masterPasswordStrength("😀".repeat(6))).toBe(0);
    expect(masterPasswordStrength("😀".repeat(11))).toBe(0);
    expect(masterPasswordStrength("😀".repeat(12))).toBe(1);
  });

  it("minimalna wymagana siła to 2", () => {
    expect(MASTER_MIN_STRENGTH).toBe(2);
  });
});
