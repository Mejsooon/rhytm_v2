# Sprzątanie odłożonych uwag webu — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (Task 2 zmienia ochronę sejfu). Pozostałe zadania są małe; wolno je robić inline (superpowers:executing-plans), z jednym przeglądem całej gałęzi na końcu. Steps use checkbox (`- [ ]`) syntax.

**Goal:** stabilne e2e bez listy „niestabilnych”, strażnik `page_rows` dla modułu Hasła i atomowy reset sejfu, uproszczone RLS `tasks` oraz kilka drobnych poprawek tabeli stron i dostępności. Wygląd bez zmian.

**Spec:** `docs/superpowers/specs/2026-11-24-sprzatanie-webu-design.md`. Czytaj go w całości przed każdym zadaniem.

**Makiety:** bez nowych. Wygląd nie może się zmienić. Przy wątpliwości porównaj z `docs/design/mockups/S2*.dc.html` i `C*.dc.html`.

**Tech Stack:** Next.js 16 (cacheComponents), React 19, Supabase, Tailwind 4, Vitest, Playwright (tylko CI), pgTAP (tylko CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod bez funkcji pomocniczych skaczących po plikach (wyjątek: istniejące pliki `e2e/helpers/*`);
  - komentarze i teksty UI po polsku;
  - SQL z jawnym `AS`;
  - commity na gałęzi `feat/sprzatanie-webu` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- Nie wykonuj migracji na żadnej bazie. pgTAP i e2e sprawdza CI.
- Wersje migracji: `20261128100000` i `20261128110000` (po Subscriptions `20261127100000`). Jeśli w `main` jest już nowsza wersja, weź kolejną wolną i popraw nazwy w planie i specu.
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint` mają być zielone.
- Żadnej zmiany wyglądu. Klasy wizualne zostają; zmieniają się tylko role, atrybuty ARIA i logika.

## Task 1: Stabilne e2e (tylko testy)

**Files:** modify `e2e/helpers/kalendarz.ts`, `e2e/helpers/nawyki.ts`, `e2e/calendar.spec.ts`, `e2e/sport.spec.ts`, `e2e/pages.spec.ts`, `src/features/sport/templates-list.test.tsx`. Read `src/features/calendar/time-grid.tsx` (efekt przewinięcia przy montażu, `wysokoscGodziny` = 48 na webie) i spec punkt A.

- [ ] `e2e/helpers/kalendarz.ts`: dodaj dwie funkcje:
  - `czekajNaSiatke(page)`: `await expect.poll(() => page.getByTestId("przewijanie").evaluate((el) => el.scrollTop), { timeout: 10_000 }).toBe(6 * 48)`. Komentarz po polsku: dlaczego (efekt montażu przewija siatkę do 06:00 po hydratacji, a tygodnie testów 2027 nie mają trwającego bloku);
  - `kliknijSlot(page, dzien, minuta)`: `await czekajNaSiatke(page)`, potem `page.getByTestId(\`kolumna-${dzien}\`).click({ position: { x: 40, y: (minuta / 60) * 48 + 10 } })`.
- [ ] `calendar.spec.ts`:
  - test „klik w pusty slot → Nowy wpis → blok cykliczny co tydzień”: zamień `click({ position: { x: 40, y: 490 } })` na `kliknijSlot(page, WTOREK, 600)`;
  - test „kalendarz wypełnia okno…”: zamień jednorazowe `expect(await siatka.evaluate(scrollTop)).toBeGreaterThan(0)` na `await czekajNaSiatke(page)` przed pomiarami ramki i nagłówka;
  - test „przeciągnięcie bloku jednorazowego o godzinę…”: `await czekajNaSiatke(page)` przed `boundingBox()`.
  - Wyszukaj w pliku pozostałe `position: { x: 40, y:` i zamień je tak samo.
- [ ] `sport.spec.ts`:
  - test „„Nowy wpis” w kalendarzu → Bieg…”: oba kliknięcia przez `kliknijSlot(page, WTOREK, 600)`;
  - test „„Nowy bieg” 10 km…”: jeśli na końcu wciąż jest `getByText("1 / 4")` (lista „Pierwsze kroki” zniknęła w projekcie Dziś), zamień to na asercję wiersza „Treningi” karty „Ten tydzień” na `/dzis`. Sprawdź w `src/features/today/week-card.tsx`, jaki tekst i `data-testid` ma wiersz, i oczekuj `1 /` (cel z profilu testowego).
- [ ] `e2e/helpers/nawyki.ts`: w `zalozKontoNawykow` przed utworzeniem konta policz czas w `Europe/Warsaw` (`Intl.DateTimeFormat` z `hour`/`minute`/`second`, `hourCycle: "h23"`). Jeśli do północy zostało mniej niż 180 s:
  - `test.info().setTimeout(test.info().timeout + (sekundyDoPolnocy + 5) * 1000)`;
  - `await new Promise((r) => setTimeout(r, (sekundyDoPolnocy + 5) * 1000))`.

  Import `test` z `@playwright/test`. Komentarz: dlaczego (serwer liczy dziś w strefie profilu, test w Node, a zegara serwera nie da się podmienić).
- [ ] `e2e/pages.spec.ts` `stanWBazie`:
  - `const { data: pola, error: e1 } = …; if (e1) throw e1;` (tak samo dla wierszy);
  - każde `expect.poll(stanWBazie` dostaje `{ timeout: 10_000 }`.
- [ ] `templates-list.test.tsx` l. ~104 i ~142: zamiast `.parentElement` znajdź element przez rolę/`closest` (np. `screen.getByText(...).closest("li")` albo `within(screen.getByRole("listitem", { name: … }))`). Ma sprawdzać to samo co dziś.
- [ ] `CLAUDE.md` NIE zmieniaj (lista niestabilnych znika dopiero po zielonym CI, robi to koordynator w Task 5).
- [ ] Commit: `test(e2e): stabilne kliknięcia w siatkę i testy przy północy`.

## Task 2: Strażnik `page_rows`, atomowy reset sejfu, przywracanie z kosza (migracja + pgTAP)

**Files:**
- create `supabase/migrations/20261128100000_page_rows_guard.sql` i `supabase/tests/page_rows_guard.test.sql`;
- modify `supabase/tests/passwords_module.test.sql` (fałszywe sekrety bez sejfu), `src/features/pages/messages.ts`, `src/features/pages/actions.ts`, `src/features/pages/actions.test.ts`;
- read `supabase/migrations/20261125100000_passwords_module.sql` (styl strażników, `pages_system_guard`), `supabase/migrations/20261121180000_vault.sql` (`vaults`, `reset_vault`), `src/features/vault/crypto.ts` (`isSecretValue`) i spec punkt B.

- [ ] Funkcja `public.page_rows_guard()` (`language plpgsql`, `security definer`, `set search_path = ''`) i wyzwalacz `page_rows_guard` `before insert or update on public.page_rows for each row`. Zachowanie według specu B.1, kolejność:
  1. `rhytm.system_write = 'on'` → `return new`;
  2. UPDATE ze zmianą `block_id`, gdy stary albo nowy blok jest na stronie `is_system` → `raise exception 'Wiersza modułu Hasła nie można przenieść'`;
  3. pętla po `public.page_fields as f where f.block_id = new.block_id and f.type = 'secret'`: dla wartości nowej albo zmienionej i nie-`null` sprawdź kształt. Do kluczy użyj `jsonb_typeof`, `(select count(*) from jsonb_object_keys(v)) = 4`, `v ?& array['v','g','iv','ct']`, `length(v->>'iv') = 16` i `length(v->>'ct') between 24 and 8192` oraz wzorca base64. Przy złym kształcie `raise exception 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość'`;
  4. przy co najmniej jednej takiej wartości: `select v.status, v.generation into … from public.vaults as v where v.user_id = new.user_id for share`. Bez wiersza, przy `status <> 'active'` albo przy `g` różnym od `generation` → `raise exception 'Sejf zmienił się albo jest zablokowany'`.
- [ ] `revoke execute on function public.page_rows_guard() from public, anon, authenticated;`.
- [ ] `create or replace function public.reset_vault()`: pełna kopia z `20261121180000_vault.sql`, a na początku `perform 1 from public.vaults as v where v.user_id = auth.uid() for update;`. Granty jak w oryginale (powtórz `revoke`/`grant`).
- [ ] `create or replace function public.pages_system_guard()`: pełna kopia z `20261125100000_passwords_module.sql` plus warunek B5 w gałęzi UPDATE (przywrócenie nie-systemowej strony z polem `secret` → `raise exception 'Strony z polem Sekret nie można przywrócić poza modułem Hasła'`). Wyzwalacza nie trzeba tworzyć od nowa.
- [ ] `passwords_module.test.sql`: przed wstawieniem wiersza z sekretami jako użytkownik C wstaw aktywny sejf C (kolumny z `20261121180000_vault.sql`, `status 'active'`, `generation 1`). Zamień wartości `{"v":1,"g":1,"iv":"aaa","ct":"bbb"}` na poprawny kształt, np. `iv` = `"AAAAAAAAAAAAAAAA"` i `ct` = `"AAAAAAAAAAAAAAAAAAAAAAAA"`. Wiersze wstawiane z `rhytm.system_write = 'on'` zostaw. Popraw `plan(N)`, jeśli zmienia się liczba asercji.
- [ ] `page_rows_guard.test.sql`: własni użytkownicy, strona Hasła przez `ensure_passwords_page()` i zwykła strona z tabelą. Przypadki:
  - (1) poprawny sekret przy aktywnym sejfie, `g` = generation → zapis przechodzi;
  - (2) jawny string pod Hasło → `throws_ok`;
  - (3) obiekt bez `ct` → błąd;
  - (4) dodatkowy klucz → błąd;
  - (5) `iv` złej długości → błąd;
  - (6) `ct` > 8192 → błąd;
  - (7) `g` = generation − 1 (po `reset_vault()` i odtworzeniu sejfu) → błąd;
  - (8) sejf `reset` → błąd;
  - (9) `null` pod Hasło → przechodzi także przy zablokowanym/resetowanym sejfie;
  - (10) zmiana tylko Serwisu w wierszu ze starym `g` → przechodzi (S3);
  - (11) przeniesienie wiersza z bloku Haseł do zwykłego bloku → błąd;
  - (12) przeniesienie wiersza ze zwykłego bloku do bloku Haseł → błąd;
  - (13) zwykła strona: dowolne wartości i przeniesienia między zwykłymi blokami → przechodzą;
  - (14) `reset_vault()` dalej czyści sekrety i podbija generation;
  - (15) przywrócenie z kosza strony nie-systemowej z polem `secret` (wstaw je z `rhytm.system_write = 'on'`) → błąd; zwykła strona z kosza → przechodzi;
  - (16) `authenticated` nie wykonuje `page_rows_guard()`.
- [ ] `messages.ts`: `export const SEKRET_ZA_DLUGI = "Nie zapisano. Tekst jest za długi.";`. W `actions.ts` (oba miejsca, l. ~736 i ~840) rozdziel warunek: zły kształt albo `sejf === null` → `SEJF_ZABLOKOWANY`, a `ct.length > 8192` → `SEKRET_ZA_DLUGI`. Test w `actions.test.ts` dla obu ścieżek (createRow i updateRow).
- [ ] Commit: `feat(db): strażnik wierszy modułu Hasła i atomowy reset sejfu`.

## Task 3: RLS `tasks` bez martwej gałęzi (migracja + pgTAP)

**Files:** create `supabase/migrations/20261128110000_tasks_rls_simplify.sql`, `supabase/tests/tasks_rls_simplify.test.sql`; read `supabase/migrations/20261118000001_calendar.sql` (polityki l. 134–170), `supabase/migrations/20261126100000_tasks_only_in_blocks.sql`, `supabase/tests/tasks_only_in_blocks.test.sql` (styl).

- [ ] `drop policy "tasks_insert_own" on public.tasks;` i `create policy` o tej samej nazwie z `with check` według specu C. To samo dla `"tasks_update_own"`, z zachowanym `using (user_id = (select auth.uid()))`.
- [ ] pgTAP:
  - `policies_are('public', 'tasks', array['tasks_select_own','tasks_insert_own','tasks_update_own','tasks_delete_own'])`;
  - `with_check` obu polityk (z `pg_policies`) nie zawiera `block_id IS NULL`;
  - użytkownik A wstawia zadanie do własnego bloku → przechodzi;
  - A wstawia zadanie do bloku B → błąd RLS (`42501`);
  - A przepina swoje zadanie na blok B (`update`) → błąd;
  - A nie widzi zadań B.
- [ ] Commit: `feat(db): prostsze polityki RLS zadań`.

## Task 4: Tabela stron, FormDialog, menu „/”, okruszki Sportu

**Files:**
- `src/features/pages/table/use-table-store.ts` (+ `use-table-store.test.ts`);
- `src/features/pages/table/option-picker.tsx` (tylko jeśli normalizuje nazwę lokalnie);
- `src/components/controls/form-dialog.tsx` (+ `form-dialog.test.tsx`);
- `src/features/pages/editor/slash-menu.tsx` (+ test);
- `src/features/sport/gym-log.tsx`, `templates-list.tsx`, `template-editor.tsx` (+ testy, jeśli szukają okruszków).

- [ ] `removeField`:
  - usuń `column_widths[field.id]` z ustawień (optymistycznie, razem z `column_summaries`);
  - przy błędzie przywróć tylko ten wpis, jak dziś `zabranePodsumowania`;
  - test: po usunięciu pola brak klucza, po błędzie serwera klucz wraca.
- [ ] Normalizacja ustawień przy wczytaniu (l. ~62): `column_widths` filtrowane do kluczy obecnych w polach bloku (`block.fields` albo to, z czego store bierze pola). Test z martwym kluczem.
- [ ] `renameTable(name)`:
  - `const nazwa = name.trim()`;
  - gdy `nazwa === tableName`, zwróć `true` bez zapisu;
  - zapis i stan z `nazwa`;
  - test: „  Lektury  ” zapisuje „Lektury”, same spacje przy pustej nazwie nie wysyłają zapisu.
- [ ] `createOption` / `updateOption`: nazwa przez `.replace(/\s+/g, " ").trim()` przed sprawdzeniem pustej nazwy i duplikatu (bez rozróżniania wielkości liter, jak dziś) oraz przed zapisem. Test: „W  toku” przy istniejącym „W toku” nie tworzy duplikatu.
- [ ] `FormDialog`:
  - `description` renderuje `<Dialog.Description className=…>` (te same klasy co dzisiejszy `<p>`);
  - `aria-describedby={undefined}` tylko, gdy nie ma `description`;
  - test: okno z opisem ma `aria-describedby` wskazujące tekst opisu, a bez opisu nie ma ostrzeżenia Radix (brak `console.error`/`warn` w teście).
- [ ] `slash-menu.tsx`: `min-h-11` → `max-[799px]:min-h-11`. Sprawdź w `docs/design/mockups/coss/coss.css` wysokość `.mi`; jeśli pozycje innych menu webowych mają jawną wysokość, użyj tej samej. Test na klasę telefonu.
- [ ] Okruszki: w `gym-log.tsx`, `templates-list.tsx` i `template-editor.tsx` kontener okruszków `.crumb` to `<nav aria-label="Okruszki">` (wzór: `exercise-detail.tsx` l. ~209–215). Klasy bez zmian. Testy: `getByRole("navigation", { name: "Okruszki" })` w każdym z trzech ekranów.
- [ ] Commit: `fix(web): drobne poprawki tabeli stron i dostępności`.

## Task 5 (koordynator): przegląd, CI, scalenie, migracje, dziennik

**Files:** `docs/superpowers/specs/2026-11-24-sprzatanie-design.md`, `docs/superpowers/plans/2026-11-24-sprzatanie.md` (kopie szkiców), `docs/superpowers/odlozone.md`, `docs/superpowers/dziennik/<dziś>.md`, `docs/superpowers/stan-projektu.md`, `CLAUDE.md`.

- [ ] **Przed Task 1:**
  - gałąź `feat/sprzatanie-webu` z aktualnego `main` (po scaleniu Subscriptions);
  - kopie specu i planu, commit `docs(sprzatanie): spec i plan`;
  - wpis w dzienniku i w „W toku” w `stan-projektu.md`.
- [ ] Recenzent Task 2 (subagent-driven) sprawdza:
  - każdą gałąź wyzwalacza wobec specu B;
  - `security definer` + `search_path = ''`;
  - `AS` w SQL;
  - że kod produkcyjny zapisuje sekrety, które przejdą wyzwalacz (`encryptSecret` w `src/features/vault/crypto.ts`: iv 12 B, ct base64).
- [ ] Przegląd całej gałęzi: brak zmian wyglądu (`git diff` bez zmian klas wizualnych poza `slash-menu`), teksty po polsku, testy.
- [ ] Push, CI zielone **za pierwszym razem** dla testów z listy niestabilnych. Jeśli któryś padnie, przeczytaj log (`gh run view <id> --log-failed`) i popraw przyczynę zamiast ponawiać.
- [ ] `odlozone.md`:
  - wybrane uwagi oznacz „naprawione (sprzątanie, <merge>)”;
  - pozycje z tabeli „Pominięte” dostają adnotację z powodem (np. „→ Etap 3”, „→ pakiet Sejf — utwardzenie”);
  - „już naprawione” ze specu też oznacz.
- [ ] Scalenie według zasad serii: `git merge --no-ff feat/sprzatanie-webu`, testy lokalne na połączonym kodzie, push `main`.
- [ ] Migracje (po scaleniu, **przed** końcem wdrożenia na Vercel; obie wstecznie zgodne):
  - najpierw kontrola tylko do odczytu (`execute_sql`): liczba wierszy `page_rows` na stronach systemowych z wartością Sekret o złym kształcie (wynik zapisz w dzienniku; >0 nie blokuje, bo wyzwalacz sprawdza tylko nowe zapisy);
  - `apply_migration` `page_rows_guard`, potem `tasks_rls_simplify`;
  - `list_migrations`: wersje mają się zgadzać z plikami. Jeśli nie, zmień nazwy plików na gałęzi `docs/*`;
  - jeśli konektor nie działa, migracje uruchamia Mejson.
- [ ] Sprawdzenie na produkcji po wdrożeniu: zapis i odczyt hasła w module Hasła na koncie testowym (bez danych Mejsona), potem usunięcie konta testowego.
- [ ] `CLAUDE.md`: punkt „Niestabilne testy e2e” usuń, jeśli CI na `main` przeszło bez ponawiania. Jeśli nie, zostaw tylko te, które dalej padają, z przyczyną. Commit na gałęzi `docs/*` przez merge, zgodnie z zasadami.
- [ ] Dziennik i `stan-projektu.md`:
  - sprzątanie w „Zrobione”;
  - „W toku”: Etap 3, pakiet `feat/telefon-fundament`.
- [ ] „Do decyzji” dla Mejsona: S1–S9 ze specu, każda z kosztem pomyłki.
