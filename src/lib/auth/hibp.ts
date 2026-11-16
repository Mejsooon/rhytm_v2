// Sprawdzenie hasła w Have I Been Pwned (k-anonimowość: do API trafia tylko 5 znaków skrótu).
// Moduł wyłącznie serwerowy — nie importować z komponentów klienckich.

/**
 * Zwraca true, gdy hasło występuje w wyciekach.
 * Przy błędzie sieci lub odpowiedzi nie-2xx zwraca false (fail-open) i loguje ostrzeżenie,
 * żeby awaria zewnętrznego API nie blokowała rejestracji.
 */
export async function isPasswordPwned(password: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  try {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)

    // Add-Padding: odpowiedź zawiera wpisy-wypełniacze z licznikiem 0.
    // Limit 5 s: zawieszone API nie może blokować rejestracji (przekroczenie = błąd sieci → fail-open)
    const res = await fetchFn(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.warn(`HIBP: odpowiedź ${res.status}, pomijam sprawdzenie`)
      return false
    }

    const body = await res.text()
    for (const line of body.split(/\r?\n/)) {
      const [lineSuffix, count] = line.trim().split(':')
      if (lineSuffix === suffix && Number(count) > 0) return true
    }
    return false
  } catch (error) {
    console.warn('HIBP: błąd sieci, pomijam sprawdzenie', error)
    return false
  }
}
