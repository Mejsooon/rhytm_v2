# Stan projektu rhytm (aktualizuj na koniec każdego etapu)

Ostatnia aktualizacja: 2026-11-23.

## Czym jest rhytm

Aplikacja Mejsona do organizacji życia. Moduły:
- **Dziś:** plan dnia, statystyki tygodnia, nawyki na dziś.
- **Kalendarz:** bloki czasu z zadaniami.
- **Sport:** biegi, siłownia, szablony treningów.
- **Nawyki i sen:** heatmapa i dziennik snu.
- **Strony:** tabele jak w Notion, szablony Books, Projects i Websites.
- **Hasła:** sejf zero-knowledge.
- **Onboarding i ustawienia.**

Wygląd COSS według makiet na kanwie „Rhytm Design”.

## Zrobione (w `main`)

- **Etapy 1–2g:** migracja wyglądu na COSS w całym webie (Kalendarz, Nawyki, Sport, Strony, Ustawienia, logowanie, onboarding).
  - Plany: `docs/superpowers/plans/2026-11-20-*` … `2026-11-22-*`.
  - Spec: `docs/superpowers/specs/2026-11-20-coss-ui-design.md`.
- **Sejf haseł:** `docs/superpowers/specs/2026-11-21-sejf-design.md`.
- **Strony 2.0** (spec: `docs/superpowers/specs/2026-11-22-strony-2-design.md`, sekcja „Kolejność wdrożenia” i decyzje po krokach):
  - **Krok 1** (merge `adba866`): jeden blok tabeli `PageTable` dla każdej strony, ikony stron tylko Lucide, okno „Nowa strona” z szablonami, menu strony, chowany pasek boczny. Plan: `plans/2026-11-23-strony-2-krok-1.md`.
  - **Krok 2** (merge `d4a1564`):
    - edycja w komórkach jak w Notion (`table-cell.tsx`) i okienko opcji (`option-picker.tsx`);
    - szerokości kolumn i kart;
    - karty statystyk ustawiane przez użytkownika (`pinned-cards.tsx`, `card-dialog.tsx`);
    - „Nowa strona” z paska bocznego otwiera wybór szablonu.

    Plan: `plans/2026-11-23-strony-2-krok-2.md`. Migracje wykonane na produkcji.
  - **Pakiet poprawek** (merge `feeece8`): kalendarz według makiet, ciemny tekst w kolumnach, URL jak tekst, „Pusta strona” bez tabeli.

## W toku

- **Gałąź `docs/dziennik`:** dziennik sesji w `docs/superpowers/dziennik/` (wpisy 16–23.11 odtworzone z historii) i reguła dziennika w `CLAUDE.md`. Czeka na „scal do main”.
- **Pakiet poprawek po kroku 2 jest już w main** (merge `feeece8`): `DatePicker` według makiet S2, ciemny tekst w kolumnach, URL jak tekst, „Pusta strona” bez tabeli.

## Dalej (kolejność ustalona z Mejsonem)

1. **Opcjonalnie, przed krokiem 3:** podział dużych plików `src/features/pages/table/page-table.tsx` i `use-table-store.ts`.
2. **Strony 2.0, krok 3: Hasła i onboarding.** Spec, punkty 4, 6 (część haseł), 12 i 14 oraz zmiany onboardingu z „Decyzji Claude”.
   - Hasła stają się stałym modułem w pasku bocznym, z tą samą tabelą i Notatką oraz Kategorią.
   - Strona systemowa ma migrację z testem pgTAP.
   - Etap wymaga osobnego przeglądu bezpieczeństwa.
   - Stary `TemplatePageView`, `RowEdit` i `RowPreview` znikają.
3. **Projekt Dziś:**
   - wariant F według makiety S2Today i pusty stan S2EmptyToday;
   - zadania tylko w blokach: zadania bez bloku są usuwane całkowicie, w bazie `NOT NULL` (na produkcji jest 6 zadań bez bloku — decyzja Mejsona przed migracją);
   - szczegóły w `docs/superpowers/odlozone.md`, sekcja „Poprawki webu — Dziś”.
4. **Subscriptions:** osobny projekt, opisany w specu Stron 2.0 w „Poza zakresem”.
5. **Etap 3: telefon** według makiet CM* na kanwie.

## Ważne miejsca w kodzie

- **Strony:**
  - `src/features/pages/` zawiera `actions.ts` (Server Actions), `fields.ts`, `table-model.ts`, `templates.ts` i `page-icons.ts`;
  - tabela jest w `table/`;
  - edytor bloków w `editor/`.
- **Powłoka:** `src/components/shell/`, z paskiem bocznym, `sidebar-state` i ciasteczkiem `rhytm_sidebar`.
- **Kontrolki:** `src/components/controls/`.
- **Testy:**
  - e2e w `e2e/`, helpery w `e2e/helpers/`;
  - `e2e/visual.spec.ts` robi zrzuty do porównania z makietami;
  - pgTAP w `supabase/tests/`.
