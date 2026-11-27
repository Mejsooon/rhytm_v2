# Nawyki i sen v2 (pakiet „Dziś, Nawyki i sen”, część B)

## Po co
Web jest za kanwą. Makiety `S2Habits`, `S2HabitDetail`, `S2HabitDialog`, `S2SleepDialog`, `S2HabitsArchive`, `S2HabitsEmpty` są wiążące, razem z ich skryptami. Tylko web.

## Decyzje Mejsona
- Cel „Ilość”: małe okienko (− / +, pole liczby, „Cały cel”); dzień liczy się po osiągnięciu celu.
- „Pora snu”: nowe pole obok celu snu, domyślnie 23:00; koniec okna = pora snu + cel.

## Zakres

### Lista „Nawyki i sen”
- Nagłówek: „Archiwum (n)” (gdy n > 0), „Wpis snu”, „Nowy nawyk”. Pod tytułem: „Wtorek, 17 listopada · 3 z 8 nawyków zrobione dziś · ostatnia noc 7:12 snu”.
- Cztery kafle statystyk znikają (nie ma ich na makiecie).
- Karta Nawyki: pasek „3/8 dziś”, tydzień z klikalnymi dniami (dziś i wcześniejsze), przycisk odhaczenia, menu wiersza (Szczegóły i historia, Edytuj, Archiwizuj, Usuń nawyk), 6 wierszy i „Pokaż wszystkie (8)” / „Zwiń”.
- Po archiwizacji pasek „Zarchiwizowano „X”. Historia zostaje.” z „Cofnij”.
- Karta Sen: 14 / 30 dni; „Średnio”, „Cel osiągnięty”, „Regularność ±N min”; zakładki „Czas snu” i „Pory snu” (oś 21:00–09:00, noce z zaśnięciem w ±30 min od pory snu na zielono, dymek, „Okno snu 23:00–07:00”); „Ostatnia noc” z „Edytuj”.
- Heatmapa: Miesiąc / 3 / 6 mies. / Rok jak dziś, dymki według makiety.

### Archiwum (`/nawyki/archiwum`)
Wiersze „zarchiwizowany 02.11 · najdłuższa seria 21 dni · 64 odhaczenia”, „Przywróć”, „Usuń na zawsze”, pusty stan „Archiwum jest puste.”. Po przywróceniu seria liczy się dalej.

### Szczegóły nawyku
Nagłówek: „Edytuj” i „⋯” (Archiwizuj, Usuń nawyk…). Okno usuwania: „Zniknie też historia: N odhaczeń i M notatek…”, przyciski Anuluj / Archiwizuj / Usuń na zawsze. Kafle „Obecna seria”, „Najdłuższa seria”, „Skuteczność · 30 dni”, „Łącznie”; miesiąc (zrobione / pominięte / dzień bez nawyku, klik przełącza), notatki, historia harmonogramu.

### Okno nawyku
„Cel na dzień”: „Zrobione / nie” albo „Ilość” (liczba i jednostka); harmonogram i opis pod nim, przypomnienie z wyborem godziny, „Pokazuj na ekranie Dziś” — teksty z makiety.

### Cel „Ilość”
Klik w przycisk odhaczenia takiego nawyku (lista, Dziś) otwiera okienko; przycisk pokazuje częściowy postęp („1 z 2 l” w nazwie dostępnej). Dni w przeszłości (siatka tygodnia, miesiąc) przełączają od razu cały cel.

### Okno snu
Układ i teksty z `S2SleepDialog` (to, czego jeszcze brakuje).

### Nowe konto
Układ `S2HabitsEmpty`, gdy nie ma żadnego nawyku ani wpisu snu.

### Ustawienia
Pole „Pora snu” w karcie celów obok celu snu.

## Podejścia (jak przechowywać dane)
**Archiwum**
- **Wersja harmonogramu „paused” (wybrane):** archiwizacja dopisuje wersję od dziś, przywrócenie dopisuje poprzedni harmonogram. Przerwa nie psuje serii, historia sama to pokazuje, a przypomnienia w bazie już pomijają nieznany typ.
- Osobna tabela przerw: to samo w drugim miejscu.
- Sama data archiwizacji: po przywróceniu seria by przepadła, wbrew makiecie.

**Ilość**
- **Osobna tabela częściowego postępu (wybrane):** wiersz w `habit_checks` powstaje dopiero po osiągnięciu celu, więc serie, heatmapa, przypomnienia, eksport i telefon działają bez zmian.
- Liczba w `habit_checks`: każde miejsce czytające odhaczenia musiałoby sprawdzać cel.

## Migracja (Mejson, przed scaleniem)
- `habit_schedules.schedule_type` dopuszcza `paused`.
- `habits.goal_qty numeric` i `habits.goal_unit text` (puste = „Zrobione / nie”).
- Tabela `habit_progress (habit_id, user_id, date, qty)` z RLS.
- `profiles.sleep_bedtime time not null default '23:00'`.
- Test pgTAP. Niczego nie usuwa. Eksport danych obejmuje nową tabelę.

## Poza zakresem
Telefon (poza tym, że zarchiwizowane nawyki znikają też z jego list), limit planu Free, dzwonek.

## Decyzje Claude'a (do potwierdzenia)
| Decyzja | Koszt pomyłki |
|---|---|
| „Usuń” zawsze z potwierdzeniem, bez „Cofnij” po usunięciu (jak w Sporcie) | dodatkowy klik; „Cofnij” wymagałoby miękkiego usuwania |
| Przerwa z archiwum nie psuje też serii tygodniowej (X razy w tygodniu) | mała zmiana w liczeniu |
| Zmiana celu ilościowego nie przelicza przeszłych dni (jak harmonogram) | stare dni zostają ze starym wynikiem |
| Na telefonie nawyk z „Ilość” odhacza się jednym stuknięciem jako cały cel | brak częściowego wpisu na telefonie do pakietu Telefon |
| Zarchiwizowany nawyk nie liczy się od dnia archiwizacji; dni wcześniejsze zostają w heatmapie i procentach | jeden warunek |

## Co zostaje dla wykonawcy
Układ plików i nazwy; testy serii z przerwą, regularności i okna snu, ilości; e2e dla archiwum i ilości.
