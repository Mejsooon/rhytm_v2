# Instrukcja uruchomienia rhytm (krok po kroku)

Ta instrukcja jest dla Ciebie, Mejson. Każdy krok mówi, gdzie kliknąć, co skopiować i gdzie to wkleić.
Zamień `<projekt>` na nazwę projektu w Vercel (np. `rhytm`), czyli adres `https://<projekt>.vercel.app`.

Kolejność: 1 (lokalnie) możesz zrobić od razu. Kroki 2–6 to konta w zewnętrznych usługach, a 7–8 to przekazanie dostępu i sprawdzenie.

---

## 1. Lokalnie, bez żadnych kluczy

Do tego kroku nie potrzebujesz kont w internecie. Potrzebujesz Dockera (Supabase lokalnie działa w kontenerach).

1. Otwórz terminal w folderze projektu `rhytm_v2`.
2. Zainstaluj zależności: `pnpm i`
3. Uruchom lokalny Supabase: `supabase start` (pierwszy raz trwa kilka minut, bo pobiera obrazy).
4. Wypisz lokalne adresy i klucze: `supabase status`
5. Skopiuj plik z przykładem: `cp .env.example .env.local` (Windows PowerShell: `Copy-Item .env.example .env.local`).
6. Otwórz `.env.local` i uzupełnij:
   - `NEXT_PUBLIC_SUPABASE_URL` = wartość `API URL` z `supabase status` (zwykle `http://127.0.0.1:54321`),
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `Publishable key` (starsze CLI: `anon key`),
   - `SUPABASE_SECRET_KEY` = `Secret key` (starsze CLI: `service_role key`): potrzebny tylko testom e2e (zakładają konta testowe), sama aplikacja go nie używa,
   - klucze Turnstile zostaw testowe, które już są w pliku (`1x00000000000000000000AA` i `1x0000000000000000000000000000000AA`): zawsze przechodzą,
   - `NEXT_PUBLIC_SITE_URL` zostaw `http://localhost:3000`.
   - `RECOVERY_COOKIE_SECRET` = losowy sekret, wygeneruj: `openssl rand -base64 32` (bez niego reset hasła nie działa).
7. Uruchom aplikację: `pnpm dev` i wejdź na http://localhost:3000.
8. Maile (potwierdzenie konta, reset hasła) nie wychodzą do internetu. Otwórz skrzynkę testową Mailpit: http://127.0.0.1:54324 i kliknij link w mailu.
9. Testy e2e z logowaniem: `E2E_SUPABASE=1 pnpm test:e2e` (Windows PowerShell: `$env:E2E_SUPABASE=1; pnpm test:e2e`). Wymagają działającego lokalnego Supabase z punktu 3 i Mailpit. Bez `E2E_SUPABASE=1` uruchamia się tylko część bez sesji (pozostałe testy są pomijane).
10. Zatrzymanie lokalnego Supabase: `supabase stop`.

Logowanie przez Google nie działa lokalnie, dopóki nie zrobisz kroku 3 (to normalne).

---

## 2. Supabase (baza i konta użytkowników)

1. Wejdź na https://supabase.com/dashboard i zaloguj się.
2. Kliknij **New project**. Wybierz organizację, wpisz nazwę `rhytm`, wymyśl **Database password** (zapisz go w menedżerze haseł, nie w czacie).
3. W polu **Region** wybierz **Frankfurt (eu-central-1)**. Kliknij **Create new project** i poczekaj, aż projekt się utworzy.
4. Skopiuj dwie wartości (zapisz je w notatniku, wkleisz je w kroku 6):
   - **Project URL**: Project Settings (ikona zębatki, lewy dolny róg) → **Data API** (albo **API**) → pole *Project URL*,
   - **Publishable key**: Project Settings → **API Keys** → zakładka *Publishable and secret API keys* → klucz `sb_publishable_...`.

   Na tej samej stronie jest też **Secret key** (`sb_secret_...`). Aplikacja go nie potrzebuje, więc nie kopiuj go do Vercela; jest tajny, patrz krok 7.
5. Adresy aplikacji: lewe menu **Authentication** → **URL Configuration**:
   - **Site URL**: `https://<projekt>.vercel.app`
   - **Redirect URLs** → **Add URL**, po jednym adresie (każdy dodaj osobno):
     - `https://<projekt>.vercel.app/auth/callback`
     - `https://<projekt>.vercel.app/auth/confirm`
     - `http://localhost:3000/**`
   - Kliknij **Save changes**.
   - Wpis `http://localhost:3000/**` przydaje się tylko wtedy, gdy lokalna aplikacja łączy się z produkcyjnym Supabase. Jeśli pracujesz wyłącznie na lokalnym Supabase (krok 1), możesz go usunąć: linki z produkcyjnych maili nie będą wtedy mogły prowadzić na localhost.
6. Potwierdzanie e-maili: **Authentication** → **Sign In / Providers** (albo **Providers**) → **Email** → upewnij się, że **Enable Email provider** i **Confirm email** są włączone → **Save**.
7. Szablony maili: **Authentication** → **Emails** → zakładka **Templates**:
   - **Confirm sign up**: w polu *Subject* wpisz `Potwierdź swój e-mail w rhytm`, a w polu *Message body* skasuj całą treść i wklej zawartość pliku `supabase/templates/confirmation.html` z projektu. Kliknij **Save**.
   - **Reset Password**: *Subject* `Ustaw nowe hasło w rhytm`, treść z pliku `supabase/templates/recovery.html`. **Save**.
   - Linki w szablonach używają `{{ .SiteURL }}`, czyli adresu z punktu 5. Dlatego Site URL musi być ustawiony wcześniej.
8. Limity wysyłki maili: `email_sent = 100` w `supabase/config.toml` działa **tylko lokalnie** (testy e2e wysyłają dużo maili). Limity produkcji ustawiasz w Supabase → **Authentication** → **Rate Limits** (np. *Rate limit for sending emails*); plik `config.toml` ich nie zmienia.

---

## 3. Logowanie przez Google

1. Wejdź na https://console.cloud.google.com i zaloguj się kontem Google.
2. U góry kliknij listę projektów → **New project** → nazwa `rhytm` → **Create**. Upewnij się, że ten projekt jest wybrany.
3. Lewe menu (trzy kreski) → **APIs & Services** → **OAuth consent screen** (czasem **Google Auth Platform**) → **Get started**:
   - *App name*: `rhytm`, *User support email*: Twój e-mail,
   - *Audience*: **External**,
   - *Contact information*: Twój e-mail → zgódź się na zasady → **Create**.
4. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**:
   - *Application type*: **Web application**, nazwa `rhytm web`,
   - **Authorized redirect URIs** → **Add URI**: wklej adres callback z Supabase. Znajdziesz go tak: Supabase → **Authentication** → **Sign In / Providers** → **Google** → pole **Callback URL (for OAuth)**, przycisk kopiowania. Wygląda jak `https://<id-projektu>.supabase.co/auth/v1/callback`,
   - **Create**.
5. Pojawi się okno z **Client ID** i **Client secret**. Skopiuj oba.
6. Wróć do Supabase → **Authentication** → **Sign In / Providers** → **Google**: włącz **Enable Sign in with Google**, wklej **Client ID** i **Client Secret** → **Save**.
7. Dopóki aplikacja Google jest w trybie *Testing*, logować się mogą tylko konta dodane w **OAuth consent screen** → **Audience** → **Test users**. Dodaj tam swój adres Gmail. Publikacja aplikacji (przycisk *Publish app*) to osobna sprawa na później.

---

## 4. Cloudflare Turnstile (ochrona przed botami)

1. Wejdź na https://dash.cloudflare.com (załóż darmowe konto, jeśli nie masz).
2. Lewe menu → **Turnstile** → **Add widget** (albo **Add site**).
3. Wypełnij:
   - *Widget name*: `rhytm`,
   - **Hostname**: dodaj `<projekt>.vercel.app` oraz `localhost` (każdy osobno). `localhost` jest potrzebny tylko, gdy lokalna aplikacja używa produkcyjnych kluczy Turnstile; jeśli lokalnie pracujesz wyłącznie z kluczami testowymi z `.env.example`, możesz go usunąć,
   - **Widget Mode**: **Managed**.
4. Kliknij **Create**.
5. Skopiuj **Site Key** (publiczny) i **Secret Key** (tajny, patrz krok 7). Wkleisz je w kroku 6.

---

## 5. Resend (wysyłanie maili z produkcji)

Wbudowana poczta Supabase ma bardzo niski limit wysyłki, dlatego podłączamy Resend.

1. Wejdź na https://resend.com i załóż konto.
2. Lewe menu **API Keys** → **Create API Key** → nazwa `rhytm`, uprawnienie **Sending access** → **Add**. Skopiuj klucz `re_...` od razu (pokaże się tylko raz).
3. Na start nie masz własnej domeny, więc wysyłamy z adresu `onboarding@resend.dev`. **Ograniczenie: z tego adresu Resend wysyła tylko na adres e-mail, na który zarejestrowałeś konto Resend.** Maile do innych osób (np. Patrycji albo testowych kont) nie dojdą, dopóki nie zweryfikujesz własnej domeny w Resend → **Domains** → **Add Domain** (trzeba dodać rekordy DNS u rejestratora domeny). Do testów na sobie to wystarcza.
4. W Supabase: **Authentication** → **Emails** → zakładka **SMTP Settings** → włącz **Enable custom SMTP** i wpisz:
   - *Sender email*: `onboarding@resend.dev`
   - *Sender name*: `rhytm`
   - *Host*: `smtp.resend.com`
   - *Port number*: `465`
   - *Username*: `resend`
   - *Password*: klucz API z Resend (`re_...`)
5. Kliknij **Save**.

---

## 6. Vercel (publikacja aplikacji)

1. Wejdź na https://vercel.com i zaloguj się przez GitHub.
2. **Add New...** → **Project** → na liście repozytoriów znajdź `Mejsooon/rhytm_v2` → **Import**. (Jeśli go nie widać: **Adjust GitHub App Permissions** i daj Vercelowi dostęp do tego repozytorium.)
3. *Framework Preset*: Next.js (wykryje się sam). Nie zmieniaj komend budowania.
4. Rozwiń **Environment Variables** i dodaj po jednej zmiennej (Name, Value, **Add**):

   | Name | Value (skąd) |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL z kroku 2 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key z kroku 2 |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site Key z kroku 4 |
   | `TURNSTILE_SECRET_KEY` | Secret Key z kroku 4 |
   | `NEXT_PUBLIC_SITE_URL` | `https://<projekt>.vercel.app` (bez ukośnika na końcu) |
   | `RECOVERY_COOKIE_SECRET` | nowy losowy sekret: `openssl rand -base64 32` (inny niż lokalny; podpisuje ciasteczko resetu hasła) |

   `SUPABASE_SECRET_KEY` **nie dodawaj** do Vercela: aplikacja go nie używa (potrzebują go tylko lokalne testy e2e), a każdy tajny klucz mniej na serwerze to mniejsze ryzyko.

   Uwaga: zmienne zaczynające się od `NEXT_PUBLIC_` są wbudowywane w aplikację **podczas budowania**. Jeśli zmienisz którąś później, musisz zrobić **Redeploy** (Deployments → trzy kropki przy ostatnim wdrożeniu → *Redeploy*), samo zapisanie nie wystarczy.
5. Kliknij **Deploy** i poczekaj na zielony ekran. Adres projektu (np. `rhytm-xxxx.vercel.app`) widać na górze. Jeśli różni się od `<projekt>.vercel.app`, popraw go w Site URL / Redirect URLs (krok 2), w domenach Turnstile (krok 4) i w `NEXT_PUBLIC_SITE_URL`, a potem zrób Redeploy.
6. Dopiero teraz (po pierwszym wdrożeniu) połącz bazę. W terminalu w folderze projektu:
   - `supabase login` (otworzy przeglądarkę),
   - `supabase link --project-ref <ref>`: `<ref>` to ciąg liter z adresu projektu w Supabase (`https://supabase.com/dashboard/project/<ref>`); poprosi o Database password z kroku 2,
   - `supabase db push`: wgrywa tabele i zabezpieczenia (migracje) do bazy produkcyjnej.

---

## 7. Przekazanie dostępu Claude'owi: co wolno wkleić, czego nie

**Możesz wkleić w czacie** (są publiczne albo bezpieczne):
- Project URL Supabase, Publishable key (`sb_publishable_...`), Site Key Turnstile, adres `https://<projekt>.vercel.app`, Callback URL z Supabase.

**Nigdy nie wklejaj w czacie** (wpisz je tylko sam w Vercel / Supabase / `.env.local`):
- **Secret key Supabase** (`sb_secret_...`) i Database password,
- **Secret Key Turnstile**,
- **`RECOVERY_COOKIE_SECRET`**,
- **API key Resend** (`re_...`) i **Client secret Google**,
- zawartość `.env.local` w całości.

Jeśli taki klucz przypadkiem trafi do czatu lub na GitHub, uznaj go za ujawniony: wygeneruj nowy w danej usłudze, wpisz go w Vercel i zrób Redeploy.

Plik `.env.local` jest ignorowany przez git i nie trafia do repozytorium. Nie zmieniaj tego.

---

## 8. Sprawdzenie na produkcji: co powinieneś zobaczyć

Otwórz `https://<projekt>.vercel.app` w oknie incognito.

- [ ] Strona główna przenosi Cię na **/logowanie** (ekran „Zaloguj się do rhytm”).
- [ ] **Rejestracja**: /rejestracja → imię, e-mail (ten, na który masz konto Resend, patrz krok 5), hasło min. 10 znaków z literami i cyframi, zgoda na regulamin → „Utwórz konto” → ekran **„Sprawdź skrzynkę”**.
- [ ] W skrzynce jest mail „Potwierdź swój e-mail w rhytm”. Przycisk w mailu prowadzi na **„E-mail potwierdzony”**, a „Dalej” na tymczasowy ekran onboardingu, potem na **/dzis** z sidebarem (komputer) albo dolnym paskiem (telefon).
- [ ] **Wylogowanie**: u dołu sidebara kliknij swoje imię → „Wyloguj się” → wracasz na /logowanie.
- [ ] **Google**: na /logowanie „Zaloguj się przez Google” → wybór konta (musi być na liście Test users, krok 3.7) → lądujesz w aplikacji.
- [ ] **Reset hasła**: /logowanie → „Nie pamiętasz hasła?” → e-mail → „Sprawdź skrzynkę” → mail „Ustaw nowe hasło w rhytm” → link → „Ustaw nowe hasło” → „Zapisz i zaloguj się” → /dzis.
- [ ] Ten sam link z maila kliknięty drugi raz pokazuje **„Link wygasł”** i przycisk „Wyślij nowy link”.
- [ ] Zły adres, np. `/xyz`, pokazuje **„Tej strony nie ma”**.
- [ ] **/regulamin** i **/prywatnosc** otwierają się bez logowania (na razie z napisem „[TREŚĆ DO UZUPEŁNIENIA]”).

Jeśli coś się nie zgadza, wklej Claude'owi dokładny komunikat i adres strony (bez kluczy, patrz krok 7).
