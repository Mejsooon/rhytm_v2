# Etap 3 / pakiet 3: Dziś na telefonie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Dziś na telefonie wygląda jak CMToday, a szybkie dodawanie jak CMQuickAdd. Obowiązuje reguła projektu Dziś: zadania tylko w blokach, bez rodzaju „Zadanie” i bez „Bez daty”.

**Spec:** `docs/superpowers/specs/2026-11-24-telefon-design.md`: inwentaryzacja (CMToday, CMQuickAdd), „Konflikty makiet” punkty 1 i 3, decyzja T5. Także `docs/superpowers/specs/2026-11-24-dzis-design.md` punkt B. Czytaj w całości przed każdym zadaniem.

**Makiety (wiążące):** `docs/design/mockups/CMToday.dc.html`, `CMEmptyToday.dc.html` (nowe konto: pusty plan „Nie masz jeszcze bloków na dziś.” + „Dodaj pierwszy blok”, kafelek „Utwórz nowy nawyk”, „Ten tydzień” z zerami), `CMQuickAdd.dc.html`. Stuknięcie bloku w planie dnia otwiera szczegóły bloku z pakietu kalendarz (`m-block-detail.tsx`), jeśli Dziś ma do nich dostęp; inaczej to, co dziś. Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots CMToday CMQuickAdd`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4 (`@utility` `m-*`), kontrolki `@/components/controls`, Vitest, Playwright (CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod;
  - polskie teksty i komentarze;
  - commity na `feat/telefon-dzis` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- Makiety wygrywają z planem w wyglądzie. **Wyjątek:** reguła „zadanie zawsze w bloku” wygrywa z makietą (rodzaj „Zadanie” i chip „Bez daty” nie wracają).
- Cele dotykowe ≥ 44 px (checkboxy 16 px przez `m-hit`). Web bez zmian.
- Logika danych bez zmian (`useTodayStore`, `toggleTask`, `toggleHabit`, `quickWhenOptions`).
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint`. e2e telefonu (`e2e/today.spec.ts` mobile, `visual.spec.ts`) aktualizuj przy zmianie tekstu albo roli.

## Task 1: Ekran Dziś (CMToday)

**Files:** `src/features/today/mobile/m-today.tsx` (+ `m-today.test.tsx`), `src/features/today/today-view.tsx` (tylko sposób osadzenia telefonu, jeśli trzeba).

- [ ] Tło ekranu `#fafafa` na telefonie (`max-[799px]:bg-[#fafafa]` na kontenerze Dziś).
- [ ] Nagłówek przezroczysty, bez ramki:
  - `.hint` z datą „Niedziela · 15 listopada” (dzień tygodnia wielką literą, miesiąc w dopełniaczu z `MIESIACE_DOP`);
  - `m-title` „Dziś”;
  - po prawej link „Szukaj” (`/szukaj`, ikona 20) i link „Konto i ustawienia” z `Avatar` 32 px (zdjęcie albo inicjał), oba 44 px.
- [ ] Kafelki jako `m-stats`, każdy link `m-stat` z `.lbl` i `m-stat-v`:
  - Nawyki `x/y` → `/nawyki`;
  - Sen `h:mm h` → `/nawyki` (zakładka Sen, jeśli adres ją obsługuje);
  - Zadania `x/y` → `/kalendarz` (zadania dzisiejszych bloków);
  - Km w tyg. `km/cel` → `/sport`.

  Część „/y” i jednostki w `<span class="muted">` 14 px.
- [ ] „TERAZ” (tylko gdy trwa blok): `Card` z tłem `kolor+12` i ramką `kolor+4d`, `StatusBadge` success „TERAZ” + `.hint` „10:30–12:30 · zostało N min”, tytuł 18/600, lista zadań: wiersz 44 px, `cbx m-hit` z `role="checkbox"`, zrobione przekreślone `#8a8a8a`.
- [ ] „Plan dnia”:
  - `m-sec-h` z `card-t` i linkiem „Kalendarz” (muted, cel 44 px przez `py-3`);
  - wpisy jako `m-plan-block` z kolorem kategorii: godzina 44 px 12 muted, tytuł 500, `.hint` „2 h · Kategoria · x/y”;
  - zrobiony blok: szare tło `#a3a3a312`, przekreślony, „· zrobione”;
  - pusty plan: jak dziś („Plan dnia jest pusty”) w stylu `.hint`.
- [ ] „Nawyki”: `m-sec-h` z linkiem „Wszystkie”, `Card` z `m-row` 52 px: `cbx m-hit`, nazwa, `StatusBadge` outline z serią (np. „12 dni”, „2/4 tydz.”, „—”).
- [ ] Karta biegu jako link `Card` w wierszu: ikona 40 px w ramce ostrzegawczej, „Bieg o 16:00” 500, `.hint` „Cel tygodnia: jeszcze N km”, chevron `#a3a3a3`. Logika wyboru biegu bez zmian.
- [ ] FAB `m-fab` „Szybko dodaj”.
- [ ] Usuń stałe `ETYKIETA` (mono), `POLE_WYBORU` w starym stylu i nieużywane klasy.
- [ ] Testy: zachowanie bez zmian (odhaczanie zadań i nawyków, linki). Zaktualizuj asercje klas. Dodaj test daty w nagłówku i `aria-checked` checkboxów.
- [ ] Commit: `feat(telefon): Dziś według CMToday`.

## Task 2: Szybkie dodawanie (CMQuickAdd)

**Files:** `src/features/today/mobile/m-quick-add.tsx` (+ test), `src/features/today/model.ts` (tylko jeśli `quickWhenOptions` ma jeszcze „Bez daty”).

- [ ] Arkusz `FormDialog` z `phoneHeader="close"`: tytuł „Szybko dodaj”, `✕`.
- [ ] `Segment` „Rodzaj” na całą szerokość: **Blok · Bieg · Nawyk**, domyślnie Blok (reguła Dziś, T5).
- [ ] Pole `.fld` z etykietą zależną od rodzaju („Blok w kalendarzu”, „Bieg”, „Nawyk”) i placeholderami z makiety („Nazwa bloku, np. Nauka SQL”, „Np. 8 km spokojnie”, „Np. Woda 2 l”).
- [ ] „Kiedy”: `.lbl` + chipy 36 px w poziomym przewijaniu, `aria-pressed`. Bez „Bez daty” (sprawdź, że `quickWhenOptions` jej nie zwraca, i dodaj test).
- [ ] Wiersz `m-row` „Pełny formularz bloku (kategoria, zadania, powtarzanie)” / „Pełny formularz biegu (dystans, tempo)” z ikoną ołówka i chevronem; otwiera dzisiejsze pełne formularze.
- [ ] Stopka: `btnp` „Dodaj” na całą szerokość, `pb-7`.
- [ ] Testy: brak radia/przycisku „Zadanie”, domyślny Blok, brak chipu „Bez daty”, zachowanie dodawania bez zmian.
- [ ] Commit: `feat(telefon): szybkie dodawanie według CMQuickAdd`.

## Task 3 (koordynator): przegląd, CI, scalenie, dziennik

- [ ] **Przed Task 1:** gałąź `feat/telefon-dzis` z `main` po kalendarzu, kopia planu do `docs/superpowers/plans/2026-11-24-telefon-dzis.md`, dziennik.
- [ ] `visual.spec.ts`:
  - test Dziś: tytuł z makietami `CMToday, CMQuickAdd`;
  - zrzut telefonu z trwającym blokiem (zasiej blok obejmujący „teraz” w strefie Warszawy) i z otwartym szybkim dodawaniem.
- [ ] Recenzja: zrzuty vs makiety (podgląd Vercel gałęzi), cele 44 px, reguła „zadanie w bloku”.
- [ ] Przegląd gałęzi, CI zielone, scalenie według zasad serii.
- [ ] Dziennik, `stan-projektu.md` („W toku: pakiet nawyki”).
- [ ] „Do decyzji”: T5 (poprawka CMQuickAdd na kanwie).
