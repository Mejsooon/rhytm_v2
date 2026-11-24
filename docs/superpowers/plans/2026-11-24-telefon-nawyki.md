# Etap 3 / pakiet 4: Nawyki i sen na telefonie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** „Nawyki i sen” na telefonie wygląda jak CMHabits, szczegóły nawyku jak CMHabitDetail, arkusz nowego nawyku jak CMHabitNew, a wpis snu jak CMSleep. Logika bez zmian.

**Spec:** `docs/superpowers/specs/2026-11-24-telefon-design.md`: inwentaryzacja (CMHabits, CMHabitDetail, CMHabitNew, CMSleep), uwagi „nawyki”, decyzja T18. Czytaj w całości przed każdym zadaniem.

**Makiety (wiążące):** `docs/design/mockups/CMHabits.dc.html` (stany Nawyki i Sen), `CMHabitDetail.dc.html`, `CMHabitNew.dc.html`, `CMSleep.dc.html`. Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots CMHabits CMHabitDetail CMHabitNew CMSleep`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4 (`@utility` `m-*`), kontrolki `@/components/controls`, Vitest, Playwright (CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod;
  - polskie teksty i komentarze;
  - commity na `feat/telefon-nawyki` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- Makiety wygrywają z planem. Cele dotykowe ≥ 44 px. Web bez zmian.
- Kolory heatmapy i wykresu snu to dane. Bierz je z `renderVals` CMHabits (`shade`, `#bbe5cc`, `#86c99f`, `rgba(0,0,0,.05)`, `rgba(0,0,0,.12)`, pierścień `0 0 0 2px #262626`). Kolory UI zamień na tokeny.
- Usuń `font-mono` i wersaliki z plików telefonu nawyków.
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint`. e2e telefonu (`e2e/habits.spec.ts` mobile) aktualizuj przy zmianie tekstu albo roli.

## Task 1: Lista nawyków i sen (CMHabits)

**Files:** `src/features/habits/mobile/m-habits.tsx` (+ test), `src/features/habits/habits-view-mobile.test.tsx`.

- [ ] Nagłówek `m-head`: `.lbl` z datą („Niedziela · 15 listopada”), `m-title` „Nawyki i sen”, akcja „Nowy nawyk” (44 px).
- [ ] `Segment` „Widok” (Nawyki | Sen) na całą szerokość, 40 px.
- [ ] Nawyki:
  - karta postępu dnia według makiety (liczba `doneTxt` i `.hint` „Najdłuższa seria: … · N dni”). Jeśli dziś jest pierścień dnia, zostaje tylko wtedy, gdy makieta go ma; w przeciwnym razie układ z makiety;
  - lista w `Card`: `m-row` z `cbx m-hit` (odhacza dziś) i linkiem do szczegółów: nazwa, pod nią `.hint` częstotliwość **i osobno** `StatusBadge` secondary „seria N” (różnica M → CM);
  - „Ostatnie 4 tygodnie”: `card-t`, `.hint` z opisem wskazanej komórki, nagłówki dni `.lbl`, siatka 7×4 przycisków (`aria-label` dnia), legenda „mniej … więcej”.
- [ ] Sen: karty „Ostatnia noc” i „Średnio …” (`.lbl`, liczba z `muted` „h”, `.hint`), wykres 14/30 dni ze stuknięciem słupka, kolory słupków z makiety, „Dodaj wpis snu”. Kolejność i teksty z makiety.
- [ ] 15 hexów z pliku zamień według zasady z Global Constraints.
- [ ] Testy zachowania bez zmian. Popraw asercje klas i tekstu serii.
- [ ] Commit: `feat(telefon): nawyki i sen według CMHabits`.

## Task 2: Szczegóły nawyku (CMHabitDetail)

**Files:** `src/features/habits/mobile/m-habit-detail.tsx` (+ test), `src/features/habits/habit-month.tsx`, `habit-notes.tsx` (gałęzie telefonu), `src/features/habits/habit-detail-mobile.test.tsx`, `delete-habit-dialog.tsx` (już na `ConfirmDialog`).

- [ ] `m-head`: „Wstecz” (→ `/nawyki`), pusty środek, „Edytuj” (otwiera arkusz nawyku). Pod nagłówkiem `.lbl` „Codziennie · 20:00 przypomnienie” i `m-title` nazwy.
- [ ] Trzy karty liczb (Seria, Rekord, Skuteczn.) w siatce 3 kolumn: `.lbl` + liczba z makiety.
- [ ] Miesiąc w `Card`: `card-t` nazwy miesiąca, strzałki 44 px (`aria-disabled` na granicach), nagłówki dni, komórki według `renderVals` makiety, `.hint` podsumowania.
- [ ] `habit-month.tsx`: rozplecenie przeplecionych gałęzi telefonu (odłożone 2b Task 3). Wariant telefonu to osobny blok JSX w tym samym pliku, przełączany klasami. Web bez zmian (test porównujący klasy webu).
- [ ] „Notatki”: `card-t` + karty z `.hint` daty i tekstem.
- [ ] „Usuń nawyk”: `Button` destructive-outline na całą szerokość → `ConfirmDialog`.
- [ ] Commit: `feat(telefon): szczegóły nawyku według CMHabitDetail`.

## Task 3: Arkusze nowego nawyku i snu (CMHabitNew, CMSleep)

**Files:** `src/features/habits/mobile/m-habit-sheet.tsx`, `m-sleep-sheet.tsx` (+ testy).

- [ ] Oba przez `FormDialog`. Rodzaj nagłówka według makiety (`dlg-h` w CMHabitNew/CMSleep: „close” albo „actions”).
- [ ] CMHabitNew: pola i kolejność z makiety, `Segment` częstotliwości bez rozlewania (odłożone 2b Task 4), dni tygodnia jako chipy 36 px, przypomnienie (`Switch` `m-hit` + godzina).
- [ ] CMSleep: godziny przez `m-step`, jakość/nastrój jako `Segment`, notatka `textarea` 16 px.
- [ ] Usuń `font-mono`. Testy: zachowanie bez zmian.
- [ ] Commit: `feat(telefon): arkusze nawyku i snu według CM`.

## Task 4 (koordynator): przegląd, CI, scalenie, dziennik

- [ ] **Przed Task 1:** gałąź `feat/telefon-nawyki` z `main`, kopia planu do `docs/superpowers/plans/`, dziennik.
- [ ] `visual.spec.ts`: w teście nawyków makiety `CMHabits, CMSleep, CMHabitNew, CMHabitDetail` w tytule (zamiast M*), zrzut zakładki Sen.
- [ ] Recenzja według zrzutów makiet (podgląd Vercel z nawykami i snem), cele 44 px.
- [ ] Przegląd gałęzi, CI zielone, scalenie według zasad serii. `odlozone.md`: uwagi „nawyki” oznacz jako naprawione. Dziennik, `stan-projektu.md`.
- [ ] „Do decyzji”: rozbieżności (np. pierścień dnia vs karta postępu), z kosztem.
