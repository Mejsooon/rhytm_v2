# Etap 3 / pakiet 1: fundament telefonu — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (dużo wspólnych plików). Steps use checkbox (`- [ ]`) syntax.

**Goal:** wspólne elementy telefonu według CM-BASE: narzędzia `m-*` w `globals.css`, pasek zakładek CMTabBar, nagłówek telefonu, arkusz od dołu, jedno okno potwierdzenia usunięcia (`ConfirmDialog`) i rozmiary dotykowe kontrolek. Web wygląda jak przed zmianą.

**Spec:** `docs/superpowers/specs/2026-11-24-telefon-design.md`: punkty „Wspólne zasady wyglądu”, „Inwentaryzacja” (wiersze CMTabBar i „(wspólne)”), „Uwagi z odlozone.md” i decyzje T1–T6. Czytaj w całości przed każdym zadaniem.

**Makiety (wiążące):**
- `docs/design/mockups/CMTabBar.dc.html`;
- blok `/* CM-BASE */` w `CMToday.dc.html` (identyczny we wszystkich CM*);
- arkusze w `CMQuickAdd.dc.html` i `CMBlockSheet.dc.html`;
- `coss/coss.css` (`.backdrop`, `.dlg*`, `.btnd`, `.btndo`).

Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots CMTabBar CMQuickAdd CMBlockSheet`.

**Tech Stack:** Next.js 16 (cacheComponents), React 19, Tailwind 4, kontrolki `@/components/controls`, `lucide-react` 1.73, Vitest, Playwright (CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod bez funkcji pomocniczych skaczących po plikach;
  - komentarze i teksty UI po polsku;
  - commity na `feat/telefon-fundament` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- Makiety CM* wygrywają z planem. Wartości (px, kolory, cienie) bierz z makiety, nie z pamięci.
- Cele dotykowe ≥ 44 px. Pola na telefonie mają font 16 px.
- Web (≥ 800 px) bez zmian. Wszystkie nowe klasy wizualne telefonu z prefiksem `max-[799px]:` albo w komponentach widocznych tylko na telefonie.
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint` mają być zielone. Testy e2e (projekt `mobile`) aktualizuj, gdy zmienia się tekst albo rola. Uruchomi je CI.
- Bez migracji.

## Task 1: Narzędzia CM-BASE w `globals.css`

**Files:** modify `src/app/globals.css`, `src/app/tokens.test.ts` (styl testu tokenów); read blok CM-BASE w `docs/design/mockups/CMToday.dc.html` i `node_modules/tailwindcss` docs o `@utility` (Tailwind 4).

- [ ] Dodaj `@utility` dla klas z tabeli w specu, z wartościami **dokładnie** z CM-BASE:
  - `m-head`, `m-title`, `m-row` (z `last:` bez ramki przez `&:last-child`), `m-grab`, `m-step` (z regułami dla `button` i `span` wewnątrz), `m-fab`, `m-hit` (z `&::before`);
  - `m-stats` (`.stats`), `m-stat` (`.stat`), `m-stat-v` (`.stat-v` z `span`), `m-sec-h`, `m-plan-block`.

  Kolory przez zmienne tokenów (`var(--border)`, `var(--primary)`, …), nie hex, poza cieniami z makiety. `m-fab` dostaje `bottom: calc(var(--tabbar-h) + 20px)` i `position: fixed` (w aplikacji ekran przewija się w oknie, a nie w ramce 390×844). Prefiks `m-` zostaje, bo zgadza się z makietami.
- [ ] Komentarz nad blokiem: skąd wartości (CM-BASE) i że to jedyne źródło wyglądu telefonu.
- [ ] Test w `tokens.test.ts` (czyta `globals.css` jako tekst): każde narzędzie istnieje i ma kluczowe wartości (`min-height: 52px` w `m-head`, `inset: -14px` w `m-hit`, `56px` w `m-fab`).
- [ ] Commit: `feat(telefon): narzędzia CM-BASE`.

## Task 2: Pasek zakładek i nagłówek telefonu

**Files:** modify `src/components/shell/tab-bar.tsx` (+ `tab-bar.test.tsx`), `src/components/shell/nav-items.ts`, `src/components/shell/module-header.tsx` (+ `module-header.test.tsx`); grep użyć `ModuleHeader` (`grep -rn "ModuleHeader" src --include=*.tsx`).

- [ ] TabBar według `.tabbar`/`.tab` z CMTabBar:
  - tło `var(--sidebar)`, ramka `var(--sidebar-border)`, `gap:2px`, padding 6/6/8 (z safe-area jak dziś);
  - zakładka `min-h-11 rounded-lg font-medium gap-[3px] text-[11px]`, nieaktywna `text-[rgba(38,38,38,.68)]`;
  - aktywna `bg-black/5 text-foreground` z `aria-current="page"`;
  - ikony 20 px.
- [ ] A1: aktywność zakładki „Strony” także dla `/hasla` i `/hasla/...`. Dopisz do pozycji „strony” w `TAB_ITEMS` pole `alsoActive: ["/hasla"]` i sprawdzaj je w TabBar. Test: ścieżka `/hasla` → „Strony” ma `aria-current="page"`.
- [ ] `ModuleHeader`, wariant telefonu:
  - `<header className="m-head …">`;
  - `phoneLabel` jako `.lbl` (12 px, 500, muted, **bez** mono i wersalików);
  - tytuł `m-title`.

  Nowe propsy:
  - `phoneBack?: { href: string; label: string }`: przycisk 44 px ze strzałką `ChevronLeft` 20 px przed tytułem;
  - `phoneActions?: React.ReactNode`: po prawej, każdy przycisk 44 px.

  `phoneSettingsLink` zostaje, ale renderuje się jako pozycja `phoneActions`. Wygląd dla dzisiejszych wywołań: CM zamiast M (to zamierzone).
- [ ] `MonoLabel` w nagłówku telefonu znika. Jeśli `MonoLabel` jest jeszcze używany gdzie indziej, zostaje w pliku.
- [ ] Testy: zaktualizuj asercje klas (28 px → `m-title`), dopisz testy `phoneBack` (link z `aria-label`) i `phoneActions`.
- [ ] e2e: `grep -rn "font-mono\|28px" e2e` nie powinien niczego dotyczyć; sprawdź `e2e/shell.spec.ts` (mobile).
- [ ] Commit: `feat(telefon): pasek zakładek i nagłówek według CM`.

## Task 3: Arkusz od dołu i kontrolki dotykowe

**Files:**
- `src/components/controls/form-dialog.tsx` (+ test);
- `src/components/ui/input.tsx`;
- `src/components/controls/dropdown.tsx`, `stepper.tsx`, `segment.tsx` (+ testy);
- read `CMQuickAdd.dc.html`, `CMBlockSheet.dc.html` (`.dlg.m-sheet`, `.dlg-h`, `.dlg-b`, `.dlg-f`), `coss/coss.css` (`.backdrop`, `.dlg*`).

- [ ] `FormDialog` poniżej 800 px:
  - tło jak `.backdrop` z `coss.css`, bez rozmycia (odłożone Etap 1 Task 5);
  - arkusz `rounded-t-2xl`, `max-h-[88%]`;
  - uchwyt jako `m-grab`;
  - stopka z `padding-bottom` 28 px (`.dlg-f` w CMQuickAdd).
- [ ] Nowy prop `phoneHeader?: "close" | "actions"` (domyślnie `"close"`):
  - `"close"` (CMQuickAdd): tytuł po lewej 18 px, `✕` 44 px po prawej;
  - `"actions"` (CMBlockSheet, CMRowEdit): „Anuluj” (`btng`, muted) · tytuł na środku · przycisk główny. Treść i obsługę dostaje z nowych propsów `phoneCancel?: { label: string; onClick: () => void }` i `phoneSubmit?: React.ReactNode`. Przy `"actions"` stopka telefonu się nie pokazuje (`footer` tylko od 800 px), a nagłówek ma dolną ramkę.
- [ ] Web (≥ 800 px) bez zmian: test, że klasy `min-[800px]:` zostały nietknięte (porównaj z obecnymi w teście).
- [ ] `ui/input.tsx`: na telefonie `max-[799px]:text-base` (16 px) i wysokość 44 px (odłożone Etap 1 Task 3).
- [ ] `Dropdown`: wariant `compact` ma na telefonie 44 px (`max-[799px]:h-11`).
- [ ] `Stepper`: pierścień fokusu nie jest ucinany. Przenieś `overflow-hidden` z kontenera na przyciski (zaokrąglenia przez `first:`/`last:` rounded) albo daj pierścień na kontener przez `focus-within`. Przyciski 44×44 na telefonie jak `m-step`.
- [ ] `Segment`: na telefonie przyciski 40 px, `flex-1`, `min-w-0`, tekst ucinany wielokropkiem. Bez zawijania i bez wychodzenia poza szerokość (odłożone Etap 1 Task 4, 2b Task 4).
- [ ] Testy każdej zmiany (klasy telefonu, `phoneHeader="actions"`: role przycisków, „Anuluj” woła `onClick`).
- [ ] Commit: `feat(telefon): arkusz CM i rozmiary dotykowe kontrolek`.

## Task 4: `ConfirmDialog` i ujednolicone okna usuwania

**Files:** create `src/components/controls/confirm-dialog.tsx` (+ `confirm-dialog.test.tsx`), export w `src/components/controls/index.ts`; modify `src/features/calendar/delete-block-dialog.tsx`, `src/features/sport/delete-session-dialog.tsx`, `src/features/pages/delete-page-dialog.tsx`, `src/features/habits/delete-habit-dialog.tsx` (+ ich testy); read `S2DeleteBlockDialog.dc.html` (web) i obecny kod `delete-block-dialog.tsx` (najbliżej docelowego).

- [ ] `ConfirmDialog` (Radix Dialog, `role="alertdialog"`). Propsy:
  - `open`, `onOpenChange`, `title`, `description?: React.ReactNode`, `children?` (np. dodatkowa treść);
  - `confirmLabel`, `onConfirm: () => void | Promise<void>`, `pending?: boolean`, `cancelLabel = "Anuluj"`, `destructive = true`.

  Wygląd:
  - od 800 px karta `.dlg` 400 px jak dziś w `delete-block-dialog.tsx` (te same klasy);
  - poniżej 800 px arkusz od dołu (`m-grab`, promień 16, tło `.backdrop`), przyciski w kolumnie: potwierdzenie `btnd` na górze, „Anuluj” pod nim, oba 48 px (`flex-col-reverse` jak dziś).

  Jeden plik, bez funkcji pomocniczych.
- [ ] Przepnij 4 okna na `ConfirmDialog`, zachowując teksty, logikę (czekanie na serwer, toasty, `onDeleteStart`) i testy zachowania. Sport traci kartę na środku telefonu (odłożone 2d).
- [ ] Okno zakresu (`scope-dialog.tsx`) i reset sejfu (`vault-reset-dialog.tsx`) **nie** przechodzą (mają inny układ). Odnotuj to w komentarzu `ConfirmDialog`.
- [ ] Testy `ConfirmDialog`:
  - rola `alertdialog`, nazwa z tytułu;
  - potwierdzenie woła `onConfirm`;
  - `pending` blokuje oba przyciski;
  - klasy telefonu (`max-[799px]:bottom-0`, `max-[799px]:rounded-t-2xl`).
- [ ] Commit: `feat(telefon): jedno okno potwierdzenia usunięcia`.

## Task 5 (koordynator): przegląd, CI, scalenie, dziennik

**Files:** `docs/superpowers/specs/2026-11-24-telefon-design.md` (kopia szkicu specu, tylko w tym pakiecie), `docs/superpowers/plans/2026-11-24-telefon-fundament.md` (kopia planu), `docs/superpowers/odlozone.md`, dziennik, `stan-projektu.md`.

- [ ] **Przed Task 1:**
  - gałąź `feat/telefon-fundament` z `main` (po sprzątaniu);
  - kopie specu i planu, commit `docs(telefon): spec Etapu 3 i plan fundamentu`;
  - wpis w dzienniku i w „W toku”.
- [ ] Po każdym zadaniu recenzent sprawdza:
  - zgodność z CM-BASE i makietami (zrzuty makiet vs `pnpm dev` w Chrome 390×844 na ekranach bez danych: `/logowanie` dla pól, `/dev/kontrolki` dla kontrolek);
  - że web się nie zmienił.
- [ ] Przegląd całej gałęzi. Push. CI zielone (e2e `mobile` i `web`, zrzuty `visual.spec`).
- [ ] Scalenie według zasad serii (`git merge --no-ff`, testy na połączonym kodzie, push `main`).
- [ ] `odlozone.md`: uwagi z wierszy „fundament” oznacz „naprawione (telefon-fundament, <merge>)”.
- [ ] Dziennik, `stan-projektu.md` („W toku: Etap 3, pakiet kalendarz”).
- [ ] „Do decyzji”: T1–T6 ze specu, z kosztem pomyłki.
