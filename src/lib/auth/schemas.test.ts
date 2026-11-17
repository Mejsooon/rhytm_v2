import { describe, expect, it } from 'vitest'
import { newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema } from './schemas'

describe('schematy formularzy', () => {
  it('signIn normalizuje e-mail', () => {
    expect(signInSchema.parse({ email: ' Mejson@Example.com ', password: 'x' }).email).toBe('mejson@example.com')
  })
  it('signIn odrzuca niepoprawny e-mail z komunikatem', () => {
    const r = signInSchema.safeParse({ email: 'nie-email', password: 'x' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Podaj poprawny e-mail')
  })
  it('resetRequest normalizuje e-mail', () => {
    expect(resetRequestSchema.parse({ email: ' A@B.PL ' }).email).toBe('a@b.pl')
  })
  it('newPassword wymaga równych haseł', () => {
    const r = newPasswordSchema.safeParse({ password: 'rytm2026abc', confirm: 'inne2026abc' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Hasła nie są takie same')
    expect(newPasswordSchema.safeParse({ password: 'rytm2026abc', confirm: 'rytm2026abc' }).success).toBe(true)
  })
  it('signUp wymaga tos', () => {
    const r = signUpSchema.safeParse({ displayName: 'M', email: 'm@x.pl', password: 'rytm2026abc' })
    expect(r.success).toBe(false)
    expect(signUpSchema.safeParse({ displayName: 'M', email: 'm@x.pl', password: 'rytm2026abc', tos: 'on' }).success).toBe(true)
  })
  it('signUp: komunikat regulaminu', () => {
    const r = signUpSchema.safeParse({ displayName: 'M', email: 'm@x.pl', password: 'rytm2026abc', tos: 'off' })
    expect(r.error?.issues.find((i) => i.path[0] === 'tos')?.message).toBe('Zaakceptuj regulamin')
  })
  it('signUp: displayName 1–40 po trim', () => {
    const base = { email: 'm@x.pl', password: 'rytm2026abc', tos: 'on' }
    expect(signUpSchema.safeParse({ ...base, displayName: '   ' }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...base, displayName: 'a'.repeat(41) }).success).toBe(false)
    expect(signUpSchema.parse({ ...base, displayName: ' Mejson ' }).displayName).toBe('Mejson')
  })
})
