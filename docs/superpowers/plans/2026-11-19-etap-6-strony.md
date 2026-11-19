# Etap 6: Silnik stron i edytor bloków — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strony użytkownika:
- edytor bloków (tekst, nagłówek, lista zadań, separator, tabela) z menu „/”,
- strony-tabele z szablonów Books, Projects i Websites (tryb edycji wiersza, „+ Pole”, menu kolumny, filtr, podsumowania, przypięte karty),
- sidebar ze stronami i `/strony` na telefonie,
- kosz na 30 dni.

**Architecture:**
- **Dane:** cztery nowe tabele `pages`, `page_blocks`, `page_fields`, `page_rows` z RLS. Wartości wierszy to `jsonb` w kształcie `{field_id: wartość}`.
- **Funkcje SQL (`security invoker`):**
  - operacje wielotabelowe są atomowe: utworzenie strony z tabelą, duplikowanie, przejęcie stron z onboardingu,
  - czyszczenie kosza (pg_cron).
- **Logika:** wszystko liczą czyste funkcje w `src/features/pages/*.ts`: typy pól, formatowanie, konwersja typów, sort, filtr, podsumowania, karty, szablony, menu „/”.
- **Wspólny silnik, dwa sposoby edycji:**
  - strona bez szablonu (`template_key IS NULL`) to edytor bloków, a komórki jej tabel edytuje się bezpośrednio (`EmptyPage`),
  - strona z szablonu (`template_key` ≠ NULL) to jedna tabela w układzie `Books`/`Projects`/`Websites` z trybem edycji wiersza.
- **Zapis:** Server Actions + zod. Klient działa optymistycznie z rollbackiem i toastem.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Radix, Supabase (Postgres, RLS, pg_cron), zod 4, Vitest + Testing Library, Playwright, pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-16-rhytm-design.md`, sekcje:
- 3.2 (kontrolki),
- 5 (model danych: strony, kosz),
- 6.3 (sidebar, menu strony),
- 6.8 (strony i tabele),
- 6.13 (MPages, MEditor; ekrany bez odpowiednika → arkusze),
- 9.2 (strony z onboardingu).

**Mapa etapów:** `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md`, Etap 6.

**Makiety** (`docs/design/mockups/`):
- web: `NewPage`, `EmptyPage`, `Books`, `Projects`, `Websites`, `AddField` (grupa Podstawowe), `ColumnMenu`, `FilterPopover`, `PageMenu`, `Sidebar`, `NotFound`,
- telefon: `MPages`, `MEditor`.

Teksty, kolory, ikony, wymiary i listy opcji przepisuj dosłownie z ich `<style>`, znaczników i `renderVals`. Dane przykładowe (Netflix, NetScope…) to tylko ilustracja. `ColumnMenu`/`FilterPopover`/`AddField` pokazują Subscriptions — bierz z nich wygląd i zachowanie, a nie typy z Etapu 7.

## Global Constraints
- **Z wcześniejszych etapów:**
  - Next.js 16: przed użyciem API czytaj `node_modules/next/dist/docs/`.
  - Makiety 1:1, teksty dosłownie; makiety wygrywają z planem.
  - Kontrolki tylko z `src/components/controls` (Dropdown, DatePicker, Segment, Switch, Checkbox, Chip, StatusBadge, ActionPopover, FormDialog, WordConfirm), bez `<select>` i `<input type=date|time|number>`.
  - Dymki w portalu, nieprzycinane przez tabelę.
  - Web i telefon rozdzielone wyłącznie klasami `max-[799px]:` / `min-[800px]:`.
  - Cele dotyku ≥ 44 px, przyciski-ikony z `aria-label`.
  - Komentarze po polsku. Płaski kod bez funkcji pomocniczych skaczących po plikach (czyste funkcje w `src/features/pages/*.ts` z testami są OK).
  - SQL: aliasy tabel zawsze z `AS` (`FROM pages AS p`).
- **Supabase:**
  - RLS z `(select auth.uid())`. Tabele potomne w `with check` sprawdzają właściciela rodzica (`page_blocks` → `pages`, `page_fields`/`page_rows` → `page_blocks`).
  - Jawne `GRANT select, insert, update, delete ... to authenticated`; `anon` bez dostępu. Funkcje SQL: `revoke execute ... from public, anon`, `grant execute ... to authenticated` (oprócz `purge_trash`, którą wykonuje tylko cron/`postgres`).
  - Testy pgTAP w `supabase/tests/pages.test.sql`, nowe tabele dopisane do `table_grants.test.sql`.
- **Git:**
  - Gałąź `feat/etap-6`, nigdy commit na `main`.
  - Migrację `supabase/migrations/20261120120000_pages.sql` wypycha Mejson (`pnpm exec supabase db push --remote`) przed scaleniem. Typy `src/types/database.ts` aktualizujesz ręcznie zgodnie z migracją.
- **Weryfikacja:** lokalnego Supabase nie da się uruchomić (Docker zablokowany). pgTAP i e2e sprawdza CI (`gh run list --branch feat/etap-6 -L1`, `gh run view <id> --log-failed`, przy limicie setup-cli `gh run rerun <id> --failed`).
- **Czas:** „dziś” = `todayIso(profil.timezone)` (`@/components/controls`). Daty w tabelach `dd.mm.rrrr` (mono).
- **Optymizm:**
  - Każda zmiana (komórka, wiersz, blok, kolumna, nazwa, kolejność) od razu zmienia widok, liczniki, sumy i karty.
  - Błąd cofa zmianę i pokazuje toast „Nie udało się zapisać. Spróbuj ponownie.”.
  - Okna potwierdzeń czekają na serwer.
- **Next 16 Activity:** magazyny stanu klienta synchronizują się z nowymi danymi z serwera (wzorzec „poprzednie props”, jak `use-today-store.ts`).
- **Usuwanie:**
  - Strona, wiersz i blok dostają `deleted_at = now()`. Toast „Usunięto” ma akcję „Cofnij” (sonner `action`), która czyści `deleted_at`.
  - Każde zapytanie odczytu filtruje `deleted_at is null`, także liczniki i podsumowania.

## Rozstrzygnięcia (Ruling) przed startem
- **Dwa rodzaje stron:**
  - „+ Nowa strona” (sidebar, `MPages`) od razu tworzy stronę edytora (`template_key` NULL, `title` ''). Prowadzi do `/strony/[id]`. Pusty tytuł wyświetla się wszędzie jako „Bez tytułu”.
  - `/strony/nowa` (`NewPage`, przycisk „Szablony” w edytorze, „Użyj szablonu →”) tworzy stronę-tabelę z szablonu.
  - „Pusta strona” w `NewPage` = szablon `empty`: tabela z samym polem „Nazwa” (spec 6.8, opis z makiety „Tabela bez pól…”).
- **Szablony w Etapie 6:**
  - `NewPage` pokazuje tylko: Pusta strona, Books, Projects, Websites.
  - Subscriptions dochodzi w Etapie 7, a Passwords w Etapie 8. Do tego czasu są ukryte, bez zaślepek.
  - Pola, opcje i kolory biorą się ze **stron** `Books`/`Projects`/`Websites` (wygrywają z listą w `NewPage`, w której brakuje Obszaru i Hostingu). Panel „Pola, które powstaną” generuje się z tej samej konfiguracji.
- **Strony z onboardingu (9.2):**
  - Przy każdym renderze `(app)/layout` loader woła RPC `claim_pending_pages(array['Books','Projects','Websites'])`. RPC atomowo zdejmuje te nazwy z `profiles.pending_pages` i je zwraca.
  - Dla zwróconych nazw powstają strony z szablonów.
  - Subscriptions i Passwords zostają w `pending_pages` do swoich etapów.
- **Ulubione (`MPages`)** *[Claude: makiety nie pokazują, jak oznaczyć]*:
  - kolumna `pages.favorite bool default false`,
  - w menu strony (web i arkusz na telefonie) pozycja „★ Dodaj do ulubionych” / „★ Usuń z ulubionych”, nad „Usuń stronę”,
  - sidebar nie rozdziela sekcji.
- **Typy pól silnika (Etap 6):** `text`, `number`, `checkbox`, `url`, `select`, `status`, `date`, `rating`.
  - W edytorze „Typ pola” pokazuje etykiety z `EmptyPage`: Tekst→`text`, Liczba→`number`, Data→`date`, Wybór→`status` (kolorowe plakietki), Checkbox→`checkbox`, Link→`url`.
  - `AddField` pokazuje tylko grupę „Podstawowe”. Grupy Inteligentne i Bezpieczne dochodzą w Etapach 7 i 8.
- **Opcje Wyboru, Select i Status:**
  - `config.options = [{id, label, color}]`, a wartość to `id` opcji,
  - 8 kolorów jak w kategoriach (spec 3.1); kolory plakietek statusów dosłownie z makiet,
  - Select = etykieta mono w ramce, Status / Wybór = kolorowa plakietka (`StatusBadge`).
- **Pole tytułowe** (`is_title`, pierwsze, typ `text`): nie da się go usunąć ani zmienić jego typu (pozycje wyszarzone). Pusta wartość przy zapisie wiersza zapisuje się jako „Bez tytułu” (Books, edytor, Pusta strona) albo „Bez nazwy” (Projects, Websites); `config.empty_label` w polu tytułowym.
- **Zmiana typu (wszędzie):**
  - `convertValue` (Task 2) przelicza wartości.
  - Gdy żadna niepusta wartość nie przepada, typ zmienia się od razu.
  - Gdy coś przepada, pojawia się potwierdzenie w `FormDialog` *[Claude, jeśli makieta nie ma tekstu]*:
    - tytuł „Zmienić typ pola?”,
    - treść „{N} {wartość|wartości|wartości} nie da się przenieść i zostaną wyczyszczone.”,
    - przyciski Anuluj / „Zmień typ”.
  - Konwersja zapisuje się jednym RPC `change_field_type` (pole + wszystkie wiersze w transakcji).
- **Edytor — blok tabeli:**
  - komórki edytuje się bezpośrednio, każda zapisuje się po zmianie,
  - stopka jest stała: suma dla Liczby i „x / y” dla Checkboxa (spec 6.8),
  - menu kolumny, filtr i karty są tylko na stronach z szablonu.
- **Kolejność bloków:**
  - nowe bloki dopisują się na końcu (linia poleceń jest na końcu),
  - ręcznej zmiany kolejności bloków nie ma (makiety jej nie pokazują),
  - kolejność stron w sidebarze zmienia się przeciąganiem i przez „Przenieś wyżej / niżej”.
- **Pozycje:** liczby całkowite. Zmiana kolejności stron i kolumn przepisuje pozycje całej listy jednym RPC `reorder(p_table, p_ids uuid[])`. Implementujesz to jako dwie osobne funkcje `reorder_pages(uuid[])` i `reorder_fields(p_block uuid, uuid[])`, bez dynamicznego SQL.
- **Sort, filtr, ukryte kolumny (strony z szablonu):**
  - sort z menu kolumny zapisuje się od razu w `content.settings.sort = [{field_id, dir}]` (jeden klucz; domyślny z szablonu może mieć dwa),
  - filtr działa w stanie klienta, a w `settings.filters` zapisuje go dopiero „Zapisz jako domyślny”,
  - „Ukryj kolumnę” dopisuje id do `settings.hidden_field_ids`; w metadanych pod tytułem pojawia się wtedy klikalne „· N ukryte”, które pokazuje wszystkie *[Claude: makiety nie mają przywracania]*,
  - ustawienia, które wskazują usunięte pole, są ignorowane.
- **„Pokaż w kalendarzu”:**
  - w Etapie 6 to tylko przełącznik w menu kolumny (`config.show_in_calendar`) i znaczek „w kalendarzu” w nagłówku,
  - Projects.Termin ma go włączonego,
  - wpisy w kalendarzu dochodzą w Etapie 7,
  - tekst potwierdzenia usunięcia strony („Daty z tej strony znikną z kalendarza.”) zostaje dosłownie.
- **Telefon, strona z szablonu** *[Claude]*:
  - ta sama tabela przewijana poziomo,
  - stuknięcie wiersza albo „Nowy wiersz” otwiera arkusz (FormDialog na telefonie) z tymi samymi kontrolkami co tryb edycji, „Usuń wiersz”, „Anuluj” / „Zapisz”,
  - karty wierszy w stylu `MSubs` dochodzą w Etapie 7.
- **Kosz:**
  - sekcja „Kosz” w Ustawieniach → Ogólne (karta w stylu kart ustawień) listuje usunięte strony i wiersze (z nazwą strony) z datą usunięcia i „Przywróć”,
  - usunięte bloki można cofnąć tylko z toastu,
  - pg_cron codziennie usuwa trwale rekordy z `deleted_at < now() - interval '30 days'`,
  - na 404 słowo „kosza” jest linkiem do `/ustawienia/ogolne#kosz`.
- **Duplikuj stronę:** RPC `duplicate_page` kopiuje stronę, bloki, pola (nowe id) i wiersze (klucze `values` przemapowane). Tytuł kopii: „{tytuł} (kopia)” *[Claude]*. Kopia ląduje zaraz pod oryginałem.

## Review Focus
- **Usunięte pole w ustawieniach:** pole użyte w sort, filtrze, podsumowaniu albo karcie zostaje usunięte. Tabela dalej się renderuje, pomija to ustawienie i nie rzuca wyjątku. Test w Task 3 (`ignores settings for missing fields`).
- **Strony z onboardingu tworzone dwa razy:** dwa równoległe rendery layoutu tworzą każdą stronę tylko raz. Test pgTAP w Task 1 (drugie wywołanie `claim_pending_pages` zwraca pustą tablicę).
- **Liczniki z usuniętymi wierszami:** wiersz usunięty (w koszu) nie wchodzi do liczników, sum, kart ani filtra. Po „Cofnij” wraca na swoją pozycję. Test w Task 3 (`rows with deletedAt are excluded`) i w Task 4 (restore czyści `deleted_at`).
- **Granica dnia dla dat względnych:** „dziś”/„jutro”/„minął” liczy się względem strefy z profilu, nie UTC ani przeglądarki. Test w Task 2 (`relativeDue uses provided today`). Loader przekazuje `todayIso(profil.timezone)`.
- **Brudne wartości z bazy:** wartość w `values` ma typ niezgodny z polem (np. tekst w polu Liczba po ręcznej edycji bazy albo opcja usunięta z listy). Formatowanie pokazuje „—”/pusto, nie „NaN” i nie wyjątek, a sort i filtr traktują taką wartość jak pustą. Test w Task 2 (`formatValue tolerates invalid stored values`).

---

### Task 1: Migracja stron, RLS, funkcje SQL, pg_cron

**Files:**
- Create: `supabase/migrations/20261120120000_pages.sql`
- Create: `supabase/tests/pages.test.sql`
- Modify: `supabase/tests/table_grants.test.sql`, `src/types/database.ts`

**Interfaces:**
- Produces:
  - **`pages`:** `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users on delete cascade default auth.uid()`, `title text not null default ''` (≤ 200), `icon text not null default '▦'`, `template_key text null check in ('empty','books','projects','websites','subscriptions','passwords')`, `position int not null default 0`, `favorite bool not null default false`, `created_at timestamptz default now()`, `deleted_at timestamptz null`.
  - **`page_blocks`:** `id`, `page_id → pages on delete cascade`, `user_id default auth.uid()`, `type text check in ('text','heading','todo','divider','table')`, `position int`, `content jsonb not null default '{}'`, `created_at`, `deleted_at`.
  - **`page_fields`:** `id`, `block_id → page_blocks on delete cascade`, `user_id`, `name text not null` (1–60), `type text check in ('text','number','checkbox','url','select','status','date','rating')`, `config jsonb not null default '{}'`, `position int`, `is_title bool not null default false`.
  - **`page_rows`:** `id`, `block_id → page_blocks on delete cascade`, `user_id`, `values jsonb not null default '{}'`, `remind bool not null default true`, `position int`, `created_at`, `updated_at` (trigger), `deleted_at`.
  - **Indeksy:** `(user_id, position) where deleted_at is null` na `pages`, `(page_id, position)`, `(block_id, position)` ×2, `(deleted_at) where deleted_at is not null` na `pages`/`page_blocks`/`page_rows`.
  - **Funkcje (`security invoker`, `set search_path = ''`):**
    - `create_page(p_title text, p_icon text, p_template_key text, p_blocks jsonb) returns uuid`. `p_blocks` to tablica `{id, type, content, fields:[{id,name,type,config,is_title}], rows:[{values}]}`. Pozycje nadaje kolejność w tablicy. Strona trafia na koniec listy (max(position)+1).
    - `duplicate_page(p_page_id uuid) returns uuid`.
    - `claim_pending_pages(p_available text[]) returns text[]`: `update profiles ... set pending_pages = (pending_pages bez p_available) where user_id = auth.uid() returning` część wspólną (z blokadą wiersza), w kolejności z `pending_pages`.
    - `change_field_type(p_field_id uuid, p_type text, p_config jsonb, p_values jsonb) returns void`. `p_values` = `{row_id: nowa wartość | null}`; null usuwa klucz z `values`.
    - `reorder_pages(p_ids uuid[])`, `reorder_fields(p_block_id uuid, p_ids uuid[])`.
    - `purge_trash() returns void` (`security definer`, bez grantu dla `authenticated`).
  - **`cron.schedule('rhytm-purge-trash', '17 3 * * *', 'select public.purge_trash()')`:** przed nim `create extension if not exists pg_cron with schema pg_catalog;` oraz odpięcie istniejącego zadania o tej nazwie, żeby migracja była idempotentna.

- [ ] **Step 1: Write the failing pgTAP test** `supabase/tests/pages.test.sql`. Dwaj użytkownicy A i B (wzorzec z `sport.test.sql`). Asercje:
  - A tworzy stronę przez `create_page('Books','▦','books', '[{"type":"table","content":{"name":"","settings":{}},"fields":[{"name":"Tytuł","type":"text","config":{},"is_title":true}],"rows":[{"values":{}}]}]')`. Powstają: 1 strona, 1 blok, 1 pole, 1 wiersz z `user_id` = A,
  - B: `select count(*) from pages` = 0, `update`/`delete` strony A dotyka 0 wierszy,
  - B: `insert into page_blocks (page_id, type) values (<strona A>, 'text')` → `throws_ok` (RLS),
  - B: `insert into page_rows (block_id) values (<blok A>)` → `throws_ok`,
  - A: `claim_pending_pages(array['Books','Projects','Websites'])` przy `pending_pages = '{Subscriptions,Books}'` zwraca `{Books}`, profil ma `{Subscriptions}`, a drugie wywołanie zwraca `{}`,
  - A: `duplicate_page` tworzy drugą stronę z tym samym tytułem + „ (kopia)”. `values` wiersza kopii używają id nowego pola (`values ? <nowe id>`),
  - A: `change_field_type(<pole>, 'number', '{}', '{"<row>": 5}')` ustawia typ i `values->><pole> = '5'`; z `null` usuwa klucz,
  - `has_function('public','purge_trash')`; `is(has_function_privilege('authenticated','public.purge_trash()','execute'), false)`,
  - jako `postgres`: wiersz z `deleted_at = now() - interval '31 days'` znika po `purge_trash()`, a wiersz sprzed 29 dni zostaje,
  - `anon` nie ma `select` na żadnej z 4 tabel.
  Dopisz 4 tabele do `table_grants.test.sql` (wzorzec istniejących wpisów).

- [ ] **Step 2: Napisz migrację** wg Interfaces:
  - RLS `for all` z `using (user_id = (select auth.uid()))`,
  - `with check` dla potomnych z `exists (select 1 from public.pages AS p where p.id = page_id and p.user_id = (select auth.uid()))` (analogicznie przez `page_blocks AS b`),
  - granty,
  - trigger `updated_at` (jak w istniejących migracjach).

- [ ] **Step 3: Zaktualizuj `src/types/database.ts`** (tabele i `Functions`) ręcznie, zgodnie z migracją. Uruchom `pnpm typecheck`. Oczekiwane: PASS.

- [ ] **Step 4: Commit, push, sprawdź CI**
```bash
git add supabase src/types/database.ts && git commit -m "feat(strony): tabele stron, RLS, funkcje SQL i czyszczenie kosza" && git push -u origin feat/etap-6
```
`gh run list --branch feat/etap-6 -L1`. Oczekiwane: job `db` zielony (pgTAP).

---

### Task 2: Typy pól — wartości, formatowanie, konwersja, daty względne

**Files:**
- Create: `src/features/pages/fields.ts`, `src/features/pages/fields.test.ts`

**Interfaces:**
- Produces:
  - `type FieldType = 'text'|'number'|'checkbox'|'url'|'select'|'status'|'date'|'rating'`
  - `type FieldOption = { id: string; label: string; color: string }`
  - `type FieldConfig = { options?: FieldOption[]; number_format?: 'plain'|'pln'|'percent'; show_in_calendar?: boolean; empty_label?: string }`
  - `type PageField = { id: string; name: string; type: FieldType; config: FieldConfig; position: number; isTitle: boolean }`
  - `type CellValue = string | number | boolean | null`
  - `FIELD_TYPE_META: Record<FieldType, { icon: string; label: string }>` — ikony nagłówków z makiet: Tekst „Aa”, Status „◐”, Select „◉”, Ocena „★”, Data „▦”, URL „↗”, Checkbox „✓”, Liczba „#”; etykiety PL z `AddField`.
  - `EDITOR_TYPES: { type: FieldType; label: string; icon: string }[]` — 6 pozycji z `EmptyPage` (Tekst, Liczba, Data, Wybór, Checkbox, Link).
  - `normalizeValue(field: PageField, raw: unknown): CellValue` — zwraca wartość poprawnego typu albo `null`.
  - `formatValue(field: PageField, raw: unknown): string` — tekst do podglądu.
  - `convertValue(from: PageField, to: FieldType, raw: unknown, newOptions: FieldOption[]): CellValue`
  - `planTypeChange(field: PageField, to: FieldType, rows: { id: string; values: Record<string, unknown> }[]): { config: FieldConfig; values: Record<string, CellValue>; lost: number }`
  - `relativeDue(iso: string, today: string): { text: string; days: number }`
  - `isUrgent(iso: string | null, today: string, done: boolean): boolean`

- [ ] **Step 1: Write the failing tests** (`fields.test.ts`):
  - **`normalizeValue`:**
    - `number`: `"12,5"`→12.5, `"abc"`→null,
    - `rating`: 0→null, 6→null, 3→3,
    - `checkbox`: true→true, `"x"`→null (normalize nie zgaduje),
    - `date`: `"2026-02-30"`→null, `"2026-11-20"`→`"2026-11-20"`,
    - `select`: id spoza opcji → null,
    - `url`: `"  "`→null.
  - **`formatValue`:**
    - Liczba 43 z `pln` → „43,00 zł”, z `percent` → „43%”, `plain` 1234.5 → „1234,5”,
    - Data → „20.11.2026”,
    - URL `https://www.github.com/x` → „github.com/x” (bez `https://` i `www.`),
    - Ocena 4 → „★★★★☆”,
    - Checkbox → „✓”/„”,
    - Status → etykieta opcji,
    - `formatValue tolerates invalid stored values`: Liczba z `"abc"` → „”, Status z nieznanym id → „”, bez wyjątku.
  - **`convertValue` (spec 6.8):**
    - text→number `"12"`→12, `"dwa"`→null,
    - text→checkbox `"tak"`/`"1"`/`"x"`/`"X"`→true, `"nie"`→false, `""`→null,
    - text→date `"20.11.2026"` i `"2026-11-20"`→`"2026-11-20"`, `"jutro"`→null,
    - text→status zbiera opcje,
    - number→text 12.5→`"12,5"`,
    - status→text → etykieta,
    - status→select zachowuje id,
    - checkbox→text true→`"tak"`, false→`"nie"`,
    - rating→number 4→4,
    - number→rating 7→null.
  - **`planTypeChange`:**
    - text→status z wartościami `["Rozrywka","Praca","Rozrywka",""]` daje 2 opcje w kolejności pierwszego wystąpienia (kolory z palety po kolei), wartości to id opcji, `lost` = 0,
    - text→number z `["5","pięć"]` daje `lost` = 1 i `values[row2]` = null.
  - **`relativeDue uses provided today`:** today `2026-11-15` (z makiety `Projects`):
    - `2026-11-14`→„minął”, `2026-11-15`→„dziś”, `2026-11-16`→„jutro”,
    - `2026-11-20`→„za 5 dni”, `2027-01-14`→„za 60 dni”,
    - `2027-02-15`→„za 3 mies.” (round(92/30) = 3).
  - **`isUrgent`:** d=0 i d=7 → true, d=8 → false, d=-1 → false, `done` → false, `null` → false.

- [ ] **Step 2: Run** `pnpm vitest run src/features/pages/fields.test.ts`. Oczekiwane: FAIL (brak modułu).
- [ ] **Step 3: Implement** w `fields.ts`. `relativeDue` jak `rel` w `Projects.dc.html`: d<0 „minął”, 0 „dziś”, 1 „jutro”, ≤60 „za N dni”, dalej „za round(d/30) mies.”.
- [ ] **Step 4: Run test.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(strony): typy pól, formatowanie i konwersja wartości`.

---

### Task 3: Logika tabeli, szablony i menu „/”

**Files:**
- Create: `src/features/pages/table-model.ts`, `table-model.test.ts`, `templates.ts`, `templates.test.ts`, `blocks.ts`, `blocks.test.ts`

**Interfaces:**
- Consumes: Task 2 (`PageField`, `CellValue`, `normalizeValue`, `relativeDue`).
- Produces:
  - **Typy (`table-model.ts`):**
    - `type PageRow = { id: string; values: Record<string, unknown>; position: number; deletedAt: string | null }`
    - `type SortKey = { field_id: string; dir: 'asc'|'desc' }`
    - `type FilterCond = { field_id: string; op: 'checked'|'unchecked'|'in'|'gte'|'lte'|'contains'|'before'|'after'|'empty'|'not_empty'; value?: unknown }`
    - `type SummaryKind = 'none'|'count'|'filled'|'empty'|'sum'|'avg'|'min'|'max'|'checked'|'earliest'|'latest'|'nearest'`
    - `type PinnedCard = { label: string; field_id: string; aggregation: 'count_option'|'count_option_of_total'|'count_option_in_year'|'avg'|'nearest_date'|'count_distinct'; option_id?: string; date_field_id?: string; title_field_id?: string; done_option_id?: string }`
    - `type TableSettings = { sort: SortKey[]; filters: FilterCond[]; hidden_field_ids: string[]; column_summaries: Record<string, SummaryKind>; pinned_cards: PinnedCard[] }`
  - **Funkcje (`table-model.ts`):**
    - `operatorsFor(type: FieldType): FilterCond['op'][]` — checkbox: checked/unchecked; select/status: in, empty; number/rating: gte/lte/empty; text/url: contains/empty; date: before/after/empty.
    - `visibleRows(fields, rows, settings, extraFilters?: FilterCond[] | null): PageRow[]` — wyrzuca `deletedAt`, stosuje filtr (`extraFilters` zastępuje `settings.filters`, gdy nie jest `null`), potem sort. Bez sortu zostaje kolejność `position`. Puste wartości zawsze na końcu.
    - `summaryOptions(type): SummaryKind[]`, `summarize(field, rows, kind, today): string`
    - `computeCard(card, fields, rows, today): { value: string; sub: string; urgent?: boolean }`
    - `editorFooter(field, rows): string | null` — Liczba: suma; Checkbox: „x / y”; inne: null.
  - **`templates.ts`:**
    - `type TemplateKey = 'empty'|'books'|'projects'|'websites'`
    - `TEMPLATES: Record<TemplateKey, { name: string; icon: string; desc: string; extra: string; fields: {...}[]; cards; sort; summaries }>` — teksty `name`/`desc`/`extra` z `NewPage`, pola wg Ruling.
    - `buildTemplateBlocks(key: TemplateKey, newId: () => string): CreatePageBlock[]` — nadaje id polom i podstawia je w ustawieniach.
    - `NEW_TABLE_BLOCK(newId): CreatePageBlock` — Nazwa (Tekst, tytułowe), Status (Wybór: Do zrobienia / W toku / Zrobione), Data, 2 puste wiersze (spec 6.8).
    - `PENDING_TO_TEMPLATE: Record<string, TemplateKey>` — `{Books:'books', Projects:'projects', Websites:'websites'}`.
  - **`blocks.ts`:**
    - `SLASH_ITEMS` — 5 pozycji z `EmptyPage` (ikona, nazwa, opis, typ), w kolejności Tabela, Lista zadań, Nagłówek, Tekst, Separator,
    - `filterSlash(query: string): typeof SLASH_ITEMS` — bez wielkości liter i polskich znaków, po nazwie i opisie,
    - `QUICK_START` — 4 chipy „albo zacznij od”.

- [ ] **Step 1: Write the failing tests:**
  - **Sort (`visibleRows`):**
    - po Statusie sortuje wg kolejności opcji, nie alfabetu,
    - po Dacie rosnąco z pustymi na końcu, także przy `desc`,
    - dwa klucze (Books: status, data).
  - **Filtr:**
    - `checked`,
    - `in` z dwiema opcjami,
    - `gte` na Liczbie,
    - `contains` bez wielkości liter,
    - `before` na Dacie,
    - warunki łączone „i”.
  - **`rows with deletedAt are excluded`:** dotyczy `visibleRows`, `summarize` i `computeCard`.
  - **`ignores settings for missing fields`:** sort, filtr, podsumowanie i karta z nieistniejącym `field_id` → brak wyjątku, wynik jak bez nich, karta `value` „—”.
  - **`summarize`:**
    - sum/avg Liczby („43,00 zł” przy `pln`),
    - avg Oceny z 1 miejscem po przecinku,
    - count/filled/empty,
    - checked „x / y”,
    - earliest/latest/nearest dat (nearest = najbliższa ≥ today).
  - **`computeCard`** na danych Books z `Books.dc.html` (today `2026-11-15`):
    - „Przeczytane w 2026” = liczba Przeczytane z datą w 2026,
    - „Czytam teraz” = liczba Czytam,
    - „Średnia ocena” = średnia niepustych.
  - **Projects:**
    - „Najbliższy termin” = nazwa + `relativeDue` najbliższego terminu ≥ today wśród nie-Zrobione, `urgent` przy ≤7 dni,
    - „Zrobione” `count_option_of_total` → „x / N”.
  - **Websites:** „Klienci” = liczba różnych niepustych.
  - **`editorFooter`:** Liczba → suma, Checkbox → „2 / 3”, Tekst → null.
  - **`buildTemplateBlocks('books', seqId)`:**
    - pola: Tytuł, Autor, Status, Ocena, Przeczytana, z typami wg Ruling i `is_title` tylko na Tytule,
    - wszystkie `field_id` w `settings` (sort, karty, podsumowania) wskazują id z `fields`,
    - Projects.Termin ma `show_in_calendar: true`, a Projects i Websites mają `empty_label` „Bez nazwy”.
  - **`filterSlash`:** `"tab"`→[Tabela], `"LISTA"`→[Lista zadań], `"naglowek"`→[Nagłówek], `"xyz"`→[].

- [ ] **Step 2: Run** `pnpm vitest run src/features/pages`. Oczekiwane: FAIL.
- [ ] **Step 3: Implement.** Dane szablonów (opcje, kolory, karty, podsumowania stopek) przepisz z `Books`/`Projects`/`Websites.dc.html`.
- [ ] **Step 4: Run.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(strony): sort, filtr, podsumowania, karty, szablony i menu „/”`.

---

### Task 4: Loadery i Server Actions stron

**Files:**
- Create: `src/features/pages/load-pages.ts`, `load-page.ts`, `schemas.ts`, `actions.ts`, `actions.test.ts`, `load-pages.test.ts`
- Modify: `src/app/(app)/layout.tsx` (lista stron do `AppSidebar` przez `AppShell`), `src/components/shell/app-shell.tsx`

**Interfaces:**
- Consumes: Task 1 (RPC), Task 2, Task 3 (`buildTemplateBlocks`, `NEW_TABLE_BLOCK`, `PENDING_TO_TEMPLATE`).
- Produces:
  - **Typy:**
    - `type PageSummary = { id; title; icon; favorite; templateKey: TemplateKey | null; position; rowCount: number }`
    - `type LoadedPage = { page: PageSummary & { createdAt }; blocks: LoadedBlock[]; today: IsoDate; currency: string }`
    - `type LoadedBlock = { id; type; position; content; fields: PageField[]; rows: PageRow[] }`
  - **Loadery:**
    - `loadPages(): Promise<PageSummary[]>` — najpierw `claim_pending_pages(Object.keys(PENDING_TO_TEMPLATE))`, dla zwróconych `create_page` z szablonu, potem lista,
    - `loadPage(id: string): Promise<LoadedPage | null>` — null dla cudzej, usuniętej albo nieistniejącej strony.
  - **Actions** (wszystkie zwracają `{ ok: true, ... } | { ok: false }`, walidacja zod, `revalidatePath('/strony', 'layout')` tam, gdzie zmienia się sidebar):
    - **strony:** `createBlankPage(): {id}`, `createPageFromTemplate(key: TemplateKey, title: string): {id}`, `renamePage(id, title)`, `setPageIcon(id, icon)`, `setFavorite(id, on)`, `reorderPages(ids)`, `duplicatePage(id): {id}`, `deletePage(id)`, `restorePage(id)`,
    - **bloki:** `addBlock(pageId, type): {block: LoadedBlock}` (dla tabeli z `NEW_TABLE_BLOCK`), `updateBlockContent(blockId, content)`, `deleteBlock(blockId)`, `restoreBlock(blockId)`,
    - **pola:** `addField(blockId, {name, type, config}): {field}`, `updateField(fieldId, {name?, config?})`, `changeFieldType(fieldId, type, config, values)`, `reorderFields(blockId, ids)`, `deleteField(fieldId)` (odrzuca `is_title`; czyści klucz z `values` wierszy i z ustawień bloku),
    - **wiersze:** `addRow(blockId, values): {row}`, `updateRow(rowId, values)` (wartości przez `normalizeValue`; pusty tytuł → `empty_label`), `deleteRow(rowId)`, `restoreRow(rowId)`,
    - **ustawienia tabeli:** `saveTableSettings(blockId, patch: Partial<TableSettings>)`,
    - **kosz:** `loadTrash(): {pages: {id,title,deletedAt,rowCount}[]; rows: {id,title,pageTitle,deletedAt}[]}`.

- [ ] **Step 1: Write the failing tests** (mock klienta Supabase jak w `src/features/sport/actions.test.ts`):
  - `createPageFromTemplate('books','')` woła `create_page` z tytułem „Books” (pusty → nazwa szablonu) i blokami z `buildTemplateBlocks`,
  - `updateRow` z pustym tytułem zapisuje `empty_label`, a z `"abc"` w polu Liczba zapisuje null,
  - `deleteField` na polu tytułowym → `{ok:false}` bez zapytania,
  - `deleteRow` ustawia `deleted_at`, a `restoreRow` ustawia `deleted_at: null`,
  - zod odrzuca tytuł strony > 200 znaków i nazwę pola pustą albo > 60 znaków,
  - `loadPages` przy `claim_pending_pages` → `['Projects']` woła `create_page` raz z `template_key` `projects`, a przy `[]` nie woła wcale.
- [ ] **Step 2: Run.** Oczekiwane: FAIL.
- [ ] **Step 3: Implement.** Loadery filtrują `deleted_at is null`. `today` = `todayIso(profil.timezone)`, `currency` z profilu.
- [ ] **Step 4: Run** `pnpm vitest run src/features/pages && pnpm typecheck`. Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(strony): loadery i akcje stron, bloków, pól i wierszy`.

---

### Task 5: Sidebar ze stronami, menu strony, `/strony` (MPages), `/strony/nowa` (NewPage)

**Files:**
- Modify: `src/components/shell/app-sidebar.tsx` (+ test), `src/app/(app)/strony/page.tsx`
- Create: `src/features/pages/page-menu.tsx`, `icon-grid.tsx`, `delete-page-dialog.tsx`, `new-page-view.tsx`, `mobile/m-pages.tsx`, `src/app/(app)/strony/nowa/page.tsx` (+ testy `*.test.tsx`)

**Interfaces:**
- Consumes: Task 4 (`loadPages`, akcje stron), Task 3 (`TEMPLATES`).
- Produces: `PageMenu({ page, onRename })` (web: dymek; telefon: arkusz), `ICONS: string[]` (24 ikony z `PageMenu.dc.html`, dosłownie).

- [ ] **Step 1: Write the failing tests:**
  - **`app-sidebar.test.tsx`:**
    - strony w kolejności `position`, pusty tytuł jako „Bez tytułu”, aktywna strona z tłem `#f0f0f0`,
    - „+” przy nagłówku i „+ Nowa strona” wołają `createBlankPage` i przechodzą do `/strony/{id}`,
    - F2 na aktywnej pozycji włącza edycję nazwy (Enter zapisuje, Esc anuluje),
    - przeciągnięcie pozycji woła `reorderPages` z nową kolejnością.
  - **`page-menu.test.tsx`:**
    - pozycje z makiety + „★ Dodaj do ulubionych”,
    - „Przenieś wyżej / niżej” wołają `reorderPages`,
    - „Usuń stronę” otwiera potwierdzenie „Usunąć stronę „Books”?” z „{N} wierszy trafi do kosza na 30 dni. Daty z tej strony znikną z kalendarza.” (odmiana N),
    - po potwierdzeniu `deletePage`, toast „Usunięto” z „Cofnij” → `restorePage`, przejście do `/strony` gdy usunięto bieżącą,
    - siatka ikon ustawia ikonę.
  - **`new-page-view.test.tsx`:**
    - 4 szablony; wybór zmienia panel „Pola, które powstaną” (Books: Tytuł Tekst … Przeczytana Data),
    - „Utwórz stronę” woła `createPageFromTemplate(key, nazwa)` i przechodzi do strony,
    - „Anuluj” wraca (`router.back()`).
  - **`m-pages.test.tsx`:**
    - sekcja „Ulubione” tylko z ulubionymi, „Wszystkie strony” z pozostałymi,
    - dopisek pod nazwą „N wierszy” (odmiana) albo „pusta strona” dla strony bez tabeli,
    - wyszukiwarka filtruje po tytule,
    - „Nowa strona” tworzy stronę,
    - ⚙ prowadzi do `/ustawienia`.
- [ ] **Step 2: Run.** Oczekiwane: FAIL.
- [ ] **Step 3: Implement** wg `Sidebar`, `PageMenu`, `NewPage`, `MPages`. Na `/strony` web pokazuje dotychczasowy nagłówek i tekst pusty tylko przy 0 stron, a w przeciwnym razie przekierowuje na pierwszą stronę. Telefon zawsze pokazuje `MPages`.
- [ ] **Step 4: Run** testy komponentów + `pnpm typecheck`. Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(strony): sidebar ze stronami, menu strony, lista stron i wybór szablonu`.

---

### Task 6: Edytor bloków (web) i menu „/”

**Files:**
- Create: `src/app/(app)/strony/[id]/page.tsx`, `src/features/pages/editor/editor-view.tsx`, `use-editor-store.ts`, `text-block.tsx`, `todo-block.tsx`, `command-line.tsx`, `slash-menu.tsx` (+ testy)

**Interfaces:**
- Consumes: Task 3 (`SLASH_ITEMS`, `filterSlash`, `QUICK_START`), Task 4 (`loadPage`, akcje bloków, `renamePage`).
- Produces:
  - `EditorView({ data: LoadedPage })`,
  - `useEditorStore(initial)` z akcjami `addBlock(type, text?)`, `updateBlock(id, content)`, `removeBlock(id)` (optymistycznie + rollback),
  - strona `/strony/[id]` wybiera `EditorView` (bez szablonu) albo `TemplatePageView` (Task 8); `notFound()` dla null.

- [ ] **Step 1: Write the failing tests** (`editor-view.test.tsx`, `slash-menu.test.tsx`):
  - zmiana tytułu od razu zmienia ścieżkę „Strony / {tytuł}” (pusty → „Bez tytułu”) i zapisuje się po utracie fokusu,
  - wpisanie „/” otwiera „Bloki” z 5 pozycjami; „/tab” zostawia Tabelę,
  - ↓↓ Enter wstawia trzecią pozycję; Esc zamyka; najechanie podświetla; „/xyz” → „Brak bloku „xyz””; stopka „↑↓ wybór · Enter wstaw · Esc zamknij”,
  - Enter na zwykłym tekście „Hej” wstawia akapit „Hej” na końcu i czyści pole,
  - pusta strona pokazuje chipy „albo zacznij od:” (4) i „Wolisz gotowca? Użyj szablonu →” (`/strony/nowa`); po pierwszym bloku znikają,
  - Lista zadań: checkbox przekreśla tekst i zapisuje `{text, done}`,
  - kosz bloku po najechaniu woła `removeBlock` i toast „Usunięto · Cofnij”,
  - bloki renderują się w kolejności `position`,
  - błąd zapisu cofa wstawiony blok i pokazuje toast błędu.
- [ ] **Step 2: Run.** Oczekiwane: FAIL.
- [ ] **Step 3: Implement** wg `EmptyPage.dc.html`: ikona 40×40 z przerywaną ramką (klik → siatka ikon z Task 5), tytuł 24 px, „Szablony” → `/strony/nowa`. Blok `table` renderuje komponent z Task 7.
- [ ] **Step 4: Run.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(strony): edytor bloków z menu „/”`.

---

### Task 7: Blok tabeli w edytorze (komórki, kolumny, zmiana typu)

**Files:**
- Create: `src/features/pages/editor/table-block.tsx`, `column-popover.tsx`, `cell-editor.tsx`, `type-change-dialog.tsx` (+ testy)

**Interfaces:**
- Consumes: Task 2 (`EDITOR_TYPES`, `planTypeChange`, `formatValue`), Task 3 (`editorFooter`), Task 4 (akcje pól i wierszy).
- Produces:
  - `TableBlock({ block, editable: 'cell' })`,
  - `TypeChangeDialog({ lost, onConfirm, onCancel })` — używa go też Task 9.

- [ ] **Step 1: Write the failing tests:**
  - nowa tabela z menu „/” ma kolumny Nazwa, Status, Data i 2 wiersze; licznik „2 wiersze · 3 kolumny” (odmiana),
  - pole nazwy tabeli z placeholderem „Tabela bez nazwy” zapisuje `content.name`,
  - klik w nagłówek otwiera dymek: nazwa, „Typ pola” (6), przy Wyborze „Opcje” (plakietki z ×, „Nowa opcja…” + Dodaj/Enter), „← W lewo / W prawo →”, „Usuń kolumnę” (wyłączone przy ostatniej kolumnie i dla pola tytułowego),
  - „+” w nagłówku dodaje „Kolumna 4” i od razu otwiera jej dymek,
  - komórki: tekst edytowany w miejscu, Data przez `DatePicker`, Wybór przez `Dropdown` z „Wyczyść” i „Edytuj opcje”, Checkbox jednym kliknięciem,
  - zmiana typu Tekst→Liczba bez strat zapisuje od razu przez `changeFieldType`; ze stratą pokazuje `TypeChangeDialog` z liczbą wartości,
  - stopka: suma Liczby, „x / y” Checkboxa,
  - „+ Nowy wiersz” dodaje pusty wiersz na końcu.
- [ ] **Step 2: Run.** Oczekiwane: FAIL.
- [ ] **Step 3: Implement** wg `EmptyPage.dc.html` (pierwsza kolumna szersza, siatka, dymki w portalu).
- [ ] **Step 4: Run.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(strony): blok tabeli w edytorze ze zmianą typu kolumn`.

---

### Task 8: Strona z szablonu — karty, tryb wiersza, „+ Pole”

**Files:**
- Create: `src/features/pages/table/template-page-view.tsx`, `use-table-store.ts`, `pinned-cards.tsx`, `row-preview.tsx`, `row-edit.tsx`, `add-field-dialog.tsx`, `mobile/m-row-sheet.tsx` (+ testy)

**Interfaces:**
- Consumes: Task 2, Task 3 (`visibleRows`, `computeCard`, `summarize`), Task 4.
- Produces:
  - `TemplatePageView({ data: LoadedPage })`,
  - `useTableStore(block)` z polami `rows`, `fields`, `settings`, `tempFilters` i akcjami `saveRow`, `addRowDraft`, `removeRow`, `addField`, `patchSettings`, `setTempFilters`. Task 9 dopina do niego menu kolumny i filtr.

- [ ] **Step 1: Write the failing tests** (dane z `Books.dc.html`, today `2026-11-15`):
  - **Nagłówek i metadane:**
    - nagłówek „Strony / Books” z przyciskami Filtruj, „+ Pole”, „Nowy wiersz”,
    - metadane „{N} wierszy · 5 pól · szablon „{nazwa}” · sort: status, data” — N liczone na żywo; dla Websites bez części „sort”.
  - **Karty:** 3 przypięte karty z wartościami z `computeCard`; Projects „Najbliższy termin” czerwony przy ≤7 dni.
  - **Podgląd wiersza:**
    - plakietki, gwiazdki, `dd.mm.rrrr`, Projects „za N dni / minął / dziś / jutro / za N mies.”,
    - klik w wiersz otwiera edycję,
    - link URL/Repo nie otwiera edycji (`stopPropagation`),
    - „Edytuj”/„Usuń” po najechaniu w ostatniej kolumnie.
  - **Tryb edycji:**
    - tło `#f7fbf8`, pola tekstowe, `Dropdown` statusu/Select z plakietką i ✓, `DatePicker`,
    - gwiazdki: klik ustawia, ponowny klik tej samej zeruje,
    - „Zapisz” (czarny) zapisuje; ✕ anuluje bez zapisu.
  - **„Nowy wiersz”:** wiersz w edycji na końcu; zapis z pustym tytułem → „Bez tytułu” (Books) / „Bez nazwy” (Projects).
  - **„Usuń”:** wiersz znika, liczniki i karty od razu się przeliczają, toast „Usunięto · Cofnij”.
  - **„+ Pole”:** okno `AddField` z grupą „Podstawowe” (8 typów); nazwa pola domyślna z typu (`defName` z makiety); Select/Status z opcjami; „Dodaj pole” dopisuje kolumnę na końcu.
  - **Telefon:** stuknięcie wiersza otwiera arkusz z tymi samymi kontrolkami, „Usuń wiersz”, „Anuluj”/„Zapisz”.
  - **Podsumowania:** stopka z „+ Nowy wiersz” i podsumowaniami z `settings.column_summaries` (teksty jak w makiecie).
- [ ] **Step 2: Run.** Oczekiwane: FAIL.
- [ ] **Step 3: Implement** wg `Books`/`Projects`/`Websites.dc.html` i `AddField.dc.html`. Tabela przewija się poziomo tylko poniżej 1100 px.
- [ ] **Step 4: Run.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(strony): strony z szablonu z kartami i trybem edycji wiersza`.

---

### Task 9: Menu kolumny, filtr, podsumowania, ukryte kolumny

**Files:**
- Create: `src/features/pages/table/column-menu.tsx`, `filter-popover.tsx`, `summary-cell.tsx` (+ testy)
- Modify: `src/features/pages/table/template-page-view.tsx`

**Interfaces:**
- Consumes: Task 3 (`operatorsFor`, `summaryOptions`, `visibleRows`), Task 7 (`TypeChangeDialog`), Task 8 (`useTableStore`).

- [ ] **Step 1: Write the failing tests:**
  - **Menu kolumny:** klik w nagłówek otwiera menu z makiety:
    - „Typ: {typ} ›” (podmenu typów podstawowych, zmiana przez `planTypeChange` + `TypeChangeDialog` przy stratach),
    - „Sortuj rosnąco/malejąco” (zapis `settings.sort`, metadane „sort: {nazwa pola}”),
    - „Filtruj po tym polu” (otwiera filtr z warunkiem dla pola),
    - „Podsumowanie {wartość} ›” (opcje z `summaryOptions`),
    - „Pokaż w kalendarzu” tylko dla Daty (przełącza `config.show_in_calendar`, nagłówek dostaje znaczek „w kalendarzu”),
    - „Ukryj kolumnę”, „Usuń pole” (pole tytułowe: Usuń i Typ wyszarzone).
  - **Ukryta kolumna:** znika, a w metadanych pojawia się „· 1 ukryte”; klik w ten tekst pokazuje wszystkie.
  - **Filtr:**
    - warunki „Gdzie … i …”, operatory wg typu, wartość: `Dropdown`/chipy opcji/`DatePicker`/pole liczby (`TextField` z `inputMode="decimal"`),
    - „+ Dodaj warunek”, ✕ usuwa warunek, „Wyczyść”,
    - licznik „{x} z {N} wierszy”, przycisk nagłówka „Filtruj · {liczba warunków}”, dopisek „Filtr zmienia tabelę i sumy. Nie wpływa na kalendarz.”,
    - tabela, karty i podsumowania liczą się z wierszy po filtrze,
    - „Zapisz jako domyślny” zapisuje `settings.filters` (po odświeżeniu filtr nadal działa).
- [ ] **Step 2: Run.** Oczekiwane: FAIL.
- [ ] **Step 3: Implement** wg `ColumnMenu.dc.html` i `FilterPopover.dc.html`.
- [ ] **Step 4: Run.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(strony): menu kolumny, filtr i podsumowania`.

---

### Task 10: Telefon — MEditor

**Files:**
- Create: `src/features/pages/editor/mobile/m-editor.tsx`, `m-insert-sheet.tsx`, `m-column-sheet.tsx` (+ testy)
- Modify: `src/features/pages/editor/editor-view.tsx` (gałąź `max-[799px]:`)

**Interfaces:**
- Consumes: Task 6 (`useEditorStore`), Task 7 (komponenty komórek, `planTypeChange`), Task 3 (`filterSlash`).

- [ ] **Step 1: Write the failing tests** wg `MEditor.dc.html`:
  - pusty edytor pokazuje podpowiedź „Stuknij „+” na dole albo wpisz „/”, żeby wstawić blok.”,
  - pasek skrótów na dole: „+” i „/” otwierają arkusz „Wstaw blok” (5 pozycji, filtrowanie, „Brak bloku „x””), ikona tabeli wstawia tabelę, ikona zadania wstawia Listę zadań, „H” wstawia Nagłówek, licznik „{N} bloków” (odmiana),
  - tabela przewija się poziomo,
  - nagłówek kolumny otwiera arkusz „Kolumna” (nazwa, „Typ pola”, ← W lewo / W prawo →, Usuń kolumnę, Gotowe),
  - stuknięcie komórki Wyboru zmienia opcję na następną po kolei (po ostatniej → pusta).
- [ ] **Step 2: Run.** Oczekiwane: FAIL.
- [ ] **Step 3: Implement.** Pasek skrótów siedzi nad `--tabbar-h`.
- [ ] **Step 4: Run.** Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(strony): edytor na telefonie`.

---

### Task 11: Kosz w Ustawieniach, 404, e2e, zrzuty, mapa etapów

**Files:**
- Create: `src/features/settings/trash-card.tsx` (+ test), `e2e/pages.spec.ts`
- Modify: `src/app/(app)/ustawienia/[zakladka]/page.tsx` (Ogólne: karta „Kosz” z `id="kosz"`), `src/app/not-found.tsx`, `e2e/visual.spec.ts`, `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md`

**Interfaces:**
- Consumes: Task 4 (`loadTrash`, `restorePage`, `restoreRow`).

- [ ] **Step 1: Write the failing tests:**
  - **`trash-card.test.tsx`:**
    - listy „Strony” i „Wiersze” z datą usunięcia `dd.mm.rrrr` i dopiskiem „zostało N dni” (30 − dni od usunięcia) *[Claude]*,
    - „Przywróć” woła akcję i usuwa pozycję z listy,
    - pusty kosz: „Kosz jest pusty.” *[Claude]*.
  - **`e2e/pages.spec.ts`:**
    - (a) **Books z szablonu:** `/strony/nowa` → Books → „Utwórz stronę”; potem „Nowy wiersz”, wpisz tytuł, status Czytam, Zapisz → karta „Czytam teraz” = 1; edycja oceny; Usuń → wiersz znika, Cofnij → wraca,
    - (b) **edytor:** „+ Nowa strona” → tytuł → „/tab” Enter → tabela; zmiana typu kolumny Status na Tekst bez strat; wpisanie „5” w komórce tekstowej i zmiana typu na Liczbę → stopka „5”,
    - (c) **kosz:** usunięcie strony z menu (potwierdzenie) → strona znika z sidebaru → Ustawienia → Ogólne → Kosz → Przywróć → strona wraca,
    - (d) **telefon 390 px:** `/strony` pokazuje listę, a „Nowa strona” otwiera edytor z paskiem skrótów.
  - **`visual.spec.ts`:** zrzuty `NewPage`, edytor z tabelą, Books, menu kolumny, filtr, `MPages`, `MEditor`.
- [ ] **Step 2: Implement.** W 404 słowo „kosza” jako `<Link href="/ustawienia/ogolne#kosz">`.
- [ ] **Step 3: Run** `pnpm vitest run && pnpm typecheck && pnpm lint`. Oczekiwane: PASS. Push i CI (`e2e`, `db`) zielone.
- [ ] **Step 4: Mapa etapów:** odhacz pozycje Etapu 6 z odnośnikami do testów (format jak w Etapach 2–5); niezrobione zostaw z dopiskiem dlaczego.
- [ ] **Step 5: Commit** `test(strony): e2e, zrzuty, kosz w ustawieniach i mapa etapów`.
