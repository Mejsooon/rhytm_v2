# COSS UI — Etap 2b (Nawyki i sen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moduł Nawyki i sen na webie wygląda dokładnie jak makiety COSS: lista nawyków z kafelkami, siatką tygodnia i heatmapą, karta snu, szczegóły nawyku oraz okna nawyku i snu.

**Architecture:** Fundamenty z Etapów 1 i 2a są na main:
- tokeny i cienie, kontrolki z `@/components/controls`, ModuleHeader (sam tytuł bez `webParent`),
- DatePicker i TimePicker z ikoną i datą „wt 17.11.2026”,
- „Anuluj” jako ghost, ✕ okien jako ghost 28 px.

Ten etap przestylowuje wyłącznie widoki i okna modułu `src/features/habits` według makiet. Zmienia tylko wygląd.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, radix-ui, lucide-react, Vitest + Testing Library, Playwright (e2e w CI).

**Spec:** `docs/superpowers/specs/2026-11-20-coss-ui-design.md` (Etap 2, moduł Nawyki i sen)

## Global Constraints

- **Makiety są wiążące** (`docs/design/mockups/`): `CHabits.dc.html` (nawyki i sen), `CHabitDetail.dc.html`, `CHabitDialog.dc.html`, `CSleepDialog.dc.html` oraz arkusz `coss/coss.css`, odwzorowywany 1:1. Podgląd: `PW_CHANNEL=chrome pnpm mockups:shots <Nazwa>`.
- **Funkcjonalnie nic się nie zmienia:** dane, teksty, stany, przepływy, role ARIA i etykiety. Elementy i teksty, które są w makiecie, a nie ma ich w aplikacji, trafiają do raportu w sekcji „Do decyzji” i nie są dodawane.
- **Kolory:**
  - Kolory UI wyłącznie z tokenów. `node scripts/coss-kolory.mjs --check` nie może pokazać nowych pozostałości. Dziś ma ich 5: 2× `bg-[#4ade80]` w habit-heatmap, m-sport, sport-view.
  - Kolory danych (kolor nawyku, poziomy heatmapy, słupki snu) zostają z danych. Wyjątek: jeśli heatmapa ma w kodzie stałą paletę poziomów, to jest to kolor wykresu UI i ma odpowiadać makiecie CHabits. Mejson prosił o stonowaną zieleń, a nie jaskrawą.
- **Konwencje z Etapu 1/2a:**
  - fokus: `focus-visible:shadow-focus outline-none`; na elementach z cieniem zaznaczenia w `style` fokus przez `focus-visible:outline-solid outline-2 outline-offset-2 outline-ring`,
  - wyłączony stan: `opacity-[.64]`,
  - pola: `FIELD`,
  - menu: `MENU_*` + `ActionPopover className="p-1"`,
  - `cn` to twMerge, klasy nadpisujące idą na końcu.
- **Telefon (`max-[799px]:`, `mobile/`):** układ bez zmian (Etap 3), cele dotykowe ≥ 44 px zostają.
- **Bez nowych bibliotek.** Płaski kod bez helperów, komentarze po polsku. API komponentów wolno tylko rozszerzać.
- **Testy:** `pnpm test`, `pnpm typecheck` i `pnpm lint` lokalnie, e2e w CI (`gh run list --branch feat/coss-nawyki -L1`). Asercje klas aktualizujesz, testów zachowania nie zmieniasz.
- **Git:** commity tylko na `feat/coss-nawyki`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` oraz `Claude-Session: https://claude.ai/code/session_01WRp6JuSYwef6J2Ypw1fKow`.

## Review Focus

1. **Odhaczanie nawyku w siatce tygodnia i heatmapie** działa tak samo: klik, klawiatura, stan optymistyczny i cofnięcie przy błędzie. Każda komórka ma widoczny fokus. Test: Task 1.
2. **Heatmapa z wieloma nawykami i długą historią** nie wychodzi poza kartę, a dymek i podpowiedź mieszczą się w oknie. Test: Task 1.
3. **Brak wpisów snu albo luki w danych:** karta snu pokazuje dotychczasowy stan pusty, a wykres nie dzieli przez zero. Test: Task 2.
4. **Długie nazwy nawyków** (kafelek, wiersz siatki, nagłówek szczegółów) skracają się wielokropkiem i nie rozpychają układu. Test: Task 1 i Task 3.
5. **Nawigacja miesiąca w szczegółach** (‹ ›) działa i ma etykiety dostępne. Test: Task 3.

---

### Task 1: Nawyki — widok główny

**Files:**
- Modify: `src/features/habits/habits-view.tsx`, `habit-tiles.tsx`, `habit-week-grid.tsx`, `habit-heatmap.tsx`, `chart-tooltip.tsx`
- Test: istniejące testy tych plików

**Wzorzec:** `CHabits.dc.html` (część „Nawyki”):
- nagłówek z akcjami,
- kafelki podsumowania jako `.card`,
- siatka tygodnia z checkboxami `.cbx`, wiersze z kropką koloru nawyku i serią w `.bdg`,
- heatmapa (poziomy, legenda, zaznaczona komórka z pierścieniem, zakres 14/30 dni jako `.seg`),
- dymek wykresu `.pop`.

- [ ] **Step 1:** zaktualizuj asercje klas w testach pod makietę. Dodaj test `"komórka heatmapy ma widoczny fokus niezależny od zaznaczenia"`: zaznaczona komórka ma klasę `focus-visible:outline-ring` i pierścień w `style`. Uruchom `pnpm vitest run src/features/habits`. Oczekiwane: FAIL.
- [ ] **Step 2: Przestyluj** pliki według makiety. Porównaj z `pnpm mockups:shots CHabits` i z prawdziwym widokiem (tymczasowa trasa dev, usunięta przed commitem).
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS, bez nowych pozostałości.
- [ ] **Step 4: Commit** `feat(coss): nawyki — kafelki, siatka tygodnia i heatmapa jak w makiecie`.

### Task 2: Sen — karta i okno wpisu

**Files:**
- Modify: `src/features/habits/sleep-card.tsx`, `sleep-dialog.tsx`
- Test: `sleep-card.test.tsx`, `sleep-dialog.test.tsx`

**Wzorzec:**
- `CHabits.dc.html` (część „Sen”): karta, słupki, średnia, cel, zaznaczony słupek.
- `CSleepDialog.dc.html`: okno wpisu snu z polami daty i godzin, oceną jakości i tagami.

Zachowaj poprawkę układu siatki dat i godzin z Etapu 2a (`minmax(max-content,1fr)` dla daty).

- [ ] **Step 1:** zaktualizuj asercje klas. Dodaj test `"karta snu bez wpisów pokazuje stan pusty"` z dotychczasowym tekstem stanu pustego. Uruchom `pnpm vitest run src/features/habits`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2: Przestyluj** według makiet.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat(coss): karta snu i okno wpisu snu jak w makietach`.

### Task 3: Szczegóły nawyku

**Files:**
- Modify: `src/features/habits/habit-detail.tsx`, `habit-month.tsx`, `habit-notes.tsx`, `delete-habit-dialog.tsx`
- Test: testy tych plików

**Wzorzec:** `CHabitDetail.dc.html`:
- nagłówek z okruszkami (szczegóły to podstrona, więc `webParent` „Nawyki”, jeśli aplikacja już go tak pokazuje; nie zmieniaj tekstu),
- kafelki statystyk,
- kalendarz miesiąca z nawigacją ‹ ›,
- notatki,
- przyciski akcji: „Usuń” jako destructive-outline, okno usuwania w stylu `.dlg`.

- [ ] **Step 1:** zaktualizuj asercje klas. Dodaj test `"nawigacja miesiąca ma etykiety i zmienia miesiąc"` (jeśli taki już istnieje, upewnij się, że przechodzi). Uruchom `pnpm vitest run src/features/habits`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2: Przestyluj** według makiety.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat(coss): szczegóły nawyku jak w makiecie`.

### Task 4: Okno nawyku

**Files:**
- Modify: `src/features/habits/habit-dialog.tsx`
- Test: `habit-dialog.test.tsx`

**Wzorzec:** `CHabitDialog.dc.html`:
- nazwa,
- kolor jako wybór kółek z pierścieniem zaznaczenia i fokusem przez outline,
- częstotliwość jako `.seg`,
- dni tygodnia jako `.chip`,
- „razy w tygodniu” przez `Stepper`,
- przypomnienie przez `Switch` i TimePicker,
- podsumowanie,
- stopka z „Anuluj” (ghost) i przyciskiem głównym.

- [ ] **Step 1:** zaktualizuj asercje klas. Dodaj test `"wybrany kolor ma pierścień i widoczny fokus"`. Uruchom `pnpm vitest run src/features/habits`. Oczekiwane: FAIL.
- [ ] **Step 2: Przestyluj** według makiety. Chipy dni tygodnia mają na telefonie cel ≥ 44 px (w Etapie 1 odnotowano 36 px).
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`. Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat(coss): okno nawyku jak w makiecie`.

### Task 5: Weryfikacja gałęzi

- [ ] **Step 1:** `git push` i zielone CI.
- [ ] **Step 2:** sekcje „Do decyzji” z raportów zbierz do wiadomości dla Mejsona, razem z moimi rekomendacjami i linkiem do podglądu Vercel. Bez merge.
