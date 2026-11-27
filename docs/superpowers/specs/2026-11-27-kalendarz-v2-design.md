# Pakiet 2: Kalendarz (seria „nowe makiety”)

Makiety: `S2Calendar`, `S2SettingsCalendar` (wiążące dla wyglądu). Tylko web; telefon w pakiecie Telefon.

## Decyzje Mejsona

- Warstwy zapamiętywane na koncie (migracja).
- Jedna warstwa „Odnowienia”; wybór źródeł zostaje przełącznikiem w kolumnie tabeli (`show_in_calendar`).
- Zakładka Ustawienia → Kalendarz wchodzi w tym pakiecie.
- Warstwa „Treningi” chowa tylko wpisy z modułu Sport, nie bloki kategorii „Sport”.
- Blok poza godzinami siatki: siatka rozszerza się w tym tygodniu albo dniu.
- Przy okazji: błędy 2 i 3 z audytu.

## Dane (`profiles`, nowe kolumny)

| kolumna | typ | domyślnie |
|---|---|---|
| `calendar_view` | `day` / `week` / `month` | `week` |
| `calendar_from_hour` | 0–20 | 7 |
| `calendar_to_hour` | 4–24, co najmniej `from + 4` | 23 |
| `calendar_block_min` | 30 / 60 / 90 | 60 |
| `calendar_week_numbers` | bool | true |
| `calendar_show_sport` | bool | true |
| `calendar_show_renewals` | bool | true |

RLS i granty dziedziczą po tabeli. „Pokazuj odnowienia” w ustawieniach i warstwa „Odnowienia” to ta sama kolumna.

## Kalendarz (web)

- Lewy panel we wszystkich widokach: mini-kalendarz z numerami tygodni, kategorie (checkboxy, „+”), warstwy, suma godzin okresu. Chowany przyciskiem w nagłówku, stan w ciasteczku.
- Nagłówek: przycisk panelu, „Dziś”, strzałki, tytuł, podtytuł, segment widoków, „Nowy blok”. Znika menu „Kategorie”.
- Siatka: zakres z ustawień rozciągnięty na całą wysokość, etykieta strefy (`GMT+1`), kolumny weekendu szare.
- Widok dnia: prawy panel „Plan dnia” (Bloki, Godziny, Zadania, lista bloków) zamiast „Dzień w liczbach”.
- Miesiąc: numery tygodni według ustawienia.
- Domyślny widok (adres bez `widok`) i domyślna długość bloku z ustawień.

## Ustawienia → Kalendarz

Zakładka „Kategorie kalendarza” zmienia nazwę na „Kalendarz” (`/ustawienia/kalendarz`, stary adres przekierowuje). Karta „Widok” nad kartą kategorii; zapis od razu.

## Podejścia

1. **Kolumny w `profiles`** (wybrane): jeden wiersz na użytkownika już istnieje i jest wczytywany przez kalendarz.
2. Osobna tabela `calendar_settings`: czystsza, ale nowe RLS, granty i obsługa braku wiersza.
3. Ciasteczko albo localStorage: bez migracji, ale warstwy nie przechodzą między urządzeniami.

## Do decyzji (moje, z kosztem pomyłki)

- Numery tygodni domyślnie włączone (`S2Calendar` je pokazuje, `S2SettingsCalendar` ma przełącznik wyłączony). Koszt: zmiana wartości domyślnej.
- Telefon bez zmian: domyślny widok i godziny siatki działają tylko na webie. Koszt: drobna poprawka w pakiecie Telefon.

## Wdrożenie

Migracja idzie przed kodem; uruchamia ją Mejson. Kod scalany po jego potwierdzeniu i „scal do main”.
