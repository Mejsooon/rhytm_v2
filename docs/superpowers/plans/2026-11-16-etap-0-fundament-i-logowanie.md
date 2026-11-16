# Etap 0: Fundament, kontrolki i logowanie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wdrożona aplikacja rhytm z kontem (rejestracja, logowanie e-mail i Google, potwierdzenie e-maila, reset hasła, wylogowanie), wspólną biblioteką kontrolek ze spec 3.2, powłoką (sidebar na komputerze, dolny pasek na telefonie), 404 i PWA — wygląd identyczny z makietami w 1440 px i 390 px.

**Architecture:**
- Next.js 16 App Router z grupami tras `(auth)`, `(onboarding)`, `(app)`, `(public)`.
- Supabase Auth przez `@supabase/ssr`: sesja w ciasteczkach, odświeżana w `src/proxy.ts`.
- Czysta logika w małych modułach TS z testami Vitest; formularze jako Server Actions; kontrolki jako komponenty klienta w `src/components/controls`.
- Jedna aplikacja dla obu szerokości: układ telefonu włącza się poniżej 800 px **samym CSS** (wariant Tailwind `max-[799px]:` / `min-[800px]:`).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Supabase (Postgres, Auth, CLI, pgTAP), zod, Vitest + Testing Library, Playwright, pnpm, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-11-16-rhytm-design.md` (sekcje 2, 3, 3.1, 3.2, 4, 5 `profiles`, 6.1, 6.2 (tylko ekrany konta), 6.3, 7, 8, 9). **Mapa etapów:** `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md` (Etap 0 + „Wspólne”). **Makiety:** `docs/design/mockups/` — web: Login, Register, Forgot, EmailConfirmed, NotFound, Sidebar; telefon: MLogin, MRegister, MForgot, MTabBar; wzorce kontrolek: Settings, SettingsNotifications, Books, Projects, EmptyPage, VaultReset, MQuickAdd, MBlockSheet.

## Global Constraints
- **Next.js:** Next.js 16 — przed użyciem API (proxy, cookies, Server Actions, metadata/manifest) przeczytaj odpowiedni plik w `node_modules/next/dist/docs/`; nie zakładaj API z Next 14/15.
- **Makiety są źródłem prawdy:** każdy ekran 1:1 z odpowiadającym plikiem `.dc.html` (odstępy, rozmiary, kolory, teksty). Teksty przepisywane **dosłownie**, interfejs po polsku.
- **UI:**
  - shadcn/ui w odmianie **Radix**; komponenty w `src/components/ui`, tylko jasny motyw,
  - tokeny dokładnie jak w spec 3.1: `--background #ffffff`, `--panel #fafafa`, `--hover #f5f5f5`, `--active #f0f0f0`, `--border #eaeaea`, `--border-strong #e0e0e0`, `--border-soft #f0f0f0`, `--foreground #171717`, `--muted-foreground #666666`, `--meta #6b6b6b`, `--accent-brand #15803d`, `--destructive #b91c1c`,
  - promienie 6 / 8 / 12 px, czcionki Geist i Geist Mono (pakiet `geist`).
- **Bez natywnych kontrolek:** nigdzie `<select>`, `<input type="date">`, `<input type="time">`. Tylko komponenty z `src/components/controls` (Task 5–6).
- **Dwie szerokości:** poniżej 800 px układ telefonu z makiet `M*`, od 800 px układ web. Przełączanie wyłącznie klasami CSS (`max-[799px]:`, `min-[800px]:`), bez `matchMedia` i bez propsa `variant` — inaczej hydratacja migocze.
- **Teksty konta:**
  - błąd logowania zawsze „Nieprawidłowy e-mail lub hasło”,
  - komunikaty resetu i rejestracji nie zdradzają, czy e-mail ma konto.
- **Hasło konta:** co najmniej 10 znaków, litery i cyfry, nie występuje w Have I Been Pwned.
- **Turnstile:** sprawdzany po stronie serwera przy logowaniu, rejestracji i resecie hasła. Lokalnie i w CI testowe klucze Cloudflare: site `1x00000000000000000000AA`, sekret `1x0000000000000000000000000000000AA`.
- **Baza:** każda tabela z danymi: `user_id uuid references auth.users(id) on delete cascade` + RLS „tylko własne wiersze” po `auth.uid()`.
- **Trasy:** `/logowanie`, `/rejestracja`, `/reset-hasla`, `/nowe-haslo`, `/potwierdzono`, `/link-wygasl`, `/auth/confirm`, `/auth/callback`, `/onboarding`, `/dzis`, `/kalendarz`, `/sport`, `/nawyki`, `/strony`, `/ustawienia`, `/regulamin`, `/prywatnosc`, `/dev/kontrolki` (tylko poza produkcją).
- **Kod:** komentarze po polsku; bez łańcuchów drobnych funkcji pomocniczych tam, gdzie wystarczy jedna czytelna funkcja.
- **Git:** praca na gałęzi `feat/etap-0`, nigdy na `main`.

## Review Focus
1. **Awaria HIBP lub Turnstile** (sieć nie odpowiada, 5xx):
   - HIBP nie blokuje rejestracji — funkcja zwraca `false` i loguje ostrzeżenie (test w Task 7),
   - Turnstile blokuje — zwraca `false` (test w Task 7).
2. **Zalogowany wchodzi na `/logowanie` lub `/rejestracja`:** trafia na `/dzis` albo na `/onboarding`, jeśli nie skończył onboardingu (test w Task 11).
3. **Wygasły lub użyty link z maila:** pokazuje stan „Link wygasł” z „Wyślij nowy link”, a nie błąd 500 (test e2e w Task 14).
4. **E-mail z wielkimi literami i spacjami:** `" Mejson@Example.com "` loguje to samo konto co `mejson@example.com` (test w Task 7 i e2e w Task 14).
5. **Dymek kontrolki przy krawędzi lub w przewijanym kontenerze:** dymek listy/daty/godziny renderuje się w portalu, nie jest przycinany przez `overflow` rodzica i zamyka się Esc oraz klikiem poza (test w Task 5).

Dodatkowo (z poprzedniej wersji planu, testy zostają): podwójne kliknięcie „Utwórz konto” wysyła jeden request (Task 9).

---

### Task 1: Szkielet projektu, narzędzia testowe i CI

**Files:**
- Create: projekt z `pnpm create next-app@latest . --ts --tailwind --app --src-dir --eslint --import-alias "@/*"` (w istniejącym repo, bez nadpisywania `docs/` i `README.md`)
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.nvmrc` (`22`), `.env.example`
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Produces:
  - skrypty `pnpm test` (Vitest), `pnpm test:e2e` (Playwright), `pnpm typecheck` (`tsc --noEmit`), `pnpm lint`,
  - alias `@/` → `src/`,
  - Playwright: dwa projekty `web` (1440×900) i `mobile` (390×844, `isMobile: true`, `hasTouch: true`).

- [ ] **Step 1: Utwórz gałąź `feat/etap-0`, wygeneruj projekt i dodaj zależności testowe:** `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test`.
- [ ] **Step 2: Napisz test dymny** `src/lib/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 3: Uruchom `pnpm test`.** Oczekiwane: 1 passed. Uruchom `pnpm typecheck && pnpm lint`. Oczekiwane: bez błędów.
- [ ] **Step 4: Dodaj CI.** Workflow na push/PR: pnpm install → lint → typecheck → test. Kroki `supabase test db` i e2e dochodzą w Task 4 i 14.
- [ ] **Step 5: Commit** `chore: szkielet Next.js 16 z Vitest, Playwright i CI`

### Task 2: Tokeny, czcionki, shadcn/ui, logo i podstawowe elementy

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `components.json` (shadcn, Radix), `src/components/ui/*`, `src/components/brand/rhytm-logo.tsx`, `src/components/controls/button.tsx`, `src/components/controls/field.tsx`
- Test: `src/app/tokens.test.ts`, `src/components/brand/rhytm-logo.test.tsx`, `src/components/controls/button.test.tsx`

**Interfaces:**
- Produces:
  - zmienne CSS z Global Constraints + klasy Tailwind z `@theme`: `bg-panel`, `bg-hover`, `bg-active`, `border-strong`, `border-soft`, `text-meta`, `text-accent-brand`, `text-destructive`,
  - komponenty shadcn: `button input label dialog popover tooltip separator sonner`,
  - `RhytmLogo({ size?: number = 24, withWordmark?: boolean = false }): JSX.Element`,
  - `Button({ variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' = 'secondary', size?: 'sm' | 'md' = 'md', asChild?: boolean, ...ButtonHTMLAttributes })`,
  - `TextField({ label: string; error?: string; hint?: string; ...InputHTMLAttributes })` i `MonoLabel({ children })` (Geist Mono 11 px, uppercase, `letter-spacing .06em`, `#6b6b6b`).

- [ ] **Step 1: Napisz test tokenów** — czyta `src/app/globals.css` i dla każdej pary z Global Constraints sprawdza `new RegExp(`${name}:\\s*${value}`, 'i')`.
- [ ] **Step 2: Napisz test logo:** 9 elementów `rect`, dokładnie jeden z `fill="#15803d"`; z `withWordmark` widać tekst „rhytm”.
- [ ] **Step 3: Napisz test przycisku:** `primary` ma klasę tła `#171717` i białego tekstu; `<Button asChild variant="primary"><a href="/x">X</a></Button>` renderuje `<a>`, którego klasa hover ustawia tło `#2e2e2e` i **zachowuje** biały tekst (spec 3.2); `destructive` ma kolor `#b91c1c`.
- [ ] **Step 4: Uruchom testy.** Oczekiwane: FAIL.
- [ ] **Step 5: Zainicjuj shadcn i ustaw motyw.**
  - `pnpm dlx shadcn@latest init` w odmianie Radix, dodaj komponenty z Interfaces.
  - W `globals.css` tokeny ze spec 3.1; zmapuj `--primary` = `#171717`, `--primary-foreground` = `#ffffff`, `--radius` = `0.375rem`. Usuń blok `.dark`.
  - `layout.tsx`: `GeistSans`, `GeistMono`, `<html lang="pl">`, bazowo 14 px.
- [ ] **Step 6: Zaimplementuj `RhytmLogo`.** SVG `viewBox="0 0 48 48"`, kwadraty 11×11, `rx=3`, pozycje 4/18/32; krycia wierszami `1, .55, .25 / .55, .25, accent / .25, 1, .55`; kolor `#171717`, akcent `#15803d`. Wordmark: Geist 600, `letter-spacing: -0.045em` (wzór: nagłówek `Login.dc.html`).
- [ ] **Step 7: Zaimplementuj `Button`, `TextField`, `MonoLabel`** wg `Login.dc.html` i `Settings.dc.html` (pole: ramka `#e0e0e0`, 6 px, fokus ramka `#171717`; na telefonie wysokość i promień z `MLogin.dc.html` przez `max-[799px]:`).
- [ ] **Step 8: Uruchom testy.** Oczekiwane: PASS.
- [ ] **Step 9: Commit** `feat: tokeny rhytm, Geist, shadcn (Radix), logo, przyciski i pola`

### Task 3: Odświeżona kopia makiet i skrypt zrzutów

> **Wykonuje kontroler, nie subagent** — tylko kontroler ma dostęp do płótna Design (slug `9944efef-e205-44c2-b3d9-bd664070ef9d`).

**Files:**
- Modify/Create: `docs/design/mockups/*.dc.html` (wszystkie pliki z płótna: strona „Web Design” i „Mobile Design”), `docs/design/mockups/index.html`, `docs/design/mockups/support.js`
- Create: `scripts/mockup-shots.mjs`, skrypt `pnpm mockups:shots` w `package.json`

**Interfaces:**
- Produces: `pnpm mockups:shots [Nazwa...]` — serwuje `docs/design/mockups` statycznie i zapisuje zrzut każdej makiety do `test-results/mockups/<Nazwa>.png`; pliki `M*` w 390×844, pozostałe w 1440×900. Bez argumentów robi zrzuty wszystkich.

- [ ] **Step 1: Pobierz z płótna aktualne wersje wszystkich plików** (`list_files` + `read_file`) i nadpisz `docs/design/mockups/`. Usuń kopie, których już nie ma na płótnie.
- [ ] **Step 2: Przepisz `index.html`:** dwie sekcje „Web” i „Telefon”, link do każdego pliku z jego tytułem z `canvas.json`.
- [ ] **Step 3: Napisz `scripts/mockup-shots.mjs`** (Playwright `chromium`, `http-server` lub `node:http` na losowym porcie, czeka na `networkidle`).
- [ ] **Step 4: Uruchom** `pnpm mockups:shots Login MLogin MTabBar`. Oczekiwane: 3 pliki PNG, niepuste (> 10 kB).
- [ ] **Step 5: Commit** `docs: odświeżone makiety (web + telefon) i skrypt zrzutów`

### Task 4: Supabase — klienci, tabela `profiles`, RLS

**Files:**
- Create:
  - `supabase/config.toml` (`supabase init`), `supabase/migrations/20261116000001_profiles.sql`, `supabase/tests/profiles_rls.test.sql`,
  - `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/proxy-session.ts`,
  - `src/types/database.ts` (z `supabase gen types typescript --local`).
- Modify: `.github/workflows/ci.yml` (job `db`: `supabase start` + `supabase test db`), `.env.example`

**Interfaces:**
- Produces:
  - `createClient(): Promise<SupabaseClient<Database>>` w `server.ts` (`cookies()` z `next/headers`),
  - `createClient(): SupabaseClient<Database>` w `client.ts`,
  - `updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null; supabase: SupabaseClient<Database> }>` w `proxy-session.ts`,
  - tabela `public.profiles` z kolumnami ze spec 5: `user_id` PK, `display_name`, `avatar_path`, `timezone` DEFAULT `'Europe/Warsaw'`, `week_start` DEFAULT `'mon'` (check `mon|sun`), `clock` DEFAULT `'24'` (check `24|12`), `weight_kg`, `height_cm`, `sleep_goal_min` DEFAULT 480, `weekly_km_goal`, `currency` DEFAULT `'PLN'`, `roles text[]`, `study_field`, `goals text[]`, `referral_source`, `referral_other`, `onboarded_at`, `created_at` DEFAULT `now()`; poza `user_id` wszystko może być NULL,
  - trigger `on_auth_user_created` → `handle_new_user()` (`security definer`, `set search_path = ''`): `display_name` = `raw_user_meta_data->>'display_name'`, a gdy brak — `->>'full_name'` (Google).
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (tylko serwer).

- [ ] **Step 1: Napisz test RLS (pgTAP)** `supabase/tests/profiles_rls.test.sql`, `plan(4)`:
  - dwóch użytkowników wstawionych do `auth.users` (`a@test.pl` z `{"display_name":"A"}`, `b@test.pl` z `{"full_name":"B G"}`),
  - `display_name` B = `'B G'` (trigger bierze `full_name`),
  - jako `authenticated` z `sub` = A: `count(*) from profiles` = 1,
  - `update` profilu B jako A nic nie zmienia (po `reset role` nadal `'B G'`),
  - `timezone` A = `'Europe/Warsaw'`.
- [ ] **Step 2: Uruchom** `supabase start && supabase test db`. Oczekiwane: FAIL (brak tabeli).
- [ ] **Step 3: Napisz migrację:** tabela, RLS włączone, polityki `select` i `update` z `user_id = auth.uid()`, bez `insert` i `delete` (wstawia tylko trigger).
- [ ] **Step 4: Uruchom** `supabase test db`. Oczekiwane: 4/4 ok. Wygeneruj `src/types/database.ts`.
- [ ] **Step 5: Zaimplementuj klientów** wg dokumentacji `@supabase/ssr` dla App Router (`getAll`/`setAll`). `updateSession` woła `supabase.auth.getUser()`.
- [ ] **Step 6: Commit** `feat: Supabase, tabela profiles z RLS i klienci SSR`

### Task 5: Kontrolki cz. 1 — dymek, okno/arkusz, lista rozwijana, segment, przełącznik, checkbox, chipy, plakietki, potwierdzenie słowem

**Files:**
- Create w `src/components/controls/`: `action-popover.tsx`, `form-dialog.tsx`, `dropdown.tsx`, `segment.tsx`, `switch.tsx`, `checkbox.tsx`, `chip.tsx`, `status-badge.tsx`, `word-confirm.tsx`, `match-word.ts`, `index.ts`
- Create: `src/app/(public)/dev/kontrolki/page.tsx`
- Test: `src/components/controls/match-word.test.ts`, `dropdown.test.tsx`, `segment.test.tsx`, `switch.test.tsx`, `checkbox.test.tsx`, `form-dialog.test.tsx`, `word-confirm.test.tsx`

**Interfaces:**
- Produces (wszystko eksportowane z `@/components/controls`):
  - `ActionPopover({ trigger: ReactNode; open: boolean; onOpenChange(open: boolean): void; width?: number; align?: 'start' | 'end'; children })` — Radix Popover w portalu; zamyka klik w wyzwalacz, Esc, klik poza; promień 10 px, cień `0 12px 32px rgba(0,0,0,.12)`, ramka `#eaeaea`; przy braku miejsca na dole otwiera się w górę (`avoidCollisions`).
  - `FormDialog({ open; onOpenChange; title: string; children; footer?: ReactNode })` — Radix Dialog; od 800 px okno na środku (promień 12 px, cień ze spec 3.1), poniżej 800 px arkusz od dołu: zaokrąglenie 18 px u góry, uchwyt 36×5 px, przyciemnienie `rgba(0,0,0,.4)` (wg `MBlockSheet.dc.html`).
  - `type DropdownOption<T extends string> = { value: T; label: string; hint?: string; badge?: { label: string; tone: BadgeTone } }`
  - `Dropdown<T extends string>({ value: T | null; onChange(v: T): void; options: DropdownOption<T>[]; placeholder?: string; ariaLabel: string; width?: number })` — przycisk jak pole (ramka `#e0e0e0`, 6 px, strzałka ⌄), ramka `#171717` gdy otwarta; opcje 13 px, wybrana tło `#f0f0f0` + zielony ✓; `hint` w Geist Mono po prawej; klawiatura: ↑/↓ przesuwa, Enter wybiera, Esc zamyka; `role="listbox"`/`role="option"` z `aria-selected`.
  - `Segment<T extends string>({ value: T; onChange(v: T): void; options: { value: T; label: string }[]; ariaLabel: string })` — `role="radiogroup"`; web: przyciski w ramce, wybrany `#f0f0f0`; telefon: szare tło, wybrany biała pigułka z cieniem.
  - `Switch({ checked: boolean; onChange(v: boolean): void; ariaLabel: string; disabled?: boolean })` — `role="switch"`, 40×22 px (web) / 50×30 px (telefon), włączony `#15803d`, przesunięcie `transition 150ms`.
  - `Checkbox({ checked: boolean; onChange(v: boolean): void; label?: ReactNode; ariaLabel?: string })` — `role="checkbox"`, zielony kwadrat z białym ✓, 18 px (web) / 24 px (telefon).
  - `Chip({ selected?: boolean; dashed?: boolean; dotColor?: string; onClick?(): void; children })`.
  - `type BadgeTone = 'green' | 'orange' | 'blue' | 'red' | 'gray'` i `StatusBadge({ tone: BadgeTone; children })` — kolory (tło / ramka / tekst): green `#f0faf4 / #bbe5cc / #15803d`, orange `#fff4ed / #fed7aa / #c2410c`, blue `#eef5ff / #cfe2ff / #0070f3`, red `#fef2f2 / #fecaca / #b91c1c`, gray `#f5f5f5 / #e0e0e0 / #666666`.
  - `matchesWord(input: string, word: string): boolean` i `WordConfirm({ word: string; label: string; confirmLabel: string; onConfirm(): void; destructive?: boolean })` — przycisk z `aria-disabled="true"` i bez reakcji na klik, dopóki słowo się nie zgadza (wzór `VaultReset.dc.html`).
- `/dev/kontrolki`: strona z każdą kontrolką w kilku stanach, sekcje opisane nazwą makiety wzorcowej; w produkcji `notFound()` (`process.env.NODE_ENV === 'production'`).

- [ ] **Step 1: Napisz testy**

```ts
// match-word.test.ts
expect(matchesWord('resetuj', 'RESETUJ')).toBe(true)
expect(matchesWord('RESETUJ  ', 'RESETUJ')).toBe(true)
expect(matchesWord('usuń', 'USUŃ')).toBe(true)
expect(matchesWord('usun', 'USUŃ')).toBe(false)
expect(matchesWord('RESET', 'RESETUJ')).toBe(false)
```

```tsx
// dropdown.test.tsx
// - klik w przycisk otwiera listbox z opcjami; wybrana ma aria-selected="true" i znak ✓
// - klik opcji woła onChange('cet') i zamyka listbox
// - ArrowDown + Enter wybiera następną opcję; Escape zamyka bez onChange
// - klik poza (userEvent.click(document.body)) zamyka
// - opcja z hint 'UTC+01:00' renderuje hint; opcja z badge renderuje StatusBadge
// - Review Focus 5: Dropdown w rodzicu z style={{ overflow: 'hidden', height: 20 }}:
//   listbox NIE jest potomkiem tego rodzica (portal) i jest widoczny
```

```tsx
// segment / switch / checkbox / form-dialog / word-confirm
// - Segment: klik „Nd” woła onChange('sun'); wybrany ma aria-checked="true"; strzałki zmieniają wybór
// - Switch: klik i Space przełączają; aria-checked odzwierciedla stan; disabled nie woła onChange
// - Checkbox: klik woła onChange(!checked); aria-checked
// - FormDialog: Escape woła onOpenChange(false); tytuł jest nazwą dostępną okna (role="dialog")
// - WordConfirm: przy „RESE” przycisk ma aria-disabled="true" i klik nie woła onConfirm;
//   po „resetuj” klik woła onConfirm raz
```

- [ ] **Step 2: Uruchom** `pnpm test src/components/controls`. Oczekiwane: FAIL.
- [ ] **Step 3: Zaimplementuj kontrolki** — wygląd przepisany z CSS makiet: `.dd`/`.ddpop`/`.ddopt` w `Settings.dc.html`, `.sw` w `SettingsNotifications.dc.html`, segment i checkbox z `Settings.dc.html` i `MRegister.dc.html`, arkusz z `MBlockSheet.dc.html`. Warianty telefonu tylko klasami `max-[799px]:`.
- [ ] **Step 4: Zbuduj `/dev/kontrolki`** z kontrolkami tego tasku.
- [ ] **Step 5: Uruchom testy.** Oczekiwane: PASS. Uruchom `pnpm dev`, otwórz `/dev/kontrolki` w 1440 i 390 px i porównaj z `pnpm mockups:shots Settings SettingsNotifications VaultReset MBlockSheet`; popraw różnice.
- [ ] **Step 6: Commit** `feat: kontrolki — dymek, okno/arkusz, lista, segment, przełącznik, checkbox, chipy, plakietki, potwierdzenie`

### Task 6: Kontrolki cz. 2 — wybór daty i wybór godziny

**Files:**
- Create w `src/components/controls/`: `calendar-math.ts`, `date-picker.tsx`, `time-picker.tsx`
- Modify: `src/components/controls/index.ts`, `src/app/(public)/dev/kontrolki/page.tsx`
- Test: `calendar-math.test.ts`, `date-picker.test.tsx`, `time-picker.test.tsx`

**Interfaces:**
- Consumes: `ActionPopover` (Task 5).
- Produces:
  - `type IsoDate = string // 'YYYY-MM-DD'`
  - `buildMonthGrid(year: number, month0: number, weekStart: 'mon' | 'sun'): { date: IsoDate; inMonth: boolean }[]` — zawsze 42 komórki (6 tygodni),
  - `formatDatePl(d: IsoDate): string` → `'16.11.2026'`; `monthTitlePl(year, month0): string` → `'listopad 2026'`; `todayIso(timeZone?: string): IsoDate`,
  - `DatePicker({ value: IsoDate | null; onChange(v: IsoDate | null): void; weekStart?: 'mon' | 'sun' = 'mon'; today?: IsoDate; ariaLabel: string; placeholder?: string = 'Wybierz datę' })` — przycisk z datą `dd.mm.rrrr` (mono) albo placeholderem; dymek 244 px: ‹ miesiąc rok ›, nagłówki pn–nd (mono 10 px), dni 30 px, wybrany czarny, dziś w obwódce `#d4d4d4`, dni spoza miesiąca wyszarzone; stopka „Dziś” i „Wyczyść”; wybór dnia zamyka.
  - `TimePicker({ value: string /* 'HH:MM' */; onChange(v: string): void; ariaLabel: string })` — przycisk mono `12:00 ⌄`; dymek 268 px: „Godzina” siatka 6×4 (00–23), „Minuty” siatka 6×2 (:00–:55 co 5), wybrane czarne, „Gotowe”; klik godziny zmienia godzinę i zostawia dymek, klik minut zmienia minuty i zamyka.

- [ ] **Step 1: Napisz testy**

```ts
// calendar-math.test.ts
const g = buildMonthGrid(2026, 10, 'mon')           // listopad 2026, 1.11 to niedziela
expect(g).toHaveLength(42)
expect(g[0]).toEqual({ date: '2026-10-26', inMonth: false })
expect(g[6]).toEqual({ date: '2026-11-01', inMonth: true })
expect(buildMonthGrid(2026, 10, 'sun')[0]).toEqual({ date: '2026-11-01', inMonth: true })
expect(buildMonthGrid(2027, 1, 'mon').filter(c => c.inMonth)).toHaveLength(28)
expect(buildMonthGrid(2028, 1, 'mon').filter(c => c.inMonth)).toHaveLength(29)  // przestępny
expect(formatDatePl('2026-11-16')).toBe('16.11.2026')
expect(monthTitlePl(2026, 0)).toBe('styczeń 2026')
```

```tsx
// date-picker.test.tsx (today='2026-11-16', value='2026-11-20')
// - przycisk pokazuje „20.11.2026”; bez value pokazuje „Wybierz datę”
// - po otwarciu tytuł „listopad 2026”; ‹ daje „październik 2026”, › z grudnia daje „styczeń 2027”
// - klik „25” woła onChange('2026-11-25') i zamyka; „Dziś” woła onChange('2026-11-16'); „Wyczyść” woła onChange(null)
// - komórka 16 ma klasę obwódki dzisiaj; komórka 20 ma aria-pressed="true"
// time-picker.test.tsx (value='12:00')
// - klik „09” woła onChange('09:00') i dymek zostaje otwarty
// - klik „:35” woła onChange('12:35') i zamyka; „Gotowe” zamyka bez zmian
```

- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL.
- [ ] **Step 3: Zaimplementuj** — `calendar-math` na samych liczbach (bez `Date` w strefie przeglądarki; `Date.UTC` do dnia tygodnia), wygląd z `Books.dc.html` (`dp()`) i `SettingsNotifications.dc.html` (`.tmb`/`.tpop`/`.tgrid`/`.tcell`). Dodaj obie kontrolki do `/dev/kontrolki`.
- [ ] **Step 4: Uruchom testy.** Oczekiwane: PASS. Porównaj `/dev/kontrolki` z `pnpm mockups:shots Books SettingsNotifications`.
- [ ] **Step 5: Commit** `feat: kontrolki — wybór daty i godziny`

### Task 7: Czysta logika konta — reguły hasła, HIBP, Turnstile, schematy

**Files:**
- Create: `src/lib/auth/password-rules.ts`, `src/lib/auth/hibp.ts`, `src/lib/auth/turnstile.ts`, `src/lib/auth/schemas.ts`
- Test: `password-rules.test.ts`, `hibp.test.ts`, `turnstile.test.ts`, `schemas.test.ts` (obok modułów)

**Interfaces:**
- Produces:
  - `PASSWORD_MIN_LENGTH = 10`,
  - `checkPasswordRules(password: string): { minLength: boolean; lettersAndDigits: boolean }`,
  - `passwordStrength(password: string, notLeaked: boolean): 0 | 1 | 2 | 3 | 4` — liczba spełnionych reguł (minLength, lettersAndDigits, notLeaked) + 1, jeśli długość ≥ 14; pusty string = 0 (wzór z `Register.dc.html` / `MRegister.dc.html`),
  - `isPasswordPwned(password: string, fetchFn?: typeof fetch): Promise<boolean>`,
  - `verifyTurnstile(token: string | null | undefined, ip?: string, fetchFn?: typeof fetch): Promise<boolean>`,
  - `signInSchema`, `signUpSchema` (`displayName` 1–60 znaków po `trim`, `email`, `password`, `tos: z.literal('on')` z komunikatem „Zaakceptuj regulamin”), `resetRequestSchema`, `newPasswordSchema` (`password` + `confirm`, muszą być równe). Wszystkie e-maile `trim().toLowerCase()`.

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
expect(await isPasswordPwned('x', vi.fn().mockRejectedValue(new Error('offline')))).toBe(false)      // Review Focus 1
expect(await isPasswordPwned('x', vi.fn().mockResolvedValue(new Response('', { status: 503 })))).toBe(false)
expect(await isPasswordPwned('password123', vi.fn().mockResolvedValue(new Response('8F9CAB4083784CBD1874F76618D2A97:0')))).toBe(false) // padding

// turnstile.test.ts
expect(await verifyTurnstile(null)).toBe(false)
const ok = vi.fn().mockResolvedValue(Response.json({ success: true }))
expect(await verifyTurnstile('tok', '1.2.3.4', ok)).toBe(true)
expect(ok).toHaveBeenCalledWith('https://challenges.cloudflare.com/turnstile/v0/siteverify', expect.objectContaining({ method: 'POST' }))
expect(await verifyTurnstile('tok', undefined, vi.fn().mockRejectedValue(new Error()))).toBe(false) // Review Focus 1

// schemas.test.ts — Review Focus 4
expect(signInSchema.parse({ email: ' Mejson@Example.com ', password: 'x' }).email).toBe('mejson@example.com')
expect(newPasswordSchema.safeParse({ password: 'rytm2026abc', confirm: 'inne2026abc' }).success).toBe(false)
expect(signUpSchema.safeParse({ displayName: 'M', email: 'm@x.pl', password: 'rytm2026abc' }).success).toBe(false) // brak tos
```

- [ ] **Step 2: Uruchom** `pnpm test src/lib/auth`. Oczekiwane: FAIL.
- [ ] **Step 3: Zaimplementuj.** SHA-1 przez `crypto.subtle.digest`; Turnstile czyta `TURNSTILE_SECRET_KEY`, body `URLSearchParams({ secret, response, remoteip })`; komunikaty zod: „Podaj poprawny e-mail”, „Hasła nie są takie same”, „Zaakceptuj regulamin”.
- [ ] **Step 4: Uruchom testy.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat: reguły hasła, HIBP, Turnstile i schematy formularzy`

### Task 8: Układ ekranów konta i Logowanie (web + telefon)

**Files:**
- Create:
  - `src/components/auth/auth-shell.tsx`, `google-button.tsx`, `turnstile-widget.tsx`, `password-input.tsx`, `or-separator.tsx`,
  - `src/app/(auth)/logowanie/page.tsx`, `src/features/auth/login-form.tsx`, `src/features/auth/actions.ts`, `src/app/auth/callback/route.ts`, `src/lib/auth/next-path.ts`.
- Test: `src/lib/auth/next-path.test.ts`, `src/features/auth/login-form.test.tsx`

**Interfaces:**
- Consumes: `createClient` (Task 4), `signInSchema`, `verifyTurnstile` (Task 7), `RhytmLogo`, `Button`, `TextField` (Task 2).
- Produces:
  - `type AuthFormState = { status: 'idle' | 'error' | 'success'; message?: string; fieldErrors?: Partial<Record<string, string>> }`,
  - `signIn(prev: AuthFormState, formData: FormData): Promise<AuthFormState>` (po sukcesie `redirect(pathAfterLogin(profile))`),
  - `signInWithGoogle(): Promise<never>` — `signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/auth/callback } })` + `redirect(data.url)`,
  - `pathAfterLogin(profile: { onboarded_at: string | null } | null): '/dzis' | '/onboarding'`,
  - `AuthShell({ headerAction?: { href: string; label: string }; width?: 380 | 400; children })`:
    - od 800 px: tło `#fafafa` z siatką 48 px (linie `#eeeeee`), nagłówek z `RhytmLogo withWordmark` (26 px) i `headerAction`, karta `width` px, `rounded-xl`, ramka `#eaeaea`, cień ze spec 3.1, `p-7`, `gap-4`,
    - poniżej 800 px: układ z `MLogin.dc.html` — białe tło, bez karty i siatki, logo nad tytułem, pełna szerokość z marginesami makiety.
  - `PasswordInput({ name; label; autoComplete; rightLink?: ReactNode })` z przyciskiem „Pokaż hasło” / „Ukryj hasło”.
  - `OrSeparator({ label: string })`.

- [ ] **Step 1: Napisz testy**

```ts
expect(pathAfterLogin(null)).toBe('/onboarding')
expect(pathAfterLogin({ onboarded_at: null })).toBe('/onboarding')
expect(pathAfterLogin({ onboarded_at: '2026-11-16T10:00:00Z' })).toBe('/dzis')
```

```tsx
// login-form.test.tsx — z mockiem akcji zwracającej { status: 'error', message: 'Nieprawidłowy e-mail lub hasło' }
// - jest „Zaloguj się przez Google” (web) i „Kontynuuj z Google” (telefon) — oba w DOM, każdy w swoim kontenerze breakpointu
// - link „Nie pamiętasz hasła?” → /reset-hasla; „Zarejestruj się” → /rejestracja
// - po wysłaniu: alert „Nieprawidłowy e-mail lub hasło”
// - klik „Pokaż hasło” zmienia type pola na text
// - formularz ma JEDNO pole name="email" i JEDNO name="password" (różnice układu tylko CSS)
```

- [ ] **Step 2: Uruchom testy.** Oczekiwane: FAIL.
- [ ] **Step 3: Zbuduj ekran.**
  - Web 1:1 z `Login.dc.html`: tytuł „Zaloguj się do rhytm”, opis, Google, „lub e-mailem”, E-mail, Hasło (link + oko), Turnstile, „Zaloguj się”, „Nie masz konta? Zarejestruj się”; w nagłówku „Załóż konto”.
  - Telefon 1:1 z `MLogin.dc.html`: „Witaj z powrotem”, „Zaloguj się do rhytm”, E-mail, Hasło, „Nie pamiętasz hasła?”, „Zaloguj się”, „lub”, „Kontynuuj z Google”, „Nie masz konta? Załóż konto”.
  - Jeden formularz; kolejność bloków przez `order-*` z `max-[799px]:`, teksty różniące się wariantem jako dwa `<span>` z `max-[799px]:hidden` / `min-[800px]:hidden`.
  - Turnstile: `@marsidev/react-turnstile`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, wygląd `compact`/`light`.
  - `signIn`: zod → Turnstile → `signInWithPassword`. Każdy błąd auth → „Nieprawidłowy e-mail lub hasło”; błąd Turnstile → „Potwierdź, że nie jesteś botem”.
- [ ] **Step 4: Callback OAuth.** `GET /auth/callback?code=…`: `exchangeCodeForSession(code)`, odczyt profilu, redirect `pathAfterLogin`. Błąd → `/logowanie?blad=oauth` z komunikatem „Nie udało się zalogować przez Google”.
- [ ] **Step 5: Uruchom testy.** Oczekiwane: PASS. Porównaj z `pnpm mockups:shots Login MLogin` w obu szerokościach.
- [ ] **Step 6: Commit** `feat: ekran logowania (web i telefon) z Google i Turnstile`

### Task 9: Rejestracja, „Sprawdź skrzynkę”, strony regulaminu i prywatności

**Files:**
- Create: `src/app/(auth)/rejestracja/page.tsx`, `src/features/auth/register-form.tsx`, `src/features/auth/check-inbox.tsx`, `src/features/auth/password-rules-list.tsx`, `src/features/auth/strength-bar.tsx`, `src/app/(public)/regulamin/page.tsx`, `src/app/(public)/prywatnosc/page.tsx`
- Modify: `src/features/auth/actions.ts`
- Test: `src/features/auth/register-form.test.tsx`, `src/features/auth/check-inbox.test.tsx`

**Interfaces:**
- Consumes: `checkPasswordRules`, `passwordStrength`, `isPasswordPwned`, `signUpSchema`, `verifyTurnstile`, `AuthShell`, `GoogleButton`, `PasswordInput`, `Checkbox` (Task 5).
- Produces:
  - `signUp(prev: AuthFormState, formData: FormData): Promise<AuthFormState>`; `success` przełącza widok na „Sprawdź skrzynkę”,
  - `checkPasswordLeak(password: string): Promise<boolean>` — akcja serwera do reguły na żywo, debounce 400 ms po stronie klienta,
  - `resendConfirmation(email: string): Promise<AuthFormState>`,
  - `CheckInbox({ email: string; onResend(): Promise<void>; cooldownSeconds?: number = 60 })`,
  - strony `/regulamin` i `/prywatnosc`: nagłówek „Regulamin” / „Polityka prywatności”, akapit „[TREŚĆ DO UZUPEŁNIENIA]”, link „Wróć” do `/rejestracja`; publiczne.

- [ ] **Step 1: Napisz testy komponentów**
  - wpisanie `rytm2026` zostawia „co najmniej 10 znaków” jako `○`, a „litery i cyfry” daje `✓`,
  - `checkPasswordLeak` zamockowany na `true` daje „nie ma go w bazie wycieków” jako `○` i blokuje submit,
  - pasek siły ma 4 segmenty; po `rytmtygodnia2026x` wszystkie mają kolor `#15803d`,
  - bez zaznaczonego „Akceptuję regulamin i politykę prywatności” przycisk „Utwórz konto” ma `aria-disabled="true"` i nie wysyła; linki prowadzą do `/regulamin` i `/prywatnosc`,
  - podwójne kliknięcie „Utwórz konto” → akcja wywołana 1 raz, przycisk zablokowany w trakcie (`useFormStatus`),
  - `CheckInbox` (fake timers): „Wyślij ponownie” nieaktywny z licznikiem `0:59` po 1 s; po 60 s aktywny; klik woła `onResend` i znowu startuje odliczanie.
- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL.
- [ ] **Step 3: Zbuduj ekran.**
  - Web 1:1 z `Register.dc.html` (karta 400 px): „Kontynuuj z Google”, separator, Nazwa, E-mail, Hasło z paskiem siły i trzema regułami (`○`/`✓`, `#6b6b6b`/`#15803d`), zgoda, Turnstile, „Utwórz konto”, link do logowania.
  - Telefon 1:1 z `MRegister.dc.html`: „Załóż konto”, podtytuł, Imię, E-mail, Hasło z paskiem 4 segmentów, checkbox zgody, „Utwórz konto”, „Masz już konto? Zaloguj się”.
  - Akcja: zod → Turnstile → `isPasswordPwned` → `supabase.auth.signUp({ email, password, options: { data: { display_name }, emailRedirectTo: <origin>/auth/confirm } })`. Sukces i „użytkownik już istnieje” dają **ten sam** stan sukcesu.
  - Stan „Sprawdź skrzynkę” z tekstem z makiety i „Wyślij ponownie” z odliczaniem 60 s.
- [ ] **Step 4: Uruchom.** Oczekiwane: PASS. Porównaj z `pnpm mockups:shots Register MRegister`.
- [ ] **Step 5: Commit** `feat: rejestracja (web i telefon), sprawdzanie wycieków, zaślepki regulaminu i prywatności`

### Task 10: Potwierdzenie e-maila i reset hasła

**Files:**
- Create:
  - `src/app/auth/confirm/route.ts`, `src/app/(auth)/potwierdzono/page.tsx`, `src/app/(auth)/link-wygasl/page.tsx`,
  - `src/app/(auth)/reset-hasla/page.tsx`, `src/app/(auth)/nowe-haslo/page.tsx`, `src/features/auth/reset-steps.tsx`.
- Modify: `src/features/auth/actions.ts`, `supabase/config.toml` (szablony maili: link `/auth/confirm?token_hash={{ .TokenHash }}&type=…`), `supabase/templates/*.html`
- Test: `src/app/auth/confirm/route.test.ts`, `src/features/auth/reset-steps.test.tsx`

**Interfaces:**
- Consumes: `newPasswordSchema`, `resetRequestSchema`, `verifyTurnstile`, `checkPasswordRules`, `CheckInbox` (Task 9).
- Produces:
  - `GET /auth/confirm?token_hash&type`: `verifyOtp`; `signup|email` → `/potwierdzono`, `recovery` → `/nowe-haslo`; błąd → `/link-wygasl?type=…`,
  - `requestPasswordReset(prev, formData): Promise<AuthFormState>` (zawsze ten sam sukces),
  - `updatePassword(prev, formData): Promise<AuthFormState>` (`updateUser({ password })`, potem `signOut({ scope: 'others' })`, redirect `/dzis`),
  - `resendLink(type: 'signup' | 'recovery', email: string): Promise<AuthFormState>`.

- [ ] **Step 1: Napisz testy**
  - route handler z mockiem `createClient`: sukces `signup` → 307 na `/potwierdzono`, sukces `recovery` → `/nowe-haslo`, błąd `verifyOtp` → `/link-wygasl?type=signup`, brak `token_hash` → `/link-wygasl?type=signup`,
  - `reset-steps`: krok 1 pokazuje znacznik „krok 1 / 3”; po sukcesie akcji krok 2 z tekstem „Jeśli konto istnieje, link do zmiany hasła jest już w drodze.”, „Wróć do logowania” → `/logowanie` i „Wyślij ponownie” (odliczanie z `CheckInbox`).
- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL.
- [ ] **Step 3: Zbuduj ekrany 1:1.**
  - `EmailConfirmed.dc.html` (oba stany): „E-mail potwierdzony” + Dalej → `/onboarding`; „Link wygasł” + pole e-mail i „Wyślij nowy link”.
  - Web `Forgot.dc.html`: znacznik „krok N / 3”, teksty kroków dosłownie, krok 3 (`/nowe-haslo`) z regułami hasła i notką o sejfie.
  - Telefon `MForgot.dc.html`: „Reset hasła”, „Podaj e-mail konta. Wyślemy link, który działa przez 30 minut.”, „Wyślij link” → „Sprawdź skrzynkę” + „Wróć do logowania” + „Wyślij ponownie”.
  - Ważność linku recovery w `config.toml`: 1800 s (zgodnie z tekstem makiety).
- [ ] **Step 4: Uruchom testy.** Oczekiwane: PASS. Porównaj z `pnpm mockups:shots EmailConfirmed Forgot MForgot`.
- [ ] **Step 5: Commit** `feat: potwierdzenie e-maila i reset hasła (web i telefon)`

### Task 11: Proxy — sesja i przekierowania

**Files:**
- Create: `src/proxy.ts`, `src/lib/auth/route-guard.ts`, `src/app/(onboarding)/onboarding/page.tsx`
- Test: `src/lib/auth/route-guard.test.ts`

**Interfaces:**
- Consumes: `updateSession` (Task 4).
- Produces: `resolveRoute(input: { pathname: string; isLoggedIn: boolean; isOnboarded: boolean }): { redirect: string } | null`.
  - Ekrany konta (zalogowany → przekierowanie): `/logowanie`, `/rejestracja`, `/reset-hasla`.
  - Publiczne dla wszystkich: `/nowe-haslo`, `/potwierdzono`, `/link-wygasl`, `/auth/*`, `/regulamin`, `/prywatnosc`, `/dev/*`.
  - Zawsze przepuszczane: `/manifest.webmanifest`, `/icons/*`, `/_next/*`.
  - `/onboarding` wymaga zalogowania; ukończony onboarding → `/dzis`.

- [ ] **Step 1: Napisz testy**

```ts
expect(resolveRoute({ pathname: '/dzis', isLoggedIn: false, isOnboarded: false })).toEqual({ redirect: '/logowanie' })
expect(resolveRoute({ pathname: '/logowanie', isLoggedIn: true, isOnboarded: true })).toEqual({ redirect: '/dzis' })        // Review Focus 2
expect(resolveRoute({ pathname: '/rejestracja', isLoggedIn: true, isOnboarded: false })).toEqual({ redirect: '/onboarding' })
expect(resolveRoute({ pathname: '/kalendarz', isLoggedIn: true, isOnboarded: false })).toEqual({ redirect: '/onboarding' })
expect(resolveRoute({ pathname: '/onboarding', isLoggedIn: true, isOnboarded: true })).toEqual({ redirect: '/dzis' })
expect(resolveRoute({ pathname: '/onboarding', isLoggedIn: false, isOnboarded: false })).toEqual({ redirect: '/logowanie' })
expect(resolveRoute({ pathname: '/nowe-haslo', isLoggedIn: true, isOnboarded: true })).toBeNull()
expect(resolveRoute({ pathname: '/auth/confirm', isLoggedIn: false, isOnboarded: false })).toBeNull()
expect(resolveRoute({ pathname: '/regulamin', isLoggedIn: false, isOnboarded: false })).toBeNull()
expect(resolveRoute({ pathname: '/dev/kontrolki', isLoggedIn: false, isOnboarded: false })).toBeNull()
expect(resolveRoute({ pathname: '/', isLoggedIn: true, isOnboarded: true })).toEqual({ redirect: '/dzis' })
expect(resolveRoute({ pathname: '/', isLoggedIn: false, isOnboarded: false })).toEqual({ redirect: '/logowanie' })
```

- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL. Zaimplementuj `resolveRoute`.
- [ ] **Step 3: Podłącz proxy.** `src/proxy.ts` (nazwę pliku, eksport i `config.matcher` potwierdź w dokumentacji Next 16) woła `updateSession`; dla zalogowanego czyta `profiles.onboarded_at` jednym `select('onboarded_at')`; stosuje `resolveRoute` i zwraca odpowiedź z ciasteczkami z `updateSession`.
- [ ] **Step 4: Tymczasowy onboarding:** tekst „Onboarding — etap 1” i przycisk „Dalej” ustawiający `onboarded_at = now()` → `/dzis`. Etap 1 zastąpi go 7 krokami.
- [ ] **Step 5: Uruchom testy.** Oczekiwane: PASS.
- [ ] **Step 6: Commit** `feat: proxy z sesją Supabase i przekierowaniami`

### Task 12: Powłoka — sidebar, dymek konta, dolny pasek, puste moduły, 404

**Files:**
- Create:
  - `src/app/(app)/layout.tsx`, `src/components/shell/app-sidebar.tsx`, `src/components/shell/account-popover.tsx`, `src/components/shell/tab-bar.tsx`, `src/components/shell/nav-items.ts`, `src/components/shell/module-header.tsx`,
  - `src/app/(app)/{dzis,kalendarz,sport,nawyki,strony,ustawienia}/page.tsx`, `src/app/not-found.tsx`.
- Modify: `src/features/auth/actions.ts` (`signOut`)
- Test: `src/components/shell/app-sidebar.test.tsx`, `src/components/shell/tab-bar.test.tsx`

**Interfaces:**
- Consumes: `createClient`, `RhytmLogo`, `ActionPopover` (Task 5).
- Produces:
  - `NAV_MODULES: { key: 'dzis' | 'kalendarz' | 'sport' | 'nawyki'; label: string; href: string; icon: LucideIcon }[]` (Dziś `Sun`, Kalendarz `Calendar`, Sport `Activity`, Nawyki i sen `SquareCheck`),
  - `TAB_ITEMS: { key: 'dzis' | 'kalendarz' | 'sport' | 'nawyki' | 'strony'; label: string; href: string; icon: LucideIcon }[]` (Dziś, Kalendarz, Sport, Nawyki, Strony — ikony z `MTabBar.dc.html`),
  - `AppSidebar({ user: { displayName: string; email: string; avatarUrl: string | null }; pages?: { id: string; title: string; icon: string }[] = [] })`,
  - `AccountPopover({ user })` — dymek nad blokiem użytkownika: imię, e-mail, „Wyloguj się” (czerwony `#b91c1c`),
  - `TabBar()` — aktywna pozycja z `usePathname()` (prefiks trasy), czarna i pogrubiona,
  - `signOut(): Promise<never>` (redirect `/logowanie`).
  - Etapy 6+ dopiszą strony przez prop `pages`; teraz lista pusta i widać tylko „+ Nowa strona” (nieaktywne, tooltip „Wkrótce”).

- [ ] **Step 1: Napisz testy**
  - sidebar: „Szukaj…” z keycapem „⌘K”, sekcje „Moduły” i „Strony”, 4 moduły, „Ustawienia”, inicjały „M” dla `Mejson`; na `/kalendarz` „Kalendarz” ma `aria-current="page"`,
  - klik w blok użytkownika otwiera dymek z „Mejson”, e-mailem i „Wyloguj się”; dymek **nie** zawiera linku „Ustawienia”; Esc zamyka,
  - tab bar: 5 pozycji w kolejności Dziś, Kalendarz, Sport, Nawyki, Strony; na `/strony` „Strony” ma `aria-current="page"`; „Strony” → `/strony`.
- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL.
- [ ] **Step 3: Zbuduj sidebar 1:1 z `Sidebar.dc.html`.**
  - Szerokość 232 px, tło `#fafafa`, prawa ramka `#eaeaea`, `padding 12px 10px`, `position: sticky; top: 0; height: 100dvh`; przewija się tylko `<main>`.
  - Pozycje `gap 10px`, `padding 7px 8px`, `rounded-md`; hover `#f5f5f5`; aktywna `#f0f0f0` / `#171717` / 500, pozostałe `#666666`.
  - Etykiety sekcji: `MonoLabel`. Na dole „Ustawienia” i blok użytkownika (inicjały, imię, e-mail, ikona ⇅).
  - Poniżej 800 px sidebar `hidden`, a na dole `TabBar` (84 px, wg `MTabBar.dc.html`, `padding-bottom: env(safe-area-inset-bottom)`); `<main>` dostaje dolny odstęp 84 px.
  - Puste moduły z nagłówkiem „Moduły / X” (Geist Mono 13 px) na web i dużym tytułem na telefonie (wg nagłówków `MToday`, `MPages`). `/strony` na web przekierowuje do `/dzis` (lista stron żyje w sidebarze), na telefonie pokazuje pusty ekran „Strony” z ikoną ⚙ → `/ustawienia`.
- [ ] **Step 4: 404 1:1 z `NotFound.dc.html`:** sidebar (lub tab bar), „rhytm / 404”, duże „404”, „Tej strony nie ma”, tekst o koszu; „Wróć do Dziś” i „Szukaj ⌘K” (w tym etapie nieaktywny).
- [ ] **Step 5: Uruchom testy.** Oczekiwane: PASS. Porównaj z `pnpm mockups:shots Sidebar NotFound MTabBar`.
- [ ] **Step 6: Commit** `feat: powłoka — sidebar, dymek konta, dolny pasek, puste moduły i 404`

### Task 13: PWA — manifest i ikony

**Files:**
- Create: `src/app/manifest.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/icons/apple-touch-icon.png` (180 px), `scripts/make-icons.mjs` (PNG z SVG logo przez `sharp`)
- Modify: `src/app/layout.tsx` (`viewport.themeColor`, `appleWebApp`)
- Test: `src/app/manifest.test.ts`

**Interfaces:**
- Produces: `manifest(): MetadataRoute.Manifest` z `name: 'rhytm'`, `short_name: 'rhytm'`, `lang: 'pl'`, `start_url: '/dzis'`, `display: 'standalone'`, `background_color: '#ffffff'`, `theme_color: '#ffffff'` i trzema ikonami (maskable z `purpose: 'maskable'`).

- [ ] **Step 1: Napisz test** — wywołaj `manifest()` i sprawdź pola z Interfaces oraz 3 ikony.
- [ ] **Step 2: Uruchom.** Oczekiwane: FAIL. Zaimplementuj i wygeneruj ikony (logo 3×3 na białym tle; maskable z 20% marginesem).
- [ ] **Step 3: Uruchom.** Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat: manifest PWA i ikony`

### Task 14: Testy e2e, zrzuty względem makiet, instrukcja dla Mejsona, wdrożenie

**Files:**
- Create: `e2e/auth.spec.ts`, `e2e/shell.spec.ts`, `e2e/visual.spec.ts`, `e2e/helpers/mailpit.ts`, `docs/setup.md`
- Modify: `.github/workflows/ci.yml` (job `e2e`: `supabase start`, `pnpm build && pnpm start`, Playwright w projektach `web` i `mobile`), `.env.example`

**Interfaces:**
- Consumes: wszystko powyżej; Mailpit z `supabase start` (`http://127.0.0.1:54324`); testowe klucze Turnstile z Global Constraints.
- Produces: `latestLinkFor(email: string): Promise<string>` w `e2e/helpers/mailpit.ts`.

- [ ] **Step 1: Napisz testy e2e** (w obu projektach `web` i `mobile`, chyba że zaznaczono)
  - rejestracja → mail w Mailpit → link → „E-mail potwierdzony” → Dalej → tymczasowy onboarding → `/dzis` z sidebarem (web) / dolnym paskiem (mobile),
  - wylogowanie przez dymek konta (web) → `/logowanie`; ponowne logowanie e-mailem `" Mejson+e2e@Example.com "` (Review Focus 4),
  - złe hasło → „Nieprawidłowy e-mail lub hasło”,
  - reset: e-mail → link → nowe hasło → `/dzis`,
  - Review Focus 3: drugi raz ten sam link potwierdzający → „Link wygasł” → „Wyślij nowy link” wysyła nowy mail,
  - `/xyz` po zalogowaniu → „Tej strony nie ma”,
  - shell (web): sidebar zostaje widoczny przy przewinięciu długiej treści (`boundingBox().y === 0` po `scrollBy`),
  - `/regulamin` i `/prywatnosc` dostępne bez logowania.
- [ ] **Step 2: Napisz `e2e/visual.spec.ts`.**
  - Pary (ekran → makieta): `/logowanie` → Login / MLogin, `/rejestracja` → Register / MRegister, `/reset-hasla` → Forgot / MForgot, `/link-wygasl` → EmailConfirmed, 404 → NotFound, `/dzis` (pusty) → Sidebar / MTabBar, `/dev/kontrolki` (tylko zrzut).
  - Web 1440×900, telefon 390×844. Zapisuje `test-results/visual/<ekran>-<web|mobile>.png` obok zrzutu makiety ze skryptu z Task 3.
  - Test pada tylko, gdy strona się nie renderuje (porównanie jest ręczne).
- [ ] **Step 3: Uruchom** `pnpm test:e2e`. Oczekiwane: wszystkie PASS. Obejrzyj pary zrzutów i popraw różnice wyglądu.
- [ ] **Step 4: Napisz `docs/setup.md`** — instrukcja dla Mejsona, krok po kroku, każdy krok z dokładnym miejscem kliknięcia i tym, co ma skopiować i komu przekazać:
  1. **Lokalnie bez kluczy:** `pnpm i`, `supabase start`, `.env.local` z `.env.example` (lokalne URL/klucze z `supabase status`, testowe klucze Turnstile), `pnpm dev`, maile w Mailpit `http://127.0.0.1:54324`.
  2. **Supabase:** nowy projekt (region Frankfurt `eu-central-1`), skopiować Project URL, publishable key, secret key; Auth → URL Configuration: Site URL `https://<projekt>.vercel.app`, Redirect URLs `https://<projekt>.vercel.app/auth/callback`, `https://<projekt>.vercel.app/auth/confirm`, `http://localhost:3000/**`; Auth → Emails: szablony z `supabase/templates`.
  3. **Google OAuth:** Google Cloud → nowy projekt → OAuth consent screen (External, nazwa „rhytm”) → Credentials → OAuth client ID (Web), Authorized redirect URI = callback z Supabase (Auth → Providers → Google) → wkleić Client ID i Secret w Supabase.
  4. **Cloudflare Turnstile:** Add widget, domeny `<projekt>.vercel.app` i `localhost`, tryb Managed → site key i secret key.
  5. **Resend:** konto, API key; na domyślnej domenie wysyłka z `onboarding@resend.dev` (ograniczenia opisane); Supabase → Auth → SMTP: host `smtp.resend.com`, port 465, user `resend`, hasło = API key.
  6. **Vercel:** Import repo `Mejsooon/rhytm_v2`, zmienne środowiskowe (lista z `.env.example`), deploy.
  7. **Przekazanie dostępu Claude'owi:** które klucze wkleić do `.env.local` / Vercel, a których nie wysyłać w czacie (secret key Supabase, sekret Turnstile, Resend API key — wpisuje sam w Vercel).
  8. **Sprawdzenie:** rejestracja, Google, reset na produkcji — lista „co powinieneś zobaczyć”.
- [ ] **Step 5: Wdrożenie** (po tym, jak Mejson wykona kroki 2–6): `supabase link` + `supabase db push`, ręczna próba na produkcji z kroku 8. Do tego czasu CI i lokalne środowisko działają na lokalnym Supabase i testowych kluczach.
- [ ] **Step 6: Commit** `test: e2e konta i powłoki, zrzuty 1440/390 względem makiet; docs: instrukcja wdrożenia`

---

## Pokrycie listy odbiorczej Etapu 0 (roadmapa)

| Pozycja z roadmapy | Task |
|---|---|
| Repo, CI | 1 |
| Tokeny, Geist, logo; przyciski, pola, etykiety mono | 2 |
| Supabase, migracje, `profiles` + RLS + pgTAP | 4 |
| Odświeżona kopia makiet + `index.html` + skrypt zrzutów | 3 |
| Lista rozwijana, segment, przełącznik, checkbox, chipy, plakietki, dymek, okno, arkusz, potwierdzenie słowem, `/dev/kontrolki` | 5 |
| Wybór daty, wybór godziny | 6 |
| Logowanie (web + telefon) | 7, 8 |
| Rejestracja, zgoda na regulamin, „Sprawdź skrzynkę” | 7, 9 |
| Link z maila, reset w 3 krokach (web + telefon) | 10 |
| Wylogowanie | 12 |
| Proxy | 11 |
| Sidebar przyklejony, dymek konta, `MTabBar`, 404 | 12 |
| Manifest PWA | 13 |
| `/regulamin`, `/prywatnosc` | 9 |
| Instrukcja dla Mejsona, wdrożenie | 14 |
| Zrzuty 1440/390 | 3, 14 |

## Decyzje Claude'a w tym planie
- Zgoda na regulamin jest w formularzu rejestracji na **obu** szerokościach (makieta web jej nie ma, `MRegister` ma). Jeden formularz i jedna walidacja na serwerze; inaczej konto z komputera powstawałoby bez zgody.
- `/strony` na komputerze przekierowuje do `/dzis`, bo lista stron jest w sidebarze; ekran listy istnieje tylko na telefonie (spec 6.3).
- Link resetu ważny 30 minut — tak mówi tekst `MForgot`.
- Task 3 (makiety) wykonuje kontroler, bo tylko on ma dostęp do płótna.
