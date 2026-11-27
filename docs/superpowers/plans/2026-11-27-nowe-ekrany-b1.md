# Nowe ekrany B1 — plan

**Cel:** okno ⌘K, 404/500, „Pomoc i opinie”, błędy logowania (web).
**Spec:** `docs/superpowers/specs/2026-11-27-nowe-ekrany-b1-design.md`. Makiety `S2CommandK`, `S2Help`, `S2ServerError`, `S2NotFound`, `S2LoginError` są wzorcem wyglądu, tekstów i zachowań.
**Wykonanie:** Claude sam, jeden przegląd całości na końcu (CLAUDE.md, mały pakiet).

## Zasady
Teksty i komentarze po polsku, bez form rodzajowych. Next 16: `error.tsx` dostaje `retry`. Telefon bez nowych ekranów.

## Czego łatwo nie zauważyć
- Gwiazdka, `%`, `_` i cudzysłów we frazie nie mogą rozbić zapytania ani dopasować wszystkiego.
- Stara odpowiedź wyszukiwania nie może nadpisać nowszej; ↵ nie może otworzyć wyniku starej frazy.
- Skróty `?` i ⌘⇧K nie działają w polach tekstowych (⌘K działa, jak dziś).
- Błąd zapisu opinii zostawia treść w formularzu.
- Sejf: żadnych pól Sekret ani wierszy strony systemowej w wynikach.

## Zadania
1. **Migracja** `supabase/migrations/20261207100000_opinie.sql` + `supabase/tests/opinie.test.sql` (tabela `public.feedback`, RLS tylko insert własnych; test: insert swój, insert cudzy odrzucony, brak odczytu, zła `kind` i pusta treść odrzucone) + typy w `src/types/database.ts`.
2. **Logowanie:** `signIn` zwraca „Za dużo prób, spróbuj za chwilę.” dla `over_request_rate_limit`/429; `login-form.tsx` ustawia `aria-invalid` na obu polach przy złym haśle (`PasswordInput` dostaje `invalid`). Test akcji i formularza.
3. **Błędy:** `src/components/errors/server-error.tsx` (`{ digest?, retry }`, formularz opinii z kodem), `src/app/(app)/error.tsx`, `src/app/error.tsx`; „Szukaj” na 404 otwiera okno (`CustomEvent "rhytm:szukaj"`).
4. **Opinie i pomoc:** `src/features/help/` — `actions.ts` (`sendFeedback({kind,message,contact,context})`, `firstStepsCount()`), `feedback-dialog.tsx`, `help-dialogs.tsx` (skróty, Co nowego), `help-menu.tsx` (pasek i szyna; „Pierwsze kroki” przywraca kartę i idzie na /dzis; skróty `?` i ⌘⇧K).
5. **Szybkie akcje z adresu:** `/dzis?szybko=blok|dodaj|trening|aktywnosc|nawyk` (`dzis/page.tsx`, `today-view.tsx`); tekst „Szybko dodaj „…”” przez `sessionStorage("rhytm_szybko")` (`QuickAddDialog` dostaje `initialText`).
6. **⌘K:** `searchAll` zwraca grupy Strony, Wiersze stron, Kalendarz, Sport (z szablonami i ćwiczeniami), Nawyki i sen; `src/features/search/command-menu.tsx` (listbox, ↑ ↓ ↵ Esc, „Ostatnio” w `localStorage("rhytm_cmdk_ostatnio")`, „Przejdź do”, „Akcje”) montowane w `app-shell.tsx`; pasek boczny i szyna otwierają okno. Testy komponentu i akcji; e2e `search.spec.ts`.
7. **Domknięcie:** `pnpm -s test/typecheck/lint`, zrzuty porównane z makietami (o ile da się uruchomić), przegląd diffu, dziennik, stan projektu, `odlozone.md`, PR, CI.
