# Stan projektu rhytm (aktualizuj na koniec każdego etapu)

Ostatnia aktualizacja: 2026-11-23 (krok 3 Stron 2.0).

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
  - **Krok 3** (merge `a69a5b1`): Hasła jako moduł systemowy `/hasla` (strona `is_system`, stałe kolumny, przy zamkniętym sejfie sama karta „Odblokuj sejf”), nowy onboarding. Plan: `plans/2026-11-23-strony-2-krok-3.md`. Migracja `20261125100000_passwords_module.sql` wykonana na produkcji.

## W toku

- **Gałąź `feat/strony-pelna-szerokosc`:** strony i Hasła na całą szerokość okna (bez limitu 1160 px, jak w makiecie S2Books). Czeka na „scal do main”.

## Dalej (kolejność ustalona z Mejsonem)

1. **Opcjonalnie:** podział dużych plików `src/features/pages/table/page-table.tsx` i `use-table-store.ts`.
2. **Projekt Dziś:**
   - wariant F według makiety S2Today i pusty stan S2EmptyToday;
   - zadania tylko w blokach: zadania bez bloku są usuwane całkowicie, w bazie `NOT NULL` (na produkcji jest 6 zadań bez bloku — decyzja Mejsona przed migracją);
   - szczegóły w `docs/superpowers/odlozone.md`, sekcja „Poprawki webu — Dziś”.
3. **Subscriptions:** osobny projekt, opisany w specu Stron 2.0 w „Poza zakresem”.
4. **Etap 3: telefon** według makiet CM* na kanwie.

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
