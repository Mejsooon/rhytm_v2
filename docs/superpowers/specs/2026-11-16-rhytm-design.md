# rhytm: dokument projektowy (nowe repo `rhytm_v2`, budowa od zera)

Data: 2026-11-16 (aktualizacja wieczorna) · Status: zaakceptowany przez Mejsona 2026-11-16

Ten dokument jest **kompletny i samodzielny**. Łączy:
- funkcje modułów z poprzednich specyfikacji (wersja 2 z 2026-11-14 i wersja 3 z 2026-11-15),
- wszystko, co zostało zaprojektowane na płótnie „Rhytm Design” (dawniej „rhytm — układ aplikacji (makiety)”): strona **Web Design** (ekrany komputera) i strona **Mobile Design** (ekrany telefonu),
- decyzje z rozmowy 2026-11-16 wieczorem (sekcja 0).

## 0. Decyzje z 2026-11-16 (wieczór)
1. **Strona to dokument z blokami** (tekst, nagłówek, lista zadań, separator, tabela). Wstawianie przez „/”, „+” i pasek skrótów na telefonie. Jedna strona może mieć kilka tabel. Szablony tworzą stronę z jedną tabelą. Tabele z edytora i z szablonów to ten sam silnik.
2. **Zadania mogą istnieć samodzielnie**: z datą („Dziś”, „Jutro”, dowolny dzień) albo bez daty. Liczą się do Dziś. Zadanie można przypiąć do wystąpienia bloku. Zadania z bloku „Lista zadań” na stronach to osobna rzecz i nie liczą się do Dziś *[Claude]*.
3. **Jeden onboarding, 7 kroków** na każdym urządzeniu. Telefon pokazuje te same kroki w układzie z makiety `MOnboarding.dc.html` (bez podglądu aplikacji).
4. **Telefon ma pełny design** (25 ekranów na stronie Mobile Design). To wzorzec wyglądu i zachowania na szerokości telefonu. Gdzie ekran mobilny i webowy pokazują różną treść, obowiązuje treść webowa (więcej funkcji), a wygląd mobilny; wyjątki wypisane w 6.13.
5. **Makiety wygrywają** z wcześniejszymi zapisami tego dokumentu. Zmiany z makiet z 2026-11-16 (edycja wierszy z „Zapisz”, własne kontrolki zamiast natywnych pól, usuwanie nawyku zamiast archiwizacji, nowe pola szablonów treningów, tagi snu, nowe ustawienia) są już wpisane poniżej.
6. Plan: zaktualizowana mapa etapów z listą odbiorczą dla każdego etapu; plan krok po kroku tylko dla Etapu 0, kolejne powstają tuż przed startem etapu.

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
- Zagnieżdżone strony, formuły, relacje między tabelami, widoki tabel inne niż tabela (tablica, galeria), bloki obok siebie w kolumnach, formatowanie tekstu w akapicie (pogrubienie, linki).
- Udostępnianie, import i eksport CSV, wiele walut naraz.
- Synchronizacja z Google Calendar, tryb offline, natywne aplikacje.
- Funkcje ze starych dokumentów, których **nie ma na makietach** *[Claude, do potwierdzenia]*:
  - wniosek tygodnia,
  - roczne heatmapy biegów i siłowni,
  - widok tygodnia w Sporcie,
  - harmonogram nawyku „bez planu”,
  - minutnik przerwy (usunięty też z makiety mobilnej), plany treningowe, panel „Do zaplanowania”.
  - logowanie biometrią do sejfu, pole „Buty” przy biegu.

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

Źródłem prawdy o wyglądzie są makiety w repo: `docs/design/mockups/` (kopia płótna; odświeżana w Etapie 0, zadanie „Makiety”).
- Otwiera się je przez `npx serve docs/design/mockups`. Strona `index.html` ma spis ekranów, a każdy ekran jest klikalny.
- Każdy ekran aplikacji ma odpowiadający plik `*.dc.html`. Pliki `M*.dc.html` (np. `MToday.dc.html`) to ekrany telefonu 390×844 ze strony Mobile Design; `MTabBar.dc.html` to dolny pasek.
- Przy porównaniu: komputer 1440 px z plikiem bez `M`, telefon 390 px z plikiem `M*`.
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

### 3.2 Wspólne kontrolki (z makiet, obowiązkowe)
Aplikacja **nie używa natywnych** `<select>`, `<input type="date">` ani `<input type="time">` (wyglądają inaczej niż makiety). Zamiast nich jeden zestaw komponentów, używany wszędzie:

| Kontrolka | Wygląd i zachowanie (makieta wzorcowa) |
|---|---|
| **Lista rozwijana** | przycisk jak pole (ramka `#e0e0e0`, 6 px, strzałka ⌄), ramka `#171717` gdy otwarta; dymek 10 px z cieniem `0 12px 32px rgba(0,0,0,.12)`; opcje 13 px, wybrana tło `#f0f0f0` + zielony ✓; opcja może mieć dopisek mono (np. „Warszawa UTC+01:00”) albo plakietkę statusu (`Settings`, `Projects`, `Main`) |
| **Wybór daty** | przycisk z datą `dd.mm.rrrr` (mono) albo „Wybierz datę”; dymek 244 px: ‹ miesiąc rok ›, nagłówki pn–nd (mono 10 px), dni 30 px, wybrany czarny, dziś w obwódce `#d4d4d4`, stopka „Dziś” i „Wyczyść” (`Books`, `Projects`, `EmptyPage`) |
| **Wybór godziny** | przycisk mono `12:00 ⌄`; dymek 268 px: „Godzina” siatka 6×4 (00–23), „Minuty” siatka 6×2 (:00–:55 co 5), wybrane czarne, „Gotowe”; klik godziny zostawia dymek, klik minut zamyka (`SettingsNotifications`, `HabitDialog`) |
| **Segment** | grupa przycisków w ramce, wybrany jasnoszary (web) / biała pigułka z cieniem na szarym tle (telefon) |
| **Przełącznik** | 40×22 px (web) / 50×30 px (telefon), zielony `#15803d` gdy włączony, płynne przesunięcie |
| **Checkbox** | zielony kwadrat z białym ✓ (telefon 24 px, web 18 px) |
| **Dymek akcji** | kontener dymków: zamyka się klikiem w wyzwalacz, „Gotowe”/wybór, Esc i klik poza dymkiem *[Claude: makiety nie mają klik-poza, dodajemy]*; nie jest przycinany przez karty/tabele (portal) |
| **Arkusz (telefon)** | od dołu, zaokrąglenie 18 px, uchwyt 36×5, przyciemnienie tła `rgba(0,0,0,.4)`; formularze na telefonie otwierają się jako arkusze (`MQuickAdd`, `MBlockSheet`, `MRowEdit`) |
| **Potwierdzenie słowem** | pole z wpisaniem słowa (RESETUJ, USUŃ), przycisk aktywny dopiero po zgodności, bez znaczenia wielkość liter i spacje na końcu (`VaultReset`, `Settings`) |

Inne zasady z makiet:
- Akcje wiersza (Edytuj, Usuń) pojawiają się po najechaniu (web), zawsze widoczne w trybie edycji.
- Liczniki, sumy i karty nad tabelami przeliczają się natychmiast po zmianie danych.
- Przyciski główne z `<a>` zachowują biały tekst na hover (tło `#2e2e2e`).
- Sidebar jest przyklejony (sticky, pełna wysokość okna) na szerokości ≥ 800 px; przewija się tylko treść.
- Hover pozycji sidebaru: tło `#f5f5f5`.

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
  - strony: `/strony` (lista stron; na telefonie zakładka „Strony”, `MPages`), `/strony/nowa` (szablony), `/strony/[id]`,
  - ustawienia: `/ustawienia/(ogolne|konto|sejf|powiadomienia|kategorie)`,
  - szukaj: `/szukaj` (telefon, `MSearch`; na komputerze ta sama treść w palecie ⌘K).
- **Jedna aplikacja dla obu szerokości:** te same trasy i dane. Poniżej 800 px układ przełącza się na mobilny z makiet `M*` (dolny pasek `MTabBar`, nagłówek z dużym tytułem, arkusze zamiast okien). Komponenty mają warianty web/mobile tam, gdzie makiety się różnią; logika jest wspólna.
- **Migracje i testy bazy:** migracje w `supabase/migrations`, testy RLS w pgTAP (`supabase/tests`), lokalnie `supabase start`.
- **Testy:** jednostkowe Vitest, komponentów Testing Library, przepływów Playwright (logowanie, rejestracja, reset, kluczowe ścieżki modułów). Wszystkie odpalane w CI GitHub Actions.

## 5. Model danych (szkic, builder dopracowuje)
- **Konto:** `profiles` (user_id PK, display_name, avatar_path, timezone, week_start 'mon'|'sun', clock '24'|'12', weight_kg, height_cm, sleep_goal_min DEFAULT 480, weekly_km_goal, currency DEFAULT 'PLN', roles text[], study_field, goals text[], referral_source, referral_other, onboarded_at, created_at)
- **Kalendarz:**
  - `categories` (id, user_id, name, color, position, is_system, hidden bool). Systemowe „Sport” i „Subscriptions” to filtry podglądu bez własnych bloków.
  - `blocks` (id, user_id, title, category_id, note, start_local timestamp, duration_min, timezone, recurrence jsonb NULL `{freq: 'daily'|'weekdays'|'weekly'|'custom', byWeekday: int[], until: date}`, remind bool DEFAULT true — przełącznik przypomnienia przy bloku, decyzja 9.1)
  - `block_exceptions` (block_id, occurrence_date, kind 'cancelled'|'modified', new_start_local, new_duration_min, new_title)
  - `tasks` (id, user_id, title, done, done_at, due_date date NULL, block_id NULL, occurrence_date NULL, position, created_at). Jedna tabela na zadania samodzielne i zadania w wystąpieniu bloku *[Claude, zastępuje `block_tasks`]*:
    - samodzielne: `block_id` NULL, `due_date` z datą albo NULL („Bez daty”),
    - w bloku: `block_id` + `occurrence_date` (każde wystąpienie ma własną listę), `due_date` = data wystąpienia,
    - przypięcie samodzielnego zadania do bloku ustawia `block_id` i `occurrence_date`.
- **Sport:**
  - `sport_sessions` (id, user_id, type 'run'|'gym', title, start_at, end_at, note, completed, show_in_calendar DEFAULT true, template_id NULL)
  - `runs` (session_id PK, kind 'easy'|'tempo'|'intervals'|'long'|'race' DEFAULT 'easy', distance_km, duration_s, difficulty 1–10, weight_kg_snapshot, kcal)
  - `exercises` (id, user_id, name, UNIQUE(user_id, lower(name)))
  - `gym_sets` (id, session_id, exercise_id, exercise_position, set_no, weight_kg NULL, reps, done). NULL ciężar = masa ciała.
  - `workout_templates` (id, user_id, name, weekdays int[] NULL, start_time time DEFAULT '17:00', last_used_at), `template_skips` (template_id, date) — pominięte zaplanowane wystąpienia, `workout_template_items` (template_id, exercise_id, position, sets_count, reps_text np. „8–10”, rest_s np. 120)
- **Nawyki i sen:**
  - `habits` (id, user_id, name, remind_at time NULL, show_on_today bool DEFAULT true, created_at). Usunięcie nawyku jest trwałe (z potwierdzeniem) i usuwa jego historię (makieta `HabitDetail`: „Usuń”, nie „Archiwizuj”).
  - `habit_schedules` (habit_id, valid_from date, schedule_type 'daily'|'weekdays'|'times_per_week', weekdays int[], times_per_week). Harmonogram jest wersjonowany, więc zmiana nie przelicza przeszłości.
  - `habit_checks` (habit_id, date, UNIQUE)
  - `sleep_logs` (user_id, date pobudki, slept_at time, woke_at time, feeling 1–5 (etykiety Źle / Słabo / OK / Dobrze / Super), tags text[] (np. „Kawa po 16”, „Ekran w łóżku”, „Trening”, „Alkohol”, „Stres”), note, UNIQUE(user_id, date))
- **Strony (dokumenty z blokami):**
  - `pages` (id, user_id, title, icon, template_key NULL, position, created_at, deleted_at NULL)
  - `page_blocks` (id, page_id, user_id, type 'text'|'heading'|'todo'|'divider'|'table', position, content jsonb: `{text}` dla text/heading, `{text, done}` dla todo, `{}` dla divider, a dla table `{name, settings: {sort, filters, hidden_field_ids, column_summaries, pinned_cards}}`; created_at, deleted_at NULL)
  - `page_fields` (id, block_id → page_blocks typu table, user_id, name, type, config jsonb, position, is_title)
  - `page_rows` (id, block_id, user_id, values jsonb `{field_id: wartość}`, remind bool DEFAULT true — przełącznik „Przypomnij N dni przed” dla dat odnowienia / dat w kalendarzu, position, created_at, updated_at, deleted_at NULL)
  - Szablon tworzy stronę z jednym blokiem `table`. Strona z szablonu Passwords ma tabelę z polem Sekret.
- **Sejf:** `vaults` (user_id PK, kdf jsonb `{alg:'PBKDF2-SHA-256', iterations:600000, salt}`, wrapped_key, wrap_iv, created_at, updated_at)
- **Powiadomienia:**
  - `push_subscriptions` (id, user_id, endpoint UNIQUE, keys jsonb, device_label, last_used_at, created_at)
  - `notification_settings` (user_id PK, push_enabled bool DEFAULT true, before_block_min NULL|5|10|15|30 DEFAULT 10 (Ustawienia: przełącznik „Start bloku w kalendarzu” + lista 5/10/15/30 min; onboarding „Przed blokiem, 10 min wcześniej”), renewal_days_before DEFAULT 3, renewal_hour DEFAULT 9, renewals_enabled bool, weekly_summary bool DEFAULT true, weekly_summary_at DEFAULT 'sun 18:00', habits_enabled bool, quiet_from DEFAULT 23:00, quiet_to DEFAULT 07:00, quiet_enabled bool)
  - `push_subscriptions` ma `enabled bool` (przycisk Wyłącz/Włącz przy urządzeniu bez usuwania subskrypcji).
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

**Telefon (`MOnboarding.dc.html`):** te same 7 kroków i dane. Nagłówek: logo (krok 1) lub ‹ Wstecz, „Krok n z 7”, „Wyloguj”; pasek 7 segmentów. Jedno pytanie na ekran, „Dalej” przyklejone na dole (krok 4 także „Pomiń”, krok 7 „Przejdź do Dziś”). Bez podglądu aplikacji. Kontrolki mobilne: lista strefy czasowej z ✓, segmenty tygodnia i formatu godziny, role jako lista z checkboxami, cele jako kafelki 2×N, liczniki −/+ dla km i celu snu, źródło jako chipy, strony jako karty z checkboxem i plakietką „z Twoich celów”, karta zgody „Zezwól” → „Włączone” + „Anuluj”, podsumowanie z „Zmień” wracającym do kroku. „Dalej” w kroku 1 nieaktywne bez imienia.

**Wspólne zachowanie (web i telefon):** po zgodzie na powiadomienia obok „Włączone” jest „Anuluj” (cofnięcie zgody w aplikacji). Kategorie z ról widać na żywo pod listą ról.

Nowy użytkownik trafia potem na **Dziś w stanie pustym** (`EmptyToday.dc.html`): „Witaj w rhytm”, lista „Pierwsze kroki” 0–4 (blok, nawyk, trening, wpis snu) i pusty plan dnia.

### 6.3 Sidebar i nawigacja (`Sidebar.dc.html`, `Main.dc.html`)

**Na komputerze:**
- Góra: logo i „rhytm”, pole „Szukaj… ⌘K”.
- **Moduły:** Dziś, Kalendarz, Sport, Nawyki i sen (ikony z makiety).
- **Strony:**
  - lista stron z ikoną, „+” przy nagłówku i „+ Nowa strona” na dole,
  - kolejność zmieniana przeciąganiem,
  - menu strony (`PageMenu.dc.html`): Zmień nazwę (F2), Zmień ikonę (siatka 24 ikon), Duplikuj, Przenieś wyżej / niżej, Usuń stronę. Usunięcie wymaga potwierdzenia „11 wierszy trafi do kosza na 30 dni. Daty z tej strony znikną z kalendarza.”
- Dół: link „Ustawienia” oraz blok użytkownika (inicjały, imię, e-mail, ikona ⇅). Klik w blok użytkownika otwiera dymek nad nim: imię i e-mail, „Wyloguj się” (czerwony). Tylko link „Ustawienia” prowadzi do ustawień.
- Aktywna pozycja ma tło `#f0f0f0` i wagę 500; hover `#f5f5f5`.
- Sidebar ma szerokość 232 px, jest przyklejony i ma wysokość okna; przewija się tylko treść.

**Na telefonie (`MTabBar.dc.html`):**
- Dolny pasek 84 px: Dziś, Kalendarz, Sport, Nawyki, Strony (aktywna pozycja czarna i pogrubiona). „Strony” prowadzi do ekranu listy stron `/strony` (`MPages.dc.html`).
- Sidebar chowa się. Ustawienia otwiera awatar w nagłówku Dziś albo ikona ⚙ na liście stron.

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
- **Tworzenie bloku:**
  - najechanie na pustą siatkę pokazuje „ducha” slotu (pełna godzina pod kursorem); klik otwiera dymek **„Nowy wpis”** z datą i godziną oraz trzema opcjami: **Blok** (okno „Nowy blok” z wypełnionym dniem i godziną), **Bieg** (okno „Nowy bieg”), **Siłownia** (nowy trening siłowy) — tak w widoku dnia, tygodnia, miesiąca (klik w dzień) i na osi Dziś,
  - przeciągnięcie po pustej siatce otwiera „Nowy blok” z zakresem godzin,
  - bloki przesuwa się i rozciąga przeciąganiem.
- **Powrót z okien:** Anuluj, ✕ i Zapisz w oknach (Nowy blok, Zakres, Kategoria) wracają do widoku, z którego okno otwarto (dzień/tydzień/miesiąc/Dziś), z tą samą datą. Okno kategorii otwarte z okna bloku wraca do okna bloku.

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
  - w osi są też treningi dnia (oznaczenie „plan”),
  - klik w pusty slot otwiera dymek „Nowy wpis” (Blok / Bieg / Siłownia), jak w kalendarzu.
- **Zadania samodzielne** (decyzja 0.2) *[Claude: sekcja nie ma jeszcze makiety webowej; wygląd jak lista zadań w dymku bloku]*:
  - sekcja „Zadania na dziś” pod planem dnia: zadania z `due_date` = dziś i zaległe (z datą wcześniejszą, oznaczone „zaległe”), odhaczanie, „+ Zadanie”,
  - zwijana sekcja „Bez daty”,
  - kafelek „Zadania” liczy zadania samodzielne na dziś + zadania z dzisiejszych wystąpień bloków.
- Stan pusty: lista „Pierwsze kroki” i „Plan dnia jest pusty”.

**Telefon (`MToday.dc.html`):**
- Nagłówek: etykieta „Niedziela · 15 listopada”, duży tytuł „Dziś”, ikona szukaj (→ `/szukaj`), awatar (→ Ustawienia).
- Kafelki 2×2: Nawyki x/y, Sen h, Zadania x/y, Km w tyg. x/cel — każdy prowadzi do swojego modułu.
- Karta „TERAZ” (trwający blok): godziny, „zostało N min”, zadania do odhaczenia.
- „Plan dnia” jako lista (godzina, pasek koloru kategorii, tytuł, czas, kategoria; zakończone przekreślone), „Kalendarz” →.
- „Nawyki” z odhaczaniem i serią, „Wszystkie” →. Karta najbliższego biegu.
- Pływający „+” otwiera arkusz **Szybko dodaj** (`MQuickAdd.dc.html`): segment Zadanie / Blok / Bieg / Nawyk, pole z podpowiedzią zależną od typu, chipy „Kiedy” (Dziś, Dziś 18:00, Jutro, Pn 16.11, Bez daty), link do pełnego formularza bloku lub biegu, „Dodaj”.

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
  - przełącznik **Miesiąc** / 3 mies. / 6 mies. / Rok, legenda mniej–więcej,
  - widok Miesiąc: siatka dni miesiąca ze strzałkami ‹ › (do 12 miesięcy wstecz; strzałka nieaktywna na granicy, wyszarzona),
  - najechanie na kwadrat pokazuje dymek: data i „x z y nawyków” (na telefonie stuknięcie),
  - dzień bez zaplanowanych nawyków jest szary, nie 0%.
- Wykres snu: najechanie (stuknięcie) na słupek pokazuje datę i czas snu.

**Szczegóły nawyku (`HabitDetail.dc.html`):**
- **Usuń** (czerwony, z potwierdzeniem; usuwa nawyk i historię), Edytuj.
- Harmonogram, przypomnienie, data startu.
- Kafelki: seria, najdłuższa seria, 30 dni %, łącznie razy.
- Kalendarz miesiąca z ‹ › i stanami zrobione / pominięte / dzień bez nawyku.
- „Historia harmonogramu” z dopiskiem „Zmiana harmonogramu nie przelicza przeszłych dni.”

**Nowy nawyk (`HabitDialog.dc.html`):**
- Nazwa.
- Harmonogram: Codziennie / Wybrane dni (pn–nd) / X razy w tygodniu (1–7), ze zdaniem wyjaśnienia.
- Dni tygodnia jako przyciski do zaznaczania (wybrane czarne).
- Przypomnienie push: przełącznik i **wybór godziny** z 3.2 (nieaktywny, gdy przypomnienie wyłączone); tylko w dni z harmonogramu.
- Telefon (`MHabitNew.dc.html`): pełny ekran z „Anuluj” / „Zapisz” w nagłówku, segment Codziennie / Wybrane dni / X w tyg., licznik −/+ dla X, chipy godzin przypomnienia, przełącznik „Pokazuj na ekranie Dziś”, zdanie podsumowania na dole.

**Wpis snu (`SleepDialog.dc.html`, telefon `MSleep.dc.html`):**
- Data pobudki, zasnąłem, wstałem (telefon: przyciski −/+ co 15 min).
- Czas snu liczony na żywo, także przez północ, np. „90% celu 8:00 · brakuje 48 min” (telefon: duża liczba i „Powyżej celu” / „Brakuje N min do celu”).
- Samopoczucie 1–5 z etykietami Źle / Słabo / OK / Dobrze / Super.
- „Co mogło wpłynąć”: chipy wielokrotnego wyboru (Kawa po 16, Ekran w łóżku, Trening, Alkohol, Stres) — z makiety mobilnej, także na komputerze *[Claude]*.
- Notatka. Jeden wpis na dzień, edytowalny.

**Telefon (`MHabits.dc.html`, `MHabitDetail.dc.html`):** segment Nawyki / Sen; nawyki: pierścień „x z y zrobione dziś”, lista z dużym checkboxem i „seria N dni”, heatmapa 4 tygodni ze stuknięciem; sen: kafelki, wykres 14/30 dni ze stuknięciem, „Dodaj wpis snu”. Szczegóły: kafelki Seria / Rekord / Skuteczność, kalendarz miesiąca ‹ › (do 5 mies. wstecz), notatki, „Usuń nawyk”.

**Zasady:**
- % dnia = (zrobione zaplanowane na ten dzień + odhaczone nawyki X/tydz.) / (zaplanowane na ten dzień + odhaczone nawyki X/tydz.). Nawyki X/tydz. mogą tylko podnieść wynik.
- Seria nawyków X/tydz. jest liczona w tygodniach.
- Usunięcie nawyku jest trwałe (z potwierdzeniem) i usuwa jego historię.

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
- Rodzaj biegu (chipy, jeden wybór): Spokojny / Tempo / Interwały / Długi / Zawody; domyślnie Spokojny.
- Data, start, dystans, czas (wybór daty i godziny z 3.2).
- Tempo i kcal liczone na żywo.
- Trudność 1–10, notatka, „Pokaż w kalendarzu głównym jako blok” (domyślnie włączone).
- Bieg bez czasu zapisuje się jako plan.
- Kcal ze wzoru ACSM: VO₂ = 3,5 + 0,2 × prędkość [m/min], kcal = VO₂ × waga × czas[min] / 1000 × 5. Waga z profilu jest zapisywana razem z biegiem.

**Trening siłowy (`GymLog.dc.html`):**
- Nagłówek: „Zapisz jako szablon”, „Zakończ trening”.
- Kafelki: objętość (suma kg × powtórzenia zrobionych serii), serie zrobione/wszystkie.
- Ćwiczenia z tabelą serii: nr, kg, powtórzenia, ✓, wiersz „1RM … · +2,5 kg vs ostatnio”.
- Pola kg i powtórzeń edytowalne w każdej serii; ✓ odhacza serię; objętość i licznik serii przeliczają się na żywo.
- „+ Seria” dodaje serię kopiującą ciężar i powtórzenia poprzedniej.
- ✕ przy serii (widoczne po najechaniu) usuwa serię; „Usuń ćwiczenie” pod ćwiczeniem.
- „+ Ćwiczenie” otwiera dymek: wyszukiwanie, lista z biblioteki z grupą mięśni (bez ćwiczeń już dodanych, bez duplikatów wielkości liter), „+ Dodaj „…”” dla własnego; Enter wybiera, Esc zamyka. Nowe ćwiczenie dostaje 3 puste serie.
- Seria cięższa niż dotychczasowe maksimum dostaje plakietkę „REKORD”.
- Telefon (`MGym.dc.html`): nagłówek z nazwą, „x/y serii · czas”, „Zakończ”; pasek postępu; tabela serii z dużymi checkboxami; „+ Dodaj serię”, „Dodaj ćwiczenie”.

**Szablony (`WorkoutTemplates.dc.html`):**
- Lista: karty (nazwa, „ostatnio”, liczba ćwiczeń i serii, dni tygodnia, lista ćwiczeń, „Rozpocznij”, „Edytuj”) i pusta karta „+ Nowy szablon”; „Nowy szablon” także w nagłówku.
- Edytor szablonu (ten sam ekran, ścieżka „Szablony treningów / Nowy szablon” lub „Edycja: X”):
  - nazwa (wymagana), dni tygodnia (opcjonalnie, chipy pn–nd),
  - tabela ćwiczeń: #, nazwa, serie −/+ (1–10), powtórzenia (tekst, np. „8–10”), przerwa (np. „2:00”), ↑ ↓ ✕,
  - „+ Ćwiczenie” jak w treningu, nowe ćwiczenie: 3 serie, „8–10”, „2:00”,
  - „Zapisz szablon” (nieaktywne bez nazwy lub bez ćwiczeń), „Anuluj”, „Usuń szablon” (tylko istniejący); po zapisie powrót do listy z zielonym komunikatem.
- „Rozpocznij” tworzy trening z ciężarami i powtórzeniami z ostatniego wykonania.

**Szczegóły ćwiczenia (`ExerciseDetail.dc.html`):**
- Kafelki: szac. 1RM (Epley: ciężar × (1 + powt./30)), najcięższa seria, najwięcej powtórzeń, zmiana za 8 tygodni.
- Wykres 1RM z przełącznikiem 3 mies. / 8 tyg.
- Historia z oznaczeniem REKORD.
- Akcja „Zmień nazwę”.

**Cel tygodniowy km:** z ustawień albo onboardingu.

**Telefon (`MSport.dc.html`, `MRunNew.dc.html`):** segment Tydzień / Miesiąc; karta „Bieganie” (km / cel, pasek, biegi, śr. tempo, siłownia); wykres km ze stuknięciem; przyciski „Bieg” i „Trening”; „Ostatnie”. Nowy bieg: chipy rodzaju, dystans i czas −/+, tempo liczone, trudność 1–10 (z opisem lekko / umiarkowanie / ciężko / maksymalnie), dzień, „Pokaż w kalendarzu głównym”, notatka.

### 6.8 Strony i tabele

**Nowa strona (`NewPage.dc.html`):**
- Lista szablonów: Pusta strona, Subscriptions, Books, Projects, Websites, Passwords.
- Panel „Pola, które powstaną” z opisem działania, nazwa strony, „Utwórz stronę”.

**Edytor strony (`EmptyPage.dc.html`, telefon `MEditor.dc.html`)** — decyzja 0.1:
- Nagłówek: ścieżka „Strony / [tytuł]” (aktualizuje się na żywo), „Szablony” (→ Nowa strona).
- Ikona strony (40×40, przerywana ramka) i tytuł 24 px „Bez tytułu”.
- Bloki jeden pod drugim; każdy ma kosz po najechaniu (prawa krawędź):
  - **Tekst** (akapit, placeholder „Pusty akapit”), **Nagłówek** (20 px, 600), **Lista zadań** (checkbox + tekst, zrobione przekreślone), **Separator** (linia), **Tabela**.
- Linia poleceń na końcu: „+” i pole „Wpisz „/”, aby wstawić blok — tabelę, listę, nagłówek…”.
  - Wpisanie „/” otwiera menu „Bloki” (Tabela, Lista zadań, Nagłówek, Tekst, Separator — ikona, nazwa, opis), filtrowane na żywo („/tab”); ↑↓ wybór, Enter wstawia, Esc zamyka, najechanie podświetla; „Brak bloku „x””; stopka „↑↓ wybór · Enter wstaw · Esc zamknij”.
  - Enter na zwykłym tekście wstawia go jako akapit.
  - Pusta strona: chipy „albo zacznij od:” (Tabela, Lista zadań, Nagłówek, Tekst) i „Wolisz gotowca? Użyj szablonu →”.
- **Blok Tabela:** pole nazwy tabeli („Tabela bez nazwy”), siatka z kolumnami (pierwsza szersza), kolumna „+” na końcu nagłówka, „+ Nowy wiersz” pod tabelą i licznik „N wierszy · N kolumn”. Nowa tabela: kolumny Nazwa (Tekst), Status (Wybór: Do zrobienia / W toku / Zrobione), Data (Data), 2 puste wiersze.
  - Klik w nagłówek kolumny otwiera dymek: nazwa, „Typ pola” (Tekst, Liczba, Data, Wybór, Checkbox, Link; w tabelach silnika także pozostałe typy z tabeli niżej), przy Wyborze „Opcje” (plakietki w kolorach z ×, „Nowa opcja…” + Dodaj/Enter), „← W lewo / W prawo →”, „Usuń kolumnę” (nieaktywne przy ostatniej).
  - „+” dodaje kolumnę „Kolumna N” i od razu otwiera jej dymek.
  - Zmiana typu przelicza wartości (liczba z tekstu, checkbox z „tak/1/x”, data tylko poprawna, Wybór zbiera istniejące teksty jako opcje).
  - Stopka z sumą dla Liczby i „x / y” dla Checkboxa.
  - Na telefonie tabela przewija się poziomo; nagłówek kolumny otwiera arkusz „Kolumna”; Wybór zmienia się stuknięciem po kolei; pasek skrótów na dole (+, tabela, zadanie, H, „N bloków”); „/” lub „+” otwiera arkusz „Wstaw blok”.
- *[Claude]* W blokach tabel z edytora komórki edytuje się bezpośrednio (jak w makiecie edytora). W tabelach stron z szablonów obowiązuje tryb edycji wiersza (niżej). Silnik jest wspólny; różni się tylko sposób edycji — **do potwierdzenia w 9.1**.

**Strona z tabelą z szablonu (`Main.dc.html` = Subscriptions, `Books`, `Projects`, `Websites`):**
- Nagłówek: ścieżka „Strony / X”, Filtruj, „+ Pole”, „Nowy wiersz”.
- Tytuł i metadane „N wierszy · N pól · szablon „…” · sort: …” (N liczone na żywo).
- **Przypięte karty** (3) nad tabelą, przeliczane na żywo (np. Przeczytane w 2026, Czytam teraz, Średnia ocena; W toku, Najbliższy termin z „za N dni” czerwonym ≤ 7 dni, Zrobione x / N; Na żywo, W budowie, Klienci).
- Tabela:
  - nagłówki z ikoną typu,
  - **wiersz w trybie podglądu**: sformatowane wartości (plakietki statusu, gwiazdki, daty `dd.mm.rrrr`, „za N dni / minął”, kwoty „43,00 zł / mies.”); cały wiersz klikalny (otwiera edycję); po najechaniu w ostatniej kolumnie „Edytuj” i „Usuń”,
  - **wiersz w trybie edycji** (tło `#f7fbf8`): pola tekstowe, listy rozwijane (status, kategoria, obszar, hosting), wybór daty, segment cyklu (mies. / rok), gwiazdki do kliknięcia (ponowny klik zeruje), przyciski „Zapisz” (czarny) i ✕ (anuluj),
  - „Nowy wiersz” dodaje wiersz w trybie edycji na końcu; pusty tytuł zapisuje się jako „Bez tytułu” / „Bez nazwy”,
  - stopka z „+ Nowy wiersz” i podsumowaniami kolumn (liczonymi na żywo).
- Wiersze nieaktywne (Checkbox „Aktywna” odznaczony) są przekreślone i szare.
- Kolumna z „Pokaż w kalendarzu” ma znaczek „w kalendarzu”.
- Tabela przewija się poziomo tylko poniżej 1100 px; dymki nie są przycinane.
- Linki (URL, repo) w trybie podglądu nie otwierają edycji wiersza.
- **Telefon (`MSubs.dc.html`, `MRowEdit.dc.html`, `MPages.dc.html`):** lista stron z sekcjami „Ulubione” i „Wszystkie strony”, wyszukiwarka, „+ Nowa strona”. Strona z szablonu jako karty wierszy (inicjał, nazwa, data · „za N dni”, kwota, plakietka kategorii), kafelki sum, karta „Najbliżej”, chipy filtra (Wszystkie / Miesięczne / Roczne). Stuknięcie wiersza lub „+” otwiera arkusz edycji: nazwa, kwota z „zł”, segment cyklu, wbudowany kalendarz daty odnowienia z „za N dni”, chipy kategorii, przełączniki Aktywna i „Przypomnij 3 dni przed”, „Usuń wiersz”, „Anuluj” / „Zapisz”.

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
- **Reset (`VaultReset.dc.html`):** wyliczenie, co zostanie usunięte (N sekretów), a co zostaje (serwisy, loginy, URL-e); potwierdzenie wpisaniem „RESETUJ” (w jednym zdaniu „Wpisz RESETUJ, żeby potwierdzić”), przycisk „Zresetuj sejf” nieaktywny do zgodności.
- **Telefon:** `MVault`, `MPasswords` (6.13). Przycisk „Odblokuj biometrią” z makiety mobilnej: **do potwierdzenia w 9.1** (wymaga WebAuthn z rozszerzeniem PRF; propozycja: poza v1, przycisk ukryty).
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

**Zasada kart ustawień (z makiet):** każda karta ma własne „Zapisz” w stopce, aktywne dopiero po zmianie; obok pojawia się „Cofnij”; stopka pokazuje „Masz niezapisane zmiany.”, a po zapisie zielone „Zapisano ✓”. Błędy pod polem (12 px, czerwony).

**Ogólne:**
- Profil: wyświetlana nazwa (wymagana), strefa czasowa (lista rozwijana z miastem i UTC), waga 30–250 kg i wzrost 120–230 cm (opcjonalne, placeholder „np. 75”).
- Cele: cel snu (−/+ co 15 min, 5:00–11:00), tygodniowy cel km (1–300), waluta stron (PLN zł, EUR €, USD $, GBP £), „Tydzień zaczyna się w” (Poniedziałek / Niedzielę).
- Konto (skrót): e-mail z „Zmień” (pole nowego adresu ze sprawdzeniem formatu, „Wyślij link”, po wysłaniu „link potwierdzający wysłany na …”), „Zmień hasło” (→ Konto i bezpieczeństwo), sesja z „Wyloguj”.
- Usuń konto: „Usuń konto” → potwierdzenie słowem USUŃ → „Usuń konto na zawsze”.
- Kosz.

**Konto i bezpieczeństwo:**
- Zmiana hasła: obecne, nowe (pasek siły 4 segmenty + opis „Słabe/Średnie/Dobre/Mocne hasło”), powtórz („Hasła są takie same ✓” / „Hasła się różnią”); stopka mówi, czego brakuje; przycisk aktywny, gdy obecne wpisane, nowe ≥ 10 znaków, różne od obecnego i powtórzone; po zmianie pola się czyszczą, inne urządzenia są wylogowane.
- Zmiana e-maila z potwierdzeniem.
- Sesje: bieżące urządzenie z plakietką „TA”, opis, „Wyloguj wszystkie inne”, zielony komunikat „Wylogowano wszystkie inne urządzenia ✓” (decyzja 9.1; bez listy innych sesji).
- Eksport danych (.json, sekrety zaszyfrowane): „przygotowuję plik…” → nazwa pliku i rozmiar, „Pobierz ponownie”.
- Usuń konto (trwale, z potwierdzeniem).

**Sejf** *[Claude, brak makiety — w stylu kart ustawień]*: stan sejfu, zmiana hasła głównego, czas auto-blokady (1/5/15 min), Zablokuj teraz, Reset sejfu.

**Powiadomienia:**
- Push na tym urządzeniu (przełącznik; wyłączony wyszarza i blokuje pozostałe przełączniki).
- Przełączniki: przypomnienia o nawykach, start bloku w kalendarzu, odnowienia subskrypcji; cicha noc z przełącznikiem i dwoma **wyborami godziny** (od–do).
- „Wyślij testowe”: komunikat „Wysłano testowe powiadomienie na N urządzenia ✓”; nieaktywne, gdy push wyłączony albo brak aktywnych urządzeń.
- Lista urządzeń z plakietką „TO” przy bieżącym i przyciskiem „Wyłącz” / „Włącz”.
- Lista przypomnień nawyków: przełącznik i wybór godziny przy każdym nawyku (zmiana zapisuje się w nawyku).

**Kategorie kalendarza** *[Claude, brak makiety]*: lista kategorii z kolorem, zmianą nazwy, koloru i kolejności oraz usuwaniem. Systemowe są tylko do ukrywania.

### 6.12 Powiadomienia push
Service worker i Web Push (VAPID). Zadanie pg_cron co minutę wywołuje funkcję brzegową Supabase, która wysyła:
- przypomnienie nawyku o jego godzinie (nie, jeśli już odhaczony albo dziś niezaplanowany),
- „Za 10 min · [blok]”,
- odnowienie subskrypcji N dni wcześniej o zadanej godzinie,
- podsumowanie tygodnia w niedzielę o 18:00.

Cicha noc wstrzymuje wysyłkę. `notification_log` pilnuje, żeby nie było duplikatów.

### 6.13 Telefon (strona Mobile Design, pliki `M*.dc.html`)
Poniżej 800 px aplikacja wygląda jak te makiety. Ekrany i ich odpowiedniki:

| Telefon | Odpowiednik web | Uwagi |
|---|---|---|
| `MLogin`, `MRegister`, `MForgot` | Login, Register, Forgot | pełny ekran bez karty; pasek siły hasła; „Pokaż hasło”; Turnstile i reguły z web *[Claude: makiety mobilne ich nie pokazują, ale obowiązują]* |
| `MOnboarding` | Onboarding 1–7 | 6.2 |
| `MToday`, `MQuickAdd`, `MSearch` | Today, QuickAdd, CommandK | 6.5; Szukaj: „Ostatnio” (chipy), „Szybkie akcje”, wyniki grupowane na żywo, „Nic nie znaleziono dla „x”” |
| `MCalendarDay` | CalendarDay | segment Dzień / Tydzień / Miesiąc (linki); pasek tygodnia z kropkami dni z blokami; oś 07–22 co 56 px; bloki z paskiem koloru; linia „teraz”; stuknięcie pustego miejsca lub „+” → arkusz Nowy blok |
| `MCalendarWeek` | Calendar | lista dni tygodnia (plakietka dnia, bloki z godziną) |
| `MCalendarMonth` | CalendarMonth | siatka miesiąca ‹ › z kropkami kategorii (do 3), wybrany dzień czarny, lista bloków dnia pod siatką, „Brak bloków — dodaj” |
| `MBlockSheet` | BlockDialog | arkusz: nazwa, chipy kategorii z kropką, dzień, od / do −/+ co 15 min, czas trwania, segment powtarzania (Nie / Codziennie / Co tydzień / Dni rob.), zadania (dodaj Enterem, usuń ×), przełącznik przypomnienia |
| `MHabits`, `MHabitDetail`, `MHabitNew`, `MSleep` | Habits, HabitDetail, HabitDialog, SleepDialog | 6.6 |
| `MSport`, `MRunNew`, `MGym` | Sport, RunDialog, GymLog | 6.7 |
| `MPages`, `MSubs`, `MRowEdit`, `MEditor` | lista stron (sidebar), Main, wiersz w edycji, EmptyPage | 6.8 |
| `MVault`, `MPasswords` | Vault, Passwords | Sejf: hasło główne, „Odblokuj”, komunikat przy pustym polu, „Nie pamiętam hasła głównego”; Hasła: wyszukiwanie, wiersze rozwijane z ••••, pokaż / kopiuj (komunikat „Skopiowano · schowek wyczyści się za 30 s”), ostrzeżenie „słabe hasło”, „auto-blokada za m:ss”, ikona kłódki blokuje |
| `MSettings` | Settings (wszystkie zakładki) | jedna lista: profil, Motyw *[poza zakresem: tylko jasny — segment ukryty]*, początek tygodnia, powiadomienia (przełączniki), konto, „Wyloguj się”, wersja aplikacji |
| `MTabBar` | Sidebar | 6.3 |

Ekrany web bez odpowiednika mobilnego (np. AddField, ColumnMenu, FilterPopover, ScopeDialog, CategoryDialog, VaultSetup, VaultReset, WorkoutTemplates, ExerciseDetail, CalendarRenewal, NotFound) na telefonie: okna jako arkusze (3.2), dymki jako arkusze, tabele przewijane poziomo, układ jednokolumnowy *[Claude]*.

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
- **Dodatkowo (decyzje 0.1–0.2):** zadania samodzielne (daty, zaległe, przypięcie do bloku, liczenie do kafelka), edytor bloków (wstawianie, kolejność, usuwanie, filtr menu „/”), zmiana typu kolumny z przeliczeniem wartości.
- **Wygląd:** zrzuty Playwright każdego ekranu z listy odbiorczej etapu porównane z makietami: komputer 1440 px z `X.dc.html`, telefon 390×844 z `MX.dc.html`. Zrzut makiety robi się tym samym Playwrightem z `npx serve docs/design/mockups`. Różnice oceniane ręcznie przy przeglądzie etapu.
- **Interakcje:** każdy punkt listy odbiorczej etapu (mapa etapów) ma test e2e albo komponentowy, który go sprawdza.

## 8. Etapy
Szczegóły: `docs/superpowers/plans/2026-11-16-rhytm-roadmap.md`. Każdy etap kończy się działającą, wdrożoną aplikacją.

Każdy etap buduje swoje ekrany **od razu w wersji web i telefon** (makiety `M*` w tym samym etapie), żeby na końcu nie zostało „dorabianie mobilki”.

0. Fundament: wspólne kontrolki z 3.2, logowanie, sidebar i dolny pasek, 404, PWA, odświeżona kopia makiet.
1. Onboarding (7 kroków, web + telefon), profil, Ustawienia → Ogólne, Dziś w stanie pustym.
2. Kalendarz główny (3 widoki, dymki, „Nowy wpis”, okna, powtórzenia, kategorie) + zadania (samodzielne i w blokach).
3. Nawyki i sen.
4. Sport (z treningami w kalendarzu głównym, szablony z edytorem).
5. Dziś (pełny, z zadaniami samodzielnymi) i Szybko dodaj na telefonie.
6. Silnik stron: edytor bloków z „/”, tabele (pola proste, tryby edycji, menu, filtr), kosz, szablony Books, Projects, Websites.
7. Inteligentne pola, Subscriptions, wpisy stron w kalendarzu.
8. Sejf, Passwords, Ustawienia → Sejf.
9. Powiadomienia push.
10. Paleta ⌘K (web) i Szukaj (telefon), Ustawienia → Konto, końcowe porównanie wszystkich ekranów z makietami.

## 9. Pozostawione builderowi
- Biblioteki (każda musi dać wygląd z makiet):
  - kalendarz: własna siatka albo FullCalendar ostylowany pod makiety,
  - przeciąganie: dnd-kit,
  - wykresy: Recharts albo SVG.
- Agregaty liczone w przeglądarce (setki wierszy) albo w SQL.
- Biblioteka dymków i arkuszy (Radix Popover / Dialog z shadcn/ui, Vaul dla arkuszy) — wygląd musi być jak w 3.2.

### 9.1 Decyzje Mejsona po recenzji (2026-11-16)
- **Usługi zewnętrzne:** Mejson sam zakłada Supabase (projekt chmurowy), Vercel, Google OAuth, Cloudflare Turnstile, Resend, a później klucze VAPID, i daje dostęp. Plan Etapu 0 zawiera instrukcję krok po kroku, co kliknąć i jakie wartości skopiować. Do czasu podania kluczy e2e w CI działa na lokalnym Supabase z Mailpitem i testowymi kluczami Turnstile.
- **Domena:** domyślna `*.vercel.app` (adresy powrotne logowania i linki w mailach na tę domenę; zmiana później to aktualizacja zmiennych środowiskowych).
- **Regulamin i polityka prywatności:** strony-zaślepki `/regulamin` i `/prywatnosc` z tekstem „[TREŚĆ DO UZUPEŁNIENIA]”, linkowane z rejestracji.
- **Przypomnienia per rzecz (2A):** ustawienia ogólne + przełącznik przy każdym bloku (`blocks.remind`) i przy każdym wierszu z datą w kalendarzu (`page_rows.remind`), domyślnie włączone. Przed blokiem domyślnie 10 min, w Ustawieniach wybór 5/10/15/30 *[Claude]*.
- **Sport:**
  - minutnik przerwy wyrzucony (także z makiety `MGym`); pole „przerwa” w szablonie zostaje jako informacja,
  - bieg ma **rodzaj** (Spokojny / Tempo / Interwały / Długi / Zawody) i **trudność 1–10** (bez „odczucia 1–5”); makiety `RunDialog` i `MRunNew` poprawione,
  - **dni tygodnia w szablonie same tworzą zaplanowane treningi**: dla każdego dnia z `workout_templates.weekdays` w kalendarzu Sportu i głównym pojawia się zaplanowany trening z szablonu (godzina startu: `workout_templates.start_time`, domyślnie 17:00 *[Claude]*). Wystąpienia są liczone przy odczycie jak powtórzenia bloków (bez generowania wierszy z góry); „Rozpocznij” albo edycja zapisuje konkretną sesję `sport_sessions` z `template_id` i datą, a usunięcie wystąpienia zapisuje wyjątek `template_skips (template_id, date)` *[Claude]*. Zmiana dni w szablonie zmienia tylko przyszłe wystąpienia.
- **Sesje (A):** v1 bez listy urządzeń: karta „Sesje” z bieżącym urządzeniem (plakietka „TA”), opisem i przyciskiem „Wyloguj wszystkie inne” (Supabase `signOut({ scope: 'others' })`), zielony komunikat po wylogowaniu. Makieta `SettingsAccount` poprawiona. Pełna lista sesji poza zakresem v1.

### 9.2 Rozstrzygnięcia po recenzji *[Claude, do sprawdzenia przy czytaniu]*
- **Zakres godzin:** siatki kalendarza i oś Dziś obejmują całą dobę 00–24, ale przy otwarciu przewijają się tak, że widać 06–22 (web) / 07–22 (telefon) albo trwający blok. Nic nie jest ucinane ani ukrywane.
- **Format 12 h:** zmienia wyświetlanie wszystkich godzin (np. „2:30 PM”). Wybór godziny w trybie 12 h ma siatkę 1–12 i przełącznik AM/PM; w trybie 24 h siatkę 00–23.
- **„Wolne (8–20)”** w „Dzień w liczbach” = czas między 8:00 a 20:00 niezajęty przez bloki tego dnia.
- **Kafelek „Zadania” na Dziś (karta tygodnia):** wartość główna = zrobione / wszystkie zadania z datą w bieżącym tygodniu (samodzielne + z wystąpień bloków), dopisek „dziś x/y” = to samo dla dziś. Na telefonie kafelek „Zadania” pokazuje tylko dziś.
- **Przypięcie zadania do bloku:** w wierszu zadania samodzielnego menu „…” → „Przypnij do bloku” z listą wystąpień bloków z dnia zadania (dla zadań bez daty: z dziś). W dymku bloku „Odepnij” przenosi zadanie z powrotem do samodzielnych.
- **Strony z onboardingu:** zapisywane jako „do utworzenia”, tworzone przy pierwszym wejściu po Etapie 6 (zgodnie z mapą etapów).
- **Passwords przy zablokowanym sejfie:** wiersz można edytować poza polem Sekret (pokazuje „— zablokowane”, nieedytowalne). Duplikuj kopiuje zaszyfrowaną wartość bez zmian (ten sam klucz).
- **Podsumowanie tygodnia (push, niedziela 18:00):** „Twój tydzień: N km · N treningów · nawyki N% · śr. sen h:mm · zadania x/y”.
- **Konto tylko z Google:** w Konto i bezpieczeństwo zamiast „Zmień hasło” jest „Ustaw hasło” (bez pola „obecne hasło”).

## 10. Historia
- 2026-11-16 (wieczór): decyzje z sekcji 0; doszły: edytor bloków stron, zadania samodzielne, wspólne kontrolki (3.2), pełny Mobile Design (6.13), edycja wierszy z „Zapisz”, „Nowy wpis” z kliknięcia w kalendarz, edytor szablonów treningów, interaktywne ustawienia, tagi snu, usuwanie nawyków.
- 2026-11-16: jeden dokument zastępuje specyfikacje z 2026-11-13 i 2026-11-15. Doszło wszystko z makiet:
  - wygląd techniczny i jasny, logo z siatką 3×3, dymki zamiast paneli,
  - Google, 7-krokowy onboarding, nowe ekrany Dziś, Nawyki, Sport, stron, sejfu, ustawień i telefonu,
  - kosz 30 dni, paleta ⌘K połączona z szybkim dodawaniem.

  Funkcje bez makiet przeszły do nie-celów.
