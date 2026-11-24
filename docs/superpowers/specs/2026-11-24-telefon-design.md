# Etap 3: telefon — projekt

Data: 2026-11-24. Autor: Claude (szkic, seria autonomiczna). Ostatni projekt serii: Dziś → Subscriptions → sprzątanie webu → **Etap 3**. Etap startuje z `main` po scaleniu sprzątania.

## Cel

Każdy ekran aplikacji poniżej 800 px wygląda jak odpowiadająca mu makieta `docs/design/mockups/CM*.dc.html`. Makiety są wiążące i w sprawach wyglądu wygrywają z tym specem i planami. Etap zamyka uwagi z `docs/superpowers/odlozone.md` oznaczone „Etap 3” albo dotyczące telefonu, a telefon dostaje nowe zasady z projektów Dziś (zadania tylko w blokach) i Subscriptions (CMSubs).

## Źródła

- Makiety telefonu: 26 plików `CM*.dc.html` + arkusz `coss/coss.css`. Każdy plik ma ten sam blok CSS „CM-BASE” (klasy `m-*`) w `<helmet><style>`. Zrzut: `PW_CHANNEL=chrome pnpm -s mockups:shots CMToday` → `test-results/mockups/CMToday.png` (390×844).
- Spec COSS (`docs/superpowers/specs/2026-11-20-coss-ui-design.md`), punkt „Etap 3 — telefon” i „Telefon (blok CM-BASE)”.
- Spec Dziś (`2026-11-24-dzis-design.md`), punkt B. Spec Subscriptions (`2026-11-24-subscriptions-design.md`), punkty 5 i „Poza zakresem”.

**Ważne ustalenie:** porównałem teksty wszystkich par `M*.dc.html` (archiwum) i `CM*.dc.html`. Różnią się tylko stylem, a teksty, stany i przepływy są te same (wyjątki w inwentaryzacji). Kod telefonu (`src/features/*/mobile/m-*.tsx`) powstał według `M*`. Etap 3 to więc przede wszystkim **przestylowanie** istniejących komponentów na CM*, bez przebudowy logiki. Dochodzą ekrany i funkcje, które pojawiły się po makietach M*:
- Hasła jako moduł;
- Strony 2.0;
- Subscriptions;
- wyszukiwanie (dziś zaślepka).

## Stan obecny (zbadany 2026-11-24)

- Telefon renderuje się w tym samym drzewie co web, a przełącza go CSS na 800 px (`min-[800px]:hidden` / `max-[799px]:…`). Komponenty telefonu siedzą w `src/features/*/mobile/m-*.tsx`.
- Wspólne elementy:
  - `src/components/shell/tab-bar.tsx` (`TAB_ITEMS` w `nav-items.ts`);
  - `module-header.tsx`, którego wariant telefonu ma tytuł 28 px i etykietę mono, czyli styl M*;
  - `src/components/controls/form-dialog.tsx` (arkusz poniżej 800 px).
- Kontrolki i tokeny są już COSS (Etap 1). Układy i drobny styl telefonu są wciąż M*: etykiety `font-mono uppercase` (od 1 do 12 wystąpień w każdym `m-*.tsx`), tytuły 28 px, hexy w `m-habits.tsx` (15), `m-sport.tsx` (5) i w kalendarzu.
- `/szukaj` to zaślepka „Wyszukiwanie pojawi się wkrótce.”.
- Na telefonie `/hasla` nie zaznacza żadnej zakładki (A1).
- Ustawienia na telefonie: te same zakładki co web (poziomy pasek) i karty.

## Wspólne zasady wyglądu (CM-BASE → kod)

CM-BASE trafia raz do `src/app/globals.css` jako narzędzia Tailwind 4 (`@utility`) o nazwach z makiet. Wykonawca przepisuje wtedy markup makiety prawie 1:1, a wygląd ma jedno źródło (decyzja T2). Wartości dokładnie z CM-BASE (`docs/design/mockups/CMToday.dc.html`, blok `/* CM-BASE */`):

| Narzędzie | Wartość z CM-BASE |
|---|---|
| `m-head` | flex, `align-items:center`, `justify-content:space-between`, `gap:8px`, `min-height:52px`, `padding:0 12px 0 16px`, dolna ramka `--border`, tło białe |
| `m-title` | 18 px, 600, `letter-spacing:-.011em`, `margin:0` |
| `m-row` | flex, `gap:12px`, `min-height:48px`, `padding:0 16px`, dolna ramka (bez ostatniego), bez podkreślenia |
| `m-sheet` / `m-grab` | arkusz: zaokrąglenie 16 px u góry, `max-height:88%`; uchwyt 36×4 px, `rgba(0,0,0,.14)`, `margin:8px auto 0` |
| `m-step` | ramka `--input`, przyciski 44×44, liczba min. 48 px, cyfry tabelaryczne |
| `m-fab` | 56×56, promień 16 px, `primary`, cień z makiety. Pozycja `right:16px`, `bottom: calc(var(--tabbar-h) + 20px)` (makieta: 84 px = 64 + 20) |
| `m-hit` | `::before` z `inset:-14px` (cel dotyku ≥ 44 px dla 16-pikselowych checkboxów i przełączników) |
| `stats` / `stat` / `stat-v` | siatka 2×N z liniami 1 px (CMToday) |
| `sec-h`, `plan-block` | nagłówek sekcji i wiersz planu (CMToday) |

Do tego obowiązują rozmiary dotykowe z CM-BASE:
- przyciski 44 px;
- pola i Dropdown 44 px z fontem 16 px (bez zoomu iOS);
- przyciski segmentu 40 px;
- chip 36 px;
- pozycja menu 44 px.

Kontrolki z `@/components/controls` już mają warianty telefonu. Pakiet „fundament” poprawia te, które ich nie spełniają. Klasy `.lbl`, `.hint`, `.card`, `.bdg`, `.seg`, `.chip`, `.igroup`, `.avatar`, `.empty`, `.prog` z `coss.css` odwzorowujemy przez istniejące kontrolki (`Card`, `StatusBadge`, `Segment`, `Chip`, `Avatar`, `EmptyState`, `Progress`) albo przez klasy Tailwind z wartościami z `coss.css`.

Pasek statusu `m-status` („9:41”) to tylko rama telefonu w makiecie i się go nie odwzorowuje (T3).

## Inwentaryzacja ekranów

Kolumna „Zgodne” mówi, co już działa jak w makiecie (dane, stany, przepływ). „Do zmiany” mówi, co trzeba przestylować albo dodać.

| Makieta | Kod dziś | Zgodne | Do zmiany | Pakiet |
|---|---|---|---|---|
| CMTabBar | `components/shell/tab-bar.tsx`, `nav-items.ts` | 5 zakładek, etykiety, ikony, wysokość z safe-area | Ikony 20 px (dziś 22); zakładka `min-h-11 rounded-lg font-medium`, nieaktywna `rgba(38,38,38,.68)`, aktywna z tłem `rgba(0,0,0,.05)`; tło `--sidebar`, ramka `--sidebar-border`; `/hasla` zaznacza „Strony” (A1) | fundament |
| (wspólne) nagłówek | `components/shell/module-header.tsx` | tytuł, link ⚙ | Telefon: `m-head` + `m-title` 18 px, etykieta `.lbl` 12 px zamiast mono; sloty „wstecz” i akcje po prawej (44 px) | fundament |
| (wspólne) arkusz | `controls/form-dialog.tsx` | arkusz od dołu z uchwytem | Uchwyt 36×4, promień 16, `max-h-[88%]`, tło `.backdrop`; wariant nagłówka „Anuluj · tytuł · Zapisz” (CMBlockSheet, CMRowEdit) jako opcja | fundament |
| (wspólne) usuwanie | `calendar/delete-block-dialog.tsx`, `sport/delete-session-dialog.tsx`, `pages/delete-page-dialog.tsx`, `habits/delete-habit-dialog.tsx` | potwierdzenia działają | Jeden wygląd: arkusz na telefonie (Sport ma dziś kartę na środku), karta `.dlg` od 800 px; nowa kontrolka `ConfirmDialog` (T6) | fundament |
| CMToday | `today/mobile/m-today.tsx` | kafelki 2×2, „Teraz” z zadaniami, Plan dnia, Nawyki, karta biegu, FAB, szukaj, awatar; zadania tylko z bloków (po Dziś) | Nagłówek transparentny z `.hint` daty i `m-title`; `stats`; karta „TERAZ” w kolorze kategorii z `bdg ok`; `plan-block`; nawyki w `card` z `m-row` 52 px i `bdg out` serii; checkboxy `cbx m-hit`; FAB `m-fab`; usunąć `font-mono` | dzis |
| CMQuickAdd | `today/mobile/m-quick-add.tsx` | rodzaje Blok/Bieg/Nawyk (po Dziś), chipy „Kiedy”, „Pełny formularz…” | Wygląd arkusza CM (`dlg-h` z ✕, `.seg`, `.fld`, chipy 36 px, `btnp` na całą szerokość). **Konflikt:** makieta ma „Zadanie” (domyślne) i chip „Bez daty”. Rozstrzygnięcie: bez „Zadanie”, domyślny „Blok”, bez „Bez daty” (T5) | dzis |
| CMCalendarDay | `calendar/mobile/m-calendar-day.tsx`, `calendar-header.tsx`, `category-filters.tsx` | pasek tygodnia z kropkami, oś doby, „teraz”, FAB, arkusz kategorii | `m-head` „Listopad” + `.lbl` „tydz. N”, ikony Kategorie i Szukaj; `.seg` widoków 40 px; `day-pick`; wiersz daty z `bdg sec` licznika; linia „teraz” `#ef4444` z kropką; bloki w stylu COSS (tło `12`, ramka `4d`); arkusz kategorii: „Kategoria” zamiast „+ Kategoria”, bez „✕” | kalendarz |
| CMCalendarWeek | `calendar/mobile/m-calendar-week.tsx` | lista dni z blokami, FAB | `m-head` z `.lbl` „2026 · tydzień 46” i tytułem zakresu, akcje Szukaj i „Nowy blok”; odznaka dnia; wpisy COSS | kalendarz |
| CMCalendarMonth | `calendar/mobile/m-calendar-month.tsx` | siatka z kropkami, wybrany dzień i lista, „Brak bloków — dodaj” | `m-head` z rokiem `.lbl` i strzałkami; `month-cell`; lista wybranego dnia z „Otwórz dzień”; przycisk przerywany 56 px | kalendarz |
| CMBlockSheet | `calendar/mobile/m-block-sheet.tsx` | pola, kategorie, kroki ±, powtarzanie, zadania w bloku | Nagłówek „Anuluj · Nowy blok · Zapisz”; nazwa 18 px; chipy kategorii z kropką i pierścieniem `0 0 0 2px #fff, 0 0 0 4px kolor+66`; karta z `m-row` (Dzień jako `igroup` „nd 15.11.2026” bez przecinka, Od/Do `m-step`, czas trwania `.hint`); `.seg` powtarzania; „Zadania w bloku · N” w karcie z `cbx` i „Dodaj zadanie…”; czarny Progress/checkbox w szczegółach (odłożone T8) | kalendarz |
| CMHabits | `habits/mobile/m-habits.tsx` | segment Nawyki/Sen, odhaczanie, heatmapa 4 tyg., sen: ostatnia noc, średnia, wykres | `m-head` z `.lbl` daty; karta postępu; wiersz: `cbx m-hit` + nazwa + `.hint` częstotliwość **osobno** od `bdg sec` „seria N” (w M* były razem); heatmapa w odcieniach CM (`rgba(0,0,0,.05)`, `#bbe5cc`, `#86c99f`, …) z pierścieniem `0 0 0 2px #262626` dla wybranej; 15 hexów → wartości z makiety | nawyki |
| CMHabitDetail | `habits/mobile/m-habit-detail.tsx`, `habit-month.tsx`, `habit-notes.tsx` | seria, rekord, skuteczność, miesiąc, notatki, „Usuń nawyk” | `m-head` (Wstecz, Edytuj); `.lbl` nad `m-title`; 3 karty liczb; miesiąc w `card`; gałęzie telefonu w `habit-month` rozplecione (odłożone 2b); „Usuń nawyk” `btndo` → `ConfirmDialog` | nawyki |
| CMHabitNew | `habits/mobile/m-habit-sheet.tsx` | nazwa, częstotliwość, dni, przypomnienie | Arkusz CM; `.seg` bez rozlewania (odłożone 2b „Segment overflow w habit dialog”) | nawyki |
| CMSleep | `habits/mobile/m-sleep-sheet.tsx` | godziny, jakość, notatka | Arkusz CM, `m-step`, `.seg` nastroju | nawyki |
| CMSport | `sport/mobile/m-sport.tsx` | segment zakresu, karta Bieganie z `prog`, wykres km, „Bieg/Trening/Szablony”, „Zaplanowane” (decyzja z 2c), „Ostatnie” | `m-head` z `.lbl` „Tydzień 46 · 9–15.11”; `prog` pomarańczowy `#f59e0b` pill; słupki; przyciski `btnp`/`btn`; lista `m-row`; usunąć 12 × mono i 5 hexów | sport |
| CMGym | `sport/mobile/m-gym.tsx` | serie, odhaczanie, „+ Dodaj serię”, „Dodaj ćwiczenie”, „Zakończ” | `m-head` (Wstecz, tytuł + `.hint` „N/M serii · czas”, „Zakończ”); `prog` pod nagłówkiem; `set-grid` z nagłówkami „Seria / kg / Powt.” (makieta: zwykła wielkość liter, M* miało wersaliki); `bdg sec` numeru serii; `bdg out` poprzedniego wyniku | sport |
| CMRunNew | `sport/mobile/m-run-new.tsx` | rodzaj, dystans/czas ±, tempo, trudność 1–10, dzień, kalendarz główny, notatka | `m-head` „Anuluj · Nowy bieg · Zapisz”; chipy `m-hit`; karta `m-row` z `m-step`; przyciski `effort` w kolorach skali (zielony → `#f59e0b` → `#ef4444`); Dzień i godzina jako **dwa** `igroup` („nd 15.11.2026” i „16:00”) | sport |
| CMPages | `pages/mobile/m-pages.tsx`, `app/(app)/strony/page.tsx` | Hasła na górze, „Ulubione”, „Wszystkie strony”, dopiski, „Nowa strona” | `m-head` z `.lbl` „Twoje tabele i notatki”, akcje Ustawienia i „Nowa strona”; `igroup` szukajki (zostaje lokalny filtr, T15); wiersze `m-row` z `empty-ic` ikoną strony; przycisk przerywany 56 px | strony |
| CMEditor | `pages/editor/mobile/m-editor.tsx`, `m-insert-sheet.tsx`, `table/page-table.tsx` (gałąź telefonu), `table/column-menu.tsx` (arkusz „Kolumna”) | nagłówek, tytuł, bloki, „/”, pasek skrótów, „Wstaw blok” | `m-head` (Strony, „Więcej”); `ed-body`, `ed-in`; `editbar` (`btnp ic` + 3 × `btng ic` + `bdg sec` licznika); arkusz „Wstaw blok” z `block-icon` 40 px i pozycjami 60 px; tabela jako `frame` z nagłówkami `th-cell` 44 px, wierszami 44 px, „Nowy wiersz” i `bdg sec`; arkusz „Kolumna” (nazwa, chipy typów 2 kolumny, „← W lewo / W prawo →”, „Usuń kolumnę”); „⋯” opcji widoczne na dotyku (odłożone krok 2 Task 4) | strony |
| CMRowEdit | `pages/table/mobile/m-row-sheet.tsx` | pola wszystkich typów, Sekret z oczkiem (M9 już działa), „Usuń wiersz” | Arkusz 90% z „Anuluj · tytuł · Zapisz”; pola `.fld`; Wybór/Status jako chipy `m-hit`; Checkbox jako przełącznik w karcie `m-row`; data jako karta z kalendarzem miesiąca (`date-cell` 40 px) i `.hint` „dd.mm.rrrr · za N dni”; „Usuń wiersz” `btndo` | strony |
| CMPasswords | `passwords/passwords-view.tsx` + `PageTable` modułu | wyszukiwanie, segment Kategorii, odsłanianie, kopiowanie z czyszczeniem schowka, plakietki | Na telefonie lista-akordeon: `m-head` (Strony, „Zablokuj sejf” w kolorze ostrzeżenia, „Nowe hasło”); tytuł 24 px; `bdg ok lg` „odblokowany · auto-blokada za m:ss”; `igroup` „Szukaj”; `frame` z wierszami (`avatar` z inicjałem, Serwis, Login, chevron obracany o 90°), rozwinięcie z hasłem `••••`, oczkiem, kopiowaniem i dopiskiem; edycja przez „Edytuj” w rozwinięciu → arkusz CMRowEdit (T8) | hasla |
| CMVault | `vault/*` (karta „Odblokuj sejf”) | odblokowanie hasłem głównym, błąd pustego pola, „Nie pamiętam…” | Pełny ekran telefonu: `m-head` (Strony), `empty` z ikoną 56 px, tytuł 24 px, opis, pole 44 px, `btnp` „Odblokuj”, link „Nie pamiętam hasła głównego” (→ reset). **Bez** „Odblokuj biometrią” (T7) | hasla |
| CMSubs | brak (Subscriptions dodaje tylko arkusz wiersza) | — | Nowy widok telefonu dla stron z `template_key = 'subscriptions'`: 2 karty sum (Miesięcznie/Rocznie), pasek „Najbliżej: … · zł” z `bdg warn`, `.seg` Wszystkie/Miesięczne/Roczne, lista `m-row` (avatar, nazwa, „dd.mm · za N dni” na czerwono ≤ 7 dni, kwota „/m” albo „/r”, plakietka kategorii), licznik „N z M subskrypcji” | subskrypcje |
| CMRowEdit (Subscriptions) | `m-row-sheet.tsx` (minimum z projektu Subscriptions) | Kwota + cykl, Data odnowienia | Kwota jako `igroup` z „zł” + `.seg` „mies. / rok” w siatce `1fr 150px`; Data odnowienia: kalendarz miesiąca i `.hint` z czasem do następnego odnowienia; Aktywna jako przełącznik. bez przełącznika przypomnienia — usunięty z makiety 24.11 (T12) | subskrypcje |
| CMLogin | `components/auth/auth-shell.tsx`, `features/auth/*` | pola, oczko, „Nie pamiętasz hasła?”, Google, link rejestracji | Karta z `card-h` (tytuł 20 px, `card-d`), pola 44 px, link 44 px, `btnp`/`btn` na całą szerokość, separator „lub” | konto |
| CMRegister | `features/auth/register-form.tsx`, `strength-bar.tsx` | pola, siła hasła, zgoda | Pasek siły 6 px pill w kolorach `#ef4444`/`#f59e0b`/zielony i tle `rgba(0,0,0,.06)` (odłożone 2g: hex PhoneStrengthBar); CTA nieaktywne bez zgody | konto |
| CMForgot | `features/auth/reset-steps.tsx`, `check-inbox.tsx` | kroki resetu | Pusty kontener stopki w kroku 1 (odłożone 2g); tytuł kroku 600, opis muted | konto |
| CMOnboarding | `features/onboarding/wizard.tsx`, `steps/*` | 7 kroków, „Wyloguj”, wstecz | `m-head` z `bdg sec` „Krok N z 7”, pasek `steps` 7 kresek, `step-title` 24/32 px; kroki według makiety; notka sejfu jako `alert info` (odłożone 2g); „Gotowe” 600; „Wyloguj” `btng muted` (odłożone 2g) | konto |
| CMSettings | `app/(app)/ustawienia/*`, `features/settings/*` | profil, zdjęcie, cele, sejf, powiadomienia, kategorie, kosz, wylogowanie | Telefon `/ustawienia`: ekran-indeks według CMSettings (`m-head` z „Wstecz” → `/dzis` i tytułem na środku; karta profilu z awatarem 52 px i stopką „Zdjęcie profilowe”; karta z `m-row` do zakładek; „Wyloguj się” `btndo`; dopisek wersji). Zakładki na telefonie jako podstrony z „Wstecz” → `/ustawienia`, bez poziomego paska. Bez „Motyw” i „Eksport danych” (T9) | konto |
| CMSearch | `app/(app)/szukaj/page.tsx` (zaślepka) | — | Nowa funkcja: `igroup` „Szukaj w rhytm” + „Anuluj”; pusty stan: chipy „Ostatnio” i „Szybkie akcje”; wyniki w grupach Strony / Kalendarz / Nawyki / Sport (`m-row` 52 px z tytułem i `.hint`); „Nic nie znaleziono dla „q””. Web: ten sam ekran na środku, bez zmian w sidebarze (T14) | szukaj |

## Konflikty makiet z regułami i ich rozstrzygnięcie

1. **CMQuickAdd: „Zadanie” jako domyślny rodzaj i chip „Bez daty”.** Kłóci się z regułą projektu Dziś: zadanie zawsze należy do bloku, w bazie `NOT NULL`. Wygrywa reguła. Rodzaje to „Blok · Bieg · Nawyk”, domyślny „Blok”, bez „Bez daty”. Zadania dodaje się w arkuszu bloku („Zadania w bloku”, CMBlockSheet). Wygląd segmentu i chipów według makiety.
2. **CMSearch: „Nowe zadanie lub blok”** w szybkich akcjach. Tekst „Nowy blok”, otwiera szybkie dodawanie z rodzajem Blok.
3. **CMToday: kafelek „Zadania x/y”** zostaje: liczy zadania w dzisiejszych blokach, zgodnie z regułą.
4. **CMPages / CMPasswords / CMVault: „Passwords”** jako zwykła strona szablonu. W aplikacji to moduł „Hasła” (`/hasla`, Strony 2.0 krok 3). Na liście stron i w tytule jest „Hasła”, a układ ekranu według CMPasswords/CMVault.
5. **CMTabBar bez zakładki Hasła** (w `stan-projektu.md` jest skrót „zakładka Hasła w dolnym pasku”). Wygrywa makieta. Pasek ma 5 zakładek, a `/hasla` zaznacza „Strony”. To właśnie odłożone A1.
6. **CMSettings: „Motyw” (Jasny/Ciemny/Systemowy) i „Eksport danych”.** Ciemny motyw to nie-cel specu COSS, a eksportu nie ma w aplikacji. Według zasady COSS przy różnicy funkcjonalnej wygrywa aplikacja: tych pozycji nie dodajemy. Zostają pozycje istniejące.
7. **CMVault: „Odblokuj biometrią”.** Aplikacja nie ma WebAuthn, więc przycisk pomijamy.
8. **CMRowEdit: „Przypomnij 3 dni przed”.** Usunięte z makiety (decyzja Mejsona 24.11): o odnowieniach przypomina wspólne ustawienie „dzień przed” w Ustawieniach → Powiadomienia.

## Uwagi z `odlozone.md` przypisane do pakietów

| Uwaga (źródło) | Pakiet |
|---|---|
| A1: `/hasla` nie zaznacza zakładki „Strony” (Strony 2.0 krok 3) | fundament |
| `ui/input` 15 px na telefonie, czyli zoom iOS (Etap 1 Task 3) | fundament |
| Dropdown compact 28 px na telefonie (Etap 1 Task 3) | fundament |
| Stepper: `overflow-hidden` ucina pierścień fokusu; Segment bez `flex-wrap` (Etap 1 Task 4) | fundament |
| Rozmycie tła FormDialog na telefonie a makieta (Etap 1 Task 5): CM ma `.backdrop` bez rozmycia | fundament |
| Okno usuwania strony: arkusz na telefonie, Sport ma kartę. Ujednolicić (2d) | fundament |
| page-menu i account-popover: układy telefonu (Etap 1 Task 5 „phone layouts are Stage 3”) | fundament (page-menu) / konto (konto) |
| Czarny Progress/checkbox w BlockDetails na telefonie (Etap 1 Task 8); radio 16 px w scope-dialog na telefonie (2a Task 4) | kalendarz |
| Gałęzie telefonu przeplecione w `habit-month` (2b Task 3); Segment rozlewa się w oknie nawyku (2b Task 4) | nawyki |
| Kafelki exercise-detail jako osobne karty, odstępy w template-editor/templates-list — zweryfikować z CM* (2c) | sport |
| „⋯” opcji niewidoczne na dotyku (krok 2 Task 4); `m-row-sheet.test` niestabilny raz (krok 3, zad. 5) | strony |
| M9 (telefon nie edytuje Sekretu) — **już naprawione**, arkusz ma pole Sekret. Do zrobienia zostaje układ CMPasswords | hasla |
| Status „ladowanie” chwilowo pokazuje „zablokowane”; arkusz odszyfrowuje sekrety od razu po otwarciu; klik w trakcie szyfrowania otwiera starą wartość (krok 3, zad. 3); `zapisujeRef` cicho ignoruje „Zapisz” (Sejf) | hasla |
| Etap 2g: pusty kontener stopki w kroku 1 resetu, notka sejfu `alert.info`, PhoneStrengthBar hex, tytuł kroku/„Gotowe” 600 i opis muted, „Wyloguj” font-medium + tło hover z Button | konto |
| Odnowienia subskrypcji w kalendarzu telefonu (spec Subscriptions, „Poza zakresem”) | subskrypcje |

## Pakiety (kolejność, każdy na osobnej gałęzi i scalany osobno)

| # | Gałąź | Zakres | Zależy od | Plan |
|---|---|---|---|---|
| 1 | `feat/telefon-fundament` | `@utility` CM-BASE, pasek zakładek, nagłówek telefonu, arkusz, `ConfirmDialog` i ujednolicone usuwanie, rozmiary dotykowe kontrolek | — | `telefon-plan-fundament.md` |
| 2 | `feat/telefon-kalendarz` | CMCalendarDay/Week/Month, CMBlockSheet, arkusz kategorii | 1 | `telefon-plan-kalendarz.md` |
| 3 | `feat/telefon-dzis` | CMToday, CMQuickAdd | 1, 2 (arkusz bloku) | `telefon-plan-dzis.md` |
| 4 | `feat/telefon-nawyki` | CMHabits, CMHabitDetail, CMHabitNew, CMSleep | 1 | `telefon-plan-nawyki.md` |
| 5 | `feat/telefon-sport` | CMSport, CMGym, CMRunNew (+ szablony i ćwiczenie w stylu CM) | 1 | `telefon-plan-sport.md` |
| 6 | `feat/telefon-strony` | CMPages, CMEditor, CMRowEdit (ogólny), arkusz „Kolumna”, page-menu na telefonie | 1 | `telefon-plan-strony.md` |
| 7 | `feat/telefon-hasla` | CMPasswords, CMVault, odłożone sejfu na telefonie | 1, 6 (arkusz wiersza) | `telefon-plan-hasla.md` |
| 8 | `feat/telefon-subskrypcje` | CMSubs, CMRowEdit dla Kwoty i Daty odnowienia, odnowienia w kalendarzu telefonu | 2, 6 | `telefon-plan-subskrypcje.md` |
| 9 | `feat/telefon-konto` | CMLogin, CMRegister, CMForgot, CMOnboarding, CMSettings | 1 | `telefon-plan-konto.md` |
| 10 | `feat/telefon-szukaj` | CMSearch (web + telefon) | 1–9 (cele linków) | `telefon-plan-szukaj.md` |

Dlaczego taka kolejność:
- fundament zmienia wspólne elementy, na których stoją wszystkie ekrany;
- kalendarz idzie przed Dziś, bo Dziś otwiera arkusz bloku;
- strony idą przed Hasłami i Subskrypcjami, bo oba używają arkusza wiersza;
- szukaj idzie na koniec, bo linkuje do wszystkich ekranów i jest jedyną nową funkcją.

Pakiety 4, 5 i 9 są niezależne i mogą zmienić kolejność.

**Każdy pakiet:**
- gałąź z aktualnego `main`;
- spec tego etapu skopiowany do `docs/superpowers/specs/2026-11-24-telefon-design.md` przy pierwszym pakiecie;
- plan pakietu kopiowany do `docs/superpowers/plans/` przy jego starcie;
- przegląd całej gałęzi na końcu;
- CI zielone, scalenie według zasad serii, wpis w dzienniku;
- migracji w Etapie 3 nie ma (T11).

## Testy

- **Vitest:** testy komponentów `m-*` zostają testami zachowania (role, nazwy, kliknięcia). Testy sprawdzające dosłowne klasy stylu aktualizuje się razem ze zmianą (zasada ze specu COSS). Testów zachowania nie osłabiamy.
- **e2e (CI, projekt `mobile` 390×844):** istniejące testy telefonu w `e2e/*.spec.ts` (`info.project.name === "mobile"`) muszą przechodzić. Gdy zmienia się tekst albo rola, aktualizuje się selektor, a nie usuwa test.
- **Zrzuty:** `e2e/visual.spec.ts` robi zrzuty telefonu. Każdy pakiet dopisuje nazwy makiet CM* w tytułach testów (np. „…(makiety CMToday, CMQuickAdd)”) i zrzuty nowych stanów. Wykonawca porównuje wygląd z `pnpm -s mockups:shots <CM…>` ręcznie przez podgląd lokalny (`pnpm dev` + Chrome 390×844 albo `PW_CHANNEL=chrome`), bo lokalnie nie ma bazy. Ekrany z danymi ogląda na podglądzie Vercel gałęzi.
- **Cele dotykowe:** w każdym pakiecie test jednostkowy co najmniej dla nowych przycisków ikon: klasa `size-11`/`min-h-11` albo `m-hit`.

## Poza zakresem

- Ciemny motyw, eksport danych, biometria, powiadomienia (przypomnienia odnowień).
- Rozdzielenie drzew web/telefon (osobne trasy, wykrywanie urządzenia) (T1).
- Zmiany webu poza tym, czego wymaga wspólny komponent. Przy zmianie wspólnego komponentu web ma wyglądać jak przed nią: zrzuty `visual.spec` web porównuje się przed i po.
- Gesty (przesuwanie dni, przeciąganie bloków na telefonie) — makiety ich nie pokazują.
- PWA/offline.

## Decyzje Claude

| # | Decyzja | Uzasadnienie | Koszt pomyłki |
|---|---|---|---|
| T1 | Zostaje wspólne drzewo web/telefon z przełączaniem CSS na 800 px. | Tak działa cała aplikacja i jej testy. Rozdzielenie to osobny projekt bez wpływu na wygląd. | Średni: podwójny DOM kosztuje trochę wydajności, ale da się to zmienić później bez zmiany wyglądu. |
| T2 | CM-BASE jako `@utility` w `globals.css` o nazwach z makiet (`m-head`, `m-row`, …). | Jedno źródło wyglądu telefonu i markup 1:1 z makiet, bez funkcji pomocniczych w TS. | Niski: narzędzia można rozwinąć w klasy w miejscu użycia. |
| T3 | Pasek statusu z makiet (`m-status`) nie jest odwzorowywany. | To rama urządzenia, nie część aplikacji. Safe-area obsługuje system. | Brak. |
| T4 | 5 zakładek bez Haseł; `/hasla` zaznacza „Strony”. | CMTabBar jest wiążący, a Hasła są na liście stron (CMPages). | Niski: szósta zakładka to zmiana `TAB_ITEMS` i siatki. |
| T5 | Szybkie dodawanie bez „Zadanie” i bez „Bez daty”; „Nowe zadanie lub blok” → „Nowy blok”. | Reguła „zadanie zawsze w bloku” (decyzja Mejsona 22.11) wygrywa z makietą. | Niski: makietę warto poprawić na kanwie (do decyzji). |
| T6 | Wszystkie potwierdzenia usunięcia jako `ConfirmDialog`: arkusz na telefonie, `.dlg` 400 px od 800 px. | Odłożona uwaga 2d, a arkusz to wzorzec CM-BASE. Makiety nie mają osobnego okna usuwania na telefonie. | Niski: jedna kontrolka. |
| T7 | Bez „Odblokuj biometrią”. | Brak WebAuthn. Przycisk bez funkcji byłby kłamstwem. | Niski: osobna funkcja w przyszłości. |
| T8 | Hasła na telefonie: lista-akordeon (CMPasswords), a edycja przez „Edytuj” w rozwinięciu → arkusz wiersza. „Nowe hasło” otwiera pusty arkusz. Tytuł „Hasła”. | Makieta nie pokazuje edycji, a moduł musi ją mieć (M9). Arkusz już szyfruje. | Średni: inny gest edycji (np. długie przytrzymanie) to zmiana jednego pliku. |
| T9 | Ustawienia na telefonie: indeks według CMSettings + podstrony zakładek; bez Motywu i Eksportu. | Makieta ma jedną stronę, aplikacja ma 5 zakładek z większą treścią (cele, kategorie, kosz). Indeks zachowuje wygląd i wszystkie funkcje. | Średni: gdyby Mejson chciał jedną długą stronę, trzeba złożyć zakładki w jedną trasę. |
| T10 | Tabela na stronie (nie Subscriptions) na telefonie wygląda jak w CMEditor (`frame`, `th-cell` 44 px, wiersze 44 px). Stuknięcie wiersza otwiera arkusz CMRowEdit zamiast edycji w komórce; checkbox i Wybór da się zmienić w komórce, jak w makiecie (Wybór przełącza się cyklicznie po stuknięciu). | Komórki Strony 2.0 mają wiele typów (data, ocena, URL, Sekret), których edycji w 44-pikselowej komórce makieta nie pokazuje. Arkusz już działa. | Średni: pełna edycja w komórce to osobny pakiet. |
| T11 | Etap 3 nie ma migracji. | Wszystko to wygląd i odczyty. Wyszukiwanie używa zwykłych zapytań z RLS. | Brak. |
| T12 | Bez przełącznika przypomnienia w arkuszu wiersza; Mejson usunął go z makiety 24.11. | Przypomnienie o odnowieniu ustawia się raz dla wszystkich w Ustawieniach → Powiadomienia („dzień przed”); `page_rows.remind` zostaje domyślnie włączone. | Niski. |
| T13 | Odnowienia na telefonie: w dniu — plakietki „↻ Nazwa · kwota” w pasku nad osią; w tygodniu — na liście dnia jako pierwsze, z przerywaną ramką; w miesiącu — szara kropka w komórce i wpis na liście wybranego dnia. Stuknięcie otwiera arkusz podglądu z treścią `RenewalPopover`. | Makiety CM nie pokazują odnowień, więc styl przejmujemy z S2Calendar (przerywana ramka, `Repeat`). | Niski: tylko prezentacja. |
| T14 | Wyszukiwanie jako ostatni pakiet, na serwerze przez `ilike` po: tytułach stron (bez systemowej), tytułach wierszy tabel (pole tytułowe, bez stron systemowych i bez sekretów), blokach (tytuł, data następnego wystąpienia od dziś w ciągu 60 dni albo ostatniego), nawykach (nazwa, seria), treningach i biegach (tytuł/rodzaj, data). Limit 5 na grupę, „Ostatnio” w `localStorage` (5 fraz). | CMToday i kalendarz linkują do szukaj, a dziś to zaślepka. Proste zapytania wystarczą przy skali jednego użytkownika. | Średni: pełnotekstowe wyszukiwanie (tsvector) to migracja w przyszłości. |
| T15 | Szukajka na liście stron zostaje lokalnym filtrem stron (w makiecie to link do Szukaj). | Działa od razu i nie gubi funkcji. Wygląd `igroup` według makiety. | Niski: zamiana na link to jedna linijka. |
| T16 | CMSubs tylko dla stron z `template_key = 'subscriptions'`, które mają pola `recurring` i `renewal`. Inne strony dostają tabelę z T10. | Układ CMSubs zakłada te pola. | Niski. |
| T17 | „Nowy wiersz” i „Usuń wiersz” w CMEditor/CMRowEdit bez potwierdzenia, z toastem „Cofnij”, jak usuwanie wiersza na webie. | Makieta nie ma potwierdzenia, a toast z cofnięciem już istnieje. | Niski. |
| T18 | Hexy kolorów danych (kategorie, heatmapa, skala trudności) przepisujemy z CM*, a kolory UI na tokeny. | Zasada specu COSS: kolory danych zostają danymi. | Niski. |

## Do decyzji (lista dla Mejsona; Claude rozstrzygnął, Mejson może odwrócić)

1. T5: poprawić CMQuickAdd i CMSearch na kanwie (bez „Zadanie”, bez „Bez daty”)? Koszt niski.
2. T9: ustawienia telefonu jako indeks + podstrony zamiast jednej strony z makiety. Koszt średni.
3. T8: gest edycji hasła na telefonie („Edytuj” w rozwinięciu). Koszt średni.
4. T10: edycja w komórce tabeli na telefonie tylko dla checkboxa i Wyboru. Koszt średni.
5. T14: zakres wyszukiwania (bez treści bloków tekstowych stron i bez notatek nawyków). Koszt średni.
6. Konflikt 6: Motyw i Eksport z CMSettings — usunąć z makiety czy zaplanować jako funkcje? Koszt niski.
