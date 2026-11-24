// Czysta logika przekierowań wywoływana z proxy. Zwraca docelową ścieżkę albo null (przepuść).

const EKRANY_KONTA = ["/logowanie", "/rejestracja", "/reset-hasla"];
const PUBLICZNE = [
  "/nowe-haslo",
  "/potwierdzono",
  "/link-wygasl",
  "/regulamin",
  "/prywatnosc",
];
const PUBLICZNE_PREFIKSY = ["/auth/", "/dev/"];
const ZAWSZE_PRZEPUSZCZANE_PREFIKSY = ["/icons/", "/_next/"];
// Konto oznaczone do usunięcia ma dostęp tylko do ekranu przywracania i eksportu danych
const KONTO_USUNIETE = "/konto-usuniete";
const DOZWOLONE_PRZY_USUWANIU = [KONTO_USUNIETE, "/api/eksport"];

export function resolveRoute(input: {
  pathname: string;
  isLoggedIn: boolean;
  // null = nie wiadomo (zapytanie o profil się nie udało) — wtedy nie przekierowujemy według onboardingu
  isOnboarded: boolean | null;
  // Data prośby o usunięcie konta (null/brak = konto aktywne albo stara baza bez kolumny)
  deletionRequestedAt?: string | null;
}): { redirect: string } | null {
  const { pathname, isLoggedIn, isOnboarded } = input;
  const doUsuniecia = isLoggedIn && input.deletionRequestedAt != null;
  const domyslnaDlaZalogowanego =
    isOnboarded === false ? "/onboarding" : "/dzis";

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

  // Konto czeka na usunięcie: wszędzie poza ekranem przywracania i eksportem → /konto-usuniete
  if (doUsuniecia) {
    return DOZWOLONE_PRZY_USUWANIU.includes(pathname)
      ? null
      : { redirect: KONTO_USUNIETE };
  }

  // Ekran przywracania bez prośby o usunięcie: niezalogowany → logowanie, zalogowany → aplikacja
  if (pathname === KONTO_USUNIETE) {
    return { redirect: isLoggedIn ? domyslnaDlaZalogowanego : "/logowanie" };
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

  // Stan onboardingu nieznany: przepuszczamy, zamiast odbijać użytkownika między /dzis a /onboarding
  if (isOnboarded === null) {
    return null;
  }

  // Onboarding: ukończony → aplikacja
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    return isOnboarded ? { redirect: "/dzis" } : null;
  }

  // Reszta aplikacji wymaga ukończonego onboardingu
  return isOnboarded ? null : { redirect: "/onboarding" };
}
