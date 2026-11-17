# Etap 2: Kalendarz główny i zadania — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kalendarz z widokami tydzień / dzień / miesiąc (web i telefon), blokami jednorazowymi i cyklicznymi, edycją z zakresem (to / to i następne / wszystkie), zadaniami w każdym wystąpieniu bloku i zadaniami samodzielnymi (logika), kategoriami z filtrami oraz zakładką Ustawienia → Kategorie.

**Architecture:**
- Baza trzyma serie (`blocks` z `recurrence`) i wyjątki (`block_exceptions`). Wystąpienia liczy przy odczycie czysta funkcja TS `expandOccurrences`; nic nie jest generowane z góry.
- Strona `/kalendarz` (Server Component) czyta serie, wyjątki, zadania i kategorie dla zakresu widoku. Klient rozwija wystąpienia, rysuje siatkę i zmienia dane przez Server Actions optymistycznie, z cofnięciem przy błędzie.
- Zmiany „to i następne” to jedna funkcja SQL (atomowe rozcięcie serii i przeniesienie zadań przyszłych wystąpień). Planowanie zmian z zakresem to czysta funkcja `planScopeChange` z testami.
- Siatka, przeciąganie i rozciąganie są własne: zdarzenia wskaźnika, krok 15 min, bez FullCalendar i dnd-kit *[Claude, spec 9 zostawia wybór; prościej trafić 1:1 w makiety]*.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Radix (shadcn), Supabase (Postgres, RLS, pgTAP), zod 4, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-rhytm-design.md` — sekcje 0, 3.2, 4 (trasy), 5 (`categories`, `blocks`, `block_exceptions`, `tasks`), 6.4, 6.11 (Kategorie kalendarza), 6.13, 7, 9, 9.2. **Mapa etapów:** `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md` (Etap 2 + „Wspólne”). **Makiety** (`docs/design/mockups/`): web `Calendar`, `CalendarDay`, `CalendarMonth`, `BlockDialog`, `ScopeDialog`, `CategoryDialog`; telefon `MCalendarDay`, `MCalendarWeek`, `MCalendarMonth`, `MBlockSheet`. Teksty, kolory, wymiary i zachowania czytaj z ich `<style>` i `<script>` (`renderVals`) i przepisuj dosłownie.

## Global Constraints
- Obowiązuje wszystko z Global Constraints planów Etapu 0 i 1: Next.js 16 (czytaj `node_modules/next/dist/docs/` przed użyciem API), makiety 1:1 z tekstami dosłownie, tylko kontrolki z `src/components/controls` (bez `<select>`, `<input type=date|time>`), web/telefon wyłącznie klasami `max-[799px]:` / `min-[800px]:`, cele dotyku na telefonie ≥ 44 px, przyciski-ikony z `aria-label`, komentarze po polsku, płaski czytelny kod (Mejson nie lubi skakania po funkcjach pomocniczych).
- **Git:** gałąź `feat/etap-2` od `main`; nigdy commit na `main`. Migracje trafiają do chmury (`pnpm exec supabase db push --remote`) **przed** scaleniem.
- **Baza:**
  - każda nowa tabela: `user_id uuid not null references auth.users(id) on delete cascade`, RLS „tylko własne wiersze” przez `(select auth.uid())`,
  - **jawne `GRANT`** dla `authenticated` (chmurowy Supabase ich nie nadaje — błąd z Etapu 1) i `grant all … to service_role`, sprawdzone testem pgTAP `has_table_privilege`,
  - funkcje SQL: `security invoker`, `set search_path = ''`, `revoke execute … from public, anon`, `grant execute … to authenticated`,
  - aliasy tabel w SQL pisane z jawnym `AS` (preferencja Mejsona).
- **Czas:**
  - `blocks.start_local` to `timestamp` (bez strefy) = czas ścienny. Kalendarz pokazuje go jako czas lokalny w strefie z profilu, więc zmiana czasu letni/zimowy nie przesuwa bloków,
  - `blocks.timezone` zapisuje strefę z profilu w chwili utworzenia (dla powiadomień w Etapie 9),
  - „teraz” i „dziś” liczone w strefie profilu,
  - tydzień od `profiles.week_start`, godziny wg `profiles.clock` (24 / 12 h, spec 9.2).
- **Siatka:** cała doba 00–24, przy otwarciu przewinięta do 06:00 (web) / 07:00 (telefon) albo do trwającego bloku (spec 9.2 wygrywa z „06–22” w mapie etapów). Krok przeciągania i −/+ na telefonie: 15 min. Minimalny blok: 15 min. Blok nie przechodzi przez północ (koniec ≤ 24:00) *[Claude]*.
- **Powtarzanie** (`blocks.recurrence`, `null` = jednorazowy): `{ freq: 'daily' | 'weekdays' | 'weekly' | 'custom', byWeekday?: number[] (1 = pn … 7 = nd), until?: 'YYYY-MM-DD' }`; `weekly` powtarza dzień tygodnia z `start_local`; `custom` wymaga niepustego `byWeekday`.
- **Kategorie:**
  - 8 kolorów z `CategoryDialog.dc.html` (przepisz dosłownie z jego `<script>`),
  - kategorie systemowe (`is_system = true`, np. Sport) to tylko filtry podglądu: nie można do nich przypisać bloku, zmienić nazwy ani usunąć, tylko ukryć,
  - `categories.hidden` = filtr „pokaż / ukryj” w kalendarzu, zapisywany w bazie (ten sam stan na każdym urządzeniu),
  - usunięcie kategorii zostawia bloki z `category_id = null` (szary kolor `#a3a3a3`, chip „Bez kategorii”) *[Claude]*.
- **Zadania (`tasks`):**
  - w wystąpieniu bloku: `block_id` + `occurrence_date`, `due_date = occurrence_date`,
  - samodzielne: `block_id = null`, `due_date` data albo `null`,
  - przypięcie ustawia `block_id` + `occurrence_date` (+ `due_date`); odpięcie zeruje `block_id` i `occurrence_date`, a `due_date` zostaje,
  - zadania wystąpień usuniętych (anulowanych, skróconych serii) **nie przepadają**: stają się samodzielne z `due_date` = data wystąpienia (makieta `ScopeDialog`: „Zadania z odhaczonych wystąpień nie przepadają.”) *[Claude]*.
- **Treningi i wpisy ze stron w kalendarzu** to Etapy 4 i 7: w Etapie 2 wiersz „cały dzień” jest pusty, chip „Subscriptions” nie jest pokazywany, chip „Sport” pokazuje licznik 0. W dymku „Nowy wpis” opcje „Bieg” i „Siłownia” prowadzą do `/sport?nowy=bieg|silownia&data=YYYY-MM-DD&godzina=HH:MM` (obsłuży je Etap 4).
- **Optymizm (Wspólne):** liczniki, paski i bloki zmieniają się od razu; błąd akcji cofa zmianę i pokazuje toast „Nie udało się zapisać. Spróbuj ponownie.” (sonner z Etapu 0).

## Rozstrzygnięcia (Ruling) przed startem
- **Okno zakresu** pojawia się przy edycji z oknem, usuwaniu, przeciąganiu i rozciąganiu wystąpienia bloku cyklicznego. Przy blokach jednorazowych nie pojawia się.
- **Semantyka zakresów** (`planScopeChange`):
  - **tylko to:** wyjątek `modified` (nowy start, czas, tytuł) albo `cancelled`,
  - **to i następne:** funkcja SQL `split_block_series(p_block_id, p_from date, p_patch jsonb, p_delete bool)` w jednej transakcji:
    - ustawia `until` starej serii na dzień przed `p_from` (albo usuwa serię, gdy `p_from` jest pierwszym wystąpieniem),
    - przy edycji tworzy nową serię od `p_from` z poprawkami i przenosi na nią zadania wystąpień `≥ p_from`,
    - przy usuwaniu zamienia te zadania na samodzielne,
    - przenosi albo kasuje wyjątki `≥ p_from` (kasuje przy zmianie godzin, bo przestają pasować),
  - **wszystkie:** aktualizacja serii. Przy zmianie godziny startu wyjątki `modified` zostają, a zmiana dnia tygodnia startu przy `weekly` przesuwa całą serię.
- **Edycja treści bez czasu** (tytuł, kategoria, notatka, przypomnienie) bloku cyklicznego także pyta o zakres, zgodnie z makietą.
- **Zadania na telefonie** (`MBlockSheet`) dodane w arkuszu nowego bloku zapisują się do pierwszego wystąpienia. Na webie zadania dodaje się po zapisie, w dymku (spec 6.4).
- **Powtarzanie na telefonie:** segment z makiety (Nie / Codziennie / Co tydzień / Dni rob.) plus piąta opcja „Własne” z dniami pn–nd i datą końca. Zasada 0.4: treść webowa, wygląd mobilny.
- **„Dzień w liczbach”:**
  - zaplanowane = suma czasu bloków dnia,
  - wolne (8–20) = 12 h minus zajęte w tym oknie (nakładania liczone raz),
  - zadania = zrobione / wszystkie zadania wystąpień dnia.
- **Kolejność kategorii w Ustawieniach:** przyciski „W górę” / „W dół” (bez przeciągania).

## Review Focus
1. **Zmiana czasu letni/zimowy:** blok cykliczny co tydzień o 08:00 przez 29.03.2026 i 25.10.2026 zostaje o 08:00 w obu tygodniach (Europe/Warsaw); dzień „teraz” liczony w strefie profilu, nie serwera (testy w Task 2).
2. **„To i następne” na pierwszym albo ostatnim wystąpieniu i przy `until`:** pierwsze = cała seria zmieniona bez pustej starej serii; ostatnie = nowa seria z jednym wystąpieniem; zadania i wyjątki trafiają do właściwej serii (pgTAP w Task 1, testy w Task 3).
3. **Nakładające się bloki i bloki na krawędzi siatki:** 3 bloki o tej samej godzinie dzielą szerokość kolumny; blok 23:00–24:00 widać w całości; dymek bloku przy dole siatki otwiera się w górę, przy prawej krawędzi w lewo (Task 6 i 7).
4. **Przeciągnięcie poza siatkę, krótkie kliknięcie i anulowanie:** ruch < 4 px to klik (dymek), nie przeciąganie; puszczenie poza siatką albo Esc w trakcie wraca do stanu sprzed; „Anuluj” w oknie zakresu cofa podgląd (Task 9).
5. **Błąd zapisu przy działaniu optymistycznym:** odhaczenie zadania, przesunięcie bloku i ukrycie kategorii cofają się po błędzie akcji i pokazują toast (testy w Task 7, 9, 5).

---

### Task 1: Baza — bloki, wyjątki, zadania, funkcja rozcinania serii

**Files:**
- Create: `supabase/migrations/20261118000001_calendar.sql`, `supabase/tests/calendar.test.sql`
- Modify: `src/types/database.ts` (ręcznie, w kształcie generatora)

**Interfaces:**
- Produces:
  - `blocks (id uuid pk default gen_random_uuid(), user_id, title text not null check (char_length(btrim(title)) between 1 and 120), category_id uuid null references categories(id) on delete set null, note text null check (char_length(note) <= 2000), start_local timestamp not null, duration_min int not null check (duration_min between 15 and 1440), timezone text not null, recurrence jsonb null, remind bool not null default true, created_at timestamptz default now(), updated_at timestamptz default now())`,
  - CHECK na `blocks`: koniec nie przechodzi przez północ (`start_local::time + make_interval(mins => duration_min) <= '24:00'`, zapisane poprawnie dla `time`); `recurrence is null or recurrence->>'freq' in ('daily','weekdays','weekly','custom')`,
  - `block_exceptions (block_id uuid references blocks on delete cascade, user_id, occurrence_date date, kind text check in ('cancelled','modified'), new_start_local timestamp null, new_duration_min int null, new_title text null, primary key (block_id, occurrence_date))`,
  - `tasks (id uuid pk, user_id, title text not null check 1–200 po trim, done bool not null default false, done_at timestamptz null, due_date date null, block_id uuid null references blocks on delete set null, occurrence_date date null, position int not null default 0, created_at timestamptz default now())`, CHECK `(block_id is null) = (occurrence_date is null)`,
  - indeksy: `blocks(user_id, start_local)`, `tasks(user_id, due_date)`, `tasks(block_id, occurrence_date)`,
  - RLS select / insert / update / delete własnych na wszystkich trzech; `block_exceptions` i `tasks` dodatkowo sprawdzają przez `exists`, że `block_id` należy do tego samego użytkownika,
  - GRANT-y (Global Constraints),
  - `public.split_block_series(p_block_id uuid, p_from date, p_patch jsonb, p_delete bool) returns uuid` (id nowej serii albo `null` przy usuwaniu), semantyka z Rozstrzygnięć; `p_patch` klucze: `title`, `category_id`, `note`, `remind`, `start_time` ('HH:MM'), `duration_min`, `recurrence`.

- [ ] **Step 1: Utwórz gałąź** `git switch -c feat/etap-2`.
- [ ] **Step 2: Napisz `supabase/tests/calendar.test.sql`** (użytkownicy A i B):
  - `has_table_privilege('authenticated', …)` dla trzech tabel,
  - A nie widzi bloków, wyjątków ani zadań B; A nie wstawi zadania z `block_id` bloku B ani wyjątku do bloku B (`throws_ok`),
  - CHECK: `duration_min = 10` → błąd; start 23:30 z 60 min → błąd; zadanie z `block_id` bez `occurrence_date` → błąd,
  - `split_block_series` na serii `weekly` od 2026-11-03 (wt 08:00) z zadaniami na 10.11 i 17.11 i wyjątkiem 17.11, `p_from = 2026-11-17`, patch `{"start_time":"09:00"}`: stara seria ma `until` 2026-11-16; nowa seria startuje 2026-11-17 09:00; zadanie z 17.11 ma `block_id` nowej serii; zadanie z 10.11 zostaje przy starej; wyjątek 17.11 skasowany,
  - `split_block_series` z `p_from` = pierwsze wystąpienie i `p_delete = true`: seria usunięta, jej zadania samodzielne z `due_date` = data wystąpienia,
  - B nie może wywołać `split_block_series` na bloku A (zero zmian albo błąd).
- [ ] **Step 3: Napisz migrację.** **Step 4: Wypchnij gałąź i sprawdź zadanie `db` w CI** (`gh run list --branch feat/etap-2 -L1`; przy limicie `setup-cli` → `gh run rerun <id> --failed`). Oczekiwane: wszystkie `ok`.
- [ ] **Step 5: Uzupełnij `src/types/database.ts`**; `pnpm typecheck`.
- [ ] **Step 6: Commit** `feat(db): bloki, wyjątki, zadania i rozcinanie serii`

### Task 2: Logika kalendarza — wystąpienia, zakresy widoków, układ dnia, liczby

**Files:**
- Create: `src/features/calendar/occurrences.ts` (+ test), `src/features/calendar/view-range.ts` (+ test), `src/features/calendar/day-layout.ts` (+ test), `src/features/calendar/recurrence-text.ts` (+ test)

**Interfaces:**
- Produces:
  - typy `Recurrence`, `BlockRow`, `ExceptionRow`, `Occurrence = { key: string /* `${blockId}:${date}` */; blockId: string; date: IsoDate; startMin: number /* od północy */; durationMin: number; title: string; categoryId: string | null; note: string | null; remind: boolean; recurring: boolean; recurrence: Recurrence | null; modified: boolean }`,
  - `expandOccurrences(blocks: BlockRow[], exceptions: ExceptionRow[], from: IsoDate, to: IsoDate): Occurrence[]` — włącznie z obu stron, posortowane po dacie i `startMin`; wyjątek `cancelled` usuwa, `modified` nadpisuje start, czas i tytuł (także przeniesienie na inną godzinę tego dnia),
  - `viewRange(view: 'dzien' | 'tydzien' | 'miesiac', date: IsoDate, weekStart: 'mon' | 'sun'): { from: IsoDate; to: IsoDate; days: IsoDate[] }` (miesiąc = pełne tygodnie siatki),
  - `parseCalendarParams(sp: { widok?: string; data?: string }, today: IsoDate): { view; date }` — nieznany widok → `tydzien`, zła data → dziś,
  - `shiftDate(view, date, dir: -1 | 1): IsoDate`, `isoWeekNumber(date): number`,
  - `layoutDay(items: Occurrence[]): { key: string; col: number; cols: number }[]` — grupy nakładających się bloków dzielą szerokość,
  - `dayNumbers(items: Occurrence[], tasks: { done: boolean }[]): { plannedMin: number; freeMin: number /* 8–20 */; tasksDone: number; tasksTotal: number }`,
  - `nowLine(nowInTz: { date: IsoDate; minutes: number }, day: IsoDate): number | null`,
  - `describeRecurrence(r: Recurrence | null, start: IsoDate): string` — zdanie z `BlockDialog` (np. „Co tydzień we wtorki, do 31.01.2027. Każde powtórzenie ma własną, pustą listę zadań.”; dokładne warianty z makiety), `recurrenceBadge(r): string` („↻ co tydzień”, „↻ codziennie”, „↻ dni robocze”, „↻ własne”).

- [ ] **Step 1: Napisz testy:**
  - `weekly` od wt 2026-11-03 08:00, 60 min, zakres 2026-11-01…2026-11-30 → 4 wystąpienia (3, 10, 17, 24); z `until: '2026-11-17'` → 3,
  - `weekdays` w tygodniu 16–22.11 → 5 (pn–pt); `custom` `[1,3]` → pn i śr; `daily` z `until` przed startem → 0,
  - wyjątek `cancelled` 10.11 → brak; `modified` 17.11 na 09:30 / 30 min / „Inny” → nadpisane, `modified: true`,
  - blok jednorazowy poza zakresem → brak; blok sprzed zakresu z serią → wystąpienia w zakresie,
  - DST: `weekly` 08:00 od 2026-03-24 → 24.03 i 31.03 mają `startMin = 480` (Review Focus 1); to samo przez 25.10,
  - `viewRange('tydzien', '2026-11-18', 'mon')` → 16–22.11; `'sun'` → 15–21.11; `viewRange('miesiac', '2026-11-18', 'mon')` → 26.10–06.12 (6 tygodni),
  - `parseCalendarParams({ widok: 'x', data: '2026-13-40' }, '2026-11-17')` → `{ view: 'tydzien', date: '2026-11-17' }`; `shiftDate('miesiac', '2026-01-31', 1)` → `'2026-02-28'`,
  - `layoutDay` dla 3 bloków 10:00–11:00 → `cols: 3`, kolumny 0/1/2; dla 10–11 i 11–12 → oba `cols: 1`,
  - `dayNumbers` dla bloków 09–11 i 10–12 → `plannedMin 240`, `freeMin 540`; blok 07–09 liczy do wolnego tylko 08–09,
  - `nowLine({ date: '2026-11-17', minutes: 615 }, '2026-11-17')` → 615; inny dzień → `null`,
  - `describeRecurrence` i `recurrenceBadge` dla 5 opcji z makiety (dosłowne zdania).
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj** (daty jako `IsoDate` + arytmetyka dni na UTC-owych `Date`, bez stref). **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(calendar): wystąpienia bloków, zakresy widoków i układ dnia`

### Task 3: Logika zakresów zmian i zadań

**Files:**
- Create: `src/features/calendar/scope.ts` (+ test), `src/features/tasks/model.ts` (+ test)

**Interfaces:**
- Consumes: `Occurrence`, `Recurrence` (Task 2).
- Produces:
  - `type Scope = 'this' | 'following' | 'all'`, `type BlockPatch = { title?; categoryId?; note?; remind?; date?: IsoDate; startMin?: number; durationMin?: number; recurrence?: Recurrence | null }`,
  - `planScopeChange(input: { block: BlockRow; occurrence: Occurrence; scope: Scope; patch?: BlockPatch; delete?: boolean }): ScopePlan`, gdzie `ScopePlan` to jedna z: `{ kind: 'upsertException'; row }`, `{ kind: 'updateBlock'; patch }`, `{ kind: 'deleteBlock' }`, `{ kind: 'split'; from: IsoDate; patch: object; delete: boolean }`, `{ kind: 'detachTasksAndCancel'; date }` — zgodnie z Rozstrzygnięciami (blok jednorazowy zawsze `updateBlock` / `deleteBlock`),
  - `type TaskRow`, `groupStandaloneTasks(tasks: TaskRow[], today: IsoDate): { overdue; today; tomorrow; later; noDate }` (tylko `block_id = null`; zaległe = niezrobione z datą < dziś; zrobione zaległe nie są zaległe),
  - `occurrenceProgress(tasks: TaskRow[], blockId: string, date: IsoDate): { done: number; total: number }`,
  - `pinTask(task, occurrence): Partial<TaskRow>`, `unpinTask(task): Partial<TaskRow>` (pola do zapisu).

- [ ] **Step 1: Napisz testy:**
  - blok jednorazowy + zakres `this` z patchem → `updateBlock`; usunięcie → `deleteBlock`,
  - cykliczny, `this`, przesunięcie na 09:00 → `upsertException` `modified` z `new_start_local` `2026-11-17T09:00`,
  - cykliczny, `this`, usunięcie → `detachTasksAndCancel`,
  - `following` na pierwszym wystąpieniu → `updateBlock` (edycja) / `deleteBlock` (usunięcie) zamiast `split` (Review Focus 2),
  - `following` na środkowym → `split` z `from` = data wystąpienia,
  - `all` ze zmianą godziny → `updateBlock` z nową godziną serii,
  - `groupStandaloneTasks` z datami 15.11 (niezrobione), 15.11 (zrobione), 17.11, 18.11, 25.11, null przy dziś 17.11 → overdue 1, today 1, tomorrow 1, later 1, noDate 1; zadanie z `block_id` pominięte,
  - `occurrenceProgress` liczy tylko zadania danego bloku i daty,
  - `pinTask` ustawia `block_id`, `occurrence_date` i `due_date`; `unpinTask` zeruje dwa pierwsze, `due_date` zostaje.
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj.** **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(calendar): planowanie zmian z zakresem i logika zadań`

### Task 4: Akcje serwera — bloki, zadania, kategorie

**Files:**
- Create: `src/features/calendar/schemas.ts` (+ test), `src/features/calendar/actions.ts` (+ test), `src/features/tasks/actions.ts` (+ test), `src/features/categories/actions.ts` (+ test)

**Interfaces:**
- Consumes: `planScopeChange` (Task 3), `split_block_series` (Task 1), `CATEGORY_COLORS` (stała 8 kolorów — utwórz w `src/features/categories/colors.ts` z `CategoryDialog.dc.html`).
- Produces (wszystkie zwracają `{ ok: true; id?: string } | { ok: false; message: string }`; błąd zapisu → „Nie udało się zapisać. Spróbuj ponownie.”; walidacja zod przed zapisem; `revalidatePath('/kalendarz')`):
  - `createBlock(input: { title; categoryId: string | null; date: IsoDate; startMin; durationMin; recurrence: Recurrence | null; note; remind; tasks?: string[] })` — `timezone` z profilu; zadania (telefon) do pierwszego wystąpienia; kategoria systemowa → odrzucona,
  - `changeOccurrence(input: { blockId; date: IsoDate; scope: Scope; patch?: BlockPatch; delete?: boolean })` — wykonuje `ScopePlan` (`split` przez `rpc('split_block_series')`; `detachTasksAndCancel` = zadania tego wystąpienia → samodzielne + wyjątek `cancelled`),
  - `addTask({ blockId; date; title })`, `toggleTask({ id; done })` (ustawia `done_at`), `renameTask`, `deleteTask({ id })`, `createStandaloneTask({ title; dueDate: IsoDate | null })`, `pinTaskToOccurrence({ taskId; blockId; date })`, `unpinTask({ taskId })`,
  - `createCategory({ name; color })` (nazwa 1–30 po trim, kolor z `CATEGORY_COLORS`, `position` = max + 1), `updateCategory({ id; name?; color? })`, `setCategoryHidden({ id; hidden })`, `moveCategory({ id; dir: -1 | 1 })` (zamiana pozycji z sąsiadem), `deleteCategory({ id })`; systemowe: tylko `setCategoryHidden` i `moveCategory`.

- [ ] **Step 1: Napisz testy** (mock `createClient` jak w `src/features/onboarding/actions.test.ts`):
  - `createBlock` z tytułem „  ” → `ok: false`, bez `insert`; z `durationMin: 10` → `ok: false`; z kategorią systemową → `ok: false`; poprawny → `insert` z `start_local: '2026-11-17T08:00:00'`, `timezone` z profilu,
  - `createBlock` z `tasks: ['A','B']` wstawia 2 zadania z `occurrence_date` = `date`,
  - `changeOccurrence` dla planu `split` woła `rpc('split_block_series', { p_block_id, p_from, p_patch, p_delete })`; dla `upsertException` → `upsert` na `block_exceptions`,
  - `toggleTask({ done: true })` ustawia `done_at`; `false` zeruje,
  - `deleteCategory` na systemowej → `ok: false`; `moveCategory` zamienia `position` dwóch wierszy,
  - akcje bez sesji → `redirect('/logowanie')` (jak w Etapie 1).
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj.** **Step 4: Uruchom** `pnpm test`, `pnpm typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(calendar): akcje bloków, zadań i kategorii`

### Task 5: Strona kalendarza — dane, nagłówek, filtry kategorii

**Files:**
- Modify: `src/app/(app)/kalendarz/page.tsx`
- Create: `src/features/calendar/load-calendar.ts` (+ test), `src/features/calendar/calendar-view.tsx` (klient, + test), `src/features/calendar/calendar-header.tsx` (+ test), `src/features/calendar/category-filters.tsx` (+ test), `src/features/calendar/use-calendar-store.ts` (+ test)

**Interfaces:**
- Consumes: `parseCalendarParams`, `viewRange`, `expandOccurrences`, `shiftDate`, `isoWeekNumber` (Task 2), akcje (Task 4).
- Produces:
  - `loadCalendar(supabase, userId, range): Promise<{ blocks; exceptions; tasks; categories; profile: { timezone; weekStart; clock } }>` (bloki: jednorazowe w zakresie + serie zaczęte przed końcem zakresu bez `until` przed jego początkiem),
  - `useCalendarStore(initial)` — stan klienta z optymistycznymi zmianami: `applyOptimistic(change, action)` (zmiana od razu; błąd → cofnięcie i `toast.error('Nie udało się zapisać. Spróbuj ponownie.')`),
  - `CalendarView({ view; date; today; nowMinutes; data })` — wybiera widok (Task 6, 10, 11),
  - nagłówek web (makieta `Calendar`): ‹ Dziś › (linki zmieniające `data`), tytuł miesiąca, „tydz. N · zakres”, `Segment` Dzień / Tydzień / Miesiąc (zmienia `widok`), przycisk „Nowy blok” (Task 8 podpina okno),
  - `CategoryFilters({ categories; counts; onToggle; onAdd })`: etykieta „POKAŻ”, chipy z kropką i licznikiem bloków w widoku, ukryta = przerywana ramka i pusta kropka, chip „Sport” (systemowy, licznik 0), „+ Kategoria”; ukryte kategorie znikają z siatki od razu.
- Adres: `/kalendarz?widok=dzien|tydzien|miesiac&data=YYYY-MM-DD`; brak parametrów → tydzień z dziś (web) i dzień z dziś (telefon: domyślny widok mobilny to `MCalendarDay`, rozstrzygane po stronie klienta przez CSS — oba układy w DOM; na telefonie segment Dzień / Tydzień / Miesiąc z makiet `M*`).

- [ ] **Step 1: Napisz testy:**
  - `loadCalendar` wybiera serię z 2026-10-06 bez `until` dla zakresu listopada, a pomija serię z `until` 2026-10-31 (mock zapytań; logika filtrowania jako czysta funkcja `pickBlocksForRange` w tym samym pliku),
  - nagłówek: dla 2026-11-18 / tydzień → „Listopad 2026” i „tydz. 47 · 16–22.11”; „›” → `data=2026-11-25`; segment „Dzień” → `widok=dzien`,
  - filtry: licznik = liczba wystąpień kategorii w widoku; klik → `setCategoryHidden` z `hidden: true` i chip w stylu ukrytym; błąd akcji → chip wraca i jest toast (Review Focus 5),
  - `useCalendarStore`: zmiana optymistyczna widoczna od razu, po odrzuceniu akcji stan wraca.
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj** (Server Component: `await connection()` + `Suspense`, jak `/dzis`). **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(calendar): strona kalendarza, nagłówek i filtry kategorii`

### Task 6: Siatka tygodnia i dnia (web)

**Files:**
- Create: `src/features/calendar/time-grid.tsx` (+ test), `src/features/calendar/day-side.tsx` (+ test)

**Interfaces:**
- Consumes: `layoutDay`, `nowLine`, `dayNumbers`, `formatClockTime` (`src/lib/time/timezones.ts`), `occurrenceProgress`, `CATEGORY_COLORS`.
- Produces:
  - `TimeGrid({ days: IsoDate[]; occurrences; categories; tasks; clock; today; nowMinutes; variant: 'week' | 'day'; onSlotClick(date, startMin); onBlockClick(key, anchorEl) })`: nagłówki dni (dziś wyróżnione jak w makiecie), wiersz „cały dzień” (pusty), siatka 00–24 z etykietami godzin, przewinięta przy montażu do 06:00 albo trwającego bloku, bloki (kolor kategorii z makiety, tytuł, godziny, licznik „x/y” gdy są zadania, „↻” przy cyklicznych), czerwona linia „teraz” tylko w kolumnie dziś,
  - widok dnia: szerokie bloki z nazwą kategorii; tytuł „Wtorek, 17 listopada” i „x z y bloków”; pusty dzień → ramka „Brak bloków w tym dniu. Dodaj blok” (link otwiera „Nowy blok” na ten dzień),
  - `DaySide({ date; today; occurrences; tasks; onPick(date) })`: mini kalendarz z ‹ › (dziś zielony, wybrany czarny; reuse `buildMonthGrid` z `calendar-math.ts`), karta „Dzień w liczbach” (Zaplanowane, Wolne (8–20), Zadania) wg makiety `CalendarDay`.

- [ ] **Step 1: Napisz testy:**
  - blok 08:00–09:30 ma `top` = 8 × wysokość godziny z makiety i wysokość 1,5 h; trzy nakładające się dzielą szerokość na 3 (Review Focus 3),
  - blok 23:00–24:00 kończy się na dolnej krawędzi siatki,
  - linia „teraz” jest tylko w kolumnie dziś; brak jej w tygodniu bez dziś,
  - `clock: '12'` → etykiety „5 PM”; „x/y” = 1/3 dla bloku z 3 zadaniami (1 zrobione),
  - pusty dzień pokazuje „Brak bloków w tym dniu.” i „Dodaj blok”,
  - mini kalendarz: dziś ma styl zielony, wybrany czarny; klik dnia woła `onPick`,
  - „Dzień w liczbach” pokazuje wartości z `dayNumbers` w formacie z makiety.
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj** wg `Calendar.dc.html` i `CalendarDay.dc.html` (wysokość godziny, kolory tła i ramki bloków z ich stylów). **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(calendar): siatka tygodnia i dnia`

### Task 7: Dymek bloku z zadaniami

**Files:**
- Create: `src/features/calendar/block-popover.tsx` (+ test)

**Interfaces:**
- Consumes: `useCalendarStore`, akcje zadań (Task 4), `recurrenceBadge`, `occurrenceProgress`, `Popover` z `src/components/ui/popover.tsx`.
- Produces: `BlockPopover({ occurrence; anchor; onEdit(); onDelete(); onClose() })` — treść wg makiety `Calendar` (dymek): kategoria, tytuł, data i godziny, pasek „Zadania x z y”, lista zadań z checkboxami (odhaczanie optymistyczne), „+” → pole i Enter dodaje zadanie, × przy zadaniu usuwa, „Odepnij” w menu zadania przenosi je do samodzielnych z datą wystąpienia (`unpinTask`; dostępne przy każdym zadaniu wystąpienia, bo baza nie odróżnia zadań przypiętych od dodanych w bloku) *[Claude]*, notatka, „Edytuj”, „Usuń”, „↻ co tydzień”; otwiera się w górę przy dolnej części siatki i w lewo przy prawej krawędzi (Radix `side`/`collisionPadding`); zamyka się Esc, klikiem poza, wyzwalaczem.

- [ ] **Step 1: Napisz testy:**
  - pokazuje „Zadania 1 z 3” i pasek; odhaczenie → od razu „2 z 3” i wywołanie `toggleTask`; błąd → wraca „1 z 3” i toast (Review Focus 5),
  - „+”, wpisanie „Kupić mleko”, Enter → zadanie na liście i `addTask` z `date` wystąpienia; pusty tekst nie wywołuje akcji,
  - blok cykliczny pokazuje „↻ co tydzień”; „Usuń” woła `onDelete`,
  - Esc zamyka dymek.
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj** i podłącz w `TimeGrid`. **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(calendar): dymek bloku z zadaniami`

### Task 8: Tworzenie i edycja — „Nowy wpis”, okno bloku, kategorii i zakresu

**Files:**
- Create: `src/features/calendar/new-entry-popover.tsx`, `block-dialog.tsx`, `scope-dialog.tsx`, `src/features/categories/category-dialog.tsx` (+ testy)
- Modify: `src/components/controls/time-picker.tsx` (+ test) — tryb 12 h (spec 9.2: siatka 1–12 + AM/PM)

**Interfaces:**
- Consumes: `describeRecurrence`, `planScopeChange`, akcje (Task 4), `FormDialog`, `DatePicker`, `TimePicker`, `Chip`, `Segment`, `Switch`, `CATEGORY_COLORS`.
- Produces:
  - `TimePicker` przyjmuje `clock?: '24' | '12'` (domyślnie `'24'`, istniejące użycia bez zmian),
  - duch slotu: najechanie na pustą siatkę pokazuje pełną godzinę pod kursorem (wygląd z makiety),
  - `NewEntryPopover({ date; startMin; onBlock(); onClose() })`: data i godzina, opcje Blok / Bieg / Siłownia (Bieg i Siłownia → linki z Global Constraints),
  - `BlockDialog({ mode: 'create' | 'edit'; initial; onSaved(); onCancel() })` wg `BlockDialog.dc.html`: tytuł, kategoria (chipy bez systemowych + „+ Nowa” → `CategoryDialog`, po zapisie wraca do okna bloku z nową kategorią wybraną), dzień (`DatePicker`), od / do (`TimePicker`, do > od; zmiana „od” przesuwa „do” z zachowaniem czasu trwania), powtarzanie 5 opcji, „Własne…” z przyciskami pn–nd i „do” z datą końca, zdanie podsumowania na żywo, notatka, przełącznik przypomnienia (domyślnie włączony), Anuluj / „Zapisz blok”. Edycja bloku cyklicznego → po „Zapisz” `ScopeDialog`,
  - `ScopeDialog({ onPick(scope); onCancel() })` wg `ScopeDialog.dc.html` (3 opcje z opisami i „Zadania z odhaczonych wystąpień nie przepadają.”),
  - `CategoryDialog({ onSaved(category); onCancel() })` wg `CategoryDialog.dc.html`: nazwa, 8 kolorów (zajęte wyblakłe, ale do wyboru), podgląd chipu i bloku, „Dodaj kategorię”,
  - **powrót z okien:** wszystkie okna zamykają się bez zmiany adresu (`widok` i `data` bez zmian); „Nowy blok” z nagłówka bierze dziś (albo wybrany dzień w widoku dnia) i najbliższą pełną godzinę.

- [ ] **Step 1: Napisz testy:**
  - `TimePicker` z `clock: '12'` pokazuje 1–12 i AM/PM; wybór 2 + PM + 30 → 14:30,
  - klik w pusty slot 10:00 → „Nowy wpis” z „10:00”; „Blok” → okno z dniem i od 10:00 do 11:00,
  - okno: pusty tytuł → „Zapisz blok” nieaktywne; „Własne…” bez dni → nieaktywne; podsumowanie dla „Co tydzień” z datą końca = zdanie z makiety,
  - „+ Nowa” → okno kategorii; po „Dodaj kategorię” wraca okno bloku z wybraną nową kategorią i zachowanym tytułem,
  - edycja bloku cyklicznego: „Zapisz blok” → okno zakresu; „To i następne” → `changeOccurrence` z `scope: 'following'`; „Anuluj” w zakresie nic nie zapisuje,
  - Anuluj / ✕ nie zmieniają adresu (mock routera: brak `push`).
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj** i podłącz (nagłówek „Nowy blok”, „Edytuj” i „Usuń” z dymka; „Usuń” przy cyklicznym pyta o zakres, przy jednorazowym usuwa po potwierdzeniu w dymku *[Claude: tekst „Usunąć blok?” + „Usuń” / „Anuluj”]*). **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(calendar): nowy wpis, okno bloku, kategorii i zakresu`

### Task 9: Przeciąganie — tworzenie zakresem, przesuwanie, rozciąganie

**Files:**
- Create: `src/features/calendar/drag.ts` (+ test, czysta logika), `src/features/calendar/use-grid-drag.ts`
- Modify: `src/features/calendar/time-grid.tsx`

**Interfaces:**
- Consumes: `changeOccurrence`, `ScopeDialog`, `BlockDialog` (Task 8), `useCalendarStore`.
- Produces:
  - `snapMinutes(rawMin: number): number` (krok 15), `dragResult(kind: 'create' | 'move' | 'resize', start: { date; min }, current: { date; min }, original?: { startMin; durationMin }): { date; startMin; durationMin } | null` — min 15 min, koniec ≤ 1440, start ≥ 0; przesunięcie zachowuje czas trwania i może zmienić dzień (tydzień),
  - przeciągnięcie po pustej siatce → podgląd zakresu → puszczenie otwiera `BlockDialog` z tym zakresem,
  - przeciągnięcie bloku → przesunięcie; dolny uchwyt → rozciąganie; jednorazowy zapisuje od razu (optymistycznie), cykliczny pokazuje `ScopeDialog` (Anuluj cofa podgląd),
  - ruch < 4 px = klik (dymek), Esc albo puszczenie poza siatką anuluje.

- [ ] **Step 1: Napisz testy `drag.test.ts`:** `snapMinutes(487) === 480`, `(488) === 495`; tworzenie od 600 do 640 → 600–645; tworzenie w górę 640 → 600 → 600–645; przesunięcie bloku 60 min z 1410 → przycięte do 1380; rozciąganie poniżej 15 min → 15; przesunięcie na inny dzień zachowuje `durationMin`.
- [ ] **Step 2: Napisz test komponentu** (zdarzenia wskaźnika w Testing Library): ruch 2 px → otwiera dymek, nie przeciąga; przesunięcie jednorazowego bloku o 1 h → `changeOccurrence` z nowym `startMin`; błąd akcji → blok wraca i toast; cykliczny → okno zakresu, „Anuluj” → blok na starym miejscu (Review Focus 4, 5).
- [ ] **Step 3: Uruchom** — FAIL. **Step 4: Zaimplementuj.** **Step 5: Uruchom** — PASS.
- [ ] **Step 6: Commit** `feat(calendar): tworzenie, przesuwanie i rozciąganie przeciąganiem`

### Task 10: Widok miesiąca (web)

**Files:**
- Create: `src/features/calendar/month-grid.tsx` (+ test)

**Interfaces:**
- Consumes: `viewRange('miesiac')`, `expandOccurrences`, `BlockPopover`, `NewEntryPopover`.
- Produces: `MonthGrid({ days; month0; occurrences; categories; today; onDayClick(date); onEntryClick(key, anchor) })` wg `CalendarMonth.dc.html`: komórki z numerem dnia (dziś wyróżnione, dni spoza miesiąca wyszarzone), do 3 wpisów (kropka koloru, godzina, tytuł) i „+N więcej” (klik → widok dnia), nagłówek „N wpisów widocznych” (bez ukrytych kategorii), klik w pustą część komórki → „Nowy wpis” z tym dniem (godzina 09:00 *[Claude]*); dymek w dolnych dwóch wierszach otwiera się w górę.

- [ ] **Step 1: Napisz testy:** komórka z 5 wpisami pokazuje 3 i „+2 więcej”; „+2 więcej” → `widok=dzien&data=…`; „N wpisów widocznych” zmienia się po ukryciu kategorii; klik w komórkę → „Nowy wpis” z datą tej komórki.
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj.** **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(calendar): widok miesiąca`

### Task 11: Telefon — dzień, tydzień, miesiąc

**Files:**
- Create: `src/features/calendar/mobile/m-calendar-day.tsx`, `m-calendar-week.tsx`, `m-calendar-month.tsx` (+ testy)
- Modify: `src/features/calendar/calendar-view.tsx` (oba układy w DOM, przełączane CSS)

**Interfaces:**
- Consumes: `expandOccurrences`, `layoutDay`, `nowLine`, `viewRange`, `BlockPopover` (na telefonie jako arkusz — `FormDialog` ma już wariant arkusza).
- Produces wg makiet:
  - `MCalendarDay`: segment Dzień / Tydzień / Miesiąc (linki), pasek tygodnia z kropkami dni z blokami, oś (cała doba, start przewinięty do 07:00) co 56 px, bloki z paskiem koloru, linia „teraz”, „+” (pływający przycisk) i stuknięcie pustego miejsca → `MBlockSheet` (Task 12) z tą godziną,
  - `MCalendarWeek`: lista dni tygodnia (plakietka dnia, bloki z godziną; pusty dzień wg makiety),
  - `MCalendarMonth`: siatka ‹ › z kropkami kategorii (do 3), wybrany dzień czarny, lista bloków dnia pod siatką, „Brak bloków — dodaj”.

- [ ] **Step 1: Napisz testy:** pasek tygodnia ma kropkę tylko przy dniach z blokami; stuknięcie pustej osi o 10:00 → otwiera arkusz z 10:00; tydzień listuje bloki dnia z godzinami; miesiąc: dzień z 4 kategoriami → 3 kropki; wybór dnia pokazuje jego bloki albo „Brak bloków — dodaj”.
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj.** **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(calendar): kalendarz na telefonie`

### Task 12: Telefon — arkusz bloku (`MBlockSheet`)

**Files:**
- Create: `src/features/calendar/mobile/m-block-sheet.tsx` (+ test)

**Interfaces:**
- Consumes: `createBlock`, `changeOccurrence` (Task 4), `ScopeDialog` (Task 8, na telefonie jako arkusz), `Stepper`, `Segment`, `Chip`, `Switch`, `DatePicker`, `describeRecurrence`.
- Produces: `MBlockSheet({ mode; initial; onDone() })` wg makiety: nazwa, chipy kategorii z kropką (bez systemowych), dzień, od / do −/+ co 15 min (do > od, koniec ≤ 24:00), czas trwania na żywo, segment powtarzania (Nie / Codziennie / Co tydzień / Dni rob. / Własne — Rozstrzygnięcia), zadania (dodaj Enterem, usuń ×; w trybie `create` zapisywane z blokiem do pierwszego wystąpienia, w `edit` od razu akcjami zadań), przełącznik przypomnienia, przycisk zapisu z makiety; edycja cyklicznego → arkusz zakresu.

- [ ] **Step 1: Napisz testy:** „+” przy „do” 23:45 nie przekracza 24:00 (przycisk `disabled`); czas trwania „1 h 30 min” dla 10:00–11:30; Enter w polu zadania dodaje wiersz, × usuwa; zapis wywołuje `createBlock` z `tasks: ['A']`; „Własne” bez dni → zapis nieaktywny.
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj.** **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(calendar): arkusz bloku na telefonie`

### Task 13: Ustawienia → Kategorie kalendarza

**Files:**
- Create: `src/features/settings/categories-card.tsx` (+ test)
- Modify: `src/app/(app)/ustawienia/[zakladka]/page.tsx` (zakładka `kategorie` zamiast zaślepki)

**Interfaces:**
- Consumes: akcje kategorii (Task 4), `CategoryDialog` (Task 8), `CATEGORY_COLORS`.
- Produces: karta w stylu kart z `Settings.dc.html` *[Claude, brak makiety — spec 6.11]*: tytuł „Kategorie kalendarza”, opis „Kolory i kolejność kategorii w kalendarzu.” *[Claude]*; wiersz na kategorię: kropka koloru, nazwa (klik → edycja nazwy i koloru w `CategoryDialog` w trybie edycji: tytuł „Edytuj kategorię”, przycisk „Zapisz”), przyciski „W górę” / „W dół” (`aria-label`), „Ukryj” / „Pokaż”, „Usuń” z potwierdzeniem „Usunąć kategorię „X”? Bloki zostaną bez kategorii.” *[Claude]*; systemowe z plakietką „systemowa” *[Claude]*, bez zmiany nazwy i usuwania; na dole „+ Kategoria”.

- [ ] **Step 1: Napisz testy:** systemowa „Sport” nie ma „Usuń” ani edycji nazwy; „W dół” przy pierwszej → `moveCategory(dir: 1)`, pierwsza bez „W górę”; „Usuń” → potwierdzenie → `deleteCategory`; „Ukryj” → `setCategoryHidden`.
- [ ] **Step 2: Uruchom** — FAIL. **Step 3: Zaimplementuj.** **Step 4: Uruchom** — PASS.
- [ ] **Step 5: Commit** `feat(settings): kategorie kalendarza`

### Task 14: E2E, zrzuty, dokumentacja

**Files:**
- Create: `e2e/calendar.spec.ts`
- Modify: `e2e/visual.spec.ts`, `docs/setup.md` (nowa migracja, push przed scaleniem), `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md` (odhaczona lista Etapu 2)

- [ ] **Step 1: Napisz `e2e/calendar.spec.ts`** (projekty `web` i `mobile`, `test.skip(!process.env.E2E_SUPABASE)`):
  - web: klik w pusty slot 10:00 we wtorek → „Nowy wpis” z „10:00” → „Blok” → okno ma dzień i 10:00–11:00 → tytuł „Matematyka”, „Co tydzień” → „Zapisz blok” → blok w siatce z „↻”,
  - web: dymek bloku → „+” → „Zadanie 1” Enter → „Zadania 0 z 1” → odhacz → „1 z 1”; w następnym tygodniu to wystąpienie ma pustą listę,
  - web: edycja wystąpienia z następnego tygodnia na 11:00 → „To i następne” → wcześniejsze wystąpienie 10:00, późniejsze 11:00; zadanie z pierwszego tygodnia zostaje,
  - web: ukrycie kategorii chowa jej bloki, po odświeżeniu nadal ukryte; „+ Kategoria” tworzy kategorię widoczną w filtrach,
  - web: przeciągnięcie bloku jednorazowego o 1 h zmienia godzinę po odświeżeniu,
  - web: widok miesiąca pokazuje blok; widok dnia z mini kalendarzem i „Dzień w liczbach”,
  - mobile: „+” → arkusz → nazwa, kategoria, od −/+ → zapis → blok na osi; widok miesiąca z kropką.
- [ ] **Step 2: Rozszerz `visual.spec.ts`** o `/kalendarz` (tydzień, dzień, miesiąc), dymek bloku, okno „Nowy blok”, okno zakresu, okno kategorii, `/ustawienia/kategorie`; telefon: dzień, tydzień, miesiąc, arkusz.
- [ ] **Step 3: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`**, push, CI zielone (`checks`, `db`, `e2e`).
- [ ] **Step 4: Dokumentacja:** `docs/setup.md` — przed scaleniem `pnpm exec supabase db push --remote` (migracja `20261118000001_calendar.sql`); mapa etapów — odhaczone punkty Etapu 2 pokryte testami.
- [ ] **Step 5: Commit** `test(e2e): kalendarz, zadania i zrzuty Etapu 2; docs`
- [ ] **Step 6: (kontroler, nie wykonawca)** po akceptacji Mejsona: Mejson robi `db push --remote`, kontroler sprawdza migracje i uprawnienia w chmurze, potem scalenie do `main`.
