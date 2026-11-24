# Etap 3 / pakiet 9: logowanie, onboarding i ustawienia na telefonie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ekrany bez sesji (logowanie, rejestracja, reset hasła) według CMLogin, CMRegister i CMForgot, kreator według CMOnboarding, a ustawienia na telefonie według CMSettings (indeks + podstrony zakładek). Domyka uwagi Etapu 2g dotyczące telefonu.

**Spec:** `docs/superpowers/specs/2026-11-24-telefon-design.md`: inwentaryzacja (CMLogin, CMRegister, CMForgot, CMOnboarding, CMSettings), „Konflikty” punkt 6, uwagi „konto”, decyzja T9. Czytaj w całości przed każdym zadaniem.

**Makiety (wiążące):** `docs/design/mockups/CMLogin.dc.html`, `CMRegister.dc.html`, `CMForgot.dc.html`, `CMOnboarding.dc.html` (7 kroków), `CMSettings.dc.html`. Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots CMLogin CMRegister CMForgot CMOnboarding CMSettings`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, kontrolki, Vitest, Playwright (CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod;
  - polskie teksty i komentarze;
  - commity na `feat/telefon-konto` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- Makiety wygrywają w wyglądzie. Funkcje, których aplikacja nie ma („Motyw”, „Eksport danych”, „Odblokuj biometrią”), nie powstają (T9, konflikt 6).
- Logowanie, Turnstile, Google, walidacja, kroki kreatora i zapis ustawień bez zmian logiki.
- Cele 44 px, pola 16 px. Web bez zmian (zrzuty `visual.spec` web przed i po).
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint`. e2e (`auth.spec.ts`, `onboarding.spec.ts`, `settings.spec.ts` mobile) aktualizuj przy zmianie tekstu albo roli.

## Task 1: Logowanie, rejestracja, reset (CMLogin, CMRegister, CMForgot)

**Files:** `src/components/auth/auth-shell.tsx`, `password-input.tsx`, `google-button.tsx`, `or-separator.tsx`, `src/features/auth/login-form.tsx`, `register-form.tsx`, `strength-bar.tsx`, `reset-steps.tsx`, `check-inbox.tsx`, `new-password-form.tsx` (+ testy).

- [ ] `AuthShell` poniżej 800 px:
  - treść `px-5 py-6 gap-5`, logo na środku;
  - formularz w `Card` z `card-h` (kolumna, `pt-6`): tytuł 20/600 i `card-d` (opis);
  - `card-p` (`gap-4 pb-6`);
  - stopka strony `.muted` na środku z linkiem 500 (cel 44 px przez `py-3`).
- [ ] Pola 44 px, pole hasła jako `igroup` z oczkiem 44 px (`aria-pressed`). „Nie pamiętasz hasła?” jako link muted z celem 44 px, wyrównany do prawej. Przyciski `btnp`/`btn` na całą szerokość. Separator „lub” 12 px z liniami.
- [ ] Rejestracja: pasek siły 4 segmenty × 6 px pill, kolory `#ef4444` / `#f59e0b` / zielony z makiety, tło `rgba(0,0,0,.06)`. Bez hexów spoza makiety w `strength-bar.tsx` (odłożone 2g „PhoneStrengthBar hex”). CTA nieaktywne bez zgody (jak dziś).
- [ ] Reset: krok 1 bez pustego kontenera stopki na telefonie (odłożone 2g); tytuły kroków 600; opisy muted.
- [ ] Commit: `feat(telefon): logowanie i rejestracja według CM`.

## Task 2: Kreator (CMOnboarding)

**Files:** `src/features/onboarding/wizard.tsx`, `step-views.tsx`, `steps/*.tsx` (gałęzie telefonu), testy.

- [ ] Nagłówek telefonu (`m-head` bez ramki, przezroczysty):
  - „Wstecz” (44 px) od kroku 2, w kroku 1 ikona logo w polu 44 px;
  - na środku `StatusBadge` secondary „Krok N z 7”;
  - po prawej „Wyloguj” (`btng` muted, `font-medium`, tło hover jak `Button` ghost; odłożone 2g).
- [ ] Pasek postępu `steps`: siatka 7 kolumn, `gap-1`, `px-4 pb-2`, kreski 4 px pill. Kolory zrobionych, bieżącego i przyszłych kroków z `dots` w `renderVals` makiety. `role="progressbar"` z `aria-valuenow`.
- [ ] Treść `px-5 pt-4 pb-6 gap-[18px]`. Tytuł kroku jako `step-title` (24/32 px, 600, `-.02em`), opis muted (odłożone 2g: „tytuł kroku/„Gotowe” 600 i opis muted”).
- [ ] Kroki według makiety:
  - profil: awatar 56 px, „Wgraj”;
  - role: karta z `m-row` `role="checkbox"`;
  - cele, źródło, strony, przypomnienia: przełączniki `m-hit`;
  - „Gotowe, <imię>”.

  Notka sejfu w kroku stron jako `alert info` (odłożone 2g). Teksty kroków zostają aplikacyjne, jeśli makieta różni się funkcjonalnie (krok stron według S2OnboardingPages z kroku 3 Stron 2.0).
- [ ] Stopka kreatora na telefonie: przycisk główny na całą szerokość 44 px, przyklejony na dole z safe-area.
- [ ] Commit: `feat(telefon): kreator według CMOnboarding`.

## Task 3: Ustawienia na telefonie (CMSettings, T9)

**Files:** `src/app/(app)/ustawienia/page.tsx`, `src/app/(app)/ustawienia/[zakladka]/page.tsx`, `src/features/settings/settings-tabs.tsx`, `avatar-row.tsx`, `profile-card.tsx` (gałąź telefonu), create `src/features/settings/mobile/m-settings-index.tsx` (+ test); read `src/components/shell/account-popover.tsx` (wylogowanie).

- [ ] `/ustawienia`:
  - przekierowanie serwerowe do `/ustawienia/ogolne` znika, bo serwer nie zna szerokości ekranu. Na webie nikt nie trafia na `/ustawienia`: linki webowe (sidebar, menu konta) prowadzą wprost do `/ustawienia/ogolne`. Sprawdź to `grep -rn '"/ustawienia"' src` i popraw linki webowe. Gdyby ktoś wszedł na `/ustawienia` na webie, widzi `EmptyModule` z linkiem „Przejdź do ustawień ogólnych” (`max-[799px]:hidden`). Odnotuj to w komentarzu strony;
  - telefon renderuje `MSettingsIndex`:
    - `m-head` z „Wstecz” (→ `/dzis`) i tytułem „Ustawienia” na środku (pusty slot 44 px po prawej);
    - karta profilu: `Avatar` 52 px (zdjęcie albo inicjał), imię 17/600, e-mail muted, chevron (→ `/ustawienia/ogolne`); stopka „Zdjęcie profilowe” z `.hint` i przyciskami „Usuń”/„Wgraj”/„Zmień” (logika `avatar-row.tsx`, komunikat „Zapisano ✓” zielony);
    - karta z `m-row` do zakładek (`SETTINGS_TABS`: Ogólne, Konto i bezpieczeństwo, Sejf, Powiadomienia, Kategorie kalendarza), chevrony;
    - „Wyloguj się” (destructive-outline na całą szerokość, `LogOut`, ta sama akcja co w menu konta);
    - dopisek wersji 12 px muted na środku (`rhytm` + wersja z `package.json`).
- [ ] `/ustawienia/[zakladka]` na telefonie:
  - `ModuleHeader` z `phoneBack` (→ `/ustawienia`, „Ustawienia”) i `phoneTitle` = nazwa zakładki (tytuł na środku jak w CMSettings);
  - bez poziomego paska `SettingsTabs` (`max-[799px]:hidden`);
  - karty w stylu CM (`Card` z `card-h`/`card-t`, wiersze przełączników `m-row` 56 px z `.hint` jak „Powiadomienia” w makiecie);
  - pola 44 px.
- [ ] Linki do ustawień na telefonie (awatar na Dziś, ⚙ na Stronach) prowadzą do `/ustawienia` (indeks).
- [ ] Testy:
  - indeks: linki zakładek, wylogowanie;
  - zakładka: przycisk „Wstecz”, brak paska zakładek na telefonie;
  - web: `/ustawienia/ogolne` bez zmian.
- [ ] Commit: `feat(telefon): ustawienia według CMSettings`.

## Task 4 (koordynator): przegląd, CI, scalenie, dziennik

- [ ] **Przed Task 1:** gałąź `feat/telefon-konto` z `main`, kopia planu, dziennik.
- [ ] `visual.spec.ts`: makiety CM w tytułach testów publicznych (już są „CLogin / CMLogin” itd.), onboarding, ustawienia (indeks i „Ogólne” na telefonie).
- [ ] Recenzja: zrzuty vs makiety, cele 44 px, web bez zmian, wylogowanie działa z indeksu.
- [ ] Przegląd gałęzi, CI zielone, scalenie według zasad serii. `odlozone.md` (uwagi 2g telefonu) oznacz. Dziennik, `stan-projektu.md`.
- [ ] „Do decyzji”: T9, konflikt 6 (Motyw, Eksport), rozwiązanie `/ustawienia` na webie.
