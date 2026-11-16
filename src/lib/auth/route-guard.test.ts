import { describe, expect, it } from "vitest";

import { resolveRoute } from "./route-guard";

const wylogowany = { isLoggedIn: false, isOnboarded: false };
const bezOnboardingu = { isLoggedIn: true, isOnboarded: false };
const pelny = { isLoggedIn: true, isOnboarded: true };

describe("resolveRoute", () => {
  it("niezalogowany na chronionej trasie → /logowanie", () => {
    expect(resolveRoute({ pathname: "/dzis", ...wylogowany })).toEqual({ redirect: "/logowanie" });
  });

  it("zalogowany na ekranie konta → /dzis lub /onboarding", () => {
    expect(resolveRoute({ pathname: "/logowanie", ...pelny })).toEqual({ redirect: "/dzis" });
    expect(resolveRoute({ pathname: "/rejestracja", ...bezOnboardingu })).toEqual({ redirect: "/onboarding" });
    expect(resolveRoute({ pathname: "/reset-hasla", ...pelny })).toEqual({ redirect: "/dzis" });
  });

  it("niezalogowany na ekranie konta → przepuszczony", () => {
    expect(resolveRoute({ pathname: "/logowanie", ...wylogowany })).toBeNull();
  });

  it("zalogowany bez onboardingu na chronionej trasie → /onboarding", () => {
    expect(resolveRoute({ pathname: "/kalendarz", ...bezOnboardingu })).toEqual({ redirect: "/onboarding" });
  });

  it("zalogowany z onboardingiem na chronionej trasie → przepuszczony", () => {
    expect(resolveRoute({ pathname: "/kalendarz", ...pelny })).toBeNull();
  });

  it("/onboarding wymaga logowania, ukończony → /dzis", () => {
    expect(resolveRoute({ pathname: "/onboarding", ...pelny })).toEqual({ redirect: "/dzis" });
    expect(resolveRoute({ pathname: "/onboarding", ...wylogowany })).toEqual({ redirect: "/logowanie" });
    expect(resolveRoute({ pathname: "/onboarding", ...bezOnboardingu })).toBeNull();
  });

  it("trasy publiczne dla wszystkich", () => {
    expect(resolveRoute({ pathname: "/nowe-haslo", ...pelny })).toBeNull();
    expect(resolveRoute({ pathname: "/potwierdzono", ...pelny })).toBeNull();
    expect(resolveRoute({ pathname: "/link-wygasl", ...wylogowany })).toBeNull();
    expect(resolveRoute({ pathname: "/auth/confirm", ...wylogowany })).toBeNull();
    expect(resolveRoute({ pathname: "/regulamin", ...wylogowany })).toBeNull();
    expect(resolveRoute({ pathname: "/prywatnosc", ...pelny })).toBeNull();
    expect(resolveRoute({ pathname: "/dev/kontrolki", ...wylogowany })).toBeNull();
  });

  it("zasoby statyczne zawsze przepuszczane", () => {
    expect(resolveRoute({ pathname: "/manifest.webmanifest", ...wylogowany })).toBeNull();
    expect(resolveRoute({ pathname: "/icons/icon-192.png", ...wylogowany })).toBeNull();
    expect(resolveRoute({ pathname: "/_next/static/a.js", ...wylogowany })).toBeNull();
  });

  it("nieznany stan onboardingu (błąd zapytania o profil) → bez przekierowań zależnych od onboardingu", () => {
    const nieznany = { isLoggedIn: true, isOnboarded: null };
    expect(resolveRoute({ pathname: "/dzis", ...nieznany })).toBeNull();
    expect(resolveRoute({ pathname: "/onboarding", ...nieznany })).toBeNull();
    // Ekrany konta i strona główna nadal wymagają celu — wtedy aplikacja
    expect(resolveRoute({ pathname: "/logowanie", ...nieznany })).toEqual({ redirect: "/dzis" });
    expect(resolveRoute({ pathname: "/", ...nieznany })).toEqual({ redirect: "/dzis" });
  });

  it("strona główna przekierowuje", () => {
    expect(resolveRoute({ pathname: "/", ...pelny })).toEqual({ redirect: "/dzis" });
    expect(resolveRoute({ pathname: "/", ...wylogowany })).toEqual({ redirect: "/logowanie" });
    expect(resolveRoute({ pathname: "/", ...bezOnboardingu })).toEqual({ redirect: "/onboarding" });
  });
});
