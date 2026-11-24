# Ustawienia i sejf — web — projekt

Data: 2026-11-24. Autor: Claude (seria autonomiczna). Gałąź: `feat/ustawienia-web`.

Zgłoszenie Mejsona: „Sekcja Ogólne nie ma zmiany hasła, maila itd. jak na makiecie. Konto i bezpieczeństwo jest całkowicie puste. Powiadomienia także. Moduł Hasła, gdy jest zablokowany, nie wygląda jak na makiecie: nie ma blura na stronie i widać tytuł »Hasła«, co mi się nie podoba.”

Decyzje Mejsona (wiążące):
1. **Push w pełni teraz**: subskrypcja urządzeń (service worker + PushManager), lista urządzeń, wysyłka trzech rodzajów (nawyki, start bloku, odnowienia subskrypcji), cicha noc, „Wyślij testowe”. Architektura jak w starym rhytm (`/home/claude/mejsooon/rhytm`): pg_cron co minutę, pg_net woła trasę Vercel z `Authorization: Bearer <CRON_SECRET>`, trasa wysyła przez `web-push`. Sekrety wkleja Mejson sam (sekcja „Kroki Mejsona”). Kod działa bez kluczy.
2. **„Usuń konto” z 30 dniami na cofnięcie**: konto oznaczone do usunięcia, użytkownik wylogowany, przy logowaniu w ciągu 30 dni widzi informację z przywróceniem, po 30 dniach pg_cron trwale usuwa konto (`auth.users` → kaskada).

## Makiety (wiążące w sprawach wyglądu)

Kopie w `docs/design/mockups`, arkusz klas `coss/coss.css`. Przy implementacji czytaj inline-style i `<script data-dc-script>` (dane, stany, teksty), nie tylko tekst.

| Makieta | Co pokazuje |
|---|---|
| `S2Settings.dc.html` | Ogólne: Profil, Cele, **Konto** (E-mail ze zmianą przez link, Hasło do konta, Sesja z „Wyloguj”), **Usuń konto** (czerwona ramka, wpisanie USUŃ) |
| `S2SettingsAccount.dc.html` | Konto i bezpieczeństwo: „Zmień hasło do konta”, „Sesje” z „Wyloguj wszystkie inne”, „Eksport danych” |
| `S2SettingsNotifications.dc.html` | Powiadomienia: push na tym urządzeniu, 3 rodzaje, cicha noc, „Wyślij testowe”, „Urządzenia”, „Przypomnienia nawyków” |
| `S2Vault.dc.html` | Hasła przy zamkniętym sejfie: cała treść modułu pod nakładką `rgba(255,255,255,.6)` + `backdrop-filter: blur(3px)`, okno „Odblokuj sejf” |
| `S2VaultSetup.dc.html`, `S2VaultReset.dc.html` | Dla spójności (bez zmian w tym projekcie) |

Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots S2Settings S2SettingsAccount S2SettingsNotifications S2Vault`.

## Stan obecny (zbadany)

- `src/app/(app)/ustawienia/[zakladka]/page.tsx`: Ogólne = Profil, Cele, Kosz; Kategorie; Sejf = `VaultCard`; „konto” i „powiadomienia” pokazują kartę „Ta zakładka powstanie w kolejnym etapie.”.
- `src/features/settings/settings-tabs.tsx`: zakładki `ogolne | konto | sejf | powiadomienia | kategorie`; tylko Ogólne ma `description`.
- `src/features/passwords/passwords-view.tsx`: przy `zablokowany` tabela jest ukryta (`hidden`), tytuł z ikoną i plakietki widać ostro, karta `VaultUnlockCard` stoi pod spodem. Komórki sekretów przy zamkniętym sejfie już pokazują „zablokowane” (`secret-table-cell.tsx`).
- `notification_settings` (`20261117000001_onboarding.sql`, `before_block_min` nullable od `20261117000002`): `push_enabled`, `before_block_min` (5/10/15/30, null = wył.), `renewals_enabled`, `renewal_days_before` (3), `renewal_hour` (9), `weekly_summary`, `weekly_summary_at`, `habits_enabled` (false), `quiet_enabled`, `quiet_from`, `quiet_to`. Onboarding zapisuje `before_block_min: 10` albo `null` (`src/features/onboarding/actions.ts`) i tylko pyta o zgodę przeglądarki (bez subskrypcji push).
- `habits.remind_at time` istnieje (bez `last_reminded_on`). Harmonogramy: `habit_schedules` (`daily | weekdays | times_per_week`, `valid_from`), odhaczenia `habit_checks`.
- Bloki: `blocks.start_local timestamp` (czas ścienny), `timezone`, `recurrence jsonb {freq, byWeekday?, until?}`, `remind boolean`; wyjątki `block_exceptions (cancelled | modified, new_start_local, new_title)`. Logika rozwijania: `src/features/calendar/occurrences.ts`.
- Odnowienia: pola `page_fields.type = 'renewal'` (config `cycle_field_id`, `active_field_id`, `cycle`, `show_in_calendar`), logika `addCycle`/`rowCycle`/`rowActive` w `src/features/pages/fields.ts`.
- pg_cron jest już używany w migracjach (`rhytm-purge-trash` w `20261120120000_pages.sql`). pg_net i Vault jeszcze nie.
- Aplikacja nie ma klienta z kluczem tajnym (`SUPABASE_SECRET_KEY` używają tylko e2e). Proxy (`src/proxy.ts`) czyta `profiles.onboarded_at` przy każdym żądaniu, przekierowania liczy `src/lib/auth/route-guard.ts`.
- Linki z maili idą przez `src/app/auth/confirm/route.ts` (`TYPY = signup | email | recovery`), szablony w `supabase/templates`, `double_confirm_changes = true`.
- Wszystkie klucze obce do `auth.users` mają `on delete cascade` (sprawdzone grepem migracji).

## Zakres

### A. Hasła przy zamkniętym sejfie (S2Vault)

- Przy `vault.status === "zablokowany"` moduł renderuje **całą treść** (nagłówek web z okruszkami, plakietki, pasek narzędzi, tabelę tylko do odczytu z „zablokowane” w sekretach), a nad nią **nakładkę** na cały obszar modułu (od górnej krawędzi nagłówka do dołu, bez paska bocznego): `bg-white/60 backdrop-blur-[3px]` (makieta: `rgba(255,255,255,.6)`, `blur(3px)`).
- Treść pod nakładką ma `inert` i `aria-hidden="true"` (nie da się w nią kliknąć ani wejść Tabem).
- **Wiersz tytułu (ikona kłódki + „Hasła”, 24 px) przy zamkniętym sejfie nie jest renderowany** (decyzja C1). Okruszki „Moduły / Hasła” w nagłówku zostają pod rozmyciem jak na makiecie.
- Okno „Odblokuj sejf” (`VaultUnlockCard`) leży nad nakładką: `position: absolute`, `top: 160px`, wyśrodkowane w obszarze modułu, szerokość `min(400px, 100% - 32px)`, `role="dialog"`, `aria-modal="true"`, `aria-labelledby` na tytuł. Pole hasła dostaje fokus po pojawieniu się okna. Treść okna bez zmian (jest zgodna z makietą).
- Telefon (< 800 px): ta sama nakładka na treść modułu, okno u góry (`top: 24px`). Dokładny CMVault należy do Etapu 3.
- Stany `ladowanie`, `brak`, `odblokowany`, `nieobslugiwany` bez zmian. Po odblokowaniu nakładka znika, wiersz tytułu wraca, tabela przechodzi w tryb edycji bez przeładowania (tabela jest stale zamontowana, jak dziś).
- Zmienia się decyzja zapisana w komentarzu `passwords-view.tsx` („tabela pojawia się dopiero po wpisaniu hasła”) — komentarz trzeba poprawić.

### B. Ogólne: karta „Konto” i zmiana e-maila (S2Settings)

Karta „Konto” wstawiana po „Cele”, przed „Kosz”. Wiersze `.row` (14 px pionowo, linia `rgba(0,0,0,.08)` między wierszami, `padding-top/bottom: 6px` w treści karty):

1. **E-mail**
   - podpis: `{email} · potwierdzony`; gdy `user.new_email` jest ustawione: `{email} · link potwierdzający wysłany na {new_email}`;
   - „Zmień” (`.btn`) → w wierszu pole `type=email` z placeholderem `nowy@adres.pl`, „Wyślij link” (primary) i „Anuluj” (ghost), jak w makiecie; błąd formatu: „To nie wygląda na adres e-mail.” (pokazywany po próbie wysłania);
   - Server Action `requestEmailChange(email)`: zod (`trim().toLowerCase()`, `z.email`), ten sam adres → „To już jest Twój adres.”, `supabase.auth.updateUser({ email })`; błędy: zajęty adres → „Ten adres jest już zajęty.”, limit → „Za dużo prób. Spróbuj za chwilę.”, inne → „Nie udało się wysłać linku. Spróbuj ponownie.”; sukces → `revalidatePath` i podpis z `new_email`;
   - pod formularzem po wysłaniu dopisek (`hint`): „Kliknij link w obu wiadomościach: na obecnym i na nowym adresie.” (bo `double_confirm_changes = true`, decyzja C5);
   - konto bez tożsamości `email` (tylko Google, `user.identities` bez `provider === "email"`): bez „Zmień”, podpis `{email} · konto Google` (decyzja C6).
2. **Hasło do konta**
   - podpis: `zmienione DD.MM.RRRR` z `user.user_metadata.password_changed_at` (ustawia je zmiana hasła z punktu C), bez tej daty: `ustawione przy rejestracji`; konto tylko Google: `brak — logujesz się przez Google`;
   - przycisk-link `.btn` „Zmień hasło” (konto Google: „Ustaw hasło”) → `/ustawienia/konto`.
3. **Sesja** z plakietką `Aktywna` (`StatusBadge` zielona)
   - podpis: `{Przeglądarka} · {System} · teraz` z nagłówka `user-agent` żądania (`describeUserAgent`, punkt „Wspólne”);
   - „Wyloguj” (`.btn` z ikoną `LogOut`) → istniejąca akcja `signOut` z `src/features/auth/actions.ts`.

Link z maila zmiany adresu:
- nowy szablon `supabase/templates/email_change.html` (styl jak `confirmation.html`): tytuł „Potwierdź zmianę adresu e-mail”, tekst z `{{ .Email }}` → `{{ .NewEmail }}`, przycisk do `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`; wpis `[auth.email.template.email_change]` w `supabase/config.toml` (temat „Potwierdź nowy adres e-mail w rhytm”);
- `src/app/auth/confirm/route.ts`: `TYPY` dostaje `email_change`, cel `/ustawienia/ogolne?email=potwierdzono`; błąd → `/link-wygasl?type=signup` jak dziś;
- Ogólne z `?email=potwierdzono`: zielony komunikat w wierszu E-mail: „Link potwierdzony.” (gdy `new_email` nadal ustawione: „Link potwierdzony. Kliknij jeszcze link na drugim adresie.”).
- Na produkcji szablon ustawia Mejson w panelu Supabase (Kroki Mejsona, punkt 4).

### C. Konto i bezpieczeństwo (S2SettingsAccount)

Nagłówek zakładki: sam `h2` „Konto i bezpieczeństwo” (makieta nie ma opisu — `SETTINGS_TABS` bez `description`, jak dziś).

**C1. Karta „Zmień hasło do konta”** (opis „Hasło do konta nie otwiera sejfu.”)
- Pola: „Obecne hasło” (`current-password`), w siatce 2 kolumn „Nowe hasło” (`new-password`) z 4 paskami siły i podpisem, „Powtórz” z podpisem „Hasła są takie same ✓” (zielony) / „Hasła się różnią” (czerwony).
- Siła i teksty dokładnie jak w skrypcie makiety: wynik = (długość ≥ 10) + wielka litera + cyfra + znak spoza `[A-Za-z0-9]`; kolory `['rgba(0,0,0,.08)', '#ef4444', '#f59e0b', '#eab308', '#15803d']`; podpis „{Za krótkie|Słabe|Średnie|Dobre|Mocne} hasło”, bez wpisu „10+ znaków, wielka litera, cyfra, znak”.
- Stopka: komunikat po lewej (13 px) i „Zmień hasło” (primary, `aria-disabled` aż wszystko poprawne). Komunikaty w kolejności z makiety: „Wpisz obecne hasło.”, „Nowe hasło: min. 10 znaków.”, „Nowe hasło musi różnić się od obecnego.”, „Hasła muszą być takie same.”, „Gotowe — wylogujemy inne urządzenia.” (zielony); bez wpisu: „Min. 10 znaków. Wylogujemy inne urządzenia.”; po sukcesie: „Hasło zmienione ✓ Inne urządzenia zostały wylogowane.” (zielony), pola czyszczone.
- Server Action `changePassword({ current, next, repeat })` w `src/features/settings/account-actions.ts`:
  1. `getUser()`; brak tożsamości `email` → „To konto loguje się przez Google. Ustaw hasło linkiem z maila.”;
  2. `newPasswordSchema` z `src/lib/auth/schemas.ts` (min. 10, litery i cyfry) + `next !== current`;
  3. `isPasswordPwned(next)` → „To hasło wystąpiło w wyciekach danych. Wybierz inne.”;
  4. `rpc("verify_my_password", { p_password: current })`: `false` → „Obecne hasło jest nieprawidłowe.”; wyjątek `za_duzo_prob` → „Za dużo nieudanych prób. Spróbuj za 15 minut.”; brak funkcji (stara baza, kod `PGRST202`) → „Zmiana hasła będzie dostępna za chwilę. Spróbuj później.”;
  5. `updateUser({ password: next, data: { password_changed_at: <ISO teraz> } })`; błąd → „Nie udało się zmienić hasła. Spróbuj ponownie.”;
  6. `signOut({ scope: "others" })`, `revalidatePath("/ustawienia/konto")`, `{ ok: true }`.
- Konto tylko Google: zamiast formularza karta „Ustaw hasło do konta”, opis „Logujesz się przez Google. Wyślemy link do ustawienia hasła na {email}.”, przycisk „Wyślij link” → akcja `sendSetPasswordLink()` (`resetPasswordForEmail(user.email, { redirectTo: <origin>/auth/confirm })`, bez Turnstile, bo użytkownik jest zalogowany) → „Link wysłany na {email}.” (decyzja C6). Dalej działa istniejący `/nowe-haslo`.

**C2. Karta „Sesje”**
- Nagłówek karty w wierszu: tytuł „Sesje”, opis z liczbą („1 aktywna sesja”, „2 aktywne sesje”, „5 aktywnych sesji”, 12–14 → „aktywnych”), po prawej `btn sm` „Wyloguj wszystkie inne” (`aria-disabled`, gdy brak innych).
- Wiersze `.nrow` (linia `rgba(0,0,0,.06)`): awatar 32 px z ikoną `Monitor` (komputer) albo `Smartphone` (telefon/tablet), tytuł `{Przeglądarka} · {System}`, podpis 13 px: bieżąca „teraz · ta sesja” + plakietka „Aktualna”; inne: ostatnia aktywność w strefie z profilu („dziś 08:02”, „wczoraj 21:14”, „12.11 08:02”) + `btng sm` „Wyloguj”. Bez miejscowości (decyzja C7).
- Pod listą stały tekst z makiety: „„Wyloguj wszystkie inne” kończy sesje na wszystkich pozostałych urządzeniach i przeglądarkach. Tu zostaniesz zalogowany.”; po akcji zielony `alert ok` (13 px): „Wylogowano: {Przeglądarka} · {System}” / „Wylogowano wszystkie inne urządzenia ✓”.
- Dane: `rpc("list_my_sessions")` po stronie serwera. Błąd (np. stara baza): jeden wiersz bieżącej sesji z nagłówka `user-agent`, przycisk „Wyloguj wszystkie inne” aktywny, pod listą „Nie udało się wczytać listy sesji.”.
- Akcje: `signOutOtherSessions()` → `signOut({ scope: "others" })`; `revokeSession(id)` → `rpc("revoke_my_session", { p_session_id })` (`false` → „Ta sesja już wygasła.”). Wylogowana sesja traci odświeżanie od razu, ale jej bieżący token dostępu działa do wygaśnięcia (do 1 h, `jwt_expiry = 3600`) — decyzja C8.

**C3. Karta „Eksport danych”** (opis „Wszystkie moduły i strony jako JSON. Sekrety zostają zaszyfrowane.”)
- Stopka: po lewej spinner + tekst 12 px (`num`), po prawej `.btn` z ikoną `Download`: „Pobierz .json” / „Pobierz ponownie”. Teksty: „ostatni eksport: nigdy” / „ostatni eksport: DD.MM.RRRR”, w trakcie „przygotowuję plik…”, po pobraniu „rhytm-export-RRRR-MM-DD.json · 2,4 MB · pobrano” (zielony), błąd „Nie udało się przygotować eksportu. Spróbuj ponownie.” (czerwony).
- Klient: `fetch("/api/eksport")` → `blob` → pobranie przez tymczasowy `<a download>`; nazwa z nagłówka `Content-Disposition`; rozmiar „340 KB” / „2,4 MB” (przecinek). Ostatni eksport w `localStorage` pod `rhytm-ostatni-eksport` (`{ name, size, at }`) — decyzja C9.
- Trasa `GET /api/eksport` (`src/app/api/eksport/route.ts`), sesja użytkownika (RLS), bez klucza tajnego:
  - brak sesji → 401 JSON;
  - tabele (stała lista w pliku; każda czytana stronami po 1000 wierszy przez `.order(<klucz>).range()`): `profiles`, `notification_settings`, `categories`, `blocks`, `block_exceptions`, `tasks`, `habits`, `habit_schedules`, `habit_checks`, `habit_notes`, `sleep_logs`, `workout_templates`, `workout_template_items`, `template_skips`, `sport_sessions`, `runs`, `exercises`, `gym_sets`, `pages`, `page_blocks`, `page_fields`, `page_rows`, `vaults`, `push_subscriptions` (tylko `id, label, enabled, created_at, last_seen_at` — bez kluczy urządzenia). Klucz sortowania sprawdź w migracjach (np. `id`, a dla tabel z kluczem złożonym pierwsza kolumna klucza);
  - błąd tabeli (np. `push_subscriptions` przed migracją) nie przerywa eksportu: nazwa trafia do `pominiete`;
  - JSON: `{ format: "rhytm-eksport", wersja: 1, utworzono: <ISO>, konto: { id, email }, tabele: { <nazwa>: [...] }, pominiete: [...] }`, wcięcie 2;
  - nagłówki: `Content-Type: application/json; charset=utf-8`, `Content-Disposition: attachment; filename="rhytm-export-RRRR-MM-DD.json"` (data w strefie profilu), `Cache-Control: no-store`;
  - sekrety: `page_rows.values` z polami Sekret i `vaults` (owinięty klucz) są już szyfrogramami — eksport ich nie odszyfrowuje. Zdjęcie profilowe nie wchodzi do eksportu (decyzja C10).
  - Przed pisaniem przeczytaj `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (Next 16 + cacheComponents).

**C4. Baza** — migracja `supabase/migrations/20261129100000_account_security.sql`, test `supabase/tests/account_security.test.sql`:
- `public.list_my_sessions()` → `table (id uuid, user_agent text, ip text, created_at timestamptz, last_active_at timestamptz, is_current boolean)`; `security definer`, `set search_path = ''`; czyta `auth.sessions` tylko `where s.user_id = (select auth.uid())` i `(s.not_after is null or s.not_after > now())`; `last_active_at = coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at)` (sprawdź typy kolumn w lokalnym `auth.sessions`); `is_current = s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid`; kolejność: bieżąca pierwsza, potem `last_active_at desc`; `ip` jako `host(s.ip)`.
- `public.revoke_my_session(p_session_id uuid) returns boolean`: `delete from auth.sessions as s where s.id = p_session_id and s.user_id = (select auth.uid()) and s.id is distinct from <bieżąca>`; zwraca, czy usunięto (refresh tokeny znikają kaskadą).
- `public.password_check_failures (user_id uuid not null references auth.users on delete cascade, failed_at timestamptz not null default now())` + indeks `(user_id, failed_at)`; RLS włączone, bez polityk, `revoke all` od `anon, authenticated`.
- `public.verify_my_password(p_password text) returns boolean`, `security definer`: brak `auth.uid()` → wyjątek `unauthorized`; ≥ 5 porażek w ostatnich 15 min → `raise exception 'za_duzo_prob'`; porównanie `u.encrypted_password = extensions.crypt(p_password, u.encrypted_password)` (pusty/null hash = `false`, konto Google); porażka → wiersz w `password_check_failures`; sukces → usuwa porażki użytkownika.
- Granty: `revoke execute ... from public, anon`, `grant execute ... to authenticated` dla trzech funkcji.
- pgTAP: lista zawiera tylko własne sesje, `is_current` z `request.jwt.claims.session_id`, sesja z `not_after` w przeszłości pominięta; `revoke_my_session` cudzej i bieżącej → `false` i sesja zostaje, własnej innej → `true` i znika; `verify_my_password` dobre/złe hasło (hash z `extensions.crypt('...', extensions.gen_salt('bf'))`), pusty hash → `false`, 5 porażek → 6. wywołanie rzuca `za_duzo_prob`, sukces czyści porażki; `anon` nie ma `execute`; `authenticated` nie czyta `password_check_failures`.
- Uwaga dla wykonawcy: jeśli `postgres` (właściciel funkcji) nie ma praw do `auth.sessions` w CI, test to pokaże — wtedy zatrzymaj się i opisz problem koordynatorowi (wariant awaryjny: bez „Wyloguj” pojedynczej sesji, decyzja C8).

### D. Usuwanie konta z 30 dniami na cofnięcie

**D1. Ogólne: karta „Usuń konto”** (ostatnia, ramka `rgba(239,68,68,.24)`, stopka `rgba(239,68,68,.04)` z linią `rgba(239,68,68,.16)`, jak w makiecie):
- opis (zmieniony względem makiety, decyzja C2): „Konto zostanie usunięte po 30 dniach razem ze stronami, sejfem i danymi modułów. Do tego czasu możesz je przywrócić, logując się. Zdjęcie profilowe usuwamy od razu.”;
- stan spoczynku: w stopce po prawej `btnd` „Usuń konto”; po kliknięciu: pole „Wpisz `USUŃ`, żeby potwierdzić” (etykieta czerwona, `kbd` jak w makiecie, placeholder „USUŃ”, `autocomplete="off"`), „Anuluj” i `btnd` „Usuń konto” (`aria-disabled` + `opacity:.64`, dopóki `trim().toUpperCase() !== "USUŃ"`);
- Server Action `requestAccountDeletion(word)` w `src/features/settings/account-actions.ts`: ponowne sprawdzenie słowa; `update profiles set deletion_requested_at = now()` (wartość i tak ustawia wyzwalacz); błąd (także stara baza) → „Nie udało się usunąć konta. Spróbuj ponownie.” i nic dalej; potem (błędy ignorowane): usunięcie własnych `push_subscriptions`, usunięcie pliku zdjęcia z bucketu `avatars` i `avatar_path = null` (jak `removeAvatar`), `signOut({ scope: "global" })`, `redirect("/logowanie?konto=usuniete")`.

**D2. Logowanie i ekran przywracania**
- `/logowanie?konto=usuniete`: nad formularzem komunikat (styl `alert`, informacyjny): „Konto oznaczone do usunięcia. Przez 30 dni możesz je przywrócić — wystarczy się zalogować.”.
- `src/proxy.ts`: zapytanie o profil `select("onboarded_at, deletion_requested_at")`; gdy błąd ma kod `42703` (brak kolumny — stara baza), drugie zapytanie `select("onboarded_at")` i `deletionRequestedAt = null`. Inny błąd jak dziś (`isOnboarded = null`).
- `resolveRoute` dostaje `deletionRequestedAt: string | null`. Zalogowany z ustawioną datą: każda trasa poza publicznymi (`PUBLICZNE`, `/auth/*`), `/konto-usuniete` i `/api/eksport` → przekierowanie `/konto-usuniete` (także `/`, ekrany konta, onboarding). `/konto-usuniete` bez daty (albo niezalogowany) → domyślna trasa (`/logowanie` dla niezalogowanego, `/dzis`/`/onboarding` dla zalogowanego).
- Strona `src/app/(auth)/konto-usuniete/page.tsx` (`AuthShell`, dane pod `connection()` + `Suspense`): tytuł „Konto czeka na usunięcie”, tekst „Konto {email} zostanie trwale usunięte {D MMMM RRRR} (30 dni od prośby o usunięcie). Do tego czasu możesz je przywrócić.”, przyciski: primary „Przywróć konto” (akcja `restoreAccount()` → `update profiles set deletion_requested_at = null` → `redirect("/dzis")`; błąd → „Nie udało się przywrócić konta. Spróbuj ponownie.”), `.btn` link „Pobierz dane (.json)” do `/api/eksport`, ghost „Wyloguj” (`signOut`). Mockupu brak — wygląd jak `link-wygasl` (decyzja C3).

**D3. Baza** — migracja `supabase/migrations/20261129110000_account_deletion.sql`, test `supabase/tests/account_deletion.test.sql`:
- `alter table public.profiles add column deletion_requested_at timestamptz;`
- wyzwalacz `profiles_deletion_guard` (`before update of deletion_requested_at on public.profiles`, funkcja `public.guard_deletion_requested_at()`, `set search_path = ''`): `null → wartość` ustawia `now()` (nie da się podać daty wstecz ani w przód); `wartość → inna wartość` zostawia starą; `wartość → null` (przywrócenie) przepuszcza.
- `public.purge_deleted_accounts() returns int`, `security definer`: `delete from auth.users as u using public.profiles as p where p.user_id = u.id and p.deletion_requested_at < now() - interval '30 days'`; `revoke execute from public, anon, authenticated`.
- pg_cron: `select cron.unschedule(j.jobid) from cron.job as j where j.jobname = 'rhytm-purge-accounts'; select cron.schedule('rhytm-purge-accounts', '41 3 * * *', 'select public.purge_deleted_accounts()');` (wzór z `20261120120000_pages.sql`).
- pgTAP: wyzwalacz (próba ustawienia daty sprzed roku daje ≈ `now()`, zmiana na inną datę zostawia starą, `null` działa, inne kolumny profilu dalej się aktualizują); `purge_deleted_accounts` usuwa konto z datą > 30 dni temu (w teście ustaw datę przy wyłączonym wyzwalaczu w transakcji testu: `alter table public.profiles disable trigger profiles_deletion_guard`) razem z danymi w kilku tabelach (kategorie, strona, nawyk, sejf), nie rusza konta z datą 29 dni temu ani bez daty, zwraca liczbę usuniętych; `authenticated` nie ma `execute`; zadanie `rhytm-purge-accounts` istnieje w `cron.job`.
- Inne funkcje pomijają konta oznaczone do usunięcia: wysyłka push (punkt F).

### E. Push: baza, service worker, subskrypcja urządzenia

**E1. Baza** — migracja `supabase/migrations/20261129120000_push.sql`, test `supabase/tests/push.test.sql`:
- `public.push_subscriptions`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `endpoint text not null unique`, `p256dh text not null`, `auth text not null`, `label text not null` (1–80 znaków), `enabled boolean not null default true`, `created_at timestamptz not null default now()`, `last_seen_at timestamptz not null default now()`; CHECK długości 1–1000 dla `endpoint/p256dh/auth`; indeks `(user_id)`.
- RLS: polityki `select`, `update`, `delete` tylko własne wiersze. Granty: `revoke all on public.push_subscriptions from anon, authenticated`; `grant select, delete on ... to authenticated`; `grant update (enabled) on ... to authenticated`. **Bez `insert`** — zapis tylko przez funkcję z listą dozwolonych serwerów push (jak w starym rhytm).
- `public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_label text) returns uuid`, `security definer` — ciało jak `save_push_subscription` w `/home/claude/mejsooon/rhytm/supabase/migrations/0004_habit_reminders.sql` (walidacja długości, `https://`, host z listy `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`, `*.push.apple.com`, `*.notify.windows.com`), z różnicami: `user_id uuid` z `auth.uid()`; etykieta przycięta do 80 znaków (pusta → „Przeglądarka”); ten sam endpoint **tego samego** użytkownika → aktualizacja kluczy, etykiety i `last_seen_at` (bez zmiany `enabled`); endpoint innego użytkownika → usunięcie jego wiersza i wstawienie nowego; zwraca id wiersza.
- Ujednolicenie ustawień do makiety (decyzja C4): `alter column before_block_min set default 5`, `update public.notification_settings as ns set before_block_min = 5 where ns.before_block_min is not null`; `alter column renewal_days_before set default 1`, `update ... set renewal_days_before = 1`.
- pgTAP: zapis z dozwolonym hostem, odrzucenie (`http://`, obcy host, `@`/port w hoście, za długie pola), przejęcie endpointu przez innego użytkownika, ponowny zapis tego samego użytkownika nie zmienia `enabled`; RLS (B nie widzi i nie zmienia wierszy A); `authenticated` nie ma `insert` ani `update` kolumny `endpoint`; `anon` nie ma `execute`; nowe wartości domyślne i znormalizowane wiersze.

**E2. Service worker** — `public/sw.js`: kopia `/home/claude/mejsooon/rhytm/public/sw.js` (zdarzenia `push` i `notificationclick`), tytuł domyślny „rhytm”, ikony `/icons/icon-192.png`, domyślny adres `/dzis`. W `next.config.ts` nagłówki dla `/sw.js`: `Content-Type: application/javascript; charset=utf-8`, `Cache-Control: no-cache, no-store, must-revalidate` (przewodnik `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`). `src/proxy.ts`: `sw.js` wykluczony w `matcher` (jak `manifest.webmanifest`).

**E3. Klient i akcje** — `src/features/notifications/`:
- `push-actions.ts` (Server Actions): `savePushDevice({ endpoint, p256dh, auth })` (etykieta liczona na serwerze z nagłówka `user-agent` przez `describeUserAgent`; błąd → „Nie udało się zapisać urządzenia.”), `removePushDevice(endpoint)` (usuwa własny wiersz), `setDeviceEnabled(id, enabled)`; walidacja zod (napisy 1–1000).
- `use-push-device.ts` (hook klienta, jedyne miejsce z logiką przeglądarki): stany `ladowanie | nieskonfigurowany | nieobslugiwany | ios-instalacja | zablokowany | wylaczony | wlaczony`:
  - `nieskonfigurowany`: brak `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY`;
  - `nieobslugiwany`: brak `serviceWorker` albo `PushManager`;
  - `ios-instalacja`: iPhone/iPad poza trybem `standalone`;
  - `zablokowany`: `Notification.permission === "denied"`;
  - przy starcie: `navigator.serviceWorker.getRegistration("/")` → `pushManager.getSubscription()`; jest subskrypcja → `savePushDevice` (odświeża klucze i `last_seen_at`) i stan `wlaczony` z `endpoint`;
  - `wlacz()`: `Notification.requestPermission()` → `register("/sw.js", { scope: "/", updateViaCache: "none" })` → `ready` → `subscribe({ userVisibleOnly: true, applicationServerKey })` (klucz base64url → `Uint8Array`, kod jak w starym `PushToggle.tsx`) → `savePushDevice`; błąd zapisu → `unsubscribe()` i komunikat;
  - `wylacz()`: `removePushDevice(endpoint)` → `unsubscribe()`;
  - zwraca `{ stan, endpoint, blad, zajety, wlacz, wylacz }`.
- `src/lib/user-agent.ts`: `describeUserAgent(ua: string | null): { label: string; mobile: boolean }` — jedna wspólna funkcja dla sesji (B, C2) i urządzeń (E3), decyzja C11. Przeglądarka: `Edg/` → Edge, `OPR/` → Opera, `Firefox/`/`FxiOS` → Firefox, `CriOS`/`Chrome/` → Chrome, `Safari/` → Safari, inaczej „Przeglądarka”. System: iPhone, iPad, Android, Windows, macOS (`Macintosh`), ChromeOS (`CrOS`), Linux, inaczej „nieznany system”. `label = "{Przeglądarka} · {System}"`, `mobile` dla iPhone, iPad i Android. Etykieta liczona jest na serwerze, więc bez dopisku „(PWA)” z makiety.
- `.env.example`: `NEXT_PUBLIC_VAPID_PUBLIC_KEY=`, `VAPID_PRIVATE_KEY=`, `VAPID_SUBJECT=`, `CRON_SECRET=` z polskimi komentarzami (bez wartości).

### F. Push: wysyłka (cron + trasa)

**F1. Baza** — migracja `supabase/migrations/20261129130000_push_dispatch.sql`, test `supabase/tests/push_dispatch.test.sql`:
- `create extension if not exists pg_net with schema extensions;` (`pg_cron` już jest).
- `public.push_log (user_id uuid not null references auth.users on delete cascade, kind text not null check (kind in ('habit','block','renewal')), ref text not null, for_date date not null, sent_at timestamptz not null default now(), primary key (kind, ref, for_date))`; RLS bez polityk, `revoke all` od `anon, authenticated`. Pilnuje, żeby każde przypomnienie poszło raz.
- `public.claim_due_notifications(p_now timestamptz)` → `table (endpoint text, p256dh text, auth text, kind text, title text, body text, tag text, url text)`, `security definer`, `set search_path = ''`, `execute` tylko właściciel. Jedno wywołanie wybiera wszystkie należne przypomnienia, wpisuje je do `push_log` (`insert ... on conflict do nothing returning`) i zwraca jeden wiersz na parę (przypomnienie, włączone urządzenie). Warunki wspólne użytkownika:
  - `profiles.deletion_requested_at is null`;
  - strefa profilu poprawna (`in (select name from pg_catalog.pg_timezone_names)`, strażnik w `CASE` jak w starej funkcji);
  - co najmniej jedno urządzenie z `enabled = true`;
  - ustawienia z `notification_settings` (brak wiersza = wartości domyślne kolumn);
  - **cicha noc**: gdy `quiet_enabled` i lokalny czas profilu jest w `[quiet_from, quiet_to)` (gdy `quiet_from > quiet_to`, przedział przechodzi przez północ), użytkownik jest pomijany **bez wpisu do `push_log`** (przypomnienie przepada, gdy okno minie w czasie ciszy — decyzja C12).
  - **Nawyki** (`kind = 'habit'`, `ref = habit_id`, `for_date` = lokalny dzień profilu): `habits_enabled`, `remind_at is not null`, lokalny czas w `[remind_at, remind_at + 15 min)` (liczone na znacznikach czasu, jak w starej funkcji), harmonogram obowiązujący dziś (największe `valid_from <= dziś`): `daily`; `weekdays` → `isodow = any(weekdays)`; `times_per_week` → odhaczeń w bieżącym tygodniu mniej niż `times_per_week` (tydzień liczony tak jak w `src/features/habits/model.ts` — sprawdź, czy od poniedziałku, czy od `profiles.week_start`); nawyk nieodhaczony dziś. Tytuł „rhytm”, treść „Pora na: {nazwa}”, `tag = 'habit-' || id`, `url = '/nawyki/' || id`.
  - **Start bloku** (`kind = 'block'`, `ref = block_id`, `for_date` = dzień wystąpienia): `before_block_min is not null`, `blocks.remind = true`, strefa bloku `blocks.timezone` poprawna; kandydaci: dzień lokalny (strefa bloku) z `p_now` i następny; wystąpienie jak w `src/features/calendar/occurrences.ts` (`start_local::date <= d <= coalesce(until, '9999-12-31')`, jednorazowy tylko w dniu startu, `daily`, `weekdays` = pn–pt, `weekly` = ten sam dzień tygodnia co start, `custom` = `byWeekday` zawiera `isodow`); wyjątek `cancelled` pomija, `modified` podmienia start (`new_start_local`) i tytuł (`new_title`); należne, gdy `start − before_block_min ≤ czas lokalny bloku < start − before_block_min + 5 min`. Tytuł „Za {N} min: {tytuł}”, treść „{HH:MM}–{HH:MM}”, `tag = 'block-' || id || '-' || d`, `url = '/kalendarz?widok=dzien&data=' || d`.
  - **Odnowienia** (`kind = 'renewal'`, `ref = row_id || ':' || field_id`, `for_date` = data odnowienia): `renewals_enabled`, lokalny czas profilu w `[renewal_hour:00, renewal_hour:15)`, data = lokalny dzień + `renewal_days_before`; pola `type = 'renewal'` na nieusuniętych stronach/blokach/wierszach użytkownika, z tym samym warunkiem widoczności co odnowienia w kalendarzu (sprawdź loader odnowień kalendarza, np. `show_in_calendar`); kotwica = `values ->> field_id` jako data ISO (niepoprawna → pomijana); cykl jak `rowCycle` (pole `cycle_field_id` typu `recurring` → jego `cycle` w wartości, potem `config.default_cycle`, potem `config.cycle`, domyślnie `month`); aktywność jak `rowActive` (`active_field_id` typu `checkbox` → wartość `true`, brak odwołania = aktywny); data D jest odnowieniem, gdy `k = (rok(D)*12 + mies(D)) − (rok(A)*12 + mies(A))`, `k >= 0`, `k % (1 | 12) = 0` i `dzień(D) = least(dzień(A), ostatni dzień miesiąca D)` (to samo co `addCycle`). Tytuł „Jutro odnowienie” (dla `renewal_days_before = 1`), treść „{tytuł wiersza}” + „ · {kwota} {zł|€|$|£}” gdy wiersz ma kwotę cykliczną (kwota z przecinkiem, 2 miejsca, waluta z `profiles.currency`), `tag = 'renewal-' || ref`, `url = '/strony/' || page_id`.
- `public.dispatch_notifications() returns int`, `security definer`: czyta z `vault.decrypted_secrets` `rhytm_cron_secret` i `rhytm_app_url`; gdy któregoś brak albo pusty → `return 0` **bez wywołania `claim`** (nic nie przepada przed konfiguracją); inaczej `claim_due_notifications(now())` i jedno `net.http_post(url := <app_url> || '/api/cron/powiadomienia', headers := {Content-Type, Authorization: Bearer <sekret>}, body := {"notifications": [...]}, timeout_milliseconds := 10000)` tylko gdy są wiersze; na końcu `delete from public.push_log as pl where pl.for_date < (now() at time zone 'UTC')::date - 7`; zwraca liczbę wierszy. `execute` tylko właściciel.
- `public.remove_push_subscriptions(p_secret text, p_endpoints text[]) returns int` — jak w starym rhytm (sprawdza sekret z Vault, `grant execute to anon`, `revoke` od reszty).
- pg_cron: `rhytm-powiadomienia`, `'* * * * *'`, `'select public.dispatch_notifications()'` (z `unschedule` przed `schedule`).
- pgTAP (stały `p_now`, strefa `Europe/Warsaw`): nawyk w oknie → wiersz na każde włączone urządzenie, drugi `claim` → nic; nawyk odhaczony / niezaplanowany dziś / `times_per_week` wyczerpany / `habits_enabled = false` / urządzenie `enabled = false` → nic; cicha noc przez północ pomija i nie wpisuje do `push_log`; blok jednorazowy 5 min przed → wiersz, 10 min przed → nic; seria `weekdays` w sobotę → nic; wyjątek `cancelled` → nic, `modified` → nowa godzina i tytuł; blok jutro o 00:03 przy `p_now` 23:58 → wiersz z jutrzejszą datą; odnowienie miesięczne z kotwicą 31.01 przypada 28.02 (rok nieprzestępny), roczne co 12 miesięcy, nieaktywny wiersz (checkbox `false`) → nic, wiersz w koszu → nic; konto z `deletion_requested_at` → nic; `dispatch_notifications()` bez sekretów zwraca 0 i nie zmienia `push_log`; `remove_push_subscriptions` ze złym sekretem rzuca `unauthorized`; `authenticated` nie ma `execute` na `claim`/`dispatch`; zadanie `rhytm-powiadomienia` istnieje.

**F2. Trasa** — `src/app/api/cron/powiadomienia/route.ts` + `route.test.ts`, wzór: `/home/claude/mejsooon/rhytm/src/app/api/cron/przypomnienia/route.ts` i jego test:
- `POST`, `Authorization` porównywany `timingSafeEqual` z `Bearer ${CRON_SECRET}` (brak sekretu → 401); body `{ notifications: [{ endpoint, p256dh, auth, kind, title, body, tag, url }] }` (zła postać → 400); brak VAPID (`VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) → 500 (dopiero po poprawnym tokenie);
- `webpush.sendNotification(sub, JSON.stringify({ title, body, tag, url }), { TTL: 3600, timeout: 10000 })` dla wszystkich (`Promise.allSettled`); 404/410 → endpoint do usunięcia przez `rpc("remove_push_subscriptions", { p_secret: CRON_SECRET, p_endpoints })` klientem `@supabase/supabase-js` z `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (bez sesji); w logach tylko status i origin;
- odpowiedź `{ sent, failed, removed }`; bez `export const runtime`;
- `resolveRoute`: prefiks `/api/cron/` publiczny (trasa sama sprawdza sekret).
- Zależności: `web-push` i `@types/web-push` (`pnpm add web-push`, `pnpm add -D @types/web-push`).

**F3. „Wyślij testowe”** — Server Action `sendTestPush()` w `src/features/notifications/actions.ts`: brak VAPID → `{ ok: false, message: "Push nie jest jeszcze skonfigurowany." }`; czyta własne urządzenia `enabled = true` (RLS); brak → „Włącz push i co najmniej jedno urządzenie, żeby wysłać test.”; wysyła `{ title: "rhytm", body: "Powiadomienia działają ✓", tag: "test", url: "/ustawienia/powiadomienia" }` (cicha noc nie dotyczy testu, decyzja C12); 404/410 → usuwa własny wiersz; wynik `{ ok: true, sent }` → „Wysłano testowe powiadomienie na {N} urządzenie/urządzenia/urządzeń ✓”.

### G. Zakładka Powiadomienia (S2SettingsNotifications)

Nagłówek: sam `h2` „Powiadomienia”. Trzy karty; wszystkie zapisy bez przycisku „Zapisz” (od razu, optymistycznie, z cofnięciem i komunikatem przy błędzie).

**G1. Karta główna** (bez nagłówka, treść `padding-top/bottom: 6px`, wiersze `.nrow`):
- „Push na tym urządzeniu” + przełącznik (`Switch` z `@/components/controls`) sterowany `usePushDevice`; podpisy: `wlaczony` → „{etykieta} · włączone DD.MM.RRRR” (z `created_at` urządzenia); `wylaczony` → „Wyłączone — nie dostaniesz żadnych powiadomień na tym urządzeniu”; `nieskonfigurowany` → „Push nie jest jeszcze skonfigurowany” (przełącznik wyłączony); `nieobslugiwany` → „Ta przeglądarka nie obsługuje powiadomień push”; `ios-instalacja` → „Na iPhonie push działa po dodaniu rhytm do ekranu głównego”; `zablokowany` → „Powiadomienia są zablokowane w ustawieniach przeglądarki”; błąd hooka pod spodem na czerwono.
- Trzy rodzaje (teksty z makiety): „Przypomnienia o nawykach” / „Wysyłane o godzinie ustawionej przy nawyku” (`habits_enabled`); „Start bloku w kalendarzu” / „5 minut przed rozpoczęciem bloku” (`before_block_min`: 5 ↔ null); „Odnowienia subskrypcji” / „Dzień przed odnowieniem, o 9:00” (`renewals_enabled`). Gdy push na tym urządzeniu nie jest `wlaczony`: wiersze `opacity:.55`, przełączniki `aria-disabled` i pokazane jako wyłączone (jak makieta), zapisane wartości się nie zmieniają (decyzja C13).
- „Cicha noc” z ikoną `Moon`: podpis „Bez powiadomień {od}–{do}” / „Wyłączona — powiadomienia przychodzą całą dobę”; przy włączonej dwa `TimePicker` (kontrolka `@/components/controls/time-picker.tsx`, siatka 24 godzin + 12 minut co 5, „Gotowe”, jak w makiecie) „Cicha noc od” i „Cicha noc do” rozdzielone „–”, potem przełącznik (`quiet_enabled`, `quiet_from`, `quiet_to`).
- Stopka: po lewej `role="status"` 13 px: wynik testu (zielony) albo „Na iPhonie push działa po dodaniu rhytm do ekranu głównego.” (gdy test możliwy) / „Włącz push i co najmniej jedno urządzenie, żeby wysłać test.”; po prawej `btn sm` z ikoną `Bell` „Wyślij testowe” (`aria-disabled`, gdy push tu nie jest `wlaczony` albo nie ma włączonych urządzeń).
- Server Action `saveNotificationSettings(patch)` w `src/features/notifications/actions.ts`: zod (`habits_enabled`, `before_block_min: 5 | null`, `renewals_enabled`, `quiet_enabled`, `quiet_from`/`quiet_to` w formacie `HH:MM` z minutami co 5) → `upsert` z `onConflict: "user_id"`; błąd → „Nie udało się zapisać. Spróbuj ponownie.”.

**G2. Karta „Urządzenia”**: wiersze `.nrow` (awatar 32 px z ikoną `Smartphone`/`Monitor` według `describeUserAgent`), tytuł = etykieta + plakietka „TO” (zielona) przy urządzeniu, którego `endpoint` jest równy bieżącej subskrypcji; podpis „ostatnio: {teraz | dziś HH:MM | wczoraj HH:MM | DD.MM HH:MM}” z `last_seen_at` albo „powiadomienia wyłączone”; przycisk „Wyłącz” (`btn sm`) / „Włącz” (`btnp sm`) → `setDeviceEnabled`. Pusta lista: „Brak urządzeń. Włącz push na tym urządzeniu powyżej.” (muted). Błąd odczytu (np. stara baza): „Nie udało się wczytać urządzeń.”.

**G3. Karta „Przypomnienia nawyków”**: wszystkie nawyki użytkownika w kolejności modułu Nawyki; tytuł = nazwa, podpis = opis bieżącego harmonogramu z `src/features/habits/text.ts` („codziennie”, „pn, śr, pt, nd”, „4× w tygodniu”); po prawej `TimePicker` z godziną (gdy przypomnienie włączone) albo plakietka „wyłączone” (szara), potem przełącznik „Przypomnienie: {nazwa}”. Wyłączenie = `remind_at = null`; włączenie = `20:30` (domyślna godzina okna nawyku, decyzja C14). Gdy push tu nie jest `wlaczony` albo „Przypomnienia o nawykach” wyłączone: wiersze `opacity:.55`, przełączniki `aria-disabled`, pokazane jako wyłączone. Brak nawyków: „Nie masz jeszcze nawyków.” + link „Przejdź do Nawyków” (`/nawyki`). Server Action `setHabitReminder(habitId, remindAt: "HH:MM" | null)` (RLS, `revalidatePath("/nawyki")` i bieżącej zakładki).

**G4. Strona**: `[zakladka]/page.tsx` dostaje komponenty serwerowe `Konto()` i `Powiadomienia()` (wzór `Ogolne()`: `connection()` + `Suspense`), dane: `notification_settings` (`maybeSingle`, brak = domyślne), urządzenia (`push_subscriptions` bez kluczy; błąd tolerowany), nawyki z bieżącym harmonogramem, strefa profilu.

### Wspólne

- `describeUserAgent` w `src/lib/user-agent.ts` (+ test) — jedyna nowa funkcja wspólna.
- Czas „dziś/wczoraj/DD.MM HH:MM” liczony w strefie z profilu (`safeTimezone`), w komponencie, który go wyświetla.
- Kolory i rozmiary z inline-stylów makiet; kontrolki z `@/components/controls` (`Card*`, `Button`, `StatusBadge`, `Switch`, `TimePicker`, `TextField`), ikony `lucide-react`.
- Testy e2e działają tylko w CI. Push w CI nie jest skonfigurowany (brak VAPID), więc e2e sprawdzają stan „Push nie jest jeszcze skonfigurowany” i zapis ustawień, a nie prawdziwą subskrypcję. Wysyłkę sprawdzają test trasy (Vitest, mocki `web-push`) i pgTAP.

## Kolejność wdrożenia i zgodność ze starą bazą

Cztery migracje (wszystkie dokładające; jedyna zmiana danych to `before_block_min` 10 → 5 i `renewal_days_before` 3 → 1 w ustawieniach powiadomień — nic nie jest usuwane):

| Plik | Zawartość |
|---|---|
| `20261129100000_account_security.sql` | sesje, weryfikacja hasła |
| `20261129110000_account_deletion.sql` | `deletion_requested_at`, wyzwalacz, `purge_deleted_accounts`, cron |
| `20261129120000_push.sql` | `push_subscriptions`, `save_push_subscription`, ustawienia domyślne |
| `20261129130000_push_dispatch.sql` | pg_net, `push_log`, `claim_due_notifications`, `dispatch_notifications`, `remove_push_subscriptions`, cron |

- **Migracje idą przed wdrożeniem kodu na Vercel**: po scaleniu i pushu `main`, w czasie budowania, w kolejności plików, przez konektor Supabase (`apply_migration`), potem poprawa wersji w `supabase_migrations.schema_migrations` według `CLAUDE.md`. Konektor pyta Mejsona o zgodę, więc migracje mogą poczekać — dlatego kod musi działać na starej bazie:
  - proxy: brak kolumny `deletion_requested_at` (kod `42703`) → zapytanie bez niej;
  - zmiana hasła: brak `verify_my_password` → komunikat „będzie dostępna za chwilę”;
  - sesje: błąd `list_my_sessions` → tylko bieżąca sesja z nagłówka;
  - usuwanie konta: błąd zapisu → komunikat, nic się nie dzieje;
  - eksport: brakująca tabela → `pominiete`;
  - push: brak tabeli/funkcji → komunikaty „Nie udało się zapisać urządzenia.” / „Nie udało się wczytać urządzeń.”; ustawienia powiadomień i przypomnienia nawyków działają (tabela i kolumny już są).
- Wysyłka działa dopiero po krokach Mejsona (VAPID na Vercel + sekrety w Vault). Do tego czasu `dispatch_notifications` nic nie robi, a przełącznik push pokazuje „Push nie jest jeszcze skonfigurowany”.

## Kroki Mejsona (bez wartości w czacie)

1. **Klucze VAPID** — w terminalu na swoim komputerze: `npx web-push generate-vapid-keys`. Wynik ma dwie linie: *Public Key* i *Private Key*.
2. **Sekret crona** — `openssl rand -base64 32` (PowerShell 7: `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`).
3. **Vercel** → projekt rhytm → *Settings* → *Environment Variables* (środowiska Production i Preview):
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = Public Key;
   - `VAPID_PRIVATE_KEY` = Private Key (zaznacz *Sensitive*);
   - `VAPID_SUBJECT` = `mailto:` + Twój adres e-mail (np. `mailto:ty@domena.pl`);
   - `CRON_SECRET` = sekret z punktu 2 (*Sensitive*);
   - potem *Deployments* → ostatnie wdrożenie produkcji → *Redeploy* (zmienne `NEXT_PUBLIC_*` wchodzą do kodu przy budowaniu).
4. **Supabase** → projekt `yazntcoocfxfxqqevxoh` → *Integrations* → *Vault* (albo *SQL Editor*), po wykonaniu migracji `20261129130000_push_dispatch.sql`:
   - sekret o nazwie `rhytm_cron_secret` = ta sama wartość co `CRON_SECRET` na Vercel;
   - sekret o nazwie `rhytm_app_url` = adres produkcji z `https://`, bez ukośnika na końcu;
   - w SQL Editor: `select vault.create_secret('<wartość>', 'rhytm_cron_secret');` i `select vault.create_secret('<adres>', 'rhytm_app_url');` (wartości wpisujesz tylko tam).
5. **Supabase** → *Authentication* → *Email Templates* → *Change Email Address*: temat „Potwierdź nowy adres e-mail w rhytm”, treść skopiowana z `supabase/templates/email_change.html`. W *Authentication* → *Providers* → *Email* zostaw włączone *Secure email change* (oba adresy potwierdzają).
6. **Sprawdzenie**: rhytm → Ustawienia → Powiadomienia → włącz push na komputerze i telefonie (iPhone: najpierw „Do ekranu początkowego”), „Wyślij testowe”. Po minucie od godziny przypomnienia nawyku powinno przyjść powiadomienie.

## Decyzje Claude (z kosztem pomyłki)

| # | Decyzja | Dlaczego | Koszt pomyłki |
|---|---|---|---|
| C1 | Przy zamkniętym sejfie wiersz tytułu „Hasła” nie jest renderowany; reszta (okruszki, plakietki, tabela) pod rozmyciem. Makieta ma tytuł pod rozmyciem, ale Mejson zgłosił, że tytuł mu przeszkadza | zgłoszenie Mejsona + polecenie zlecającego | niski: jedna linia (warunek renderowania) |
| C2 | Teksty „Usuń konto” mówią o 30 dniach i przywróceniu, przycisk „Usuń konto” zamiast „Usuń konto na zawsze” | makieta opisuje trwałe usunięcie, decyzja Mejsona nr 2 zmienia zachowanie | niski: teksty |
| C3 | Ekran `/konto-usuniete` po zalogowaniu (zamiast blokady logowania): użytkownik loguje się normalnie (hasło albo Google), proxy kieruje go na ekran z „Przywróć konto” | blokada logowania (`banned_until`) uniemożliwiłaby przywrócenie bez osobnej weryfikacji tożsamości | średni: inny przepływ przywracania |
| C4 | Ustawienia powiadomień ujednolicone do makiety: 5 min przed blokiem, dzień przed odnowieniem o 9:00 (migracja zmienia istniejące wartości) | makieta podaje stałe teksty bez wyboru | niski: przypomnienie 5 zamiast 10 min |
| C5 | Zmiana e-maila z potwierdzeniem na obu adresach (`double_confirm_changes`) | bezpieczniej przy przejętej sesji | niski: wyłączenie w panelu |
| C6 | Konta tylko z Google: bez zmiany e-maila; hasło ustawiane linkiem z maila (istniejący `/nowe-haslo`) | brak obecnego hasła do sprawdzenia; link potwierdza własność skrzynki | niski |
| C7 | Sesje bez miejscowości (makieta: „Polska”, „Lublin”) | wymagałoby zewnętrznej usługi geolokalizacji IP | niski |
| C8 | „Wyloguj” pojedynczej sesji przez funkcję usuwającą własny wiersz `auth.sessions`; token dostępu tej sesji działa do wygaśnięcia (≤ 1 h) | Supabase nie ma API do kończenia cudzej sesji z klienta; jeśli w CI okaże się, że `postgres` nie ma praw do `auth.sessions`, przycisk znika i zostaje tylko „Wyloguj wszystkie inne” | średni: do 1 h dostępu z wylogowanego urządzenia |
| C9 | „Ostatni eksport” pamiętany w przeglądarce (`localStorage`) | bez nowej kolumny; informacja pomocnicza | niski: inna przeglądarka pokaże „nigdy” |
| C10 | Eksport bez zdjęcia profilowego i bez kluczy urządzeń push | zdjęcie jest plikiem, klucze push są bezużyteczne poza przeglądarką | niski |
| C11 | Jedna wspólna funkcja `describeUserAgent` w `src/lib` | używana w trzech miejscach (Ogólne, Sesje, Urządzenia); kopie by się rozjechały | niski |
| C12 | Cicha noc odrzuca przypomnienia (nie odkłada ich na rano); test ignoruje ciszę | prostsze, zgodne z opisem „Bez powiadomień” | niski: zmiana warunku w `claim` |
| C13 | Rodzaje i przypomnienia nawyków są wyszarzone, gdy push na tym urządzeniu jest wyłączony, ale zapisane wartości zostają | makieta tak pokazuje; ustawienia są wspólne dla wszystkich urządzeń | niski |
| C14 | Wyłączenie przypomnienia nawyku czyści `remind_at`, włączenie ustawia 20:30 | bez nowej kolumny; 20:30 to domyślna godzina okna nawyku | niski |
| C15 | `notification_settings.push_enabled` i `weekly_summary` nie są używane przez wysyłkę | makieta ma przełącznik per urządzenie i nie ma podsumowania tygodnia | niski: podsumowanie jako osobny pakiet |
| C16 | Zdjęcie profilowe usuwane od razu przy prośbie o usunięcie konta | SQL nie może usuwać plików ze Storage, a cron działa w SQL; inaczej plik zostałby po usunięciu konta | niski: po przywróceniu trzeba wgrać zdjęcie ponownie |
| C17 | Weryfikacja obecnego hasła funkcją w bazie (`crypt` na `auth.users`) z limitem 5 prób / 15 min | nie tworzy dodatkowej sesji (jak `signInWithPassword`) i nie wymaga zmiany konfiguracji Auth | średni: gdyby Supabase zmienił format hashy, weryfikacja zwróci `false` (test pgTAP to wyłapie przy aktualizacji) |
| C18 | Strona `/konto-usuniete` pozwala pobrać eksport | ostatnia szansa na dane przed trwałym usunięciem | niski |

## Poza zakresem

- Telefon (CMSettings*, CMVault) — Etap 3.
- Podsumowanie tygodnia (push w niedzielę) — kolumny zostają, wysyłki nie ma.
- Zmiana częstotliwości przypomnień (5/10/15/30 min) w UI.
