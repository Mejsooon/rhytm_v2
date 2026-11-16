# rhytm: mapa etapów

**Spec:** `docs/superpowers/specs/2026-11-16-rhytm-design.md`
**Makiety:** `docs/design/mockups/` (`npx serve docs/design/mockups`)

Każdy etap ma własny, szczegółowy plan (`docs/superpowers/plans/2026-11-16-etap-N-*.md`). Plan powstaje tuż przed startem etapu, bo opiera się na kodzie z poprzednich. Etap jest skończony, gdy:
- wszystkie ekrany z kolumny „Makiety” wyglądają jak makiety (porównanie zrzutów 1440 px),
- funkcje z listy działają,
- testy z listy przechodzą,
- aplikacja jest wdrożona na Vercel.

Tabela pokrycia na dole pilnuje, żeby **każdy ekran z makiet** miał swój etap.

## Etap 0: Fundament i logowanie
- **Makiety:** Login, Register, Forgot, EmailConfirmed, NotFound, Sidebar.
- **Funkcje:**
  - repo z Next.js 16, Tailwind v4, shadcn/ui (Radix), tokeny z spec 3.1, Geist, komponent logo,
  - Supabase (lokalnie i w chmurze), tabela `profiles` z RLS,
  - logowanie e-mail + hasło i Google, rejestracja z regułami hasła i sprawdzaniem wycieków, Turnstile,
  - potwierdzenie e-maila (oba stany), reset hasła w 3 krokach, wylogowanie,
  - proxy z przekierowaniami, sidebar z modułami (puste ekrany), blok użytkownika z menu, strona 404,
  - manifest PWA, CI.
- **Testy:** reguły hasła, HIBP (mock), Turnstile (mock), routing proxy, RLS `profiles`, e2e rejestracja → potwierdzenie → logowanie → wylogowanie, e2e reset hasła.

## Etap 1: Onboarding i profil
- **Makiety:** Onboarding, OnboardingRole, OnboardingGoals, OnboardingSource, OnboardingPages, OnboardingNotify (bez wysyłki push, tylko zapis wyborów i zgody), OnboardingDone, EmptyToday, Settings (Ogólne bez Kosza).
- **Funkcje:**
  - 7 kroków z podglądem na żywo i zapisem po każdym kroku; wznowienie przerwanego onboardingu,
  - zdjęcie w Storage,
  - startowe kategorie z ról.
  - Strony z kroku 5 zapisują się jako „do utworzenia” w `profiles`. Utworzy je etap 6 przy pierwszym wejściu, a do tego czasu sidebar ich nie pokazuje.
  - Ustawienia → Ogólne: profil, cele, waluta.
- **Testy:** mapowanie ról na kategorie, mapowanie celów na polecane strony, e2e pełnego onboardingu.

## Etap 2: Kalendarz główny
- **Makiety:** Calendar, CalendarDay, CalendarMonth, BlockDialog, ScopeDialog, CategoryDialog, Settings (zakładka Kategorie kalendarza).
- **Funkcje:**
  - widoki tydzień, dzień i miesiąc z przełącznikiem i nawigacją ‹ Dziś ›,
  - filtry kategorii z licznikami,
  - dymek bloku z zadaniami i notatką,
  - tworzenie przez przeciąganie, przesuwanie i rozciąganie,
  - okno bloku z powtórzeniami, okno zakresu zmian, okno kategorii,
  - mini kalendarz, „Dzień w liczbach”, linia „teraz”, wiersz „cały dzień” (na razie pusty).
- **Testy:** rozwijanie powtórzeń i wyjątków, DST, zadania per wystąpienie, zakres „to i następne”, RLS kalendarza, e2e: blok cykliczny z zadaniem w dymku.

## Etap 3: Nawyki i sen
- **Makiety:** Habits, HabitDetail, HabitDialog, SleepDialog.
- **Funkcje:**
  - harmonogramy (codziennie, wybrane dni, X w tygodniu) z wersjonowaniem, odhaczanie wstecz,
  - kafelki statystyk, siatka tygodnia, heatmapa 3/6/12 mies.,
  - sen z wykresem 14/30 dni i celem, szczegóły nawyku, archiwizacja.
- **Testy:** % dnia, serie dni i tygodni, wersjonowanie harmonogramu, sen przez północ, e2e nawyk i wpis snu.

## Etap 4: Sport
- **Makiety:** Sport, RunDialog, GymLog, WorkoutTemplates, ExerciseDetail.
- **Funkcje:**
  - miesiąc z sumami tygodnia i filtrem typu, kafelki, wykres km, karta rekordu, ostatnie treningi,
  - bieg z tempem i kcal na żywo,
  - trening siłowy z seriami, objętością i rekordami, biblioteka ćwiczeń,
  - szablony („Rozpocznij” z ostatnimi ciężarami), szczegóły ćwiczenia,
  - treningi w kalendarzu głównym jako podgląd (kategoria systemowa Sport).
- **Testy:** tempo, kcal (ACSM), 1RM (Epley), rekordy, objętość, e2e bieg i trening z szablonu.

## Etap 5: Dziś
- **Makiety:** Today.
- **Funkcje:** karta „Ten tydzień” (5 kafelków z danych etapów 2–4), plan dnia z „TERAZ”, linią czasu i dymkiem, treningi w osi, przejście z EmptyToday po pierwszych krokach.
- **Testy:** liczenie kafelków tygodnia (tydzień od pn/nd wg profilu), e2e odhaczenie zadania z dymku na Dziś.

## Etap 6: Silnik stron
- **Makiety:** NewPage, EmptyPage, Books, Projects, Websites, AddField (typy podstawowe), ColumnMenu, FilterPopover, PageMenu, NotFound (link do kosza).
- **Funkcje:**
  - tabele `pages`, `page_fields` i `page_rows`, sidebar ze stronami (przeciąganie, menu, ikony, F2),
  - edycja komórek, dodawanie, ukrywanie, usuwanie i zmiana typu pól,
  - sort, filtr z zapisem jako domyślny, podsumowania kolumn, przypięte karty,
  - szablony Books, Projects, Websites i strony z onboardingu,
  - kosz 30 dni (Cofnij + sekcja w Ustawieniach, czyszczenie pg_cron).
- **Testy:** walidacja wartości per typ, sort i filtr, podsumowania po filtrze, karty, zmiana typu, RLS stron, e2e strona z szablonu Books.

## Etap 7: Inteligentne pola i Subscriptions
- **Makiety:** Main (Subscriptions), AddField (Kwota cykliczna, Data odnowienia), CalendarRenewal, chip „Subscriptions” w filtrach kalendarza.
- **Funkcje:**
  - Kwota cykliczna (przeliczenia, suma w stopce), Data odnowienia (najbliższa data, „za N dni”),
  - Data z „Pokaż w kalendarzu” i warunkiem „tylko gdy”, wpisy całodniowe w kalendarzu (tydzień, dzień, miesiąc),
  - dymek podglądu z „Otwórz w …” i podświetleniem wiersza, szablon Subscriptions.
- **Testy:** cykle (tydzień, miesiąc, kwartał, rok), najbliższe odnowienie, wystąpienia w zakresie, warunek Checkbox, e2e: subskrypcja widoczna, a po odznaczeniu „Aktywna” znika z kalendarza.

## Etap 8: Sejf
- **Makiety:** VaultSetup, Vault, Passwords, VaultReset, Settings (zakładka Sejf).
- **Funkcje:** pole Sekret, kryptografia (spec 6.9), auto-blokada z odliczaniem, pokaż/kopiuj z czyszczeniem schowka, reset sejfu, zmiana hasła głównego, szablon Passwords.
- **Testy:** wektory testowe szyfrowania i owijania, błędne hasło, zmiana hasła głównego, serwer odrzuca wartość Sekret w złym kształcie, e2e ustaw → zablokuj → odblokuj.

## Etap 9: Powiadomienia push
- **Makiety:** SettingsNotifications, OnboardingNotify (prawdziwa subskrypcja).
- **Funkcje:**
  - service worker, VAPID, lista urządzeń,
  - pg_cron i funkcja brzegowa: nawyki, przed blokiem, odnowienia, podsumowanie tygodnia,
  - cicha noc, „Wyślij testowe”.
- **Testy:** wybór powiadomień do wysłania w danej minucie (czysta funkcja: strefy, cicha noc, już odhaczone, duplikaty).

## Etap 10: Paleta ⌘K, konto, telefon, dopracowanie
- **Makiety:** CommandK, QuickAdd, SettingsAccount, Settings (skróty konta), MobileToday, MobileCalendar.
- **Funkcje:**
  - paleta z wyszukiwaniem i szybkim dodawaniem,
  - zmiana hasła i e-maila, sesje, eksport JSON, usunięcie konta,
  - dolny pasek na telefonie, mobilne Dziś i Kalendarz dnia, arkusze zamiast okien.
  - Końcowe porównanie wszystkich ekranów z makietami.
- **Testy:** parser szybkiego dodawania, eksport (sekrety zaszyfrowane), e2e usunięcia konta, zrzuty mobilne 390 px.

## Pokrycie makiet

| Makieta | Etap | | Makieta | Etap |
|---|---|---|---|---|
| Login | 0 | | Habits | 3 |
| Register | 0 | | HabitDetail | 3 |
| Forgot | 0 | | HabitDialog | 3 |
| EmailConfirmed | 0 | | SleepDialog | 3 |
| NotFound | 0 (link do kosza: 6) | | Sport | 4 |
| Sidebar | 0 (strony: 6) | | RunDialog | 4 |
| Onboarding | 1 | | GymLog | 4 |
| OnboardingRole | 1 | | WorkoutTemplates | 4 |
| OnboardingGoals | 1 | | ExerciseDetail | 4 |
| OnboardingSource | 1 | | NewPage | 6 |
| OnboardingPages | 1 (tworzenie stron: 6) | | EmptyPage | 6 |
| OnboardingNotify | 1 (push: 9) | | Books | 6 |
| OnboardingDone | 1 | | Projects | 6 |
| EmptyToday | 1 | | Websites | 6 |
| Today | 5 | | AddField | 6 + 7 |
| Calendar | 2 | | ColumnMenu | 6 |
| CalendarDay | 2 | | FilterPopover | 6 |
| CalendarMonth | 2 | | PageMenu | 6 |
| BlockDialog | 2 | | Main (Subscriptions) | 7 |
| ScopeDialog | 2 | | CalendarRenewal | 7 |
| CategoryDialog | 2 | | VaultSetup / Vault / Passwords / VaultReset | 8 |
| Settings (Ogólne) | 1 (Kosz: 6) | | SettingsNotifications | 9 |
| Settings (Kategorie) | 2 | | CommandK / QuickAdd | 10 |
| Settings (Sejf) | 8 | | SettingsAccount | 10 |
| | | | MobileToday / MobileCalendar | 10 |
