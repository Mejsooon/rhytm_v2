import { describe, expect, it } from "vitest";
import { pathAfterLogin } from "./next-path";

describe("pathAfterLogin", () => {
  it("brak profilu → onboarding", () => {
    expect(pathAfterLogin(null)).toBe("/onboarding");
  });

  it("profil bez onboarded_at → onboarding", () => {
    expect(pathAfterLogin({ onboarded_at: null })).toBe("/onboarding");
  });

  it("ukończony onboarding → /dzis", () => {
    expect(pathAfterLogin({ onboarded_at: "2026-11-16T10:00:00Z" })).toBe("/dzis");
  });
});
