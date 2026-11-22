# Strony 2.0 — projekt

Data: 2026-11-22. Zatwierdzenie: Mejson (do akceptacji).

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
   - panel edycji wiersza (web) i arkusz wiersza (telefon);
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
   - Filtrowanie, sort i wyszukiwanie po jawnych kolumnach (Serwis, Login, URL, Kategoria) działają przy zamkniętym sejfie.
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
   - Mejson zatwierdza makiety. Potem trafiają na stronę „Web Design (COSS UI)” jako wiążące, a CBooks, CProjects, CWebsites i CPasswords idą do archiwum.
   - Wersje telefonowe powstają w Etapie 3.

## Poza zakresem (non-goals)

- Nowe typy pól, widoki (tablica, galeria), relacje między tabelami, formuły i nowe sposoby liczenia kart.
- Wygląd telefonu w układzie CM*. Telefon ma działać, czyli mieć arkusz wiersza i cele dotykowe ≥ 44 px, ale jego dopracowanie należy do Etapu 3.
- Udostępnianie haseł, import i eksport haseł, generator haseł.
- Zmiany w kalendarzu, sporcie, nawykach i Dziś. Kalendarz dziś nie czyta tabel stron (`show_in_calendar` w polu daty Projektów nie ma jeszcze odbiorcy). Tak zostaje, a pokazanie terminów w kalendarzu to osobny przyszły temat.

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
- **Onboarding.** Wybór „Hasła” w kroku 5 kreatora znika, bo moduł Hasła jest zawsze dostępny. Zapisane w `pending_pages` „Passwords” jest pomijane bez błędu.
- **Telefon.** Moduł Hasła musi być osiągalny z telefonu już w tym projekcie, inaczej po migracji hasła znikną z telefonu. Na telefonie Hasła pojawiają się jako pozycja modułu na górze listy Strony (`m-pages`). Dopracowanie należy do Etapu 3.
- **Kolumna `template_key`** zostaje w bazie tylko jako informacja, z jakiego szablonu powstała strona. Nie wpływa już na wygląd. Stronę systemową haseł oznacza osobna kolumna (np. `is_system`), a nie `template_key`.

## Zostawione wykonawcy

- Podział na zadania i kolejność. Sensowna kolejność: makiety → blok tabeli → przejście stron z szablonów → karty użytkownika → moduł Hasła z migracją.
- Nazwy komponentów i plików, struktura ustawień w `content.settings`, kształt wyzwalaczy SQL.
- Teksty pomocnicze w oknach (krótkie, po polsku, w tonie reszty aplikacji).
