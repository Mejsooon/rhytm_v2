# Etap 3: Nawyki i sen — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moduł „Nawyki i sen” (web i telefon): nawyki z wersjonowanym harmonogramem i odhaczaniem, kafelki, heatmapa, szczegóły nawyku z kalendarzem miesiąca i usuwaniem, wpisy snu z wykresem oraz prawdziwe liczniki „Pierwszych kroków” na Dziś.

**Architecture:**
- Baza trzyma nawyki, wersje harmonogramu, odhaczenia, notatki nawyków i wpisy snu.
- Statystyki (% dnia, serie, 30 dni, heatmapa, średni sen) liczą czyste funkcje TS w przeglądarce z danych z ostatnich 13 miesięcy. To setki wierszy, a spec 9 zostawia wybór.
- Strona `/nawyki` (Server Component z `connection()` + Suspense, jak `/kalendarz`) czyta dane. Klient odhacza optymistycznie przez Server Actions, a okna zapisują się bez optymizmu (jak w Etapie 2).
- Szczegóły nawyku to osobna trasa `/nawyki/[id]`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Radix (shadcn), Supabase (Postgres, RLS, pgTAP), zod 4, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-rhytm-design.md`, sekcje 3.2, 5 (Nawyki i sen), 6.6, 6.13, 7. **Mapa etapów:** `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md` (Etap 3 i „Wspólne”). **Makiety** (`docs/design/mockups/`): web `Habits`, `HabitDetail`, `HabitDialog`, `SleepDialog`; telefon `MHabits`, `MHabitDetail`, `MHabitNew`, `MSleep`. Teksty, kolory, wymiary i zachowania czytaj z ich `<style>` i `<script>` (`renderVals`) i przepisuj dosłownie.

## Global Constraints
- **Z wcześniejszych etapów:**
  - Next.js 16: przed użyciem API czytaj `node_modules/next/dist/docs/`.
  - Makiety 1:1, teksty dosłownie.
  - Tylko kontrolki z `src/components/controls`: `Segment`, `Switch`, `Checkbox`, `Chip`, `Stepper`, `TimePicker`, `DatePicker`, `FormDialog`. Bez `<select>` i `<input type=date|time>`.
  - Web i telefon rozdzielone wyłącznie klasami `max-[799px]:` / `min-[800px]:`. Cele dotyku na telefonie ≥ 44 px, przyciski-ikony z `aria-label`.
  - Komentarze po polsku, płaski czytelny kod bez skakania po funkcjach pomocniczych.
- **Git:** gałąź `feat/etap-3` od `main`, nigdy commit na `main`. Migracja trafia do chmury (`pnpm exec supabase db push --remote`, robi to Mejson) **przed** scaleniem. Do tego czasu plik migracji wolno poprawiać w miejscu.
- **Baza:**
  - Każda tabela ma `user_id uuid not null references auth.users(id) on delete cascade`.
  - RLS „tylko własne wiersze” przez `(select auth.uid())`. W tabelach podrzędnych `with check` sprawdza też, że `habit_id` należy do tego samego użytkownika.
  - **Jawne `GRANT`** `select, insert, update, delete` dla `authenticated` i `grant all … to service_role`. pgTAP sprawdza je przez `has_table_privilege`; lokalny stack ma `auto_expose_new_tables = false`, więc brak GRANT wywali test.
  - Aliasy tabel w SQL pisane z jawnym `AS`.
- **Czas:**
  - „Dziś” to `todayIso(profil.timezone)`. Daty są `YYYY-MM-DD` bez strefy.
  - Tydzień zaczyna się od `profiles.week_start`. Godziny są wyświetlane wg `profiles.clock` przez `formatClockTime`.
  - Cel snu bierzemy z `profiles.sleep_goal_min` (domyślnie 480).
- **Dni tygodnia** w `weekdays`: 1 = pn … 7 = nd (jak `byWeekday` w kalendarzu).
- **Optymizm (Wspólne):** odhaczanie zmienia od razu siatkę, kafelki, heatmapę i pierścień. Błąd cofa zmianę i pokazuje toast „Nie udało się zapisać. Spróbuj ponownie.”. Okna (nowy nawyk, edycja, wpis snu, usuwanie) czekają na serwer (pending + błąd w oknie).
- **Next 16 Activity** zachowuje stan tras: lokalny stan klienta musi się ponownie zsynchronizować, gdy przyjdą nowe dane z serwera (wzorzec „poprzednie props” jak w `use-calendar-store`).

## Rozstrzygnięcia (Ruling) przed startem
- **Harmonogram (wersje):**
  - Wersja obowiązująca w dniu D to wiersz z największym `valid_from ≤ D`. Dni przed pierwszym `valid_from` to „dzień bez nawyku”.
  - Nowy nawyk dostaje wersję z `valid_from = dziś`.
  - Zmiana harmonogramu w edycji wstawia wersję z `valid_from = dziś`. Gdy wersja z dziś już istnieje, nadpisuje ją. Zmiana samej nazwy, przypomnienia albo „Pokazuj na Dziś” nie tworzy wersji.
  - „Wybrane dni” ze wszystkimi 7 dniami zapisują się jako `daily` (makieta: „Wszystkie dni — to to samo co „Codziennie”.”).
- **Zaplanowane w dniu D:**
  - `daily`: każdy dzień.
  - `weekdays`: dzień tygodnia ∈ `weekdays`.
  - `times_per_week`: nie jest „zaplanowany” na konkretny dzień. Liczy się tylko, gdy odhaczony (spec 6.6, „Zasady”).
- **% dnia** = (zrobione zaplanowane + odhaczone X/tydz.) / (zaplanowane + odhaczone X/tydz.). Gdy mianownik = 0: dzień „bez planu” (szary, nie 0%). Dni przyszłe są puste.
- **Nawyki dziś x/y:** licznik i mianownik jak w % dnia dla dziś.
- **Ostatnie 30 dni:** średnia % z dni z planem w ostatnich 30 dniach (z dziś). Porównanie „+N pkt vs poprzednie 30” liczy różnicę punktów procentowych do 30 dni wcześniejszych, zaokrągloną do całości, ze znakiem `+`/`−`. Gdy w poprzednich 30 dniach nie ma żadnego dnia z planem, dopisek jest ukryty.
- **Seria (dla jednego nawyku):**
  - Wersja z dziś to `daily` / `weekdays`: seria w dniach. Idziemy wstecz od dziś po dniach zaplanowanych (wg wersji z danego dnia). Zrobiony dzień to +1, niezrobiony przerywa. Wyjątek: niezrobione **dziś** nie przerywa (liczymy od wczoraj). Dni niezaplanowane i dni z wersją `times_per_week` są pomijane.
  - Wersja z dziś to `times_per_week`: seria w tygodniach. Tydzień zaliczony = odhaczeń ≥ `times_per_week` z wersji obowiązującej na początku tygodnia. Bieżący niezaliczony tydzień nie przerywa. Tydzień z wersją innego typu przerywa.
  - Opis: „N dni” / „1 dzień” / „N tyg.”, jak w makiecie.
- **Najdłuższa seria:**
  - Dla nawyku: maksimum tej samej miary po całej historii.
  - Kafelek na liście: nawyk z największą serią najdłuższą (remis: nazwa alfabetycznie), z jego nazwą i jednostką.
- **Skuteczność 30 dni (dla nawyku):**
  - `daily` / `weekdays`: zrobione zaplanowane / zaplanowane w ostatnich 30 dniach.
  - `times_per_week`: odhaczenia w 30 dniach / (`times_per_week` × 30 / 7), maks. 100%.
  - Zaokrąglenie do całości, „—” gdy brak danych.
- **Łącznie razy** = liczba wszystkich odhaczeń nawyku.
- **Odhaczanie:**
  - Można odhaczać dziś i wstecz. Dni przyszłe i dni przed pierwszym `valid_from` są nieaktywne.
  - Przy `weekdays` dzień niezaplanowany pokazuje „–” i nie da się go odhaczyć.
  - Przy `times_per_week` każdy dzień tygodnia jest aktywny.
  - Siatka web: bieżący tydzień (bez nawigacji). Telefon: lista na dziś. Heatmapa i kalendarz w szczegółach są tylko do odczytu *[Claude]*.
- **Heatmapa (web):**
  - Miesiąc: siatka dni miesiąca, ‹ › do 12 miesięcy wstecz. ‹ nieaktywne na granicy, › nieaktywne w bieżącym miesiącu.
  - 3 mies. / 6 mies. / Rok: kolumny tygodni od `week_start`, ostatnie 13 / 26 / 52 tygodnie do bieżącego.
  - Kolor wg % w progach z makiety (przepisz progi i kolory z `Habits.dc.html`).
  - Dymek: „{data} · x z y nawyków”, a dla dnia bez planu „{data} · brak zaplanowanych”. Ten drugi tekst wymyślił *[Claude]*.
  - Telefon: ostatnie 4 tygodnie, stuknięcie pokazuje ten sam tekst.
- **Sen:**
  - Czas snu = `woke_at − slept_at`; gdy wynik ≤ 0, dodaj 24 h (przez północ). `slept_at == woke_at` to błąd „Godziny zaśnięcia i pobudki muszą się różnić.” *[Claude]*.
  - `date` = data pobudki. Jeden wpis na datę: otwarcie okna dla daty z wpisem ładuje go do edycji, a zapis to upsert.
  - Tytuł: web „Noc z {dnia tygodnia D−1 w dopełniaczu} na {dzień tygodnia D}” (np. „Noc z poniedziałku na wtorek”), telefon „Noc {d−1} → {d} {miesiąc w dopełniaczu}” (np. „Noc 14 → 15 listopada”). Gdy noc obejmuje dwa miesiące: „Noc 31 października → 1 listopada” *[Claude]*.
  - Opis względem celu: web „{p}% celu {h:mm} · brakuje {N} min” albo „{p}% celu {h:mm} · powyżej celu” *[Claude, dla wartości ≥ celu]*. Telefon „Powyżej celu {h:mm}” / „Brakuje {N} min do celu”.
  - Średni sen 14 dni = średnia wpisów z 14 dni do dziś; nie ma wpisu = nie liczy się. Dopisek „x z 14 nocy ≥ cel”.
  - Wykres 14 / 30 dni: słupek na każdy dzień. Brak wpisu to pusty słupek. Słupek ≥ celu ma ciemniejszy kolor. Przerywana linia celu. Dymek (stuknięcie) „{data} · {h:mm}”.
  - Domyślne wartości nowego wpisu: dziś, 23:00 → 07:00, samopoczucie brak, bez tagów *[Claude]*.
  - Tagi stałe: „Kawa po 16”, „Ekran w łóżku”, „Trening”, „Alkohol”, „Stres”, także na web (spec 6.6).
- **Notatki nawyku** (makieta `MHabitDetail`, „Notatki” z datą): tabela `habit_notes`. Sekcja „Notatki” na telefonie **i** na webie (pod kalendarzem, w stylu kart `HabitDetail`) z polem „Dodaj notatkę” (Enter zapisuje, z datą dziś) *[Claude: web nie ma tego w makiecie, ale bez niego notatki powstawałyby tylko na telefonie]*.
- **Usuwanie nawyku:**
  - Potwierdzenie w `FormDialog`: tytuł „Usunąć nawyk „{nazwa}”?”, treść „Historia odhaczeń i notatki zostaną usunięte.”, przyciski „Anuluj” / „Usuń” (czerwony). Teksty wymyślił *[Claude]*.
  - Kaskada usuwa wersje, odhaczenia i notatki. Po usunięciu następuje przekierowanie na `/nawyki`.
  - Archiwizacji nie ma (decyzja 9.1 / makieta „Usuń”).
- **Przypomnienie:** tylko zapis `remind_at` (godzina albo `null`). Wysyłka push to Etap 9. Telefon (`MHabitNew`) ma chipy godzin z makiety oraz „Inna…”, który otwiera `TimePicker` *[Claude]*.
- **„Pokazuj na ekranie Dziś”** (`show_on_today`): zapis w oknie web i telefon. Użyje go Etap 5.
- **Kolejność nawyków:** wg `created_at`.
- **Trasy i okna:**
  - `/nawyki?tab=sen` wybiera segment „Sen” na telefonie.
  - Okna web otwiera stan klienta.
  - Telefon: „Nowy nawyk” i „Wpis snu” to pełnoekranowe arkusze z „Anuluj” / „Zapisz” w nagłówku (`MHabitNew`, `MSleep`).
  - Linki „Dodaj nawyk” i „Wpisz ostatnią noc” z Dziś prowadzą do `/nawyki?nowy=nawyk` i `/nawyki?nowy=sen`, które otwierają odpowiednie okno.

## Review Focus
1. **Zmiana harmonogramu** (np. „codziennie” → „pn, śr, pt” od dziś) nie zmienia % ani serii dni sprzed zmiany. Test: Task 2.
2. **Sen przez północ i krańce:** 23:30 → 00:15 = 45 min; 00:30 → 07:00 = 6 h 30 min; 07:00 → 07:00 to błąd. Test: Task 2.
3. **Nawyk X/tydz. nieodhaczony dziś** nie obniża % dnia ani „Nawyki dziś”. Odhaczony podnosi. Test: Task 2.
4. **Dzień przed utworzeniem nawyku** (i dzień przyszły) jest nieaktywny w siatce, szary w heatmapie i nie psuje serii. Test: Task 2 + Task 4.
5. **Drugi wpis snu na tę samą datę** edytuje istniejący zamiast zgłaszać błąd unikalności. Test: Task 3.

---

### Task 1: Baza — nawyki, odhaczenia, notatki i sen

**Files:**
- Create: `supabase/migrations/20261118120000_habits_sleep.sql`, `supabase/tests/habits_sleep.test.sql`
- Modify: `src/types/database.ts` (typy nowych tabel)

**Interfaces:**
- Produces:
  - `habits(id uuid pk default gen_random_uuid(), user_id, name text not null check (length(trim(name)) between 1 and 80), remind_at time null, show_on_today bool not null default true, created_at timestamptz default now())`
  - `habit_schedules(habit_id uuid references habits on delete cascade, user_id, valid_from date not null, schedule_type text check in ('daily','weekdays','times_per_week'), weekdays smallint[] not null default '{}', times_per_week smallint null, primary key (habit_id, valid_from))`. Check: `weekdays` niepuste i w 1..7 przy `weekdays`; `times_per_week` 1..7 przy `times_per_week`, null w pozostałych.
  - `habit_checks(habit_id uuid references habits on delete cascade, user_id, date date, primary key (habit_id, date))`
  - `habit_notes(id uuid pk, habit_id references habits on delete cascade, user_id, date date not null, text text not null check (length(trim(text)) between 1 and 500), created_at)`
  - `sleep_logs(user_id, date date, slept_at time not null, woke_at time not null check (woke_at <> slept_at), feeling smallint null check 1..5, tags text[] not null default '{}', note text null check (length ≤ 1000), created_at, updated_at, primary key (user_id, date))`
  - Indeksy: `habits(user_id, created_at)`, `habit_checks(user_id, date)`, `habit_notes(habit_id, date)`.

- [ ] **Step 1: Napisz `supabase/tests/habits_sleep.test.sql` (pgTAP).** Sprawdź:
  - `has_table_privilege('authenticated', …, 'select')`, osobno `'insert'`, `'update'`, `'delete'`, oraz `service_role` dla wszystkich 5 tabel;
  - `anon` nie ma `select`;
  - użytkownik B nie widzi ani nie zmienia wierszy A (każda tabela);
  - B nie wstawi `habit_checks` / `habit_schedules` / `habit_notes` z `habit_id` nawyku A (42501);
  - usunięcie nawyku usuwa jego wersje, odhaczenia i notatki;
  - drugi `sleep_logs` z tą samą `(user_id, date)` łamie klucz;
  - `woke_at = slept_at` łamie check;
  - `schedule_type='weekdays'` z pustym `weekdays` łamie check.
- [ ] **Step 2:** Uruchom `pnpm exec supabase test db` → FAIL (brak tabel).
- [ ] **Step 3:** Napisz migrację: tabele, checki, RLS (`select/insert/update/delete` własnych; `with check` w tabelach podrzędnych przez `exists (select 1 from public.habits AS h where h.id = habit_id and h.user_id = (select auth.uid()))`), GRANT-y i indeksy. Dopisz typy do `src/types/database.ts` (ręcznie, w tym samym kształcie co istniejące).
- [ ] **Step 4:** `pnpm exec supabase test db` → PASS; `pnpm typecheck` → OK.
- [ ] **Step 5: Commit** `feat(db): nawyki, odhaczenia, notatki i sen z RLS`

### Task 2: Czyste funkcje — harmonogram, statystyki nawyków i sen

**Files:**
- Create: `src/features/habits/model.ts` (+ `model.test.ts`), `src/features/habits/sleep.ts` (+ `sleep.test.ts`), `src/features/habits/text.ts` (+ `text.test.ts`)

**Interfaces:**
- Produces (typy):
  - `type ScheduleType = 'daily' | 'weekdays' | 'times_per_week'`
  - `type ScheduleVersion = { validFrom: IsoDate; type: ScheduleType; weekdays: number[]; timesPerWeek: number | null }`
  - `type Habit = { id: string; name: string; remindAt: string | null; showOnToday: boolean; createdAt: string; schedules: ScheduleVersion[] /* rosnąco po validFrom */ }`
  - `type Checks = Map<string /*habitId*/, Set<IsoDate>>`
  - `type DayCell = { date: IsoDate; done: number; planned: number; percent: number | null /* null = bez planu albo przyszłość */ }`
- Produces (funkcje w `model.ts`):
  - `scheduleOn(habit: Habit, date: IsoDate): ScheduleVersion | null`
  - `isPlanned(habit: Habit, date: IsoDate): boolean`
  - `canCheck(habit: Habit, date: IsoDate, today: IsoDate): boolean`
  - `dayStats(habits: Habit[], checks: Checks, date: IsoDate, today: IsoDate): DayCell`
  - `currentStreak(habit, checks, today, weekStart: 'mon'|'sun'): { value: number; unit: 'days'|'weeks' }`
  - `longestStreak(habit, checks, today, weekStart): { value: number; unit: 'days'|'weeks' }`
  - `successRate30(habit, checks, today): number | null`
  - `last30Comparison(habits, checks, today): { percent: number | null; deltaPoints: number | null }`
  - `weekProgress(habit, checks, today, weekStart): { done: number; target: number } | null` (tylko X/tydz.)
  - `heatmapMonth(habits, checks, monthIso: 'YYYY-MM', today, weekStart): (DayCell | null)[]` (z pustymi polami przed 1.)
  - `heatmapWeeks(habits, checks, weeks: 4|13|26|52, today, weekStart): DayCell[][]` (kolumny tygodni)
  - `totalChecks(habitId, checks): number`
- Produces (`sleep.ts`):
  - `sleepMinutes(sleptAt: 'HH:MM', wokeAt: 'HH:MM'): number | null` (null gdy równe)
  - `goalText(minutes: number, goalMin: number): { web: string; phone: string }`
  - `nightTitle(date: IsoDate): { web: string; phone: string }`
  - `sleepStats(logs: SleepLog[], today: IsoDate, days: 14|30, goalMin: number): { avg: number | null; metGoal: number; bars: { date: IsoDate; minutes: number | null; met: boolean }[] }`
  - `type SleepLog = { date: IsoDate; sleptAt: string; wokeAt: string; feeling: number | null; tags: string[]; note: string | null }`
- Produces (`text.ts`): `describeSchedule(v: ScheduleVersion): string` („codziennie”, „pn, śr, pt, nd”, „4× w tygodniu”, dokładnie jak w makietach), `formatDuration(min): string` („7:12”), `streakLabel({value, unit}): string` („12 dni”, „1 dzień”, „3 tyg.”).

- [ ] **Step 1: Napisz testy**, w tym przypadki z Review Focus 1–4:
  - **Zmiana harmonogramu:** nawyk codzienny od 2026-11-01, zmiana na `weekdays [1,3,5]` od 2026-11-10. Wtedy `isPlanned('2026-11-04')` (śr) = true i `isPlanned('2026-11-11')` (śr) = true, ale `isPlanned('2026-11-12')` (czw) = false oraz `isPlanned('2026-11-05')` (czw) = true.
  - **% dnia z X/tydz.:** dwa nawyki, jeden codzienny zrobiony, jeden 3×/tydz. nieodhaczony: `percent === 100`, `planned === 1`. Po odhaczeniu drugiego: `planned === 2`, `done === 2`.
  - **Dzień bez planu:** dzień bez planu ma `percent === null`. Dzień przed `validFrom` ma `canCheck === false` i `isPlanned === false`.
  - **Seria dzienna:** odhaczone 14–16.11, dziś 17.11 nieodhaczone → `{value:3, unit:'days'}`. Brak 15.11 → 1. Dni niezaplanowane przy `weekdays` nie przerywają.
  - **Seria tygodniowa:** 3×/tydz., dwa pełne tygodnie i bieżący z 1 odhaczeniem → `{value:2, unit:'weeks'}`.
  - **Skuteczność:** `successRate30` dla 3×/tydz. z 15 odhaczeniami w 30 dniach = 100 (obcięte).
  - **Porównanie 30 dni:** `last30Comparison` z 80% vs 74% → `deltaPoints === 6`.
  - **Heatmapa miesiąca:** `heatmapMonth('2026-11', …, 'mon')` ma 6 pustych pól przed 1.11 (niedziela).
  - **Sen:**
    - `sleepMinutes('23:30','00:15') === 45`, `('00:30','07:00') === 390`, `('07:00','07:00') === null`;
    - `goalText(432, 480).web === '90% celu 8:00 · brakuje 48 min'`;
    - `nightTitle('2026-11-17').web === 'Noc z poniedziałku na wtorek'`, `nightTitle('2026-11-15').phone === 'Noc 14 → 15 listopada'`;
    - `sleepStats` liczy średnią tylko z dni z wpisem.
  - **Teksty:** `describeSchedule({type:'times_per_week', timesPerWeek:4,…}) === '4× w tygodniu'`, `streakLabel({value:1,unit:'days'}) === '1 dzień'`.
- [ ] **Step 2:** `pnpm test src/features/habits` → FAIL.
- [ ] **Step 3:** Zaimplementuj. Daty licz w UTC na `IsoDate` (jak `addDays` / `weekdayOf` z `src/features/calendar/view-range.ts`; użyj ich).
- [ ] **Step 4:** `pnpm test src/features/habits` → PASS.
- [ ] **Step 5: Commit** `feat(habits): harmonogram, statystyki i sen jako czyste funkcje`

### Task 3: Odczyt danych i akcje serwera

**Files:**
- Create: `src/features/habits/load-habits.ts` (+ test), `src/features/habits/schemas.ts` (+ test), `src/features/habits/actions.ts` (+ test)

**Interfaces:**
- Consumes: typy z Task 2, `createClient`, `ActionResult` (`src/lib/action-result.ts`), `test-utils/fake-supabase.ts`.
- Produces:
  - `loadHabitsPage(supabase, userId): Promise<{ today: IsoDate; weekStart: 'mon'|'sun'; clock: '24'|'12'; sleepGoalMin: number; habits: Habit[]; checks: Array<{ habitId: string; date: IsoDate }>; sleepLogs: SleepLog[] }>`. Odhaczenia z ostatnich 13 miesięcy plus 31 dni, wpisy snu z 60 dni. Profil czytany jak w `loadCalendarProfile`.
  - `loadHabitDetail(supabase, userId, habitId): Promise<{ … jak wyżej dla jednego nawyku, + notes: { id; date; text }[] } | null>`. Zwraca `null`, gdy nawyku nie ma albo nie jest własny (strona robi wtedy `notFound()`). Odhaczenia z całej historii.
  - `createHabit(input: HabitInput): Promise<ActionResult & { id?: string }>`
  - `updateHabit(id: string, input: HabitInput): Promise<ActionResult>`. Wersja harmonogramu powstaje tylko, gdy zmienił się typ, dni albo X (Rozstrzygnięcia).
  - `deleteHabit(id: string): Promise<ActionResult>`
  - `setHabitCheck(habitId: string, date: IsoDate, done: boolean): Promise<ActionResult>`. Serwer odrzuca datę przyszłą, datę przed pierwszą wersją i dzień niezaplanowany przy `weekdays` (sprawdza przez `canCheck`).
  - `addHabitNote(habitId: string, text: string): Promise<ActionResult>`
  - `saveSleepLog(input: SleepInput): Promise<ActionResult>`, upsert na `(user_id, date)`.
  - `HabitInput = { name: string; schedule: { type: ScheduleType; weekdays: number[]; timesPerWeek: number | null }; remindAt: string | null; showOnToday: boolean }`
  - `SleepInput = { date: IsoDate; sleptAt: 'HH:MM'; wokeAt: 'HH:MM'; feeling: 1|2|3|4|5|null; tags: string[] /* tylko 5 stałych */; note: string | null }`
  - Każda akcja: `getUser`, walidacja zod, sprawdzenie liczby zmienionych wierszy, `revalidatePath('/nawyki')` (+ `/nawyki/[id]` przy szczegółach i `/dzis`).
- [ ] **Step 1: Testy** (`fake-supabase`):
  - `saveSleepLog` dwa razy z tą samą datą wywołuje `upsert` z `onConflict: 'user_id,date'`, a nie `insert` (Review Focus 5);
  - `updateHabit` ze zmianą samej nazwy nie wstawia wersji, ze zmianą dni wstawia `valid_from = dziś` z `onConflict 'habit_id,valid_from'`;
  - „Wybrane dni” z 7 dniami zapisuje `daily`;
  - `setHabitCheck` z jutrem → `{ ok: false }`;
  - `schemas` odrzucają pustą nazwę, `times_per_week` 0 i 8, nieznany tag oraz `sleptAt == wokeAt` z komunikatem „Godziny zaśnięcia i pobudki muszą się różnić.”;
  - `loadHabitsPage` składa wersje rosnąco i mapuje kolumny.
- [ ] **Step 2:** FAIL. **Step 3:** Zaimplementuj. **Step 4:** `pnpm test src/features/habits` → PASS.
- [ ] **Step 5: Commit** `feat(habits): odczyt danych i akcje nawyków oraz snu`

### Task 4: Ekran web „Nawyki i sen”

**Files:**
- Modify: `src/app/(app)/nawyki/page.tsx`
- Create: `src/features/habits/habits-view.tsx`, `use-habits-store.ts`, `habit-tiles.tsx`, `habit-week-grid.tsx`, `sleep-card.tsx`, `habit-heatmap.tsx` (+ testy komponentów)

**Interfaces:**
- Consumes: Task 2, Task 3.
- Produces:
  - `HabitsView({ data, initialTab, openOnLoad: 'nawyk'|'sen'|null })`
  - `useHabitsStore(data): { checks: Checks; toggle(habitId, date): void; … }`: optymistycznie, z cofnięciem i toastem, z re-syncem po nowych danych z serwera (Activity).
  - Callbacki `onNewHabit()`, `onNewSleep(date?)`, które otworzą okna z Task 5. Do tego czasu przyciski otwierają nic.

- [ ] **Step 1: Testy komponentów:**
  - kafelki dla danych testowych pokazują „Nawyki dziś” „1/2”, „+6 pkt vs poprzednie 30”, nazwę nawyku z najdłuższą serią i „x z 14 nocy ≥ cel”;
  - odhaczenie komórki dziś zmienia „1/2” na „2/2” przed odpowiedzią serwera, a błąd akcji cofa zmianę i woła toast;
  - komórka jutra i komórka przed `validFrom` są `disabled`;
  - przy `weekdays` dzień niezaplanowany pokazuje „–” i nie jest przyciskiem;
  - heatmapa: tryb „Miesiąc”, ‹ jest `disabled` po 12 krokach wstecz, › w bieżącym miesiącu; `title`/dymek „17.11.2026 · 2 z 3 nawyków”; dzień bez planu ma klasę szarą;
  - sen: przełącznik 14 / 30 zmienia liczbę słupków; słupek ≥ cel ma ciemny kolor; „Ostatnia noc” z godzinami „23:48 → 07:00”;
  - klik w nazwę nawyku to link `/nawyki/{id}`.
- [ ] **Step 2:** FAIL. **Step 3:** Zaimplementuj według `Habits.dc.html`: układ na całą szerokość, nagłówek z „+ Wpis snu” i „Nowy nawyk”, cztery kafelki, karta Nawyki z siatką pn–nd (od `week_start`), opis harmonogramu, seria, postęp tygodnia przy X/tydz., „+ Nowy nawyk”, karta Sen, karta Heatmapa z legendą. Stan pusty (brak nawyków i wpisów) w stylu makiet, tekst *[Claude]*: „Nie masz jeszcze nawyków.” z przyciskiem „Dodaj pierwszy nawyk”. Strona: `connection()` + Suspense, a niezalogowany trafia do `/logowanie`.
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(habits): ekran Nawyki i sen na komputerze`

### Task 5: Okna web — nowy / edycja nawyku i wpis snu

**Files:**
- Create: `src/features/habits/habit-dialog.tsx`, `sleep-dialog.tsx` (+ testy)
- Modify: `habits-view.tsx` (podpięcie okien, `openOnLoad`)

**Interfaces:**
- Consumes: Task 3 akcje, Task 2 `sleepMinutes`/`goalText`/`nightTitle`/`describeSchedule`.
- Produces:
  - `HabitDialog({ open, onOpenChange, habit?: Habit })`: tryb nowy z „Dodaj nawyk”, tryb edycji z tytułem „Edytuj nawyk” i przyciskiem „Zapisz” *[Claude]*.
  - `SleepDialog({ open, onOpenChange, date: IsoDate, existing?: SleepLog, goalMin, clock })`

- [ ] **Step 1: Testy:**
  - **Segment harmonogramu** pokazuje zdanie z makiety dla każdej opcji, np. „Codziennie. Seria liczona w dniach.”, a dla wszystkich 7 dni „Wszystkie dni — to to samo co „Codziennie”.”.
  - **Pola harmonogramu:** licznik „razy w tygodniu” ma zakres 1–7. Bez nazwy przycisk „Dodaj nawyk” jest `disabled`.
  - **Przypomnienie:** przełącznik wyłączony blokuje wybór godziny.
  - **Zapis nawyku** woła `createHabit` z dokładnym `HabitInput`.
  - **Sen, czas na żywo:** 23:48 → 07:00 pokazuje „7:12” i „90% celu 8:00 · brakuje 48 min”.
  - **Sen, pola:** zmiana daty pobudki z istniejącym wpisem ładuje jego wartości. Chipy tagów są wielokrotnego wyboru. Samopoczucie 1–5 ma etykiety „Źle”, „Słabo”, „OK”, „Dobrze”, „Super”.
  - **Zapis snu:** woła `saveSleepLog`. Błąd zostawia okno otwarte z komunikatem.
- [ ] **Step 2:** FAIL. **Step 3:** Zaimplementuj według `HabitDialog.dc.html` i `SleepDialog.dc.html` (`FormDialog`, `Segment`, `Stepper`, `Switch`, `TimePicker` z `clock`, `DatePicker`). Tagi w oknie web układamy jak chipy z `MSleep`, w stylu web *[Claude, spec 6.6]*.
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(habits): okna nowego nawyku i wpisu snu na komputerze`

### Task 6: Szczegóły nawyku (web)

**Files:**
- Create: `src/app/(app)/nawyki/[id]/page.tsx`, `src/features/habits/habit-detail.tsx`, `habit-month.tsx`, `habit-notes.tsx`, `delete-habit-dialog.tsx` (+ testy)

**Interfaces:**
- Consumes: `loadHabitDetail`, `deleteHabit`, `addHabitNote`, `HabitDialog` (edycja), funkcje z Task 2.
- Produces: `HabitDetail({ data })`, `HabitMonth({ habit, checks, today, weekStart, minMonth, maxMonth })` (używany też na telefonie w Task 7), `HabitNotes({ habitId, notes })`.

- [ ] **Step 1: Testy:**
  - nagłówek z opisem „pn, śr, pt, nd · przypomnienie 20:30 · od 01.10.2026”;
  - kafelki Seria, Najdłuższa seria, 30 dni %, Łącznie razy;
  - kalendarz: stany zrobione / pominięte (zaplanowane w przeszłości bez odhaczenia) / szare (bez nawyku) z legendą jak w makiecie; ‹ nieaktywne na miesiącu startu nawyku; › nieaktywne w bieżącym;
  - „Historia harmonogramu” z zakresami „01.10 – 31.10.2026” i „od 01.11.2026” oraz dopiskiem „Zmiana harmonogramu nie przelicza przeszłych dni.”;
  - „Usuń” → potwierdzenie → `deleteHabit` → `router.push('/nawyki')`;
  - Enter w „Dodaj notatkę” woła `addHabitNote`;
  - nieistniejące id → `notFound()`.
- [ ] **Step 2:** FAIL. **Step 3:** Zaimplementuj według `HabitDetail.dc.html` (okruszek „Nawyki i sen / {nazwa}”).
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(habits): szczegóły nawyku z kalendarzem, historią i usuwaniem`

### Task 7: Telefon — MHabits, MHabitNew, MSleep, MHabitDetail

**Files:**
- Create: `src/features/habits/mobile/m-habits.tsx`, `m-habit-sheet.tsx`, `m-sleep-sheet.tsx`, `m-habit-detail.tsx` (+ testy)
- Modify: `habits-view.tsx`, `habit-detail.tsx` (oba drzewa w DOM, przełączane klasami)

**Interfaces:**
- Consumes: store z Task 4, akcje z Task 3, funkcje z Task 2, `HabitMonth` z Task 6.
- Produces: telefonowe odpowiedniki. Arkusze są pełnoekranowe, z „Anuluj” / „Zapisz” w nagłówku.

- [ ] **Step 1: Testy:**
  - **MHabits, zakładka Nawyki:**
    - segment Nawyki / Sen; `?tab=sen` startuje na „Sen”;
    - pierścień „x z y zrobione dziś”;
    - duży checkbox (≥ 44 px) odhacza optymistycznie, przy nawyku „seria N dni”;
    - „Najdłuższa seria: {nazwa} · N dni”;
    - heatmapa 4 tygodni: stuknięcie pokazuje „{data} · x z y nawyków”.
  - **MHabits, zakładka Sen:**
    - wykres 14/30 ze stuknięciem słupka; bez stuknięcia podpowiedź „Stuknij słupek, żeby zobaczyć szczegóły”;
    - „Ostatnia noc”, „Średnio 14 dni”, „cel h:mm”;
    - „Dodaj wpis snu” otwiera arkusz.
  - **MHabitNew:** segment Codziennie / Wybrane dni / X w tyg., Stepper X 1–7, chipy godzin i „Inna…”, przełącznik „Pokazuj na ekranie Dziś”, zdanie podsumowania „Nawyk: …” na dole, „Zapisz” nieaktywne bez nazwy.
  - **MSleep:**
    - tytuł „Noc 14 → 15 listopada”;
    - −/+ co 15 min dla Zasnąłem / Wstałem;
    - duża liczba i „Powyżej celu 7:30” / „Brakuje N min do celu”;
    - „Jak się wyspałeś?” 1–5, tagi, notatka.
  - **MHabitDetail:**
    - kafelki Seria / Rekord / Skuteczn.;
    - kalendarz ‹ › do 5 miesięcy wstecz (i nie dalej niż start nawyku);
    - „N z M dni zaliczone”;
    - Notatki;
    - „Usuń nawyk” z tym samym potwierdzeniem co web.
- [ ] **Step 2:** FAIL. **Step 3:** Zaimplementuj według makiet `M*`. Dolny pasek i pływające przyciski używają `--tabbar-h`.
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(habits): nawyki i sen na telefonie`

### Task 8: Dziś, e2e, zrzuty i dokumentacja

**Files:**
- Modify: `src/app/(app)/dzis/page.tsx` (prawdziwe liczniki), `src/features/today/first-steps.ts` (linki `?nowy=`), `e2e/visual.spec.ts`, `docs/setup.md`, `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md`
- Create: `e2e/habits.spec.ts`, `e2e/helpers/nawyki.ts` (jeśli potrzebny)

- [ ] **Step 1: Liczniki na Dziś.** `firstSteps` dostaje prawdziwe `blocks`, `habits` i `sleepLogs` (zapytania `count: 'exact', head: true`). `workouts` zostaje 0 do Etapu 4. Linki: „Dodaj nawyk” → `/nawyki?nowy=nawyk`, „Wpisz ostatnią noc” → `/nawyki?nowy=sen`. Testy w `first-steps.test.ts` i `empty-today.test.tsx` zaktualizowane.
- [ ] **Step 2: `e2e/habits.spec.ts`** (projekty `web` i `mobile`, `test.skip(!process.env.E2E_SUPABASE)`, stałe daty przez seed w helperze):
  - web: „Nowy nawyk” „Woda 2 l” codziennie → odhacz dziś → „Nawyki dziś” „1/1” → po odświeżeniu nadal odhaczone;
  - web: zmiana na „Wybrane dni” pn, śr, pt w szczegółach → „Historia harmonogramu” ma dwie pozycje;
  - web: „+ Wpis snu” 23:30 → 07:00 → „Ostatnia noc” „7:30”; drugi wpis na tę samą datę edytuje go, bez błędu;
  - web: usunięcie nawyku → znika z listy, po odświeżeniu też;
  - mobile: segment „Sen” → „Dodaj wpis snu” → −/+ → Zapisz → słupek na wykresie; „Nawyki” → odhaczenie dużym checkboxem → pierścień „1 z 1”.
- [ ] **Step 3: `visual.spec.ts`:** dodaj `/nawyki` (web), okno nowego nawyku, okno snu, `/nawyki/{id}`; telefon: Nawyki, Sen, arkusz nawyku, arkusz snu, szczegóły.
- [ ] **Step 4:** `pnpm test && pnpm lint && pnpm typecheck && pnpm build`, push i zielone CI (`checks`, `db`, `e2e`).
- [ ] **Step 5: Dokumentacja.**
  - `docs/setup.md`: przed scaleniem `pnpm exec supabase db push --remote` (migracja `20261118120000_habits_sleep.sql`).
  - Mapa etapów: odhacz punkty Etapu 3 z dopiskiem, który test je pokrywa (jak w Etapie 2). Punkty bez testu zostaw `[ ]`.
- [ ] **Step 6: Commit** `test(e2e): nawyki i sen, zrzuty Etapu 3; Dziś z prawdziwymi licznikami; docs`
- [ ] **Step 7 (kontroler):** Mejson robi `db push --remote`, kontroler sprawdza migracje, RLS i GRANT w chmurze przez MCP, potem scalenie do `main` po zgodzie Mejsona.
