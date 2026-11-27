# Nowe ekrany, część B1: ⌘K, 404/500, Pomoc i opinie, błędy logowania

## Po co
Kanwa ma ekrany, których aplikacja nie ma albo ma w uproszczeniu. Makiety `S2CommandK`, `S2NotFound`, `S2ServerError`, `S2Help`, `S2LoginError` i pozycja „Pomoc i opinie” w `S2Sidebar` są wiążące razem ze skryptami. Tylko web (od 800 px).

## Decyzje Mejsona (2026-11-27)
- Podział części B: **B1** (ten dokument), potem **B2** (centrum powiadomień i dzwonek). B2 pokaże tylko trzy przypomnienia: bloki, nawyki, odnowienia.
- Opinie i zgłoszenia błędów trafiają do tabeli w Supabase.
- Bez licznika prób i blokady konta przy logowaniu.

## Zakres

### Okno ⌘K
- ⌘K / Ctrl+K, pole „Szukaj…” i lupa w pasku bocznym oraz „Szukaj” na 404 otwierają okno nad bieżącym ekranem. Esc i klik w tło zamykają; ↑ ↓ wybierają, ↵ otwiera.
- Puste pole: „Ostatnio” (ostatnio otwarte wyniki, zapis w przeglądarce) i „Akcje”.
- Po wpisaniu (od 2 znaków): grupy Strony, Wiersze stron, Kalendarz, Sport (także szablony i ćwiczenia), Nawyki i sen, Przejdź do, Akcje; na końcu „Szybko dodaj „…””. Trafiony fragment pogrubiony. „Brak wyników”, gdy nic nie pasuje.
- Sejf nie jest przeszukiwany (jak dziś).
- Telefon bez zmian: dalej ekran `/szukaj`.

### 404 i 500
- 404: „Szukaj ⌘K” zaczyna działać.
- 500: nowy ekran z kodem błędu, „Odśwież”, „Zgłoś błąd” (otwiera formularz z dołączonym kodem) i „Wróć do Dziś”. W aplikacji z paskiem bocznym; gdy zawiedzie sama powłoka, ten sam ekran bez paska.

### Pomoc i opinie
- Pozycja na dole paska bocznego (także na szynie) z menu: Skróty klawiszowe, Co nowego, Pierwsze kroki n / 6, Wyślij opinię, Zgłoś błąd, wersja, Regulamin, Prywatność.
- Skróty: lista z makiety; `?` otwiera ją poza polami tekstowymi; ⌘⇧K zaczyna działać na każdym ekranie, nie tylko na Dziś.
- Co nowego: stała lista w kodzie.
- Pierwsze kroki: otwiera Dziś i przywraca schowaną kartę.
- Formularz: Pomysł / Błąd / Inne, treść, zgoda na kontakt; przy błędzie dołącza ekran, przeglądarkę, wersję i ewentualny kod błędu. Potem „Dzięki, dostaliśmy to”.

### Błędy logowania
Czerwone obramowanie pól przy złym haśle; przy limicie Supabase komunikat „Za dużo prób, spróbuj za chwilę.” zamiast „Nieprawidłowy e-mail lub hasło”.

## Migracja (Mejson, przed scaleniem)
`public.feedback`: `user_id` (usuwane z kontem), `kind` (`idea`/`bug`/`other`), `message` (1–4000 znaków), `context` (jsonb: ekran, przeglądarka, wersja, kod błędu), `contact`, `created_at`. RLS: zalogowany tylko dodaje własne wiersze, niczego nie czyta. Test pgTAP. Niczego nie usuwa.

## Podejścia

**Okno ⌘K**
- **Jedno okno w powłoce, na istniejącej akcji `searchAll` rozszerzonej o brakujące grupy (wybrane):** jedno źródło wyników dla webu i telefonu.
- Osobne wyszukiwanie tylko dla okna: dwie logiki do utrzymania.
- Indeks całej zawartości w przeglądarce: szybsze wpisywanie, ale pobiera wszystko przy starcie.

**Skąd 500 bierze kod**
- **`error.digest` z Next.js (wybrane):** ten sam kod jest w logach Vercel.
- Własny losowy kod: nie da się go znaleźć w logach.

## Decyzje Claude'a (do potwierdzenia)
| Decyzja | Koszt pomyłki |
|---|---|
| Bez „Centrum pomocy” (`rhytm.pl`): nie ma takiej strony w projekcie | brak pozycji do czasu powstania strony |
| Bez zdania „Odpowiadamy z kontakt@rhytm.pl”: nie wiem, czy ta skrzynka istnieje | jedno zdanie do dopisania |
| Wersja z `package.json` (dziś 0.1.0), nie „3.0” z makiety | zmiana numeru w jednym miejscu |
| „Co nowego” bez plakietki „Nowe” po pierwszym otwarciu | brak |
| Przy akcjach bez skrótów „B” i „N”: w polu tekstowym litera byłaby wpisywana | brak dwóch plakietek |
| Teksty bez form rodzajowych („Jeśli kontakt był zaznaczony…”, „Np. widok tablicy w Projektach…”) | brak |
| Brak limitu liczby zgłoszeń na konto (tylko limit długości) | ktoś zalogowany może zaśmiecić tabelę |

## Poza zakresem
Telefon, dzwonek i centrum powiadomień (B2), onboarding (C), karta planu w pasku bocznym, licznik prób logowania, zasady z `S2Feedback` (toasty, pasek offline, szkielety) — osobny przegląd.

## Co zostaje dla wykonawcy
Układ plików i nazwy; testy (okno ⌘K z klawiaturą, formularz opinii i RLS, komunikaty logowania), e2e.
