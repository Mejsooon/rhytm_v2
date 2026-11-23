# Strony 2.0 — projekt

Data: 2026-11-22, uzupełnienie 2026-11-23 (sekcja „Zmiany po makietach”). Zatwierdzenie: Mejson zatwierdził wersję z 2026-11-22, uzupełnienie do akceptacji.

## Cel i powód

Mejson używa stron rhytm do projektów, książek i haseł (wzór: Notion). Dziś aplikacja ma dwa sposoby pokazywania tabeli:
- strona z szablonu, np. Książki: osobny widok z „+ Pole” i „Nowy wiersz” w nagłówku strony, z kartami statystyk, filtrem, sortem i panelem wiersza;
- pusta strona z blokiem tabeli, który umie znacznie mniej.

Mejson chce, żeby to było uniwersalne. Książki mają wyglądać jak zwykła strona z tabelą, wszystko ma być modyfikowalne z poziomu samej tabeli, a karty statystyk ma ustawiać sam użytkownik. Hasła mają być stałym, niemodyfikowalnym modułem, a nie stroną.

## Zakres

1. **Jeden blok tabeli.** Każdy blok tabeli na każdej stronie ma pełen zestaw funkcji, które dziś ma tylko strona z szablonu:
   - karty statystyk;
   - filtrowanie („Filtruj”);
   - sortowanie po kolumnie;
   - ukrywanie kolumn;
   - podsumowanie pod kolumną do wyboru;
   - wyróżnienie najbliższego terminu;
   - edycja w komórkach (web, punkt 8) i arkusz wiersza (telefon);
   - menu kolumny.

   Dodawanie kolumny przez „+” w nagłówku kolumn i wiersza przez „+ Nowy” pod tabelą, jak dziś w bloku tabeli. Przycisków „+ Pole” i „Nowy wiersz” w nagłówku strony już nie ma.
2. **Strony z szablonów wyglądają jak zwykłe strony.**
   - Widok `TemplatePageView` znika. Każda strona, także z szablonu, renderuje się edytorem bloków.
   - Szablon (Książki, Projekty, Strony WWW, Pusta) to tylko zawartość startowa: strona z jednym blokiem tabeli z gotowymi kolumnami, przykładowymi wierszami, kartami, sortem i podsumowaniami.
   - Opisy szablonów w oknie „Nowa strona” mają kilka słów. Pusta strona: „Zacznij od zera”, Books: „Twoje książki”, Projects: „Twoje projekty”, Websites: „Twoje strony WWW”.
   - Po utworzeniu strona niczym nie różni się od pustej strony z tabelą. Można dopisać tekst, dodać drugą tabelę i zmienić każdą kolumnę i kartę.
3. **Karty statystyk ustawiane przez użytkownika.**
   - Nad tabelą: „+ karta”, okno z wyborem pola, sposobu liczenia (lista zależna od typu pola) i napisu.
   - Na karcie: menu z edycją, usunięciem i zmianą kolejności.
   - **Szerokość karty** zmienia się przeciągnięciem prawej krawędzi (jak bloki w Notion), a z klawiatury strzałkami ←/→ na uchwycie, co 20 px. Najmniejsza szerokość to 180 px. Górnej granicy nie ma, karta najwyżej wypełnia rząd (`max-width: 100%`). Karty zawijają się do następnego rzędu, gdy się nie mieszczą. Szerokość zapisuje się w karcie (`pinned_cards[].width`, w px). Brak wartości oznacza domyślną szerokość. Na telefonie karty mają pełną szerokość, a przeciągania nie ma.
   - Sposoby liczenia: te, które już istnieją w modelu, czyli `count_option`, `count_option_of_total`, `count_option_in_year`, `avg`, `nearest_date`, `count_distinct`. Nowych sposobów liczenia nie dodajemy.
4. **Moduł Hasła.**
   - Stały ekran w sekcji Moduły paska bocznego (obok Kalendarza i Sportu) oraz w ustawieniach modułów, jeśli takie są.
   - Stałe kolumny: Serwis (tytuł), Login, Hasło (zaszyfrowane), URL, Notatka (zaszyfrowana, nowa), Kategoria (nowa; lista do wyboru z własnymi opcjami, jawna).
   - Kolumn nie da się dodać, usunąć ani zmienić ich typu. Opcje Kategorii można dodawać, zmieniać i usuwać.
   - Działa na obecnym sejfie: hasło główne, odblokowanie, reset.
   - Filtrowanie, sort i wyszukiwanie po jawnych kolumnach (Serwis, Login, URL, Kategoria) działają po odblokowaniu.
   - **Zmiana Mejsona (2026-11-23):** przy zamkniętym sejfie strona pokazuje tylko kartę „Odblokuj sejf” na środku, bez tabeli; tabela pojawia się dopiero po wpisaniu hasła.
   - Szablon „Hasła” znika z okna „Nowa strona”.
   - Typ kolumny „Hasło (zaszyfrowane)” znika z wyboru typu w zwykłych tabelach.
5. **Ikony stron: tylko czarne ikony Lucide** (decyzja Mejsona z 2026-11-22).
   - Emoji i kolory ikon znikają. Każda ikona strony to ikona liniowa Lucide w kolorze tekstu (`currentColor`), bez wyboru koloru.
   - Do wyboru jest cały zestaw Lucide z `lucide-react` (~2000 ikon). Nazwy są takie same jak na lucide.dev i w przeglądarkach typu Flowmance.
   - Wybór ikony to okno z wyszukiwarką i siatką 8 kolumn, bez zakładek Emoji/Ikony i bez kolorów. Ikonę da się też usunąć.
   - Wyszukiwanie działa po angielskiej nazwie i tagach Lucide oraz po polskich słowach dla najczęstszych ikon (lista słów jak w dzisiejszym `page-icons.ts`, przeniesiona na nazwy Lucide).
   - Ikony ładują się dynamicznie (`lucide-react/dynamic`), więc paczka aplikacji nie rośnie o cały zestaw. Pełna lista nazw do wyszukiwarki ładuje się dopiero po otwarciu okna wyboru.
   - Zapis w `pages.icon` ma postać `lucide:<nazwa>`. Pusta wartość oznacza ikonę domyślną (tabela).
   - **Migracja:**
     - emoji zamieniają się na najbliższe ikony według stałej mapy, np. 📚 → `book-open`, 💳 → `wallet`, 🔒 → `lock`, 🚀 → `rocket`, 🌐 → `globe`;
     - `lucide:<nazwa>:<kolor>` zamienia się na `lucide:<nazwa>`;
     - emoji spoza mapy daje pustą ikonę, czyli domyślną tabelę.
   - Szablony dostają czarne ikony: Books `book-open`, Projects `rocket`, Websites `globe`, Pusta strona `table`. Moduł Hasła ma ikonę `lock`.
   - Makiety: `S2PageIcon` i `S2IconPicker` na kanwie. W makiecie jest ~170 ikon, w aplikacji cały zestaw.
6. **Przeniesienie istniejących danych (migracja).**
   - Strony z szablonów zostają tymi samymi stronami. Ich blok tabeli już dziś trzyma kolumny, wiersze i ustawienia (`page_blocks.content.settings`), więc zmienia się głównie sposób wyświetlania.
   - **Stan produkcji sprawdzony 2026-11-22** (tylko struktura, bez wartości):
     - jest jedna strona z szablonu „Hasła”, z kolumnami Serwis (tekst, tytuł), Login (tekst), Hasło (secret) i URL (url) oraz 2 wierszami;
     - żadna inna tabela nie ma kolumny „secret”;
     - w koszu nie ma stron haseł.
   - **Strona „Hasła” zostaje stroną systemową modułu.**
     - Migracja oznacza ją jako systemową, dopisuje kolumny Notatka (secret) i Kategoria (select, bez opcji) i ukrywa ją z listy stron. Wiersze i zaszyfrowane wartości się nie ruszają, więc żadnego przepisywania szyfrogramów nie ma.
     - Kolumny rozpoznajemy po typie i nazwie: tytuł = Serwis, `secret` = Hasło, `url` = URL, pozostały `text` = Login.
     - Jeśli użytkownik ma kilka stron „Hasła” albo któraś ma inny układ kolumn niż te cztery, migracja przerywa się z czytelnym błędem i nic nie zmienia. Lepiej zatrzymać się, niż zgadywać i stracić dane. Na produkcji taki przypadek dziś nie występuje.
     - Jeśli użytkownik nie ma żadnej strony „Hasła”, strona systemowa powstaje przy pierwszym wejściu do modułu.
   - **Kolumny „secret” poza modułem.** Migracja przerywa się, jeśli jakakolwiek zwykła tabela ma kolumnę „secret”. Na produkcji takich nie ma. Od tej pory baza blokuje typ „secret” poza stroną systemową, więc zwykła tabela nie musi obsługiwać sejfu.
   - Migracja ma test na lokalnej bazie w CI (`supabase test db`). Test sprawdza: pasujący układ, przerwanie przy niepasującym układzie i przerwanie przy kolumnie „secret” poza modułem.
7. **Makiety na start.**
   - Przed kodem powstaje nowa strona „Strony 2.0” na kanwie „Rhytm Design”, w stylu COSS. Ekrany:
     1. uniwersalna strona z tabelą: Książki z kartami, paskiem tabeli, „+” w nagłówku kolumn i „+ Nowy”;
     2. okno „+ karta”;
     3. menu karty;
     4. Projekty w tym samym układzie;
     5. moduł Hasła w dwóch stanach, zablokowany i odblokowany, z pozycją w pasku bocznym;
     6. „Nowa strona” bez szablonu Hasła.
   - Mejson zatwierdził makiety (2026-11-22/23). Wiążący jest cały zestaw S2* ze strony „Strony 2.0” na kanwie (opis w punkcie 15). Stare CBooks, CProjects, CWebsites, CPasswords, CVault, CMain, CEmptyPage, CNewPage, CColumnMenu, CFilterPopover, CAddField i CSidebar idą do archiwum.
   - Wersje telefonowe powstają w Etapie 3.

## Poza zakresem (non-goals)

- Nowe typy pól, widoki (tablica, galeria), relacje między tabelami, formuły i nowe sposoby liczenia kart.
- Wygląd telefonu w układzie CM*. Telefon ma działać, czyli mieć arkusz wiersza i cele dotykowe ≥ 44 px, ale jego dopracowanie należy do Etapu 3.
- Udostępnianie haseł, import i eksport haseł, generator haseł.
- **Subscriptions** (decyzja Mejsona z 2026-11-23). Pełne Subscriptions z makiety S2Main to osobny projekt po przeprojektowaniu Dziś: nowy typ pola „kwota cykliczna” z przełącznikiem mies./rok, liczenie sumy w kartach z przeliczeniem cyklu i odnowienia w kalendarzu. W Stronach 2.0 szablonu Subscriptions nie ma, a makiety S2Main, S2ColumnMenu i S2FilterPopover pokazują tylko wygląd tabeli i menu.
- Zmiany w kalendarzu, sporcie, nawykach i Dziś (przeprojektowanie Dziś to osobny projekt po Stronach 2.0). Kalendarz dziś nie czyta tabel stron (`show_in_calendar` w polu daty Projektów nie ma jeszcze odbiorcy). Tak zostaje, a pokazanie terminów w kalendarzu to osobny przyszły temat.

## Anty-cele

- **Utrata danych przy migracji:** wierszy, ustawień, kart albo zaszyfrowanych haseł.
- **Pogorszenie stron z szablonów.** Wszystko, co dziś działa w Książkach, Projektach i Stronach WWW, musi dalej działać.
- **Dwie tabele w kodzie** po zakończeniu projektu.
- **Hasła widoczne jawnie w bazie albo w logach.** Notatka szyfrowana tak samo jak Hasło.

## Podejścia

| | 1. Jedna tabela z kawałków widoku szablonu — **wybrane** | 2. Rozbudowa obecnej zwykłej tabeli |
|---|---|---|
| Opis | Z istniejących komponentów widoku szablonu powstaje jeden blok tabeli dla każdej strony. Te komponenty to `column-menu`, `filter-popover`, `pinned-cards`, `row-edit`, `row-preview`, `summary-cell` i `use-table-store`. Stary `TemplatePageView` i stara część `table-block.tsx` znikają. | Do `table-block.tsx` dokładamy po kolei filtr, sort, karty, panel wiersza… |
| Za | Sprawdzony i przetestowany kod. Książki nic nie tracą. Na końcu jedna tabela. | Mniejsze kroki na początku. |
| Przeciw | Trzeba uogólnić komponenty, które zakładały „jedna tabela na stronie”. | Funkcje pisane drugi raz. Przez cały projekt dwie tabele. |

Mejson wybrał podejście 1, bo bierze sprawdzony kod i kończy się jedną tabelą do utrzymania.

Wcześniejsze decyzje Mejsona w tej rozmowie:
- każda tabela umie wszystko (wariant A, bez cięcia funkcji);
- hasła tylko w module, a typ zaszyfrowanej kolumny znika ze zwykłych tabel;
- moduł ma dodatkowo Notatkę i Kategorię;
- najpierw nowe makiety na osobnej stronie kanwy.

## Ograniczenia

- Next.js 16 + Supabase + Tailwind 4 + własne kontrolki (`@/components/controls`) w wyglądzie COSS. Bez nowych bibliotek UI.
- Makiety są wiążące i w sprawach wyglądu wygrywają z planem.
- Płaski kod bez helperów skaczących po plikach. Komentarze po polsku. W SQL aliasy zawsze z jawnym `AS`.
- Migracje bazy uruchamia Mejson (`pnpm exec supabase db push --remote`). Migracja musi być bezpieczna dla jego danych produkcyjnych i odwracalna albo przynajmniej sprawdzona testem na kopii schematu w CI.
- Testy jednostkowe i e2e przechodzą. e2e działa tylko w CI.
- Commity tylko na gałęzi, scalenie po „scal do main”.
- Zero-knowledge sejfu bez zmian: serwer nigdy nie widzi jawnego hasła ani notatki.

## Zmiany po makietach (2026-11-22/23)

Ustalone z Mejsonem na makietach S2 po zatwierdzeniu pierwszej wersji specu. Gdzie zmieniają punkty 1–7, wygrywają te poniżej.

8. **Edycja w komórkach, jak w Notion (web).**
   - Nie ma trybu edycji wiersza ani przycisków „Edytuj” i „Zapisz”. Panel wiersza na webie znika (`row-edit`, `row-preview`). Telefon zostaje przy arkuszu wiersza.
   - Tekst, liczba i URL: komórka jest stale polem tekstowym wyglądającym jak zwykły tekst. Jedno kliknięcie stawia kursor w miejscu kliknięcia. Zapis idzie przy pisaniu (z opóźnieniem jak dziś w edytorze bloków). Enter i Esc kończą edycję. Pole w komórce nie ma własnej ramki ani obwódki fokusu, a komórka w edycji ma niebieską obwódkę.
   - Lista wyboru i status: kliknięcie otwiera okienko pod komórką. Drugie kliknięcie w tę samą komórkę albo kliknięcie obok je zamyka. Wybór zapisuje od razu.
   - Data: kliknięcie otwiera kalendarz pod komórką, tak samo jak wyżej. Są skróty „Dziś” i „Wyczyść”.
   - Ocena: gwiazdki klika się od razu. Ponowne kliknięcie tej samej gwiazdki zeruje ocenę.
   - Checkbox: kliknięcie przełącza.
   - Usunięcie wiersza: kosz widoczny po najechaniu na wiersz.
   - „+ Nowy” pod tabelą dodaje pusty wiersz i ustawia kursor w pierwszej kolumnie.
9. **Opcje w polach wyboru (select i status) zmienia się z komórki.**
   - Na górze okienka jest pole „Szukaj lub dodaj opcję…”. Wpisany tekst zawęża listę. Gdy takiej opcji nie ma, na dole jest „+ Utwórz «nazwa»”. Enter tworzy opcję i od razu ją wybiera. Nowa opcja jest szara.
   - Każda opcja ma „⋯” widoczne po najechaniu. Otwiera w tym samym okienku panel: nazwa (Enter albo „Gotowe” zapisuje, zmiana przechodzi na wszystkie wiersze), kolor, „Usuń opcję” (wiersze z tą opcją zostają puste, bez potwierdzenia i bez dopisku o liczbie wierszy), „Wstecz”.
   - Kolory to obecna paleta 8 kolorów (`PALETA`) plus „bez koloru”, z polskimi nazwami.
10. **Szerokość kolumn i przewijanie tabeli.**
    - Prawa krawędź nagłówka kolumny to uchwyt (niebieska kreska po najechaniu). Przeciąganie zmienia szerokość tylko tej kolumny. Z klawiatury: strzałki ←/→ na uchwycie, co 20 px. Najmniejsza szerokość 80 px, bez górnej granicy.
    - Szerokości zapisują się w ustawieniach bloku tabeli (`content.settings`), obok sortu i filtrów. Brak wartości oznacza szerokość domyślną dla typu pola.
    - Tabela ma stały układ kolumn (`table-layout: fixed`). Ostatnia kolumna, z „+” do dodania pola, wypełnia resztę ramki. Gdy kolumny są szersze niż ramka, tabela przewija się w poziomie, a na dole ramki jest cienki suwak.
11. **Karty statystyk.** Wygląd i zachowanie jak w punkcie 3, we wszystkich tabelach: menu karty, uchwyt szerokości i „+ Karta” na końcu rzędu.
12. **Moduł Hasła w tej samej tabeli.**
    - Edycja w komórkach jak w punkcie 8. Hasło i Notatka są ukryte kropkami. Przy wierszu po najechaniu: oczko (pokaż/ukryj w tym wierszu) i kopiowanie hasła.
    - Przy zamkniętym sejfie tabela jest tylko do odczytu, a komórki szyfrowane pokazują „zablokowane”.
    - Opcje Kategorii w okienku „Kategorie” i w komórkach to ta sama lista.
    - Pasek górny modułu ma tylko „Zablokuj teraz”. Nowy wiersz dodaje „+ Nowy” pod tabelą.
13. **Chowany pasek boczny (web).**
    - W nagłówku paska bocznego, obok „rhytm”, jest przycisk „Schowaj pasek boczny”. Po schowaniu treść zajmuje całą szerokość, a w górnym pasku przed okruszkami pojawia się „Pokaż pasek boczny”.
    - Skrót Ctrl+\ (⌘+\ na Macu) przełącza pasek. Stan zapamiętuje przeglądarka (`localStorage`), więc zostaje po odświeżeniu.
    - Na telefonie bez zmian.
14. **Onboarding bez Subscriptions.** Do czasu projektu Subscriptions krok 5 nie pokazuje Subscriptions, bo aplikacja nie ma takiego szablonu (dziś wybór jest po cichu pomijany). Zapisane w `pending_pages` „Subscriptions” jest pomijane bez błędu, tak jak „Passwords”.
15. **Wiążące makiety (strona „Strony 2.0” na kanwie).**
    - Strony i tabele: S2Books, S2Projects, S2Websites, S2EmptyPage, S2NewPage, S2AddField, S2CardDialog, S2CardMenu, S2TableMenu, S2ColumnMenu, S2FilterPopover, S2PageMenu.
    - Hasła: S2Passwords, S2Vault, S2VaultSetup, S2VaultReset.
    - Powłoka i komponenty: S2Sidebar, S2SidebarCollapsed, S2IconPicker, S2PageIcon, S2OnbPreview.
    - Onboarding: S2Onboarding*.
    - S2Today i S2EmptyToday należą do projektu Dziś, S2Main do projektu Subscriptions.
    - Przed planem kopie makiet trafiają do `docs/design/mockups` w repo.

## Kolejność wdrożenia (decyzja Mejsona z 2026-11-23)

Każdy krok to osobna gałąź, osobny plan i scalenie po „scal do main”:

1. **Fundament stron i powłoka:** jeden blok tabeli z funkcjami dzisiejszego widoku szablonu (punkt 1: karty do odczytu, filtr, sort, ukrywanie, podsumowania, menu kolumny, najbliższy termin), szablony jako zawartość startowa (punkt 2), przeniesienie istniejących stron, ikony Lucide (punkt 5), chowany pasek boczny (punkt 13). Wiersze edytuje się w tym kroku jeszcze trybem edycji wiersza, jak dziś w Books. Strona „Hasła” zostaje na starym widoku do kroku 3, bo trzyma sejf. Migracja danych najpierw na kopii bazy w CI.
2. **Tabela jak w Notion:** punkty 3 i 8–11 (edycja w komórkach zamiast trybu wiersza, opcje, szerokości kolumn, przewijanie, karty użytkownika z „+ Karta” i szerokością).
3. **Hasła i onboarding:** punkty 4, 6 (część haseł), 12 i 14 oraz zmiany onboardingu z „Decyzji Claude”, z osobnym przeglądem bezpieczeństwa.

### Decyzje po kroku 1 (Mejson, 2026-11-23)

Krok 1 scalony do main (adba866).
- „Usuń tabelę” w menu „⋯” działa bez potwierdzenia, bo usunięcie jest miękkie i ma „Cofnij”.
- „Szablony” zostają w nagłówku pustej strony (S2EmptyPage).
- Opis pod tytułem strony to zwykły tekst, nie szary. Makiety S2Books, S2Projects i S2Websites są poprawione.
- Przesuwanie kolumn to pozycje „Przesuń w lewo” i „Przesuń w prawo” w menu kolumny, jak w kodzie. S2EmptyPage jest poprawiona.
- **Dochodzi do kroku 2:** „Nowa strona” w pasku bocznym otwiera wybór szablonu z opcją „Pusta strona” (S2NewPage), zamiast tworzyć pustą stronę.
- Drobne uwagi z przeglądów kroku 1, odłożone do kroku 2: migające ikony przy ładowaniu (`DynamicIcon`) i jednorazowa funkcja `page_icon_lucide` zostawiona w bazie. Do tego rollback `moveField` cofa całą listę pól, a „Przesuń w lewo” pozwala przesunąć kolumnę przed tytuł.

### Decyzje po kroku 2 (Mejson, 2026-11-23)

Krok 2 scalony do main (d4a1564). Pakiet poprawek przed krokiem 3 (gałąź `feat/strony-2-poprawki`):
- Kalendarz (`DatePicker`) wszędzie według makiet S2: dymek 256 px, dni bezszeryfowe 13 px, dzisiejszy dzień z szarym tłem zamiast ramki.
- Tekst we wszystkich kolumnach tabeli jest ciemny. Szare zostają tylko puste komórki („—”) i dopiski (np. czas do terminu). Bez ustawienia „przygaszona”.
- URL w komórce wygląda jak zwykły tekst, podkreśla się po najechaniu i dalej otwiera adres.
- „Pusta strona” z wyboru szablonu tworzy stronę bez tabeli, z szybkim startem „albo zacznij od:”.

Po Stronach 2.0: projekt Dziś (wariant F, pusty stan, zadania tylko w blokach), potem Subscriptions, potem telefon (Etap 3).

## Decyzje Claude (do sprawdzenia przez Mejsona)

- **Przyciski tabeli należą do tabeli, nie do strony.** Strona może mieć kilka tabel. Nad każdą tabelą stoją jej karty, a pod nimi pasek z nazwą tabeli, „Filtruj” i menu „⋯” (ukryte kolumny, sort, usuń tabelę). Dokładny wygląd ustalą makiety.
- **Przechowywanie haseł.** Moduł korzysta z obecnych tabel stron (`page_blocks`/`page_fields`/`page_rows`) przez jedną stronę systemową użytkownika ukrytą z listy stron. Dzięki temu funkcje sejfu (`count_secrets`, `reset_vault`) i szyfrowanie działają bez przepisywania. Stałość kolumn pilnuje i interfejs, i baza (wyzwalacz: zakaz dodania, usunięcia i zmiany typu pól tej strony). Alternatywa to osobna tabela `vault_entries`. Wymagałaby przepisania funkcji resetu i migracji zaszyfrowanych danych między tabelami, więc wyższe ryzyko.
- **Typ „secret” w bazie** zostaje dozwolony tylko na stronie systemowej haseł. Wyzwalacz blokuje go gdzie indziej. Istniejące kolumny „secret” poza stronami haseł zostają nietknięte i zgłaszamy je Mejsonowi.
- **Kategoria w haśle jest jawna,** jak Serwis i Login, żeby filtr działał przy zamkniętym sejfie.
- **Okno „+ karta”.** Okno pokazuje dodatkowe wybory tylko wtedy, gdy wybrany sposób liczenia ich potrzebuje:
  - opcję do liczenia przy `count_option*`;
  - pole daty przy `count_option_in_year`;
  - opcję „zrobione” przy `nearest_date`, przy czym pole tytułu dobiera się samo, bo to tytuł tabeli.

  Jednostki w trzech formach nie są ustawiane w oknie. Karty użytkownika pokazują samą liczbę, a karty z szablonów zachowują swoje jednostki. W napisie działa znacznik roku: przy `count_option_in_year` domyślny napis to „… w {year}”, a „{year}” wyświetla się jako bieżący rok. Dzięki temu usuniętą kartę „Przeczytane w 2026” da się odtworzyć ręcznie.
- **Onboarding (decyzja Mejsona).**
  - Krok 3 nie ma już kafelków celów, ani zablokowanych (Plan tygodnia, Treningi, Nawyki i sen, Hasła), ani kafelków stron (Subskrypcje, Projekty, Książki). Kafelki stron dublowały krok 5.
  - Zamiast nich krok 3 ma linijkę „Zawsze masz: Plan tygodnia · Treningi · Nawyki i sen · Hasła” oraz cele treningowe i cel snu, jak dziś.
  - Tytuł kroku 3 to „Twoje cele”, a podtytuł „Zmienisz je później w Ustawieniach.”.
  - Krok 5 nie ma plakietki „z Twoich celów” ani wstępnego zaznaczenia według celów (`recommendedPages`). Podtytuł: „Dodamy te strony do sidebaru. Każdą zmienisz albo usuniesz później.”. Hasła znikają ze stron do wyboru.
  - Kolumna `profiles.goals` zostaje w bazie, ale nowe konta jej nie wypełniają. Nic poza onboardingiem jej nie czyta (sprawdzone w kodzie).
  - Podgląd na żywo pokazuje Hasła w Modułach. W kroku 3 podświetla nowy blok „Ten tydzień” nad planem dnia, wzorowany na statystykach tygodnia z ekranu Dziś (CToday). Blok ma zakres dat i kafelki: Treningi „0 / N”, Bieg „0,0 / N km” i Śr. sen „— / X h”. Każdy kafelek ma mały podpis, dużą liczbę z szarym „/ cel” i 7 kresek dni tygodnia. Wyłączony cel znika, a pozostałe kafelki wypełniają rząd. Lista stron podświetla się tylko w kroku 5. Zapisane w `pending_pages` „Passwords” jest pomijane bez błędu.
- **Telefon.** Moduł Hasła musi być osiągalny z telefonu już w tym projekcie, inaczej po migracji hasła znikną z telefonu. Na telefonie Hasła pojawiają się jako pozycja modułu na górze listy Strony (`m-pages`). Dopracowanie należy do Etapu 3.
- **Uzupełnienie z 2026-11-23 (moje decyzje):**
  - panel wiersza na webie znika całkiem, bo edycja w komórkach go zastępuje (punkt 8);
  - kolory opcji to obecna paleta 8 kolorów, a nie 6 kolorów z makiety, żeby istniejące opcje nie wymagały migracji (punkt 9);
  - Subscriptions znika z kroku 5 onboardingu do czasu własnego projektu (punkt 14).
- **Kolumna `template_key`** zostaje w bazie tylko jako informacja, z jakiego szablonu powstała strona. Nie wpływa już na wygląd. Stronę systemową haseł oznacza osobna kolumna (np. `is_system`), a nie `template_key`.

## Zostawione wykonawcy

- Podział każdego z trzech kroków na zadania.
- Nazwy komponentów i plików, struktura ustawień w `content.settings`, kształt wyzwalaczy SQL.
- Teksty pomocnicze w oknach (krótkie, po polsku, w tonie reszty aplikacji).
