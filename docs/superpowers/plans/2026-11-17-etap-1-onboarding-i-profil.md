# Etap 1: Onboarding i profil — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nowy użytkownik przechodzi 7-krokowy onboarding (web z podglądem na żywo, telefon w układzie `MOnboarding`), wyniki zapisują się po każdym kroku, potem trafia na „Dziś” w stanie pustym, a profil i cele zmienia w Ustawienia → Ogólne.

**Architecture:**
- Jedna trasa `/onboarding/[krok]` (1–7). Serwer czyta profil i ustawienia powiadomień, klient trzyma szkic (`OnboardingDraft`), „Dalej” wywołuje akcję serwera, która zapisuje pola kroku i `profiles.onboarding_step`, a potem przechodzi do kolejnego kroku.
- Cała logika (mapowanie ról na kategorie, celów na strony, podsumowanie, walidacje, strefy czasowe) w czystych modułach TS z testami Vitest. Komponenty tylko renderują.
- Ukończenie onboardingu to jedna funkcja SQL `complete_onboarding` (atomowo: kategorie startowe + `onboarded_at`).
- Web i telefon w tym samym drzewie, przełączane klasami CSS na 800 px (jak w Etapie 0).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Radix (shadcn), Supabase (Postgres, RLS, Storage, pgTAP), zod 4, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-rhytm-design.md` — sekcje 2, 3.1, 3.2, 5 (`profiles`, `categories`, `notification_settings`), 6.2, 6.5 (stan pusty), 6.11 (Ogólne), 6.13, 7, 9.2. **Mapa etapów:** `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md` (Etap 1 + „Wspólne”). **Makiety:** `docs/design/mockups/` — web: `Onboarding`, `OnboardingRole`, `OnboardingGoals`, `OnboardingSource`, `OnboardingPages`, `OnboardingNotify`, `OnboardingDone`, `EmptyToday`, `Settings` (tylko karty Profil i Cele); telefon: `MOnboarding`, `MToday` (nagłówek). Dane i teksty kroków są w skryptach `<script>` makiet (`renderVals`) — przepisuj je stamtąd dosłownie.

## Global Constraints
- Wszystko z Global Constraints planu Etapu 0 obowiązuje dalej: Next.js 16 (czytaj `node_modules/next/dist/docs/` przed użyciem API), makiety 1:1 z tekstami dosłownie, tylko kontrolki z `src/components/controls` (bez `<select>`, `<input type=date|time>`), przełączanie web/telefon wyłącznie klasami `max-[799px]:` / `min-[800px]:`, komentarze po polsku, RLS „tylko własne wiersze” na każdej tabeli.
- **Git:** gałąź `feat/etap-1` od `main`; nigdy commit na `main`.
- **Klucze danych (zapisywane w bazie, nie zmieniać):**
  - role (`profiles.roles`): `student`, `work`, `free`, `sport`, `other`,
  - cele (`profiles.goals`): `plan`, `sport`, `habits`, `subs`, `pass`, `proj`, `books`,
  - szablony stron (`profiles.pending_pages`): `Subscriptions`, `Projects`, `Books`, `Websites`, `Passwords`,
  - źródło (`profiles.referral_source`): `friend`, `uni`, `tiktok`, `insta`, `yt`, `x`, `reddit`, `search`, `ai`, `other`,
  - tydzień `mon` | `sun`, zegar `24` | `12`, waluta `PLN` | `EUR` | `USD` | `GBP`.
- **Zakresy:** waga 30–250 kg, wzrost 120–230 cm (oba opcjonalne, przecinek dziesiętny dozwolony), km tygodniowo 1–300 (Ustawienia) i licznik onboardingu 5–150 co 5 (domyślnie 25), cel snu 300–660 min co 15 (5:00–11:00, domyślnie 480), nazwa 1–40 znaków po przycięciu spacji *[Claude: 40]*.
- **Kategorie startowe (kolory z makiety):** Studia `#0070f3`, Praca `#7c3aed`, Projekty `#15803d`, Sport `#c2410c` (`is_system = true`), Dom `#a16207`. Kolejność: Studia, Praca, Projekty, Sport, Dom.
- **Zielony obrys podglądu:** `border-radius: 8px; box-shadow: 0 0 0 2px #15803d`.

## Rozstrzygnięcia (Ruling) przed startem
- **Dom:** pojawia się, gdy zaznaczono „Coś innego” **albo** nie zaznaczono nic (makieta web `OnboardingRole`; telefon pokazuje Dom tylko przy braku ról — obowiązuje web, spec 0.4).
- **Kategorie powstają przy „Przejdź do Dziś”**, nie przy kroku 2 — role można jeszcze zmienić „Zmień” z kroku 7. `complete_onboarding` dodaje kategorie tylko, gdy użytkownik nie ma jeszcze żadnej.
- **Tabele `categories` i `notification_settings` powstają już teraz** (pełne kolumny ze spec 5), bo onboarding w nie zapisuje; ekrany do nich dojdą w Etapie 2 i 9.
- **Strony z kroku 5** zapisują się w nowej kolumnie `profiles.pending_pages text[]` (`null` = użytkownik jeszcze nie wybierał → domyślnie polecane z celów). Etap 6 je utworzy (spec 9.2).
- **Wznawianie:** nowa kolumna `profiles.onboarding_step smallint` (1–7, domyślnie 1) = najdalszy osiągnięty krok. Wejście na `/onboarding` przenosi na ten krok; na krok wyższy niż zapisany — też na zapisany.
- **„Zezwól”** w Etapie 1 woła tylko `Notification.requestPermission()` i zapisuje `push_enabled`; subskrypcja push w Etapie 9.
- **Zdjęcie:** prywatny bucket `avatars`, plik `{user_id}/avatar.{ext}`, PNG/JPEG/WebP do 2 MB, wyświetlanie przez podpisany adres (1 h). Wysyłka z przeglądarki prosto do Storage, potem akcja zapisuje `avatar_path`.
- **Lista stref:** jedna wspólna (z `Settings`): Warszawa, Berlin, Londyn, Kijów, Nowy Jork, Tokio + strefa wykryta z przeglądarki, jeśli jej nie ma na liście. Przesunięcie „UTC+01:00” liczone przez `Intl` dla bieżącej daty (zmienia się z czasem letnim), nie wpisane na sztywno.
- **Teksty różniące się między web a telefonem** (np. „Przeglądarka zapyta o zgodę” / „Telefon zapyta o zgodę”, podsumowanie kroku 7) — każdy układ ma tekst ze swojej makiety; obie wersje są w DOM, CSS pokazuje właściwą.
- **Ustawienia:** zakładki jak w makiecie (5), ale w Etapie 1 działa tylko „Ogólne” z kartami Profil i Cele; pozostałe zakładki pokazują „Ta zakładka powstanie w kolejnym etapie.” Karta Konto i „Usuń konto” — Etap 10. Na telefonie te same karty jedna pod drugą (pełne `MSettings` w Etapie 9–10).
- **„Pierwsze kroki”** na Dziś liczą 0–4 z funkcji `firstSteps(counts)`; w Etapie 1 wszystkie liczniki są 0 (tabel bloków, nawyków, treningów i snu jeszcze nie ma), kolejne etapy podają prawdziwe liczby.

## Review Focus
1. **Odświeżenie lub zamknięcie karty w środku onboardingu:** po powrocie użytkownik ląduje na zapisanym kroku z zapisanymi odpowiedziami; ręczne wejście na `/onboarding/7` przy zapisanym kroku 2 przenosi na `/onboarding/2` (testy w Task 4 i e2e w Task 10).
2. **Strefa z przeglądarki spoza listy albo niepoprawna** (`Asia/Kolkata`, `undefined`, `"Mars/Base"`): wykryta poprawna strefa dochodzi do listy i jest wybrana; niepoprawna → `Europe/Warsaw` (test w Task 2).
3. **Liczby wpisane po polsku i wartości spoza zakresu:** „72,5” w wadze zapisuje 72.5; „  ” w nazwie to błąd „Nazwa nie może być pusta.”; wartość spoza zakresu wysłana z pominięciem UI odrzuca serwer (zod) i baza (CHECK) (testy w Task 1 i 3).
4. **Brak API powiadomień albo odmowa** (Safari na iPhonie bez PWA, „Blokuj”): przycisk „Zezwól” nie wywraca strony, zostaje „Zezwól” z tekstem odmowy, przełączniki i „Dalej” dalej działają (test w Task 7).
5. **Podwójne „Przejdź do Dziś” albo ponowne ukończenie:** kategorie nie dublują się, `onboarded_at` nie zmienia się (pgTAP w Task 1, test przycisku w Task 7).

Dodatkowo: zdjęcie za duże albo w złym formacie pokazuje komunikat i nie blokuje kroku (Task 6).

---

### Task 1: Baza — kolumny profilu, kategorie, ustawienia powiadomień, Storage, `complete_onboarding`

**Files:**
- Create: `supabase/migrations/20261117000001_onboarding.sql`
- Create: `supabase/tests/onboarding.test.sql`
- Modify: `src/types/database.ts` (ręcznie, w kształcie generatora — lokalny Supabase nie działa w sandboksie)

**Interfaces:**
- Produces:
  - `profiles.onboarding_step smallint not null default 1 check (onboarding_step between 1 and 7)`, `profiles.pending_pages text[]` (null),
  - CHECK na `profiles`: `weight_kg between 30 and 250`, `height_cm between 120 and 230`, `sleep_goal_min between 300 and 660 and sleep_goal_min % 15 = 0`, `weekly_km_goal between 1 and 300`, `currency in ('PLN','EUR','USD','GBP')`, `char_length(btrim(display_name)) between 1 and 40` (gdy nie null), `referral_source in (…10 kluczy…)`; wszystkie dopuszczają null,
  - tabela `categories (id uuid pk default gen_random_uuid(), user_id …, name text not null, color text not null, position int not null, is_system bool not null default false, hidden bool not null default false, created_at timestamptz default now())` + RLS select/insert/update/delete własnych,
  - tabela `notification_settings` z kolumnami i domyślnymi ze spec 5 (`push_enabled default true`, `before_block_min int default 10 check (before_block_min in (5,10,15,30))`, `renewal_days_before default 3`, `renewal_hour default 9`, `renewals_enabled bool default true`, `weekly_summary default true`, `weekly_summary_at text default 'sun 18:00'`, `habits_enabled bool default false`, `quiet_from time default '23:00'`, `quiet_to time default '07:00'`, `quiet_enabled bool default false`) + RLS select/insert/update własnego wiersza,
  - bucket `avatars` (prywatny, `file_size_limit 2097152`, `allowed_mime_types {image/png,image/jpeg,image/webp}`) i polityki `storage.objects` select/insert/update/delete gdy `bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text`,
  - `handle_new_user()` nadpisana (`create or replace`): nazwa = `nullif(left(btrim(coalesce(display_name, full_name)), 40), '')` — inaczej nowy CHECK na długość nazwy zablokowałby rejestrację z długim „full_name” z Google,
  - funkcja `public.complete_onboarding(p_categories jsonb) returns void`, `security invoker`, `set search_path = ''`: jeśli `auth.uid()` nie ma żadnej kategorii, wstawia elementy `[{name, color, is_system}]` z `position` = indeks; potem `update profiles set onboarded_at = now() where user_id = auth.uid() and onboarded_at is null`. `grant execute … to authenticated`.

- [ ] **Step 1: Utwórz gałąź** `git switch -c feat/etap-1`.
- [ ] **Step 2: Napisz test pgTAP** `supabase/tests/onboarding.test.sql` (wzór: `profiles_rls.test.sql`, użytkownicy A i B):
  - `onboarding_step` nowego profilu = 1, `pending_pages` = null,
  - `throws_ok` przy `update profiles set weight_kg = 20` i przy `sleep_goal_min = 310` (nie co 15),
  - użytkownik C z `full_name` o długości 60 znaków powstaje, a jego `display_name` ma 40 znaków; `full_name` = `'   '` → `display_name` null,
  - jako A: `complete_onboarding('[{"name":"Studia","color":"#0070f3","is_system":false},{"name":"Sport","color":"#c2410c","is_system":true}]')` → 2 kategorie A, `onboarded_at` ustawione,
  - drugie wywołanie z innym zestawem → nadal 2 kategorie, `onboarded_at` bez zmian (Review Focus 5),
  - A nie widzi kategorii ani `notification_settings` B (B ma wiersze wstawione jako superuser), A nie wstawi kategorii z `user_id` B (`throws_ok`),
  - A nie wstawi obiektu do `storage.objects` w `avatars` pod ścieżką `<id B>/avatar.png` (`throws_ok`), a pod `<id A>/avatar.png` tak.
- [ ] **Step 3: Napisz migrację** wg Interfaces.
- [ ] **Step 4: Weryfikacja.** Lokalnie bez Dockera nie uruchomisz pgTAP — wypchnij gałąź i sprawdź zadanie `db` w CI (`supabase test db`). Oczekiwane: wszystkie testy `ok`.
- [ ] **Step 5: Uzupełnij `src/types/database.ts`** o nowe kolumny, tabele `categories`, `notification_settings` i `Functions.complete_onboarding: { Args: { p_categories: Json }; Returns: undefined }`. `pnpm typecheck` bez błędów.
- [ ] **Step 6: Commit** `feat(db): kolumny onboardingu, kategorie, ustawienia powiadomień, avatary i complete_onboarding`

### Task 2: Model onboardingu i strefy czasowe (czysta logika)

**Files:**
- Create: `src/features/onboarding/model.ts`, `src/features/onboarding/model.test.ts`
- Create: `src/lib/time/timezones.ts`, `src/lib/time/timezones.test.ts`

**Interfaces:**
- Produces (`model.ts`):
  - typy `RoleKey`, `GoalKey`, `PageKey`, `SourceKey`, `ReminderKey = 'before'|'renew'|'weekly'|'habits'`,
  - stałe z makiet (tytuł, opis): `ROLES` (5, kolejność i teksty z `OnboardingRole`), `GOALS` (7, z `OnboardingGoals`, z polem `page: PageKey | null`), `PAGE_TEMPLATES` (5: `name`, `desc`, `fields`, z `OnboardingPages`), `SOURCES` (10: `key`, `label` „Od znajomego”…„Inne”), `REMINDERS` (4: `title`, `when`, z `OnboardingNotify`), `CATEGORY_COLORS`,
  - `type OnboardingDraft = { name: string; avatarPath: string | null; timezone: string; weekStart: 'mon'|'sun'; clock: '24'|'12'; roles: RoleKey[]; studyField: string; goals: GoalKey[]; weeklyKm: number; sleepGoalMin: number; source: SourceKey | null; sourceOther: string; pages: PageKey[] | null; notify: { perm: boolean } & Record<ReminderKey, boolean> }`,
  - `categoriesForRoles(roles: RoleKey[]): { name: string; color: string; is_system: boolean }[]`,
  - `recommendedPages(goals: GoalKey[]): PageKey[]`,
  - `effectivePages(draft): PageKey[]` (`pages ?? recommendedPages(goals)`),
  - `toggleGoal(draft, goal): OnboardingDraft` (przełącza cel; jeśli cel ma stronę, ta strona włącza się/wyłącza razem z nim w `effectivePages`, jak w makiecie web),
  - `stepKm(km, dir: -1|1): number` (co 5, 5–150), `stepSleep(min, dir: -1|1): number` (co 15, 300–660), `formatSleep(min): string` („8:00”),
  - `canContinue(step: number, draft): boolean` (krok 1: `name.trim() !== ''`; reszta `true`),
  - `buildSummary(draft, variant: 'web'|'mobile', tzCity: string): { key: 'Profil'|'Kategorie'|'Strony'|'Przypomnienia'; value: string; step: 1|2|5|6 }[]` — web: „Mejson · Europe/Warsaw”, „N włączone”; telefon: „Mejson · Warszawa · tydzień od pn”, „N z 4 włączone” + „ · bez zgody na push” bez zgody; „brak” przy braku stron; „Ty”, gdy nazwa pusta.
- Produces (`timezones.ts`):
  - `utcOffsetLabel(tz: string, at: Date): string` → „UTC+01:00”, „UTC−05:00” (minus to znak U+2212 jak w makiecie),
  - `timezoneOptions(at: Date, detected?: string): { value: string; city: string; offset: string }[]` — 6 stref z Rozstrzygnięć (kolejność z `Settings`) + `detected`, jeśli poprawna i spoza listy (miasto = ostatni człon po `/`, `_` → spacja),
  - `safeTimezone(tz: string | undefined | null): string` → poprawna strefa albo `Europe/Warsaw`,
  - `formatClockTime(h: number, m: number, clock: '24'|'12'): string` → „08:00” / „8:00 AM” (wg makiety: `(h % 12) || 12`).

- [ ] **Step 1: Napisz testy `model.test.ts`:**
  - `categoriesForRoles(['student','sport'])` → nazwy `['Studia','Sport']`, Sport ma `is_system: true` i kolor `#c2410c`,
  - `categoriesForRoles([])` → `['Dom']`; `(['work','other'])` → `['Praca','Dom']`; `(['free'])` → `['Projekty']`; wszystkie 5 ról → `['Studia','Praca','Projekty','Sport','Dom']`,
  - `recommendedPages(['plan','subs','proj'])` → `['Subscriptions','Projects']`; `(['pass','books'])` → `['Passwords','Books']` w kolejności `PAGE_TEMPLATES`,
  - `toggleGoal` na szkicu z `pages: null, goals: ['subs']`: wyłączenie `subs` → `effectivePages` bez `Subscriptions`; włączenie `books` przy `pages: ['Websites']` → `['Books','Websites']` (kolejność `PAGE_TEMPLATES`); cel bez strony (`plan`) nie zmienia `pages`,
  - `stepKm(5,-1) === 5`, `stepKm(150,1) === 150`, `stepKm(25,1) === 30`; `stepSleep(300,-1) === 300`, `stepSleep(660,1) === 660`, `formatSleep(495) === '8:15'`,
  - `canContinue(1, {…name: '   '})` → false; `canContinue(4, …)` → true,
  - `buildSummary` web i telefon dla szkicu z makiety (Mejson, Europe/Warsaw, student+sport, strony Subscriptions+Projects, przypomnienia before/renew/weekly, `perm: false`) → dokładne napisy z Interfaces; telefon kończy się „3 z 4 włączone · bez zgody na push”.
- [ ] **Step 2: Napisz testy `timezones.test.ts`:**
  - `utcOffsetLabel('Europe/Warsaw', new Date('2026-11-17T12:00:00Z')) === 'UTC+01:00'`, w lipcu `'UTC+02:00'`; `('America/New_York', listopad) === 'UTC−05:00'`; `('Asia/Kolkata', …) === 'UTC+05:30'`,
  - `timezoneOptions(d)` ma 6 pozycji, pierwsza `{ value: 'Europe/Warsaw', city: 'Warszawa', offset: 'UTC+01:00' }`,
  - `timezoneOptions(d, 'Asia/Kolkata')` ma 7 pozycji z `city: 'Kolkata'`; `timezoneOptions(d, 'Europe/Berlin')` ma 6; `timezoneOptions(d, 'Mars/Base')` ma 6 (Review Focus 2),
  - `safeTimezone(undefined) === 'Europe/Warsaw'`, `safeTimezone('Mars/Base') === 'Europe/Warsaw'`, `safeTimezone('Asia/Kolkata') === 'Asia/Kolkata'`,
  - `formatClockTime(8,0,'24') === '08:00'`, `(17,0,'12') === '5:00 PM'`, `(0,30,'12') === '12:30 AM'`.
- [ ] **Step 3: Uruchom** `pnpm test src/features/onboarding src/lib/time`. Oczekiwane: FAIL (brak modułów).
- [ ] **Step 4: Zaimplementuj** oba moduły. Przesunięcie: `Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })` → „GMT+01:00” → „UTC+01:00”, „GMT” samo → „UTC+00:00”, `-` → `−`. Poprawność strefy: `try { new Intl.DateTimeFormat('en-US', { timeZone }) }`.
- [ ] **Step 5: Uruchom testy.** Oczekiwane: PASS.
- [ ] **Step 6: Commit** `feat(onboarding): model kroków, mapowanie ról i celów, strefy czasowe`

### Task 3: Walidacja profilu i celów (zod)

**Files:**
- Create: `src/features/profile/schemas.ts`, `src/features/profile/schemas.test.ts`

**Interfaces:**
- Produces:
  - `parseDecimal(raw: string): number | null` — przycina, zamienia `,` na `.`, pusty → `null`, nieliczba → `NaN`,
  - `profileSchema` (z `FormData`-owych stringów): `{ display_name: string (trim, 1–40), timezone: string (safeTimezone ≠ fallback dla niepoprawnej → błąd), weight_kg: number|null (30–250), height_cm: number|null (120–230) }`,
  - `goalsSchema`: `{ sleep_goal_min: int 300–660 co 15, weekly_km_goal: number 1–300, currency: 'PLN'|'EUR'|'USD'|'GBP', week_start: 'mon'|'sun' }`,
  - `onboardingStepSchemas: Record<1|2|3|4|5|6, ZodType>` — krok 1: `display_name, timezone, week_start, clock, avatar_path (string|null, musi zaczynać się od `${userId}/` — sprawdzane w akcji)`; krok 2: `roles` (podzbiór kluczy, bez duplikatów), `study_field` (trim, ≤ 80, pusty → null); krok 3: `goals`, `weekly_km_goal` (5–150 co 5), `sleep_goal_min`; krok 4: `referral_source` (klucz|null), `referral_other` (trim ≤ 80, tylko gdy `other`, inaczej null); krok 5: `pending_pages` (podzbiór kluczy); krok 6: `push_enabled`, `before`, `renew`, `weekly`, `habits` (bool),
  - komunikaty błędów dokładnie z `Settings`: „Nazwa nie może być pusta.”, „Podaj liczbę 30–250.”, „Podaj liczbę 120–230.”, „Podaj liczbę 1–300.”.

- [ ] **Step 1: Napisz testy:**
  - `parseDecimal(' 72,5 ') === 72.5`, `parseDecimal('') === null`, `Number.isNaN(parseDecimal('abc'))`,
  - `profileSchema` przyjmuje `{display_name:' Mejson ', timezone:'Europe/Warsaw', weight_kg:'72,5', height_cm:''}` → `display_name 'Mejson'`, `weight_kg 72.5`, `height_cm null`,
  - odrzuca `display_name: '   '` z komunikatem „Nazwa nie może być pusta.”; `weight_kg: '29'` → „Podaj liczbę 30–250.”; `height_cm: '231'` → „Podaj liczbę 120–230.”; `timezone: 'Mars/Base'` → błąd,
  - `goalsSchema` odrzuca `weekly_km_goal: '0'` i `'301'` („Podaj liczbę 1–300.”), `sleep_goal_min: 310`, `currency: 'JPY'`,
  - krok 2 odrzuca `roles: ['student','admin']`; krok 4 z `referral_source: 'friend', referral_other: 'x'` daje `referral_other: null`; krok 3 odrzuca `weekly_km_goal: 152`.
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj.** **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(profile): walidacja profilu, celów i kroków onboardingu`

### Task 4: Akcje serwera onboardingu, trasa `/onboarding/[krok]` i proxy

**Files:**
- Modify: `src/features/onboarding/actions.ts`, `src/features/onboarding/actions.test.ts`
- Modify: `src/lib/auth/route-guard.ts`, `src/lib/auth/route-guard.test.ts`
- Create: `src/app/(onboarding)/onboarding/[krok]/page.tsx`
- Modify: `src/app/(onboarding)/onboarding/page.tsx` (tylko przekierowanie na zapisany krok)
- Create: `src/features/onboarding/load-draft.ts` (+ test)
- Delete: `src/features/onboarding/onboarding-form.tsx` i jego test (zastąpi go kreator z Task 5)

**Interfaces:**
- Consumes: `onboardingStepSchemas` (Task 3), `categoriesForRoles`, `OnboardingDraft`, `safeTimezone` (Task 2), `complete_onboarding` (Task 1).
- Produces:
  - `loadDraft(profile: ProfileRow, notify: NotificationSettingsRow | null, detectedTz?: string): OnboardingDraft` — domyślne z makiety dla pustych pól: role `[]`, cele `[]`, km 25, sen 480, `notify` `{ perm: false, before: true, renew: true, weekly: true, habits: false }` gdy brak wiersza (`before` = `before_block_min !== null`),
  - `saveOnboardingStep(step: 1|2|3|4|5|6, payload: unknown): Promise<{ ok: true } | { ok: false; message: string }>` — waliduje schematem kroku, zapisuje pola do `profiles` (krok 6: upsert `notification_settings`), ustawia `onboarding_step = greatest(onboarding_step, step + 1)`; błąd zapisu → „Nie udało się zapisać. Spróbuj ponownie.”,
  - `completeOnboarding(): Promise<{ ok: false; message: string }>` — czyta `roles` z bazy, woła `rpc('complete_onboarding', { p_categories: categoriesForRoles(roles) })`, potem `redirect('/dzis')`,
  - `resolveRoute`: `/onboarding` i `/onboarding/*` przepuszczane dla nieukończonych, ukończony → `/dzis`; reszta bez zmian,
  - strona `/onboarding/[krok]`: `krok` spoza 1–7 → `notFound()`; `krok > onboarding_step` → `redirect('/onboarding/' + onboarding_step)`; renderuje `<OnboardingWizard step initialDraft avatarUrl />` (Task 5).

- [ ] **Step 1: Napisz testy `route-guard.test.ts`:** nieukończony na `/onboarding/3` → `null`; ukończony na `/onboarding/3` → `{ redirect: '/dzis' }`; nieukończony na `/dzis` → `{ redirect: '/onboarding' }` (bez zmian).
- [ ] **Step 2: Napisz testy `actions.test.ts`** (mock `createClient` jak w obecnym teście):
  - `saveOnboardingStep(1, { display_name: '', … })` → `ok: false`, brak wywołania `update`,
  - `saveOnboardingStep(2, { roles: ['student'], study_field: ' Cyber ' })` woła `update` z `{ roles: ['student'], study_field: 'Cyber', onboarding_step: … }` dla `user_id` zalogowanego,
  - krok 1 z `avatar_path` cudzego folderu → `ok: false`,
  - krok 6 woła `upsert` na `notification_settings` z `before_block_min: 10` (gdy `before`) / `null`,
  - `completeOnboarding` przy rolach `['sport']` woła `rpc('complete_onboarding', { p_categories: [{ name: 'Sport', color: '#c2410c', is_system: true }] })` i `redirect('/dzis')`; błąd RPC → komunikat, bez przekierowania.
- [ ] **Step 3: Napisz test `load-draft.test.ts`:** profil z nullami → domyślne z Interfaces; `timezone: null` + `detectedTz 'Asia/Kolkata'` → `'Asia/Kolkata'`; `pending_pages: []` zostaje `[]` (nie `null`).
- [ ] **Step 4: Uruchom** — FAIL. **Step 5: Zaimplementuj.** Postęp kroku ustaw w osobnym `update … set onboarding_step = N where onboarding_step < N` (bez cofania). Strona: dane zależą od ciasteczek → `await connection()` i `Suspense` jak w `app-shell.tsx`.
- [ ] **Step 6: Uruchom** `pnpm test && pnpm typecheck` — PASS.
- [ ] **Step 7: Commit** `feat(onboarding): zapis po każdym kroku, wznawianie i ukończenie`

### Task 5: Kreator — układ, pasek postępu, podgląd na żywo, licznik −/+

**Files:**
- Create: `src/features/onboarding/wizard.tsx` (+ `wizard.test.tsx`)
- Create: `src/features/onboarding/live-preview.tsx` (+ `live-preview.test.tsx`)
- Create: `src/components/controls/stepper.tsx` (+ `stepper.test.tsx`), eksport w `index.ts`

**Interfaces:**
- Consumes: `OnboardingDraft`, `canContinue`, `categoriesForRoles`, `effectivePages`, `formatClockTime` (Task 2), `saveOnboardingStep`, `completeOnboarding` (Task 4), `signOut` (`src/features/auth/actions.ts`), `RhytmLogo`, `Button`.
- Produces:
  - `Stepper({ value: string; onDec(): void; onInc(): void; decDisabled?: boolean; incDisabled?: boolean; ariaLabel: string })` — „−” wartość mono „+”, przyciski z `aria-label` „Zmniejsz” / „Zwiększ” + nazwa; telefon: przyciski 44 px (`MOnboarding`), web: 32 px *[Claude, makieta web nie ma licznika — wygląd jak `Settings` „Cel snu”]*,
  - `OnboardingWizard({ step: 1..7; initialDraft: OnboardingDraft; avatarUrl: string | null })` — trzyma szkic w stanie; renderuje:
    - web (≥ 800 px): nagłówek (logo, „Krok n z 7” mono, „Wyloguj”), karta 1120×720, pasek 7 segmentów, lewa kolumna 520 px z treścią kroku i stopką („Wstecz” zwykły, nieaktywny na kroku 1; „Pomiń” ghost tylko na kroku 4; „Dalej” główny, na kroku 7 „Przejdź do Dziś”), prawa kolumna `LivePreview`,
    - telefon (< 800 px): nagłówek z logo (krok 1) albo „‹ Wstecz”, „Krok n z 7”, „Wyloguj”; pasek 7 segmentów (4 px, `#171717` do bieżącego, reszta `#e5e5e5`); treść; przyklejony dół z „Dalej” (krok 4 też „Pomiń”, krok 7 „Przejdź do Dziś”); bez podglądu,
    - „Dalej”: nieaktywne, gdy `!canContinue`; w trakcie zapisu nieaktywne (jeden request); sukces → `router.push('/onboarding/' + (step + 1))`; błąd → komunikat pod przyciskiem (`role="alert"`, 13 px, `#b91c1c`),
    - „Pomiń” (krok 4): zapisuje `referral_source: null, referral_other: null` i idzie do kroku 5,
    - treść kroku z rejestru `STEP_VIEWS[step]` — komponenty kroków dochodzą w Task 6–7; do tego czasu prosty nagłówek kroku,
  - `LivePreview({ draft; step; avatarUrl; now: Date })` — wg wspólnego fragmentu skryptów makiet (`pv`):
    - mini sidebar: awatar (zdjęcie albo inicjały — pierwsze litery słów, maks. 2, wielkie), imię (pusty → „Ty”), strefa, „Moduły” (Dziś, Kalendarz, Sport, Nawyki i sen), „Strony” (`effectivePages` albo „Brak stron”),
    - nagłówek dnia: dzisiejsza data w strefie szkicu („Wtorek, 17 listopada”), linia „Tydzień od poniedziałku · 16–22.11 · zegar 24 h” (od niedzieli: „od niedzieli · 15–21.11”, liczone dla bieżącego tygodnia),
    - chipy kategorii z `categoriesForRoles` (kropka w kolorze, tło/ramka z `TINT` makiety),
    - bloki przykładowe dla każdej kategorii z `BL` makiety (godzina wg `formatClockTime`, tytuł, licznik), posortowane po godzinie,
    - zielony obrys: krok 1 profil, krok 2 kategorie, kroki 3 i 5 lista stron; krok 6: dymek „Za 10 min · {pierwszy blok}” / „Start o {godzina}”, gdy `perm && before`,
    - cały podgląd `aria-hidden="true"` (ozdoba, treść jest w formularzu).

- [ ] **Step 1: Napisz `stepper.test.tsx`:** klik „+” woła `onInc`; `decDisabled` → „−” ma `disabled`; wartość widoczna.
- [ ] **Step 2: Napisz `live-preview.test.tsx`** (`now = new Date('2026-11-17T09:00:00Z')`):
  - szkic z makiety: inicjały „ME”, „Wtorek, 17 listopada”, „Tydzień od poniedziałku · 16–22.11 · zegar 24 h”, chipy „Studia”, „Sport”, bloki „08:00 Matematyka — ćwiczenia” przed „17:00 Bieg 10 km”,
  - `clock: '12'` → „5:00 PM”; `weekStart: 'sun'` → „od niedzieli · 15–21.11”,
  - krok 2 → element kategorii ma klasę/styl obrysu, profil nie; krok 6 z `perm` i `before` → „Za 10 min · Matematyka — ćwiczenia”,
  - brak stron → „Brak stron”.
- [ ] **Step 3: Napisz `wizard.test.tsx`** (mock akcji i `useRouter`):
  - krok 1 z pustą nazwą: „Dalej” `disabled`; po wpisaniu nazwy aktywne,
  - klik „Dalej” na kroku 2 woła `saveOnboardingStep(2, …)` raz przy podwójnym kliknięciu i potem `push('/onboarding/3')`,
  - błąd akcji → `role="alert"` z komunikatem, bez `push`,
  - krok 4 ma „Pomiń”, krok 3 nie; krok 7 ma „Przejdź do Dziś” zamiast „Dalej”,
  - „Wstecz” na kroku 3 → `push('/onboarding/2')`; na kroku 1 `disabled`.
- [ ] **Step 4: Uruchom** — FAIL. **Step 5: Zaimplementuj.** Wymiary, kolory, odstępy z `Onboarding.dc.html` (style w `<style>` i atrybutach). Podgląd: wszystkie stałe (`CAT`, `TINT`, `BL`) przepisz z makiety do `live-preview.tsx`.
- [ ] **Step 6: Uruchom** testy i `pnpm lint` — PASS.
- [ ] **Step 7: Commit** `feat(onboarding): kreator 7 kroków z podglądem na żywo`

### Task 6: Kroki 1–4 (profil ze zdjęciem, role, cele, źródło)

**Files:**
- Create: `src/features/onboarding/steps/step-profile.tsx`, `step-roles.tsx`, `step-goals.tsx`, `step-source.tsx` (+ testy w `steps/*.test.tsx`)
- Create: `src/features/onboarding/avatar-upload.ts` (+ test)
- Modify: `src/features/onboarding/wizard.tsx` (rejestr `STEP_VIEWS`)

**Interfaces:**
- Consumes: `OnboardingDraft`, stałe i funkcje z Task 2, `timezoneOptions`, `utcOffsetLabel`; kontrolki `TextField`, `Dropdown`, `Segment`, `Checkbox`, `Chip`, `Stepper`; `createClient` z `src/lib/supabase/client.ts`.
- Produces:
  - każdy krok: `({ draft, onChange: (d: OnboardingDraft) => void }) => JSX.Element`,
  - `validateAvatarFile(file: File): string | null` → `null` albo „Plik jest za duży (maks. 2 MB).” / „Wybierz zdjęcie PNG, JPG albo WebP.” *[Claude, makieta bez komunikatu]*,
  - `uploadAvatar(file: File, userId: string): Promise<{ path: string } | { error: string }>` — `storage.from('avatars').upload(`${userId}/avatar.${ext}`, file, { upsert: true, contentType })`; błąd → „Nie udało się wgrać zdjęcia.”.
- Zawartość kroków (teksty dosłownie z makiet, telefon z `MOnboarding`):
  - **1 „Uzupełnij profil”** — podtytuł „Te dane widzisz tylko Ty. Zmienisz je później w Ustawieniach”; awatar (zdjęcie / inicjały), „Zdjęcie profilowe”, „Bez zdjęcia pokażemy inicjały”, „Wgraj” (ukryty `input type=file accept="image/png,image/jpeg,image/webp"` — to nie data/godzina, więc dozwolony); „Imię lub pseudonim” (`TextField`); „Strefa czasowa” (`Dropdown`, opcja: miasto + dopisek mono UTC; web pokazuje wartość jak „Europe/Warsaw (UTC+01:00)”), pod nią „Wykryta z przeglądarki” gdy strefa = wykryta; „Tydzień zaczyna się od” (`Segment`: Poniedziałku / Niedzieli); „Format godziny” (`Segment`: „24 h · 14:30” / „12 h · 2:30 PM”),
  - **2 „Kim jesteś?”** — „Dopasujemy kategorie w kalendarzu. Możesz zaznaczyć kilka”; 5 ról z `ROLES` (web: karty `.opt` w siatce 2 kolumn, ostatnia na całą szerokość; telefon: lista z `Checkbox`); przy Studencie „Kierunek studiów” z dopiskiem „opcjonalnie”; pod listą „W kalendarzu: Studia, Sport” (web) / chipy kategorii „W kalendarzu” (telefon), na żywo,
  - **3 „Co chcesz ogarnąć w rhytm?”** — „Na tej podstawie przygotujemy startowe strony i cele”; 7 celów (web: karty `.opt`; telefon: kafelki 2×N); zmiana przez `toggleGoal`; Treningi → „Kilometry w tygodniu” `Stepper` „25 km”; Nawyki i sen → „Cel snu” `Stepper` „8:00”,
  - **4 „Skąd o nas usłyszałeś?”** — „Jedno pytanie, które mówi nam, gdzie warto o rhytm opowiadać. Możesz je pominąć”; 10 `Chip` z `SOURCES` (jeden wybór; klik wybranego odznacza); „Inne” → `TextField` „Gdzie dokładnie?”.

- [ ] **Step 1: Napisz testy kroków:**
  - profil: wpisanie nazwy woła `onChange` z `name`; wybór „Niedzieli” → `weekStart: 'sun'`; plik 3 MB → komunikat „Plik jest za duży (maks. 2 MB).” i brak `uploadAvatar`; plik `.gif` → komunikat formatu,
  - role: zaznaczenie „Student” pokazuje „Kierunek studiów” i tekst „W kalendarzu: Studia”; odznaczenie wszystkiego → „W kalendarzu: Dom”,
  - cele: odznaczenie „Treningi” chowa „Kilometry w tygodniu”; „+” przy km z 150 nie zmienia wartości (przycisk `disabled`),
  - źródło: klik „Inne” pokazuje „Gdzie dokładnie?”; ponowny klik „Inne” odznacza i chowa pole.
- [ ] **Step 2: Napisz test `avatar-upload.test.ts`** dla `validateAvatarFile` (2 MB dokładnie → OK, 2 MB + 1 B → błąd, `image/webp` → OK).
- [ ] **Step 3: Uruchom** — FAIL. **Step 4: Zaimplementuj** i podłącz do `STEP_VIEWS`. Po udanym uploadzie szkic dostaje `avatarPath`, a podgląd pokazuje `URL.createObjectURL(file)` (zwalniany przy odmontowaniu).
- [ ] **Step 5: Uruchom** testy, `pnpm lint`, `pnpm typecheck` — PASS.
- [ ] **Step 6: Commit** `feat(onboarding): kroki profil, role, cele i źródło`

### Task 7: Kroki 5–7 (strony, powiadomienia, podsumowanie)

**Files:**
- Create: `src/features/onboarding/steps/step-pages.tsx`, `step-notify.tsx`, `step-done.tsx` (+ testy)
- Modify: `src/features/onboarding/wizard.tsx`

**Interfaces:**
- Consumes: `PAGE_TEMPLATES`, `recommendedPages`, `effectivePages`, `REMINDERS`, `buildSummary`, `timezoneOptions` (Task 2); `Switch`, `Checkbox`, `StatusBadge`/plakietka; `completeOnboarding` (Task 4) przez kreator.
- Produces:
  - `requestBrowserPermission(): Promise<'granted' | 'denied' | 'unsupported'>` w `step-notify.tsx` — brak `window.Notification` → `'unsupported'`; wyjątek → `'denied'`,
  - zachowanie i teksty:
    - **5 „Od czego zaczynasz?”** — web: „Dodamy te strony do sidebaru. Zaznaczyliśmy je na podstawie Twoich celów”, telefon: „Dodamy te strony do listy Stron. Zaznaczyliśmy je na podstawie Twoich celów.”; 5 kart (nazwa, plakietka „z Twoich celów” przy `recommendedPages`, opis, pola mono), zaznaczanie zmienia `pages`; stopka „Pustą stronę i kolejne szablony dodasz później przyciskiem „Nowa strona” w sidebarze” (telefon: „…przyciskiem „Nowa strona”.”),
    - **6 „Przypomnienia”** — „Wybierz, o czym mamy Ci przypominać. Ustawienia zmienisz w każdej chwili”; karta „Powiadomienia w przeglądarce” (telefon „Powiadomienia”) z tekstem: bez zgody „Przeglądarka zapyta o zgodę” (telefon „Telefon zapyta o zgodę”), ze zgodą „Przeglądarka pozwoliła na powiadomienia” (telefon „Telefon pozwolił na powiadomienia”), po odmowie albo braku API „Przeglądarka nie pozwoliła na powiadomienia” *[Claude]*; „Zezwól” → `granted` → `perm: true`, widać „Włączone” i „Anuluj” (cofa `perm`); 4 wiersze z `REMINDERS` z `Switch` (telefon: wiersze z kryciem .55 bez zgody, ale klikalne); wskazówka PWA (web i telefon — teksty z makiet),
    - **7 „Gotowe, {imię}”** — „Twój rhytm jest ułożony. Oto co przygotowaliśmy”; wiersze z `buildSummary` (web/telefon) z „Zmień” → `push('/onboarding/' + step)`; web: „Pierwszy blok dodasz skrótem” + klawisze „Ctrl” „K”; telefon: „Pierwszy blok dodasz przyciskiem „+” na ekranie Dziś.”; „Przejdź do Dziś” woła `completeOnboarding` raz (przycisk nieaktywny w trakcie).

- [ ] **Step 1: Napisz testy:**
  - strony: szkic z celami `subs, proj` i `pages: null` → zaznaczone Subscriptions i Projects z plakietką „z Twoich celów”; klik „Books” dodaje `Books`,
  - powiadomienia: `window.Notification` usunięte → klik „Zezwól” nie rzuca, zostaje „Zezwól”, widać „Przeglądarka nie pozwoliła na powiadomienia” (Review Focus 4); mock `requestPermission` → `'granted'` → „Włączone” i „Anuluj”; „Anuluj” → wraca „Zezwól”; przełącznik „Nawyki na dziś” zmienia `notify.habits`,
  - gotowe: „Zmień” przy Strony → `push('/onboarding/5')`; podwójny klik „Przejdź do Dziś” → jedno wywołanie `completeOnboarding` (Review Focus 5).
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj** i podłącz. **Step 4: Uruchom** testy, lint, typecheck — PASS.
- [ ] **Step 5: Commit** `feat(onboarding): kroki strony, przypomnienia i podsumowanie`

### Task 8: Ustawienia → Ogólne (Profil, Cele) i zdjęcie w sidebarze

**Files:**
- Create: `src/app/(app)/ustawienia/[zakladka]/page.tsx`; Modify: `src/app/(app)/ustawienia/page.tsx` (→ `redirect('/ustawienia/ogolne')`)
- Create: `src/features/settings/settings-tabs.tsx`, `profile-card.tsx`, `goals-card.tsx`, `use-card-form.ts`, `actions.ts` (+ testy)
- Modify: `src/components/shell/app-shell.tsx` (podpisany adres zdjęcia → `avatarUrl`)

**Interfaces:**
- Consumes: `profileSchema`, `goalsSchema`, `parseDecimal` (Task 3), `timezoneOptions` (Task 2), `Stepper` (Task 5), `Dropdown`, `TextField`, `Button`, `ModuleHeader`.
- Produces:
  - `useCardForm<T>(saved: T): { value: T; set(patch: Partial<T>): void; dirty: boolean; reset(): void; markSaved(next: T): void; message: 'idle' | 'dirty' | 'saved' }` — `dirty` porównuje `String()` pól jak makieta; po zmianie komunikat „saved” znika,
  - `saveProfile(input): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>`, `saveGoals(input)` — walidacja zod, update `profiles`, `revalidatePath('/', 'layout')`,
  - zakładki: Ogólne (`ogolne`), Konto i bezpieczeństwo (`konto`), Sejf (`sejf`), Powiadomienia (`powiadomienia`), Kategorie kalendarza (`kategorie`); nieznana → `notFound()`; inne niż `ogolne` → „Ta zakładka powstanie w kolejnym etapie.”,
  - **Karta Profil** (teksty z `Settings`): opis „Waga i wzrost służą do liczenia kcal biegów.”; Wyświetlana nazwa, Strefa czasowa (`Dropdown` miasto + UTC), Waga (kg), Wzrost (cm) (placeholder „np. 75”); błąd pod polem na żywo; stopka: „Waga i wzrost są opcjonalne.” / „Masz niezapisane zmiany.” / zielone „Zapisano ✓”; „Cofnij” widoczne przy zmianach; „Zapisz” aktywne tylko przy zmianach i bez błędów,
  - **Karta Cele**: opis „Pokazywane na ekranie Dziś, w Sporcie i przy śnie.”; Cel snu (`Stepper` 5:00–11:00 co 15), Tygodniowy cel km (pole, 1–300), Waluta stron (`Dropdown`: PLN zł, EUR €, USD $, GBP £), Tydzień zaczyna się w (`Dropdown`: Poniedziałek / Niedzielę); stopka „Waluta dotyczy pól „Kwota cykliczna”.” / „Masz niezapisane zmiany.” / „Zapisano ✓ — cele zaktualizowane na ekranie Dziś”,
  - sidebar i dymek konta pokazują zdjęcie z `createSignedUrl(avatar_path, 3600)`; brak lub błąd → inicjały jak dotąd.

- [ ] **Step 1: Napisz `use-card-form.test.ts`:** zmiana pola → `dirty`, `message 'dirty'`; `reset()` → wartości zapisane; `markSaved` → `message 'saved'`, `dirty false`; ponowna zmiana → `'dirty'`.
- [ ] **Step 2: Napisz testy kart:** pusta nazwa → „Nazwa nie może być pusta.” i „Zapisz” `disabled`; waga „72,5” → `saveProfile` z `weight_kg: 72.5` (Review Focus 3); „Cofnij” przywraca; po sukcesie „Zapisano ✓”; Cele: km „0” → „Podaj liczbę 1–300.”; „−” przy 5:00 `disabled`.
- [ ] **Step 3: Napisz test `actions.test.ts`:** `saveProfile` z wagą 20 → `ok: false, errors.weight_kg = 'Podaj liczbę 30–250.'`, bez `update`; poprawne dane → `update` z przyciętą nazwą.
- [ ] **Step 4: Uruchom** — FAIL. **Step 5: Zaimplementuj.** Wygląd kart, zakładek i stopek 1:1 z `Settings.dc.html` (web); na telefonie karty jedna pod drugą, zakładki przewijane poziomo.
- [ ] **Step 6: Uruchom** testy, lint, typecheck — PASS.
- [ ] **Step 7: Commit** `feat(settings): Ogólne — karty Profil i Cele, zdjęcie w sidebarze`

### Task 9: Dziś w stanie pustym (web i telefon)

**Files:**
- Create: `src/features/today/first-steps.ts` (+ test), `src/features/today/empty-today.tsx` (+ test)
- Modify: `src/app/(app)/dzis/page.tsx`

**Interfaces:**
- Consumes: `ModuleHeader`, `Button`, `MonoLabel`, profil (`display_name`, `timezone`).
- Produces:
  - `firstSteps(counts: { blocks: number; habits: number; workouts: number; sleepLogs: number }): { key: 'block'|'habit'|'workout'|'sleep'; title: string; hint: string | null; href: string; done: boolean }[]` + `doneCount` — teksty z `EmptyToday`: „Dodaj pierwszy blok w kalendarzu” (`/kalendarz`), „Dodaj nawyk” / „np. woda, czytanie, rozciąganie” (`/nawyki`), „Zapisz trening” / „bieg albo siłownia” (`/sport`), „Wpisz ostatnią noc” / „godzina zaśnięcia i pobudki” (`/nawyki`),
  - `EmptyToday({ name: string; steps })` — „Witaj w rhytm, {name}”, „Cztery kroki i Dziś zacznie pokazywać Twój tydzień.”, karta „Pierwsze kroki” z „x / 4”, wiersze (zrobione: zielony ✓ i przekreślenie wg makiety; niezrobione: „Dodaj”), karta „Plan dnia jest pusty” / „Bloki z kalendarza na dziś pojawią się tutaj jako oś czasu.” / „+ Nowy blok” (`/kalendarz`); w nagłówku web przycisk „Nowy blok”,
  - telefon: `ModuleHeader` z `phoneLabel` = dzień tygodnia i data w strefie profilu („Wtorek · 17 listopada”, wzór `MToday`), te same karty w jednej kolumnie, cele dotyku ≥ 44 px.

- [ ] **Step 1: Napisz testy:** `firstSteps` z zerami → 4 niezrobione, `doneCount 0`; `{blocks: 2}` → pierwszy `done`, `doneCount 1`; render: „Witaj w rhytm, Mejson”, „0 / 4”, cztery linki „Dodaj” z poprawnymi `href`.
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj** wg `EmptyToday.dc.html`; strona `/dzis` czyta profil i podaje zera (Rozstrzygnięcia). **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(today): Dziś w stanie pustym z pierwszymi krokami`

### Task 10: E2E, zrzuty, dokumentacja i wdrożenie

**Files:**
- Create: `e2e/onboarding.spec.ts`, `e2e/settings.spec.ts`
- Modify: `e2e/visual.spec.ts`, `e2e/auth.spec.ts` (jeśli po rejestracji klikał stary „Dalej” onboardingu), `e2e/helpers/konto.ts` (pomocnik `finishOnboardingViaApi` dla testów, które go pomijają, jeśli potrzebny)
- Modify: `docs/setup.md` (sekcja „Nowa migracja”: `pnpm exec supabase db push --remote` po scaleniu Etapu 1), `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md` (odhaczona lista Etapu 1)

**Interfaces:**
- Consumes: wszystkie poprzednie zadania; `createConfirmedUser(email, haslo, false)`, `logInViaForm` z `e2e/helpers/konto.ts`.

- [ ] **Step 1: Napisz `e2e/onboarding.spec.ts`** (oba projekty `web` i `mobile`, `test.skip(!process.env.E2E_SUPABASE)`):
  - nowy użytkownik po zalogowaniu ląduje na `/onboarding/1`; „Dalej” nieaktywne bez imienia,
  - przejście 1→7 z wyborami: imię „Mejson”, Niedzieli, 12 h, Student + Trenuję regularnie, kierunek, cele Subskrypcje i Treningi (+ km „+”), źródło „Inne” z tekstem, strony (Subscriptions zaznaczone), przypomnienia (przełączenie „Nawyki na dziś”; `context.grantPermissions(['notifications'])` → „Zezwól” → „Włączone”),
  - w połowie (po kroku 3) `page.reload()` i wejście na `/onboarding` → ląduje na `/onboarding/4` z zachowanym wyborem; `goto('/onboarding/7')` → `/onboarding/4` (Review Focus 1),
  - krok 7: podsumowanie zawiera „Studia, Sport” i „Subscriptions”; „Zmień” przy Profil → krok 1 z wpisanym „Mejson”; powrót „Dalej” do 7; „Przejdź do Dziś” → `/dzis` z „Witaj w rhytm, Mejson”,
  - web: podgląd pokazuje „Studia” po zaznaczeniu Studenta (na żywo); mobile: podgląd niewidoczny,
  - po ukończeniu `goto('/onboarding/2')` → `/dzis`.
- [ ] **Step 2: Napisz `e2e/settings.spec.ts`:** użytkownik po onboardingu → `/ustawienia` → `/ustawienia/ogolne`; zmiana nazwy → „Masz niezapisane zmiany.” → „Zapisz” → „Zapisano ✓”, po odświeżeniu nowa nazwa także w sidebarze (web); waga „20” → „Podaj liczbę 30–250.” i „Zapisz” nieaktywne; cel snu „+” → „8:15” → zapis.
- [ ] **Step 3: Rozszerz `visual.spec.ts`** o zrzuty: `/onboarding/1`…`/onboarding/7` (makiety Onboarding…OnboardingDone / MOnboarding), `/dzis` pusty (EmptyToday / MToday), `/ustawienia/ogolne` (Settings). Zrzuty makiet: `pnpm mockups:shots`.
- [ ] **Step 4: Uruchom lokalnie** `pnpm test && pnpm lint && pnpm typecheck && pnpm build`. Oczekiwane: wszystko zielone. E2E i pgTAP sprawdź w CI po pushu gałęzi (zadania `db` i `e2e`).
- [ ] **Step 5: Porównaj zrzuty z makietami** (artefakt CI `test-results/visual` vs `test-results/mockups`) i popraw różnice w układzie, odstępach i tekstach.
- [ ] **Step 6: Zaktualizuj dokumentację** (`docs/setup.md`, odhaczona lista w mapie etapów).
- [ ] **Step 7: Commit** `test(e2e): onboarding, ustawienia i zrzuty Etapu 1; docs`
- [ ] **Step 8: Po zielonym CI i akceptacji Mejsona:** scalenie do `main` (Vercel wdroży sam), a Mejson uruchamia u siebie `pnpm exec supabase db push --remote`, żeby nowa migracja trafiła do bazy w chmurze — **przed** pierwszym wejściem na nową wersję.
