# Etap 3 / pakiet 7: Hasła na telefonie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (sejf zero-knowledge). Steps use checkbox (`- [ ]`) syntax.

**Goal:** moduł Hasła na telefonie wygląda jak CMPasswords (lista-akordeon z odsłanianiem i kopiowaniem), a zamknięty sejf jak CMVault. Domyka odłożone uwagi sejfu na telefonie.

**Spec:** `docs/superpowers/specs/2026-11-24-telefon-design.md`: inwentaryzacja (CMPasswords, CMVault), „Konflikty” punkty 4 i 7, uwagi „hasla”, decyzje T7, T8. Spec sejfu `docs/superpowers/specs/2026-11-21-sejf-design.md`. Czytaj w całości przed każdym zadaniem.

**Makiety (wiążące):** `docs/design/mockups/CMPasswords.dc.html` (stany: zwinięty, rozwinięty, odsłonięty, skopiowany), `CMVault.dc.html` (pusty, błąd). Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots CMPasswords CMVault`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, WebCrypto (`src/features/vault/crypto.ts`), kontrolki, Vitest, Playwright (CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod;
  - polskie teksty i komentarze;
  - commity na `feat/telefon-hasla` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- **Bezpieczeństwo sejfu bez wyjątków:**
  - tekst jawny tylko w stanie komponentu, który go pokazuje;
  - odszyfrowanie dopiero po stuknięciu „Pokaż hasło” albo „Kopiuj hasło” (nie przy rozwinięciu);
  - czyszczenie przy zwinięciu, zablokowaniu i odmontowaniu;
  - kopiowanie planuje czyszczenie schowka po 30 s (mechanizm `schowekRef` z `page-table.tsx`; użyj go, nie pisz drugiego);
  - bez autouzupełniania menedżerów haseł (atrybuty jak w `m-row-sheet.tsx`).
- Tytuł modułu „Hasła” (nie „Passwords”). Bez „Odblokuj biometrią” (T7).
- Makiety wygrywają w wyglądzie. Cele 44 px. Web `/hasla` bez zmian.
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint`. e2e `e2e/sejf.spec.ts` (mobile) aktualizuj.

## Task 1: Zamknięty sejf na telefonie (CMVault)

**Files:** `src/features/vault/vault-unlock-card.tsx` (+ test), `src/features/passwords/passwords-view.tsx` (gałąź telefonu), `src/features/vault/vault-provider.tsx` (stan „ladowanie”).

- [ ] Poniżej 800 px przy statusie „zablokowany”: pełny ekran według CMVault.
  - `m-head` z linkiem „Strony” (→ `/strony`);
  - `EmptyState` z ikoną `Lock` 56 px (promień 14), tytuł 24/600 „Sejf jest zablokowany”, opis „Hasła są szyfrowane na urządzeniu. Odblokuj hasłem głównym.” (bez „albo biometrią”, T7);
  - pole „Hasło główne” 44 px (`autocomplete="current-password"`), błąd `role="alert"` „Wpisz hasło główne.” przy pustym polu;
  - `btnp` „Odblokuj”;
  - link `btng` w kolorze destrukcyjnym „Nie pamiętam hasła głównego” (otwiera reset sejfu jak dziś na webie).
- [ ] Status „ladowanie” nie pokazuje chwilowo „zablokowane” (odłożone krok 3, zad. 3): przy „ladowanie” telefon pokazuje sam nagłówek, bez karty odblokowania. Test.
- [ ] Web bez zmian (karta na środku).
- [ ] Commit: `feat(telefon): zamknięty sejf według CMVault`.

## Task 2: Lista haseł (CMPasswords)

**Files:** create `src/features/passwords/mobile/m-passwords.tsx` (+ `m-passwords.test.tsx`); modify `passwords-view.tsx` (telefon renderuje `MPasswords` zamiast tabeli, web bez zmian), `src/features/pages/table/page-table.tsx` (jeśli trzeba wystawić store/`schowekRef` dla modułu: najmniejsza zmiana, opisana komentarzem).

- [ ] `MPasswords` dostaje wiersze i pola z tego samego `useTableStore` co tabela modułu (jeden stan, bez drugiego wczytywania). Jeśli store żyje wewnątrz `PageTable`, wystaw go przez prop renderujący (`renderPhone?: (store) => ReactNode`) w `PageTable`, a nie przez kopię danych.
- [ ] Układ:
  - `m-head` (`px-2`): link „Strony”, odstęp, „Zablokuj sejf” (`Lock`, kolor `--warning-foreground`, woła `vault.lock`), „Nowe hasło” (`Plus`, otwiera pusty arkusz wiersza);
  - tytuł 24/600 „Hasła”;
  - `StatusBadge` success `lg` „odblokowany · auto-blokada za m:ss” (licznik z istniejącego timera sejfu, `VaultBanner`);
  - `igroup` „Szukaj” (`aria-label` „Szukaj haseł”) — filtruje po Serwisie i Loginie jak `moduleRowFilter`;
  - segment Kategorii z webu na telefonie tylko wtedy, gdy są opcje (poza makietą; T8 w specu dopuszcza).
- [ ] Lista w `frame`: każdy wiersz to `button` `m-row` (`aria-expanded`) z `Avatar` (inicjał Serwisu), Serwis 500, Login 13 muted, chevron obracany o 90° przy rozwinięciu (`transition-transform`). Jedno rozwinięcie naraz.
- [ ] Rozwinięcie (`pl-[60px] pr-3.5 pb-3.5`):
  - `igroup` z hasłem: maska `••••••••••`, po odsłonięciu tekst; oczko „Pokaż hasło”/„Ukryj hasło” (44 px); „Kopiuj hasło” (44 px);
  - dopisek 12 px: po kopiowaniu „Skopiowano · schowek wyczyści się za 30 s” (zielony), inaczej URL albo „—”;
  - przycisk „Edytuj” (`btn` sm 44 px) otwiera arkusz wiersza (`m-row-sheet`) z polami modułu (T8).
- [ ] Odszyfrowanie tylko przy „Pokaż”/„Kopiuj” (`vault.decrypt`). Tekst w stanie wiersza; czyszczenie przy zwinięciu, zablokowaniu (`vault.status`) i odmontowaniu.
- [ ] Testy:
  - rozwinięcie nie woła `decrypt`;
  - „Pokaż” woła i pokazuje tekst;
  - zwinięcie i blokada czyszczą tekst;
  - kopiowanie planuje czyszczenie (fałszywe timery);
  - wyszukiwanie;
  - „Nowe hasło” otwiera arkusz;
  - brak atrybutu `name` i obecność `data-1p-ignore` w polu.
- [ ] Commit: `feat(telefon): lista haseł według CMPasswords`.

## Task 3: Arkusz wiersza w module — odłożone poprawki

**Files:** `src/features/pages/table/mobile/m-row-sheet.tsx`, `src/features/pages/table/use-table-store.ts` (`saveRow`), testy.

- [ ] Arkusz nie odszyfrowuje sekretów od razu po otwarciu (odłożone krok 3, zad. 3): pole Sekret pokazuje maskę z wartością „zaszyfrowane”, a odszyfrowuje dopiero przy fokusie, „Pokaż” albo „Kopiuj”. Zapis bez zmiany sekretu nie wysyła go ponownie (jak dziś).
- [ ] Klik w wiersz w trakcie szyfrowania nie otwiera starej wartości: arkusz po „Zapisz” czeka na koniec zapisu, zanim przyjmie nowe otwarcie. Przycisk „Zapisz” jest wtedy `disabled` z `aria-busy`.
- [ ] `saveRow` przy trwającym zapisie: zamiast cichego `return false` toast „Poczekaj, zapisuję poprzednią zmianę.” (odłożone Sejf).
- [ ] Testy każdej z trzech poprawek.
- [ ] Commit: `fix(telefon): arkusz haseł bez wczesnego odszyfrowania`.

## Task 4 (koordynator): przegląd, CI, scalenie, dziennik

- [ ] **Przed Task 1:** gałąź `feat/telefon-hasla` z `main` po stronach, kopia planu, dziennik.
- [ ] Recenzent bezpieczeństwa (osobny subagent) dla Task 2 i 3:
  - gdzie żyje tekst jawny i kiedy znika;
  - brak tekstu jawnego w propsach store'u, adresie i logach;
  - czyszczenie schowka;
  - atrybuty przeciw menedżerom haseł.
- [ ] `visual.spec.ts`: test `/hasla` z makietami `CMPasswords, CMVault` i zrzuty telefonu (zablokowany, rozwinięty wiersz).
- [ ] Przegląd gałęzi, CI zielone (`sejf.spec` web i mobile), scalenie według zasad serii. `odlozone.md` (M9 naprawione wcześniej; uwagi krok 3 zad. 3, `zapisujeRef`, A1) oznacz. Dziennik, `stan-projektu.md`.
- [ ] „Do decyzji”: T7, T8, segment Kategorii na telefonie.
