# Stan projektu rhytm (aktualizuj na koniec każdego etapu)

Ostatnia aktualizacja: 2026-11-24 (projekt Dziś; seria autonomiczna).

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

- **Seria autonomiczna (2026-11-24):** Dziś → Subscriptions → sprzątanie uwag webu → Etap 3 (telefon). Decyzje podjęte bez Mejsona: `docs/superpowers/do-decyzji-seria.md`.
- **Projekt Dziś:** scalony (`02a36ba`) i wdrożony; spec `specs/2026-11-24-dzis-design.md`. Migracja `20261126100000_tasks_only_in_blocks.sql` wykonana 24.11 (6 zadań usuniętych).
- **Sprzątanie uwag webu:** scalone (`effe78c`), wdrożone, obie migracje wykonane 24.11.
- **Etap 3 — telefon:** spec `specs/2026-11-24-telefon-design.md`, 10 pakietów (plany `plans/2026-11-24-telefon-<pakiet>.md`): fundament → kalendarz → dzis → nawyki → sport → strony → hasla → subskrypcje → konto → szukaj. Fundament scalony 24.11 (pasek zakładek, nagłówek, arkusz, kontrolki dotykowe, `ConfirmDialog`). Makiety CM* uzupełnione 24.11 o 22 ekrany. Kalendarz scalony 24.11 (dzień, tydzień, miesiąc, arkusz bloku, szczegóły, nowy wpis, kategoria). Dziś scalone 24.11 (wariant F, pusty stan, szybkie dodawanie). Nawyki scalone 24.11. Sport i strony scalone 24.11, hasła 25.11. Następny: subskrypcje.
- **Subscriptions:** scalony (`d7db6f0`), wdrożony, migracja `20261127100000_subscriptions.sql` wykonana 24.11; spec `specs/2026-11-24-subscriptions-design.md`, plan `plans/2026-11-24-subscriptions.md`; migracja `20261127100000_subscriptions.sql`.

- Nic. Ostatnie scalenie: `98746b2` (strony i Hasła na całą szerokość).

## Dalej (kolejność ustalona z Mejsonem 2026-11-23; kroki 1–3 zamykają obecny etap aplikacji)

1. **Projekt Dziś:**
   - wariant F według makiety S2Today i pusty stan S2EmptyToday;
   - zadania tylko w blokach, w bazie `NOT NULL`;
   - **decyzja Mejsona (2026-11-23):** 6 zadań bez bloku na produkcji usuwa migracja tego projektu (wykonuje ją Claude przez konektor Supabase po wyraźnym potwierdzeniu Mejsona, bo usuwa dane), nie ręczne kasowanie;
   - szczegóły w `docs/superpowers/odlozone.md`, sekcja „Poprawki webu — Dziś”.
2. **Etap 3: telefon** według makiet CM* na kanwie, prawdopodobnie w kilku pakietach. Zbiera odłożone uwagi oznaczone „Etap 3” w `odlozone.md` (m.in. edycja Sekretu na telefonie, zakładka Hasła w dolnym pasku, ujednolicone okna usuwania).
3. **Sprzątanie odłożonych uwag webu** z `odlozone.md`: niestabilne e2e, drobne poprawki tabeli, obrona w głąb w bazie dla Haseł (strażnik `page_rows`). Jeden mały pakiet.
4. **Opcjonalnie:** podział dużych plików `src/features/pages/table/page-table.tsx` i `use-table-store.ts` (tylko jeśli tabele będą dalej rozbudowywane).
5. **Poza obecnym etapem — Subscriptions:** osobny projekt (nowa wersja), opisany w specu Stron 2.0 w „Poza zakresem”.

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
