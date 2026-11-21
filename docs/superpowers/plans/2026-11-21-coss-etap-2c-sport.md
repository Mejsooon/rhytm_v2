# COSS UI — Etap 2c (Sport) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moduł Sport na webie wygląda dokładnie jak makiety COSS:
- widok miesiąca z kafelkami metryk, wykresem, kalendarzem, dymkiem treningu, rekordem i tabelą ostatnich treningów,
- okno biegu,
- trening siłowy,
- szczegóły ćwiczenia,
- szablony treningów.

**Architecture:** Na main są już fundamenty z Etapów 1, 2a i 2b:
- tokeny i kontrolki `@/components/controls`, ModuleHeader (sam tytuł bez `webParent`),
- DatePicker i TimePicker, „Anuluj” jako ghost, ✕ okien jako ghost 28 px,
- zielony `Progress`, czerwone kółko „dziś” (w Sporcie już 22 px).

Ten etap zmienia wyłącznie wygląd widoków i okien w `src/features/sport` (bez `mobile/`) według makiet.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, radix-ui, lucide-react, Vitest + Testing Library, Playwright (e2e w CI).

**Spec:** `docs/superpowers/specs/2026-11-20-coss-ui-design.md` (Etap 2, moduł Sport)

## Global Constraints

- **Makiety są wiążące** i odwzorowujemy je 1:1. Leżą w `docs/design/mockups/`, razem z arkuszem `coss/coss.css`:
  - `CSport.dc.html`
  - `CRunDialog.dc.html`
  - `CGymLog.dc.html`
  - `CExerciseDetail.dc.html`
  - `CWorkoutTemplates.dc.html`

  Podgląd: `PW_CHANNEL=chrome pnpm mockups:shots <Nazwa>`.
- **Funkcjonalnie nic się nie zmienia:** dane, teksty, stany, przepływy, role ARIA i etykiety zostają. Elementy i teksty, które są w makiecie, a nie ma ich w aplikacji, trafiają do raportu w sekcji „Do decyzji” i nie są dodawane.
- **Kolory:**
  - Kolory UI wyłącznie z tokenów. `node scripts/coss-kolory.mjs --check` pokazuje dziś 3 pozostałości: `bg-[#404040]` w sport-view i 2 w `mobile/m-sport`. Pozostałość w sport-view ma zniknąć, mobilne zostają do Etapu 3.
  - **Bieg i siłownia** w widokach Sportu mają kolory z makiety CSport:
    - bieg `#f59e0b`, czyli token `warning`;
    - siłownia `#525252`.

    Dziś są tam `#c2410c` i `#404040` (stałe `BIEG` i `SILA` w month-calendar oraz legenda w sport-view). To kolory danych wykresu: trzymaj je w stałych w kodzie, tak jak teraz.
  - `SPORT_COLOR` w `model.ts`, czyli kategoria „Sport” w kalendarzu, zostaje bez zmian.
  - Wykresy SVG (record-card, exercise-detail, week-tiles):
    - linie siatki, osie i punkty jak w makiecie;
    - zielony rekordu `#15803d`, czerwony spadku `#b91c1c`;
    - kolory wpisane w atrybuty SVG są dozwolone, bo to wykres, a nie klasy UI.
- **Konwencje z Etapów 1, 2a i 2b:**
  - fokus: `focus-visible:shadow-focus outline-none`; na elementach z cieniem zaznaczenia w `style` fokus przez `focus-visible:outline-solid outline-2 outline-offset-2 outline-ring`;
  - wyłączony stan: `opacity-[.64]`;
  - pola: `FIELD`;
  - menu: `MENU_*` + `ActionPopover className="p-1"`;
  - `cn` to twMerge, więc klasy nadpisujące idą na końcu.
- **Telefon (`max-[799px]:`, `mobile/`):** układ bez zmian, zmieni go Etap 3. Cele dotykowe ≥ 44 px zostają. Wyjątek z listy odłożonych: przyciski „Anuluj” w rozmiarze sm w oknach Sportu mają na telefonie mieć 44 px, a dziś mają 40.
- **Bez nowych bibliotek.** Płaski kod bez helperów, komentarze po polsku. API komponentów wolno tylko rozszerzać.
- **Testy:**
  - `pnpm test`, `pnpm typecheck` i `pnpm lint` uruchamiasz lokalnie, e2e działa w CI (`gh run list --branch feat/coss-sport -L1`);
  - asercje klas aktualizujesz razem ze zmianą, testów zachowania nie zmieniasz.
- **Git:** commity tylko na `feat/coss-sport`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` oraz `Claude-Session: https://claude.ai/code/session_01WRp6JuSYwef6J2Ypw1fKow`.

## Review Focus

1. **Kalendarz miesiąca z wieloma treningami w jednym dniu i dymkiem przy krawędzi** (kolumny pt–nd, ostatnie wiersze). Dymek otwiera się do środka i nie wychodzi poza widok. Chipy skracają się wielokropkiem. Test: Task 1.
2. **Przełączanie metryk w kafelkach** (km, tempo, treningi, kcal): klawiatura, `aria-pressed` i widoczny fokus. Wykres bez danych (same zera) nie dzieli przez zero. Test: Task 2.
3. **Wykres rekordu i szczegóły ćwiczenia z jednym pomiarem albo bez pomiarów:** brak NaN w `points` i sensowny stan pusty. Test: Task 2 i Task 4.
4. **Trening siłowy z wieloma ćwiczeniami i seriami:** dodawanie i usuwanie serii, wybór ćwiczenia z listy i fokus po dodaniu działają tak jak dotąd. Test: Task 3.
5. **Długie nazwy szablonów i ćwiczeń** skracają się w listach i nagłówkach i nie rozpychają kart. Test: Task 5.

---

### Task 1: Sport — nagłówek, filtry, kalendarz miesiąca, dymek treningu

**Files:**
- Modify: `src/features/sport/sport-view.tsx`, `month-calendar.tsx`, `item-popover.tsx`, `delete-session-dialog.tsx`
- Test: istniejące testy tych plików

**Wzorzec:** `CSport.dc.html`, w tej kolejności:
- nagłówek z akcjami;
- filtr Wszystko / Bieg / Siłownia jako `.seg`;
- legenda;
- siatka miesiąca: komórki z chipami (wykonany: tło `kolor+14`, ramka `kolor+30`; planowany: biała z przerywaną ramką), kolumna sum tygodnia 92 px;
- dymek `.pop` z odznaką BIEG/SIŁA, statystykami w siatce 2 kolumn, listą ćwiczeń, notatką i stopką z akcjami;
- okno usuwania w stylu `.dlg`.

Czerwonego kółka „dziś” nie zmieniaj, jest już zgodne z makietą.

- [ ] **Step 1:** zaktualizuj asercje klas pod makietę.
  - Dodaj test `"chip wykonanego biegu ma kolor #f59e0b, siłowni #525252"`.
  - Dodaj test `"dymek w kolumnie piątek–niedziela otwiera się w lewo"`. Jeśli taki test już jest, upewnij się, że przechodzi.

  Uruchom `pnpm vitest run src/features/sport`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2: Przestyluj** pliki według makiety. Porównaj z `pnpm mockups:shots CSport` i z prawdziwym widokiem przez tymczasową trasę dev, którą usuwasz przed commitem.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS, bez pozostałości w sport-view.
- [ ] **Step 4: Commit** `feat(coss): sport — kalendarz miesiąca i dymek treningu jak w makiecie`.

### Task 2: Sport — kafelki metryk z wykresem, rekord, ostatnie treningi

**Files:**
- Modify: `src/features/sport/week-tiles.tsx`, `record-card.tsx`, `recent-table.tsx`
- Test: istniejące testy tych plików

**Wzorzec:** `CSport.dc.html`:
- kafelki metryk jako przyciski. Wybrany jest biały z dolną kreską `inset 0 -2px 0 #262626`, pozostałe mają tło `rgba(0,0,0,.025)`.
- wykres słupkowy:
  - ostatni tydzień zielony, tydzień z osiągniętym celem `#262626`, pozostałe `rgba(0,0,0,.12)`;
  - przerywana zielona linia celu z etykietą;
  - wartości nad słupkami.
- karta rekordu: linia, punkty (rekord zielony), dymek, odznaka REKORD / bez rekordu jako `.bdg ok` / `.bdg sec`.
- tabela ostatnich treningów: odznaki BIEG (`warn`) i SIŁA (`sec`), kolumny liczbowe `tabular-nums` wyrównane do prawej.

- [ ] **Step 1:** zaktualizuj asercje klas.
  - Dodaj test `"wybrany kafelek ma aria-pressed i dolną kreskę"`.
  - Dodaj test `"wykres bez danych nie ma NaN w wysokościach"`.

  Uruchom `pnpm vitest run src/features/sport`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2: Przestyluj** według makiety.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat(coss): sport — kafelki metryk, rekord i ostatnie treningi jak w makiecie`.

### Task 3: Okno biegu i trening siłowy

**Files:**
- Modify: `src/features/sport/run-dialog.tsx`, `gym-log.tsx`, `exercise-picker.tsx`
- Test: `run-dialog.test.tsx`, `gym-log.test.tsx`

**Wzorzec:**
- `CRunDialog.dc.html`: okno `.dlg` z polami daty i godziny, dystansu i czasu, wyliczonym tempem i kcal, trudnością, notatką i stopką z „Anuluj” (ghost) i przyciskiem głównym.
- `CGymLog.dc.html`:
  - nagłówek treningu,
  - karty ćwiczeń z tabelą serii (kg × powt., ✓ serii, „+ Seria”),
  - wybór ćwiczenia jako `.pop` z wyszukiwaniem,
  - podsumowanie i stopka.

Na telefonie przyciski „Anuluj” w rozmiarze sm mają 44 px (`max-[799px]:h-11`).

- [ ] **Step 1:** zaktualizuj asercje klas.
  - Dodaj test `"„Anuluj” w oknie biegu ma na telefonie max-[799px]:h-11"`.
  - Dodaj test `"dodanie serii przenosi fokus do nowego pola kg"`. Jeśli takie zachowanie już istnieje, upewnij się, że przechodzi. Jeśli go nie ma, nie dodawaj go, tylko wpisz do „Do decyzji”.

  Uruchom `pnpm vitest run src/features/sport`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2: Przestyluj** według makiet.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat(coss): okno biegu i trening siłowy jak w makietach`.

### Task 4: Szczegóły ćwiczenia

**Files:**
- Modify: `src/features/sport/exercise-detail.tsx`
- Test: `exercise-detail.test.tsx`

**Wzorzec:** `CExerciseDetail.dc.html`:
- nagłówek,
- kafelki (rekord, ostatnio, objętość),
- wykres postępu z siatką i punktami (rekordy zielone),
- historia serii w tabeli.

- [ ] **Step 1:** zaktualizuj asercje klas. Dodaj test `"wykres z jednym pomiarem nie ma NaN w points"`. Uruchom `pnpm vitest run src/features/sport`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2: Przestyluj** według makiety.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat(coss): szczegóły ćwiczenia jak w makiecie`.

### Task 5: Szablony treningów

**Files:**
- Modify: `src/features/sport/templates-list.tsx`, `template-editor.tsx`
- Test: `templates-list.test.tsx`, `template-editor.test.tsx`

**Wzorzec:** `CWorkoutTemplates.dc.html`:
- lista szablonów jako karty lub wiersze z liczbą ćwiczeń i serii oraz menu akcji (`ActionPopover` + `MENU_*`),
- edytor z listą ćwiczeń, stepperami serii i „Rozpocznij”.

- [ ] **Step 1:** zaktualizuj asercje klas. Dodaj test `"długa nazwa szablonu ma truncate"`. Uruchom `pnpm vitest run src/features/sport`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2: Przestyluj** według makiety.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat(coss): szablony treningów jak w makiecie`.

### Task 6: Weryfikacja gałęzi

- [ ] **Step 1:** `git push` i zielone CI.
- [ ] **Step 2:** zbierz sekcje „Do decyzji” z raportów w jedną wiadomość dla Mejsona, z moimi rekomendacjami i linkiem do podglądu Vercel. Bez merge.
