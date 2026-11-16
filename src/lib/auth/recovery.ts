import { createHmac, timingSafeEqual } from "node:crypto";

// Znacznik „ta sesja przyszła z linku resetu hasła”: ciasteczko podpisane HMAC-SHA256 sekretem serwera.
// Wartość: `${userId}.${wygasaS}.${podpis}`, podpis = base64url(HMAC(sekret, `${userId}.${wygasaS}`)).
// Bez sekretu nie da się go podrobić ani przedłużyć, a powiązanie z userId nie pozwala użyć cudzego.
// (Claim amr w JWT nie wystarcza: verifyOtp z linku daje w GoTrue wpis „otp”, nie „recovery”.)
// Moduł wyłącznie serwerowy.

export const RECOVERY_COOKIE = "rhytm_recovery";
// Jak długo po kliknięciu linku wolno ustawić nowe hasło bez starego
export const RECOVERY_TTL_S = 15 * 60;

function sekret(): string {
  const wartosc = process.env.RECOVERY_COOKIE_SECRET;
  if (!wartosc) {
    throw new Error("Brak RECOVERY_COOKIE_SECRET — ustaw sekret (np. `openssl rand -base64 32`) w zmiennych środowiskowych");
  }
  return wartosc;
}

// Tworzy wartość ciasteczka dla użytkownika, który właśnie kliknął link resetu (wywołuje /auth/confirm)
export function utworzZnacznikResetu(userId: string, teraz: number = Date.now()): string {
  const wygasa = Math.floor(teraz / 1000) + RECOVERY_TTL_S;
  const podpis = createHmac("sha256", sekret()).update(`${userId}.${wygasa}`).digest("base64url");
  return `${userId}.${wygasa}.${podpis}`;
}

// Sprawdza podpis, ważność i to, że znacznik należy do bieżącego użytkownika (id z getUser())
export function znacznikResetuPasuje(wartosc: string | undefined, userId: string, teraz: number = Date.now()): boolean {
  const klucz = sekret();
  const czesci = (wartosc ?? "").split(".");
  if (czesci.length !== 3) return false;
  const [id, wygasa, podpis] = czesci;

  const oczekiwany = createHmac("sha256", klucz).update(`${id}.${wygasa}`).digest();
  const otrzymany = Buffer.from(podpis, "base64url");
  // timingSafeEqual wymaga równych długości; porównanie w stałym czasie nie zdradza, ile bajtów się zgadza
  if (otrzymany.length !== oczekiwany.length || !timingSafeEqual(otrzymany, oczekiwany)) return false;

  return id === userId && Number(wygasa) > teraz / 1000;
}
