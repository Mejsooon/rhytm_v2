# Ustawienia i kosz (pakiet „Ustawienia, kosz i nowe ekrany”, część A)

## Po co
Web jest za kanwą. Makiety `S2Settings`, `S2SettingsAccount`, `S2SettingsCalendar`, `S2SettingsVault`, `S2SettingsNotifications`, `S2Trash` są wiążące, razem z ich skryptami. Tylko web.

## Decyzje Mejsona (2026-11-27)
- Podział: A) Ustawienia i Kosz, B) nowe ekrany, C) onboarding (kolejność A → B → C).
- Karta „Wygląd i region” w całości odłożona.
- „Klucz odzyskiwania” sejfu: osobny etap.
- Onboarding (część C): bez kroku podłączania zewnętrznych kalendarzy.

## Zakres

### Nawigacja i układ
Grupy „Konto” (Ogólne, Konto i bezpieczeństwo, Powiadomienia) i „Moduły” (Kalendarz, Sejf); opisy zakładek z makiet. „Plan i płatności” dojdzie w swoim pakiecie.

### Ogólne
Profil i Cele jak dziś (dopasowane teksty), karta „Kosz” z przyciskiem „Otwórz kosz (n)” i linijka „E-mail, hasło, sesje i usunięcie konta są w Konto i bezpieczeństwo →”.

### Konto i bezpieczeństwo
Karty: E-mail (osobna), hasło, sesje, eksport, usunięcie konta. To istniejące karty, przeniesione i dopasowane; karta „Konto” z Ogólnych znika (wylogowanie zostaje w menu użytkownika).

### Kosz (`/ustawienia/kosz`)
Lista usuniętych stron i wierszy (rodzaj, data, ile dni zostało), „Przywróć” i „Usuń na zawsze”, toast, pusty stan, podpis z makiety bez wzmianki o ⌘K (dojdzie w B). Przywrócona strona wraca na koniec listy w pasku bocznym. Link na stronie 404 prowadzi tutaj. Karta kosza z Ogólnych znika.

### Sejf
- Karta stanu: „N haseł · szyfrowanie AES-256 na Twoim urządzeniu”, „Otwórz Hasła”, „Zablokuj teraz”. Stany „brak sejfu” i „zablokowany” działają jak dziś.
- „Blokada i schowek”: automatyczna blokada 1 / 5 / 15 min / 1 h; czyszczenie schowka po 30 s (wł./wył.); „Pytaj o hasło przy podglądzie”.
- Zmiana hasła głównego i „Zresetuj sejf…” (słowo RESETUJ) w układzie makiety. Reguły siły hasła bez zmian.

### Kalendarz i Powiadomienia
Funkcje już są; tylko teksty, nagłówki i stopki według makiet.

## Podejścia

**Gdzie trzymać ustawienia sejfu**
- **Kolumny w `profiles` (wybrane):** działają na każdym urządzeniu, jak reszta ustawień; wymaga migracji.
- `localStorage`: bez migracji, ale osobno na każdej przeglądarce i znika po czyszczeniu danych.

**„Blokuj po zamknięciu karty”**
Dziś klucz sejfu żyje tylko w pamięci karty, więc zamknięcie karty zawsze blokuje sejf.
- **Wiersz informacyjny, zawsze włączony, bez przełącznika (wybrane).**
- Pominąć wiersz.
- Prawdziwy przełącznik: trzeba by zapisywać klucz w przeglądarce, czyli osłabić sejf. Odradzam.

**Usunięcie na zawsze**
- **Okno potwierdzenia (wybrane):** zgodnie z zasadami z `S2Feedback` dla stron; nieodwracalne.
- Od razu z toastem, jak w skrypcie `S2Trash`.

## Migracja (Mejson, przed scaleniem)
`profiles.vault_lock_min smallint not null default 5` (1, 5, 15, 60), `profiles.vault_clear_clipboard boolean not null default true`, `profiles.vault_ask_on_reveal boolean not null default false`, test pgTAP. Niczego nie usuwa. Usuwanie z kosza nie wymaga migracji.

## Poza zakresem
Telefon (ustawienia sejfu działają też tam, ekrany bez zmian), Wygląd i region, klucz odzyskiwania, Plan i płatności, dzwonek, Pomoc i opinie, ⌘K.

## Decyzje Claude'a (do potwierdzenia)
| Decyzja | Koszt pomyłki |
|---|---|
| „Pytaj o hasło” dotyczy podglądu i kopiowania sekretu (inaczej kopiowanie omija pytanie) | dodatkowe wpisywanie przy kopiowaniu |
| „Pytaj o hasło” to zabezpieczenie przed kimś przy odblokowanym komputerze, nie dodatkowe szyfrowanie | brak; klucz i tak jest w pamięci |
| Usunięcie strony z kosza usuwa też jej wiersze na zawsze (kaskada), bez „Cofnij” | brak odzyskania po potwierdzeniu |
| Nowy układ Ustawień na telefonie: te same zakładki w indeksie, nowe karty w nich bez osobnych makiet telefonu | telefon dopracujemy w pakiecie Telefon |

## Co zostaje dla wykonawcy
Układ plików i nazwy; testy nowych akcji (usunięcie na zawsze, przywrócenie na koniec, ustawienia sejfu), e2e dla kosza.
