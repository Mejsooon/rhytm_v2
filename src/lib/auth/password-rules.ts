// Czysta logika reguł hasła — współdzielona przez formularze (klient) i serwer.

export const PASSWORD_MIN_LENGTH = 10

/** Sprawdza reguły hasła, które da się ocenić lokalnie (bez sieci). */
export function checkPasswordRules(password: string): { minLength: boolean; lettersAndDigits: boolean } {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    lettersAndDigits: /\p{L}/u.test(password) && /\d/.test(password),
  }
}

/**
 * Siła hasła 0–4 (wzór z Register.dc.html / MRegister.dc.html):
 * liczba spełnionych reguł (długość, litery+cyfry, brak w wyciekach)
 * plus 1 punkt za długość ≥ 14. Pusty string = 0.
 */
export function passwordStrength(password: string, notLeaked: boolean): 0 | 1 | 2 | 3 | 4 {
  if (password === '') return 0
  const rules = checkPasswordRules(password)
  let score = 0
  if (rules.minLength) score += 1
  if (rules.lettersAndDigits) score += 1
  if (notLeaked) score += 1
  if (password.length >= 14) score += 1
  return score as 0 | 1 | 2 | 3 | 4
}
