# COSS UI — Etap 2g (logowanie, konto, 404, onboarding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ekrany konta (logowanie, rejestracja, reset hasła, „Sprawdź skrzynkę”, nowe hasło, potwierdzono, link wygasł), 404 i onboarding na webie wyglądają jak makiety COSS, bez zmian funkcji.

**Architecture:** Dziś ekrany są zrobione wg starych makiet (`Login.dc.html` itd.): tło z siatką 48 px, etykiety `font-mono`, stopki jako linki w treści. Wspólna ramka ekranów konta to `src/components/auth/auth-shell.tsx` (`AuthShell`), onboardingu — `src/features/onboarding/wizard.tsx`. Najpierw przerabiamy ramki (Task 1, Task 5), potem treści ekranów. Kontrolki z `@/components/controls` (w tym `Card`, `CardFooter`, `StatusBadge`, `Dropdown variant="select"`, `Stepper wide`, `Checkbox` z etapu 2f) — bez zmiany ich domyślnego wyglądu.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, radix-ui, lucide-react, Vitest + Testing Library, Playwright (e2e w CI z lokalnym Supabase i testowym Turnstile).

**Spec:** `docs/superpowers/specs/2026-11-22-coss-etap-2g-start-design.md` (nadrzędny: `docs/superpowers/specs/2026-11-20-coss-ui-design.md`)

## Global Constraints

- **Makiety są wiążące, odwzorowujemy je 1:1** (`docs/design/mockups/`, arkusz `coss/coss.css`): `CLogin`, `CRegister`, `CForgot`, `CEmailConfirmed` (lewa karta = potwierdzono, prawa = link wygasł), `CNotFound`, `COnboarding` (krok 1 profil), `COnboardingRole`, `COnboardingSource`, `COnboardingGoals`, `COnboardingPages`, `COnboardingNotify`, `COnboardingDone`, `COnbPreview`. Zrzuty: `PW_CHANNEL=chrome pnpm mockups:shots <Nazwa>` → `test-results/mockups/<Nazwa>.png`.
- **Funkcjonalnie nic się nie zmienia.** Google OAuth, Turnstile (widżet Cloudflare — jego wnętrza nie stylujemy), walidacje, przekierowania, akcje serwerowe, zapis szkicu i kroków onboardingu, uprawnienia powiadomień, teksty, etykiety, `autoComplete`, role i `aria-*` zostają. Elementy makiet opisujące nieistniejące funkcje nie są dodawane (np. „Szukaj ⌘K” na 404 zostaje wyłączone jak dziś; „Ctrl K” w ostatnim kroku zostaje dzisiejszym tekstem).
- **Ekrany bez makiety** („Sprawdź skrzynkę”, „Nowe hasło”): styl karty z `CForgot`/`CEmailConfirmed`.
- **Telefon** (`max-[799px]:`): układy zostają (Etap 3), cele ≥ 44 px, nie mniejsze niż dziś.
- **Kolory UI wyłącznie z tokenów.** `node scripts/coss-kolory.mjs --check` pokazuje tylko 2 znane pozostałości w `sport/mobile/m-sport`.
- **Konwencje COSS:** fokus `focus-visible:shadow-focus outline-none`; wyłączone `opacity-[.64]`; pola `FIELD`/`TextField`; odznaki `StatusBadge`; w treści COSS bez `font-mono` (liczby `tabular-nums`); `cn` = twMerge (nadpisania na końcu).
- **Wspólne kontrolki:** tylko opcjonalne warianty, domyślny wygląd bit w bit; istniejące testy kontrolek przechodzą bez zmian.
- **Bez nowych bibliotek.** Kod płaski, bez funkcji pomocniczych skaczących po plikach, komentarze po polsku.
- **Testy:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `node scripts/coss-kolory.mjs --check`; e2e w CI (`e2e/auth*.spec.ts`, `e2e/onboarding*.spec.ts`, `e2e/visual.spec.ts`) — przy zmianie struktury DOM aktualizuj lokatory e2e na role/etykiety/`data-testid`, nie zmieniaj ich asercji zachowania.
- **Git:** commity tylko na `feat/coss-start`, robi je koordynator (implementer nie commituje). Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` oraz `Claude-Session: https://claude.ai/code/session_01WRp6JuSYwef6J2Ypw1fKow`.

## Review Focus

1. **Formularze konta po przestylowaniu:** wysłanie Enterem, komunikaty błędów `role="alert"`, blokada przycisku przy braku tokenu Turnstile i podczas wysyłki — jak dziś. Test: Task 2 i Task 3.
2. **Pokaż hasło i pasek siły hasła w rejestracji/nowym haśle** działają i mają etykiety. Test: Task 2 i Task 3.
3. **Onboarding „Wstecz/Dalej”**: przyciski i klawiatura przechodzą między krokami, pasek postępu pokazuje bieżący krok (aria). Test: Task 5.
4. **Telefon:** ramki konta i onboardingu nie zmieniają układu `max-[799px]:`. Test: Task 1 i Task 5 (klasy telefonu zachowane).
5. **404 dla gościa** (bez powłoki) i zalogowanego (z powłoką) — oba warianty renderują treść. Test: Task 4.

---

### Task 1: Ramka ekranów konta (`AuthShell`)

**Files:**
- Modify: `src/components/auth/auth-shell.tsx`, `docs/design/mockups/index.html`
- Create/Test: `src/components/auth/auth-shell.test.tsx`

**Interfaces:**
- Produces: `AuthShell` dostaje opcjonalne propsy `footer?: ReactNode` (szary pasek stopki karty jak `.foot` w `CForgot`/`CEmailConfirmed`: tło z tokenu, `border-t`, wyśrodkowany tekst 13 px muted, zaokrąglenie dolnych rogów karty) i `progress?: { step: number; total: number }` (segmenty nad kartą jak w `CForgot`: `total` pasków 3 px, wypełnione do `step` kolorem `foreground`, reszta `border`; `aria-hidden`, bo krok mówi `headerNote`). Istniejące propsy bez zmian.

- [ ] **Step 1: Testy (FAIL):**
  - `"web: tło bez siatki"` — korzeń nie ma klas z `linear-gradient` ani `bg-[length:48px_48px]`.
  - `"headerNote jako szara odznaka bez font-mono"` — tekst „krok 1 / 3” w elemencie bez `font-mono`, z klasami `StatusBadge` tone gray (lub równoważnymi z makiety `CForgot`).
  - `"akcja nagłówka jako przycisk outline 32 px"` — link „Załóż konto” ma klasy wariantu przycisku (jak `Button variant="secondary"`/outline z controls, wysokość 32 px).
  - `"footer renderuje pasek stopki karty"` i `"progress renderuje total segmentów, step wypełnionych"`.
  - `"telefon bez zmian"` — zachowane `max-[799px]:` klasy karty (brak ramki/cienia, marginesy 56/24/24) i nagłówka „Wstecz”.
- [ ] **Step 2:** `pnpm vitest run src/components/auth/auth-shell.test.tsx` → FAIL.
- [ ] **Step 3: Zaimplementuj** wg `CLogin`/`CForgot`/`CEmailConfirmed`: tło `bg-panel` bez siatki; logo i nagłówek z makiety; karta: biel, `border-border`, `rounded-xl`, cień `shadow-card`, padding i szerokości z makiet (CLogin 400 px łącznie); `footer` i `progress` jak wyżej. `docs/design/mockups/index.html`: w sekcji „COSS UI — web, wiążące” dopisz 13 makiet z tabeli specu (bez duplikatów) i zaktualizuj licznik.
- [ ] **Step 4:** testy → PASS; `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`.
- [ ] **Step 5:** porównanie wizualne `/logowanie` i `/reset-hasla` z `CLogin`/`CForgot` (dev server `pnpm exec next dev -p 3999`, strony publiczne — bez trasy tymczasowej; potem `kill $(lsof -ti:3999)`, `git checkout AGENTS.md`, `rm -rf .next/dev`). Zrzuty do `shots-task1/`.

### Task 2: Logowanie i rejestracja

**Files:**
- Modify: `src/features/auth/login-form.tsx`, `src/features/auth/register-form.tsx`, `src/components/auth/google-button.tsx`, `src/components/auth/or-separator.tsx`, `src/components/auth/password-input.tsx`, `src/features/auth/strength-bar.tsx`, `src/features/auth/password-rules-list.tsx`, strony `src/app/(auth)/logowanie/page.tsx`, `src/app/(auth)/rejestracja/page.tsx`
- Test: istniejące `login-form.test.tsx`, `register-form.test.tsx`, `password-input.test.tsx`

**Interfaces:**
- Consumes: `AuthShell` (Task 1).

- [ ] **Step 1: Testy (FAIL):** w testach formularzy — `"nagłówek 20 px/600 i opis muted wg makiety"`, `"przycisk główny 36 px jak w makiecie"` (wysokość wg `CLogin`), `"etykiety pól i link „Nie pamiętasz hasła?” bez font-mono"`; rejestracja: `"pasek siły hasła i lista reguł wg CRegister bez font-mono"`. Istniejące testy zachowania (Enter, błędy, Turnstile, Google) bez zmian.
- [ ] **Step 2:** `pnpm vitest run src/features/auth src/components/auth` → FAIL.
- [ ] **Step 3: Zaimplementuj** wg `CLogin`/`CRegister`: przycisk Google (outline, ikona G, wysokość z makiety), separator „lub e-mailem”, pola `FIELD`, oko w polu hasła, przycisk główny, stopka „Nie masz konta? Zarejestruj się” / odpowiednik w rejestracji, pasek siły i reguły hasła. Widżet Turnstile zostaje (tylko odstępy wokół).
- [ ] **Step 4:** testy → PASS; pełne sprawdzenie jak w Task 1.
- [ ] **Step 5:** porównanie wizualne `/logowanie` i `/rejestracja` (z wpisanym hasłem, żeby pokazać pasek siły) z `CLogin`/`CRegister`; zrzuty do `shots-task2/`.

### Task 3: Reset hasła, „Sprawdź skrzynkę”, nowe hasło, potwierdzono, link wygasł

**Files:**
- Modify: `src/features/auth/reset-steps.tsx`, `src/features/auth/check-inbox.tsx`, `src/features/auth/new-password-form.tsx`, `src/features/auth/link-expired.tsx`, strony `src/app/(auth)/reset-hasla`, `nowe-haslo`, `potwierdzono`, `link-wygasl`
- Test: istniejące testy tych komponentów

**Interfaces:**
- Consumes: `AuthShell` z `footer` i `progress` (Task 1).

- [ ] **Step 1: Testy (FAIL):** `"reset: progress 3 segmenty i stopka ‹ Wróć do logowania w pasku stopki"`; `"potwierdzono: kafelek ikony w tonie sukcesu, stopka „Link był jednorazowy i już wygasł.” w pasku, bez font-mono"`; `"link wygasł: kafelek ikony w tonie błędu, przycisk „Wyślij nowy link” outline, stopka „Nowy link będzie ważny 1 godzinę.”"` (teksty — te, które aplikacja ma dziś; jeśli różnią się od makiety, zostaw dzisiejsze i wypisz w „Do decyzji”); `"sprawdź skrzynkę i nowe hasło w tym samym stylu karty, bez font-mono"`.
- [ ] **Step 2:** `pnpm vitest run src/features/auth` → FAIL.
- [ ] **Step 3: Zaimplementuj** wg `CForgot` i `CEmailConfirmed` (kafelek ikony 40 px z tłem i ramką w tonie; nagłówek wyśrodkowany 20 px/600; przyciski na pełną szerokość; stopka przez `footer`). „Sprawdź skrzynkę” i „Nowe hasło” — ten sam styl (bez makiety).
- [ ] **Step 4:** testy → PASS; pełne sprawdzenie.
- [ ] **Step 5:** porównanie wizualne `/reset-hasla`, `/potwierdzono`, `/link-wygasl`, `/nowe-haslo` z makietami; zrzuty do `shots-task3/`.

### Task 4: Strona 404

**Files:**
- Modify: `src/app/not-found.tsx`
- Test: `src/app/not-found.test.tsx` (utwórz, jeśli nie ma)

- [ ] **Step 1: Testy (FAIL):** `"404: okruszki bez font-mono"` (jak `ModuleHeader` w innych modułach — użyj go, jeśli pasuje do `CNotFound`), `"liczba 404 bez font-mono, rozmiar wg makiety"`, `"przyciski „Wróć do Dziś” (primary) i „Szukaj ⌘K” (wyłączony, aria-disabled) w rozmiarze z makiety"`, `"link do kosza zostaje (/ustawienia/ogolne#kosz)"`, `"gość: treść bez powłoki"`.
- [ ] **Step 2:** `pnpm vitest run src/app/not-found.test.tsx` → FAIL.
- [ ] **Step 3: Zaimplementuj** wg `CNotFound` (liczba ~64 px/700 `tabular-nums`, tytuł 20 px/600, opis muted 14 px, przyciski 32 px, `Kbd` dla ⌘K jeśli jest w controls).
- [ ] **Step 4:** testy → PASS; pełne sprawdzenie.
- [ ] **Step 5:** porównanie wizualne z `CNotFound` (trasa tymczasowa renderująca treść 404 bez powłoki albo zrzut z CI); zrzuty do `shots-task4/`.

### Task 5: Ramka onboardingu i podgląd na żywo

**Files:**
- Modify: `src/features/onboarding/wizard.tsx`, `src/features/onboarding/live-preview.tsx`, `src/features/onboarding/steps/step-header.tsx`
- Test: `src/features/onboarding/wizard.test.tsx`, `live-preview.test.tsx`

**Interfaces:**
- Produces: wygląd nagłówka kroku (`step-header.tsx`: tytuł 26 px/600 wg `COnboarding`, opis muted 14 px) — używany przez kroki w Task 6 i 7.

- [ ] **Step 1: Testy (FAIL):** `"pasek górny: „Krok N z 7” jako szara odznaka bez font-mono, „Wyloguj” po prawej"`; `"7 segmentów postępu, wypełnione do bieżącego kroku"` (z zachowaniem dzisiejszych atrybutów dostępności paska); `"stopka: „Wstecz” ghost z ChevronLeft, „Dalej” primary z ChevronRight, w ostatnim kroku „Przejdź do Dziś”"`; `"podgląd: karta z sidebarem (Moduły/Strony) i planem dnia wg COnbPreview"`; `"telefon bez zmian"` (klasy `max-[799px]:`).
- [ ] **Step 2:** `pnpm vitest run src/features/onboarding/wizard.test.tsx src/features/onboarding/live-preview.test.tsx` → FAIL.
- [ ] **Step 3: Zaimplementuj** wg `COnboarding` i `COnbPreview`: tło `bg-panel`, ramka 1120×720 `rounded-2xl` z cieniem `shadow-card`, segmenty nad treścią, kolumna kroku 520 px, stopka oddzielona `border-t`, podgląd w karcie po prawej.
- [ ] **Step 4:** testy → PASS; pełne sprawdzenie.
- [ ] **Step 5:** porównanie wizualne (trasa tymczasowa renderująca `Wizard` z przykładowym szkicem na kroku 1 — bez akcji serwerowych, mock propsów) z `COnboarding`; zrzuty do `shots-task5/`.

### Task 6: Kroki onboardingu 1–4 (profil, rola, źródło, cele)

**Files:**
- Modify: `src/features/onboarding/steps/step-profile.tsx`, `step-roles.tsx`, `step-source.tsx`, `step-goals.tsx`
- Test: odpowiadające `*.test.tsx`

**Interfaces:**
- Consumes: `step-header.tsx` (Task 5); `Dropdown variant="select"` (strefa czasowa jak w karcie Profil w Ustawieniach), `Stepper` (wariant wg makiety), `Checkbox`.

- [ ] **Step 1: Testy (FAIL):** po jednym teście wyglądu na krok wg makiety (`COnboarding`: wiersz zdjęcia jak w Ustawieniach, strefa jako `Dropdown variant="select"` z hintem UTC i podpisem „Wykryta z przeglądarki”, segmenty tygodnia i formatu godziny; `COnboardingRole`, `COnboardingSource`, `COnboardingGoals`: karty wyboru/listy, kontrolki liczb) oraz `"bez font-mono"`; istniejące testy zachowania bez zmian.
- [ ] **Step 2:** `pnpm vitest run src/features/onboarding/steps` → FAIL.
- [ ] **Step 3: Zaimplementuj** wg czterech makiet.
- [ ] **Step 4:** testy → PASS; pełne sprawdzenie.
- [ ] **Step 5:** porównanie wizualne każdego kroku z makietą (trasa tymczasowa z komponentami kroków i przykładowym szkicem); zrzuty do `shots-task6/`.

### Task 7: Kroki onboardingu 5–7 (strony, przypomnienia, gotowe)

**Files:**
- Modify: `src/features/onboarding/steps/step-pages.tsx`, `step-notify.tsx`, `step-done.tsx`
- Test: odpowiadające `*.test.tsx`

**Interfaces:**
- Consumes: `step-header.tsx` (Task 5), `Switch`/`Checkbox` z controls (sprawdź, co jest), `Card`.

- [ ] **Step 1: Testy (FAIL):** `COnboardingPages` (karty szablonów stron), `COnboardingNotify` (karta „Powiadomienia w przeglądarce” z przyciskiem „Zezwól”, lista przełączników w karcie z separatorami, niebieska informacja o ekranie głównym z tokenu info), `COnboardingDone` (logo, „Gotowe, {imię}”, karta podsumowania z ✓ w zielonym kółku, „Zmień” w każdym wierszu, dzisiejszy tekst o skrócie z `Kbd`); `"bez font-mono"`; istniejące testy zachowania bez zmian (w tym obsługa `Notification.requestPermission`).
- [ ] **Step 2:** `pnpm vitest run src/features/onboarding/steps` → FAIL.
- [ ] **Step 3: Zaimplementuj** wg trzech makiet.
- [ ] **Step 4:** testy → PASS; pełne sprawdzenie.
- [ ] **Step 5:** porównanie wizualne każdego kroku z makietą; zrzuty do `shots-task7/`.
