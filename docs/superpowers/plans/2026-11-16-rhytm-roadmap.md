# rhytm: mapa etapów z listami odbiorczymi

**Spec:** `docs/superpowers/specs/2026-11-16-rhytm-design.md` (aktualizacja wieczorna 2026-11-16)
**Makiety:** `docs/design/mockups/` (`npx serve docs/design/mockups`). Komputer: `X.dc.html` przy 1440 px. Telefon: `MX.dc.html` przy 390×844.

## Jak czytać ten dokument
- Każdy etap ma **listę odbiorczą**: punkty do odhaczenia, wzięte z makiet i specu. Etap jest skończony, gdy:
  1. każdy punkt listy działa i ma test (e2e albo komponentowy),
  2. zrzuty ekranów etapu zgadzają się z makietami (web 1440 px, telefon 390 px; spec 7),
  3. testy jednostkowe, RLS i e2e przechodzą w CI,
  4. aplikacja jest wdrożona na Vercel.
- Szczegółowy plan krok po kroku powstaje **tuż przed etapem** (`docs/superpowers/plans/2026-11-16-etap-N-*.md`), na podstawie kodu z poprzednich etapów i tej listy.
- Każdy etap robi ekrany **web i telefon jednocześnie**.
- Sekcja „Wspólne” na początku dotyczy wszystkich etapów.

## Wspólne (obowiązuje w każdym etapie)
- [ ] Kontrolki wyłącznie z biblioteki z Etapu 0 (spec 3.2): żadnych natywnych `select`, `input type=date|time`.
- [ ] Dymki: zamykają się wyzwalaczem, wyborem, „Gotowe”, Esc i klikiem poza; nie są przycinane przez karty i tabele.
- [ ] Liczniki, sumy i karty przeliczają się natychmiast po zmianie (optymistycznie), a zapis idzie w tle; błąd zapisu cofa zmianę i pokazuje komunikat.
- [ ] Akcje wierszy po najechaniu (web), zawsze dostępne z klawiatury (focus-visible).
- [ ] Każdy przycisk-ikona ma `aria-label`; kontrast tekstu ≥ 4.5:1; cele dotyku na telefonie ≥ 44 px.
- [ ] Teksty interfejsu dokładnie jak w makietach (polski).
- [ ] Puste stany i błędy w stylu makiet.

---

## Etap 0: Fundament, kontrolki i logowanie
**Makiety:** Login, Register, Forgot, EmailConfirmed, NotFound, Sidebar · MLogin, MRegister, MForgot, MTabBar.

**Lista odbiorcza**
- Fundament
  - [ ] Repo: Next.js 16, TypeScript, Tailwind v4, shadcn/ui (Radix), Vitest, Testing Library, Playwright, ESLint; CI w GitHub Actions.
  - [ ] Tokeny ze spec 3.1 jako zmienne CSS + Tailwind; Geist i Geist Mono; komponent logo (3×3, zielony kwadrat).
  - [ ] Supabase lokalnie i w chmurze, migracje, `profiles` z RLS, pgTAP.
  - [ ] Odświeżona kopia makiet w `docs/design/mockups` (wszystkie pliki z płótna: web i `M*`) + `index.html` ze spisem; skrypt zrzutów makiet do porównań.
- Biblioteka kontrolek (spec 3.2), każda z wariantem web i telefon, z historią w stronie `/dev/kontrolki` (tylko lokalnie) do porównania z makietami:
  - [ ] lista rozwijana (z dopiskiem mono i z plakietką),
  - [ ] wybór daty (‹ ›, Dziś, Wyczyść, dziś w obwódce),
  - [ ] wybór godziny (siatka godzin i minut co 5),
  - [ ] segment, przełącznik, checkbox, chipy, plakietki statusów (kolory z makiet),
  - [ ] dymek, okno, arkusz (telefon), potwierdzenie słowem,
  - [ ] przyciski (główny, zwykły, niebezpieczny), pola, etykiety mono.
- Logowanie i konto
  - [ ] Logowanie: Google, e-mail + hasło, „Pokaż hasło”, „Nie pamiętasz hasła?”, Turnstile, błąd ogólny „Nieprawidłowy e-mail lub hasło”.
  - [ ] Rejestracja: nazwa, e-mail, hasło z regułami na żywo (≥ 10 znaków, litery i cyfry, nie w wyciekach) i paskiem siły (telefon), akceptacja regulaminu (telefon: przycisk nieaktywny bez zgody), Turnstile, ekran „Sprawdź skrzynkę” z odliczaniem 60 s.
  - [ ] Link z maila: stany „E-mail potwierdzony” i „Link wygasł” → „Wyślij nowy link”.
  - [ ] Reset hasła w 3 krokach (telefon: „Wyślij link” → „Sprawdź skrzynkę” → „Wróć do logowania”, „Wyślij ponownie”).
  - [ ] Wylogowanie.
- Nawigacja
  - [ ] Proxy: niezalogowany → `/logowanie`, zalogowany bez onboardingu → `/onboarding`.
  - [ ] Sidebar: logo, „Szukaj… ⌘K” (na razie bez akcji), Moduły (puste ekrany), Strony (pusta lista), Ustawienia; hover `#f5f5f5`, aktywna `#f0f0f0`; przyklejony na ≥ 800 px.
  - [ ] Blok użytkownika: klik otwiera dymek z imieniem, e-mailem i „Wyloguj się”.
  - [ ] Telefon (< 800 px): dolny pasek z 5 zakładkami (`MTabBar`), sidebar ukryty.
  - [ ] 404 z sidebarem, „Wróć do Dziś”, „Szukaj ⌘K”.
  - [ ] Manifest PWA, ikony, motyw jasny.
  - [ ] Strony-zaślepki `/regulamin` i `/prywatnosc`.
  - [ ] Instrukcja dla Mejsona krok po kroku: założenie Supabase, Vercel, Google OAuth, Turnstile, Resend i przekazanie kluczy; do tego czasu lokalny Supabase + Mailpit + testowe klucze Turnstile.

**Testy:** reguły hasła, HIBP (mock), Turnstile (mock), routing proxy, RLS `profiles`, komponenty kontrolek (otwieranie, wybór, klawiatura, Esc), e2e rejestracja → potwierdzenie (Mailpit) → logowanie → wylogowanie, e2e reset hasła, zrzuty 1440/390 ekranów etapu.

---

## Etap 1: Onboarding i profil
**Makiety:** Onboarding, OnboardingRole, OnboardingGoals, OnboardingSource, OnboardingPages, OnboardingNotify, OnboardingDone, EmptyToday, Settings (Ogólne bez Kosza) · MOnboarding.

**Lista odbiorcza**
- [x] 7 kroków z paskiem postępu, „Wstecz”/„Dalej”, „Wyloguj”; zapis po każdym kroku; powrót wznawia ostatni krok.
- [x] Web: podgląd aplikacji na żywo po prawej z zielonym obrysem zmienianego obszaru.
- [x] Telefon: układ z `MOnboarding` (jedno pytanie na ekran, „Dalej” na dole, bez podglądu).
- [x] Krok 1: zdjęcie (Storage) albo inicjały, imię (wymagane — „Dalej” nieaktywne), strefa (lista z ✓, wykryta z przeglądarki), tydzień od pn/nd, format 24/12 h. (sprawdzone ręcznie na Vercelu 17.11.2026; zmiana i usuwanie także w Ustawienia → Ogólne)
- [x] Krok 2: role (wiele), „Kierunek studiów” przy Studencie, kategorie startowe widoczne na żywo (Studia, Praca, Projekty, Sport; Dom gdy nic).
- [x] Krok 3: cele (wiele); Treningi → km/tydz. (−/+), Nawyki i sen → cel snu (−/+ 15 min).
- [x] Krok 4: źródło (jedno), „Inne” → „Gdzie dokładnie?”, „Pomiń”.
- [x] Krok 5: szablony stron, polecane „z Twoich celów” (zapis „do utworzenia”; utworzy je Etap 6).
- [x] Krok 6: zgoda na powiadomienia („Zezwól” → „Włączone” + „Anuluj”; tylko zapis wyborów, push w Etapie 9), 4 przełączniki przypomnień, wskazówka PWA.
- [x] Krok 7: podsumowanie z „Zmień” do kroków, „Przejdź do Dziś”.
- [x] Dziś w stanie pustym: „Witaj w rhytm”, „Pierwsze kroki” 0–4, pusty plan dnia (web i telefon).
- [x] Ustawienia → Ogólne: karty Profil i Cele z regułą „Zapisz/Cofnij/Masz niezapisane zmiany/Zapisano ✓”, walidacje (nazwa, waga 30–250, wzrost 120–230, km 1–300), strefa, waluta, początek tygodnia, cel snu −/+.

**Testy:** mapowanie ról na kategorie, celów na polecane strony, walidacje profilu, e2e pełnego onboardingu (web i telefon 390 px), zrzuty.

---

## Etap 2: Kalendarz główny i zadania
**Makiety:** Calendar, CalendarDay, CalendarMonth, BlockDialog, ScopeDialog, CategoryDialog, Settings (Kategorie) · MCalendarDay, MCalendarWeek, MCalendarMonth, MBlockSheet.

**Lista odbiorcza**
- Widoki
  - [x] Tydzień / Dzień / Miesiąc z przełącznikiem i ‹ Dziś › (adres `?widok=&data=`). (e2e: calendar.spec.ts; unit: calendar-header.test.tsx; zrzut)
  - [x] Filtry kategorii z licznikami; klik ukrywa/pokazuje (przerywana ramka, pusta kropka); „+ Kategoria”. (e2e: ukrycie po odświeżeniu; unit: category-filters.test.tsx, calendar-view.test.tsx)
  - [x] Siatka (cała doba, start przewinięty do 06:00), wiersz „cały dzień” (pusty do Etapu 7), linia „teraz” tylko dziś. (unit: time-grid.test.tsx)
  - [x] Dzień: mini kalendarz (dziś zielony, wybrany czarny), „Dzień w liczbach”, pusty dzień „Brak bloków w tym dniu. Dodaj blok”. (e2e: widok dnia; unit: day-side.test.tsx, time-grid.test.tsx)
  - [x] Miesiąc: do 3 wpisów i „+N więcej”, „N wpisów widocznych”. (e2e: miesiąc; unit: month-grid.test.tsx, calendar-view.test.tsx)
- Tworzenie i edycja
  - [x] Duch slotu przy najechaniu; klik → dymek „Nowy wpis” (data, godzina, Blok / Bieg / Siłownia) w dniu, tygodniu, miesiącu. (e2e: tydzień; unit: time-grid.test.tsx, new-entry-popover.test.tsx, calendar-view.test.tsx)
  - [x] Przeciągnięcie po siatce → „Nowy blok” z zakresem; przesuwanie i rozciąganie bloków. (e2e: przeciągnięcie o godzinę; unit: drag.test.ts, calendar-view.test.tsx)
  - [x] Okno „Nowy blok”: tytuł, kategoria (chipy + „+ Nowa”), dzień (wybór daty), od/do (wybór godziny), powtarzanie (5 opcji, „Własne…” z pn–nd i datą końca), zdanie podsumowania, notatka, przełącznik przypomnienia (`blocks.remind`, domyślnie włączony). (e2e: blok co tydzień; unit: block-dialog.test.tsx; zrzut)
  - [x] Okno zakresu (tylko to / to i następne / wszystkie) przy edycji, usuwaniu i przeciąganiu wystąpienia. (e2e: „To i następne”; unit: scope-dialog.test.tsx, delete-block-dialog.test.tsx, calendar-view.test.tsx; zrzut)
  - [x] Okno kategorii (nazwa, 8 kolorów, podgląd); otwarte z okna bloku wraca do okna bloku. (unit: category-dialog.test.tsx, block-dialog.test.tsx; zrzut)
  - [x] Wszystkie okna wracają do widoku i daty, z których je otwarto. (e2e: adres po zapisie; unit: calendar-view.test.tsx)
- Dymek bloku
  - [x] Kategoria, tytuł, data i godziny, pasek „Zadania x z y”, zadania do odhaczenia, „+” dodaj zadanie, notatka, Edytuj, Usuń, „↻ co tydzień”. (e2e: zadania w dymku; unit: block-popover.test.tsx; zrzut)
  - [ ] Przy dole siatki dymek otwiera się w górę (brak testu: `align="end"` działa tylko w dolnych wierszach miesiąca, bez testu)
- Zadania (decyzja 0.2)
  - [x] Tabela `tasks`; zadania wystąpienia bloku (każde wystąpienie osobna lista). (e2e: zadania w dymku; unit: model.test.ts; db: supabase/tests/calendar.test.sql)
  - [x] Zadania samodzielne z datą / bez daty (API i logika; ekran w Etapie 5). (unit: tasks/actions.test.ts, model.test.ts)
  - [x] Przypięcie samodzielnego zadania do wystąpienia bloku. (unit: tasks/actions.test.ts, model.test.ts; odpięcie: block-popover.test.tsx)
- Telefon
  - [x] `MCalendarDay`: segment widoków, pasek tygodnia z kropkami, oś 00–24 przewinięta do 07:00, linia teraz, „+” i stuknięcie pustego miejsca → arkusz. (e2e: mobile; unit: m-calendar-day.test.tsx, calendar-view-mobile.test.tsx; zrzut)
  - [x] `MCalendarWeek`: lista dni z blokami. `MCalendarMonth`: siatka z kropkami, ‹ ›, lista dnia. (e2e: kropka w miesiącu; unit: m-calendar-week.test.tsx, m-calendar-month.test.tsx; zrzut)
  - [x] `MBlockSheet`: arkusz z kategoriami, od/do −/+ 15 min, czas trwania, powtarzanie z „Powtarzaj do”, zadania, przypomnienie. (e2e: mobile; unit: m-block-sheet.test.tsx; zrzut)
- [x] Ustawienia → Kategorie kalendarza (lista, nazwa, kolor, kolejność, usuwanie; systemowe tylko ukrywanie). (unit: categories-card.test.tsx; zrzut)

**Znane ograniczenie:** Zadania odpięte lub odłączone od bloku są w bazie, ale widać je dopiero w Etapie 5 (lista zadań).

**Testy:** powtórzenia i wyjątki, DST, zadania per wystąpienie, „to i następne”, zadania samodzielne (daty, zaległe, przypięcie), RLS kalendarza i zadań, e2e blok cykliczny z zadaniem w dymku, e2e „Nowy wpis” → Blok z wypełnioną godziną, zrzuty.

---

## Etap 3: Nawyki i sen
**Makiety:** Habits, HabitDetail, HabitDialog, SleepDialog · MHabits, MHabitDetail, MHabitNew, MSleep.

**Lista odbiorcza**
- [ ] Harmonogramy: codziennie, wybrane dni, X w tygodniu (wersjonowane); odhaczanie także wstecz w siatce tygodnia.
- [ ] Kafelki: Nawyki dziś, Ostatnie 30 dni z porównaniem, Najdłuższa seria, Śr. sen 14 dni.
- [ ] Heatmapa: Miesiąc (‹ › do 12 mies., strzałki nieaktywne na granicy) / 3 / 6 mies. / Rok; dymek „data · x z y nawyków”; dni bez planu szare.
- [ ] Sen: 14 / 30 dni, wykres z linią celu, dymek słupka, ostatnia noc.
- [ ] Okno nawyku: nazwa, harmonogram z dniami do zaznaczania i licznikiem X, przypomnienie (przełącznik + wybór godziny), „Pokazuj na ekranie Dziś”.
- [ ] Szczegóły: kafelki, kalendarz miesiąca ‹ ›, historia harmonogramu, Edytuj, **Usuń** z potwierdzeniem.
- [ ] Wpis snu: data, zasnąłem/wstałem (wybór godziny web, −/+ telefon), czas na żywo przez północ, samopoczucie 1–5 z etykietami, tagi „Co mogło wpłynąć”, notatka; jeden wpis na dzień.
- [ ] Telefon: segment Nawyki/Sen, pierścień postępu, lista z dużymi checkboxami i serią, heatmapa 4 tygodni ze stuknięciem.

**Testy:** % dnia, serie dni i tygodni, wersjonowanie harmonogramu, sen przez północ, usunięcie nawyku usuwa historię (RLS), e2e nawyk + wpis snu (web i telefon), zrzuty.

---

## Etap 4: Sport
**Makiety:** Sport, RunDialog, GymLog, WorkoutTemplates, ExerciseDetail · MSport, MRunNew, MGym.

**Lista odbiorcza**
- [ ] Miesiąc z „Σ tydz.”, filtr Wszystko/Bieg/Siłownia, dymek treningu (kierunek w górę/lewo przy krawędziach) z akcjami.
- [ ] Kafelki tygodnia, wykres km z linią celu (~12 tyg.), karta rekordu ćwiczenia, „Ostatnie treningi”.
- [ ] Nowy bieg: rodzaj (Spokojny / Tempo / Interwały / Długi / Zawody), data, start, dystans, czas, tempo i kcal na żywo (ACSM), trudność 1–10, notatka, „Pokaż w kalendarzu”; bez czasu = plan.
- [ ] Trening siłowy: edycja kg/powt., ✓ serii, objętość i serie na żywo, „+ Seria” (kopiuje poprzednią), ✕ serii, „Usuń ćwiczenie”, „+ Ćwiczenie” (wyszukiwanie, biblioteka bez duplikatów, własne, Enter/Esc), REKORD, „Zapisz jako szablon”, „Zakończ trening”.
- [ ] Szablony: lista + karta „+ Nowy szablon”; edytor (nazwa, dni, godzina startu przy wybranych dniach *[Claude: brak na makiecie, wybór godziny z 3.2 obok dni]*, serie −/+, powtórzenia, przerwa, ↑ ↓ ✕, „+ Ćwiczenie”, Zapisz nieaktywne bez nazwy/ćwiczeń, Anuluj, Usuń, komunikat po zapisie); „Rozpocznij” z ostatnimi ciężarami.
- [ ] Dni szablonu same tworzą zaplanowane treningi (wystąpienia liczone przy odczycie; „Rozpocznij” / edycja zapisuje sesję; usunięcie wystąpienia = `template_skips`); widoczne w kalendarzu Sportu, głównym i na Dziś.
- [ ] Szczegóły ćwiczenia: 1RM (Epley), najcięższa seria, najwięcej powtórzeń, zmiana 8 tyg., wykres 3 mies./8 tyg., historia z REKORD, „Zmień nazwę”.
- [ ] Treningi w kalendarzu głównym jako podgląd (kategoria Sport; plan = przerywana ramka, wykonany = pomarańczowy); „Nowy wpis → Bieg/Siłownia” z kalendarza działa.
- [ ] Telefon: `MSport` (Tydzień/Miesiąc, karta biegania, wykres ze stuknięciem), `MRunNew` (rodzaj, −/+, tempo liczone, trudność 1–10, „Pokaż w kalendarzu”), `MGym` (pasek postępu, duże checkboxy; bez minutnika przerwy).

**Testy:** tempo, kcal, 1RM, rekordy, objętość, wystąpienia treningów z dni szablonu (zakres dat, pominięcia, zmiana dni), szablon → trening z ostatnimi ciężarami, edytor szablonu (walidacja, kolejność), e2e bieg i trening z szablonu, zrzuty.

---

## Etap 5: Dziś (pełny) i szybkie dodawanie na telefonie
**Makiety:** Today · MToday, MQuickAdd.

**Lista odbiorcza**
- [ ] Karta „Ten tydzień” (5 kafelków z danych etapów 2–4; tydzień wg profilu).
- [ ] Plan dnia: oś 06–22, „TERAZ”, linia czasu, dymek bloku, treningi („plan”), duch slotu + „Nowy wpis”.
- [ ] „Zadania na dziś” (samodzielne + zaległe, odhaczanie, „+ Zadanie”) i zwijane „Bez daty”; kafelek Zadania liczy oba rodzaje.
- [ ] Przejście z EmptyToday do pełnego Dziś po pierwszych krokach.
- [ ] Telefon `MToday`: nagłówek z szukaj i awatarem, kafelki 2×2 jako linki, karta TERAZ z zadaniami, plan dnia jako lista, nawyki z odhaczaniem, karta biegu, pływający „+”.
- [ ] Telefon `MQuickAdd`: arkusz z segmentem Zadanie/Blok/Bieg/Nawyk, chipy „Kiedy”, link do pełnego formularza, „Dodaj” zapisuje (zadanie z datą lub bez, blok, bieg-plan, nawyk).

**Testy:** liczenie kafelków (pn/nd), zadania zaległe, e2e odhaczenie zadania z dymku na Dziś, e2e szybkie dodanie zadania „Jutro” na telefonie, zrzuty.

---

## Etap 6: Silnik stron i edytor bloków
**Makiety:** NewPage, EmptyPage, Books, Projects, Websites, AddField (typy podstawowe), ColumnMenu, FilterPopover, PageMenu, NotFound (kosz) · MPages, MEditor.

**Lista odbiorcza**
- Strony i edytor
  - [ ] Tabele `pages`, `page_blocks`, `page_fields`, `page_rows`; sidebar ze stronami (przeciąganie, menu strony, ikony, F2); `/strony` na telefonie (Ulubione, Wszystkie, wyszukiwarka).
  - [ ] Edytor: tytuł (ścieżka na żywo), bloki tekst/nagłówek/lista zadań/separator/tabela, kosz bloku po najechaniu.
  - [ ] Menu „/” (filtr, ↑↓, Enter, Esc, hover, „Brak bloku”), „+”, Enter na tekście → akapit, chipy „albo zacznij od”, link do szablonów.
  - [ ] Telefon `MEditor`: pasek skrótów, arkusz „Wstaw blok”, arkusz „Kolumna”, przewijana tabela.
- Tabele
  - [ ] Blok tabeli: nazwa, kolumny (dymek: nazwa, typ, opcje Wyboru, ←/→, usuń), „+” kolumny otwiera dymek, „+ Nowy wiersz”, licznik, stopka sum.
  - [ ] Zmiana typu kolumny z przeliczeniem wartości (zgodne bez straty; pozostałe po potwierdzeniu).
  - [ ] Tryb wiersza: podgląd (formatowanie, klik w wiersz, Edytuj/Usuń po najechaniu) i edycja (kontrolki z 3.2, Zapisz, ✕); nowy wiersz w edycji; puste tytuły „Bez tytułu/Bez nazwy”.
  - [ ] „+ Pole” (typy podstawowe), menu kolumny (typ, sort, filtruj, podsumowanie, ukryj, usuń; tytułowe nieusuwalne).
  - [ ] Filtr (warunki „i”, operatory wg typu, „Zapisz jako domyślny”, licznik, „Filtruj · N”).
  - [ ] Podsumowania kolumn i przypięte karty liczone z wierszy po filtrze, na żywo.
- Szablony i kosz
  - [ ] Nowa strona: lista szablonów, „Pola, które powstaną”, nazwa, „Utwórz stronę”; Books, Projects, Websites z kartami z makiet; strony z onboardingu tworzone przy pierwszym wejściu.
  - [ ] Projects: „za N dni” czerwone ≤ 7 dni, „minął”, „dziś”, „jutro”, „za N mies.”.
  - [ ] Kosz 30 dni: „Usunięto · Cofnij”, sekcja w Ustawieniach → Ogólne, czyszczenie pg_cron, link w 404.

**Testy:** walidacja wartości per typ, zmiana typu, sort, filtr, podsumowania po filtrze, karty, kolejność bloków, menu „/”, RLS stron, e2e strona z szablonu Books (dodanie, edycja, usunięcie wiersza), e2e strona z edytora z tabelą i zmianą typu kolumny, zrzuty.

---

## Etap 7: Inteligentne pola i Subscriptions
**Makiety:** Main (Subscriptions), AddField (Kwota cykliczna, Data odnowienia), CalendarRenewal · MSubs, MRowEdit.

**Lista odbiorcza**
- [ ] Kwota cykliczna (tydzień/miesiąc/kwartał/rok, przeliczenia, „43,00 zł / mies.”, suma w stopce); w edycji kwota + segment cyklu.
- [ ] Data odnowienia (najbliższa przyszła data, „za N dni”), wybór daty w edycji.
- [ ] Szablon Subscriptions: karty Σ mies., Σ rok, Najbliższe odnowienie; sort po odnowieniu; kategoria jako lista rozwijana z ✓.
- [ ] Data z „Pokaż w kalendarzu” i „tylko gdy [Checkbox]”; wpisy całodniowe w tygodniu, dniu i miesiącu; chip strony w filtrach.
- [ ] Dymek podglądu odnowienia z „Otwórz w Subscriptions →” i podświetleniem wiersza.
- [ ] Telefon: karty wierszy, kafelki sum, „Najbliżej”, chipy filtra, arkusz edycji z kalendarzem, kategoriami, „Aktywna”, „Przypomnij 3 dni przed” (`page_rows.remind`; na komputerze ten sam przełącznik w trybie edycji wiersza), „Usuń wiersz”.

**Testy:** cykle, najbliższe odnowienie, wystąpienia w zakresie, warunek Checkbox, e2e subskrypcja widoczna w kalendarzu i znika po odznaczeniu „Aktywna”, zrzuty.

---

## Etap 8: Sejf
**Makiety:** VaultSetup, Vault, Passwords, VaultReset, Settings (Sejf) · MVault, MPasswords.

**Lista odbiorcza**
- [ ] Ustaw sejf: hasło główne z miernikiem, powtórz, ostrzeżenie, „Rozumiem…” odblokowuje „Utwórz sejf”.
- [ ] Zablokowany: „— zablokowane”, karta odblokowania, „Nie pamiętam hasła — zresetuj sejf”.
- [ ] Odblokowany: baner z odliczaniem auto-blokady, „Zablokuj teraz”, pokaż/kopiuj, czyszczenie schowka po 30 s.
- [ ] Reset: N sekretów, co zostaje, „Wpisz RESETUJ, żeby potwierdzić”, przycisk aktywny po zgodności.
- [ ] Kryptografia ze spec 6.9; zmiana hasła głównego; Ustawienia → Sejf (stan, zmiana hasła, czas blokady 1/5/15 min, Zablokuj, Reset).
- [ ] Szablon Passwords.
- [ ] Telefon: `MVault` (komunikat przy pustym polu), `MPasswords` (wyszukiwanie, rozwijane wiersze, pokaż/kopiuj z komunikatem, „słabe hasło”, kłódka blokuje).

**Testy:** wektory szyfrowania i owijania, błędne hasło, zmiana hasła głównego, serwer odrzuca Sekret w złym kształcie, e2e ustaw → zablokuj → odblokuj, zrzuty.

---

## Etap 9: Powiadomienia push
**Makiety:** SettingsNotifications, OnboardingNotify (prawdziwa subskrypcja) · MSettings (sekcja powiadomień).

**Lista odbiorcza**
- [ ] Service worker, VAPID, subskrypcja z onboardingu i ustawień.
- [ ] Ustawienia: push na urządzeniu (wyłączony wyszarza resztę), przełączniki (nawyki, start bloku, odnowienia), cicha noc z wyborem godzin, „Wyślij testowe” z liczbą urządzeń, urządzenia z „TO” i Wyłącz/Włącz, przypomnienia nawyków z wyborem godziny.
- [ ] pg_cron + funkcja brzegowa: nawyki, start bloku (tylko `blocks.remind`), odnowienia (tylko `page_rows.remind`), podsumowanie tygodnia; cicha noc; `notification_log`.

**Testy:** wybór powiadomień w danej minucie (strefy, cicha noc, odhaczone, duplikaty, wyłączone urządzenia), zrzuty.

---

## Etap 10: Paleta ⌘K, Szukaj, konto, końcowe porównanie
**Makiety:** CommandK, QuickAdd, SettingsAccount, Settings (skróty konta, Usuń konto) · MSearch, MSettings.

**Lista odbiorcza**
- [ ] Paleta ⌘K (web): wyszukiwanie w grupach, szybkie dodawanie z parserem i panelem „Rozumiem to tak”, „Otwórz pełny formularz”.
- [ ] Szukaj (telefon): pole, „Ostatnio”, „Szybkie akcje”, wyniki grupowane na żywo, „Nic nie znaleziono”.
- [ ] Konto i bezpieczeństwo: zmiana hasła (pasek siły, zgodność, opis braków, wylogowanie innych), zmiana e-maila, karta Sesje (to urządzenie „TA” + „Wyloguj wszystkie inne”), eksport JSON z postępem, usunięcie konta słowem USUŃ.
- [ ] Ustawienia → Ogólne: „Zmień” e-mail inline, sekcja Usuń konto.
- [ ] Telefon `MSettings`: profil, początek tygodnia, powiadomienia, konto, „Wyloguj się”.
- [ ] Końcowe porównanie **wszystkich** ekranów z makietami (web i telefon) i poprawki.

**Testy:** parser szybkiego dodawania, eksport (sekrety zaszyfrowane), e2e usunięcia konta, pełny zestaw zrzutów 1440/390.

---

## Pokrycie makiet
Każdy plik z płótna ma etap. Ekrany web bez pary mobilnej na telefonie dostają układ jednokolumnowy / arkusz (spec 6.13).

| Makieta (web) | Etap | Makieta (telefon) | Etap |
|---|---|---|---|
| Login, Register, Forgot, EmailConfirmed | 0 | MLogin, MRegister, MForgot | 0 |
| NotFound | 0 (kosz: 6) | MTabBar | 0 |
| Sidebar | 0 (strony: 6) | MOnboarding | 1 |
| Onboarding, Role, Goals, Source, Pages, Notify, Done | 1 (push: 9, strony: 6) | MToday, MQuickAdd | 5 |
| EmptyToday | 1 | MSearch | 10 |
| Today | 5 | MCalendarDay, MCalendarWeek, MCalendarMonth, MBlockSheet | 2 |
| QuickAdd, CommandK | 10 | MHabits, MHabitDetail, MHabitNew, MSleep | 3 |
| Calendar, CalendarDay, CalendarMonth, BlockDialog, ScopeDialog, CategoryDialog | 2 | MSport, MRunNew, MGym | 4 |
| CalendarRenewal | 7 | MPages, MEditor | 6 |
| Habits, HabitDetail, HabitDialog, SleepDialog | 3 | MSubs, MRowEdit | 7 |
| Sport, RunDialog, GymLog, WorkoutTemplates, ExerciseDetail | 4 | MVault, MPasswords | 8 |
| NewPage, EmptyPage, Books, Projects, Websites, AddField (podst.), ColumnMenu, FilterPopover, PageMenu | 6 | MSettings | 9 (powiadomienia) + 10 |
| Main (Subscriptions), AddField (inteligentne) | 7 | | |
| VaultSetup, Vault, Passwords, VaultReset | 8 | | |
| Settings (Ogólne) | 1 (Kosz: 6, konto: 10) | | |
| Settings (Kategorie) | 2 | | |
| Settings (Sejf) | 8 | | |
| SettingsNotifications | 9 | | |
| SettingsAccount | 10 | | |
| MobileToday, MobileCalendar (stare, na stronie Web) | zastąpione przez MToday, MCalendarDay | | |
