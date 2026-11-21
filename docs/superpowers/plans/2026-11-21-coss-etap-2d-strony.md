# COSS UI — Etap 2d (Strony) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moduł Strony na webie wygląda dokładnie jak makiety COSS: wybór szablonu nowej strony, pusta strona z edytorem bloków, strony-tabele (Subscriptions, Books, Projects, Websites) z kartami i wierszami, menu kolumny, okno „+ Pole” i filtr.

**Architecture:** Fundamenty są na main: tokeny, kontrolki `@/components/controls`, ModuleHeader, DatePicker/TimePicker, „Anuluj” ghost, ✕ ghost 28 px, zielony `Progress`. Menu strony w sidebarze (`page-menu.tsx`) i wybór ikony (`icon-picker.tsx`) zostały przestylowane w Etapie 1 i zostają bez zmian. Ten etap zmienia wyłącznie wygląd widoków i okien w `src/features/pages`, bez katalogów `mobile/`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, radix-ui, lucide-react, Vitest + Testing Library, Playwright (e2e w CI).

**Spec:** `docs/superpowers/specs/2026-11-20-coss-ui-design.md` (Etap 2, moduł Strony)

## Global Constraints

- **Makiety są wiążące i odwzorowujemy je 1:1.** Są w `docs/design/mockups/` (arkusz `coss/coss.css`):
  - CNewPage, CEmptyPage, CMain, CBooks, CProjects, CWebsites, CAddField, CColumnMenu, CFilterPopover (pliki `.dc.html`);
  - podgląd: `PW_CHANNEL=chrome pnpm mockups:shots <Nazwa>`.
- **Funkcjonalnie nic się nie zmienia.** Dane, teksty, stany, przepływy, role ARIA i etykiety zostają. Elementy i teksty, które są w makiecie, a nie ma ich w aplikacji, wpisujesz do raportu w sekcji „Do decyzji” i nie dodajesz.
- **Kolory UI wyłącznie z tokenów.** `node scripts/coss-kolory.mjs --check` pokazuje dziś tylko 2 pozostałości w `sport/mobile/m-sport` i ma tak zostać. Kolory danych (kolory opcji pól wyboru i etykiet wybierane przez użytkownika) zostają jak są.
- **Szerokość.** Widoki stron są na pełną szerokość obszaru treści, bez limitu `max-w-[1100px]`, jak w makietach.
- **Konwencje z Etapów 1–2c:**
  - fokus: `focus-visible:shadow-focus outline-none`; na elementach z cieniem zaznaczenia w `style` fokus to obrys `focus-visible:outline-solid outline-2 outline-offset-2 outline-ring`;
  - wyłączone: `opacity-[.64]`;
  - pola: `FIELD`;
  - menu: `MENU_*` oraz `ActionPopover className="p-1"`;
  - odznaki: `StatusBadge`; okna: `FormDialog`;
  - tabela jak `.tbl/.th/.td` z coss.css: nagłówek 40 px, wiersz 44 px, ostatni wiersz bez dolnej linii;
  - `cn` to twMerge, więc nadpisania klas idą na końcu.
- **Telefon** (`max-[799px]:` i katalogi `mobile/`): układ zostaje bez zmian, zrobi go Etap 3. Cele dotykowe zostają ≥ 44 px, nie mniejsze niż dziś.
- **Bez nowych bibliotek.** Kod płaski, bez helperów skaczących po plikach, komentarze po polsku. API komponentów wolno tylko rozszerzać.
- **Testy:**
  - lokalnie `pnpm test`, `pnpm typecheck` i `pnpm lint`;
  - e2e uruchamia CI (`gh run list --branch feat/coss-strony -L1`);
  - asercje klas aktualizujesz razem ze zmianą, testów zachowania nie zmieniasz.
- **Git:** commity tylko na `feat/coss-strony`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` oraz `Claude-Session: https://claude.ai/code/session_01WRp6JuSYwef6J2Ypw1fKow`.

## Review Focus

1. **Tabela z wieloma kolumnami i długimi wartościami:** przewija się poziomo, wartości skracają się wielokropkiem, a nagłówki nie łamią się na dwie linie. Test: Task 3.
2. **Pusta strona:** kursor w pierwszym bloku, menu „/” otwiera się i zamyka klawiaturą (strzałki, Enter, Esc) tak jak dziś. Test: Task 2.
3. **Menu kolumny i filtr przy prawej krawędzi:** otwierają się do środka i nie wychodzą poza widok. Test: Task 4 i Task 5.
4. **„+ Pole” z kolizją nazwy albo pustą nazwą:** komunikat błędu jak dziś, pod polem, czytany przez `aria-describedby`. Test: Task 4.
5. **Strona-szablon bez wierszy i bez przypiętych kart:** sensowny stan pusty, bez pustych ramek. Test: Task 3.

---

### Task 1: Nowa strona (wybór szablonu) i okno usuwania strony

**Files:**
- Modify: `src/features/pages/new-page-view.tsx`, `src/features/pages/delete-page-dialog.tsx`
- Test: istniejące testy tych plików

**Wzorzec:** `CNewPage.dc.html`:
- nagłówek (topbar z okruszkami),
- siatka kart szablonów z ikoną, nazwą, opisem i podglądem kolumn,
- karta „Pusta strona”,
- okno potwierdzenia w stylu `.dlg`.

Okno usuwania strony (`delete-page-dialog`) robisz w tym samym stylu `.dlg` co okno usuwania w Sporcie (`src/features/sport/delete-session-dialog.tsx`).

- [ ] **Step 1:** zaktualizuj asercje klas i dodaj test `"karta szablonu ma fokus z shadow-focus i hover"`. Uruchom `pnpm vitest run src/features/pages`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2:** przestyluj według makiety. Porównaj z `pnpm mockups:shots CNewPage` i z widokiem z tymczasowej trasy dev, którą usuwasz przed commitem.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4:** commit `feat(coss): strony — nowa strona i usuwanie jak w makiecie`.

### Task 2: Pusta strona — edytor bloków

**Files:**
- Modify w `src/features/pages/editor/`: `editor-view.tsx`, `text-block.tsx`, `todo-block.tsx`, `slash-menu.tsx`, `command-line.tsx`, `type-change-dialog.tsx`
- Test: istniejące testy tych plików

**Wzorzec:** `CEmptyPage.dc.html`:
- nagłówek strony z ikoną (PageIcon i IconPicker bez zmian w ich środku) i tytułem,
- bloki tekstu i zadań,
- wiersz z podpowiedzią „Wpisz „/””,
- menu „/” jako `.pop` z `MENU_*`,
- okno zmiany typu jako `.dlg`.

- [ ] **Step 1:** zaktualizuj asercje klas i dodaj test `"menu „/” ma klasy .pop i obsługuje strzałki/Enter/Esc"` (zachowanie bez zmian). Uruchom `pnpm vitest run src/features/pages/editor`. Oczekiwane: FAIL na nowych asercjach klas.
- [ ] **Step 2:** przestyluj według makiety.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4:** commit `feat(coss): strony — pusta strona i edytor bloków jak w makiecie`.

### Task 3: Strony-tabele — nagłówek, przypięte karty, tabela, wiersze

**Files:**
- Modify w `src/features/pages/table/`: `template-page-view.tsx`, `pinned-cards.tsx`, `summary-cell.tsx`, `row-preview.tsx`, `row-edit.tsx`
- Modify w `src/features/pages/editor/`: `table-block.tsx`, `cell-editor.tsx`
- Test: istniejące testy tych plików

**Wzorzec:** `CMain.dc.html` (Subscriptions), `CBooks.dc.html`, `CProjects.dc.html`, `CWebsites.dc.html`:
- topbar z akcjami,
- przypięte karty podsumowań,
- tabela `.tbl` z nagłówkami kolumn (ikona typu, nazwa), komórkami według typu (tekst, liczba `tabular-nums` do prawej, data, wybór jako odznaka, checkbox, link) i wierszem podsumowania,
- podgląd i edycja wiersza jako `.dlg`/`.pop` według makiet.

- [ ] **Step 1:** zaktualizuj asercje klas. Dodaj testy:
  - `"długa wartość komórki ma truncate, a tabela przewija się poziomo"`,
  - `"strona-szablon bez wierszy i kart pokazuje stan pusty bez pustych ramek"`.

  Uruchom `pnpm vitest run src/features/pages`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2:** przestyluj według makiet. Porównaj z co najmniej CMain i CBooks.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4:** commit `feat(coss): strony — tabele, karty i wiersze jak w makietach`.

### Task 4: Menu kolumny, właściwości kolumny i „+ Pole”

**Files:**
- Modify: `src/features/pages/table/column-menu.tsx`, `src/features/pages/editor/column-popover.tsx`, `src/features/pages/table/add-field-dialog.tsx`
- Test: istniejące testy tych plików

**Wzorzec:**
- `CColumnMenu.dc.html`: menu `.pop` z `MENU_*`, podmenu typu i separatory;
- `CAddField.dc.html`: okno `.dlg` z siatką typów pól (ikona i nazwa jako przyciski z `aria-pressed`), polem nazwy (`FIELD`) i stopką.

- [ ] **Step 1:** zaktualizuj asercje klas. Dodaj testy:
  - `"menu kolumny przy prawej krawędzi otwiera się do środka"`,
  - `"„+ Pole”: błąd nazwy pod polem z aria-describedby"`. Jeśli zachowanie już istnieje, test ma przechodzić. Jeśli nie, nie dodawaj zachowania, tylko wpisz je do „Do decyzji”.

  Uruchom `pnpm vitest run src/features/pages`. Oczekiwane: FAIL na nowych asercjach klas.
- [ ] **Step 2:** przestyluj według makiet.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4:** commit `feat(coss): strony — menu kolumny i „+ Pole” jak w makietach`.

### Task 5: Filtr

**Files:**
- Modify: `src/features/pages/table/filter-popover.tsx`
- Test: `filter-popover.test.tsx`

**Wzorzec:** `CFilterPopover.dc.html`: dymek `.pop` z wierszami warunków (kolumna, operator, wartość jako `FIELD`/`DatePicker`), „+ Warunek”, „Wyczyść” i licznikiem filtrów na przycisku.

- [ ] **Step 1:** zaktualizuj asercje klas i dodaj test `"filtr przy prawej krawędzi otwiera się do środka"`. Uruchom `pnpm vitest run src/features/pages`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2:** przestyluj według makiety.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4:** commit `feat(coss): strony — filtr jak w makiecie`.

### Task 6: Weryfikacja gałęzi

- [ ] **Step 1:** `git push` i zielone CI.
- [ ] **Step 2:** zbierz sekcje „Do decyzji” z raportów w jedną wiadomość dla Mejsona, z rekomendacjami i linkiem do podglądu Vercel. Bez merge.
