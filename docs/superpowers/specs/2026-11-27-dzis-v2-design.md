# Dziś v2 (pakiet „Dziś, Nawyki i sen”, część A)

## Po co
Web jest za kanwą. Makiety `S2Today`, `S2EmptyToday`, `S2QuickAdd` są wiążące, razem z ich skryptami.

## Podejścia
- **Web w dwóch częściach: A Dziś, B Nawyki i sen (wybrane przez Mejsona):** mniejsze scalenia; telefon w pakiecie Telefon.
- Web i telefon w dwóch częściach: więcej pracy i sprawdzania naraz.
- Web w jednej części: jedno bardzo duże scalenie.

Część B dostanie osobny spec. Decyzje Mejsona już zapadłe dla B: cel „Ilość” wpisywany w małym okienku (− / +, liczba, „Cały cel”); „Pora snu” jako nowe pole obok celu snu (domyślnie 23:00).

## Zakres A

### Nagłówek
- „Nowy blok” i obok przycisk „Więcej sposobów dodawania” z menu: Szybko dodaj… (Ctrl/⌘+Shift+K), Zapisz bieg, Rozpocznij trening (pusty), Dodaj aktywność, Zapisz sen, Nowy nawyk. Pozycje otwierają istniejące okna.
- Dzwonek (centrum powiadomień) nie wchodzi, należy do pakietu z nowymi ekranami.

### Ten tydzień
- Nagłówek: „pn 16 – nd 22.11 · porównanie z tyg. 46”.
- Pod wartością zmiana: „+1 vs tydz. 46”, „−4 km vs tydz. 46”, „+6 pkt vs tydz. 46”, „bez zmian”.
- Prawa kolumna nawyków: „2 z 4 dziś” (teraz „—”).

### Plan dnia
- Tylko godziny aktywne = `calendar_from_hour`–`calendar_to_hour` z Ustawień kalendarza (bez nowego pola).
- Podpis: „godziny aktywne 07:00–23:00 · 4 bloki · zmień” (link do `/ustawienia/kalendarz`).
- Ostatnia przerwa: „6 h wolne do 23:00”. Blok albo trening poza godzinami rozszerza zakres.

### Szybkie dodawanie
- Okno wg `S2QuickAdd`: pole tekstowe, „Rozumiem to tak” (typ, dzień, godzina, czwarta kolumna), opis, przykłady, „Otwórz pełny formularz”, Enter zapisuje, Esc zamyka.
- Typy jak w skrypcie makiety: bieg, siłownia (z nazwą szablonu), inna aktywność (rodzaje podstawowe i własne), sen, nawyk, w pozostałych przypadkach blok.
- Zapis istniejącymi akcjami serwera. Parser to czysta funkcja z testem.

### Nowe konto i „Pierwsze kroki”
- 6 kroków z makiety. Krok zalicza się sam z danych albo ręcznie kliknięciem pola; ręczny wybór wygrywa.
- „Ukryj listę” pokazuje pasek z „Pokaż”.
- Migracja: `profiles.first_steps jsonb not null default '{}'` i `profiles.first_steps_hidden boolean not null default false`, z testem pgTAP. Migrację uruchamia Mejson przed scaleniem.
- Pusty tydzień: „Tu pojawią się Twoje statystyki”. Pusty plan: „Brak bloków na dziś” z „Dodaj pierwszy blok”.

## Poza zakresem
Telefon, dzwonek, „Pomoc i opinie”, Nawyki i sen (część B).

## Decyzje Claude'a (do potwierdzenia)
| Decyzja | Koszt pomyłki |
|---|---|
| Porównanie liczy te same dni poprzedniego tygodnia (do dziś), nie cały tydzień; inaczej od poniedziałku do soboty prawie zawsze byłby minus | mała zmiana w liczeniu |
| Lista „Pierwsze kroki” widoczna, dopóki nie jest ukryta i nie wszystko zrobione, także gdy konto ma już dane. Istniejące konto ze wszystkim zrobionym jej nie zobaczy | jeden warunek |
| Pasek po ukryciu bez „menu Pomoc i opinie” (menu jeszcze nie ma): „Lista ukryta.” z „Pokaż”, tylko do odświeżenia strony | tekst |
| Karta tygodnia pokazuje pusty tekst, gdy nie ma żadnego treningu, wpisu snu ani odhaczenia | jeden warunek |
| Pusty plan dnia zastępuje listę przerw (wygrywa nowa makieta nad ustaleniem z 22.11) | powrót do listy |
| Nawyki na dziś znikają tylko, gdy nie ma żadnego nawyku i widać „Pierwsze kroki” (tak jak makieta nowego konta) | jeden warunek |

## Co zostaje dla wykonawcy
Układ plików i nazwy funkcji; testy jednostkowe porównania, zakresu godzin i parsera; e2e dla menu, szybkiego dodawania i „Pierwszych kroków”.
