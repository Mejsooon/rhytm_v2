# Etap 3 / pakiet 2: kalendarz na telefonie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** kalendarz na telefonie (dzień, tydzień, miesiąc, arkusz bloku, arkusz kategorii) wygląda jak CMCalendarDay, CMCalendarWeek, CMCalendarMonth i CMBlockSheet. Logika, dane i przepływy bez zmian.

**Spec:** `docs/superpowers/specs/2026-11-24-telefon-design.md`: inwentaryzacja (wiersze CMCalendar*, CMBlockSheet), uwagi „kalendarz” i decyzje. Czytaj w całości przed każdym zadaniem.

**Makiety (wiążące):** `docs/design/mockups/CMCalendarDay.dc.html` (z arkuszem kategorii: stan `catsOpen`), `CMCalendarWeek.dc.html`, `CMCalendarMonth.dc.html`, `CMBlockSheet.dc.html` (tweak `edit` = tryb edycji), a od 24.11 także `CMBlockDetail.dc.html`, `CMScopeSheet.dc.html`, `CMDeleteBlock.dc.html`, `CMNewEntry.dc.html`, `CMCategorySheet.dc.html`. Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots CMCalendarDay CMCalendarWeek CMCalendarMonth CMBlockSheet`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4 (`@utility` `m-*` z pakietu fundament), kontrolki `@/components/controls`, Vitest, Playwright (CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod;
  - polskie teksty i komentarze;
  - commity na `feat/telefon-kalendarz` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- Makiety CM* wygrywają z planem. Wartości z makiety: style inline, CM-BASE i `coss.css`.
- Cele dotykowe ≥ 44 px. Web (≥ 800 px) bez zmian.
- Kolory kategorii to dane: tło `kolor + "12"`, ramka `kolor + "4d"`, pierścień wyboru `0 0 0 2px #fff, 0 0 0 4px kolor + "66"`.
- Usuń `font-mono` i etykiety wersalikami z plików telefonu kalendarza. Hexy UI zamień na tokeny.
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint`. Testy e2e telefonu (`e2e/calendar.spec.ts`, projekt `mobile`) aktualizuj przy zmianie tekstu albo roli.
- Bez migracji. Odnowienia subskrypcji na telefonie (plakietki ↻ w dniu/tygodniu/miesiącu i CMRenewalSheet) robi pakiet `subskrypcje`, nie ten.

## Task 1: Dzień (CMCalendarDay) i arkusz kategorii

**Files:** `src/features/calendar/mobile/m-calendar-day.tsx` (+ test), `src/features/calendar/calendar-header.tsx` (gałąź telefonu), `src/features/calendar/category-filters.tsx` (`CategorySheet` + test), `src/features/calendar/calendar-view-mobile.test.tsx`, `src/features/calendar/mobile/pl.ts`.

- [ ] Nagłówek przez `ModuleHeader` albo własny `m-head`, zależnie od tego, jak dziś `calendar-header.tsx` składa telefon:
  - tytuł miesiąca `m-title` + `.lbl` „tydz. N” w jednej linii (`items-baseline gap-2`);
  - po prawej „Kategorie” (ikona, `aria-haspopup="dialog"`) i „Szukaj” (link `/szukaj`), oba 44 px.
- [ ] Segment widoków: `.seg` na całą szerokość (`mx-4 mt-3 mb-2`), linki „Dzień · Tydzień · Miesiąc” z `aria-current="page"`, 40 px.
- [ ] Pasek tygodnia (`day-pick`): skopiuj wygląd z `renderVals` makiety (`d.s`, `d.numS`, `d.dot`), w tym dzisiejszy dzień i wybrany.
- [ ] Wiersz daty: `border-y`, `px-4 py-2`, 13 px muted, „·” i `StatusBadge` (secondary, liczba wpisów).
- [ ] Oś: 56 px na godzinę (bez zmian), etykiety godzin 11 px muted 40 px do prawej, linie `--border`. Linia „teraz” w `--destructive` (`#ef4444`) z kropką 10 px. Bloki: styl z `b.s` makiety (tło/ramka kategorii, tytuł 14/500, czas 12 muted). FAB jako `m-fab`.
- [ ] `CategorySheet` (telefon):
  - arkusz `FormDialog` z nagłówkiem „Kategorie” i `✕`;
  - wiersze `m-row`: kropka koloru, nazwa, `Switch` (`m-hit`);
  - ostatni wiersz to link muted z ikoną `Plus` i tekstem **„Kategoria”** (było „+ Kategoria”);
  - bez dodatkowego „✕” w wierszach (odłożone, różnica M → CM).
- [ ] Testy: role i nazwy bez zmian, poza tekstem „Kategoria”. Dodaj test linii „teraz” (kolor tokenu) i `aria-current` w segmencie.
- [ ] Commit: `feat(telefon): dzień kalendarza według CMCalendarDay`.

## Task 2: Tydzień i miesiąc (CMCalendarWeek, CMCalendarMonth)

**Files:** `src/features/calendar/mobile/m-calendar-week.tsx`, `m-calendar-month.tsx` (+ testy), `calendar-header.tsx` (gałąź telefonu).

- [ ] Tydzień:
  - nagłówek `m-head` z `.lbl` „RRRR · tydzień N” i tytułem zakresu („9–15 listopada”, odmiana miesięcy z `pl.ts`);
  - akcje „Szukaj” i „Nowy blok”;
  - lista dni: odznaka dnia (`d.badgeS`/`d.numS` z makiety: dziś odwrócone kolory), wpisy jako linki 14/500 z czasem 12 muted, styl kategorii;
  - FAB.
- [ ] Miesiąc:
  - nagłówek z `.lbl` roku, `m-title` miesiąca, strzałki „Poprzedni miesiąc” / „Następny miesiąc” (44 px);
  - siatka `month-cell` z kropkami (maks. 2–3 jak w makiecie), dziś i wybrany według `c.s`/`c.ns`;
  - pod siatką lista wybranego dnia: `card-t` 17 px, „Otwórz dzień” (`btng`), wpisy z czasem 42 px;
  - pusty dzień: przycisk przerywany 56 px „Brak bloków — dodaj” (`Plus`) otwierający arkusz nowego bloku na ten dzień.
- [ ] Testy zachowania bez zmian. Dopisz test pustego dnia (przycisk i otwarcie arkusza).
- [ ] Commit: `feat(telefon): tydzień i miesiąc według CM`.

## Task 3: Arkusz bloku (CMBlockSheet) i szczegóły bloku

**Files:** `src/features/calendar/mobile/m-block-sheet.tsx` (+ test), `src/features/calendar/scope-dialog.tsx` (tylko gałąź telefonu), `src/features/calendar/delete-block-dialog.tsx` (już na `ConfirmDialog` z fundamentu, tylko sprawdzić).

- [ ] Arkusz przez `FormDialog` z `phoneHeader="actions"`: „Anuluj” · „Nowy blok”/„Edytuj blok” · „Zapisz” (`btnp`), wysokość 88%.
- [ ] Treść według makiety:
  - nazwa: pole 44 px, 18 px / 500, placeholder „Nazwa bloku”;
  - „Kategoria”: `.lbl` + chipy z kropką, wybrany z tłem i ramką kategorii oraz pierścieniem (`c.s`, `c.dot` z makiety);
  - karta z `m-row`:
    - Dzień: `igroup` z ikoną kalendarza i datą „nd 15.11.2026”, **bez przecinka** (było „nd, 15.11.2026”);
    - Od / Do: `m-step` ±;
    - „Czas trwania: …” jako `.hint`;
  - „Powtarzanie”: chipy (Nie, Codziennie, Co tydzień, Dni robocze, Własne…); przy „Własne…” siatka 7 dni; przy powtarzaniu karta „Powtarzaj do” (chip „do DD.MM.RRRR” / „bez końca”) i `.hint` z opisem reguły (jak `recurrence-text.ts`);
  - „Notatka”: `textarea` 16 px, placeholder „Opcjonalnie”;
  - karta „Przypomnij 5 min wcześniej” z przełącznikiem (bez zmian logiki);
  - tryb edycji: tytuł „Edytuj blok” i na dole `btndo` „Usuń blok” (otwiera usuwanie: jednorazowy → `ConfirmDialog`, cykliczny → okno zakresu);
  - „Zadania w bloku · N”: karta z wierszami (`cbx`, tytuł, „Usuń zadanie” 44 px muted) i wierszem dodawania „Dodaj zadanie…” (Enter dodaje).
- [ ] `scope-dialog.tsx` na telefonie według CMScopeSheet: arkusz od dołu, tytuł 20 px „Zmieniasz blok, który się powtarza” + podtytuł (tytuł · reguła · co się zmienia), karta z wierszami-radio 64 px (tytuł 500 + `.hint` opisu), stopka 2 kolumny „Anuluj” (`btn`) · „Zapisz zmianę” (`btnp`); radio jak `input[type=radio]` z `coss.css` (odłożone 2a Task 4). Przy usuwaniu serii ten sam układ z tytułem „Usuwasz blok, który się powtarza”, dopiskiem „Zadania z odhaczonych wystąpień nie przepadają.” i `btnd` „Usuń” (CMDeleteBlock z `cykliczny`).
- [ ] Testy: aktualizacja formatu daty, nagłówek z „Anuluj”/„Zapisz”, dodawanie i usuwanie zadania bez zmian.
- [ ] Commit: `feat(telefon): arkusz bloku według CMBlockSheet`.

## Task 4: Szczegóły bloku, nowy wpis, nowa kategoria, dzień w liczbach

**Files:** `src/features/calendar/block-popover.tsx` (gałąź telefonu) albo nowy `mobile/m-block-detail.tsx` (+ test), `src/features/calendar/new-entry-popover.tsx` (gałąź telefonu, + test), kod okna nowej kategorii (`grep -rn "Nowa kategoria" src`), `mobile/m-calendar-day.tsx`.

- [ ] Szczegóły bloku na telefonie według CMBlockDetail: arkusz od dołu (jeden ✕), plakietka kategorii (tło/ramka/kropka koloru), tytuł 22/600, „dzień · od–do · czas” muted, reguła powtarzania `.hint`; „Zadania · X z N” — karta z checkboxami `cbx` (odhaczone przekreślone, muted) i wierszem „Dodaj zadanie…”; „Notatka”; stopka 2 kolumny „Usuń” (`btndo`) · „Edytuj” (`btn`). `Progress` i checkboxy w tokenach COSS, nie czarne (odłożone Etap 1 Task 8). Stuknięcie bloku w dniu/tygodniu/miesiącu otwiera ten arkusz.
- [ ] FAB i „Nowy blok” w nagłówku tygodnia otwierają na telefonie arkusz „Nowy wpis” według CMNewEntry (karta z trzema wierszami 64 px: Blok · Bieg · Trening siłowy, z awatarem ikony, opisem `.hint` i chevronem; „Anuluj” `btng`). Wiersze prowadzą tam, gdzie dziś prowadzi `new-entry-popover` na webie. Stuknięcie pustego miejsca na osi dnia też otwiera „Nowy wpis”.
- [ ] Nowa kategoria na telefonie według CMCategorySheet: arkusz z nagłówkiem „Anuluj · Nowa kategoria · Dodaj”, pole „Nazwa” (błąd „Nazwa nie może być pusta.”), siatka 4×2 kolorów (zajęte wyblakłe), „Podgląd” bloku z paskiem koloru.
- [ ] Dzień: pod wierszem daty pasek „Zaplanowane X · wolne (8–20) Y · zadania A/B” (12 px muted, `num`), liczone z danych dnia.
- [ ] Testy zachowania; e2e mobile przy zmianie ról/tekstów.
- [ ] Commit: `feat(telefon): szczegóły bloku, nowy wpis i kategoria według CM`.

## Task 5 (koordynator): przegląd, CI, scalenie, dziennik

**Files:** `docs/superpowers/plans/2026-11-24-telefon-kalendarz.md` (kopia), `odlozone.md`, dziennik, `stan-projektu.md`, `e2e/visual.spec.ts`.

- [ ] **Przed Task 1:**
  - gałąź z `main` po scaleniu fundamentu;
  - kopia planu, commit `docs(telefon): plan kalendarza`;
  - dziennik.
- [ ] `visual.spec.ts`:
  - w teście kalendarza dopisz do tytułu makiety `CMCalendarDay, CMCalendarWeek, CMCalendarMonth, CMBlockSheet`;
  - zrzut otwartego arkusza kategorii na telefonie.
- [ ] Recenzja każdego zadania: porównanie z zrzutami makiet (podgląd Vercel gałęzi na koncie testowym z blokami), cele 44 px, web bez zmian.
- [ ] Przegląd gałęzi, CI zielone, scalenie według zasad serii.
- [ ] `odlozone.md`: uwagi „kalendarz” oznacz jako naprawione. Dziennik, `stan-projektu.md` („W toku: pakiet dzis”).
- [ ] „Do decyzji”: różnice, których makieta nie rozstrzyga (np. liczba kropek w miesiącu przy wielu blokach), z kosztem pomyłki.
