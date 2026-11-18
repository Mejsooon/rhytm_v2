import { describe, expect, it } from "vitest";
import { checkPasswordRules, passwordStrength } from "./password-rules";

describe("checkPasswordRules", () => {
  it("wykrywa za krótkie hasło z literami i cyframi", () => {
    expect(checkPasswordRules("abc123")).toEqual({
      minLength: false,
      lettersAndDigits: true,
    });
  });
  it("wykrywa brak cyfr", () => {
    expect(checkPasswordRules("abcdefghijk")).toEqual({
      minLength: true,
      lettersAndDigits: false,
    });
  });
});

describe("passwordStrength", () => {
  it("pusty string = 0", () => {
    expect(passwordStrength("", true)).toBe(0);
  });
  it("wszystkie reguły + długość ≥ 14 = 4", () => {
    expect(passwordStrength("rytmtygodnia2026x", true)).toBe(4);
  });
  it("wyciekłe hasło traci punkt", () => {
    expect(passwordStrength("rytm2026ab", false)).toBe(2);
  });
});
