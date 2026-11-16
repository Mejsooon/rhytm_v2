# Etap 0: Fundament i logowanie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Działająca, wdrożona aplikacja rhytm z kontem: rejestracja, logowanie (e-mail i Google), potwierdzenie e-maila, reset hasła, wylogowanie, sidebar z modułami (puste ekrany) i strona 404. Wygląd identyczny z makietami.

**Architecture:**
- Next.js 16 App Router z grupami tras `(auth)` i `(app)`.
- Supabase Auth przez `@supabase/ssr`: sesja w ciasteczkach, odświeżana w `src/proxy.ts`.
- Czysta logika w małych modułach TS z testami Vitest; formularze jako Server Actions.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Supabase (Postgres, Auth, CLI), zod, Vitest + Testing Library, Playwright, pnpm, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-11-16-rhytm-design.md` (sekcje 2, 3, 4, 6.1, 6.3, 7). **Mapa etapów:** `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md`. **Makiety:** `docs/design/mockups/` (Login, Register, Forgot, EmailConfirmed, NotFound, Sidebar).

## Global Constraints
- **Next.js:** Next.js 16 — przed użyciem API (proxy, cookies, Server Actions, metadata/manifest) przeczytaj odpowiedni plik w `node_modules/next/dist/docs/`; nie zakładaj API z Next 14/15.
- **UI:**
  - shadcn/ui w odmianie **Radix**; komponenty w `src/components/ui`,
  - tylko jasny motyw,
  - tokeny dokładnie jak w spec 3.1 (`#ffffff`, `#fafafa`, `#f5f5f5`, `#f0f0f0`, `#eaeaea`, `#e0e0e0`, `#f0f0f0`, `#171717`, `#666666`, `#6b6b6b`, `#15803d`, `#b91c1c`),
  - promienie 6 / 8 / 12 px, czcionki Geist i Geist Mono (pakiet `geist`).
- **Teksty:**
  - interfejs po polsku, teksty przepisane **dosłownie** z makiet,
  - błąd logowania zawsze „Nieprawidłowy e-mail lub hasło”,
  - komunikaty resetu i rejestracji nie zdradzają, czy e-mail ma konto.
- **Hasło konta:** co najmniej 10 znaków, litery i cyfry, nie występuje w Have I Been Pwned.
- **Turnstile:** sprawdzany po stronie serwera przy logowaniu, rejestracji i resecie hasła.
- **Baza:** każda tabela z danymi: `user_id uuid references auth.users(id) on delete cascade` + RLS „tylko własne wiersze” po `auth.uid()`.
- **Trasy:** `/logowanie`, `/rejestracja`, `/reset-hasla`, `/nowe-haslo`, `/auth/confirm`, `/auth/callback`, `/onboarding`, `/dzis`, `/kalendarz`, `/sport`, `/nawyki`, `/ustawienia`.
- **Kod:** komentarze po polsku; bez łańcuchów drobnych funkcji pomocniczych tam, gdzie wystarczy jedna czytelna funkcja.

## Review Focus
1. **Awaria HIBP lub Turnstile** (sieć nie odpowiada, 5xx):
   - HIBP nie blokuje rejestracji — funkcja zwraca `false` i loguje ostrzeżenie (test w Task 4),
   - Turnstile blokuje — zwraca `false` (test w Task 4).
2. **Zalogowany wchodzi na `/logowanie` lub `/rejestracja`:** trafia na `/dzis` albo na `/onboarding`, jeśli nie skończył onboardingu, zamiast widzieć formularz (test w Task 8).
3. **Wygasły lub użyty link z maila:** pokazuje stan „Link wygasł” z „Wyślij nowy link”, a nie błąd 500 (test e2e w Task 11).
4. **E-mail z wielkimi literami i spacjami:**
   - `" Mejson@Example.com "` loguje to samo konto co `mejson@example.com`,
   - normalizacja `trim().toLowerCase()` w schemacie zod (test w Task 4).
5. **Podwójne kliknięcie „Utwórz konto”:** przycisk zablokowany w trakcie wysyłki (`useFormStatus`), drugi request nie wychodzi (test komponentu w Task 6).

---

### Task 1: Szkielet projektu, narzędzia testowe i CI

**Files:**
- Create: projekt z `pnpm create next-app@latest . --ts --tailwind --app --src-dir --eslint --import-alias "@/*"` (w istniejącym repo, bez nadpisywania `docs/`)
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.nvmrc` (`22`), `.env.example`
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Produces:
  - skrypty `pnpm test` (Vitest), `pnpm test:e2e` (Playwright), `pnpm typecheck` (`tsc --noEmit`), `pnpm lint`,
  - alias `@/` → `src/`.

- [ ] **Step 1: Wygeneruj projekt i dodaj zależności testowe:** `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test`.
- [ ] **Step 2: Napisz test dymny**

```ts
// src/lib/smoke.test.ts
import { describe, it, expect } from 'vitest'
describe('środowisko', () => {
  it('działa', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 3: Uruchom `pnpm test`.** Oczekiwane: 1 passed. Uruchom `pnpm typecheck && pnpm lint`. Oczekiwane: bez błędów.
- [ ] **Step 4: Dodaj CI.** Workflow na push/PR: pnpm install → lint → typecheck → test. Kroki `supabase db test` i e2e dochodzą w Task 3 i 11.
- [ ] **Step 5: Commit** `chore: szkielet Next.js 16 z Vitest, Playwright i CI`

### Task 2: Tokeny, czcionki, shadcn/ui (Radix) i logo

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `components.json` (shadcn, style Radix), `src/components/ui/*`, `src/components/brand/rhytm-logo.tsx`
- Test: `src/app/tokens.test.ts`, `src/components/brand/rhytm-logo.test.tsx`

**Interfaces:**
- Produces:
  - zmienne CSS: `--background`, `--panel`, `--hover`, `--active`, `--border`, `--border-strong`, `--border-soft`, `--foreground`, `--muted-foreground`, `--meta`, `--accent-brand`, `--destructive`; klasy Tailwind z `@theme`: `bg-panel`, `border-strong`, `text-meta` itd.,
  - `RhytmLogo({ size?: number = 24, withWordmark?: boolean = false }): JSX.Element`,
  - komponenty shadcn: `button input label checkbox dialog popover dropdown-menu tooltip separator sonner`.

- [ ] **Step 1: Napisz test tokenów** — parsuje `globals.css` i sprawdza wartości.

```ts
// src/app/tokens.test.ts
import { readFileSync } from 'node:fs'
import { it, expect } from 'vitest'
const css = readFileSync('src/app/globals.css', 'utf8')
it.each([
  ['--background', '#ffffff'], ['--panel', '#fafafa'], ['--hover', '#f5f5f5'], ['--active', '#f0f0f0'],
  ['--border', '#eaeaea'], ['--border-strong', '#e0e0e0'], ['--border-soft', '#f0f0f0'],
  ['--foreground', '#171717'], ['--muted-foreground', '#666666'], ['--meta', '#6b6b6b'],
  ['--accent-brand', '#15803d'], ['--destructive', '#b91c1c'],
])('token %s = %s', (name, value) => {
  expect(css).toMatch(new RegExp(`${name}:\\s*${value}`, 'i'))
})
```

- [ ] **Step 2: Napisz test logo**

```tsx
// src/components/brand/rhytm-logo.test.tsx
it('rysuje 9 kwadratów, jeden zielony', () => {
  const { container } = render(<RhytmLogo />)
  const rects = container.querySelectorAll('rect')
  expect(rects).toHaveLength(9)
  expect([...rects].filter(r => r.getAttribute('fill') === '#15803d')).toHaveLength(1)
})
it('z wordmarkiem pokazuje „rhytm”', () => {
  render(<RhytmLogo withWordmark />)
  expect(screen.getByText('rhytm')).toBeInTheDocument()
})
```

- [ ] **Step 3: Uruchom testy.** Oczekiwane: FAIL (brak tokenów i komponentu).
- [ ] **Step 4: Zainicjuj shadcn i ustaw motyw.**
  - Uruchom `pnpm dlx shadcn@latest init` w odmianie Radix i dodaj komponenty z Interfaces.
  - W `globals.css` ustaw tokeny ze spec 3.1 i zmapuj zmienne shadcn: `--primary` = `#171717`, `--primary-foreground` = `#ffffff`, `--radius` = `0.375rem`.
  - Usuń blok `.dark`.
  - W `layout.tsx` podepnij `GeistSans` i `GeistMono` z pakietu `geist`, ustaw `<html lang="pl">` i bazowo 14 px.
- [ ] **Step 5: Zaimplementuj `RhytmLogo`.**
  - SVG `viewBox="0 0 48 48"`, kwadraty 11×11, `rx=3`, pozycje 4/18/32.
  - Krycia w kolejności wierszy: `1, .55, .25 / .55, .25, accent / .25, 1, .55`. Kolor `#171717`, akcent `#15803d`.
  - Wordmark: Geist 600, `letter-spacing: -0.045em`. Wzór: nagłówek `Login.dc.html`.
- [ ] **Step 6: Uruchom testy.** Oczekiwane: PASS.
- [ ] **Step 7: Commit** `feat: tokeny rhytm, Geist, shadcn (Radix) i logo`

### Task 3: Supabase — klienci, tabela `profiles`, RLS

**Files:**
- Create:
  - `supabase/config.toml` (`supabase init`),
  - `supabase/migrations/20261116000001_profiles.sql`, `supabase/tests/profiles_rls.test.sql`,
  - `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/proxy-session.ts`,
  - `src/types/database.ts` (z `supabase gen types typescript --local`).
- Modify: `.github/workflows/ci.yml` (job z `supabase start` + `supabase test db`), `.env.example`

**Interfaces:**
- Produces:
  - `createClient(): Promise<SupabaseClient<Database>>` w `server.ts` (używa `cookies()` z `next/headers`),
  - `createClient(): SupabaseClient<Database>` w `client.ts`,
  - `updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }>` w `proxy-session.ts`,
  - tabela `public.profiles` z kolumnami ze spec 5 (wszystkie oprócz `user_id` mogą być NULL; `timezone` DEFAULT `'Europe/Warsaw'`, `week_start` DEFAULT `'mon'`, `clock` DEFAULT `'24'`, `sleep_goal_min` DEFAULT 480, `currency` DEFAULT `'PLN'`),
  - trigger `on_auth_user_created`, który wstawia profil z `display_name` = `raw_user_meta_data->>'display_name'` albo `->>'full_name'` (Google).
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (tylko serwer).

- [ ] **Step 1: Napisz test RLS (pgTAP)**

```sql
-- supabase/tests/profiles_rls.test.sql
begin; select plan(4);
-- dwóch użytkowników przez auth.users; trigger tworzy profile
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','a@test.pl','{"display_name":"A"}'),
 ('00000000-0000-0000-0000-00000000000b','b@test.pl','{"full_name":"B G"}');
select is((select display_name from profiles where user_id='00000000-0000-0000-0000-00000000000b'), 'B G', 'trigger bierze full_name z Google');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select is((select count(*) from profiles)::int, 1, 'A widzi tylko swój profil');
update profiles set display_name='X' where user_id='00000000-0000-0000-0000-00000000000b';
reset role;
select is((select display_name from profiles where user_id='00000000-0000-0000-0000-00000000000b'), 'B G', 'A nie zmieni profilu B');
select is((select timezone from profiles where user_id='00000000-0000-0000-0000-00000000000a'), 'Europe/Warsaw', 'domyślna strefa');
select * from finish(); rollback;
```

- [ ] **Step 2: Uruchom** `supabase start && supabase test db`. Oczekiwane: FAIL (brak tabeli).
- [ ] **Step 3: Napisz migrację.**
  - Tabela, RLS włączone, polityki `select` i `update` z warunkiem `user_id = auth.uid()`, bez polityki `insert` i `delete`; wstawia tylko trigger `security definer`.
  - Funkcja `handle_new_user()` z `set search_path = ''`.
- [ ] **Step 4: Uruchom** `supabase test db`. Oczekiwane: 4/4 ok. Wygeneruj `src/types/database.ts`.
- [ ] **Step 5: Zaimplementuj trzech klientów** wg dokumentacji `@supabase/ssr` dla Next.js App Router (`getAll`/`setAll` ciasteczek). `updateSession` woła `supabase.auth.getUser()` i zwraca użytkownika.
- [ ] **Step 6: Commit** `feat: Supabase, tabela profiles z RLS i klienci SSR`

### Task 4: Czysta logika konta — reguły hasła, HIBP, Turnstile, schematy

**Files:**
- Create: `src/lib/auth/password-rules.ts`, `src/lib/auth/hibp.ts`, `src/lib/auth/turnstile.ts`, `src/lib/auth/schemas.ts`
- Test: `src/lib/auth/password-rules.test.ts`, `src/lib/auth/hibp.test.ts`, `src/lib/auth/turnstile.test.ts`, `src/lib/auth/schemas.test.ts`

**Interfaces:**
- Produces:
  - `PASSWORD_MIN_LENGTH = 10`,
  - `checkPasswordRules(password: string): { minLength: boolean; lettersAndDigits: boolean }`,
  - `passwordStrength(password: string, notLeaked: boolean): 0 | 1 | 2 | 3 | 4` — liczba spełnionych reguł (minLength, lettersAndDigits, notLeaked) + 1, jeśli długość ≥ 14; pusty string = 0. To wzór z `Register.dc.html`.
  - `isPasswordPwned(password: string, fetchFn?: typeof fetch): Promise<boolean>`,
  - `verifyTurnstile(token: string | null | undefined, ip?: string, fetchFn?: typeof fetch): Promise<boolean>`,
  - `signInSchema`, `signUpSchema` (`displayName` 1–60 znaków po `trim`, `email`, `password`), `resetRequestSchema`, `newPasswordSchema` (`password` + `confirm`, muszą być równe). Wszystkie e-maile normalizowane `trim().toLowerCase()`.

- [ ] **Step 1: Napisz testy**

```ts
// password-rules.test.ts
expect(checkPasswordRules('abc123')).toEqual({ minLength: false, lettersAndDigits: true })
expect(checkPasswordRules('abcdefghijk')).toEqual({ minLength: true, lettersAndDigits: false })
expect(passwordStrength('', true)).toBe(0)
expect(passwordStrength('rytmtygodnia2026x', true)).toBe(4)
expect(passwordStrength('rytm2026ab', false)).toBe(2)

// hibp.test.ts — SHA-1('password123') = CBFDAC6008F9CAB4083784CBD1874F76618D2A97
const fetchFn = vi.fn().mockResolvedValue(new Response('8F9CAB4083784CBD1874F76618D2A97:2500\r\n0000000000000000000000000000000000A:0'))
expect(await isPasswordPwned('password123', fetchFn)).toBe(true)
expect(fetchFn).toHaveBeenCalledWith('https://api.pwnedpasswords.com/range/CBFDA', expect.objectContaining({ headers: { 'Add-Padding': 'true' } }))
expect(await isPasswordPwned('x', vi.fn().mockRejectedValue(new Error('offline')))).toBe(false) // Review Focus 1
// wiersze z licznikiem 0 (padding) nie oznaczają wycieku
expect(await isPasswordPwned('password123', vi.fn().mockResolvedValue(new Response('8F9CAB4083784CBD1874F76618D2A97:0')))).toBe(false)

// turnstile.test.ts
expect(await verifyTurnstile(null)).toBe(false)
const ok = vi.fn().mockResolvedValue(Response.json({ success: true }))
expect(await verifyTurnstile('tok', '1.2.3.4', ok)).toBe(true)
expect(ok).toHaveBeenCalledWith('https://challenges.cloudflare.com/turnstile/v0/siteverify', expect.objectContaining({ method: 'POST' }))
expect(await verifyTurnstile('tok', undefined, vi.fn().mockRejectedValue(new Error()))).toBe(false) // Review Focus 1

// schemas.test.ts — Review Focus 4
expect(signInSchema.parse({ email: ' Mejson@Example.com ', password: 'x' }).email).toBe('mejson@example.com')
expect(newPasswordSchema.safeParse({ password: 'rytm2026abc', confirm: 'inne2026abc' }).success).toBe(false)
```

- [ ] **Step 2: Uruchom** `pnpm test src/lib/auth`. Oczekiwane: FAIL.
- [ ] **Step 3: Zaimplementuj cztery moduły.**
  - SHA-1 przez `crypto.subtle.digest`.
  - Turnstile czyta sekret z `TURNSTILE_SECRET_KEY`, body `URLSearchParams({ secret, response, remoteip })`.
  - Komunikaty zod po polsku: „Podaj poprawny e-mail”, „Hasła nie są takie same”.
- [ ] **Step 4: Uruchom testy.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat: reguły hasła, HIBP, Turnstile i schematy formularzy`

### Task 5: Układ ekranów konta i Logowanie (e-mail + Google)

**Files:**
- Create:
  - `src/components/auth/auth-shell.tsx`, `src/components/auth/google-button.tsx`, `src/components/auth/turnstile-widget.tsx`, `src/components/auth/password-input.tsx`,
  - `src/app/(auth)/logowanie/page.tsx`, `src/features/auth/actions.ts`, `src/app/auth/callback/route.ts`, `src/lib/auth/next-path.ts`.
- Test: `src/lib/auth/next-path.test.ts`, `src/features/auth/login-form.test.tsx`

**Interfaces:**
- Consumes: `createClient` (Task 3), `signInSchema`, `verifyTurnstile` (Task 4), `RhytmLogo` (Task 2).
- Produces:
  - `type AuthFormState = { status: 'idle' | 'error' | 'success'; message?: string; fieldErrors?: Partial<Record<string, string>> }`,
  - `signIn(prev: AuthFormState, formData: FormData): Promise<AuthFormState>` (po sukcesie `redirect(pathAfterLogin(profile))`),
  - `signInWithGoogle(): Promise<never>` — `signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/auth/callback } })` + `redirect(data.url)`,
  - `pathAfterLogin(profile: { onboarded_at: string | null } | null): '/dzis' | '/onboarding'`,
  - `AuthShell({ headerAction: { href: string; label: string }, children })`:
    - tło `#fafafa` z siatką 48 px (linie `#eeeeee`), nagłówek z `RhytmLogo withWordmark` (26 px),
    - karta: 380 px (rejestracja 400 px), `rounded-xl`, ramka `#eaeaea`, cień ze spec 3.1, `p-7`, `gap-4`.

- [ ] **Step 1: Napisz testy**

```ts
expect(pathAfterLogin(null)).toBe('/onboarding')
expect(pathAfterLogin({ onboarded_at: null })).toBe('/onboarding')
expect(pathAfterLogin({ onboarded_at: '2026-11-16T10:00:00Z' })).toBe('/dzis')
```

```tsx
// login-form.test.tsx — renderuje formularz z mockiem akcji zwracającej błąd
// oczekuj: przycisk „Zaloguj się przez Google”, separator „lub e-mailem”, link „Nie pamiętasz hasła?” → /reset-hasla,
// po błędzie tekst „Nieprawidłowy e-mail lub hasło”; klik „Pokaż hasło” zmienia type pola na text
```

- [ ] **Step 2: Uruchom testy.** Oczekiwane: FAIL.
- [ ] **Step 3: Zbuduj ekran 1:1 z `Login.dc.html`.**
  - Kolejność: tytuł „Zaloguj się do rhytm”, opis, Google, separator, E-mail, Hasło (z linkiem i przyciskiem oka), Turnstile, „Zaloguj się”, „Nie masz konta? Zarejestruj się”.
  - Turnstile przez `@marsidev/react-turnstile` (site key `NEXT_PUBLIC_TURNSTILE_SITE_KEY`), wygląd „compact/light”.
  - `signIn`: zod → Turnstile → `signInWithPassword`. Każdy błąd auth daje „Nieprawidłowy e-mail lub hasło”, błąd Turnstile daje „Potwierdź, że nie jesteś botem”.
- [ ] **Step 4: Callback OAuth.** `GET /auth/callback?code=…`: `exchangeCodeForSession(code)`, odczyt profilu, redirect `pathAfterLogin`. Błąd daje redirect `/logowanie?blad=oauth` z komunikatem „Nie udało się zalogować przez Google”.
- [ ] **Step 5: Uruchom testy.** Oczekiwane: PASS.
- [ ] **Step 6: Commit** `feat: ekran logowania z Google i Turnstile`

### Task 6: Rejestracja i „Sprawdź skrzynkę”

**Files:**
- Create: `src/app/(auth)/rejestracja/page.tsx`, `src/features/auth/register-form.tsx`, `src/features/auth/check-inbox.tsx`
- Modify: `src/features/auth/actions.ts`
- Test: `src/features/auth/register-form.test.tsx`

**Interfaces:**
- Consumes: `checkPasswordRules`, `passwordStrength`, `isPasswordPwned`, `signUpSchema`, `verifyTurnstile`, `AuthShell`, `GoogleButton`.
- Produces:
  - `signUp(prev: AuthFormState, formData: FormData): Promise<AuthFormState>`. `success` przełącza widok na „Sprawdź skrzynkę”.
  - `checkPasswordLeak(password: string): Promise<boolean>` — akcja serwera do reguły na żywo, z debounce 400 ms po stronie klienta.
  - `resendConfirmation(email: string): Promise<AuthFormState>`.

- [ ] **Step 1: Napisz test komponentu**
  - wpisanie `rytm2026` zostawia „co najmniej 10 znaków” jako `○`, a „litery i cyfry” daje `✓`,
  - `checkPasswordLeak` zamockowany na `true` daje „nie ma go w bazie wycieków” jako `○` i blokuje submit,
  - pasek siły ma 4 segmenty; po `rytmtygodnia2026x` wszystkie są `#15803d`,
  - Review Focus 5: po kliknięciu „Utwórz konto” przycisk ma `disabled` do czasu odpowiedzi akcji, a akcja jest wywołana 1 raz przy dwóch kliknięciach.
- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL.
- [ ] **Step 3: Zbuduj ekran 1:1 z `Register.dc.html`.**
  - Formularz: Google „Kontynuuj z Google”, separator, Nazwa, E-mail, Hasło z paskiem siły i trzema regułami (`○`/`✓`, kolor `#6b6b6b`/`#15803d`), Turnstile, „Utwórz konto”, link do logowania.
  - Akcja: zod → Turnstile → `isPasswordPwned` → `supabase.auth.signUp({ email, password, options: { data: { display_name }, emailRedirectTo: <origin>/auth/confirm } })`.
  - Sukces i „użytkownik już istnieje” dają **ten sam** stan sukcesu.
  - Stan „Sprawdź skrzynkę” z tekstem z makiety i przyciskiem „Wyślij ponownie” z odliczaniem 60 s (`0:58` w makiecie).
- [ ] **Step 4: Uruchom.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat: rejestracja z regułami hasła i sprawdzaniem wycieków`

### Task 7: Potwierdzenie e-maila i reset hasła (3 kroki)

**Files:**
- Create:
  - `src/app/auth/confirm/route.ts`, `src/app/(auth)/potwierdzono/page.tsx`, `src/app/(auth)/link-wygasl/page.tsx`,
  - `src/app/(auth)/reset-hasla/page.tsx`, `src/app/(auth)/nowe-haslo/page.tsx`.
- Modify: `src/features/auth/actions.ts`, `supabase/config.toml` (szablony maili: link do `/auth/confirm?token_hash={{ .TokenHash }}&type=…`)
- Test: `src/app/auth/confirm/route.test.ts`

**Interfaces:**
- Produces:
  - `GET /auth/confirm?token_hash&type`: `verifyOtp`; `signup|email` → `/potwierdzono`, `recovery` → `/nowe-haslo`; błąd → `/link-wygasl?type=…`,
  - `requestPasswordReset(prev, formData): Promise<AuthFormState>` (zawsze ten sam sukces),
  - `updatePassword(prev, formData): Promise<AuthFormState>` (`updateUser({ password })`, potem `signOut({ scope: 'others' })`, redirect `/dzis`),
  - `resendLink(type: 'signup' | 'recovery', email: string)`.

- [ ] **Step 1: Napisz test route handlera** z mockiem `createClient`:
  - sukces `signup` daje 307 na `/potwierdzono`, sukces `recovery` na `/nowe-haslo`,
  - błąd `verifyOtp` daje `/link-wygasl?type=signup`.
- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL. Zaimplementuj.
- [ ] **Step 3: Zbuduj ekrany 1:1.**
  - `EmailConfirmed.dc.html` (oba stany): „E-mail potwierdzony” + Dalej → `/onboarding`; „Link wygasł” + pole e-mail i „Wyślij nowy link”.
  - `Forgot.dc.html`: znacznik „krok N / 3”, teksty kroków dosłownie, krok 3 z regułami hasła z Task 4 i notką o sejfie.
- [ ] **Step 4: Uruchom testy.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat: potwierdzenie e-maila i reset hasła`

### Task 8: Proxy — sesja i przekierowania

**Files:**
- Create: `src/proxy.ts`, `src/lib/auth/route-guard.ts`
- Test: `src/lib/auth/route-guard.test.ts`

**Interfaces:**
- Consumes: `updateSession` (Task 3).
- Produces: `resolveRoute(input: { pathname: string; isLoggedIn: boolean; isOnboarded: boolean }): { redirect: string } | null`.
  - Publiczne: `/logowanie`, `/rejestracja`, `/reset-hasla`, `/nowe-haslo`, `/potwierdzono`, `/link-wygasl`, `/auth/*`.
  - Zawsze przepuszczane: `/manifest.webmanifest`, `/icons/*`, `/_next/*`.
  - `/onboarding` wymaga zalogowania.

- [ ] **Step 1: Napisz testy**

```ts
expect(resolveRoute({ pathname: '/dzis', isLoggedIn: false, isOnboarded: false })).toEqual({ redirect: '/logowanie' })
expect(resolveRoute({ pathname: '/logowanie', isLoggedIn: true, isOnboarded: true })).toEqual({ redirect: '/dzis' })       // Review Focus 2
expect(resolveRoute({ pathname: '/rejestracja', isLoggedIn: true, isOnboarded: false })).toEqual({ redirect: '/onboarding' })
expect(resolveRoute({ pathname: '/kalendarz', isLoggedIn: true, isOnboarded: false })).toEqual({ redirect: '/onboarding' })
expect(resolveRoute({ pathname: '/onboarding', isLoggedIn: true, isOnboarded: true })).toEqual({ redirect: '/dzis' })
expect(resolveRoute({ pathname: '/nowe-haslo', isLoggedIn: true, isOnboarded: true })).toBeNull()  // po linku recovery
expect(resolveRoute({ pathname: '/auth/confirm', isLoggedIn: false, isOnboarded: false })).toBeNull()
expect(resolveRoute({ pathname: '/', isLoggedIn: true, isOnboarded: true })).toEqual({ redirect: '/dzis' })
```

- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL. Zaimplementuj `resolveRoute`.
- [ ] **Step 3: Podłącz proxy.**
  - `src/proxy.ts` (nazwę pliku, eksport i `config.matcher` potwierdź w dokumentacji Next 16) woła `updateSession`.
  - Dla zalogowanego czyta `profiles.onboarded_at` jednym zapytaniem `select('onboarded_at')`.
  - Stosuje `resolveRoute` i zwraca odpowiedź z ciasteczkami z `updateSession`.
- [ ] **Step 4: Tymczasowy onboarding.** Dodaj `src/app/(onboarding)/onboarding/page.tsx` z tekstem „Onboarding — etap 1” i przyciskiem „Dalej”, który ustawia `onboarded_at = now()`. Etap 1 zastąpi go 7 krokami.
- [ ] **Step 5: Uruchom testy.** Oczekiwane: PASS.
- [ ] **Step 6: Commit** `feat: proxy z sesją Supabase i przekierowaniami`

### Task 9: Powłoka aplikacji — sidebar, menu użytkownika, puste moduły, 404

**Files:**
- Create:
  - `src/app/(app)/layout.tsx`, `src/components/shell/app-sidebar.tsx`, `src/components/shell/user-menu.tsx`, `src/components/shell/nav-items.ts`,
  - `src/app/(app)/{dzis,kalendarz,sport,nawyki,ustawienia}/page.tsx`, `src/app/not-found.tsx`.
- Modify: `src/features/auth/actions.ts` (`signOut`)
- Test: `src/components/shell/app-sidebar.test.tsx`

**Interfaces:**
- Consumes: `createClient`, `RhytmLogo`.
- Produces:
  - `NAV_MODULES: { key: 'dzis' | 'kalendarz' | 'sport' | 'nawyki'; label: string; href: string; icon: LucideIcon }[]` (Dziś `Sun`, Kalendarz `Calendar`, Sport `Activity`, Nawyki i sen `SquareCheck`),
  - `AppSidebar({ user: { displayName: string; email: string; avatarUrl: string | null } })` — aktywna pozycja z `usePathname()`,
  - `signOut(): Promise<never>` (redirect `/logowanie`).
  - Etapy 6+ dopiszą do sidebaru sekcję stron przez prop `pages`. W tym etapie lista jest pusta i widać tylko „+ Nowa strona” (nieaktywne, z tooltipem „Wkrótce”).

- [ ] **Step 1: Napisz test sidebaru**
  - renderuje „Szukaj…” z keycapem „⌘K”, sekcje „Moduły” i „Strony”, 4 moduły, „Ustawienia”, inicjały „M” dla `Mejson`,
  - na `/kalendarz` element „Kalendarz” ma `aria-current="page"`,
  - menu użytkownika zawiera „Ustawienia” i „Wyloguj”.
- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL.
- [ ] **Step 3: Zbuduj sidebar 1:1 z `Sidebar.dc.html`.**
  - Szerokość 232 px, tło `#fafafa`, prawa ramka `#eaeaea`, `padding 12px 10px`.
  - Pozycje `gap 10px`, `padding 7px 8px`, `rounded-md`; aktywna `#f0f0f0` / `#171717` / 500, pozostałe `#666666`.
  - Etykiety sekcji: Geist Mono 11 px, uppercase, `.06em`, `#6b6b6b`.
  - Na dole blok użytkownika z inicjałami i e-mailem.
  - Układ `(app)`: sidebar + `<main>` na pełną wysokość okna (sidebar sięga do dołu).
  - Moduły jako puste strony z nagłówkiem „Moduły / X” (Geist Mono 13 px), wg nagłówków makiet.
- [ ] **Step 4: 404 1:1 z `NotFound.dc.html`.**
  - Sidebar, ścieżka „rhytm / 404”, duże „404”, „Tej strony nie ma”, tekst o koszu.
  - Przyciski „Wróć do Dziś” i „Szukaj ⌘K”; w etapie 0 „Szukaj” jest nieaktywny.
- [ ] **Step 5: Uruchom testy.** Oczekiwane: PASS.
- [ ] **Step 6: Commit** `feat: powłoka aplikacji z sidebarem, menu konta i 404`

### Task 10: PWA — manifest i ikony

**Files:**
- Create: `src/app/manifest.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png` (logo 3×3 na białym tle), `scripts/make-icons.mjs` (generuje PNG z SVG logo przez `sharp`)
- Test: `src/app/manifest.test.ts`

**Interfaces:**
- Produces: `manifest(): MetadataRoute.Manifest` z `name: 'rhytm'`, `short_name: 'rhytm'`, `lang: 'pl'`, `start_url: '/dzis'`, `display: 'standalone'`, `background_color: '#ffffff'`, `theme_color: '#ffffff'` i trzema ikonami (maskable z `purpose: 'maskable'`).

- [ ] **Step 1: Napisz test** — wywołaj `manifest()` i sprawdź pola z Interfaces oraz 3 ikony.
- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL. Zaimplementuj i wygeneruj ikony.
- [ ] **Step 3: Uruchom.** Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat: manifest PWA i ikony`

### Task 11: Testy e2e, zrzuty względem makiet, wdrożenie

**Files:**
- Create:
  - `e2e/auth.spec.ts`, `e2e/visual.spec.ts`, `e2e/helpers/mailpit.ts`,
  - `docs/setup.md` (instrukcja dla Mejsona: projekt Supabase, dostawca Google w Supabase i Google Cloud, SMTP Resend, klucze Turnstile, zmienne w Vercel, URL przekierowań).
- Modify: `.github/workflows/ci.yml` (job e2e: `supabase start`, `pnpm build && pnpm start`, Playwright)

**Interfaces:**
- Consumes: wszystko powyżej; lokalny Mailpit z `supabase start` (`http://127.0.0.1:54324`).
- Produces: `latestLinkFor(email: string): Promise<string>` w `e2e/helpers/mailpit.ts`. W testach Turnstile używa testowych kluczy Cloudflare (`1x00000000000000000000AA`, sekret `1x0000000000000000000000000000000AA`).

- [ ] **Step 1: Napisz testy e2e**
  - rejestracja → mail w Mailpit → link → „E-mail potwierdzony” → Dalej → tymczasowy onboarding → `/dzis` z sidebarem,
  - wylogowanie → `/logowanie`, ponowne logowanie e-mailem z wielkimi literami (Review Focus 4),
  - złe hasło → „Nieprawidłowy e-mail lub hasło”,
  - reset: e-mail → link → nowe hasło → `/dzis`,
  - Review Focus 3: drugi raz ten sam link potwierdzający → „Link wygasł”,
  - nieistniejąca trasa `/xyz` po zalogowaniu → „Tej strony nie ma”.
- [ ] **Step 2: Napisz test zrzutów.**
  - Viewport 1440×900, ekrany `/logowanie`, `/rejestracja`, `/reset-hasla`, `/link-wygasl`, 404.
  - Zapisuje zrzuty aplikacji i odpowiadające im makiety (`docs/design/mockups/*.dc.html` serwowane statycznie) do `test-results/visual/`, żeby porównać je ręcznie.
  - Test pada tylko, gdy strona się nie renderuje.
- [ ] **Step 3: Uruchom** `pnpm test:e2e`. Oczekiwane: wszystkie PASS. Obejrzyj pary zrzutów i popraw różnice wyglądu.
- [ ] **Step 4: Wdrożenie.**
  - Mejson wykonuje kroki z `docs/setup.md`: nowy projekt Supabase i Vercel, Google, SMTP, Turnstile.
  - `supabase db push` na projekt w chmurze; podpięcie repo w Vercel.
  - Ręczna próba na produkcji: rejestracja, Google, reset.
- [ ] **Step 5: Commit** `test: e2e konta i zrzuty względem makiet; docs: instrukcja wdrożenia`
