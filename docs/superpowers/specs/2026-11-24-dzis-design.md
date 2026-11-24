# Projekt Dziś — wariant F (spec)

Data: 2026-11-24. Seria autonomiczna (zob. `CLAUDE.md`). Makiety wiążące: `docs/design/mockups/S2Today.dc.html` i `S2EmptyToday.dc.html`. Źródło wymagań: `docs/superpowers/odlozone.md`, sekcja „Poprawki webu — Dziś”.

## Cel

1. Ekran Dziś na webie wygląda jak S2Today: „Ten tydzień” jako 4 paski celów, „Nawyki na dziś” jako kafelki z passą, „Plan dnia” jako lista bloków na całą dobę z przerwami.
2. Nowe konto (bez danych) widzi ten sam układ z zerami (S2EmptyToday). Lista „Pierwsze kroki” znika.
3. Każde zadanie należy do bloku: w bazie `tasks.block_id` i `tasks.occurrence_date` są `NOT NULL`. Zadań bez bloku nie da się utworzyć ani zostawić.

## Zakres

### A. Baza (migracja `20261126100000_tasks_only_in_blocks.sql` + test pgTAP)

- Usuwa wszystkie zadania z `block_id is null` (na produkcji 6 sztuk; zgoda Mejsona z 23.11 i 24.11).
- `tasks.block_id` i `tasks.occurrence_date` → `NOT NULL`. Constraint `tasks_block_occurrence_check` staje się zbędny i znika.
- Klucz obcy `tasks.block_id` → `on delete cascade` (dziś `set null`). Wyzwalacz `blocks_detach_tasks_before_delete` i funkcja `detach_tasks_before_block_delete()` znikają: usunięcie bloku usuwa jego zadania.
- `split_block_series` (nowa wersja przez `create or replace`):
  - `p_delete = true`: zadania od `p_from` są **usuwane** (dziś stają się samodzielne);
  - zmiana `recurrence` w patchu: zadania od `p_from`, których dzień **należy do nowego wzorca**, przechodzą do nowej serii (`due_date = occurrence_date`); pozostałe są usuwane. Warunek przynależności ten sam co dla wyjątków w tej funkcji;
  - pozostałe gałęzie bez zmian.
- `due_date` zostaje (dzień, na którym wystąpienie jest pokazane).

### B. Kod zadań

- Usunąć: `createStandaloneTask`, `pinTaskToOccurrence`, `unpinTask` (`src/features/tasks/actions.ts`); `groupStandaloneTasks`, `pinTask`, `unpinTask` (`src/features/tasks/model.ts`); „Odepnij” w `block-popover.tsx` i arkuszu telefonu, jeśli tam jest.
- `src/features/calendar/actions.ts`: plan `detachTasksAndCancel` i odpinanie przy zamianie serii w blok jednorazowy → **usuwanie** tych zadań. Nazwa planu zmienia się na `deleteTasksAndCancel`. Teksty w oknach zakresu/usuwania, które mówią, że zadania „nie przepadają”, poprawić zgodnie z nowym zachowaniem.
- `src/features/calendar/actions.ts`: przesunięcie bloku jednorazowego na inny dzień przenosi jego zadania razem z nim (`occurrence_date` i `due_date` = nowa data startu); zadania nie są wtedy usuwane. Okno usuwania bloku jednorazowego informuje, że zadania bloku zostaną usunięte razem z nim.
- Telefon (minimum, pełny wygląd telefonu to Etap 3): w `m-quick-add` znika rodzaj „Zadanie”; w `m-today` znika sekcja zadań bez bloku. Typy `src/types/database.ts` dla `tasks` zgodne z bazą.

### C. Dziś na webie (S2Today)

- **Nagłówek** bez zmian (tytuł, odznaka daty, „tydz. N”, „Nowy blok”).
- **Ten tydzień**: jedna karta, 4 wiersze (siatka 110 px / pasek / 150 px / 120 px):
  - *Treningi*: `zrobione / cel`, pasek = zrobione/cel, prawa kolumna „jeszcze N” (0 → „cel osiągnięty”);
  - *Bieg*: `km / cel km`, pasek = km/cel, „jeszcze N km” (0 → „cel osiągnięty”);
  - *Nawyki*: `N %` + „dni z celem”, pasek = N %, prawa kolumna „—”; N = dotychczasowy `weekTiles().habits.percent` (null → „0 %”);
  - *Sen*: średni czas snu `h:mm` (brak → „—”) + „/ h:mm śr.”, pasek = średnia/cel (max 100 %), prawa kolumna „X z Y nocy ≥ cel” albo „brak wpisów”.
  - Cel wyłączony (`workoutsGoalOn` / `kmGoalOn` = false): sama wartość bez „/ cel”, pusty pasek, prawa kolumna „—”.
  - Zakres dat nad kartą jak dziś („pn 16 – nd 22.11”).
- **Nawyki na dziś**: siatka zawsze 4 kolumn (jak makieta). Kafelek = przycisk `aria-pressed`, nazwa + pole odhaczenia, pod spodem passa:
  - dni: „1 dzień z rzędu”, „N dni z rzędu”; tygodnie (X/tydz.): „N tyg. z rzędu”; 0 → „zacznij passę” bez ikony;
  - ikona płomienia (Lucide `Flame`) przy passie ≥ 1; od 3 kolor `#c2410c`, poniżej szary;
  - które nawyki: zaplanowane dziś + nawyki X/tydz.; licznik „odhaczone / wszystkie” w nagłówku sekcji;
  - kliknięcie odhacza/odznacza (istniejące `toggleHabit` z `useTodayStore`);
  - bez nawyków: jeden kafelek przerywany „Utwórz nowy nawyk” otwierający okno nowego nawyku (istniejące okno z modułu Nawyki), bez licznika.
- **Plan dnia**: nagłówek „Plan dnia” + „00:00–24:00 · N bloków” (odmiana: 1 blok, 2–4 bloki, 5+ bloków, 0 bloków). Ramka z listą:
  - wiersz godziny (56 px etykieta) z blokiem: tło i obramowanie koloru kategorii, tytuł, „HH:MM–HH:MM · Kategoria”, po prawej odznaka „x/y” zadań; trwający blok ma odznakę „Teraz” i pierścień; trening ma odznakę „plan” albo „zrobione”, prowadzi do `/sport` (tylko do odczytu);
  - przerwy: od 00:00 do pierwszego wpisu, między wpisami (gdy > 0 min) i od końca ostatniego wpisu do 24:00, z przerywaną linią i tekstem „N h M min wolne”/„N min wolne”/„N h wolne”; przerwa ≥ 3 h jest wysoka (`gap-big`);
  - na końcu pusty wiersz „23:00” — tylko gdy żaden wiersz (przerwa ani wpis) nie startuje o 23:00 lub później;
  - pusty dzień: jedna przerwa „24 h wolne”, pod nią „Nie masz jeszcze bloków na dziś.” i przycisk „Dodaj pierwszy blok”, potem pusty wiersz 23:00;
  - nakładające się wpisy idą po kolei według startu, bez przerw między nimi;
  - klik w blok otwiera istniejący `BlockPopover` (zadania, edycja, usuwanie); klik w przerwę otwiera „Nowy blok” od początku przerwy (pełna godzina w górę, max 23:00);
  - czerwona linia „teraz” i siatka z przeciąganiem znikają z Dziś (zostają w kalendarzu).
- **Stan pusty**: `EmptyToday`, `first-steps.ts` i `showFullToday` znikają; nowe konto widzi pełny układ z zerami.

## Poza zakresem

- Wygląd Dziś na telefonie (CMToday) — Etap 3. Telefon dostaje tylko zmiany z punktu B.
- Szybkie dodawanie Ctrl+K na webie (S2QuickAdd) — nie istnieje w kodzie, nie dokładamy.

## Kolejność wdrożenia

Migracja idzie **po** wdrożeniu kodu na Vercel: nowy kod działa też na starej bazie (nie tworzy luźnych zadań, a luźne zadania, które już istnieją, przez kilka minut przed migracją mogą liczyć się w licznikach telefonu; migracja je usuwa), a stary kod na nowej bazie wywracałby się przy tworzeniu luźnych zadań.

## Decyzje Claude (do „Do decyzji”)

1. Zadania przy usuwaniu bloku/wystąpienia/serii są usuwane, a przy zmianie wzorca przenoszone tylko na dni, które zostają w serii.
2. Szybkie dodawanie na telefonie traci rodzaj „Zadanie”.
3. Nawyki X/tydz. widać na Dziś każdego dnia.
4. Wartość „Nawyki N % dni z celem” = dotychczasowy procent z karty tygodnia.
5. Wyłączony cel → pusty pasek i „—”.
6. Próg wysokiej przerwy: 3 h. Klik w przerwę tworzy blok.
