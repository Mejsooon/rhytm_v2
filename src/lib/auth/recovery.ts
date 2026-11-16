import type { SupabaseClient } from "@supabase/supabase-js";

// Jak długo po kliknięciu linku resetu wolno ustawić nowe hasło bez starego
const OKNO_RESETU_S = 15 * 60;
// Tolerancja rozjechanych zegarów (serwer aplikacji vs serwer Supabase)
const TOLERANCJA_ZEGARA_S = 60;

// Czy bieżąca sesja powstała z linku resetu hasła w ciągu ostatnich 15 minut?
// Źródłem jest podpisany przez Supabase JWT: po verifyOtp({ type: "recovery" }) claim `amr` zawiera
// wpis { method: "recovery", timestamp }. Zwykłe logowanie go nie ma, a JWT nie da się podrobić
// (getClaims weryfikuje podpis i ważność), więc sama zalogowana sesja nie wystarczy do zmiany hasła.
export async function sesjaZLinkuResetu(
  supabase: { auth: Pick<SupabaseClient["auth"], "getClaims"> },
  teraz: number = Date.now(),
): Promise<boolean> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return false;

  const terazS = teraz / 1000;
  const amr = data.claims.amr ?? [];
  return amr.some(
    (wpis) =>
      // Format tekstowy (RFC 8176) nie ma znacznika czasu — nie da się sprawdzić świeżości
      typeof wpis === "object" &&
      wpis.method === "recovery" &&
      terazS - wpis.timestamp <= OKNO_RESETU_S &&
      wpis.timestamp - terazS <= TOLERANCJA_ZEGARA_S,
  );
}
