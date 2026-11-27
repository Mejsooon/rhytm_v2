# Pakiet 3: Sport i trening siłowy (seria „nowe makiety”)

## Podział (decyzja Mejsona 27.11)

| Część | Zakres | Makiety | Telefon |
|---|---|---|---|
| **A** | przegląd Sportu i „Inne aktywności” | `S2Sport`, `S2ActivityDialog`, `S2SportCalendar`, `S2SportEmpty`, `S2RunDialog` | później |
| **B** | dziennik siłowni i podsumowanie | `S2GymLog`, `S2GymSummary`, `CMGym`, `CMGymSummary` | od razu |
| **C** | ćwiczenia i szablony | `S2ExerciseDetail`, `S2WorkoutTemplates` | później |

Każda część to osobny pull request; następna startuje po sprawdzeniu poprzedniej.

Podejścia: trzy części (wybrane), dwie (cała siłownia naraz, duży PR), wszystko naraz (trudno sprawdzić).

Dla części B: seria rozgrzewkowa (R) nie liczy się do objętości ani rekordów; drop set (D) liczy się do objętości, nie do rekordów.

## Część A

### Dane (jedna migracja, przed kodem, uruchamia Mejson)
- `sport_sessions.type` dostaje wartość `other`.
- `activities`: `session_id` (PK, kaskada), `user_id`, `kind` (nazwa, 1–40), `distance_km`, `duration_s`, `difficulty`, `kcal`.
- `activity_kinds`: `user_id`, `name` (unikalna bez wielkości liter), `color`, `has_distance`. Tylko własne rodzaje i zmienione kolory; 16 rodzajów podstawowych z MET siedzi w kodzie.
- RLS „tylko własne wiersze”, testy pgTAP.

### Ekran (web)
- Nagłówek: „Szablony” i menu „Dodaj aktywność” (Bieg, Trening siłowy pusty albo z szablonu, Inna aktywność).
- Podtytuł z liczbami miesiąca, filtr Wszystko / Bieg / Siłownia / Inne, zakładki Przegląd i Kalendarz.
- Przegląd: wykres z przełącznikiem Tydzień / Miesiąc / Rok i linią celu; lista „Aktywności” pogrupowana tygodniami; karta „Ten tydzień” z celem i najbliższym planem; „Rekordy”.
- Kalendarz: obecna siatka miesiąca z kolorami aktywności.
- Okno „Nowa aktywność” jak na makiecie (rodzaj z szukaniem i własnym, kolor, status, data, start, czas, dystans tylko dla rodzajów z dystansem, kcal, trudność, notatka, „Pokaż w kalendarzu”).
- Kalendarz główny i Dziś pokazują inne aktywności tak jak treningi (warstwa „Treningi”).

### Do decyzji (moje, z kosztem pomyłki)
- Kcal innej aktywności = MET × waga z profilu × godziny (makieta liczy ze sztywnych 72 kg); bez wagi „—”. Koszt: zmiana wzoru, stare wpisy zachowują zapisaną liczbę.
- Własny rodzaj ma MET 5. Koszt: jw.
- Cel tygodnia zostaje taki jak w profilu (km albo liczba treningów); inne aktywności liczą się do liczby treningów, nie do km. Koszt: poprawka w liczeniu.
