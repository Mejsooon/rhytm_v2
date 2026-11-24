# Dokończenie webu: Ustawienia i zablokowany sejf — krótki projekt

Data: 2026-11-24. Decyzje Mejsona z rozmowy 2026-11-24 (pytania z wyborem). Przed Etapem 3 (telefon).

## Cel i powód

Mejson chce domknąć web przed pracą nad telefonem. Zakładki Ustawień „Konto i bezpieczeństwo” i „Powiadomienia” są puste, w „Ogólne” brakuje karty Konto, a zablokowany moduł Hasła nie wygląda jak makieta S2Vault.

Makiety wiążące: S2Settings, S2SettingsAccount, S2SettingsNotifications, S2Vault (kanwa „Rhytm Design”, kopie w `docs/design/mockups`).

## Zakres

### 1. Zablokowany sejf (S2Vault) — decyzja: „jak S2Vault, tytuł też rozmyty”
- Przy zamkniętym sejfie cała strona `/hasla` (tytuł „Hasła”, plakietki, pasek, tabela) leży pod rozmyciem, a karta „Odblokuj sejf” stoi na środku nad nią.
- Pod rozmyciem tabela pokazuje jawne kolumny, sekrety jako „zablokowane” (nic nie jest odszyfrowane). Wszystko pod spodem nieklikalne i niedostępne z klawiatury (`inert`).
- Zastępuje wczorajszą decyzję „sama karta na białej stronie”: zaktualizować spec Stron 2.0 (pkt 4), `passwords-view.tsx`, testy jednostkowe i `e2e/sejf.spec.ts`.
- Tabela zostaje zamontowana przez cały czas (po odblokowaniu wraca z wierszami z bieżącej sesji — błąd znaleziony 23.11).

### 2. Ogólne — karta Konto (S2Settings)
- E-mail ze zmianą (link potwierdzający Supabase), „Hasło do konta” z przejściem do zmiany hasła, bieżąca sesja z „Wyloguj”, „Usuń konto” z potwierdzeniem wpisaniem `USUŃ`.

### 3. Konto i bezpieczeństwo (S2SettingsAccount) — decyzja: „wszystko z makiety”
- Zmiana hasła do konta: obecne hasło, nowe z paskiem siły, powtórzenie; dopisek „Hasło do konta nie otwiera sejfu”.
- Sesje: lista sesji z wylogowaniem pojedynczej i „Wyloguj wszystkie inne”. Wymaga funkcji w bazie (SECURITY DEFINER, tylko własne sesje z `auth.sessions`) → migracja z testem pgTAP, `db push` robi Mejson.
- Eksport danych: wszystkie moduły i strony jako JSON, sekrety zostają zaszyfrowane.
- Usuwanie konta: trwałe, kasuje konto i wszystkie dane (kaskady), wymaga funkcji w bazie albo akcji z kluczem serwisowym — do rozstrzygnięcia w planie z oceną bezpieczeństwa.

### 4. Powiadomienia (S2SettingsNotifications) — decyzja: „ekran i zapis, push później”
- Zakładka wygląda jak makieta i zapisuje ustawienia w `notification_settings` (push wł./wył., cicha noc, przypomnienia nawyków, rodzaje powiadomień).
- Bez wysyłki push: brak service workera, kluczy VAPID i crona. „Wyślij testowe” i lista urządzeń — do decyzji w planie (wyłączone z podpisem „wkrótce” albo ukryte).
- Wysyłka push to osobny, późniejszy etap.

## Poza zakresem
- Wysyłka powiadomień push, service worker, urządzenia.
- Wygląd telefonu (Etap 3).

## Proces
- Ryzykowne części (sesje, usuwanie konta, migracja) przez SDD z przeglądem bezpieczeństwa; reszta oszczędnie.
- Rekomendowany start w nowym czacie: przeczytać ten spec, makiety i kod `src/features/settings`, `src/app/(app)/ustawienia/[zakladka]`, potem plan w `docs/superpowers/plans`.
