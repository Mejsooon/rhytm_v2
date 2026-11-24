# Projekt Subscriptions — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Szablon Subscriptions z dwoma inteligentnymi typami pól („Kwota cykliczna” z przełącznikiem mies./rok, „Data odnowienia” liczona według cyklu), kartami i stopkami z sumą na miesiąc i rok, checkboxem „Aktywna” oraz odnowieniami w kalendarzu (tydzień, dzień, miesiąc) z dymkiem podglądu.

**Spec:** `docs/superpowers/specs/2026-11-24-subscriptions-design.md`. Czytaj go w całości przed każdym zadaniem. Ważne są zwłaszcza punkty 2 (typy), 3 (karty), 6 (kalendarz) i „Decyzje Claude”.

**Makiety (wiążące):** `docs/design/mockups/S2Main.dc.html`, `S2AddField.dc.html`, `S2CalendarRenewal.dc.html`, `S2Calendar.dc.html`, `S2CalendarMonth.dc.html`, `S2CalendarDay.dc.html`, `S2NewPage.dc.html`, `S2CardDialog.dc.html`, `S2ColumnMenu.dc.html`, `S2FilterPopover.dc.html` oraz arkusz `docs/design/mockups/coss/coss.css` z klasami `.bdg`, `.frame`, `.alert`, `.pop`, `.seg`, `.srow`. Szablon jest w `<x-dc>`, a dane i logika w `<script type="text/x-dc">`. `CMSubs.dc.html` należy do Etapu 3 i tu go nie ruszamy. Zrzut makiety: `PW_CHANNEL=chrome pnpm -s mockups:shots <Nazwa>`.

**Tech Stack:** Next.js 16 (cacheComponents), React 19, Supabase, Tailwind 4, kontrolki `@/components/controls`, `lucide-react` 1.73, Vitest, Playwright (tylko CI), pgTAP (tylko CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod bez funkcji pomocniczych skaczących po plikach. Wyjątek to czyste funkcje modelu w `fields.ts` i `table-model.ts` wymienione w tym planie;
  - komentarze i teksty UI po polsku, nazwa szablonu „Subscriptions” po angielsku;
  - SQL z jawnym `AS`.
- Commity tylko na gałęzi `feat/subscriptions`, z trailerem:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
  ```
- Nie wykonuj migracji na żadnej bazie. Lokalnie nie ma Dockera, pgTAP i e2e sprawdzi CI. Migrację na produkcję robi tylko koordynator, po scaleniu (Task 6).
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint` mają być zielone. W trakcie pracy możesz zawęzić testy do dotkniętych plików, ale przed commitem uruchom pełny zestaw.
- Istniejące testy Books, Projects, Websites i Haseł muszą przejść **bez zmiany oczekiwań**. Wyjątek to miejsca, które wprost wyliczają typy pól, szablony albo sygnatury zmienione tym planem.
- Testy e2e w `e2e/` (`pages.spec.ts`, `calendar.spec.ts`, `visual.spec.ts`, helpery `e2e/helpers/strony.ts` i `kalendarz.ts`) aktualizuj, gdy zmieniasz sprawdzane przez nie zachowanie. Nowe przypadki dopisuj tam, gdzie plan je wymienia.
- Typy wspólne, nazwy i kontrakty z tego planu są wiążące między zadaniami. Nie zmieniaj ich bez zmiany planu.

### Kontrakty wspólne (Task 2 je tworzy, Task 3–5 z nich korzystają)

```ts
// src/features/pages/fields.ts
export type FieldType = "text" | "number" | "checkbox" | "url" | "select" | "status" | "date" | "rating" | "secret"
  | "recurring" | "renewal";
export type Cycle = "month" | "year";
export type RecurringValue = { amount: number; cycle: Cycle };
export type CellValue = string | number | boolean | SecretValue | RecurringValue | null;
// FieldConfig dostaje:
//   default_cycle?: Cycle; cycle_field_id?: string; cycle?: Cycle; active_field_id?: string; default_checked?: boolean
export function isRecurringValue(raw: unknown): raw is RecurringValue;
// „5 255,28” (2 miejsca, przecinek, tysiące oddzielone  , bez „zł”)
export function formatMoney(n: number): string;
// Kwota na miesiąc / na rok (bez zaokrąglania)
export function monthlyAmount(v: RecurringValue): number;
export function yearlyAmount(v: RecurringValue): number;
// k-te wystąpienie serii od kotwicy (k ≥ 0), dzień obcięty do długości miesiąca
export function addCycle(anchor: string, cycle: Cycle, k: number): string;
export function nextRenewal(anchor: string, cycle: Cycle, today: string): string;
export function renewalDates(anchor: string, cycle: Cycle, from: string, to: string): string[];
// Cykl wiersza dla pola Data odnowienia (cycle_field_id → wartość kwoty → default_cycle → config.cycle → "month")
export function rowCycle(renewal: PageField, fields: PageField[], values: Record<string, unknown>): Cycle;
// Czy wiersz jest aktywny dla pola Data odnowienia (active_field_id wskazuje checkbox i wartość === true, albo brak odwołania)
export function rowActive(renewal: PageField, fields: PageField[], values: Record<string, unknown>): boolean;

// src/features/pages/table-model.ts
// SummaryKind dostaje: "sum_month" | "sum_year" | "in_calendar"
// PinnedCard["aggregation"] dostaje: "sum_month" | "sum_year" | "next_renewal"
export function visibleRows(fields, rows, settings, extraFilters?: FilterCond[] | null, today?: string | null): PageRow[];
```

`rowCycle` i `rowActive` to jedyne miejsca, które rozwiązują odwołania `cycle_field_id` i `active_field_id`. Odwołanie do pola, którego nie ma albo które ma inny typ, traktują jak brak odwołania (spec D18). Tabela, karty i kalendarz wołają je bezpośrednio.

## Task 1: Migracja `20261127100000_subscriptions.sql` + pgTAP

**Files:** create `supabase/migrations/20261127100000_subscriptions.sql` i `supabase/tests/subscriptions.test.sql`. Do przeczytania:
- `supabase/migrations/20261120120000_pages.sql`: oryginalne `delete_field`, `duplicate_page`, `create_page`;
- `supabase/migrations/20261121180000_vault.sql`: wzór zmiany `page_fields_type_check`;
- `supabase/migrations/20261125100000_passwords_module.sql`: **aktualna** wersja `duplicate_page` z blokadą `is_system` i strażnik `page_fields_guard`;
- `supabase/tests/pages.test.sql` i `supabase/tests/passwords_module.test.sql`: styl testów (użytkownicy w `auth.users`, `set local role authenticated`, `request.jwt.claims`, `set_config('test.*')`).

- [ ] `alter table public.page_fields drop constraint if exists page_fields_type_check;` i `add constraint page_fields_type_check check (type in ('text','number','checkbox','url','select','status','date','rating','secret','recurring','renewal'));`.
- [ ] `create or replace function public.duplicate_page(p_page_id uuid)`: pełna kopia wersji z `20261125100000_passwords_module.sql` (z blokadą strony systemowej), ze zmianą w pętli bloku:
  - **pierwsze przejście** po polach bloku buduje `v_map` (old id → new id);
  - **drugie przejście** wstawia pola z `config` przepisanym przez zamianę tekstu old→new dla każdej pary z `v_map` (jak `v_values`);
  - `v_content` i `values` wierszy jak dotąd;
  - zachowaj `security invoker`, `set search_path = ''`, komentarz nad funkcją po polsku, a na końcu migracji `revoke ... from public, anon` i `grant execute ... to authenticated` dla obu funkcji.
- [ ] `create or replace function public.delete_field(p_field_id uuid)`: pełna kopia oryginału. Przed `delete from public.page_fields` dopisz:
  ```sql
  update public.page_fields as f
  set config = f.config - 'cycle_field_id'
  where f.block_id = v_block_id and f.config ->> 'cycle_field_id' = v_id;
  update public.page_fields as f
  set config = f.config - 'active_field_id'
  where f.block_id = v_block_id and f.config ->> 'active_field_id' = v_id;
  ```
- [ ] Nagłówek migracji po polsku: co robi i że jest wstecznie zgodna (bez zmian danych).
- [ ] pgTAP (`select plan(N)`, `begin … rollback` jak w innych plikach) z przypadkami:
  1. insert pola `recurring` i `renewal` przechodzi, a pola `formula` daje błąd 23514;
  2. `secret` poza stroną systemową dalej jest blokowany (błąd ze strażnika);
  3. `create_page('Subscriptions', 'lucide:wallet', 'subscriptions', …)` z blokiem o polach `Nazwa`, `Kwota cykliczna` (recurring), `Data odnowienia` (renewal, z `cycle_field_id` i `active_field_id` wskazującymi id z p_blocks), `Aktywna` (checkbox) tworzy stronę z 4 polami;
  4. `duplicate_page` tej strony: w kopii `config ->> 'cycle_field_id'` pola renewal równa się id pola recurring **z kopii**, a nie z oryginału. Tak samo `active_field_id`. Wartości `{amount, cycle}` w `values` kopii są pod nowymi kluczami;
  5. `duplicate_page` strony systemowej dalej rzuca „Strony Hasła nie można zduplikować”. Weź wzór z `passwords_module.test.sql` albo pomiń, jeśli tamten test już to sprawdza, i opisz to w komentarzu;
  6. `delete_field(<recurring>)`: config pola renewal nie ma już klucza `cycle_field_id`, ma za to `active_field_id`;
  7. `delete_field(<checkbox>)`: config pola renewal nie ma `active_field_id`;
  8. RLS: użytkownik B nie widzi pól `renewal` użytkownika A (`select count(*) … = 0`);
  9. `has_function_privilege('anon', 'public.duplicate_page(uuid)', 'execute') = false` i `authenticated = true`. Tak samo dla `delete_field(uuid)`.
- [ ] `src/types/database.ts` bez zmian, bo struktura tabel się nie zmienia. Sprawdź tylko, że nic nie wylicza typów pól z bazy.
- [ ] Commit: `feat(db): typy pól Kwota cykliczna i Data odnowienia`.

## Task 2: Model — typy pól, przeliczenia, karty, szablon, walidacja

**Files:**
- `src/features/pages/fields.ts`, `fields.test.ts`;
- `src/features/pages/table-model.ts`, `table-model.test.ts`;
- `src/features/pages/templates.ts`, `templates.test.ts`;
- `src/features/pages/schemas.ts`;
- `src/features/pages/actions.ts` (`changeFieldType`: schemat wartości), `actions.test.ts`.

Do przeczytania: spec punkty 2–4.

- [ ] `fields.ts`: kontrakty z „Kontrakty wspólne”, czyli:
  - `FIELD_TYPE_META.recurring = { icon: "↻zł", Icon: Hash, label: "Kwota cykliczna" }`;
  - `FIELD_TYPE_META.renewal = { icon: "↻", Icon: Calendar, label: "Data odnowienia" }`;
  - `DOMYSLNA_SZEROKOSC.recurring = 200`, `.renewal = 230`.
- [ ] `normalizeValue`:
  - recurring: obiekt `{amount, cycle}` z `amount` skończonym, 0 ≤ amount ≤ 1e9, zaokrąglonym do 2 miejsc. Nowy obiekt ma tylko te dwa klucze. Liczba albo tekst („43,5”) daje `{ amount, cycle: config.default_cycle ?? "month" }`. Reszta daje `null`;
  - renewal: jak `date`.
- [ ] `formatValue`:
  - recurring: `"43,00 zł / mies."` albo `"249,99 zł / rok"`, z kwotą z `formatMoney`;
  - renewal: `dd.mm.rrrr` kotwicy.
- [ ] `convertValue` i `planTypeChange` według specu (punkt 2, „Zmiana typu”).
- [ ] `addCycle`, `nextRenewal`, `renewalDates`, `rowCycle`, `rowActive`, `formatMoney`, `monthlyAmount`, `yearlyAmount`. Testy:
  - `addCycle("2026-01-31","month",1) = "2026-02-28"`, `(…,2) = "2026-03-31"`, `("2028-01-31","month",1) = "2028-02-29"`, `("2024-02-29","year",1) = "2025-02-28"`, `(…,4) = "2028-02-29"`;
  - `nextRenewal("2026-11-21","month","2026-11-15") = "2026-11-21"` (kotwica w przyszłości);
  - `nextRenewal("2026-10-21","month","2026-11-15") = "2026-11-21"`;
  - `nextRenewal("2026-10-21","month","2026-11-21") = "2026-11-21"` (dziś = odnowienie);
  - `nextRenewal("2025-03-14","year","2026-11-24") = "2027-03-14"`;
  - `renewalDates("2026-10-21","month","2026-11-16","2026-12-31") = ["2026-11-21","2026-12-21"]`;
  - przed kotwicą nic: `renewalDates("2026-11-21","month","2026-11-01","2026-11-20") = []`;
  - `formatMoney(5255.28) = "5 255,28"`, `formatMoney(0) = "0,00"`;
  - `rowCycle`: z pola kwoty, z `default_cycle` przy pustej kwocie, z `config.cycle` bez `cycle_field_id`, i z `config.cycle` przy `cycle_field_id` wskazującym pole typu `number` (D18);
  - `rowActive`: brak `active_field_id` daje true, `true` daje true, `false` albo brak wartości daje false, odwołanie do pola nie-checkbox daje true.
- [ ] `table-model.ts`:
  - `operatorsFor`: recurring `["gte","lte","empty"]`, renewal `["before","after","empty"]`;
  - `summaryOptions`: recurring `["none","count","filled","empty","sum_month","sum_year"]`, renewal `["none","count","filled","empty","nearest","in_calendar"]`;
  - `visibleRows` dostaje 5. parametr `today?: string | null = null`:
    - recurring: filtr i sort po `monthlyAmount`;
    - renewal: filtr i sort po `nextRenewal(kotwica, rowCycle(...), today)`, gdy `today` jest podane, w przeciwnym razie po kotwicy;
    - stare typy bez zmian;
  - `summarize`:
    - `sum_month` daje `"Σ 437,94 zł / mies."`, a `sum_year` daje `"Σ 5 255,28 zł / rok"`. Sumuje tylko wiersze aktywne według pierwszego pola renewal z `cycle_field_id === field.id`. Bez takiego pola sumuje wszystkie. Pusto daje `"—"`. **`summarize` nie dostaje listy pól**, więc dodaj na końcu parametr `fields: PageField[] = []` i przekazuj go z `summary-cell.tsx`/`page-table.tsx` w Task 3;
    - `in_calendar` daje `"N w kalendarzu"`. Liczy aktywne wiersze z datą, gdy `field.config.show_in_calendar !== false`, inaczej `"0 w kalendarzu"`;
    - `nearest` dla renewal: najwcześniejsze `nextRenewal` aktywnych wierszy;
  - `computeCard`:
    - `sum_month`/`sum_year` dają `{ value: formatMoney(suma), sub: "zł" }`, z tą samą zasadą aktywności;
    - `next_renewal`: wiersz aktywny z najwcześniejszym `nextRenewal`. Wynik to `{ value: tytuł (isTitle albo empty_label), sub: relativeDue(...).text, urgent: dni ≤ 10, date: <IsoDate> }`. Bez wierszy daje `{ value: "Brak odnowień", sub: "" }`. Typ zwrotny dostaje opcjonalne `date?: string` (dla linku w karcie).
- [ ] Testy `table-model.test.ts` na danych z S2Main:
  - Netflix 43,00 mies., Strava 249,99 rok i Disney+ 37,99 mies. nieaktywny dają `sum_month = "63,83"` i `sum_year = "765,99"`;
  - sort po renewal z `today = "2026-11-15"`: kotwica `2026-10-21` (następne 21.11) stoi przed `2026-11-24`;
  - filtr `gte 50` na recurring nie przepuszcza Stravy (20,83 / mies.);
  - `next_renewal` pomija nieaktywny wiersz;
  - `in_calendar` przy `show_in_calendar: false` daje `"0 w kalendarzu"`.
- [ ] `templates.ts`:
  - `TEMPLATE_KEYS = ["empty","books","projects","websites","subscriptions"]`;
  - `TEMPLATES.subscriptions` dokładnie według specu (punkt 4);
  - `TemplateField.config` dopuszcza `cycle_field_id`/`active_field_id` jako **klucze szablonu**;
  - `buildTemplateBlocks` w dwóch przejściach: najpierw `idPola` dla wszystkich pól, potem configi z zamianą tych dwóch kluczy na id;
  - `PENDING_TO_TEMPLATE` bez zmian (D8).
  - Testy: pole renewal wskazuje id pola recurring i checkbox z tego samego bloku; karta `next_renewal` wskazuje pole renewal; `column_summaries` ma `sum_month` pod id kwoty i `in_calendar` pod id daty; sort `renewal asc`; Aktywna ma `default_checked: true`; opcja domyślna Kategorii to „Inne”; istniejące testy szablonów przechodzą.
- [ ] `schemas.ts`:
  - `fieldTypeSchema` + `"recurring"`, `"renewal"`;
  - `fieldConfigSchema` + `default_cycle`, `cycle` (`z.enum(["month","year"])`), `cycle_field_id`, `active_field_id` (`z.string().min(1).max(64)`), `default_checked: z.boolean()`, wszystkie `optional()`;
  - `pinnedCard.aggregation` + `"sum_month"`, `"sum_year"`, `"next_renewal"`.
- [ ] `actions.ts` / `changeFieldType`: union wartości dostaje `z.object({ amount: z.number(), cycle: z.enum(["month","year"]) })`. `addRow`/`updateRow` normalizują przez `normalizeValue`, więc tam zmian nie ma. Test akcji: zmiana typu `number → recurring` z wartością obiektową przechodzi walidację.
- [ ] `use-table-store.ts` (linie z `default_option`, ok. 172 i 373): checkbox z `config.default_checked === true` daje nowemu wierszowi `true`. Dopisz test w `use-table-store.test.ts`.
- [ ] Commit: `feat(strony): model Kwoty cyklicznej i Daty odnowienia, szablon Subscriptions`.

## Task 3: Tabela — komórki, karty, stopki, wiersz nieaktywny (S2Main)

**Files:** `src/features/pages/table/table-cell.tsx`, `table-cell.test.tsx`, `page-table.tsx`, `page-table.test.tsx`, `summary-cell.tsx`, `pinned-cards.tsx`, `pinned-cards.test.tsx`, `card-dialog.tsx`, `card-dialog.test.tsx`, `test-page.ts` (dane testowe), `src/features/pages/table/mobile/m-row-sheet.tsx` i jego test. Do przeczytania: `S2Main.dc.html` (`isMoney`, `TAFTER`, `relTxt`/`relC`, karty, `tfoot`) i spec punkty 3 i 5.

- [ ] **Komórka recurring** (`table-cell.tsx`, nowa gałąź obok `number`), według markupu `isMoney`:
  - w kolejności pole tekstowe (`inputMode="decimal"`, placeholder `0,00`, `text-right`, `aria-label` `"<nazwa pola>"`), szare „zł” 13 px i przycisk `/ mies.` | `/ rok`;
  - zapis przy pisaniu z tym samym opóźnieniem co Liczba: `{ amount, cycle }`, a pusty tekst daje `null`;
  - na blur tekst przyjmuje postać `formatMoney`;
  - przycisk cyklu ma `aria-label` „Cykl: mies. (kliknij, aby zmienić)”, przełącza i zapisuje od razu, a przy pustej kwocie jest `disabled` i pokazuje `default_cycle`.
- [ ] **Komórka renewal**: jak gałąź `date`.
  - `DatePicker` z wartością `nextRenewal(kotwica, rowCycle(...), today)`, a `onChange` zapisuje nową kotwicę;
  - wiersz nieaktywny (`rowActive` = false) ma szary `StatusBadge` „anulowana”;
  - inaczej `relativeDue(next, today).text`: 0–10 dni to `StatusBadge tone="orange"` (sprawdź nazwę tonu `warn` w `@/components/controls`; jeśli go nie ma, dodaj ton według `.bdg.warn` z `coss.css`), więcej to szary tekst.
- [ ] `page-table.tsx`:
  - `visibleRows(..., today)`;
  - nagłówek i stopka recurring wyrównane do prawej jak `number`;
  - `<tr style={{ opacity: .55 }}>`, gdy dowolne pole renewal tabeli ma `active_field_id` i `rowActive` = false;
  - `summarize(..., fields)`;
  - przełącznik „Pokaż w kalendarzu” (dziś tylko dla date, linia ok. 619) działa też dla renewal.
- [ ] `summary-cell.tsx`: nazwy `sum_month` „Suma / mies.”, `sum_year` „Suma / rok”, `in_calendar` „W kalendarzu”. Stopka `sum_*` ma `font-semibold` i ciemny tekst (S2Main `tfoot`).
- [ ] `pinned-cards.tsx`:
  - `sum_month`/`sum_year` mają liczbę 26 px i szare „zł” 14 px (jak gałąź z `sub`);
  - `next_renewal` to wariant jak `nearest_date`: nazwa 18 px jako `Link` do `/kalendarz?widok=tydzien&data=<date>` (`text-inherit no-underline`) i plakietka `lg`, pomarańczowa przy `urgent`, inaczej szara.
- [ ] `card-dialog.tsx` / `SPOSOBY`:
  - `recurring`: `[{key:"sum_month",label:"Suma na miesiąc",desc:"np. „Σ miesięcznie: 437,94 zł”"},{key:"sum_year",label:"Suma na rok",desc:"np. „Σ rocznie: 5 255,28 zł”"}]`;
  - `renewal`: `[{key:"next_renewal",label:"Najbliższe odnowienie",desc:"najbliższa przyszła data wg cyklu"}]`;
  - podgląd karty działa przez `computeCard`.
- [ ] `m-row-sheet.tsx` (telefon, minimum): recurring to pole liczby i segment „mies. | rok”, renewal to pole daty z dopiskiem „następne: dd.mm.rrrr”.
- [ ] Testy komponentów:
  - wpisanie „43,5” zapisuje `{amount:43.5,cycle:"month"}`, a blur pokazuje „43,50”;
  - klik w „/ mies.” zapisuje `cycle:"year"`;
  - pusty wiersz ma przycisk cyklu wyłączony;
  - data odnowienia z kotwicą `2026-10-21` przy `today=2026-11-15` pokazuje `21.11.2026` i „za 6 dni” w pomarańczowej plakietce;
  - wiersz z Aktywna = false ma `opacity .55` i „anulowana”;
  - karty Σ pokazują „63,83 zł”;
  - karta „Najbliższe odnowienie” prowadzi do `/kalendarz?widok=tydzien&data=…`;
  - okno karty dla pola Kwota cykliczna proponuje „Suma na miesiąc”.
- [ ] Commit: `feat(strony): komórki, karty i stopki subskrypcji`.

## Task 4: Okno „Nowe pole”, menu kolumny, „Nowa strona”, e2e stron

**Files:**
- `src/features/pages/table/add-field-dialog.tsx` (+ nowy test `add-field-dialog.test.tsx`, jeśli go nie ma, albo testy w `page-table.test.tsx`);
- `column-menu.tsx`, `column-menu.test.tsx`;
- `page-table.tsx` (przekazanie `fields` do `AddFieldDialog`, obsługa nowych akcji menu przez `updateField` w store);
- `src/features/pages/new-page-view.tsx`, `new-page-view.test.tsx`;
- `src/features/pages/table/filter-popover.tsx` (jeśli wylicza typy), `filter-popover.test.tsx`;
- `e2e/pages.spec.ts`, `e2e/helpers/strony.ts`, `e2e/visual.spec.ts`.

Do przeczytania: `S2AddField.dc.html` (blok `af`, grupy, `T.recurring`/`T.renewal`, `sc-if af.is.recurring|renewal`), `S2NewPage.dc.html`, `S2ColumnMenu.dc.html`, spec punkt 5.

- [ ] `AddFieldDialog`:
  - nowy prop `fields: PageField[]`;
  - druga grupa listy „Inteligentne” z nagłówkiem `MENU_LABEL` jak „Podstawowe”. Pozycje: Kwota cykliczna (defName „Cena”, opis „Kwota z cyklem. Sama przelicza się na miesiąc i rok, a pod tabelą liczy sumy.”) i Data odnowienia (defName „Odnowienie”, opis „Pokazuje najbliższą przyszłą datę wg cyklu i liczbę dni do niej. Nic nie trzeba przesuwać ręcznie.”). Obie z zieloną plakietką „liczy”;
  - przy wybranym typie inteligentnym plakietka „inteligentne” obok nazwy;
  - ustawienia w ramce z wierszami `.srow`:
    - recurring: „Domyślny cykl” (segment miesiąc | rok), „Suma w stopce” z plakietką „/ mies. i / rok”, „Waluta” z „zł” i alert z przykładem;
    - renewal: „Cykl z pola” (natywny select z polami recurring „<nazwa> (Kwota cykliczna)” i „własny cykl”, a po wybraniu własnego segment miesiąc | rok), „Pokaż w kalendarzu” (przełącznik `Switch`, domyślnie wł.) i „Tylko gdy zaznaczone” (pola checkbox i „— zawsze —”);
  - `dodaj()` buduje config: `{ default_cycle }` dla recurring oraz `{ cycle_field_id? | cycle, show_in_calendar, active_field_id? }` dla renewal;
  - domyślnie: pierwsze pole recurring jako „Cykl z pola”, jeśli istnieje, i pierwsze pole checkbox jako „Tylko gdy zaznaczone”, jeśli istnieje.
- [ ] `ColumnMenu`:
  - „Typ pola” pokazuje recurring i renewal, bo lista idzie z `FIELD_TYPE_META` bez `secret`. Sprawdź kolejność: nowe typy na końcu;
  - renewal: przełącznik „Pokaż w kalendarzu” jak dla date oraz podmenu „Cykl z pola” (pola recurring, „Własny: miesiąc”, „Własny: rok”) i „Tylko gdy zaznaczone” (pola checkbox, „— zawsze —”), zbudowane jak podmenu „Podsumowanie”, z ikoną `Check` przy wybranym;
  - recurring: podmenu „Domyślny cykl” (miesiąc, rok);
  - nowe callbacki: `onConfig(patch: Partial<FieldConfig>)`, który rodzic zapisuje przez istniejący `updateField` store'u. Usunięcie klucza (np. „— zawsze —”) zapisuje config bez tego klucza.
- [ ] `new-page-view.tsx`: Subscriptions pojawia się automatycznie z `TEMPLATE_KEYS`. Sprawdź, że pola, plakietki typów i `extra` renderują się jak w innych szablonach, a ikona `wallet` ładuje się przez istniejący mechanizm ikon. Test: wybór Subscriptions pokazuje „Kwota cykliczna” i „Data odnowienia” oraz dopisek z `extra`.
- [ ] `filter-popover.tsx`: operatory z `operatorsFor`. Wartość dla recurring to pole liczby z dopiskiem „zł / mies.”, a dla renewal kalendarz jak dla date.
- [ ] e2e (`pages.spec.ts`), nowy test „Subscriptions: szablon, kwota, cykl, sumy”:
  1. utwórz stronę z szablonu Subscriptions;
  2. „+ Nowy”, nazwa „Netflix”, kwota „43” → karta „Σ miesięcznie” pokazuje „43,00”, a „Σ rocznie” pokazuje „516,00”;
  3. przełącz cykl na „/ rok” → „Σ miesięcznie” pokazuje „3,58”;
  4. odznacz „Aktywna” → sumy „0,00” i wiersz ma plakietkę „anulowana”;
  5. ustaw datę odnowienia „Dziś” → karta „Najbliższe odnowienie” pokazuje „Brak odnowień” (wiersz nieaktywny). Po zaznaczeniu „Aktywna” karta pokazuje „Netflix” i „dziś”.
- [ ] e2e: dodanie pola „Kwota cykliczna” przez „+” na pustej tabeli z menu „/” zmienia stopkę po wyborze podsumowania „Suma / mies.”.
- [ ] `visual.spec.ts`: dopisz zrzut strony Subscriptions z kilkoma wierszami (makieta S2Main) i okna „Nowe pole” z wybraną Kwotą cykliczną (S2AddField), według wzoru istniejącego testu „zrzuty /strony”.
- [ ] Commit: `feat(strony): okno Nowe pole, menu kolumny i szablon Subscriptions w UI`.

## Task 5: Odnowienia w kalendarzu (tydzień, dzień, miesiąc, dymek, menu kategorii)

**Files:**
- `src/features/calendar/load-calendar.ts` (+ `loadRenewals`, typy `RenewalItem` i `RenewalSource`), `load-calendar.test.ts`;
- `src/app/(app)/kalendarz/page.tsx`;
- `src/features/calendar/calendar-view.tsx`, `calendar-view.test.tsx`;
- `time-grid.tsx`, `time-grid.test.tsx`;
- `month-grid.tsx`, `month-grid.test.tsx`;
- `category-filters.tsx`, `category-filters.test.tsx`;
- nowy `src/features/calendar/renewal-popover.tsx` + `renewal-popover.test.tsx`;
- `e2e/calendar.spec.ts`, `e2e/helpers/kalendarz.ts`, `e2e/visual.spec.ts`.

Do przeczytania:
- `S2CalendarRenewal.dc.html` (dymek, styl `renChip`);
- `S2Calendar.dc.html` (wiersz „cały dzień”, `bdg out lg` z ikoną `Repeat`, `CATDEF` z „Subscriptions” i przerywanym kwadratem);
- `S2CalendarMonth.dc.html` (wpis „↻ Netflix”, `isRenewal`);
- `block-popover.tsx` (mechanizm kotwiczenia dymku);
- spec punkt 6.

- [ ] `loadRenewals(supabase, userId, range: {from,to}, today): Promise<{ items: RenewalItem[]; sources: RenewalSource[] }>`. Kształty są w specu (punkt 6).
  - Zapytania (błąd → `throw new Error(...)`, jak w `loadCalendar`):
    1. `from("page_fields").select("id, block_id, name, config, page_blocks!inner(id, page_id, deleted_at, pages!inner(id, title, deleted_at, is_system))").eq("user_id", userId).eq("type", "renewal").is("page_blocks.deleted_at", null).is("page_blocks.pages.deleted_at", null).eq("page_blocks.pages.is_system", false)`;
    2. `from("page_fields").select("id, block_id, name, type, config, position, is_title").in("block_id", ids)`;
    3. `from("page_rows").select("id, block_id, values").in("block_id", ids).is("deleted_at", null)`.
  - Bez pól renewal funkcja zwraca puste listy bez zapytań 2 i 3.
  - `items` dla **wszystkich** źródeł:
    - tylko wiersze z `rowActive` i poprawną kotwicą;
    - `renewalDates(kotwica, rowCycle(...), from, to)`;
    - `next = addCycle(date, cycle, 1)`;
    - `amount` z pola `cycle_field_id` (jeśli to recurring), inaczej `null`;
    - kategoria z pierwszego pola select/status bloku (po `position`);
    - `sources[].name` = tytuł strony („Bez tytułu” dla pustego), a przy kilku polach renewal na jednej stronie `"<tytuł> · <nazwa pola>"`.
  - Sort `items`: data, potem tytuł.
  - Testy (mock klienta jak w `load-calendar.test.ts`): wystąpienia miesięczne w zakresie tygodnia i miesiąca, nieaktywny wiersz pominięty, usunięty blok pominięty przez filtr zapytania (sprawdź argumenty `.is`), `shown=false` przy `show_in_calendar:false`, `amount` null bez pola kwoty.
- [ ] `kalendarz/page.tsx`: `Promise.all([loadCalendar(...), loadRenewals(supabase, user.id, zakres, dzis)])` i prop `renewals` w `CalendarView`.
- [ ] `CalendarView`:
  - stan źródeł (`sources` z `shown`), widoczne odnowienia to `items.filter(i => shown[i.fieldId])`;
  - przełączenie źródła to optymistyczna zmiana i `updateField(fieldId, { config: { ...config, show_in_calendar: !shown } })` z `@/features/pages/actions`, z cofnięciem i komunikatem błędu jak przy `setCategoryHidden`;
  - stan otwartego odnowienia (`renewalKey` + kotwica). Otwarcie zamyka dymek bloku i odwrotnie;
  - widoki na telefonie (`mobile/*`) **nie** dostają odnowień (Etap 3).
- [ ] `TimeGrid`:
  - nowe propsy `renewals?: RenewalItem[]`, `openRenewalKey?: string | null` i `onRenewalClick?: (item, anchorEl) => void`;
  - tydzień: w komórkach wiersza „cały dzień” lista przycisków (usuń komentarz „w Etapie 2 pusty…”). Każdy przycisk to `StatusBadge`-podobny `.bdg.out.lg` (sprawdź wariant `outline` w kontrolkach) na całą szerokość, z przerywaną ramką, ikoną `Repeat` 12 px i tekstem `title + (amount !== null ? " · " + formatMoney(amount) + " zł" : "")` ucinanym wielokropkiem. `aria-expanded` przy otwartym;
  - otwarty ma ramkę `rgba(0,0,0,.4)` i cień `0 0 0 2px rgba(0,0,0,.08)`;
  - `title` (dymek przeglądarki): „Odnowienie ze strony <tytuł> — tylko podgląd”;
  - dzień: te same przyciski w wierszu „cały dzień” za numerem i nazwą dnia (`flex-wrap`).
- [ ] `MonthGrid`:
  - nowe propsy jak wyżej;
  - nowy rodzaj wpisu `{ typ: "odnowienie" }` sortowany przed blokami (`startMin = -1`);
  - styl wpisu bez kategorii (`KOLOR_BRAK` z `14` i `4d`), tekst `↻ ${title}`;
  - liczy się do `MAX_WPISOW` i „+N więcej”.
- [ ] `RenewalPopover` (`renewal-popover.tsx`): treść według S2CalendarRenewal i specu (punkt 6):
  - plakietka „Odnowienie · <tytuł strony>”, tytuł, data i czas (`DNI_KROTKO` + `dd.mm.rrrr` + ` · ${relativeDue}`, a dla przeszłych sama data);
  - siatka 2×2 (Kwota, kategoria, Cykl „co miesiąc”/„co rok”, Następne) i `.alert.info` „Tylko podgląd. Edytujesz na stronie <tytuł>.”;
  - stopka `Link` „Otwórz w <tytuł>” (ikona `ArrowRight` za tekstem) do `/strony/<pageId>`;
  - „Zamknij” (`XIcon`), Esc i klik obok zamykają dymek. Szerokość 340 px.
- [ ] `CategoryFilters`:
  - nowe propsy `sources: RenewalSource[]` i `onToggleSource(source)`;
  - pozycje źródeł pod kategoriami w tym samym menu (`CheckboxItem`) i w arkuszu na telefonie. Marker to przerywany kwadrat 10×8 px (`border: 1px dashed #404040`, przy ukrytym `#a3a3a3`) zamiast kropki;
  - licznik `widoczne/wszystkie` liczy kategorie i źródła, a kropki na przycisku tylko kategorie.
- [ ] Testy:
  - tydzień z odnowieniem 21.11 pokazuje „Netflix · 43,00 zł” w kolumnie soboty;
  - klik otwiera dymek z „Następne 21.12.2026” i linkiem `/strony/<id>`;
  - Esc zamyka dymek;
  - ukrycie źródła w menu chowa wpisy i woła `updateField` z `show_in_calendar:false`;
  - miesiąc: „↻ Netflix” jest pierwszym wpisem dnia, a 4. wpis daje „+1 więcej”;
  - widok dnia pokazuje wpis w wierszu „cały dzień”.
- [ ] e2e (`calendar.spec.ts`), nowy test „odnowienie subskrypcji w kalendarzu”:
  1. przez helper stron utwórz Subscriptions z wierszem „Netflix”, 43 zł i datą odnowienia = dzień w bieżącym tygodniu;
  2. w `/kalendarz?widok=tydzien` widać „Netflix · 43,00 zł”;
  3. klik pokazuje dymek „Odnowienie · Subscriptions”, a „Otwórz w Subscriptions” prowadzi na stronę;
  4. w menu „Kategorie” odznacz „Subscriptions”, więc wpis znika, a po przeładowaniu dalej go nie ma.

  Datę dobierz tak, żeby test nie zależał od pory dnia (wzór w `e2e/helpers/kalendarz.ts`). Uważaj na znane niestabilne testy z `CLAUDE.md`.
- [ ] `visual.spec.ts`: zrzut tygodnia z otwartym dymkiem odnowienia (S2CalendarRenewal) i miesiąca z wpisem odnowienia (S2CalendarMonth).
- [ ] Commit: `feat(kalendarz): odnowienia subskrypcji w tygodniu, dniu i miesiącu`.

## Task 6 (koordynator): przegląd, CI, scalenie, migracja, dziennik

**Files:** `docs/superpowers/specs/2026-11-24-subscriptions-design.md` (kopia szkicu), `docs/superpowers/plans/2026-11-24-subscriptions.md` (kopia tego planu), `docs/superpowers/dziennik/<dziś>.md`, `docs/superpowers/stan-projektu.md`, `docs/superpowers/odlozone.md`.

- [ ] **Przed Task 1:**
  - gałąź `feat/subscriptions` z aktualnego `main` (po scaleniu Dziś);
  - kopie specu i planu do `docs/superpowers/` (pierwszy commit gałęzi: `docs(subscriptions): spec i plan`);
  - wpis w dzienniku i w `stan-projektu.md` („W toku: Subscriptions”; kolejność serii: Dziś → Subscriptions → sprzątanie → Etap 3).
- [ ] Po każdym zadaniu recenzent (subagent-driven-development) sprawdza zgodność ze specem i makietami (zrzuty `pnpm -s mockups:shots S2Main S2AddField S2CalendarRenewal S2Calendar S2CalendarMonth`) i kontrakty wspólne. Drobne uwagi idą do `odlozone.md`.
- [ ] Przegląd całej gałęzi:
  - stare szablony bez zmian zachowania;
  - brak funkcji pomocniczych poza wymienionymi;
  - teksty po polsku;
  - SQL z `AS`;
  - `duplicate_page` z blokadą Haseł.
- [ ] Push gałęzi, CI zielone (pgTAP `subscriptions.test.sql` + wszystkie dotychczasowe, e2e). Niestabilne testy z `CLAUDE.md` ponów przez `gh run rerun <id> --failed`, a logi czytaj przez `gh run view <id> --log-failed`.
- [ ] Scalenie (seria autonomiczna według `CLAUDE.md`):
  - `git checkout main && git merge --no-ff feat/subscriptions`;
  - `pnpm -s test && pnpm -s typecheck && pnpm -s lint` na połączonym kodzie;
  - push `main`.
- [ ] **Migracja przed wdrożeniem kodu na Vercel** (spec punkt 7): zaraz po pushu `main`, w czasie budowania, przez konektor Supabase `apply_migration`, z nazwą `subscriptions` i treścią pliku `20261127100000_subscriptions.sql`, na projekcie `yazntcoocfxfxqqevxoh`. Potem `list_migrations`:
  - wersja ma być `20261127100000`;
  - jeśli konektor nadał inną, zmień nazwę pliku w repo na wersję z produkcji (gałąź `docs/*`, commit, scalenie).

  Migracja niczego nie usuwa, więc nie wymaga potwierdzenia Mejsona. Jeśli konektor nie działa, zapisz w dzienniku, że migrację uruchamia Mejson (`pnpm exec supabase db push --remote`).
- [ ] Sprawdzenie na produkcji (po wdrożeniu): utworzenie strony Subscriptions działa, a kalendarz pokazuje odnowienie. Bez danych Mejsona, czyli na stronie testowej, którą potem usuwasz.
- [ ] Dziennik (Co zrobione, Decyzje, Otwarte wątki, Błędy) i `stan-projektu.md`:
  - Subscriptions w „Zrobione” z merge'em i migracją;
  - „W toku”: następny projekt serii (sprzątanie odłożonych uwag webu);
  - w „Dalej” odnotuj CMSubs i odnowienia na telefonie w Etapie 3 oraz terminy Projects w kalendarzu jako możliwy pakiet.
- [ ] Lista „Do decyzji” dla Mejsona: punkty D1–D18 i „Do decyzji” ze specu, każdy z kosztem pomyłki.
