# Pakiet 3B: dziennik siłowni i podsumowanie (web i telefon)

Uzupełnia `2026-11-27-sport-v2-design.md`. Makiety `S2GymLog`, `S2GymSummary`, `CMGym`, `CMGymSummary` (27.11 kopie w repo = kanwa).

## Decyzje Mejsona (27.11)
- Masa ciała: objętość i rekordy **jak dziś** (waga z profilu + dociążenie), inaczej niż w makiecie.
- Notatka w dzienniku należy do **ćwiczenia**, widać ją w każdym treningu.
- „Zakończ trening” **usuwa** nieodhaczone serie.
- Seria R nie liczy się do objętości ani rekordów; D liczy się do objętości, nie do rekordów.

## Dziennik — co musi działać (z makiety i jej skryptu)

Nagłówek i góra ekranu:
- przed startem: „Anuluj”, „Rozpocznij trening”, ramka „Gotowy na {nazwa}?”;
- w trakcie: „Trwa · 0:12:34”, „Zakończ trening”, „Odrzuć trening” (z potwierdzeniem);
- czas rusza po „Rozpocznij” albo po odhaczeniu pierwszej serii;
- liczniki Czas / Objętość / Serie i pasek postępu; pusty trening ma własną kartę.

Karta ćwiczenia:
- nazwa (link), plakietka rodzaju (poza „ciężar i powtórzenia”), „nowy rekord”, „2 / 4 serii”;
- menu: „Edytuj ćwiczenie”, „Usuń z treningu”;
- „Dodaj notatkę…”, chip „Przerwa 1:30” (klik: 1:00 → 1:30 → 2:00 → 3:00);
- kolumny Seria / Poprzednio / kolumny rodzaju / ✓ / ✕ (✕ po najechaniu, na telefonie brak);
- klik w numer serii zmienia typ: zwykła → R → D → F;
- klik w „Poprzednio” kopiuje wynik; odhaczenie pustej serii też go wpisuje;
- „Dodaj serię”.

Przerwa: po odhaczeniu serii pływający pasek z odliczaniem, „−15 s”, „+15 s”, „Pomiń”; po zerze „Koniec przerwy — czas na serię” na 5 s.

Dodawanie ćwiczeń: wyszukiwarka, chipy partii, zaznaczanie wielu, „ostatnio …”, „w treningu” (nieklikalne), „Dodaj N ćwiczeń”, brak wyników → „Utwórz „…””.

Własne i edytowane ćwiczenie: nazwa (unikalna), 5 rodzajów pomiaru (ciężar i powt.; masa ciała; masa ciała z obciążeniem; czas; dystans i czas), partia, sprzęt; ostrzeżenie przy zmianie rodzaju (czyści serie tego treningu).

Okno zakończenia: Czas / Objętość / Serie, nowe rekordy, „N nieodhaczonych serii zostanie pominiętych”, trudność 1–10, notatka, „Zapisz jako szablon” (tylko pusty start); „Zapisz trening” nieaktywne przy 0 zrobionych.

## Podsumowanie (po zakończeniu, `/sport/trening/[id]`)
- nagłówek: menu (Zapisz jako szablon, Duplikuj na inny dzień, Usuń trening), „Edytuj”, „Powtórz trening”;
- kafle: Czas, Objętość (↑/↓ % vs poprzedni z tego szablonu), Serie (web: „N zgodnie z planem”), Trudność (web: notatka);
- ćwiczenia: „plan 4 × 5”, plakietki serii (web) albo „4/4 serii” (telefon), „rekord”;
- web: karty „Rekordy z tego treningu”, „Notatka”, „W kalendarzu”; telefon: zielony baner rekordu i notatka.

## Dane (migracja `20261203100000_silownia.sql`, uruchamia Mejson przed scaleniem)
- `exercises`: `kind` (`wr|bw|wbw|dur|dist`, null = wynika z `bodyweight`), `equipment`, `note` (≤500), `rest_s` (0–1800, null = 90).
- `gym_sets`: `set_type` (`N|W|D|F`, domyślnie `N`), `duration_s`, `distance_km`.
- `sport_sessions`: `started_at`.
- Same nowe kolumny: stary kod działa po migracji, nic nie jest kasowane.

## Moje decyzje (z kosztem pomyłki)
- Dotychczasowe ćwiczenia z masą ciała dostają widok „masa ciała z obciążeniem” (kolumna +kg zostaje). Koszt: Mejson przełącza rodzaj w edycji.
- Rekordy tylko dla ćwiczeń z ciężarem i masą ciała; czas i dystans bez rekordów. Koszt: dopisanie reguły w części C.
- „Zgodnie z planem” i „plan 4 × 5” liczone z obecnego szablonu (powtórzenia ≥ pierwsza liczba z planu); bez szablonu ukryte. Koszt: po zmianie szablonu stare podsumowanie pokaże nowy plan.
- Przerwa należy do ćwiczenia; start z szablonu przepisuje do niego przerwę z szablonu. Koszt: osobna kolumna na trening.
- Pasek przerwy żyje w przeglądarce: znika po przeładowaniu, bez dźwięku i wibracji.
- „Rozpocznij” ustawia godzinę startu na teraz, gdy trening jest z dziś.
- „Odrzuć trening” usuwa sesję bez pomijania dnia szablonu (plan wraca). „Anuluj” tylko wraca.
- Trudność w oknie zakończenia nie jest z góry zaznaczona (makieta ma 7 jako przykład).
- „Edytuj” zakończonego treningu otwiera dziennik bez licznika, z przyciskiem „Gotowe”.
- „Powtórz trening” tworzy nowy trening na dziś z tymi samymi seriami, nieodhaczonymi.

## Poza zakresem
Szczegóły ćwiczenia i szablony (część C), powiadomienia o końcu przerwy.

## Kolejność prac
1. Migracja i test pgTAP, typy.
2. Reguły w `model.ts` (objętość i rekordy z typami serii, rodzaje, „poprzednio”) z testami.
3. Akcje i `use-gym-store`.
4. Dziennik web, potem telefon.
5. Podsumowanie web i telefon.
6. e2e, przegląd całej gałęzi, PR.
