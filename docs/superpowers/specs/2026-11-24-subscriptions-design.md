# Subscriptions — projekt

Data: 2026-11-24. Autor: Claude (szkic do akceptacji Mejsona). Źródło: spec Stron 2.0 (`docs/superpowers/specs/2026-11-22-strony-2-design.md`, punkt „Poza zakresem” → Subscriptions) i życzenie Mejsona: „bez języka formuł — gotowe szablony i wbudowane inteligentne typy pól, które same liczą (miesięczne/roczne sumy subskrypcji, odnowienia pokazane w kalendarzu)”.

## Cel i powód

Mejson chce śledzić subskrypcje w rhytm tak jak książki i projekty: jedna strona z tabelą, karty z sumą na miesiąc i rok oraz odnowienia widoczne w kalendarzu. Nie chce pisać formuł. Pola same mają wiedzieć, że kwota ma cykl, i liczyć sumy. Data odnowienia ma sama przesuwać się na następny termin.

Projekt dodaje:
- dwa **inteligentne typy pól**: „Kwota cykliczna” i „Data odnowienia”;
- **szablon Subscriptions** obok Books, Projects i Websites;
- nowe sposoby liczenia kart i stopek: suma na miesiąc, suma na rok, najbliższe odnowienie, liczba w kalendarzu;
- **odnowienia w kalendarzu** w widokach tygodnia, dnia i miesiąca, z dymkiem podglądu.

## Makiety (wiążące w sprawach wyglądu)

Kopie w `docs/design/mockups`:

| Makieta | Co pokazuje |
|---|---|
| `S2Main.dc.html` | Strona Subscriptions: 3 karty, pasek tabeli („Sort: Odnowienie”), kolumny, komórka kwoty z przełącznikiem `/ mies.`↔`/ rok`, data z czasem do odnowienia, stopka |
| `S2AddField.dc.html` | Okno „Nowe pole” z grupą „Inteligentne” (Kwota cykliczna, Data odnowienia, plakietka „liczy”) i ustawieniami tych typów |
| `S2CalendarRenewal.dc.html` | Dymek odnowienia w tygodniu: plakietka „Odnowienie · Subscriptions”, nazwa, data i czas, siatka Kwota / Kategoria / Cykl / Następne, „Tylko podgląd…”, „Otwórz w Subscriptions” |
| `S2Calendar.dc.html` | Tydzień: odnowienie w wierszu „cały dzień” jako `.bdg.out.lg` z przerywaną ramką, ikona `Repeat`, tekst „Netflix · 43,00 zł”; pozycja „Subscriptions” w menu kategorii z przerywanym kwadratem zamiast kropki |
| `S2CalendarMonth.dc.html` | Miesiąc: wpis „↻ Netflix” w komórce dnia, dymek z Kwotą i Cyklem |
| `S2CalendarDay.dc.html` | Dzień: pozycja „Subscriptions” w menu kategorii (samego odnowienia makieta nie pokazuje) |
| `S2NewPage.dc.html` | Okno „Nowa strona” (Subscriptions dochodzi w tym samym układzie) |
| `S2CardDialog.dc.html`, `S2ColumnMenu.dc.html`, `S2FilterPopover.dc.html` | Wygląd okien, z których korzystają nowe typy (bez zmian wyglądu) |
| `CMSubs.dc.html` | Telefon. **Należy do Etapu 3** i tu jest tylko odnotowany |

## Zakres

### 1. Baza

- Ograniczenie `page_fields_type_check` dostaje dwa nowe typy: `recurring` (Kwota cykliczna) i `renewal` (Data odnowienia). To jedyny powód, dla którego dodanie typu wymaga migracji: typ pola jest pilnowany constraintem, a wartości w `page_rows.values` (JSONB) i `config` (JSONB) nie.
- `template_key` już dziś dopuszcza `'subscriptions'` (migracja `20261120120000_pages.sql`), więc go nie zmieniamy.
- Konfiguracje pól mogą teraz wskazywać inne pola tej samej tabeli: `cycle_field_id` i `active_field_id` (punkt 2). Dwie funkcje SQL muszą o tym wiedzieć:
  - **`duplicate_page`** dziś kopiuje `config` pól bez zmian, więc kopia wskazywałaby pola oryginału. Nowa wersja najpierw tworzy mapę id wszystkich pól bloku, a potem wstawia pola z `config` przepisanym przez tę samą zamianę tekstu old→new, co `content` i `values`. Zostaje blokada strony systemowej („Strony Hasła nie można zduplikować”).
  - **`delete_field`** dodatkowo usuwa klucze `cycle_field_id` i `active_field_id` z `config` innych pól tego bloku, jeśli wskazują usuwane pole.
- Nowa migracja: `supabase/migrations/20261127100000_subscriptions.sql`. Test pgTAP: `supabase/tests/subscriptions.test.sql`.
- Strażnik modułu Hasła (`page_fields_guard`) zostaje bez zmian. Nowe typy są dozwolone tylko poza stroną systemową, bo tam i tak nie da się dodawać kolumn.

### 2. Typy pól

**Kwota cykliczna (`recurring`)**
- Wartość w `values`: `{ "amount": number, "cycle": "month" | "year" }`.
  - `amount` jest skończona, ≥ 0 i ≤ 1 000 000 000, zaokrąglona do 2 miejsc.
  - Pusta komórka to `null`, a nie obiekt z pustą kwotą.
- `normalizeValue`:
  - przyjmuje taki obiekt;
  - przyjmuje też liczbę i tekst z przecinkiem albo kropką (wklejanie, zmiana typu), z cyklem `config.default_cycle ?? "month"`;
  - wszystko inne daje `null`.
- `config.default_cycle?: "month" | "year"`, domyślnie `"month"`.
- Waluta to zawsze zł, bo aplikacja nie ma ustawienia waluty.
- Formatowanie kwoty:
  - dwa miejsca po przecinku, tysiące oddzielone twardą spacją (` `), np. `5 255,28`;
  - `formatValue` daje `43,00 zł / mies.` albo `249,99 zł / rok`.
- Przeliczenie: miesięcznie = `rok / 12`, rocznie = `mies. × 12`. Zaokrąglenie do grosza tylko przy wyświetlaniu, po zsumowaniu.
- Ikona w nagłówku według S2Main to `Hash`, a znak w oknie „Nowe pole” to „↻zł” (S2AddField). Etykieta: „Kwota cykliczna”. Domyślna szerokość kolumny to 200 px (S2Main). Nagłówek i komórka są wyrównane do prawej.

**Data odnowienia (`renewal`)**
- Wartość w `values`: data ISO `RRRR-MM-DD`, czyli **kotwica serii**, jak w zwykłym polu daty.
- `config`:
  - `cycle_field_id?: string`: „Cykl z pola”, wskazuje pole Kwota cykliczna. Cykl wiersza bierze się z jego wartości, a gdy kwoty nie ma, z `default_cycle` tego pola;
  - `cycle?: "month" | "year"`: „własny cykl”, używany, gdy `cycle_field_id` jest puste albo wskazuje pole, którego już nie ma lub które ma inny typ;
  - `active_field_id?: string`: „Tylko gdy zaznaczone”, wskazuje pole Checkbox. Pusta wartość oznacza „— zawsze —”;
  - `show_in_calendar?: boolean`: „Pokaż w kalendarzu”, domyślnie `true` dla nowych pól tego typu.
- **Wiersz aktywny:** brak `active_field_id` (albo wskazane pole nie jest checkboxem) albo `values[active_field_id] === true`. Nieaktywny wiersz:
  - nie wchodzi do sum, kart ani kalendarza;
  - w tabeli ma przezroczystość .55 i plakietkę „anulowana” zamiast czasu do odnowienia (S2Main).
- **Następne odnowienie** (czysta funkcja `nextRenewal(anchor, cycle, today)` w `fields.ts`):
  - kotwica ≥ dziś: wynik to kotwica;
  - inaczej: najmniejsze k ≥ 1, dla którego `dodajCykl(kotwica, k) ≥ dziś`;
  - `dodajCykl` przy cyklu miesięcznym dodaje k miesięcy do kotwicy, a dzień to `min(dzień kotwicy, liczba dni miesiąca)`. Zawsze liczymy od kotwicy, nie od poprzedniego terminu, więc 31.01 daje 28.02 (albo 29.02), 31.03 i 30.04;
  - przy cyklu rocznym tak samo co 12 miesięcy, więc 29.02 daje 28.02 w latach nieprzestępnych.
- **Wystąpienia w zakresie** (`renewalDates(anchor, cycle, from, to)`): wszystkie `dodajCykl(kotwica, k)` dla k ≥ 0, które wpadają w `[from, to]`. Przed kotwicą nie ma wystąpień, a przeszłe wystąpienia od kotwicy się pokazują.
- Wyświetlanie, sort i filtr („przed”, „po”) używają **następnego odnowienia** liczonego od dziś, a nie surowej kotwicy. Komórka nigdy nie pokazuje „minęło” (opis typu w S2AddField: „Nic nie trzeba przesuwać ręcznie”).
- Wybór daty w kalendarzyku zapisuje nową kotwicę. Kalendarzyk otwiera się na następnym odnowieniu, więc ponowny wybór tej samej daty nie zmienia serii.
- Ikona nagłówka według S2Main to `Calendar`, a znak w oknie „Nowe pole” to „↻”. Etykieta: „Data odnowienia”. Domyślna szerokość kolumny to 230 px.

**Checkbox: wartość domyślna nowego wiersza.** Nowy klucz `config.default_checked?: boolean`. Nowy wiersz dostaje `true`, tak jak `default_option` daje opcję. Bez tego każda nowa subskrypcja byłaby od razu „anulowana”. Klucz nie ma osobnego interfejsu, ustawia go szablon.

**Zmiana typu** (`convertValue` / `planTypeChange`):
- liczba albo tekst → Kwota cykliczna: kwota z liczby, cykl `month`;
- Kwota cykliczna → liczba: sama kwota (bez przeliczenia);
- Kwota cykliczna → tekst: `formatValue`;
- data albo tekst → Data odnowienia: ta sama data;
- Data odnowienia → data: kotwica;
- Data odnowienia → tekst: `dd.mm.rrrr`;
- pozostałe przejścia z i do nowych typów dają `null` (licznik utraconych wartości jak dziś);
- `planTypeChange` daje nowej Dacie odnowienia `{ show_in_calendar: <z daty albo true>, cycle: "month" }`, a nowej Kwocie cyklicznej `{ default_cycle: "month" }`;
- w akcji `changeFieldType` schemat wartości dopuszcza obiekt `{ amount, cycle }`.

**Filtry i podsumowania**

| Typ | Operatory filtra | Podsumowania (stopka) |
|---|---|---|
| Kwota cykliczna | `gte`, `lte`, `empty`; porównanie na kwocie przeliczonej na miesiąc | `none`, `count`, `filled`, `empty`, `sum_month` („Σ 437,94 zł / mies.”), `sum_year` („Σ 5 255,28 zł / rok”) |
| Data odnowienia | `before`, `after`, `empty`; porównanie na następnym odnowieniu | `none`, `count`, `filled`, `empty`, `nearest`, `in_calendar` („12 w kalendarzu”) |

- Sumy pomijają wiersze nieaktywne.
- **Skąd suma Kwoty wie o „Aktywna”:** liczy się `active_field_id` pierwszego pola Data odnowienia w tej tabeli, które ma `cycle_field_id` równe temu polu. Bez takiego pola liczą się wszystkie wiersze.
- `in_calendar` liczy aktywne wiersze z datą, gdy `show_in_calendar` jest włączone. Przy wyłączonym daje „0 w kalendarzu”.
- Sort Kwoty idzie po kwocie przeliczonej na miesiąc, a sort Daty odnowienia po następnym odnowieniu. Puste są na końcu, jak dziś.

Nazwy podsumowań w menu kolumny: „Suma / mies.”, „Suma / rok”, „W kalendarzu”.

### 3. Karty statystyk (nowe sposoby liczenia)

| `aggregation` | Pole | Wartość | Wygląd (S2Main) |
|---|---|---|---|
| `sum_month` | Kwota cykliczna | suma aktywnych przeliczona na miesiąc, np. `437,94` | liczba 26 px + szare „zł” 14 px |
| `sum_year` | Kwota cykliczna | suma aktywnych przeliczona na rok, np. `5 255,28` | jak wyżej |
| `next_renewal` | Data odnowienia | tytuł aktywnego wiersza z najwcześniejszym następnym odnowieniem | nazwa 18 px + plakietka `lg` z czasem do odnowienia |

- Przy `next_renewal`:
  - plakietka jest pomarańczowa (`warn`), gdy do odnowienia zostało 0–10 dni, w przeciwnym razie szara;
  - tytuł to link do kalendarza: tydzień z tą datą (`/kalendarz?widok=tydzien&data=RRRR-MM-DD`);
  - pole tytułowe dobiera się samo (`isTitle`);
  - przy braku aktywnych wierszy z datą wartość brzmi „Brak odnowień”.
- W oknie karty (S2CardDialog) dochodzą sposoby liczenia:
  - dla Kwoty cyklicznej: „Suma na miesiąc” (np. „Σ miesięcznie: 437,94 zł”) i „Suma na rok” (np. „Σ rocznie: 5 255,28 zł”);
  - dla Daty odnowienia: „Najbliższe odnowienie” (najbliższa przyszła data według cyklu).
  - Dodatkowe wybory się nie pojawiają.
- `delete_field` już dziś usuwa karty wskazujące usuwane pole po `field_id`, więc nic więcej nie trzeba.

### 4. Szablon Subscriptions

Klucz `subscriptions` w `TEMPLATE_KEYS` po `websites`.

| Pole szablonu | Wartość |
|---|---|
| `name` | „Subscriptions” |
| `icon` | `lucide:wallet` |
| `desc` | „Twoje subskrypcje” |
| `intro` | „Twoje subskrypcje i ich odnowienia.” (S2Main) |
| `extra` | „Sumy na miesiąc i rok. Odnowienia trafią do kalendarza głównego.” |

Kolumny (kolejność i nazwy według S2Main):

| Klucz | Nazwa | Typ | Config |
|---|---|---|---|
| `name` | Nazwa | text, tytuł | `empty_label: "Bez nazwy"` |
| `price` | Kwota cykliczna | recurring | `default_cycle: "month"` |
| `renewal` | Data odnowienia | renewal | `cycle_field_id → price`, `active_field_id → active`, `show_in_calendar: true` |
| `cat` | Kategoria | select | opcje Rozrywka, Chmura, Zdrowie, Praca, Sport, Nauka, Inne, wszystkie „Bez koloru” (`color: ""`, w makiecie `.bdg.out`); `default_option: other` |
| `active` | Aktywna | checkbox | `default_checked: true` |

Ustawienia tabeli:

| Ustawienie | Wartość |
|---|---|
| Karty | „Σ miesięcznie” (`price`, `sum_month`), „Σ rocznie” (`price`, `sum_year`), „Najbliższe odnowienie” (`renewal`, `next_renewal`) |
| Sort | `renewal` rosnąco (na pasku „Sort: Odnowienie”) |
| Stopki | `name`: `count` z odmianą „subskrypcja / subskrypcje / subskrypcji”; `price`: `sum_month`; `renewal`: `in_calendar` |
| Wiersze startowe | brak, jak w innych szablonach |

- `buildTemplateBlocks` musi w configu pól zamieniać klucze szablonu (`cycle_field_id`, `active_field_id`) na nowe id pól. Działa w dwóch przejściach: najpierw id wszystkich pól, potem configi, bo pole `active` stoi za polem `renewal`.
- `TemplateField.config` dostaje te klucze jako klucze szablonu.
- Okno „Nowa strona” pokazuje Subscriptions w tym samym układzie co pozostałe szablony (S2NewPage): pola, które powstaną, i dopisek z `extra`.

### 5. Tabela na webie (S2Main)

**Komórka Kwoty**
- Pole tekstowe kwoty wyrównane do prawej (`inputMode="decimal"`, placeholder `0,00`), za nim szare „zł” 13 px i przycisk `/ mies.` albo `/ rok` (`btng xs`, kolor #686868, `aria-label` „Cykl: mies. (kliknij, aby zmienić)”).
- Zapis przy pisaniu, jak w komórce liczby. Po wyjściu z pola kwota formatuje się do `43,00`.
- Klik w przycisk cyklu przełącza cykl i zapisuje od razu.
- Przy pustej kwocie przycisk pokazuje `default_cycle` i jest nieaktywny.

**Komórka Daty odnowienia**
- Jak dzisiejsza komórka daty: `DatePicker` z następnym odnowieniem i czasem do odnowienia tuż za datą (`relativeDue`).
- Czas do odnowienia: 0–10 dni daje pomarańczową plakietkę (`warn`), więcej daje szary tekst.
- Wiersz nieaktywny ma szarą plakietkę „anulowana”.

**Wiersz nieaktywny:** `opacity: .55` na całym `<tr>`.

**Okno „Nowe pole” (S2AddField)**
- Druga grupa na liście typów to „Inteligentne”: Kwota cykliczna (domyślna nazwa „Cena”) i Data odnowienia (domyślna nazwa „Odnowienie”). Obie mają zieloną plakietkę „liczy”.
- Przy wybranym typie nagłówek ma plakietkę „inteligentne”, a pod nim opis z makiety.
- Ustawienia Kwoty:
  - „Domyślny cykl” jako segment: miesiąc | rok;
  - „Suma w stopce” jako plakietka „/ mies. i / rok”;
  - „Waluta”: „zł”;
  - przykład w `.alert.info`: „50,00 / mies. → 600,00 / rok” albo „600,00 / rok → 50,00 / mies.”.
- Ustawienia Daty odnowienia:
  - „Cykl z pola” jako lista: pola Kwota cykliczna tej tabeli, „<nazwa> (Kwota cykliczna)”, i na końcu „własny cykl”. Po wybraniu „własny cykl” pojawia się segment miesiąc | rok;
  - „Pokaż w kalendarzu” jako przełącznik, domyślnie włączony;
  - „Tylko gdy zaznaczone” jako lista pól Checkbox i „— zawsze —”.
- Okno dostaje listę pól tabeli (`fields`).

**Menu kolumny (S2ColumnMenu, wygląd bez zmian)**
- „Typ pola” pokazuje oba nowe typy.
- Dla Daty odnowienia:
  - „Pokaż w kalendarzu” jako przełącznik, jak dziś dla daty;
  - podmenu „Cykl z pola” (pola Kwota cykliczna oraz „Własny: miesiąc” i „Własny: rok”);
  - podmenu „Tylko gdy zaznaczone” (pola Checkbox i „— zawsze —”).
- Dla Kwoty cyklicznej: podmenu „Domyślny cykl” (miesiąc, rok).
- Wszystkie podmenu są zbudowane jak istniejące „Podsumowanie”.

**Telefon (arkusz wiersza `m-row-sheet`)** musi działać, ale nie jest dopracowany (Etap 3):
- Kwota: pole liczby i segment mies./rok;
- Data odnowienia: pole daty z dopiskiem „następne: dd.mm.rrrr”.

### 6. Odnowienia w kalendarzu (web)

**Odbiorca danych.** Nowa funkcja `loadRenewals(supabase, userId, range, today)` w `src/features/calendar/load-calendar.ts`, wołana tylko z `src/app/(app)/kalendarz/page.tsx`, równolegle z `loadCalendar`. Dziś i telefon jej nie używają, więc nie płacą za dodatkowe zapytania. Zapytania:
1. `page_fields` z `type = 'renewal'` użytkownika, z osadzonym blokiem i stroną (`!inner`). Blok i strona nieusunięte, strona nie systemowa.
2. Wszystkie pola tych bloków (tytuł, kwota, checkbox, pierwsze pole Select albo Status).
3. Nieusunięte wiersze tych bloków.

**Kształt danych**

```ts
export type RenewalSource = {
  fieldId: string; pageId: string; config: FieldConfig;
  name: string;            // tytuł strony; przy kilku polach odnowienia na stronie „Tytuł · Nazwa pola”
  shown: boolean;          // config.show_in_calendar !== false
};
export type RenewalItem = {
  key: string;             // `${fieldId}:${rowId}:${date}`
  fieldId: string; pageId: string; pageTitle: string; rowId: string;
  date: IsoDate;           // to wystąpienie
  next: IsoDate;           // następne wystąpienie po nim (data + 1 cykl)
  title: string;           // tytuł wiersza (pusty → empty_label pola tytułowego)
  amount: number | null; cycle: "month" | "year";
  categoryName: string;    // nazwa pierwszego pola Select/Status tabeli albo „Kategoria”
  categoryLabel: string | null;
};
```

- `items` są liczone dla wszystkich źródeł, także ukrytych. Przełączanie widoczności nie wymaga więc ponownego wczytania.
- Do `items` trafiają tylko aktywne wiersze z kotwicą, z wystąpieniami z `renewalDates` w zakresie widoku.

**Menu „Kategorie” (S2Calendar)**
- Pod kategoriami są pozycje źródeł odnowień (zwykle jedna: „Subscriptions”). Zamiast kropki mają przerywany kwadrat 10×8 px, ciemny przy widocznej i szary przy ukrytej.
- Licznik „N/M” na przycisku liczy też źródła. Kropki na przycisku pokazują tylko kategorie.
- Przełączenie zapisuje `show_in_calendar` pola (`updateField`) optymistycznie, jak `setCategoryHidden`, z cofnięciem przy błędzie.

**Tydzień (S2Calendar)**
- W wierszu „cały dzień” każdego dnia (dziś pusty, z komentarzem „odnowienia subskrypcji dojdą później”) stoją kolejno odnowienia tego dnia.
- Każde odnowienie to przycisk `bdg out lg` na całą szerokość, z przerywaną ramką, ikoną `Repeat` 12 px i tekstem „Netflix · 43,00 zł”, ucinanym wielokropkiem. Bez kwoty tekst to sam tytuł.
- Otwarte odnowienie ma ramkę `rgba(0,0,0,.4)` i cień `0 0 0 2px rgba(0,0,0,.08)` (S2CalendarRenewal).

**Dzień:** te same przyciski w wierszu „cały dzień”, za numerem i nazwą dnia. Makieta S2CalendarDay ich nie pokazuje, układ przejmujemy z tygodnia.

**Miesiąc (S2CalendarMonth)**
- Odnowienia stoją w komórce dnia przed blokami i treningami. Liczą się do limitu 3 wpisów i do „+N więcej”.
- Wpis ma styl wpisu bez kategorii (tło `#a3a3a314`, ramka `#a3a3a34d`) i tekst „↻ Netflix”, zgodnie z makietą.

**Klik w odnowienie** otwiera `RenewalPopover` przy wpisie, z tym samym mechanizmem kotwiczenia co `BlockPopover`. Esc, „Zamknij” i klik obok zamykają dymek. Treść według S2CalendarRenewal:
- plakietka `bdg sec` z ikoną: „Odnowienie · <tytuł strony>”;
- tytuł 16 px (600);
- data i czas: „sob 21.11.2026 · za 6 dni”. Dla przeszłych wystąpień sama data;
- siatka 2×2 w `.frame`:
  - Kwota: „43,00 zł / mies.” albo „—”;
  - `<categoryName>`: `categoryLabel` albo „—”;
  - Cykl: „co miesiąc” albo „co rok”;
  - Następne: `next` jako `dd.mm.rrrr`;
- `.alert.info`: „Tylko podgląd. Edytujesz na stronie <tytuł strony>.”;
- stopka z przyciskiem „Otwórz w <tytuł strony>” na całą szerokość. Link prowadzi do `/strony/<pageId>`.
- Odnowienia nie da się przeciągać ani edytować w kalendarzu.

### 7. Kolejność wdrożenia (migracja względem kodu)

Zasady z `CLAUDE.md` (seria autonomiczna z 2026-11-24): Claude sam scala do `main` po zielonym CI i sam wykonuje migrację przez konektor Supabase, ale dopiero po scaleniu do `main`, nigdy z gałęzi.

1. Gałąź `feat/subscriptions`: migracja z testem pgTAP i cały kod. CI sprawdza pgTAP i e2e na lokalnej bazie z migracją.
2. Testy lokalne na połączonym kodzie i zielone CI, potem `git merge --no-ff` do `main` i push. Push uruchamia budowanie na Vercel.
3. **Migracja idzie przed wdrożeniem kodu na Vercel.** Claude wykonuje ją przez konektor Supabase (`apply_migration`, nazwa `subscriptions`) od razu po pushu `main`, w czasie budowania, zanim nowy kod będzie na produkcji. Potem `list_migrations` musi pokazać wersję `20261127100000`. Jeśli konektor nadał inną wersję, plik w repo dostaje nazwę z produkcji (commit na gałęzi `docs/*`).
   - Migracja jest wstecznie zgodna. Rozszerza constraint, a `duplicate_page` i `delete_field` przy starych danych (bez odwołań w config) działają jak dziś. Stary kod z produkcji działa więc na nowej bazie bez zmian.
   - Migracja niczego nie usuwa, więc nie wymaga osobnego potwierdzenia Mejsona.
4. Gdyby wdrożenie skończyło się przed migracją (albo konektor nie działał), utworzenie strony Subscriptions albo pola nowego typu kończyłoby się błędem „Nie udało się zapisać”, bo zablokowałby to constraint. Reszta aplikacji działa normalnie. Jeśli konektor nie działa, migrację uruchamia Mejson (`pnpm exec supabase db push --remote`).

## Poza zakresem

- **Telefon w układzie CMSubs** (Etap 3). Na telefonie działa tylko arkusz wiersza z punktu 5. Kalendarz na telefonie (`mobile/m-calendar-*`) nie pokazuje odnowień do Etapu 3.
- Cykle tydzień i kwartał z S2AddField (punkt D1 w decyzjach).
- Zwykłe pola daty (np. Termin w Projects) w kalendarzu i ustawienie „Tylko gdy zaznaczone” dla zwykłej daty (D6).
- Powiadomienia o odnowieniach (`renewals_enabled` z onboardingu): osobny temat.
- Subscriptions w onboardingu (krok 5). Makieta S2OnboardingPages go nie ma, a `PENDING_TO_TEMPLATE` zostaje bez zmian (D8).
- Odnowienia na ekranie Dziś.
- Waluty inne niż zł, ustawienie waluty, kursy.
- Formuły i dowolne relacje między tabelami.

## Anty-cele

- Utrata danych istniejących stron. Migracja nie przepisuje `values` ani `config` istniejących pól.
- Pogorszenie Books, Projects, Websites i modułu Hasła. Zmiany w `visibleRows`, `summarize` i `computeCard` nie mogą zmienić wyniku dla starych typów (istniejące testy zostają zielone bez zmian oczekiwań).
- Funkcje pomocnicze skaczące po plikach. Wyjątek to czyste funkcje modelu w `fields.ts` i `table-model.ts` (`nextRenewal`, `renewalDates`, `formatMoney`), bo są wspólne dla tabeli i kalendarza i mają testy. Taki wzorzec już istnieje (`relativeDue`, `templateOccurrences`).

## Ograniczenia

- Next.js 16 (cacheComponents) + Supabase + Tailwind 4 + kontrolki `@/components/controls` w wyglądzie COSS, `lucide-react` 1.73. Bez nowych bibliotek.
- Płaski kod, komentarze i teksty UI po polsku, nazwa szablonu po angielsku („Subscriptions”, jak „Books”). W SQL aliasy z `AS`.
- Każda migracja ma test pgTAP. pgTAP i e2e działają tylko w CI.
- Migrację na produkcję wykonuje Claude przez konektor Supabase po scaleniu do `main` (punkt 7). Jeśli konektor nie działa, robi to Mejson.

## Decyzje Claude (do sprawdzenia przez Mejsona)

Każda decyzja ma koszt pomyłki, czyli tyle, ile kosztuje zmiana zdania później.

| # | Decyzja | Uzasadnienie | Koszt pomyłki |
|---|---|---|---|
| D1 | **Tylko cykle miesiąc i rok**, mimo że S2AddField pokazuje też tydzień i kwartał. | Tak brzmi wymaganie („przełącznik mies./rok”), a S2Main ma przełącznik dwustanowy. | Niski. `cycle` to wyliczenie, więc dodanie `week`/`quarter` to zmiana w `fields.ts`, segmencie i przełączniku, bez migracji. |
| D2 | **Data odnowienia to osobny typ pola**, a nie opcja zwykłej daty. | Tak jest w S2AddField (grupa „Inteligentne”). Osobny typ nie zmienia zachowania dat w Books i Projects. | Średni. Scalenie z typem `date` później wymagałoby migracji `type` istniejących pól. |
| D3 | **Wartość daty to kotwica serii, a wyświetla się następne odnowienie.** Sort i filtr też idą po następnym odnowieniu. | Opis typu w S2AddField: „Pokazuje najbliższą przyszłą datę wg cyklu… Nic nie trzeba przesuwać ręcznie”. | Niski. Gdyby Mejson chciał widzieć kotwicę, zmienia się tylko wyświetlanie w komórce. |
| D4 | **Cykl żyje w wartości Kwoty** (każdy wiersz ma własny), a Data odnowienia czyta go przez `cycle_field_id`. Istnieje też „własny cykl”. | S2Main przełącza cykl w komórce kwoty, S2AddField ma „Cykl z pola” i „własny cykl”. | Średni. Zmiana miejsca cyklu to migracja danych w `values`. |
| D5 | **„Aktywna” ustawia pole Data odnowienia** („Tylko gdy zaznaczone”), a sumy Kwoty biorą je od Daty odnowienia, która wskazuje tę Kwotę. Bez takiej Daty sumują wszystkie wiersze. | S2AddField ma to ustawienie tylko przy Dacie odnowienia, a okno karty nie ma filtra. | Niski. Później można dodać ustawienie przy Kwocie albo filtr karty, bez migracji. |
| D6 | **Kalendarz pokazuje tylko odnowienia**, a zwykłe daty z `show_in_calendar` (Projects) dalej nie. | Wymaganie dotyczy odnowień, a dymek z makiety jest tylko dla odnowień. | Średni. Mejson może oczekiwać terminów Projects („Terminy trafią do kalendarza głównego” w opisie szablonu). Dołożenie ich to mały pakiet na tym samym `loadRenewals`, bez migracji. |
| D7 | **Widoczność w kalendarzu przełącza `show_in_calendar` pola**: pozycja źródła w menu „Kategorie”, a nie systemowa kategoria. | Makieta pokazuje „Subscriptions” bez koloru i z przerywanym kwadratem. Kategoria systemowa wymagałaby migracji kategorii każdego użytkownika i kłóciłaby się z kilkoma stronami odnowień. | Niski. Stan siedzi w config pola. |
| D8 | **Onboarding bez zmian**: Subscriptions nie wraca do kroku 5, a `PENDING_TO_TEMPLATE` go nie dostaje. | S2OnboardingPages nie ma Subscriptions. Dodanie go do `PENDING_TO_TEMPLATE` mogłoby utworzyć stronę starym profilom z „Subscriptions” w `pending_pages`. | Niski. Jedna linijka i kafelek, gdy pojawi się makieta. |
| D9 | **Nowy wiersz ma „Aktywna” zaznaczone** (`default_checked`, ustawiane tylko przez szablon). | W makiecie nowy wiersz ma `active: true`. Bez tego nowa subskrypcja nie liczyłaby się w sumach. | Niski. |
| D10 | **Filtr Kwoty porównuje kwotę przeliczoną na miesiąc.** | „≥ 50” ma sens tylko na jednej skali, a 249,99 zł / rok to 20,83 zł / mies. | Niski. Wystarczy zmiana w `visibleRows`. |
| D11 | **Kategorie szablonu bez koloru**, a nowe opcje wpisane w komórce są szare jak dziś. | W S2Main wszystkie są `.bdg.out`. | Niski. |
| D12 | **Kolor czasu do odnowienia: pomarańczowy przy 0–10 dniach** (S2Main `bdg warn`), a nie czerwony przy 7 dniach jak termin w Projects. Teksty czasu z `relativeDue`. | Wierność makiecie przy kolorze. Wspólny tekst z resztą aplikacji („za 2 mies.” od 61 dni, a nie od 45 jak w makiecie). | Niski. Dwie stałe. |
| D13 | **Tytuł karty „Najbliższe odnowienie” prowadzi do kalendarza**, na tydzień z tą datą. Dymek nie otwiera się sam. | W makiecie nazwa jest linkiem do S2CalendarRenewal. Automatyczne otwarcie dymku wymagałoby nowego parametru adresu. | Niski. |
| D14 | **Jeden dymek odnowienia we wszystkich widokach**: siatka 2×2 z S2CalendarRenewal, także w miesiącu (S2CalendarMonth ma 2 pola). | Jeden komponent, więcej informacji. | Niski. |
| D15 | **Szerokość kolumny Nazwa w szablonie zostaje 300 px** (S2Main ma 240). Nowe typy mają domyślne 200 i 230 px. | Szablony dziś nie ustawiają szerokości, a dodanie tego dla jednego szablonu to osobny mechanizm. | Niski. Szerokość zmienia się przeciągnięciem. |
| D16 | **„Waluta” w oknie „Nowe pole” to samo „zł”**, bez „(z Ustawień)” z makiety. | Ustawienia nie mają waluty, więc tekst byłby nieprawdziwy. | Niski. |
| D17 | **Migracja idzie na produkcję zaraz po scaleniu, przed wdrożeniem kodu na Vercel** (punkt 7). | `CLAUDE.md` zabrania migracji przed scaleniem. Kod potrzebuje nowego constraintu, a migracja jest wstecznie zgodna. | Niski. W najgorszym razie przez kilka minut nie da się utworzyć strony Subscriptions. |
| D18 | **`duplicate_page` przepisuje id także w `config` pól**, a `delete_field` czyści odwołania. Zmiana typu wskazanego pola niczego nie czyści w bazie: kod traktuje odwołanie do pola innego typu jak brak odwołania. | Kopia strony nie może wskazywać pól oryginału. Usunięte pole nie może zostawić śmieci. Sprawdzanie typu w kodzie jest tańsze niż wyzwalacz. | Średni. Bez tego kopia strony Subscriptions liczyłaby sumy z cudzych pól. |

## Do decyzji (lista dla Mejsona, seria autonomiczna: Claude rozstrzyga sam, Mejson może odwrócić)

1. Cykle tydzień i kwartał (S2AddField): rozstrzygnięte jako „nie teraz” (D1). Koszt niski.
2. Terminy Projects w kalendarzu: rozstrzygnięte jako „nie w tym projekcie” (D6). Koszt średni, bo opis szablonu Projects obiecuje kalendarz.
3. Subscriptions w kroku 5 onboardingu: rozstrzygnięte jako „nie” (D8). Wymagałoby poprawki makiety S2OnboardingPages.
4. Kolejność według `CLAUDE.md`: Dziś → **Subscriptions** → sprzątanie odłożonych uwag webu → Etap 3. `stan-projektu.md` wymaga aktualizacji, bo stawia Subscriptions na końcu. Zrobi to koordynator.
