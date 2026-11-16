# rhytm: dokument projektowy (nowe repo `rhytm_v2`, budowa od zera)

Data: 2026-11-16 · Status: do akceptacji przez Mejsona

Ten dokument jest **kompletny i samodzielny**. Łączy:
- funkcje modułów z poprzednich specyfikacji (wersja 2 z 2026-11-14 i wersja 3 z 2026-11-15),
- wszystko, co zostało zaprojektowane na płótnie „rhytm — układ aplikacji (makiety)”.

Tam, gdzie makiety i stare dokumenty się różnią, **wygrywają makiety**. Starych dokumentów nie trzeba czytać.

Oznaczenia: bez dopisku = decyzja Mejsona albo element makiety. *[Claude]* = decyzja Claude'a, którą Mejson może zmienić.

## 1. Po co to jest

rhytm to jedno miejsce do organizacji tygodnia: kalendarz bloków czasowych z zadaniami, treningi (bieg i siłownia), nawyki, sen oraz **własne strony** (tabele jak w Notion) na subskrypcje, książki, projekty, strony WWW i hasła. Strony nie tylko przechowują dane, ale **coś z nimi robią**: liczą sumy, pokazują odnowienia w kalendarzu, szyfrują hasła. Robią to bez formuł, przez wbudowane typy pól.

Najpierw aplikacja dla Mejsona, używana codziennie. Później może SaaS, dlatego od początku są konta i pełne rozdzielenie danych.

### Co znaczy sukces
- Wygląd aplikacji jest **identyczny z makietami**: ten sam układ, kolory, typografia, odstępy i teksty interfejsu.
- Każda funkcja widoczna na makietach działa naprawdę (lista w sekcji 6).
- Poranny wpis (nawyki + sen) na telefonie zajmuje kilkanaście sekund.
- Strona Subscriptions powstaje z szablonu w mniej niż 10 s. Od razu widać sumę miesięczną i roczną, a aktywne subskrypcje pokazują się w kalendarzu.
- Hasła w sejfie są nieczytelne dla serwera i właściciela bazy.

### Nie-cele (poza tą wersją)
- Przenoszenie danych ze starej wersji (start z pustą bazą). Stare repo `Mejsooon/rhytm` i rhytm-delta.vercel.app działają dalej bez zmian.
- Ciemny motyw.
- Zagnieżdżone strony, edytor bloków tekstu, formuły, relacje między tabelami, widoki stron inne niż tabela.
- Udostępnianie, import i eksport CSV, wiele walut naraz.
- Synchronizacja z Google Calendar, tryb offline, natywne aplikacje.
- Funkcje ze starych dokumentów, których **nie ma na makietach** *[Claude, do potwierdzenia]*:
  - wniosek tygodnia,
  - roczne heatmapy biegów i siłowni,
  - widok tygodnia w Sporcie,
  - harmonogram nawyku „bez planu”,
  - minutnik przerwy, plany treningowe, panel „Do zaplanowania”.

### Anty-cele (porażka, nawet jeśli „działa”)
- Hasło z sejfu trafia na serwer otwartym tekstem, choćby na chwilę (także do logów albo backupu).
- Dane jednego użytkownika widoczne dla innego.
- Ten sam wpis da się edytować z dwóch miejsc. Treningi i daty ze stron są w kalendarzu głównym **tylko do podglądu**.
- Dzień z nawykiem „X razy w tygodniu”, którego akurat nie zrobiono, wygląda jak porażka.
- Logowanie jest słabsze od gotowych usług: brak CAPTCHA, brak limitów prób albo komunikaty zdradzają, czy e-mail ma konto.
- Szablon „zamyka” stronę: po utworzeniu z szablonu nie da się zmieniać pól.
- Wygląd „mniej więcej jak makieta”. Implementacja ma się zgadzać z makietą piksel w piksel w granicach rozsądku przeglądarki.

## 2. Ograniczenia
- **Repo:** `Mejsooon/rhytm_v2`, nowe i puste. Kod piszemy od zera.
- **Stos:**
  - Next.js 16 (App Router). Wersja ma breaking changes: przed użyciem API czytać dokumentację z `node_modules/next/dist/docs/`.
  - TypeScript, Tailwind CSS v4, **shadcn/ui w odmianie Radix**.
  - **Supabase** (Postgres, RLS, Auth, pg_cron), osobny nowy projekt.
  - **Vercel**, osobny nowy projekt.
  - PWA i Web Push.
- **Dane:** każda tabela z danymi ma `user_id uuid references auth.users(id) on delete cascade` i RLS „tylko własne wiersze” po `auth.uid()`. Rejestracja jest otwarta.
- **Interfejs:**
  - Język polski, jednostki metryczne.
  - Strefa czasowa, początek tygodnia i format godziny z profilu. Domyślnie Europe/Warsaw, poniedziałek, 24 h.
  - Daty „dnia” (nawyki, sen, heatmapy) liczone w strefie użytkownika.
- **Kod:** Mejson jest początkującym programistą. Kod bez skakania po wielu funkcjach pomocniczych tam, gdzie to rozsądne, i komentarze po polsku.
- **Motyw:** tylko jasny.

## 3. Wzorzec wyglądu

Źródłem prawdy o wyglądzie są makiety w repo: `docs/design/mockups/`.
- Otwiera się je przez `npx serve docs/design/mockups`. Strona `index.html` ma spis ekranów, a każdy ekran jest klikalny.
- Każdy ekran aplikacji ma odpowiadający plik `*.dc.html`.
- Implementując ekran, otwiera się makietę obok i odwzorowuje:
  - strukturę, teksty, rozmiary, odstępy, kolory i stany,
  - zachowanie po kliknięciu (dymki, przełączniki).
- Płótno źródłowe: https://claude.ai/artifact/KvjE15fBZZYBKr1gkScxdJ
- Kopia w Figma Make: https://www.figma.com/make/Uff5jAlN1nfHtoiacBVu5K

### 3.1 Tokeny (wartości z makiet)

| Token | Wartość | Użycie |
|---|---|---|
| `--background` | `#ffffff` | tło treści |
| `--panel` | `#fafafa` | sidebar, nagłówki tabel, stopki okien, tło ekranów logowania |
| `--hover` / `--active` | `#f5f5f5` / `#f0f0f0` | hover wierszy menu, aktywna pozycja sidebaru, wybrany segment |
| `--border` | `#eaeaea` | ramki kart, linie oddzielające |
| `--border-strong` | `#e0e0e0` | ramki pól, przycisków, okien |
| `--border-soft` | `#f0f0f0` | linie między wierszami tabel |
| `--foreground` | `#171717` | tekst, przycisk główny (tło) |
| `--muted-foreground` | `#666666` | tekst drugorzędny |
| `--meta` | `#6b6b6b` | etykiety mono, metadane |
| `--subtle` | `#404040` / `#525252` | tekst w chipach i liczbach |
| `--accent` | `#15803d` | dziś, postęp, zrobione, akcent logo |
| `--destructive` | `#b91c1c` | usuwanie, ostrzeżenia |
| Kolory kategorii (8) | `#0070f3` niebieski, `#15803d` zielony, `#7c3aed` fioletowy, `#c2410c` pomarańczowy, `#b91c1c` czerwony, `#0e7490` morski, `#a16207` musztardowy, `#525252` grafitowy | kropki, bloki (tło = kolor na jasnym tincie, lewa krawędź = kolor) |

- **Promienie:** pola i przyciski 6 px, karty i tabele 8 px, okna i dymki 12 px, pigułki i chipy 999 px.
- **Cienie:** karty logowania `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.04)`, okna `0 16px 48px rgba(0,0,0,.16)`.
- **Czcionki:**
  - **Geist** dla tekstu (14 px bazowo).
  - **Geist Mono** dla liczb, dat, godzin, ścieżek „Moduły / Kalendarz” i etykiet sekcji. Etykiety sekcji: 11 px, wielkie litery, rozstrzelenie .06em, kolor `#6b6b6b`.
  - Nagłówki stron: 24 px, waga 600.
- **Logo:** siatka 3×3 zaokrąglonych kwadratów w trzech odcieniach `#171717` (krycie 1 / .55 / .25) i jeden zielony kwadrat `#15803d` (środkowy w prawej kolumnie) oraz wyraz „rhytm” w Geist 600 z rozstrzeleniem −0.045em.
- **Hasło marki:** „Your week, in rhythm.” (stopka landing page, materiały).

## 4. Architektura *[Claude]*
- **Kod:**
  - `src/app` dzieli się na grupy tras `(auth)` (ekrany logowania), `(onboarding)` i `(app)` (wszystko z sidebarem).
  - Moduły w `src/features/<moduł>`: komponenty, akcje serwera i czysta logika.
  - Logika obliczeniowa w czystych funkcjach TypeScript z testami Vitest: powtórzenia, % nawyków, tempo/kcal, 1RM, cykle, parser, szyfrowanie.
- **Dane:**
  - Odczyt w Server Components przez `@supabase/ssr`, zapis przez Server Actions.
  - Walidacja wejścia `zod` po stronie serwera.
- **Sesja:** ciasteczka `@supabase/ssr` odświeżane w pliku `proxy.ts` (Next 16 zastępuje nim middleware, sprawdzić w dokumentacji). Proxy przekierowuje niezalogowanych do `/logowanie`, a zalogowanych bez onboardingu do `/onboarding`.
- **Trasy (polskie):**
  - konto: `/logowanie`, `/rejestracja`, `/reset-hasla`, `/nowe-haslo`, `/auth/confirm`, `/auth/callback`,
  - onboarding: `/onboarding/[krok]`,
  - moduły: `/dzis`, `/kalendarz` (`?widok=dzien|tydzien|miesiac&data=YYYY-MM-DD`), `/sport`, `/sport/trening/[id]`, `/sport/cwiczenia/[id]`, `/sport/szablony`, `/nawyki`, `/nawyki/[id]`,
  - strony: `/strony/[id]`,
  - ustawienia: `/ustawienia/(ogolne|konto|sejf|powiadomienia|kategorie)`.
- **Migracje i testy bazy:** migracje w `supabase/migrations`, testy RLS w pgTAP (`supabase/tests`), lokalnie `supabase start`.
- **Testy:** jednostkowe Vitest, komponentów Testing Library, przepływów Playwright (logowanie, rejestracja, reset, kluczowe ścieżki modułów). Wszystkie odpalane w CI GitHub Actions.

## 5. Model danych (szkic, builder dopracowuje)
- **Konto:** `profiles` (user_id PK, display_name, avatar_path, timezone, week_start 'mon'|'sun', clock '24'|'12', weight_kg, height_cm, sleep_goal_min DEFAULT 480, weekly_km_goal, currency DEFAULT 'PLN', roles text[], study_field, goals text[], referral_source, referral_other, onboarded_at, created_at)
- **Kalendarz:**
  - `categories` (id, user_id, name, color, position, is_system, hidden bool). Systemowe „Sport” i „Subscriptions” to filtry podglądu bez własnych bloków.
  - `blocks` (id, user_id, title, category_id, note, start_local timestamp, duration_min, timezone, recurrence jsonb NULL `{freq: 'daily'|'weekdays'|'weekly'|'custom', byWeekday: int[], until: date}`)
  - `block_exceptions` (block_id, occurrence_date, kind 'cancelled'|'modified', new_start_local, new_duration_min, new_title)
  - `block_tasks` (id, block_id, occurrence_date, title, done, position)
- **Sport:**
  - `sport_sessions` (id, user_id, type 'run'|'gym', title, start_at, end_at, note, completed, show_in_calendar DEFAULT true, template_id NULL)
  - `runs` (session_id PK, distance_km, duration_s, difficulty 1–10, weight_kg_snapshot, kcal)
  - `exercises` (id, user_id, name, UNIQUE(user_id, lower(name)))
  - `gym_sets` (id, session_id, exercise_id, exercise_position, set_no, weight_kg NULL, reps, done). NULL ciężar = masa ciała.
  - `workout_templates` (id, user_id, name, last_used_at), `workout_template_items` (template_id, exercise_id, position, sets_count)
- **Nawyki i sen:**
  - `habits` (id, user_id, name, remind_at time NULL, archived_at, created_at)
  - `habit_schedules` (habit_id, valid_from date, schedule_type 'daily'|'weekdays'|'times_per_week', weekdays int[], times_per_week). Harmonogram jest wersjonowany, więc zmiana nie przelicza przeszłości.
  - `habit_checks` (habit_id, date, UNIQUE)
  - `sleep_logs` (user_id, date pobudki, slept_at time, woke_at time, feeling 1–5, note, UNIQUE(user_id, date))
- **Strony:**
  - `pages` (id, user_id, title, icon, template_key NULL, position, settings jsonb: sort, filters, hidden_field_ids, column_summaries, pinned_cards; created_at, deleted_at NULL)
  - `page_fields` (id, page_id, user_id, name, type, config jsonb, position, is_title)
  - `page_rows` (id, page_id, user_id, values jsonb `{field_id: wartość}`, position, created_at, updated_at, deleted_at NULL)
- **Sejf:** `vaults` (user_id PK, kdf jsonb `{alg:'PBKDF2-SHA-256', iterations:600000, salt}`, wrapped_key, wrap_iv, created_at, updated_at)
- **Powiadomienia:**
  - `push_subscriptions` (id, user_id, endpoint UNIQUE, keys jsonb, device_label, last_used_at, created_at)
  - `notification_settings` (user_id PK, before_block_min NULL|5|10|15|30 DEFAULT 10, renewal_days_before DEFAULT 3, renewal_hour DEFAULT 9, weekly_summary bool DEFAULT true, weekly_summary_at DEFAULT 'sun 18:00', habits_enabled bool, quiet_from DEFAULT 23:00, quiet_to DEFAULT 07:00, quiet_enabled bool)
  - `notification_log` (user_id, kind, ref, sent_at) chroni przed duplikatami.
- **Kosz:** strony i wiersze usunięte mają `deleted_at`. Zadanie pg_cron usuwa je trwale po 30 dniach.

## 6. Funkcje, ekran po ekranie

Dla każdego obszaru podana jest makieta (plik w `docs/design/mockups/`).

### 6.1 Konto i logowanie (Supabase Auth)

**Logowanie (`Login.dc.html`):**
- Tło `#fafafa` z siatką 48 px. W nagłówku logo i przycisk „Załóż konto”.
- Karta 380 px z elementami w tej kolejności:
  - „Zaloguj się przez Google”, separator „lub e-mailem”,
  - e-mail, hasło z przyciskiem „Pokaż hasło” i linkiem „Nie pamiętasz hasła?”,
  - widżet Cloudflare Turnstile, przycisk „Zaloguj się”,
  - „Nie masz konta? Zarejestruj się”.
- Błąd zawsze ogólny: „Nieprawidłowy e-mail lub hasło”.

**Rejestracja (`Register.dc.html`):**
- Elementy formularza:
  - „Kontynuuj z Google”, separator,
  - Nazwa, E-mail, Hasło z regułami na żywo: co najmniej 10 znaków, litery i cyfry, nie ma go w bazie wycieków,
  - Turnstile, „Utwórz konto”.
- Sprawdzenie wycieków to zapytanie k-anonimowe do API Have I Been Pwned (5 znaków prefiksu SHA-1) z akcji serwera *[Claude]*.
- Po wysłaniu ekran „Sprawdź skrzynkę” z przyciskiem „Wyślij ponownie” i odliczaniem 60 s.

**Link z maila (`EmailConfirmed.dc.html`):**
- Stan „E-mail potwierdzony” z przyciskiem Dalej, który prowadzi do onboardingu.
- Stan „Link wygasł” z przyciskiem „Wyślij nowy link”.

**Reset hasła (`Forgot.dc.html`):** trzy kroki: e-mail → „sprawdź skrzynkę” → ustawienie nowego hasła (te same reguły co przy rejestracji).

**Google OAuth:** powrót przez `/auth/callback`. Nowe konto idzie do onboardingu, istniejące do `/dzis`.

**Bezpieczeństwo:**
- Turnstile na logowaniu, rejestracji i resecie hasła, sprawdzany po stronie serwera.
- Limity prób Supabase i własny SMTP (Resend).
- Komunikaty nie zdradzają, czy e-mail ma konto.

**404 (`NotFound.dc.html`):**
- Zawiera sidebar, napis „404”, „Tej strony nie ma” i wzmiankę o koszu.
- Przyciski „Wróć do Dziś” i „Szukaj ⌘K”.

### 6.2 Onboarding: 7 kroków (`Onboarding*.dc.html`)

**Układ wspólny:**
- Nagłówek: logo, „Krok n z 7”, „Wyloguj”.
- Karta 1120×720 z paskiem postępu z 7 segmentów.
- Lewa kolumna 520 px z pytaniami i stopką: „Wstecz” po lewej, „Dalej” (czarny) po prawej.
- Prawa kolumna z **podglądem aplikacji na żywo**:
  - mini sidebar: awatar, imię, strefa, moduły, strony,
  - dzień z kategoriami i blokami,
  - zielony obrys wokół obszaru, który zmienia dany krok.
- Odpowiedzi zapisują się po każdym kroku. Powrót do onboardingu wznawia ostatni krok.

**Kroki:**
1. **Profil:**
   - zdjęcie (upload do Supabase Storage, bez zdjęcia inicjały),
   - imię lub pseudonim, strefa czasowa (wykryta z przeglądarki),
   - tydzień od poniedziałku albo niedzieli, format 24 h albo 12 h.
2. **Kim jesteś** (wielokrotny wybór): Student / Pracuję / Freelancer lub firma / Trenuję regularnie / Coś innego.
   - Przy Studencie opcjonalne pole „Kierunek studiów”.
   - Wybór tworzy startowe kategorie: Studia, Praca, Projekty, Sport (filtr systemowy), Dom.
3. **Cele** (wielokrotny wybór): Plan tygodnia, Treningi, Nawyki i sen, Subskrypcje, Hasła, Projekty, Książki.
   - Treningi odsłaniają pole „Kilometry w tygodniu”, Nawyki i sen pole „Cel snu”.
   - Cele zaznaczają polecane strony w kroku 5.
4. **Skąd o nas usłyszałeś** (jeden wybór): Od znajomego, Na uczelni, TikTok, Instagram, YouTube, X, Reddit, Wyszukiwarka, ChatGPT lub inne AI, Inne (z polem „Gdzie dokładnie?”). Krok ma przycisk „Pomiń”.
5. **Strony:**
   - szablony Subscriptions, Projects, Books, Websites, Passwords z opisem i listą pól,
   - polecane mają dopisek „z Twoich celów”,
   - zaznaczone strony tworzą się po kliknięciu Dalej.
6. **Powiadomienia:**
   - „Powiadomienia w przeglądarce” z przyciskiem „Zezwól” (prawdziwa prośba o zgodę i zapis subskrypcji push),
   - przełączniki: Przed blokiem (10 min), Odnowienie subskrypcji (3 dni wcześniej, 9:00), Podsumowanie tygodnia (nd 18:00), Nawyki na dziś (21:00),
   - wskazówka o dodaniu PWA na telefonie.
7. **Gotowe:**
   - podsumowanie (Profil, Kategorie, Strony, Przypomnienia) z linkami „Zmień” do kroków,
   - wskazówka „Ctrl K”, przycisk „Przejdź do Dziś”.

Nowy użytkownik trafia potem na **Dziś w stanie pustym** (`EmptyToday.dc.html`): „Witaj w rhytm”, lista „Pierwsze kroki” 0–4 (blok, nawyk, trening, wpis snu) i pusty plan dnia.

### 6.3 Sidebar i nawigacja (`Sidebar.dc.html`, `Main.dc.html`)

**Na komputerze:**
- Góra: logo i „rhytm”, pole „Szukaj… ⌘K”.
- **Moduły:** Dziś, Kalendarz, Sport, Nawyki i sen (ikony z makiety).
- **Strony:**
  - lista stron z ikoną, „+” przy nagłówku i „+ Nowa strona” na dole,
  - kolejność zmieniana przeciąganiem,
  - menu strony (`PageMenu.dc.html`): Zmień nazwę (F2), Zmień ikonę (siatka 24 ikon), Duplikuj, Przenieś wyżej / niżej, Usuń stronę. Usunięcie wymaga potwierdzenia „11 wierszy trafi do kosza na 30 dni. Daty z tej strony znikną z kalendarza.”
- Dół: Ustawienia oraz blok użytkownika (inicjały, imię, e-mail) z menu: Ustawienia, Wyloguj.
- Aktywna pozycja ma tło `#f0f0f0` i wagę 500.
- Sidebar ma szerokość 232 px i rozciąga się na całą wysokość strony.

**Na telefonie:**
- Dolny pasek: Dziś, Kalendarz, Sport, Nawyki, Strony. „Strony” otwierają arkusz z listą stron.
- Sidebar chowa się.

### 6.4 Kalendarz główny

**Widok tygodnia (`Calendar.dc.html`), domyślny na komputerze:**
- Nagłówek:
  - ‹ Dziś ›, tytuł miesiąca, „tydz. N · zakres”,
  - przełącznik Dzień / Tydzień / Miesiąc, przycisk „Nowy blok”.
- Pasek „POKAŻ”:
  - chipy kategorii z kropką i licznikiem bloków w widoku; klik ukrywa i pokazuje (ukryta = przerywana ramka, pusta kropka),
  - chip systemowy „Subscriptions” (ikona przerywanego kwadratu) i „+ Kategoria”.
- Siatka 06:00–22:00:
  - wiersz „cały dzień” na wpisy ze stron,
  - bloki w kolorze kategorii z tytułem, godzinami i licznikiem zadań „x/y”.
- **Klik w blok otwiera dymek** obok bloku. Przy blokach na dole siatki dymek otwiera się w górę. Zawartość dymka:
  - kategoria, tytuł, data i godziny, pasek „Zadania x z y”,
  - lista zadań do odhaczania, „+” dodaj zadanie,
  - notatka,
  - Edytuj, Usuń, oznaczenie „↻ co tydzień”.
- **Tworzenie bloku:** przeciągnięcie po pustej siatce otwiera „Nowy blok” z wypełnionymi godzinami. Bloki przesuwa się i rozciąga przeciąganiem.

**Widok dnia (`CalendarDay.dc.html`):**
- ‹ Dziś › zmienia dzień, tytuł „Wtorek, 17 listopada”, „x z y bloków”.
- Te same filtry kategorii.
- Bloki szerokie, z kategorią i licznikiem zadań. Czerwona linia „teraz” tylko dla dziś.
- Dymek jak w tygodniu. Pusty dzień: ramka „Brak bloków w tym dniu. Dodaj blok”.
- Prawa kolumna:
  - mini kalendarz miesiąca z ‹ › (klik w dzień przechodzi do niego, wybrany dzień czarny, dziś zielony),
  - karta „Dzień w liczbach”: zaplanowane, wolne (8–20), zadania.

**Widok miesiąca (`CalendarMonth.dc.html`):**
- ‹ Dziś ›, „N wpisów widocznych”, filtry.
- W komórce do 3 wpisów i „+N więcej”. Klik we wpis otwiera dymek (w dolnych wierszach w górę).

**Okna:**
- **Nowy blok (`BlockDialog.dc.html`):**
  - pola: tytuł, kategoria (chipy + „+ Nowa”), dzień, od, do,
  - powtarzanie: Nie powtarzaj / Codziennie / Dni robocze / Co tydzień / Własne… (przyciski pn–nd i „do” z datą końca),
  - zdanie podsumowania, np. „Co tydzień we wtorki, do 31.01.2027. Każde powtórzenie ma własną, pustą listę zadań.”,
  - notatka, Anuluj, „Zapisz blok”,
  - zadania dodaje się po zapisaniu, w dymku.
- **Zmiana bloku cyklicznego (`ScopeDialog.dc.html`):**
  - Tylko to wystąpienie / To i następne / Wszystkie wystąpienia, każda opcja z opisem,
  - „Zadania z odhaczonych wystąpień nie przepadają.”,
  - pytanie pada też przy usuwaniu i przeciąganiu wystąpienia.
- **Nowa kategoria (`CategoryDialog.dc.html`):**
  - nazwa i 8 kolorów (zajęte wyblakłe, ale do wyboru),
  - podgląd chipu i bloku, „Dodaj kategorię”.

**Zasady:**
- Każde wystąpienie bloku cyklicznego ma własną, pustą listę zadań. Nieodhaczone zadania nie przechodzą dalej.
- Bloki cykliczne trzymane w czasie lokalnym, więc zmiana czasu letni/zimowy nie przesuwa godziny.
- **Treningi** ze Sportu są widoczne tylko do podglądu, w kategorii systemowej „Sport”:
  - zaplanowane: białe tło i przerywana ramka, wykonane: pomarańczowe tło,
  - klik otwiera podgląd z linkiem do Sportu.
- **Wpisy ze stron** (Data, Data odnowienia z „Pokaż w kalendarzu”) w wierszu „cały dzień”:
  - przerywana ramka, ↻ dla odnowień, tekst „Netflix · 43,00 zł”,
  - klik otwiera dymek podglądu (`CalendarRenewal.dc.html`): źródło, kwota, kategoria, cykl, następne odnowienie, „Tylko podgląd. Edytujesz na stronie Subscriptions.” i „Otwórz w Subscriptions →” (strona z podświetlonym wierszem),
  - każda strona z datami w kalendarzu ma swój chip w filtrach,
  - filtr tabeli nie wpływa na kalendarz,
  - warunek „tylko gdy [Checkbox]” ukrywa wiersze, np. nieaktywne subskrypcje.

### 6.5 Dziś (`Today.dc.html`, `EmptyToday.dc.html`)
- Nagłówek: „Dziś”, „wtorek · 17.11.2026 · tydz. 47”, „Nowy blok”.
- Karta **Ten tydzień** (pn–nd) z pięcioma kafelkami, każdy z paskiem postępu:
  - **Zadania** zrobione/wszystkie, % i „dziś x/y”,
  - **Nawyki** % i „x z y dni powyżej 70%”,
  - **Śr. sen** względem celu i „x z y nocy ≥ cel”,
  - **Bieg** km względem celu tygodniowego i najbliższy bieg,
  - **Treningi** wykonane/zaplanowane.
- **Plan dnia** jako oś czasu 06:00–22:00:
  - bloki dnia z licznikiem zadań, oznaczenie „TERAZ” na trwającym bloku, czerwona linia aktualnej godziny,
  - klik otwiera dymek jak w kalendarzu,
  - w osi są też treningi dnia (oznaczenie „plan”).
- Stan pusty: lista „Pierwsze kroki” i „Plan dnia jest pusty”.

### 6.6 Nawyki i sen

**Ekran (`Habits.dc.html`), na całą szerokość:**
- Nagłówek: „+ Wpis snu”, „Nowy nawyk”.
- Cztery kafelki:
  - Nawyki dziś x/y,
  - Ostatnie 30 dni % z porównaniem do poprzednich 30 („+6 pkt vs poprzednie 30”),
  - Najdłuższa seria z nazwą nawyku,
  - Śr. sen 14 dni względem celu i „x z 14 nocy ≥ cel”.
- **Nawyki:**
  - siatka tygodnia pn–nd z odhaczaniem (także wstecz) dla każdego nawyku,
  - opis harmonogramu i serii, przy „X w tygodniu” postęp tygodnia,
  - „+ Nowy nawyk”, klik w nazwę otwiera szczegóły.
- **Sen:**
  - przełącznik 14 / 30 dni, ostatnia noc (czas, godziny, samopoczucie),
  - wykres słupkowy z przerywaną linią celu; słupki z osiągniętym celem są ciemniejsze.
- **Heatmapa nawyków:**
  - kolor = % nawyków zrobionych danego dnia,
  - przełącznik 3 mies. / 6 mies. / Rok, legenda mniej–więcej,
  - dzień bez zaplanowanych nawyków jest szary, nie 0%.

**Szczegóły nawyku (`HabitDetail.dc.html`):**
- Archiwizuj, Edytuj.
- Harmonogram, przypomnienie, data startu.
- Kafelki: seria, najdłuższa seria, 30 dni %, łącznie razy.
- Kalendarz miesiąca z ‹ › i stanami zrobione / pominięte / dzień bez nawyku.
- „Historia harmonogramu” z dopiskiem „Zmiana harmonogramu nie przelicza przeszłych dni.”

**Nowy nawyk (`HabitDialog.dc.html`):**
- Nazwa.
- Harmonogram: Codziennie / Wybrane dni (pn–nd) / X razy w tygodniu (1–7), ze zdaniem wyjaśnienia.
- Przypomnienie push o wybranej godzinie, tylko w dni z harmonogramu.

**Wpis snu (`SleepDialog.dc.html`):**
- Data pobudki, zasnąłem, wstałem.
- Czas snu liczony na żywo, także przez północ, np. „90% celu 8:00 · brakuje 48 min”.
- Samopoczucie 1–5, notatka. Jeden wpis na dzień, edytowalny.

**Zasady:**
- % dnia = (zrobione zaplanowane na ten dzień + odhaczone nawyki X/tydz.) / (zaplanowane na ten dzień + odhaczone nawyki X/tydz.). Nawyki X/tydz. mogą tylko podnieść wynik.
- Seria nawyków X/tydz. jest liczona w tygodniach.
- Zarchiwizowany nawyk znika z listy, a jego historia zostaje.

### 6.7 Sport

**Ekran (`Sport.dc.html`):**
- Nagłówek: ‹ Dziś ›, „Sport · listopad 2026”, filtr Wszystko / Bieg / Siłownia, „+ Trening siłowy”, „Nowy bieg”.
- **Kalendarz miesiąca:**
  - kolumna „Σ tydz.” z km i liczbą treningów w tygodniu,
  - w komórkach biegi (● km) i treningi (■ nazwa), zaplanowane bez danych jako przerywane,
  - klik w trening otwiera dymek obok komórki (w dolnych wierszach w górę; przy prawych kolumnach w lewo):
    - nagłówek: typ (BIEG / SIŁA), stan (wykonany / zaplanowany), tytuł, data i godziny,
    - bieg wykonany: dystans, czas, tempo, kcal, trudność, godzina; trening siłowy: ćwiczenia, serie, objętość, czas, trudność, rekordy oraz lista ćwiczeń z najlepszą serią,
    - zaplanowany: plan i godzina startu (bieg) albo szablon i ćwiczenia „jak ostatnio” (siłownia),
    - notatka, jeśli jest,
    - akcje: Edytuj / Uzupełnij dane (okno biegu), Otwórz trening / Rozpocznij (ekran treningu), Usuń, znacznik „w kalendarzu”,
  - legenda.
- Kafelki tygodnia: KM / tydz. względem celu, śr. tempo, treningi (wykonane / plan), kcal.
- Wykres km tygodniowo z linią celu (ostatnie ~12 tygodni).
- Karta rekordu wybranego ćwiczenia: szac. 1RM, najlepsza seria, mini wykres.
- Tabela **Ostatnie treningi:** data, typ (BIEG/SIŁA), wynik, tempo lub objętość, trudność. Klik otwiera trening.

**Nowy bieg (`RunDialog.dc.html`):**
- Data, start, dystans, czas.
- Tempo i kcal liczone na żywo.
- Trudność 1–10, notatka, „Pokaż w kalendarzu głównym jako blok” (domyślnie włączone).
- Bieg bez czasu zapisuje się jako plan.
- Kcal ze wzoru ACSM: VO₂ = 3,5 + 0,2 × prędkość [m/min], kcal = VO₂ × waga × czas[min] / 1000 × 5. Waga z profilu jest zapisywana razem z biegiem.

**Trening siłowy (`GymLog.dc.html`):**
- Nagłówek: „Zapisz jako szablon”, „Zakończ trening”.
- Kafelki: objętość (suma kg × powtórzenia zrobionych serii), serie zrobione/wszystkie.
- Ćwiczenia z tabelą serii: nr, kg, powtórzenia, ✓, wiersz „1RM … · +2,5 kg vs ostatnio”.
- „+ Seria”, „+ Ćwiczenie” z podpowiedziami z biblioteki ćwiczeń (bez duplikatów wielkości liter).
- Seria cięższa niż dotychczasowe maksimum dostaje plakietkę „REKORD”.

**Szablony (`WorkoutTemplates.dc.html`):**
- Każda karta: nazwa, „ostatnio”, liczba ćwiczeń i serii, lista ćwiczeń, „Rozpocznij” i „Edytuj”.
- „Rozpocznij” tworzy trening z ciężarami i powtórzeniami z ostatniego wykonania.

**Szczegóły ćwiczenia (`ExerciseDetail.dc.html`):**
- Kafelki: szac. 1RM (Epley: ciężar × (1 + powt./30)), najcięższa seria, najwięcej powtórzeń, zmiana za 8 tygodni.
- Wykres 1RM z przełącznikiem 3 mies. / 8 tyg.
- Historia z oznaczeniem REKORD.
- Akcja „Zmień nazwę”.

**Cel tygodniowy km:** z ustawień albo onboardingu.

### 6.8 Strony i tabele

**Nowa strona (`NewPage.dc.html`):**
- Lista szablonów: Pusta strona, Subscriptions, Books, Projects, Websites, Passwords.
- Panel „Pola, które powstaną” z opisem działania, nazwa strony, „Utwórz stronę”.

**Pusta strona (`EmptyPage.dc.html`):** tabela z polem Nazwa, stan „Pusta tabela” z przyciskami „+ Pole”, „+ Pierwszy wiersz” i linkiem „Wolisz gotowca? Użyj szablonu →”.

**Strona z tabelą (`Main.dc.html`, `Books`, `Projects`, `Websites`):**
- Nagłówek: ścieżka „Strony / X”, Filtruj, „+ Pole”, „Nowy wiersz”.
- Tytuł i metadane „N wierszy · N pól · szablon „…” · sort: …”.
- **Przypięte karty** (3) nad tabelą.
- Tabela:
  - nagłówki z ikoną typu,
  - edycja w komórce,
  - stopka z „+ Nowy wiersz” i podsumowaniami kolumn.
- Wiersze nieaktywne (Checkbox „Aktywna” odznaczony) są przekreślone i szare.
- Kolumna z „Pokaż w kalendarzu” ma znaczek „w kalendarzu”.

**„+ Pole” (`AddField.dc.html`):**
- Typy w trzech grupach:
  - **Podstawowe:** Tekst, Liczba, Checkbox, URL, Select, Status, Data, Ocena,
  - **Inteligentne** („liczy”): Kwota cykliczna, Data odnowienia,
  - **Bezpieczne** („szyfr.”): Sekret.
- Prawa strona: nazwa pola i ustawienia typu. Przykład Kwoty cyklicznej: domyślny cykl miesiąc/rok/tydzień/kwartał, „Suma w stopce”, waluta z ustawień, przykład przeliczenia „600,00 / rok → 50,00 / mies.”.

**Menu kolumny (`ColumnMenu.dc.html`):**
- Typ pola (zmiana typu: zgodne typy bez straty, pozostałe czyszczą wartości po potwierdzeniu).
- Sortuj rosnąco / malejąco, „Filtruj po tym polu”.
- Podsumowanie (Brak, Liczba wierszy, Wypełnione, Puste, oraz zależne od typu: suma / średnia / min / max, zaznaczone, najwcześniejsza / najpóźniejsza, najbliższa).
- „Pokaż w kalendarzu” (Data, Data odnowienia), „Ukryj kolumnę”, „Usuń pole”.
- Pole tytułowe nie może być usunięte.

**Filtr (`FilterPopover.dc.html`):**
- Warunki łączone „i”: pole + operator + wartość. Operatory wg typu: jest zaznaczone, jest jednym z, ≥ / ≤, zawiera, przed / po, jest pusty.
- „+ Dodaj warunek”, „Wyczyść”, „Zapisz jako domyślny”, licznik „12 z 13 wierszy”, przycisk nagłówka „Filtruj · 3”.
- „Filtr zmienia tabelę i sumy. Nie wpływa na kalendarz.”

**Typy pól:**

| Typ | Wartość | Zachowanie |
|---|---|---|
| Tekst | string | pierwsze pole strony zawsze Tekst (tytułowe) |
| Liczba | number | format: zwykła / zł / % |
| Checkbox | bool | może być warunkiem „tylko gdy” dla kalendarza |
| URL | string | klikalny link, wyświetlany bez `https://` |
| Select | id opcji | etykiety mono w ramce, opcje edytowalne |
| Status | id opcji | jak Select, z kolorami (np. Czytam niebieski, Przeczytane zielony, Chcę przeczytać szary) |
| Data | data | opcja „Pokaż w kalendarzu” + „tylko gdy [Checkbox]”; obok daty „za N dni” / „minął” |
| Ocena | 1–5 | gwiazdki ★ (puste `#d4d4d4`) |
| Kwota cykliczna | `{amount, cycle}` cycle ∈ week/month/quarter/year | przelicza na miesiąc (tydzień × 52/12, kwartał / 3, rok / 12) i rok; format „43,00 / mies.” |
| Data odnowienia | data kotwicy | najbliższa przyszła data z kotwicy i cyklu (z Kwoty cyklicznej w wierszu albo własnego), „za N dni”; liczone przy odczycie |
| Sekret | `{v, iv, ct}` | 6.9 |

**Podsumowania i karty:**
- Podsumowania liczą się z wierszy po filtrze.
- Kartę definiuje `{field_id, aggregation, option_id?}`, gdzie agregacje to suma /mies., suma /rok, najbliższa data, liczba z opcją X, średnia, liczba w tym roku.

**Szablony (konfiguracja w kodzie; po utworzeniu strona jest w pełni edytowalna):**

| Szablon | Pola | Karty | Domyślnie |
|---|---|---|---|
| Pusta strona | Nazwa | — | — |
| Subscriptions | Nazwa, Kwota cykliczna, Data odnowienia (cykl z Kwoty, w kalendarzu tylko gdy Aktywna), Kategoria (Select), Aktywna (Checkbox) | Σ miesięcznie, Σ rocznie, Najbliższe odnowienie | sort po odnowieniu |
| Books | Tytuł, Autor, Status (Chcę przeczytać / Czytam / Przeczytane), Ocena, Przeczytana (Data) | Przeczytane w roku, Czytam teraz, Średnia ocena | sort: status, data |
| Projects | Nazwa, Status (Do zrobienia / W toku / Wstrzymane / Zrobione), Obszar (Select), Termin (Data, w kalendarzu), Repo (URL) | W toku, Najbliższy termin, Zrobione x/N | sort: termin |
| Websites | Nazwa, URL, Klient, Status (Wycena / W budowie / Na żywo), Hosting (Select) | Na żywo, W budowie, Klienci | — |
| Passwords | Serwis, Login, Hasło (Sekret), URL | — | sejf przy pierwszym otwarciu |

**Kosz:** usunięta strona lub wiersz trafia do kosza na 30 dni. Przywracanie odbywa się na dwa sposoby:
- powiadomienie „Usunięto · Cofnij” zaraz po usunięciu,
- sekcja „Kosz” w Ustawieniach → Ogólne, w stylu kart ustawień *[Claude]*.

### 6.9 Sejf i Sekret (zero-knowledge)
- **Ustaw sejf (`VaultSetup.dc.html`):**
  - hasło główne z miernikiem siły (4 segmenty) i Powtórz,
  - czerwone ostrzeżenie „Nie da się go odzyskać…”,
  - checkbox „Rozumiem…”, bez którego „Utwórz sejf” jest nieaktywne.
- **Sejf zablokowany (`Vault.dc.html`):**
  - tabela z „— zablokowane” w kolumnie Sekret,
  - karta „Odblokuj sejf” z polem hasła głównego,
  - „Klucz zostaje tylko w pamięci tej karty. Blokada po 5 min bezczynności.”, link „Nie pamiętam hasła — zresetuj sejf”.
- **Odblokowany (`Passwords.dc.html`):**
  - baner „Sejf odblokowany · blokada za 04:59” z odliczaniem, „Zablokuj teraz”,
  - komórki `••••••••••••` z akcjami pokaż / kopiuj; schowek czyszczony po 30 s.
- **Reset (`VaultReset.dc.html`):** wyliczenie, co zostanie usunięte (N sekretów), a co zostaje (serwisy, loginy, URL-e); potwierdzenie wpisaniem „RESETUJ”.
- **Kryptografia** (WebCrypto, tylko w przeglądarce):
  - hasło główne → PBKDF2-SHA-256, 600 000 iteracji, sól 16 B → klucz owijający,
  - losowy klucz danych AES-GCM-256 owinięty i zapisany w `vaults`,
  - każda wartość: AES-GCM z nowym IV 12 B, zapis `{v:1, iv, ct}` w base64,
  - poprawność hasła = udane odwinięcie klucza.
- **Zasady:**
  - hasło główne jest osobne od hasła konta,
  - zmiana hasła głównego = ponowne owinięcie klucza (Ustawienia → Sejf),
  - sekrety nie są przeszukiwane, nie trafiają do kalendarza ani ⌘K i nie wchodzą do podsumowań poza wypełnione/puste.

### 6.10 Paleta ⌘K i szybkie dodawanie (`CommandK.dc.html`, `QuickAdd.dc.html`)
Jeden skrót: Ctrl K / ⌘K, a także pole „Szukaj…” w sidebarze i „+” na Dziś *[Claude: makiety łączą się w jedno okno]*.

**Wyszukiwanie** (pusty tekst albo tekst, który nie jest poleceniem):
- grupy wyników: Wiersze stron (po polu tytułowym, z podtytułem strony), Moduły, Strony, Akcje (Nowa strona…),
- stopka „↑ ↓ wybierz · ↵ otwórz · sekrety nie są przeszukiwane”.

**Szybkie dodawanie:**
- Tekst rozpoznany jako polecenie pokazuje panel „Rozumiem to tak” (typ, dzień, godzina, wartości, opis skutku). Enter zapisuje. „Otwórz pełny formularz” przenosi tekst do okna.
- Parser regułowy, bez AI. Przykłady:
  - „bieg 10 km jutro 18:00”,
  - „siłownia push pt 17:00”,
  - „sen 23:40–7:10”,
  - „blok nauka matma jutro 8–10”,
  - „nawyk woda” (odhacza).

### 6.11 Ustawienia (`Settings*.dc.html`)
Zakładki: Ogólne, Konto i bezpieczeństwo, Sejf, Powiadomienia, Kategorie kalendarza.

**Ogólne:**
- Profil: nazwa, strefa, waga, wzrost; „Zmiany zapisują się dopiero po kliknięciu.”
- Cele: cel snu, tygodniowy cel km.
- Waluta stron.
- Konto (skrót): e-mail, hasło, sesja, Usuń konto.
- Kosz.

**Konto i bezpieczeństwo:**
- Zmiana hasła (obecne, nowe, powtórz; wylogowuje inne urządzenia).
- Zmiana e-maila z potwierdzeniem.
- Aktywne sesje (przeglądarka, system, kraj, czas; „Wyloguj”, „Wyloguj wszystkie inne”).
- Eksport danych (.json, sekrety zaszyfrowane).
- Usuń konto (trwale, z potwierdzeniem).

**Sejf** *[Claude, brak makiety — w stylu kart ustawień]*: stan sejfu, zmiana hasła głównego, czas auto-blokady (1/5/15 min), Zablokuj teraz, Reset sejfu.

**Powiadomienia:**
- Push na tym urządzeniu (włącz/wyłącz).
- Przełączniki z godzinami: przypomnienia o nawykach, odnowienia subskrypcji (ile dni wcześniej, godzina), przed blokiem (ile minut), podsumowanie tygodnia, cicha noc 23:00–07:00.
- „Wyślij testowe”.
- Lista urządzeń z „Wyłącz”.
- Lista przypomnień nawyków z godzinami.

**Kategorie kalendarza** *[Claude, brak makiety]*: lista kategorii z kolorem, zmianą nazwy, koloru i kolejności oraz usuwaniem. Systemowe są tylko do ukrywania.

### 6.12 Powiadomienia push
Service worker i Web Push (VAPID). Zadanie pg_cron co minutę wywołuje funkcję brzegową Supabase, która wysyła:
- przypomnienie nawyku o jego godzinie (nie, jeśli już odhaczony albo dziś niezaplanowany),
- „Za 10 min · [blok]”,
- odnowienie subskrypcji N dni wcześniej o zadanej godzinie,
- podsumowanie tygodnia w niedzielę o 18:00.

Cicha noc wstrzymuje wysyłkę. `notification_log` pilnuje, żeby nie było duplikatów.

### 6.13 Telefon (`MobileToday.dc.html`, `MobileCalendar.dc.html`)
- **Dziś:**
  - nagłówek z datą, kafelki Nawyki, Sen, Zadania, Km tydz.,
  - plan dnia z blokiem „TERAZ” i jego zadaniami,
  - nawyki z seriami.
- **Kalendarz dnia:** pasek tygodnia, wiersz cały dzień, oś godzin, pływający „+”.
- Dolny pasek nawigacji: Dziś, Kalendarz, Sport, Nawyki, Strony.
- Pozostałe ekrany są responsywne: okna stają się arkuszami, tabele przewijają się poziomo.

## 7. Testy (obowiązkowe)
- **Jednostkowe:**
  - kalendarz: powtórzenia i wyjątki, wystąpienia w zakresie, DST, zadania per wystąpienie,
  - nawyki i sen: % dnia, serie (dni i tygodnie), sen przez północ,
  - sport: tempo i kcal, 1RM i rekordy, objętość,
  - strony: cykle kwoty, najbliższe odnowienie i wystąpienia w zakresie, warunek „tylko gdy”, podsumowania z filtrem, walidacja wartości per typ,
  - sejf: szyfrowanie i owijanie klucza (wektory testowe), zmiana hasła głównego,
  - parser szybkiego dodawania, reguły hasła i sprawdzanie wycieków (mock).
- **Baza:** RLS dla każdej tabeli (pgTAP): użytkownik B nie czyta ani nie zmienia danych A.
- **E2E (Playwright):**
  - konto: rejestracja z potwierdzeniem (lokalny Mailpit), logowanie, reset, onboarding,
  - moduły: blok z zadaniem w dymku, nawyk i wpis snu, bieg,
  - strony: strona Subscriptions z wpisem w kalendarzu,
  - sejf: ustawienie, odblokowanie, blokada.
- **Wygląd:** zrzuty Playwright kluczowych ekranów porównane z makietami (ta sama szerokość 1440 px). Różnice oceniane ręcznie przy przeglądzie.

## 8. Etapy
Szczegóły: `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md`. Każdy etap kończy się działającą, wdrożoną aplikacją.

0. Fundament, logowanie, sidebar, 404, PWA.
1. Onboarding (7 kroków), profil, Ustawienia → Ogólne, Dziś w stanie pustym.
2. Kalendarz główny (3 widoki, dymek, okna, powtórzenia, kategorie).
3. Nawyki i sen.
4. Sport (z treningami w kalendarzu głównym).
5. Dziś (pełny).
6. Silnik stron (tabele, pola proste, menu, filtr, kosz, szablony Books, Projects, Websites).
7. Inteligentne pola, Subscriptions, wpisy stron w kalendarzu.
8. Sejf, Passwords, Ustawienia → Sejf.
9. Powiadomienia push.
10. Paleta ⌘K z szybkim dodawaniem, Ustawienia → Konto, telefon, dopracowanie i porównanie z makietami.

## 9. Pozostawione builderowi
- Biblioteki (każda musi dać wygląd z makiet):
  - kalendarz: własna siatka albo FullCalendar ostylowany pod makiety,
  - przeciąganie: dnd-kit,
  - wykresy: Recharts albo SVG.
- Agregaty liczone w przeglądarce (setki wierszy) albo w SQL.

## 10. Historia
- 2026-11-16: jeden dokument zastępuje specyfikacje z 2026-11-13 i 2026-11-15. Doszło wszystko z makiet:
  - wygląd techniczny i jasny, logo z siatką 3×3, dymki zamiast paneli,
  - Google, 7-krokowy onboarding, nowe ekrany Dziś, Nawyki, Sport, stron, sejfu, ustawień i telefonu,
  - kosz 30 dni, paleta ⌘K połączona z szybkim dodawaniem.

  Funkcje bez makiet przeszły do nie-celów.
