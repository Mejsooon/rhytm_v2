# Tabele v3 — projekt (pakiet 1 serii „nowe makiety”)

Data: 2026-11-26. Wiążące makiety: `S2Table` (wszystkie warianty: `S2Books`, `S2Main`, `S2Projects`, `S2Websites`,
`S2Passwords`, `S2Vault*`, `S2TableMenu`, `S2ColumnMenu`, `S2FilterPopover`, `S2CardDialog`, `S2CardMenu`, `S2AddField`,
`S2PageMenu`, `S2SidebarCollapsed`), `S2EmptyPage`, `S2NewPage`, `S2ImportCSV`, `S2ImportCSVMap`, `S2Sidebar`.
Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots <Nazwa>` (od 26.11 `support.js` poprawnie renderuje tabele z kanwy).

## Po co

Mejson przerobił na kanwie wygląd i działanie stron z tabelą: tabela ma być narzędziem jak w Notion
(widoki w zakładkach, grupowanie, tablica, zaznaczanie wielu wierszy, szukanie, CSV), a szablony mają polskie nazwy.
Aplikacja ma wyglądać i działać jak makiety — makiety wygrywają z tym dokumentem.

## Decyzje Mejsona (26.11, pytania przed pakietem)

1. Istniejące strony z angielską nazwą szablonu (`Subscriptions`, `Books`, `Projects`, `Websites`) dostają polską nazwę
   migracją — **tylko gdy tytuł jest nadal domyślny**; strony przemianowane przez użytkownika zostają.
2. Import CSV (z ekranem dopasowania kolumn) i eksport CSV — **w tym pakiecie**.
3. Karta „Plan Free … Przejdź na Pro” i link „Pomoc i opinie” w pasku bocznym — **ukryte** do pakietów 7 i 5.
4. Istniejące strony z szablonów **dostają gotowe widoki szablonu** (zakładki jak w makiecie).

## Zakres (różnice aplikacja → makieta)

Już jest i zostaje (dopasować wygląd do makiety): filtr, sortowanie, menu kolumny, podsumowania w stopce,
karty statystyk, pokazywanie dat w kalendarzu, edycja w komórce, okienko opcji, cofanie w tostach, sejf Haseł.

Nowe:
1. **Nagłówek strony:** okruszki „Strony / Nazwa”, przycisk główny po prawej z rzeczownikiem szablonu
   („Nowa książka”, „Nowa subskrypcja”, …; pusta tabela: „Nowy wiersz”), tytuł bez ikony jak w makiecie, opis szablonu.
2. **Widoki w zakładkach:** „Wszystkie” + zapisane widoki z liczbą wierszy, „+ Widok”, menu widoku (Zmień nazwę,
   Duplikuj widok, Usuń widok), „Zapisz jako widok” w filtrze. Widok zapamiętuje: filtry, sortowanie, grupowanie,
   układ (tabela/tablica), ukryte pola, szukaną frazę nie.
3. **Pasek narzędzi:** przełącznik Tabela/Tablica, „Grupuj: pole”, Filtruj, sortowanie, Pola (widoczne pola),
   szukajka, menu „⋯” (Nowa kolumna, Dodaj kartę statystyki, Importuj z CSV…, Eksportuj całą tabelę (CSV), Usuń tabelę;
   Hasła: stałe kolumny, Zablokuj teraz, Zresetuj sejf…).
4. **Tabela:** kolumna zaznaczania i numer wiersza, grupy zwijane z odznaką opcji, liczbą i podsumowaniem grupy,
   strzałka sortowania w nagłówku, stopka „Nowy wiersz” + opis liczby wierszy, puste stany
   („Pusta tabela. Dodaj pierwszy wiersz”, „Nic nie pasuje do filtrów. Wyczyść filtry i szukanie”).
5. **Zaznaczanie wielu wierszy:** pasek akcji (Duplikuj, Eksport CSV, Usuń, ustawienie pola wyboru jak w makiecie).
6. **Tablica (kanban):** kolumny według pola wyboru/statusu grupowania, karty z polami, przeciąganie zmienia wartość,
   dodawanie karty w kolumnie.
7. **CSV:** eksport całej tabeli i zaznaczonych wierszy; import z plikiem → ekran dopasowania kolumn (`S2ImportCSVMap`),
   nowe kolumny tworzone jak w makiecie. Hasła: bez eksportu sekretów (sejf) — kolumny Sekret pomijane.
8. **Szablony po polsku** (nazwy, opisy, rzeczowniki przycisku) i **gotowe widoki szablonów** (z makiety: Książki —
   Czytam / Do przeczytania / Przeczytane w 2026; Subskrypcje — Aktywne / Odnowienie w 14 dni / Wstrzymane; Projekty
   i Strony WWW według makiety). Istniejące strony dostają widoki przy pierwszym wczytaniu, gdy blok nie ma żadnych
   (bez migracji danych tabeli).
9. **Pusta strona (`S2EmptyPage`):** „Dodaj ikonę”, „albo zacznij od” (Tabela, Lista zadań, Nagłówek, Tekst),
   karta „Wolisz gotowca? … Użyj szablonu”, przycisk „Szablony” w nagłówku.
10. **Nowa strona (`S2NewPage`):** podgląd pól, widoków i grupowania szablonu, nazwa strony, „Pokaż wszystkie”.
11. **Pasek boczny:** menu strony w pasku bocznym (`S2PageMenu`), schowany pasek z ikonami stron
    (`S2SidebarCollapsed`); karta planu i „Pomoc i opinie” ukryte (decyzja 3).

Poza zakresem: telefon (pakiet 6), plan Free/Pro i limity (pakiet 7), kosz jako ekran (pakiet 5).

## Podejścia

- **A (wybrane): rozbudowa obecnego `PageTable` + `use-table-store`.** Ustawienia widoków w istniejącym JSONB treści
  bloku (`TableSettings` → `views[]`, `active_view`), bez migracji schematu. Tablica jako drugi renderer tych samych
  wierszy. Plusy: zachowuje edycję, sejf, odnowienia i testy; minusy: duże pliki rosną — przy okazji wydzielić
  tablicę, pasek narzędzi i CSV do osobnych komponentów (płasko, bez pomocników skaczących po plikach).
- B: nowy komponent tabeli od zera według `S2Table`. Odrzucone — ryzyko regresji sejfu, odnowień i podsumowań.
- C: widoki w osobnej tabeli bazy. Odrzucone — niepotrzebna migracja; widoki należą do bloku i kopiują się z nim.

## Dane i migracje

- `TableSettings` dostaje `views: { id, name, filters, sort, group_by, layout, hidden_field_ids }[]` i `active_view_id`.
  „Wszystkie” to ustawienia bazowe bloku. Walidacja w `schemas.ts`.
- Migracja `…_szablony_po_polsku.sql`: zmiana tytułów stron z domyślną angielską nazwą szablonu na polską
  (warunek: `template_key` i tytuł równy staremu domyślnemu). Nie usuwa danych. Test pgTAP. Uruchamia Mejson.
  Kod musi działać przed i po migracji (tytuły to zwykły tekst).
- Gotowe widoki dla istniejących stron: dopisywane przez kod przy wczytaniu bloku z `template_key` bez `views`
  (jednorazowo zapisane w treści bloku).

## Kryteria gotowości

- Zrzuty `e2e/visual.spec.ts` dla Książek, Subskrypcji, Projektów, Haseł, pustej strony i nowej strony zgodne z makietami.
- Testy jednostkowe modelu (widoki, grupowanie, CSV: cudzysłowy, przecinki, polskie liczby i daty) i e2e
  (widok zapisany i przełączany, grupowanie, tablica z przeciąganiem, import i eksport CSV, zaznaczanie wielu wierszy).
- Sejf: żaden sekret nie trafia do CSV ani do wyszukiwania.
- Lokalnie `test`, `typecheck`, `lint`; CI zielone; przegląd całej gałęzi.

## Zostawione wykonawcy

Szczegóły interakcji nieopisane w makiecie (np. kolejność kolumn przy imporcie, limit rozmiaru pliku CSV — proponuję 1 MB)
rozstrzyga wykonawca i zapisuje w „Do decyzji”.
