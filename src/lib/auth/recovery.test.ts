import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RECOVERY_COOKIE, RECOVERY_TTL_S, utworzZnacznikResetu, znacznikResetuPasuje } from "./recovery";

const SEKRET = "sekret-testowy-do-hmac";
const TERAZ = Date.UTC(2026, 10, 16, 12, 0, 0);
const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

describe("znacznik resetu hasła (HMAC)", () => {
  beforeEach(() => vi.stubEnv("RECOVERY_COOKIE_SECRET", SEKRET));
  afterEach(() => vi.unstubAllEnvs());

  it("nazwa ciasteczka i ważność 15 minut", () => {
    expect(RECOVERY_COOKIE).toBe("rhytm_recovery");
    expect(RECOVERY_TTL_S).toBe(900);
  });

  it("format: userId.wygasa.podpis (base64url HMAC-SHA256 z userId.wygasa)", () => {
    const wartosc = utworzZnacznikResetu(U1, TERAZ);
    const [id, wygasa, podpis] = wartosc.split(".");
    expect(id).toBe(U1);
    expect(Number(wygasa)).toBe(TERAZ / 1000 + 900);
    expect(podpis).toBe(createHmac("sha256", SEKRET).update(`${U1}.${wygasa}`).digest("base64url"));
  });

  it("poprawny znacznik dla tego samego użytkownika przed wygaśnięciem → true", () => {
    const wartosc = utworzZnacznikResetu(U1, TERAZ);
    expect(znacznikResetuPasuje(wartosc, U1, TERAZ + 899_000)).toBe(true);
  });

  it("podrobiony lub niepodpisany znacznik → false", () => {
    expect(znacznikResetuPasuje("1", U1, TERAZ)).toBe(false);
    expect(znacznikResetuPasuje(undefined, U1, TERAZ)).toBe(false);
    expect(znacznikResetuPasuje("", U1, TERAZ)).toBe(false);
    const wygasa = TERAZ / 1000 + 900;
    expect(znacznikResetuPasuje(`${U1}.${wygasa}`, U1, TERAZ)).toBe(false);
    expect(znacznikResetuPasuje(`${U1}.${wygasa}.zlypodpis`, U1, TERAZ)).toBe(false);
    // Podpis innym sekretem
    const obcy = createHmac("sha256", "inny").update(`${U1}.${wygasa}`).digest("base64url");
    expect(znacznikResetuPasuje(`${U1}.${wygasa}.${obcy}`, U1, TERAZ)).toBe(false);
    // Przedłużony czas wygaśnięcia przy starym podpisie
    const [, , podpis] = utworzZnacznikResetu(U1, TERAZ).split(".");
    expect(znacznikResetuPasuje(`${U1}.${wygasa + 3600}.${podpis}`, U1, TERAZ)).toBe(false);
  });

  it("znacznik innego użytkownika → false", () => {
    const wartosc = utworzZnacznikResetu(U2, TERAZ);
    expect(znacznikResetuPasuje(wartosc, U1, TERAZ)).toBe(false);
  });

  it("wygasły znacznik → false", () => {
    const wartosc = utworzZnacznikResetu(U1, TERAZ);
    expect(znacznikResetuPasuje(wartosc, U1, TERAZ + 901_000)).toBe(false);
  });

  it("brak RECOVERY_COOKIE_SECRET → czytelny błąd (bez zapasowego sekretu)", () => {
    vi.stubEnv("RECOVERY_COOKIE_SECRET", "");
    expect(() => utworzZnacznikResetu(U1, TERAZ)).toThrow(/RECOVERY_COOKIE_SECRET/);
    expect(() => znacznikResetuPasuje("a.b.c", U1, TERAZ)).toThrow(/RECOVERY_COOKIE_SECRET/);
  });
});
