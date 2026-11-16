// Weryfikacja tokenu Cloudflare Turnstile po stronie serwera.
// Moduł wyłącznie serwerowy — nie importować z komponentów klienckich.

/** Zwraca true tylko, gdy Cloudflare potwierdzi token. Każdy błąd = false (fail-closed). */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  if (!token) return false

  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.warn('Turnstile: brak TURNSTILE_SECRET_KEY')
    return false
  }

  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)

  try {
    const res = await fetchFn('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (error) {
    console.warn('Turnstile: błąd weryfikacji', error)
    return false
  }
}
