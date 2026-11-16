// Czysta logika przekierowań wywoływana z proxy. Zwraca docelową ścieżkę albo null (przepuść).

const EKRANY_KONTA = ["/logowanie", "/rejestracja", "/reset-hasla"];
const PUBLICZNE = ["/nowe-haslo", "/potwierdzono", "/link-wygasl", "/regulamin", "/prywatnosc"];
const PUBLICZNE_PREFIKSY = ["/auth/", "/dev/"];
const ZAWSZE_PRZEPUSZCZANE_PREFIKSY = ["/icons/", "/_next/"];

export function resolveRoute(input: {
  pathname: string;
  isLoggedIn: boolean;
  isOnboarded: boolean;
}): { redirect: string } | null {
  const { pathname, isLoggedIn, isOnboarded } = input;
  const domyslnaDlaZalogowanego = isOnboarded ? "/dzis" : "/onboarding";

  // Zasoby statyczne — nigdy nie przekierowujemy
  if (
    pathname === "/manifest.webmanifest" ||
    ZAWSZE_PRZEPUSZCZANE_PREFIKSY.some((p) => pathname.startsWith(p))
  ) {
    return null;
  }

  // Trasy publiczne dla wszystkich (także zalogowanych)
  if (
    PUBLICZNE.includes(pathname) ||
    PUBLICZNE_PREFIKSY.some((p) => pathname.startsWith(p)) ||
    pathname === "/auth" ||
    pathname === "/dev"
  ) {
    return null;
  }

  // Ekrany konta: zalogowany nie ma tu czego szukać
  if (EKRANY_KONTA.includes(pathname)) {
    return isLoggedIn ? { redirect: domyslnaDlaZalogowanego } : null;
  }

  // Strona główna zawsze przekierowuje
  if (pathname === "/") {
    return { redirect: isLoggedIn ? domyslnaDlaZalogowanego : "/logowanie" };
  }

  // Wszystko poniżej wymaga zalogowania
  if (!isLoggedIn) {
    return { redirect: "/logowanie" };
  }

  // Onboarding: ukończony → aplikacja
  if (pathname === "/onboarding") {
    return isOnboarded ? { redirect: "/dzis" } : null;
  }

  // Reszta aplikacji wymaga ukończonego onboardingu
  return isOnboarded ? null : { redirect: "/onboarding" };
}
