# Poprawki webu: kontrast, grupowanie w tabeli, planowanie treningu siłowego

## Po co
Zmiany omówione przez Mejsona na czacie Cowork. Kanwa „Rhytm Design” (wersja 1795821105) zawiera nowe grupowanie w `S2Table` i planowanie treningu (`S2GymPlan`, `S2Sport`). Zmian kolorów na kanwie nie ma, więc wartości dobiera Claude (decyzja Mejsona z 2026-11-28). Tylko web, bez migracji.

## Zakres

### Kontrast (próg 4,5:1 na białym)
- `--faint-foreground` (podpowiedzi w polach i blady drobny tekst): z `rgba(104,104,104,.72)` na `#737373`.
- Czerwony przycisk z białym napisem: tło z `#ef4444` na `#dc2626`, po najechaniu `#b91c1c`; to samo zaznaczenie trudności w oknie biegu.

### Grupowanie w tabeli (`S2Table`)
- „Grupuj” i „Grupuj po tym polu” obejmują każdą widoczną kolumnę poza Sekretem (dziś Wybór, Status, Checkbox).
- Kolejność i nazwy grup: Wybór i Status jak opcje; Checkbox „Zaznaczone”, „Niezaznaczone”; Ocena od najwyższej, potem „Bez oceny”; Data po miesiącach od najnowszych, potem „Bez daty”; kwoty „do 20”, „20–50”, „50 i więcej” (w walucie profilu), potem „Bez kwoty”; reszta po wartościach alfabetycznie, potem „Puste”.
- Tablica bez zmian (kolumny tylko z Wyboru i Statusu).

### Planowanie treningu siłowego (`S2GymPlan`)
- „Trening siłowy” w menu dodawania Sportu otwiera okno: trening (Pusty albo szablon), dzień (Dziś, Jutro, Inny dzień), Od / Do z czasami 45–90 min, „Pokaż w kalendarzu głównym”.
- „Zaplanuj” zapisuje trening; przy dzisiejszym dniu jest też „Rozpocznij teraz”.
- Zaplanowany trening ma „Zmień termin” (to samo okno z „Usuń trening”).
- Inne wejścia do treningu (Dziś, ⌘K, szablony, ćwiczenie) zaczynają go od razu, jak dotąd.

## Podejścia (planowanie)
- **Istniejące sesje z datą w przyszłości i `end_local` (wybrane):** bez migracji; kalendarz i Sport już je pokazują.
- Osobna tabela planów: czystszy model, ale migracja i druga ścieżka w kalendarzu.

## Decyzje Claude'a (do potwierdzenia)
| Decyzja | Koszt pomyłki |
|---|---|
| Kolory dobrane przeze mnie, kanwa zostaje bez zmian | kanwa i aplikacja różnią się, dopóki nie naniesiesz ich na kanwę |
| Zaznaczanie zbiorcze w tabeli dalej ustawia tylko pola wyboru | brak |
| Nowy wiersz dodany w grupie dostaje jej wartość tylko dla Wyboru, Statusu i Checkboxa | w innych grupach wartość wpisuje się ręcznie |
| Okno planowania tylko z widoku Sportu | pozostałe wejścia zachowują dzisiejsze zachowanie |

## Poza zakresem
Telefon (`CMGymPlan`) w pakiecie Telefon.

## Co zostaje dla wykonawcy
Układ plików; testy grupowania, okna i akcji; e2e planowania.
