# Centrum powiadomień (część B2)

## Po co
Przypomnienie, które przyszło jako push (albo przepadło, bo push jest wyłączony), nie zostaje nigdzie w aplikacji. Makiety `S2Notifications`, `S2NotificationsEmpty` i dzwonek w `S2Sidebar` są wiążące razem ze skryptem. Tylko web.

## Decyzje Mejsona (2026-11-27, 28)
- Trzy rodzaje: start bloku, nawyk, odnowienie subskrypcji. Rekordy i serie nie wchodzą.
- Cicha noc: przypomnienie trafia na listę, bez pusha.
- Kliknięcie oznacza jako przeczytane i otwiera blok, nawyk albo stronę.

## Zakres
- Dzwonek w nagłówku paska bocznego (także na szynie), z kropką i liczbą nieprzeczytanych w nazwie przycisku.
- Panel: „Wszystkie” / „Nieprzeczytane n”, grupy „Dziś” i „Wcześniej”, „Oznacz wszystkie jako przeczytane”, puste stany z makiety, stopka „Starsze niż 30 dni znikają same.” i „Ustawienia powiadomień”.
- Czas wpisu: dziś godzina, w ostatnim tygodniu skrót dnia, starsze data.
- Lista odświeża się przy wejściu do aplikacji, otwarciu panelu i powrocie do karty przeglądarki.
- Na liście ląduje to, co włączone w Ustawieniach → Powiadomienia, także bez żadnego urządzenia z pushem.
- Lista zaczyna się pusta: przeszłych przypomnień nie da się odtworzyć.

## Migracja (Mejson, przed scaleniem)
- Nowa tabela `public.notifications` (rodzaj, tytuł, treść, adres, dzień, czas, `read_at`); użytkownik czyta swoje i zmienia tylko `read_at`.
- Zmiana funkcji `claim_due_notifications` i `dispatch_notifications`: wpis na listę powstaje także w cichej nocy, bez urządzeń i bez skonfigurowanych sekretów; push wychodzi na dotychczasowych zasadach.
- Czyszczenie wpisów starszych niż 30 dni w tym samym zadaniu crona.
- Test pgTAP. Migracja nie usuwa istniejących danych.

## Podejścia
- **Tabela wypełniana przez istniejące zadanie crona (wybrane):** te same reguły co push, jedno miejsce, stan przeczytania w bazie.
- Lista liczona w aplikacji przy otwarciu: bez crona, ale druga kopia reguł harmonogramów i odnowień.
- Zapis w trasie Vercel po wysłaniu pusha: pomija ciche noce i konta bez urządzeń.

## Decyzje Claude'a (do potwierdzenia)
| Decyzja | Koszt pomyłki |
|---|---|
| Przełączniki trzech rodzajów w Ustawieniach działają także bez włączonego pusha (dziś są wtedy wyszarzone) | zmiana wyglądu tej karty |
| „Przypomnienia o nawykach” zostają domyślnie wyłączone | na liście brak nawyków, dopóki się ich nie włączy |
| Odhaczenie nawyku albo usunięcie bloku nie usuwa wpisu z listy | nieaktualny wpis do 30 dni |

## Poza zakresem
Telefon, rekordy i serie, powiadomienia w czasie rzeczywistym, usuwanie pojedynczych wpisów.

## Uwaga
Lista (i push) działa tylko, gdy zadanie `rhytm-powiadomienia` (pg_cron) chodzi na produkcji. Po migracji da się to sprawdzić, czekając na pierwsze przypomnienie.

## Co zostaje dla wykonawcy
Układ plików i nazwy; testy (SQL: zapis w cichej nocy i bez urządzeń, brak duplikatów, RLS; panel i akcje; e2e).
