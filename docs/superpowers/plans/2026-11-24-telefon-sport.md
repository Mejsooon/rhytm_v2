# Etap 3 / pakiet 5: Sport na telefonie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Sport na telefonie wygląda jak CMSport, trening siłowy jak CMGym, a nowy bieg jak CMRunNew. Szablony i szczegóły ćwiczenia na telefonie dostają styl CM (bez osobnych makiet). Logika bez zmian.

**Spec:** `docs/superpowers/specs/2026-11-24-telefon-design.md`: inwentaryzacja (CMSport, CMGym, CMRunNew), uwagi „sport”, T18. Czytaj w całości przed każdym zadaniem.

**Makiety (wiążące):** `docs/design/mockups/CMSport.dc.html`, `CMGym.dc.html`, `CMRunNew.dc.html`. Od 24.11 szablony i ćwiczenie mają własne makiety telefonu: `CMWorkoutTemplates.dc.html` (karty szablonów z ćwiczeniami i dniami, „Edytuj” / „Rozpocznij”, arkusz „Nowy szablon”) i `CMExerciseDetail.dc.html` (szacowany 1RM z wykresem 8 tyg. i segmentem Szac. 1RM · Objętość, „Rekordy”, „Historia”). CMGym ma dodatkowo nazwę ćwiczenia jako link do szczegółów, „Usuń ćwiczenie”, dopisek „mc = masa ciała…” i „Zapisz jako szablon”; CMRunNew ma wiersz „Kcal (z wagi w profilu)”. Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots CMSport CMGym CMRunNew`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4 (`@utility` `m-*`), kontrolki `@/components/controls`, Vitest, Playwright (CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod;
  - polskie teksty i komentarze;
  - commity na `feat/telefon-sport` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- Makiety wygrywają z planem. Cele dotykowe ≥ 44 px. Web bez zmian.
- Kolory skali trudności i paska km to dane z makiet (`#15803d`, `#f59e0b`, `#ef4444`). Pozostałe hexy zamień na tokeny. Usuń `font-mono` i wersaliki.
- Decyzje z Etapu 2c zostają: lista „Zaplanowane”, „Miesiąc” = 4 tygodnie, opcje „Trening” (komentarze `*[Claude]*` w `m-sport.tsx`).
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint`. e2e telefonu (`e2e/sport.spec.ts` mobile) aktualizuj przy zmianie tekstu albo roli.

## Task 1: Ekran Sport (CMSport)

**Files:** `src/features/sport/mobile/m-sport.tsx` (+ `m-sport.test.tsx`), `src/features/sport/sport-view-mobile.test.tsx`.

- [ ] `m-head`: `.lbl` „Tydzień 46 · 9–15.11”, `m-title` „Sport”, akcja „Nowa aktywność” (44 px, otwiera to co dziś „+”).
- [ ] `Segment` „Zakres” (Tydzień | Miesiąc), 40 px, na całą szerokość.
- [ ] Karta „Bieganie”:
  - `.lbl`, liczba km + `muted` „/ cel km”;
  - `Progress` z wypełnieniem `#f59e0b`, pill (tylko przy włączonym celu km, jak dziś);
  - trzy kolumny `.lbl` + liczba: Biegi, Śr. tempo, Siłownia N×.
- [ ] Karta „Kilometry”: `card-t` + `muted` opis wybranego słupka, słupki-przyciski z `aria-label`, oś dni `.hint`.
- [ ] Przyciski w rzędzie: „Bieg” (`btnp`), „Trening” (`btn`, istniejące menu opcji), „Szablony” (`btn`), 44 px.
- [ ] „Zaplanowane” (gdy jest) i „Ostatnie”: `card-t` + `Card` z `m-row` (ikona rodzaju, tytuł, `.hint` daty i parametrów, chevron).
- [ ] Commit: `feat(telefon): Sport według CMSport`.

## Task 2: Trening siłowy (CMGym)

**Files:** `src/features/sport/mobile/m-gym.tsx` (+ test).

- [ ] `m-head`:
  - „Wstecz” (→ `/sport`);
  - w środku `m-title` nazwy + `.hint` „N/M serii · mm:ss”;
  - „Zakończ” (`btng`).

  Pod nagłówkiem `Progress` serii na całą szerokość.
- [ ] Ćwiczenie w `Card`:
  - nazwa 500 + `StatusBadge` outline poprzedniego wyniku;
  - nagłówki `set-grid` `.lbl` „Seria · kg · Powt.” (zwykła wielkość liter, różnica M → CM);
  - wiersze: `StatusBadge` secondary z numerem, kg, powtórzenia (pola 44 px jak dziś), `cbx m-hit`;
  - „+ Dodaj serię” (`btng`).
- [ ] „Dodaj ćwiczenie” (`btn` na całą szerokość). Kolumny `set-grid` z makiety.
- [ ] Commit: `feat(telefon): trening siłowy według CMGym`.

## Task 3: Nowy bieg (CMRunNew)

**Files:** `src/features/sport/mobile/m-run-new.tsx` (+ test).

- [ ] `m-head`: „Anuluj” (`btng`) · `m-title` „Nowy bieg”/„Edytuj bieg” · „Zapisz” (`btnp`).
- [ ] „Rodzaj”: `.lbl` + chipy `m-hit` z `aria-pressed`.
- [ ] Karta z `m-row`: „Dystans” (`m-step`, „N km”), „Czas” (`m-step`), „Tempo (liczone)” muted z wartością „m:ss /km”.
- [ ] „Trudność · opis”: przyciski `effort` 1–10 w kolorach skali z `renderVals` makiety (zielony → `#f59e0b` → `#ef4444`, tło `kolor+18`, wybrany pełny kolor z białym tekstem).
- [ ] Karta: „Dzień” jako **dwa** `igroup` (data „nd 15.11.2026” i godzina „16:00”, otwierają te same wybieraki co dziś) oraz „Pokaż w kalendarzu głównym” (`Switch` `m-hit`).
- [ ] „Notatka”: `textarea` 16 px, 3 wiersze, placeholder „Jak poszło?”.
- [ ] Commit: `feat(telefon): nowy bieg według CMRunNew`.

## Task 4: Szablony i szczegóły ćwiczenia na telefonie

**Files:** `src/features/sport/templates-list.tsx`, `template-editor.tsx`, `exercise-detail.tsx` (tylko klasy `max-[799px]:`), ich testy; read odłożone 2c („kafelki exercise-detail jako osobne karty, odstępy w template-editor/templates-list — zweryfikować z CM*”).

- [ ] Na telefonie nagłówek przez `ModuleHeader` z `phoneBack` (→ `/sport`), treść `px-4 py-4 gap-4`, karty na całą szerokość, wiersze listy `m-row`, przyciski 44 px.
- [ ] Kafelki w `exercise-detail`: na telefonie siatka 2 kolumn w jednej karcie z liniami 1 px (`m-stats`), jak kafelki CMToday. Web bez zmian.
- [ ] Testy: web bez zmian klas, telefon nowe klasy.
- [ ] Commit: `feat(telefon): szablony i ćwiczenie w stylu CM`.

## Task 5 (koordynator): przegląd, CI, scalenie, dziennik

- [ ] **Przed Task 1:** gałąź `feat/telefon-sport` z `main`, kopia planu, dziennik.
- [ ] `visual.spec.ts`: test Sportu z makietami `CMSport, CMRunNew, CMGym` w tytule, zrzut szablonów na telefonie.
- [ ] Recenzja: zrzuty vs makiety (podgląd Vercel z biegami i treningiem), cele 44 px, web bez zmian.
- [ ] Przegląd gałęzi, CI zielone, scalenie według zasad serii. `odlozone.md` (2c: układ telefonu Sportu) oznacz. Dziennik, `stan-projektu.md`.
- [ ] „Do decyzji”: wygląd szablonów i ćwiczenia na telefonie bez makiety CM (koszt niski).
