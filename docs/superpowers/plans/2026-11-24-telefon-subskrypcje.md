# Etap 3 / pakiet 8: Subscriptions na telefonie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** strona Subscriptions na telefonie wygląda jak CMSubs, a arkusz wiersza dla Kwoty cyklicznej i Daty odnowienia jak CMRowEdit. Odnowienia są widoczne w kalendarzu telefonu (dzień, tydzień, miesiąc).

**Spec:**
- `docs/superpowers/specs/2026-11-24-telefon-design.md`: inwentaryzacja (CMSubs, CMRowEdit Subscriptions), „Konflikty” punkt 8, decyzje T12, T13, T16;
- `docs/superpowers/specs/2026-11-24-subscriptions-design.md`: typy `recurring`/`renewal`, `nextRenewal`, `renewalDates`, `formatMoney`, `relativeDue`, `loadRenewals`, `RenewalPopover`.

Czytaj oba w całości przed każdym zadaniem.

**Makiety (wiążące):** `docs/design/mockups/CMSubs.dc.html` (filtry), `CMRowEdit.dc.html`. Dla odnowień w kalendarzu (bez makiety CM) wzorem jest styl z `S2Calendar.dc.html` i `S2CalendarRenewal.dc.html`, przeniesiony na CM-BASE. Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots CMSubs CMRowEdit S2CalendarRenewal`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, kontrolki, Vitest, Playwright (CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod; wolno używać czystych funkcji modelu z `fields.ts`/`table-model.ts` (wyjątek ze specu Subscriptions);
  - polskie teksty i komentarze;
  - commity na `feat/telefon-subskrypcje` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- Sumy, następne odnowienie, aktywność wiersza: tylko przez istniejące funkcje Subscriptions (`summarize`/`computeCard`, `nextRenewal`). Nie liczyć drugi raz inaczej.
- Bez „Przypomnij 3 dni przed” (T12). Waluta zawsze zł.
- Cele 44 px. Web bez zmian.
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint`. e2e (`e2e/pages.spec.ts`, `calendar.spec.ts` mobile) aktualizuj albo dopisz.

## Task 1: Widok Subscriptions na telefonie (CMSubs)

**Files:** create `src/features/pages/table/mobile/m-subs.tsx` (+ `m-subs.test.tsx`); modify `src/features/pages/table/page-table.tsx` (telefon: `MSubs` zamiast tabeli dla `template_key = 'subscriptions'` z polami `recurring` i `renewal`, T16), `editor-view.tsx` (przekazanie `template_key`, jeśli tabela go nie zna).

- [ ] `MSubs` czyta ten sam store co tabela (jak `MPasswords` w pakiecie hasla; jeśli `renderPhone` już istnieje, użyj go).
- [ ] Układ:
  - `m-head` bez ramki: link „Strony”, odstęp, „Nowy wiersz” (`Plus`) otwierający pusty arkusz wiersza;
  - `m-title` 24 px z tytułem strony;
  - dwie karty „Miesięcznie” i „Rocznie”: `.lbl` + 20/600 „437,94 zł” — `sum_month`/`sum_year` z modelu, tylko aktywne wiersze;
  - pasek `Card` w wierszu (tło `rgba(0,0,0,.025)`): ikona kalendarza, „Najbliżej: <b>Nazwa · 43,00 zł</b>” i `StatusBadge` warning z czasem do odnowienia (`next_renewal`). Bez aktywnych wierszy z datą: „Brak odnowień”, bez plakietki;
  - `Segment` „Filtr” (Wszystkie | Miesięczne | Roczne) — tymczasowy stan klienta, nie zapisywany;
  - lista w `Card`, posortowana po następnym odnowieniu. Wiersz `m-row` (`py-2.5`):
    - `Avatar` z inicjałem;
    - nazwa 500;
    - `.hint` „dd.mm · za N dni” (czas ≤ 7 dni w `--destructive-foreground`; teksty z `relativeDue`);
    - po prawej kwota 600 „43,00 zł/m” albo „/r” i plakietka kategorii (kolor opcji jak w tabeli);
  - wiersz nieaktywny: `opacity-55` i plakietka „anulowana” zamiast czasu (jak web);
  - na dole `.hint` „N z M subskrypcji” (odmiana: subskrypcja / subskrypcje / subskrypcji).
- [ ] Stuknięcie wiersza otwiera arkusz wiersza.
- [ ] Testy:
  - sumy (dwa miesięczne + jeden roczny, jeden nieaktywny);
  - filtr;
  - sortowanie;
  - kolor ≤ 7 dni;
  - odmiana licznika;
  - inne strony (Books) dalej mają tabelę.
- [ ] Commit: `feat(telefon): Subscriptions według CMSubs`.

## Task 2: Arkusz wiersza: Kwota cykliczna i Data odnowienia (CMRowEdit)

**Files:** `src/features/pages/table/mobile/m-row-sheet.tsx` (+ test).

- [ ] Kwota cykliczna:
  - siatka `grid-cols-[minmax(0,1fr)_150px] gap-2.5 items-end`;
  - `.fld` „<nazwa pola>” z `igroup` (pole `inputMode="decimal"`, wyrównane do prawej, „zł” muted);
  - obok `Segment` „Cykl” „mies. | rok”;
  - przy pustej kwocie segment pokazuje `default_cycle`;
  - formatowanie po wyjściu z pola jak w komórce webu.
- [ ] Data odnowienia: karta z kalendarzem miesiąca (wspólna z pakietu strony) otwarta na następnym odnowieniu, wybór zapisuje kotwicę. Pod spodem `.hint` „dd.mm.rrrr · za N dni” dla następnego odnowienia. Nigdy „minęło” (spec Subscriptions, D3).
- [ ] Checkbox wskazany przez `active_field_id` („Aktywna”): przełącznik w karcie `m-row`, jak inne checkboxy.
- [ ] Kategoria (pierwszy Wybór): chipy.
- [ ] Bez przełącznika przypomnienia (T12).
- [ ] Testy:
  - wpisanie „43,5” daje `{ amount: 43.5, cycle: "month" }`;
  - przełączenie cyklu;
  - wybór daty zapisuje kotwicę;
  - dopisek z następnym odnowieniem dla kotwicy w przeszłości.
- [ ] Commit: `feat(telefon): arkusz subskrypcji według CMRowEdit`.

## Task 3: Odnowienia w kalendarzu telefonu

**Files:** `src/features/calendar/mobile/m-calendar-day.tsx`, `m-calendar-week.tsx`, `m-calendar-month.tsx` (+ testy), `src/features/calendar/calendar-view.tsx` (przekazanie `renewals` do telefonu), `src/app/(app)/kalendarz/page.tsx` (bez zmian, jeśli `loadRenewals` już jest wołane); create `src/features/calendar/mobile/m-renewal-sheet.tsx` (+ test).

- [ ] Telefon dostaje te same `RenewalItem[]` i `RenewalSource[]` co web (bez nowych zapytań). Widoczność według `shown` źródła. W arkuszu kategorii (`CategorySheet`) pozycje źródeł z przerywanym kwadratem 10×8 i `Switch`, jak w menu webowym.
- [ ] Dzień: nad osią godzin (pod wierszem daty) pasek z plakietkami odnowień tego dnia. Plakietka to przycisk 44 px wysokości dotyku: `bdg out` z przerywaną ramką, `Repeat` 12 px, „Netflix · 43,00 zł”.
- [ ] Tydzień: odnowienia jako pierwsze wpisy dnia, ten sam styl.
- [ ] Miesiąc: szara kropka (`#a3a3a3`) w komórce dnia, liczona do limitu kropek. Na liście wybranego dnia wpis „↻ Netflix” z kwotą.
- [ ] Stuknięcie otwiera `MRenewalSheet`:
  - `FormDialog` „close” z treścią jak `RenewalPopover`: plakietka „Odnowienie · <strona>”, tytuł, data i czas, siatka Kwota/Kategoria/Cykl/Następne, `alert.info` „Tylko podgląd…”;
  - przycisk „Otwórz w <strona>” na całą szerokość (→ `/strony/<id>`).

  Treść kopiuje markup `RenewalPopover` (bez wspólnej funkcji pomocniczej) albo renderuje `RenewalPopover` w trybie treści, jeśli ma taki prop.
- [ ] Testy: plakietka w dniu, kropka w miesiącu, ukryte źródło nie pokazuje odnowień, arkusz z danymi i linkiem.
- [ ] Commit: `feat(telefon): odnowienia w kalendarzu telefonu`.

## Task 4 (koordynator): przegląd, CI, scalenie, dziennik

- [ ] **Przed Task 1:** gałąź `feat/telefon-subskrypcje` z `main` po stronach (i hasłach, jeśli wprowadziły `renderPhone`), kopia planu, dziennik.
- [ ] `visual.spec.ts`: zrzuty telefonu strony Subscriptions (z 3 wierszami), arkusza wiersza i dnia kalendarza z odnowieniem. W tytule makiety `CMSubs, CMRowEdit`.
- [ ] e2e (mobile): utworzenie strony Subscriptions, dodanie wiersza w arkuszu (kwota, cykl, data), suma w karcie „Miesięcznie”, odnowienie widoczne w dniu kalendarza.
- [ ] Przegląd gałęzi, CI zielone, scalenie według zasad serii. Dziennik, `stan-projektu.md`.
- [ ] „Do decyzji”: T12, T13, T16.
