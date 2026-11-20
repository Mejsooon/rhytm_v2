# COSS UI — Etap 2a (Kalendarz) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moduł Kalendarz na webie wygląda dokładnie jak makiety COSS (tydzień, dzień, miesiąc, podgląd odnowienia, okna bloku, zakresu i kategorii) i domyka drobiazgi odłożone z Etapu 1.

**Architecture:** Fundamenty z Etapu 1 są już na main:
- tokeny i cienie: `shadow-btn`, `shadow-card`, `shadow-focus`, `shadow-focus-inset`, `shadow-halo`, `destructive-strong`,
- kontrolki z `@/components/controls`,
- ModuleHeader (sam tytuł bez `webParent`),
- wspólne dymki bloku i okno usuwania.

Ten etap przestylowuje wyłącznie widoki i okna kalendarza według makiet. Zmienia tylko wygląd, nie dane ani przepływy.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, radix-ui, lucide-react, Vitest + Testing Library, Playwright (e2e tylko w CI).

**Spec:** `docs/superpowers/specs/2026-11-20-coss-ui-design.md` (Etap 2, moduł Kalendarz)

## Global Constraints

- **Makiety są wiążące** (`docs/design/mockups/`):
  - widoki: `CCalendar.dc.html` (tydzień + dymek), `CCalendarDay.dc.html`, `CCalendarMonth.dc.html`, `CCalendarRenewal.dc.html` (podgląd odnowienia subskrypcji),
  - okna: `CBlockDialog.dc.html`, `CScopeDialog.dc.html`, `CCategoryDialog.dc.html`, `CDeleteBlockDialog.dc.html`,
  - arkusz `coss/coss.css` odwzorowywany 1:1.
  - Podgląd makiet: `PW_CHANNEL=chrome pnpm mockups:shots <Nazwa>`.
- **Funkcjonalnie nic się nie zmienia:** dane, teksty, stany, przepływy, role ARIA, etykiety, przeciąganie i zmiana rozmiaru bloków. Różnice funkcjonalne makieta–aplikacja zgłaszasz w raporcie w sekcji „Do decyzji” i nie wprowadzasz ich.
- **Kolory:**
  - Kolory UI wyłącznie z tokenów (tabela w `src/app/globals.css`). `node scripts/coss-kolory.mjs --check` nie może pokazać nowych pozostałości.
  - Kolory danych (kategorie, subskrypcje) zostają z danych.
  - Blok: tło `${kolor}12`, ramka `1px solid ${kolor}4d`, bez paska po lewej. Zaznaczenie to pierścień `0 0 0 2px #fff, 0 0 0 4px ${kolor}66`.
  - Bloki planowane i odnowienia subskrypcji: ramka przerywana jak w makietach.
- **Konwencje z Etapu 1:**
  - fokus: `focus-visible:shadow-focus outline-none` (w siatkach `shadow-focus-inset`),
  - wyłączony stan: `opacity-[.64] cursor-not-allowed`,
  - pola: `FIELD`, menu: `MENU_*` + `ActionPopover className="p-1"`,
  - `cn` to twMerge, więc klasy nadpisujące idą na końcu.
- **Telefon (`max-[799px]:`, `mobile/`):** układ bez zmian (Etap 3), cele dotykowe ≥ 44 px zostają.
- **Bez nowych bibliotek.** Płaski kod bez helperów rozrzuconych po plikach, komentarze po polsku. API komponentów wolno tylko rozszerzać.
- **Testy:** `pnpm test`, `pnpm typecheck` i `pnpm lint` lokalnie, e2e w CI (`gh run list --branch feat/coss-kalendarz -L1`; przy limitach infrastruktury `gh run rerun --failed`). Asercje klas aktualizujesz, testów zachowania nie zmieniasz.
- **Git:** commity tylko na `feat/coss-kalendarz`. Trailer każdego commita: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` oraz `Claude-Session: https://claude.ai/code/session_01WRp6JuSYwef6J2Ypw1fKow`.

## Review Focus

1. **Zaznaczony blok z fokusem klawiatury:** pierścień zaznaczenia nie może zasłonić fokusu. Fokus ma być widoczny także na zaznaczonym bloku, w siatce kalendarza i w planie Dziś. Test: Task 2.
2. **Przeciąganie, tworzenie i zmiana rozmiaru po restylu:** uchwyty i obszary trafienia nie mogą się zmniejszyć, a podgląd „Nowy blok · …” zostaje. Test: Task 2.
3. **Długie tytuły i krótkie bloki (≤ 1 h):** w widoku dnia jedna linia z wielokropkiem, w tygodniu bez rozjeżdżania. Test: Task 2.
4. **Miesiąc z wieloma blokami w dniu:** „+N więcej” albo dotychczasowe przepełnienie działa i nie wychodzi poza komórkę. Test: Task 3.
5. **Przyciski zadań w dymku na urządzeniu dotykowym ≥ 800 px:** ⋯ i × chowają się tylko tam, gdzie jest hover (`@media (hover: hover)`). Test: Task 4.

---

### Task 1: Nagłówek kalendarza, filtry kategorii i panel dnia

**Files:**
- Modify: `src/features/calendar/calendar-header.tsx`, `category-filters.tsx`, `day-side.tsx`, `calendar-view.tsx` (tylko układ web i klasy)
- Test: istniejące testy tych plików (aktualizacja asercji klas)

**Interfaces:**
- Consumes: `ModuleHeader`, `Segment`, `Button`, `Chip`, `Checkbox`, `Switch`, `StatusBadge`, `Card*`, `Kbd` z `@/components/controls`.
- Produces: bez zmian w API.

**Wzorzec:** pasek nagłówka, nawigacja dat, przełącznik Dzień/Tydzień/Miesiąc (`.seg`), filtry kategorii i panel boczny dnia według `CCalendar.dc.html` i `CCalendarDay.dc.html`. Moduł ma sam tytuł „Kalendarz” (decyzja z Etapu 1).

- [ ] **Step 1:** zaktualizuj asercje klas w testach tych plików pod wygląd z makiet. Oczekiwane: FAIL.
- [ ] **Step 2: Przestyluj** pliki według makiet. Porównaj z `pnpm mockups:shots CCalendar CCalendarDay` oraz prawdziwym widokiem (tymczasowa trasa dev, usunięta przed commitem).
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint`. Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat(coss): nagłówek, filtry i panel dnia kalendarza jak w makietach`.

### Task 2: Siatka tygodnia i dnia

**Files:**
- Modify: `src/features/calendar/time-grid.tsx`, `src/features/today/day-plan.tsx` (tylko fokus zaznaczonego bloku)
- Test: `src/features/calendar/time-grid.test.tsx`, `src/features/today/day-plan.test.tsx`

**Interfaces:**
- Consumes: tokeny, `shadow-focus`.

**Wzorzec:** `CCalendar.dc.html` (tydzień) i `CCalendarDay.dc.html` (dzień):
- linie godzin i nagłówki dni (dziś wyróżniony jak w makiecie),
- bloki według reguły z Global Constraints, bloki planowane z ramką przerywaną,
- linia „teraz” `#ef4444` z etykietą `bg-destructive-strong`,
- podgląd tworzenia i przenoszenia jak w CToday.

- [ ] **Step 1: Testy:**
  - `time-grid.test.tsx` `"blok tygodnia bez paska, ramka 4d"`: dla bloku z kolorem `#3b82f6` `style` zawiera `#3b82f612` i `1px solid #3b82f64d`, a `boxShadow` nie zawiera `inset`.
  - `"zaznaczony blok ma fokus i pierścień"`: zaznaczony blok ma `boxShadow` z `${kolor}66` i klasę dającą fokus niezależny od `boxShadow`, np. `focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2`.
  - Ta sama asercja fokusu w `day-plan.test.tsx` dla zaznaczonego bloku.
  - `"krótki blok w widoku dnia w jednej linii"`: istniejący test zostaje zielony.
- [ ] **Step 2:** `pnpm vitest run src/features/calendar src/features/today`. Oczekiwane: FAIL.
- [ ] **Step 3: Przestyluj** `time-grid.tsx`. W obu plikach dodaj fokus na blokach, który nie koliduje z `boxShadow` zaznaczenia: `outline` z offsetem w miejsce `shadow-focus` na samych blokach. Obszary trafienia, uchwyty zmiany rozmiaru i progi tygodnia (`czas < 60`) bez zmian.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint`. Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(coss): siatka tygodnia i dnia jak w makietach, fokus zaznaczonego bloku`.

### Task 3: Miesiąc i podgląd odnowienia

**Files:**
- Modify: `src/features/calendar/month-grid.tsx` oraz pliki podglądu odnowienia subskrypcji w kalendarzu (znajdź przez `grep -rn "odnowien" src/features/calendar`)
- Test: testy tych plików

**Wzorzec:**
- `CCalendarMonth.dc.html`: komórki dnia, numer dnia, dziś wyróżniony.
- Chipy bloków: tło `${kolor}14`, ramka `1px solid ${kolor}4d`, padding 2px 6px, bez paska; zaznaczony ma pierścień `0 0 0 2px ${kolor}66`.
- Chipy subskrypcji: przerywane.
- `CCalendarRenewal.dc.html`: podgląd odnowienia.

- [ ] **Step 1: Test** w `month-grid.test.tsx` `"chip bloku w miesiącu bez paska"`: `style` z `${kolor}14` i ramką `4d`, `boxShadow` bez `inset`. Przepełnienie dnia (istniejący mechanizm) pozostaje zielone. Pozostałe asercje klas aktualizujesz.
- [ ] **Step 2:** `pnpm vitest run src/features/calendar`. Oczekiwane: FAIL.
- [ ] **Step 3: Przestyluj** według makiet.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint`. Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(coss): miesiąc i podgląd odnowienia jak w makietach`.

### Task 4: Okna kalendarza i drobiazgi z Etapu 1

**Files:**
- Modify:
  - `src/features/calendar/block-dialog.tsx`, `scope-dialog.tsx`, `src/features/categories/category-dialog.tsx`, `src/features/calendar/block-popover.tsx` (tylko media hover)
  - `src/components/controls/chip.tsx`, `stepper.tsx`
- Test: `block-dialog.test.tsx`, `scope-dialog.test.tsx`, `category-dialog.test.tsx`, `chip.test.tsx`, `stepper.test.tsx`, test dymku bloku

**Wzorzec:** `CBlockDialog.dc.html`, `CScopeDialog.dc.html`, `CCategoryDialog.dc.html` (podgląd bloku według reguły bloku). Okno usuwania (`CDeleteBlockDialog`) jest już zrobione, tylko sprawdź zgodność.

**Drobiazgi z Etapu 1:**

| element | zmiana |
|---|---|
| `Chip` | wyłączony + wybrany nie zmienia tła po najechaniu; zamiast `disabled:hover:bg-white` użyj `enabled:hover:…` dla każdego stanu |
| `Stepper` na telefonie | ramka z `overflow-hidden` nie może ucinać fokusu przycisków; użyj `shadow-focus-inset` na przyciskach albo zaokrąglenia bez `overflow-hidden` |
| ⋯ / × w `BlockDetails` | chowanie tylko pod `[@media(hover:hover)]:` (np. `min-[800px]:[@media(hover:hover)]:opacity-0`), żeby na tablecie bez myszy były widoczne |

- [ ] **Step 1: Testy:**
  - `chip.test.tsx`: `"wyłączony wybrany chip nie zmienia tła po najechaniu"`, czyli brak klasy `disabled:hover:bg-white` i obecność `enabled:hover:` dla tła.
  - `stepper.test.tsx`: przyciski na telefonie mają `focus-visible:shadow-focus-inset`.
  - Test dymku: przyciski zadań mają klasę z `[@media(hover:hover)]`.
  - Asercje klas okien zaktualizuj pod makiety.
- [ ] **Step 2:** `pnpm vitest run src/components/controls src/features/calendar src/features/categories`. Oczekiwane: FAIL.
- [ ] **Step 3: Przestyluj** okna i wprowadź drobiazgi.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS, bez nowych pozostałości.
- [ ] **Step 5: Commit** `feat(coss): okna kalendarza jak w makietach + poprawki kontrolek z Etapu 1`.

### Task 5: Weryfikacja gałęzi

- [ ] **Step 1:** `git push` i zielone CI (`gh run list --branch feat/coss-kalendarz -L1`).
- [ ] **Step 2:** zbierz sekcje „Do decyzji” z raportów do wiadomości dla Mejsona, razem z linkiem do podglądu Vercel. Bez merge.
