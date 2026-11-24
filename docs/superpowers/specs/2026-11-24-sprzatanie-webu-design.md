# Sprzątanie odłożonych uwag webu — projekt

Data: 2026-11-24. Autor: Claude (szkic, seria autonomiczna). Gałąź: `feat/sprzatanie-webu`. Kolejność serii: Dziś → Subscriptions → **sprzątanie** → Etap 3 (telefon). Pakiet startuje z `main` po scaleniu Subscriptions.

Źródło: `docs/superpowers/odlozone.md`. Każdą wybraną uwagę sprawdziłem w kodzie (drzewo robocze `feat/dzis`, 2026-11-24), a przyczyny niestabilnych testów w logach CI (`gh run view 45283219529 --log-failed`).

## Cel

1. Testy e2e z listy „niestabilne” w `CLAUDE.md` przechodzą za pierwszym razem, niezależnie od pory i obciążenia CI. Po scaleniu lista znika z `CLAUDE.md`.
2. Baza sama pilnuje modułu Hasła (obrona w głąb). Bezpośrednie API nie zapisze jawnego tekstu pod polem Sekret ani nie wyniesie wiersza z modułu. Reset sejfu i zapis sekretu nie mijają się w wyścigu.
3. Polityki RLS `tasks` bez martwej gałęzi `block_id is null`.
4. Kilka drobnych poprawek tabeli stron i dostępności. Wygląd się nie zmienia.

## Zakres

### A. Niestabilne e2e (tylko testy, bez zmian w aplikacji)

**Przyczyna 1: wyścig z przewinięciem siatki** (`calendar.spec` „klik w pusty slot → Nowy wpis…” [l. 32], „kalendarz wypełnia okno…” [l. 239], „przeciągnięcie bloku jednorazowego…” [l. 264]; `sport.spec` „„Nowy wpis” w kalendarzu → Bieg…” [l. 203])
- `TimeGrid` (`src/features/calendar/time-grid.tsx`, efekt przy montażu) po hydratacji ustawia `scrollTop` siatki na 06:00 (6 × 48 = 288 px). Wcześniej Playwright liczy punkt kliknięcia albo `boundingBox()` na niewyprzewijanej siatce.
- Log CI potwierdza przesunięcie: zamiast 10:00 test dostaje `godzina=16:00` (+288 px, czyli całe przewinięcie) albo `14:30` (+216 px). Test „wypełnia okno” czyta `scrollTop` raz, bez ponawiania, więc trafia na 0.
- **Rozwiązanie:** przed kliknięciem albo pomiarem test czeka, aż siatka będzie przewinięta: `expect.poll(() => scrollTop).toBe(288)`. Tygodnie testów leżą w 2027, więc nie ma trwającego bloku i cel to zawsze 06:00. Dopiero potem klika slot. Wspólny kod trafia do `e2e/helpers/kalendarz.ts`:
  - `czekajNaSiatke(page)`;
  - `kliknijSlot(page, dzien, minuta)`: czeka, potem klika `kolumna-${dzien}` w `y = minuta / 60 × 48 + 10`.
- Czekanie na przewinięcie dowodzi przy okazji hydratacji, bo efekt biegnie dopiero po niej. Klik przed hydratacją (bez obsługi `onClick`) przestaje więc być możliwy.

**Przyczyna 2: północ w Warszawie** (`today.spec` [l. 45, 140], `sport.spec` „„Nowy bieg” 10 km…” [l. 20], wszystkie testy, które zasiewają dane na „dziś”)
- Test liczy `dzisWarszawa()` w Node, a serwer liczy dziś w strefie profilu. Jeśli między zasianiem a wczytaniem strony minie północ (CI chodzi wieczorem, a 23:00 UTC to północ w Warszawie), dane trafiają na „wczoraj”.
- **Rozwiązanie:** `zalozKontoNawykow` w `e2e/helpers/nawyki.ts` (wołają go Dziś, Sport i Nawyki) sprawdza czas w Warszawie. Jeśli do północy zostało mniej niż 3 min, czeka do 00:00:05 i wydłuża limit testu o ten czas (`test.info().setTimeout(test.info().timeout + czekanie)`). Zegara serwera nie da się podmienić, a `page.clock` zmienia tylko przeglądarkę.

**Przy okazji (testy):**
- `sport.spec` l. 20 kończy się asercją `getByText("1 / 4")` z listy „Pierwsze kroki”, którą usuwa projekt Dziś. Jeśli koordynator Dziś jej nie zmienił, zamienić ją na wiersz „Treningi” w karcie „Ten tydzień”.
- `e2e/pages.spec.ts` `stanWBazie` ignoruje `error` zapytań, a `expect.poll` ma domyślny limit 5 s przy `actionTimeout` 10 s. Błąd zapytania ma rzucać, a poll dostaje `{ timeout: 10_000 }` (odłożone, krok 2 Task 9).
- `src/features/sport/templates-list.test.tsx` l. 104 i 142: kruche `parentElement`. Zamiast tego `within(getByRole(...))` albo `closest("li")` (odłożone 2c).

### B. Obrona w głąb Haseł w bazie (migracja `20261128100000_page_rows_guard.sql` + pgTAP)

Odłożone B4, M3 i B5. Dziś pilnuje tego tylko Server Action (`src/features/pages/actions.ts`, `createRow`/`updateRow`: kształt `SecretValue`, `ct` ≤ 8192, `g = vaults.generation`, sejf `active`).

1. **Nowy wyzwalacz `page_rows_guard`** (`before insert or update on public.page_rows`, `security definer`, `set search_path = ''`, przepuszcza `rhytm.system_write = 'on'` jak pozostali strażnicy):
   - UPDATE ze zmianą `block_id` jest błędem, jeśli stary albo nowy blok należy do strony systemowej („Wiersza modułu Hasła nie można przenieść”);
   - dla każdego pola `type = 'secret'` bloku `new.block_id`, którego wartość jest nowa (INSERT) albo zmieniona (`new.values -> id is distinct from old.values -> id`) i różna od JSON `null`:
     - wartość to obiekt z dokładnie kluczami `v`, `g`, `iv`, `ct`;
     - `v = 1`, `g` jest liczbą całkowitą ≥ 1;
     - `iv` to tekst base64 o długości 16 znaków (12 B);
     - `ct` to tekst base64 o długości od 24 do 8192 znaków;
     - wzorzec base64: `^[A-Za-z0-9+/]*={0,2}$`;
     - inaczej błąd „Pole Sekret przyjmuje tylko zaszyfrowaną wartość”;
   - przy co najmniej jednej takiej wartości: `select v.status, v.generation from public.vaults as v where v.user_id = new.user_id for share`. Bez wiersza, przy `status <> 'active'` albo przy `g <> generation` błąd „Sejf zmienił się albo jest zablokowany”;
   - wartości `null` przechodzą zawsze (`reset_vault`, czyszczenie komórki);
   - szybkie wyjście: blok bez pól Sekret i bez zmiany `block_id` → `return new`.
2. **`reset_vault()`** (`create or replace`, ciało jak w `20261121180000_vault.sql`) zaczyna od `perform 1 from public.vaults as v where v.user_id = auth.uid() for update;`. Zapis sekretu (FOR SHARE w wyzwalaczu) i reset (FOR UPDATE) są wtedy uszeregowane:
   - zapis przed resetem zostanie wyczyszczony przez reset;
   - zapis po resecie zobaczy nowe `generation` i zostanie odrzucony.
3. **Przywracanie z kosza (B5):** `pages_system_guard` (`create or replace`, pełna kopia z `20261125100000_passwords_module.sql`) dostaje w gałęzi UPDATE warunek: przy `old.deleted_at is not null and new.deleted_at is null and not new.is_system` błąd, jeśli strona ma pole `secret` („Strony z polem Sekret nie można przywrócić poza modułem Hasła”).
4. **Server Action:** zbyt długi `ct` dostaje osobny komunikat `SEKRET_ZA_DLUGI = "Nie zapisano. Tekst jest za długi."` w `src/features/pages/messages.ts`, zamiast mylącego „Sejf musi być odblokowany” (odłożone z Sejfu). Błąd wyzwalacza w akcji to zwykły `BLAD_ZAPISU`: zdarza się tylko w wyścigu, bo akcja sprawdza to samo wcześniej.

Istniejący `supabase/tests/passwords_module.test.sql` wstawia sekrety o fałszywym kształcie bez sejfu (l. ~200–206). Trzeba go dostosować: przed wstawieniem utworzyć aktywny sejf użytkownika C (`generation = 1`) i użyć wartości o poprawnym kształcie. Wiersze wstawiane z `rhytm.system_write = 'on'` (l. ~216–254) zostają bez zmian.

### C. RLS `tasks` (migracja `20261128110000_tasks_rls_simplify.sql` + pgTAP)

Po `20261126100000_tasks_only_in_blocks.sql` (projekt Dziś) `tasks.block_id` jest `NOT NULL`, więc w politykach `tasks_insert_own` i `tasks_update_own` (z `20261118000001_calendar.sql`) gałąź `block_id is null or …` jest martwa. Obie polityki (`drop policy` + `create policy`, te same nazwy) dostają `with check (user_id = (select auth.uid()) and exists (select 1 from public.blocks as b where b.id = tasks.block_id and b.user_id = (select auth.uid())))`. `using` w update zostaje.

### D. Drobne poprawki tabeli stron (bez zmian wyglądu)

Sprawdzone w kodzie jako wciąż aktualne:
- `use-table-store.ts` `removeField` nie usuwa wpisu `column_widths[field.id]` (martwe klucze, odłożone krok 2 Task 5). Usunąć go razem z resztą ustawień i cofnąć przy błędzie, jak `column_summaries`. Przy wczytaniu ustawień (normalizacja `surowe.column_widths`, l. ~62) odfiltrować klucze, których nie ma w polach bloku.
- `renameTable` zapisuje nazwę bez `trim` (krok 1 Task 5). Trzeba przycinać, a po przycięciu równą starej nie zapisywać.
- Nazwy opcji Wyboru/Statusu: wielokrotne spacje nie są normalizowane (krok 2 Task 4). `createOption` i `updateOption` mają robić `replace(/\s+/g, " ").trim()` przed porównaniem duplikatów i zapisem.

### E. Dostępność i drobiazgi kodu (bez zmian wyglądu)

- `FormDialog` (`src/components/controls/form-dialog.tsx`): opis jako `Dialog.Description` (to samo `<p>` i te same klasy). `aria-describedby={undefined}` tylko bez `description` (odłożone 2d).
- `slash-menu.tsx` l. 41: `min-h-11` tylko na telefonie (`max-[799px]:min-h-11`), na webie wysokość pozycji menu jak w pozostałych menu (odłożone 2d). Wysokość pozycji na webie ma się zgadzać z S2 (`.mi` z `coss.css`).
- Okruszki Sportu: `<nav aria-label="Okruszki">` w `gym-log.tsx`, `templates-list.tsx`, `template-editor.tsx` (dziś tylko `exercise-detail.tsx`). Wygląd bez zmian (odłożone 2c).

## Pominięte (zostają w `odlozone.md` z adnotacją)

| Uwaga | Dlaczego nie teraz |
|---|---|
| Wszystko oznaczone „Etap 3” lub dotyczące telefonu: arkusze, `m-row-sheet` (w tym toast przy ignorowanym „Zapisz”), PhoneStrengthBar, Dropdown 28 px na telefonie, Stepper na telefonie, A1 | Należą do Etapu 3 i są rozpisane w `telefon-design.md`. |
| Rozmiary 13 vs 14 px etykiet i stopek (2f), h2/h3 kart, token tła stopki .025, RhytmLogo 17/16 px | Zmieniają wygląd całej aplikacji albo wymagają decyzji Mejsona wobec makiet. |
| `Segment` w trybie pressed/multiple zamiast kopii `.seg` (2c), wyzwalacz „Filtruj” z kopią klas Button (2d) | Refaktor bez zysku dla użytkownika i z ryzykiem różnic wizualnych. Wróci, gdy Etap 3 (Sport) dotknie tych plików. |
| Sejf M6 (BroadcastChannel, pagehide), M10 (CSP z nonce), T2/T3 (e2e zmiany hasła głównego), `updated_at` z zegara aplikacji | Bezpieczeństwo wymaga osobnego przeglądu, a CSP z nonce wymusza dynamiczne renderowanie przy `cacheComponents`. Propozycja: osobny pakiet „Sejf — utwardzenie” po Etapie 3. |
| Wyścigi store tabeli z kroków 1–2 (rollback `moveField`, `removeOption` nieatomowe, potwierdzenia wg kolejności zakończeń, M1, M4 rerender) | Rzadkie, bez zgłoszeń, a poprawka wymaga przebudowy store (punkt 4 „Dalej” w `stan-projektu.md`). |
| A4 (test pgTAP warunku wstępnego starej migracji), B6 (1 bit w treści błędu) | Migracja już wykonana na produkcji. B6 jest informacyjne. |
| Górny surowy rejestr Etapów 1–2a | Historia przeglądów, decyzje już zapadły. |

**Już naprawione** (koordynator oznacza je w `odlozone.md` jako „naprawione”):
- M9: telefon edytuje Sekret (`m-row-sheet.tsx` ma pole sekretu z oczkiem i szyfrowaniem przy „Zapisz”);
- `column_widths` jako tablica (`!Array.isArray` w `use-table-store.ts`);
- `nowyId` czyszczony przez `onFocused`;
- „Przesuń w lewo” przed tytuł zablokowane (`firstColumn` w `page-table.tsx`).

## Poza zakresem

Telefon (Etap 3), nowe funkcje, zmiany wyglądu, podział `page-table.tsx` i `use-table-store.ts`.

## Kolejność wdrożenia (migracje)

Obie migracje są wstecznie zgodne z kodem na produkcji, bo dzisiejszy kod zapisuje tylko poprawne sekrety i nie przenosi wierszy. Według zasad serii koordynator wykonuje je przez konektor Supabase po scaleniu do `main` i przed końcem wdrożenia na Vercel. Wcześniej sprawdza na produkcji zapytaniem tylko do odczytu, że żaden istniejący wiersz nie łamie nowego kształtu (wyzwalacz sprawdza tylko nowe zapisy, ale chcemy wiedzieć). Jeśli konektor nie działa, migrację uruchamia Mejson (`pnpm exec supabase db push --remote`).

## Decyzje Claude

| # | Decyzja | Uzasadnienie | Koszt pomyłki |
|---|---|---|---|
| S1 | Niestabilne e2e naprawiamy w testach (czekanie na przewinięcie siatki, czekanie po północy), bez zmian w aplikacji. | Przyczyna leży w teście (punkt liczony przed efektem). Aplikacja działa poprawnie. | Niski: gdyby nadal padały, następny krok to atrybut `data-przewinieto` w `TimeGrid`. |
| S2 | Przy północy test czeka do 00:00:05 (maks. 3 min), zamiast się pomijać. | Pominięcie gubiłoby pokrycie właśnie przy wieczornych uruchomieniach CI. | Niski: test trwa do 3 min dłużej raz na dobę. |
| S3 | Wyzwalacz sprawdza tylko nowe i zmienione wartości Sekretu, nie istniejące. | Stare wiersze (np. po zmianie hasła głównego) nie zablokują edycji innych komórek. | Niski. |
| S4 | Wyzwalacz sprawdza `g = generation` i `status = 'active'` z blokadą `FOR SHARE`, a `reset_vault` bierze `FOR UPDATE`. | Domyka M3 bez przenoszenia logiki z akcji do bazy. | Średni: przy błędzie w warunku zapis sekretu by padał. Pokrywa to pgTAP i e2e `sejf.spec`. |
| S5 | Błąd wyzwalacza w akcji to zwykły „Nie udało się zapisać”. | Zdarza się tylko w wyścigu, bo akcja sprawdza to samo wcześniej i daje dokładny komunikat. | Niski. |
| S6 | B5: blokada przywrócenia z kosza strony z polem Sekret poza modułem, zamiast automatycznej konwersji. | Na produkcji takich stron nie ma, a blokada jest prosta i bezpieczna. | Niski. |
| S7 | Dwie osobne migracje (Hasła i `tasks`), każda z własnym testem pgTAP. | Różne tematy, łatwiejszy przegląd i wycofanie. | Brak. |
| S8 | Segment, FilterPopover i CSP odkładamy (tabela „Pominięte”). | Mały pakiet bez zmian wyglądu. | Niski. |
| S9 | Kolejność serii z polecenia Mejsona (sprzątanie przed Etapem 3), mimo że `stan-projektu.md` ma odwrotną. | Polecenie serii jest nowsze. | Brak. Koordynator poprawia `stan-projektu.md`. |
