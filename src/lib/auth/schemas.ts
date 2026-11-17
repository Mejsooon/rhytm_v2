import { z } from 'zod'
import { PASSWORD_MIN_LENGTH, checkPasswordRules } from './password-rules'

// E-mail zawsze przycinany i zapisywany małymi literami
const email = z.string().trim().toLowerCase().pipe(z.email('Podaj poprawny e-mail'))

// Hasło nowego konta: min. 10 znaków, litery i cyfry (sprawdzenie HIBP robi serwer osobno)
const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków`)
  .refine((p) => checkPasswordRules(p).lettersAndDigits, 'Hasło musi zawierać litery i cyfry')

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Podaj hasło'),
})

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Podaj imię').max(40, 'Imię może mieć maksymalnie 40 znaków'),
  email,
  password: newPassword,
  // Checkbox z formularza przesyła 'on' tylko po zaznaczeniu
  tos: z.literal('on', { error: 'Zaakceptuj regulamin' }),
})

export const resetRequestSchema = z.object({ email })

export const newPasswordSchema = z
  .object({
    password: newPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Hasła nie są takie same' })

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type ResetRequestInput = z.infer<typeof resetRequestSchema>
export type NewPasswordInput = z.infer<typeof newPasswordSchema>
