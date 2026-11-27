# Pakiet 3C: szczegóły ćwiczenia i szablony (web)

Uzupełnia `2026-11-27-sport-v2-design.md`. Makiety `S2ExerciseDetail`, `S2WorkoutTemplates`. Telefon później. Bez migracji.

## Decyzje Mejsona (27.11)
- Cel na ostatnią serię: **+1 powtórzenie, a po dojściu do góry zakresu z szablonu +2,5 kg i dół zakresu**.
- Ćwiczenia na czas i dystans: **ten sam układ z właściwymi liczbami**, bez 1RM i bez celu.
- Szablony: **zmienić tekst** (serie zostają puste, wynik w „Poprzednio”).

## Szablony
Lista i edytor zgadzają się już z makietą (z kodu); zmienia się opis pod tytułem na:
„Gotowa lista ćwiczeń i serii. „Rozpocznij” tworzy trening, a wyniki z ostatniego razu widać w kolumnie „Poprzednio”.”

## Szczegóły ćwiczenia — co musi działać (z makiety i jej skryptu)
- Nagłówek: okruszki, przełącznik „Z masą ciała”, „Zmień nazwę”.
- Podtytuł: „Klatka · Sztanga · 11 treningów od 03.09.2026 · w szablonie „Push””, plakietka „z masą ciała”.
- Cztery liczby w jednej karcie z dopiskiem: szac. 1RM (zmiana w zakresie), treningi, serie robocze (na trening), objętość (na trening).
- Wykres: przełącznik miary (szac. 1RM / najcięższa seria / objętość) i zakresu (8 tyg. / Wszystko), duża liczba ze zmianą, linie siatki, punkty (ostatni zielony), **po najechaniu pionowa linia i dymek** (data, wartość, najlepsza seria albo liczba serii).
- Historia: wiersze (data, serie, 1RM, objętość, „rekord”) **rozwijane** do tabeli serii z „Otwórz trening” i opisem; 5 wierszy i „Pokaż wszystkie (N)” / „Pokaż mniej”.
- „Następny trening”: nazwa, termin, cel na ostatnią serię z wynikiem z ostatniego razu, „Rozpocznij trening”.
- „Rekordy”: szac. 1RM, najcięższa seria, najwięcej powtórzeń, objętość treningu, z datami i plakietką „nowy”.

## Moje decyzje (z kosztem pomyłki)
- „Następny trening” to najbliższy (do 14 dni) zaplanowany trening z tym ćwiczeniem albo wystąpienie szablonu; gdy go nie ma, karty nie ma. Koszt: pokazać pustą kartę.
- Cel liczy się z ostatniej serii roboczej ostatniego treningu i zakresu z szablonu; bez zakresu („AMRAP”, brak szablonu) i przy samej masie ciała to zawsze +1 powtórzenie.
- „8 tyg.” to ostatnie 8 tygodni od dziś; „nowy” to rekord z ostatniego treningu.
- Czas: najdłuższa seria i łączny czas; dystans: najdłuższy dystans, najdłuższy czas i łączny dystans.
- Przełącznik „Z masą ciała” jest ukryty dla czasu i dystansu (rodzaj zmienia się w edycji z dziennika).
- Rozgrzewka (R) nie liczy się nigdzie; drop set (D) tylko do objętości.

- „rekord” przy treningu w historii znaczy jak w dzienniku: nowy rekord ciężaru w chwili treningu (makieta zaznacza tylko obecne maksima). Koszt: zmiana warunku.

## Poza zakresem
Telefon (`CMExerciseDetail`, `CMWorkoutTemplates`) — ekran telefonu zostaje, jak jest, i dla czasu/dystansu pokazuje „—”.

## Kolejność prac
1. Liczby i cel w osobnym module z testami.
2. Dane (następny trening, szablony) w loaderze.
3. Ekran web z wykresem i rozwijaniem.
4. Tekst szablonów, e2e, przegląd, PR.
