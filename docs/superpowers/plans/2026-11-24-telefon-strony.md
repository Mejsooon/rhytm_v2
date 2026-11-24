# Etap 3 / pakiet 6: Strony na telefonie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (arkusz wiersza obsługuje Sekret). Steps use checkbox (`- [ ]`) syntax.

**Goal:** lista stron według CMPages, edytor i tabela strony według CMEditor, arkusz wiersza według CMRowEdit (ogólny, dla wszystkich typów pól). Hasła i Subscriptions dostają własne układy w następnych pakietach i korzystają z tego arkusza.

**Spec:** `docs/superpowers/specs/2026-11-24-telefon-design.md`: inwentaryzacja (CMPages, CMEditor, CMRowEdit), uwagi „strony”, decyzje T10, T15, T17. Czytaj w całości przed każdym zadaniem.

**Makiety (wiążące):** `docs/design/mockups/CMPages.dc.html`, `CMEditor.dc.html` (stany: pusta strona, tabela, menu „Wstaw blok” `menuOpen`, arkusz „Kolumna” `colOpen`), `CMRowEdit.dc.html` (układ arkusza i wygląd pól). Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots CMPages CMEditor CMRowEdit`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4 (`@utility` `m-*`), kontrolki `@/components/controls`, Vitest, Playwright (CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod;
  - polskie teksty i komentarze;
  - commity na `feat/telefon-strony` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- Makiety wygrywają z planem. Cele dotykowe ≥ 44 px. Web (tabela, edytor, menu) bez zmian.
- **Sejf:** tekst jawny Sekretu żyje tylko w stanie arkusza i znika po zamknięciu albo blokadzie (obecne zasady w komentarzu `m-row-sheet.tsx`). Żadnego tekstu jawnego w store, `onChange`, adresie ani logach.
- `use-table-store.ts` i logika zapisu bez zmian. Zmienia się prezentacja telefonu.
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint`. e2e telefonu (`e2e/pages.spec.ts` mobile, `e2e/sejf.spec.ts` mobile) aktualizuj przy zmianie tekstu albo roli.

## Task 1: Lista stron (CMPages)

**Files:** `src/features/pages/mobile/m-pages.tsx` (+ `m-pages.test.tsx`), `src/app/(app)/strony/page.tsx`.

- [ ] `m-head` (`py-1`): `.lbl` „Twoje tabele i notatki”, `m-title` „Strony”, akcje „Ustawienia” (→ `/ustawienia`) i „Nowa strona” (to, co dziś otwiera wybór szablonu), obie 44 px.
- [ ] Szukajka jako `igroup` 44 px z ikoną i placeholderem „Szukaj stron i wierszy”. Zostaje lokalnym filtrem (T15), z `aria-label` jak dziś.
- [ ] Hasła na górze (jak dziś) w tym samym stylu wiersza: ikona `Lock` w `empty-ic` z kolorem `--warning-foreground`, „Hasła”, `.hint` „sejf · zablokowany/odblokowany” (status z `useVault`).
- [ ] Sekcje „Ulubione” i „Wszystkie strony”: `.lbl` (mb-2) + `Card` z `m-row` (`py-2`): ikona strony w `empty-ic` (kolor muted; Subscriptions w `--success-foreground` jak w makiecie), tytuł 500, `.hint` dopisku (dzisiejszy tekst: „N wierszy” / „pusta strona”), chevron.
- [ ] Przycisk przerywany 56 px „Nowa strona” (`btn` z `border-dashed shadow-none`) na końcu listy.
- [ ] Commit: `feat(telefon): lista stron według CMPages`.

## Task 2: Edytor i pasek skrótów (CMEditor)

**Files:** `src/features/pages/editor/mobile/m-editor.tsx` (+ test), `m-insert-sheet.tsx`, `src/features/pages/editor/editor-view.tsx` (gałąź telefonu), `src/features/pages/page-menu.tsx` (wariant telefonu, odłożone Etap 1 Task 5).

- [ ] `m-head` (`px-2`): link „Strony” (`ChevronLeft`, 44 px), pusty środek, „Więcej” (`PageMenu` jako arkusz na telefonie: `m-row` 44 px zamiast menu webowego).
- [ ] Treść (`ed-body`): `px-4 pt-2 pb-24 gap-2.5`, tytuł strony 24/600 bez ramki, `.hint` pustej strony („Stuknij „+” na dole albo wpisz „/”, żeby wstawić blok.”), bloki z fokusem `ed-in` (tło `rgba(0,0,0,.02)`, cień `0 0 0 2px rgba(38,38,38,.08)`).
- [ ] Pasek `editbar` nad paskiem zakładek: `btnp ic` „Wstaw blok”, `btng ic` „Wstaw tabelę”, „Wstaw zadanie”, „Wstaw nagłówek” (H 700), odstęp, `StatusBadge` secondary z licznikiem bloków. Tło `#fafafa`, górna ramka, `pb` 26 px nad safe-area.
- [ ] „Wstaw blok”: arkusz `FormDialog` „close”, pozycje `.mi` 60 px z `block-icon` 40 px, nazwą i opisem 13 muted. Pusty wynik: „Brak bloku „q””.
- [ ] Commit: `feat(telefon): edytor według CMEditor`.

## Task 3: Tabela na telefonie i arkusz „Kolumna”

**Files:** `src/features/pages/table/page-table.tsx` (tylko gałąź `max-[799px]` i elementy `min-[800px]:hidden`), `table-cell.tsx` (telefon: checkbox i Wybór w komórce), `column-menu.tsx` (arkusz „Kolumna” na telefonie), `option-picker.tsx` („⋯” na dotyku), testy tych plików.

- [ ] Tabela poniżej 800 px według CMEditor (T10):
  - `frame` (ramka 12 px) z przewijaniem w poziomie;
  - nagłówki `th-cell` 44 px (ikona typu 12/600 `#a3a3a3`, nazwa 14/500 muted, prawa linia), stuknięcie otwiera arkusz „Kolumna”;
  - przycisk „Dodaj kolumnę” `+`;
  - wiersze min 44 px z liniami `rgba(0,0,0,.06)`.
  - Stuknięcie wiersza otwiera arkusz wiersza (jak dziś). **Wyjątki:** checkbox przełącza się w komórce (`cbx m-hit`, `stopPropagation`), a Wybór/Status przełącza się cyklicznie po stuknięciu plakietki (`aria-label` „<pole>: <wartość>, stuknij by zmienić”).
- [ ] Pod tabelą: „Nowy wiersz” (`btng` muted z `Plus`) i `StatusBadge` secondary z odmianą wierszy (`rowsForm`).
- [ ] Usunięcie wiersza na telefonie (przycisk kosza 44 px na końcu wiersza, `#a3a3a3`, „Usuń wiersz”) bez potwierdzenia, z toastem „Cofnij” jak na webie (T17).
- [ ] Arkusz „Kolumna” (`FormDialog`, nagłówek z „Gotowe”):
  - pole nazwy 44 px;
  - „Typ pola” jako chipy w 2 kolumnach (ikona 20 px + nazwa);
  - „← W lewo” / „W prawo →”;
  - „Usuń kolumnę” (destructive-outline);
  - stałe kolumny modułu Hasła (`locked`) bez tych pozycji, jak dziś.
- [ ] `option-picker`: „⋯” opcji widoczne zawsze na urządzeniach bez hovera (`[@media(hover:none)]:opacity-100`) (odłożone krok 2 Task 4).
- [ ] Commit: `feat(telefon): tabela strony i arkusz kolumny według CMEditor`.

## Task 4: Arkusz wiersza (CMRowEdit, ogólny)

**Files:** `src/features/pages/table/mobile/m-row-sheet.tsx` (+ `m-row-sheet.test.tsx`).

- [ ] `FormDialog` z `phoneHeader="actions"`: „Anuluj” · tytuł wiersza 16 px na środku · „Zapisz”, wysokość 90%, treść `pt-4 gap-[18px]`.
- [ ] Pola według typu (wygląd z CMRowEdit):
  - tekst/URL/liczba: `.fld` + pole 44 px;
  - Wybór/Status: `.lbl` + chipy `m-hit` z `aria-pressed`, nowe opcje jak dziś („Szukaj lub dodaj…” zostaje pod chipami, jeśli już jest);
  - data: karta z kalendarzem miesiąca (strzałki 44 px, `.lbl` dni, `date-cell` 40 px, dziś czerwone koło `#dc2626`, wybrana `primary`, wybrana + dziś z pierścieniem), pod nią `.hint` „dd.mm.rrrr · dziś/za N dni/minęło”;
  - ocena: gwiazdki 44 px;
  - checkboxy: zebrane w jednej karcie `m-row` z `Switch` `m-hit`;
  - Sekret: bez zmian logiki, wygląd `igroup` z oczkiem i kopiowaniem.
- [ ] „Usuń wiersz” (destructive-outline na całą szerokość, `Trash2`) na dole, tylko dla istniejącego wiersza.
- [ ] Niestabilny test (odłożone krok 3, zad. 5): przejrzyj `m-row-sheet.test.tsx` pod kątem `waitFor`/`findBy` przy odszyfrowaniu i usuń zależność od kolejności mikrozadań.
- [ ] Commit: `feat(telefon): arkusz wiersza według CMRowEdit`.

## Task 5 (koordynator): przegląd, CI, scalenie, dziennik

- [ ] **Przed Task 1:** gałąź `feat/telefon-strony` z `main`, kopia planu, dziennik.
- [ ] `visual.spec.ts`: test Stron z makietami `CMPages, CMEditor, CMRowEdit` w tytule, zrzuty arkuszy „Wstaw blok”, „Kolumna” i arkusza wiersza na telefonie.
- [ ] Recenzja: Sekret (tekst jawny tylko w arkuszu), zrzuty vs makiety, cele 44 px, web tabeli bez zmian (`page-table.test.tsx` dla webu zielony bez zmian oczekiwań).
- [ ] Przegląd gałęzi, CI zielone (w tym `sejf.spec` mobile), scalenie według zasad serii. `odlozone.md` oznacz. Dziennik, `stan-projektu.md`.
- [ ] „Do decyzji”: T10, T15, T17.
