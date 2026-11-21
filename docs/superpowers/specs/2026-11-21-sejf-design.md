# Sejf (zero-knowledge) — projekt

Data: 2026-11-21. Autor: Claude, do akceptacji Mejsona.
Podstawa: spec `docs/superpowers/specs/2026-11-16-rhytm-design.md` §6.9 (Sejf i Sekret), §5 (model danych, `vaults`), §6.8 (szablony, Passwords) oraz makiety COSS `docs/design/mockups/CVaultSetup.dc.html`, `CVault.dc.html`, `CPasswords.dc.html`, `CVaultReset.dc.html`, `CSettings.dc.html` (zakładka „Sejf” w nawigacji), `CAddField.dc.html` (typ Sekret w grupie „Bezpieczne”).

## Intencja i dlaczego

Mejson chce trzymać hasła (serwisy, loginy, URL-e, hasła) w zwykłej stronie-tabeli rhytm, tak jak subskrypcje czy książki, ale tak, żeby **nikt poza nim nie mógł odczytać haseł**: ani serwer, ani właściciel bazy (on sam z poziomu Supabase), ani logi czy backupy. Sejf to brakujący element wizji „strony robią coś z danymi: liczą sumy, pokazują odnowienia, szyfrują hasła”. Wygląd: nowe makiety COSS (web). Telefon (`CMVault`, `CMPasswords`) — w Etapie 3.

## Cele

1. Typ pola **Sekret** w tabelach stron; wartość szyfrowana w przeglądarce, na serwer trafia tylko szyfrogram.
2. Szablon strony **Passwords**: Serwis (tytuł, tekst), Login (tekst), Hasło (Sekret), URL (url).
3. **Ustawienie sejfu** (hasło główne z miernikiem siły, „Powtórz”, ostrzeżenie, wymagane „Rozumiem…”).
4. **Odblokowanie** hasłem głównym; **blokada** ręczna („Zablokuj teraz”), po 5 min bezczynności, po przeładowaniu/zamknięciu karty; baner z odliczaniem „blokada za mm:ss”.
5. W odblokowanym sejfie: komórka Sekret `••••••••••••` z akcjami **Pokaż** / **Kopiuj**; po kopiowaniu toast „Skopiowano hasło {Serwis}. Schowek wyczyści się za 30 s.” i czyszczenie schowka po 30 s.
6. **Reset sejfu** (gdy hasło zapomniane): usuwa wszystkie wartości Sekret i sejf; zostają pozostałe pola; potwierdzenie słowem „RESETUJ”; potem ustawienie nowego hasła głównego.
7. **Ustawienia → Sejf**: stan sejfu, zmiana hasła głównego (ponowne owinięcie klucza, bez ponownego szyfrowania danych), reset.

## Nie-cele

- Odblokowanie biometrią (WebAuthn PRF) — przycisk ukryty, poza tym etapem.
- Ekrany telefonu sejfu (Etap 3). Na szerokości telefonu web działa, ale bez dopracowania pod makiety CM*.
- Generator haseł, import/eksport, udostępnianie, historia wersji haseł, autouzupełnianie w przeglądarce.
- Wiele sejfów na użytkownika (jeden sejf na konto, chroni wszystkie pola Sekret we wszystkich stronach).

## Anty-cele (porażka, nawet jeśli „działa”)

- Hasło (plaintext) **kiedykolwiek** trafia na serwer: w żądaniu, w logach, w błędzie, w Sentry/konsoli serwera, w podglądzie wiersza w ⌘K, w wyszukiwaniu, filtrze, sortowaniu, podsumowaniu kolumny, w kalendarzu, w eksporcie kosza.
- Hasło główne albo klucz danych zapisane gdziekolwiek poza pamięcią karty (localStorage, sessionStorage, IndexedDB, cookie, URL, stan serwera).
- Utrata dostępu do haseł przez błąd (np. zmiana hasła głównego, która zepsuje owinięty klucz; równoległe utworzenie dwóch sejfów; nadpisanie szyfrogramu śmieciami).
- Ciche „puste” wartości: gdy odszyfrowanie się nie uda, użytkownik musi to zobaczyć, a dane nie mogą zostać nadpisane.

## Ograniczenia

- Next.js 16 (App Router, server actions), Supabase (Postgres + RLS), React 19, Tailwind 4, kontrolki `@/components/controls`, wygląd COSS (tokeny, konwencje z Etapów 1–2d).
- Kryptografia wyłącznie **WebCrypto** w przeglądarce (`crypto.subtle`), bez nowych bibliotek kryptograficznych.
- Migracje SQL w `supabase/migrations/`; **Mejson sam uruchamia** `pnpm exec supabase db push --remote`.
- Teksty po polsku, dokładnie z makiet.
- Kod płaski, bez helperów skaczących po plikach (konwencja projektu), aliasy SQL z jawnym `AS`.

## Podejścia (decyzja: A)

- **A. Szyfrogram w `page_rows.values` jak inne pola (wybrane).** Wartość pola Sekret to obiekt `{v:1, iv, ct}` (base64). Plusy: działają gotowe mechanizmy wierszy (dodawanie, usuwanie, kosz, duplikowanie strony), zgodne ze specem. Minus: każde miejsce czytające wartości musi pomijać Sekret — pilnują tego walidacja serwera i testy.
- B. Osobna tabela `vault_secrets` (wiersz, pole, szyfrogram): izolacja od wyszukiwania i reset jednym DELETE, ale osobne zapisy, kopiowanie przy duplikowaniu i koszu — więcej kodu i miejsc na błąd.
- C. Integracja z zewnętrznym menedżerem haseł: odpada, wychodzi poza ideę „hasła jako strona-tabela”.

Mejson wybrał **A** (2026-11-21).

## Projekt

### Model danych

Nowa tabela (migracja `supabase/migrations/<timestamp>_vault.sql`):

```
vaults (
  user_id     uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  kdf         jsonb NOT NULL,   -- {alg:'PBKDF2-SHA-256', iterations:600000, salt:<base64 16 B>}
  wrapped_key text  NOT NULL,   -- base64: klucz danych AES-GCM-256 zaszyfrowany kluczem owijającym (AES-GCM)
  wrap_iv     text  NOT NULL,   -- base64 12 B
  generation  int   NOT NULL DEFAULT 1, -- rośnie przy każdym resecie (nowy klucz danych)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
)
```

- RLS: SELECT/INSERT/UPDATE tylko `user_id = auth.uid()`; bez DELETE z przeglądarki (wiersz znika kaskadą z kontem). Triggery: zakaz obniżania `generation`, zakaz zmiany typu pola z/na `secret`.
- INSERT przez PK = brak dwóch sejfów (drugi INSERT kończy się błędem; UI pokazuje „Sejf już istnieje” i przeładowuje stan).
- Usunięcie konta kasuje sejf (CASCADE); usunięcie konta już opisuje „sejf” w makiecie CSettings.

Pole Sekret jest dostępne **tylko w tabelach stron z szablonu** (`TemplatePageView`, okno „+ Pole”) — decyzja Mejsona. W blokach tabel zwykłych stron-edytorów (`editor/table-block`, `column-popover`) typu Sekret nie ma (ani w dodawaniu, ani w zmianie typu).

Pole Sekret: `page_fields.type = 'secret'` (nowy element `FieldType`, ikona lucide wg makiety CAddField/CColumnMenu — klucz/kłódka; grupa „Bezpieczne” w „+ Pole”). Wartość w `page_rows.values[field_id]`:
- `null` — puste,
- `{ "v": 1, "g": <generation>, "iv": "<base64 12 B>", "ct": "<base64>" }` — zaszyfrowane; `g` = numer generacji sejfu z `vaults.generation` w chwili zapisu. Serwer przy każdym zapisie pola Sekret sprawdza `g === vaults.generation` i odrzuca zapis zaszyfrowany starym kluczem (np. z karty otwartej przed resetem w innej karcie): „Sejf zmienił się w innej karcie. Odblokuj go ponownie.”. Zmiana hasła głównego nie zmienia generacji (ten sam klucz danych).

### Kryptografia (przeglądarka)

- Hasło główne → `PBKDF2` (SHA-256, 600 000 iteracji, sól 16 B losowa per sejf) → klucz owijający AES-GCM-256 (nieeksportowalny).
- Format wartości różni się od specu §6.9 polem `g` (generacja) — decyzja po builder-check, chroni przed zapisem starym kluczem.
- Klucz danych: losowy AES-GCM-256 (`generateKey`, extractable tylko na czas owinięcia), owinięty kluczem owijającym (AES-GCM, IV 12 B) → `wrapped_key` + `wrap_iv`.
- Odblokowanie = odwinięcie klucza; **udane odwinięcie = poprawne hasło** (tag GCM). Złe hasło → „Nieprawidłowe hasło główne.” bez ujawniania szczegółów.
- Szyfrowanie wartości: AES-GCM, nowy losowy IV 12 B dla każdego zapisu, tekst UTF-8; zapis `{v:1, iv, ct}`.
- Klucz danych po odwinięciu: `CryptoKey` **nieeksportowalny**, trzymany tylko w pamięci (stan React w providerze na poziomie layoutu `(app)`), nigdy serializowany.
- Zmiana hasła głównego: odblokowanie starym → nowa sól, nowy klucz owijający → ponowne owinięcie tego samego klucza danych (wymaga klucza extractable tylko w tej operacji: odwinięcie z `extractable: true` w obrębie jednej funkcji, bez przechowywania) → UPDATE `vaults` (kdf, wrapped_key, wrap_iv, updated_at). Dane w wierszach bez zmian.
- Miernik siły: 5 stanów z makiety („Za krótkie”, „Słabe”, „Średnie”, „Mocne”, „Bardzo mocne”), 4 segmenty. Własna ocena lokalna (bez HIBP — hasło główne nie opuszcza przeglądarki; nie używa `passwordStrength` z hasła konta): < 12 znaków = „Za krótkie”; od 12 znaków punkty za długość (≥ 16, ≥ 20) i za każdą klasę znaków (małe, wielkie, cyfry, symbole) ponad jedną → „Słabe” / „Średnie” / „Mocne” / „Bardzo mocne”. Dokładne progi ustala plan i testy (np. 12 znaków, 2 klasy = „Średnie”). Utworzenie sejfu i zmiana hasła wymagają ≥ „Mocne” (decyzja Mejsona po przeglądzie bezpieczeństwa, 2026-11-21: „Średnie” przepuszczało hasła słownikowe z cyfrą).

### Stan sejfu w aplikacji (provider)

`VaultProvider` w layoucie `(app)` (klient):
- `status`: `"brak"` (nie ma wiersza `vaults`) | `"zablokowany"` | `"odblokowany"`,
- `unlock(hasło)`, `lock()`, `encrypt(tekst)`, `decrypt(wartość)`, `remainingMs`,
- blokada: **stałe 5 min** (decyzja Mejsona; bez wyboru 1/5/15 z pierwotnego specu) liczone od **ostatniej aktywności użytkownika** w karcie (mysz, klawiatura, dotyk, scroll), reset przy aktywności; `visibilitychange` nie blokuje od razu, ale czas leci; `beforeunload`/odświeżenie = utrata klucza (pamięć),
- dane sejfu (`kdf`, `wrapped_key`, `wrap_iv`) czytane z serwera (server component / akcja), nie wrażliwe.

### Ekrany (web, wg makiet)

- **Strona z polem Sekret, sejf nieustawiony** → widok `CVaultSetup` w miejscu tabeli (okruszki „Strony / Passwords”, tytuł strony z ikoną, karta „Ustaw hasło główne sejfu”). Anuluj → wraca do tabeli z komórkami Sekret „— nieustawiony sejf” i bez możliwości wpisania sekretu.
- **Sejf zablokowany** (`CVault`): tabela widoczna (pozostałe pola normalnie), kolumna Sekret pokazuje „zablokowane”; baner „Sejf zablokowany · serwer widzi tylko szyfrogram”; karta „Odblokuj sejf” (pole hasła głównego, „Odblokuj”, „Klucz zostaje tylko w pamięci tej karty. Blokada po 5 min bezczynności.”, link „Nie pamiętam hasła — zresetuj sejf”). Edycja wiersza możliwa dla zwykłych pól; pole Sekret w edycji wyłączone z podpowiedzią „Odblokuj sejf, żeby edytować”.
- **Sejf odblokowany** (`CPasswords`): baner `alert ok` „Sejf odblokowany · blokada za mm:ss”, przycisk „Zablokuj teraz” w topbarze; komórki `••••••••••••` z przyciskami Pokaż (przełącza na tekst jawny tylko w tej komórce, do ponownego kliknięcia/blokady) i Kopiuj (toast + po 30 s zapis pustego tekstu do schowka — od razu, gdy karta ma fokus, inaczej po powrocie fokusu; także przy blokadzie; bez `readText`, który w tle nie działa); edycja: pole bez `name`, wyłączone dla menedżerów haseł — `type="text"` maskowane `-webkit-text-security`, a w przeglądarkach bez tej właściwości `type="password"`; zamaskowanego nie da się skopiować; „Pokaż”; szyfrowane przed wysłaniem. Formularze hasła głównego mają ukryte pole `username` „Sejf rhytm (hasło główne)”, żeby przeglądarka nie nadpisała danych logowania konta.
- **Reset** (`CVaultReset`): okno: „Zresetować sejf?”, „Tej operacji nie da się cofnąć.”, „Zostanie usunięte: N sekretów” / „Zostaje: serwisy, loginy, URL-e”, „Pola „Sekret” zostaną wyczyszczone, a potem ustawisz nowe hasło główne.”, „Wpisz RESETUJ, żeby potwierdzić” (kontrolka `WordConfirm`), „Zresetuj sejf”. N = liczba niepustych wartości Sekret we wszystkich stronach.
- **Ustawienia → Sejf** (brak makiety treści — projekt w stylu `CSettingsAccount`, do akceptacji wizualnej): karta „Sejf” ze stanem („Ustawiony 21.11.2026” / „Nie ustawiony”), „Zmień hasło główne” (stare, nowe z miernikiem, powtórz), „Zablokuj teraz” (gdy odblokowany), strefa niebezpieczna „Zresetuj sejf” (to samo okno co wyżej). Bez sejfu: przycisk „Ustaw sejf” otwierający formularz z CVaultSetup.

### Serwer (server actions)

- `getVault()` → `{kdf, wrapped_key, wrap_iv} | null`.
- `createVault({kdf, wrapped_key, wrap_iv})` → INSERT; walidacja zod: `kdf.alg === 'PBKDF2-SHA-256'`, `iterations === 600000`, sól 16 B base64, `wrap_iv` 12 B, `wrapped_key` base64 długości odpowiadającej 32 B + 16 B tag.
- `rewrapVault(...)` → UPDATE (zmiana hasła głównego) z tą samą walidacją; warunek optymistyczny na `updated_at` (żeby dwie karty nie nadpisały się nawzajem).
- `resetVault()` → w jednej transakcji (funkcja SQL `reset_vault()` SECURITY INVOKER z RLS): usuwa wiersz `vaults` i ustawia `null` w `values` dla wszystkich pól typu `secret` użytkownika (również w wierszach w koszu); zwraca liczbę wyczyszczonych wartości. `countSecrets()` do okna resetu.
- `updateRow` / `addRow` / duplikowanie strony: dla pól `secret` przyjmują **wyłącznie** `null` albo obiekt `{v:1, iv, ct}` o poprawnych długościach base64 (schemat zod); **każdy string = błąd** „Nie zapisano. Sejf musi być odblokowany.” — zabezpieczenie przed wysłaniem tekstu jawnego.
- `changeFieldType`: zmiana typu **na** `secret` albo **z** `secret` jest zablokowana (błąd z czytelnym komunikatem) — uniknięcie utraty danych i wycieku. Usunięcie pola Sekret: jak każdego pola (kosz), wymaga potwierdzenia jak dziś.
- Szablon Passwords w `templates.ts` + na liście w „Nowa strona” (makieta CNewPage ma szablon Passwords z odznaką „szyfr.”).
- Onboarding: kreator już pokazuje Passwords („Hasło główne ustawisz przy pierwszym otwarciu”), ale wybór dziś przepada — dodać `passwords` do `PENDING_TO_TEMPLATE` (`src/features/onboarding/model.ts`) i do tworzenia stron w `load-pages`; strona powstaje pusta, sejf ustawia się przy pierwszym otwarciu.

### Gdzie Sekret NIE trafia (wymóg, testowany)

- ⌘K / wyszukiwanie, filtr (pole Sekret nie jest wybieralne w filtrze), sortowanie (niedostępne dla Sekret), podsumowania kolumny (tylko „wypełnione/puste”), przypięte karty, kalendarz, podgląd wiersza w miejscach poza tabelą, tytuł strony, eksport/duplikat jako tekst jawny (duplikat strony kopiuje szyfrogram bez zmian).
- Logi serwera i komunikaty błędów nie zawierają wartości pól Sekret (ani szyfrogramu w treści błędów).

### Teksty i stany błędów

- Złe hasło główne: „Nieprawidłowe hasło główne.” (pod polem, `aria-describedby`).
- Hasła się różnią (setup): „Hasła się różnią.” (z makiety).
- Nieudane odszyfrowanie pojedynczej wartości (uszkodzony szyfrogram): komórka „nie da się odczytać” w kolorze destructive; edycja nadpisuje tylko po wpisaniu nowej wartości.
- Brak WebCrypto (stara przeglądarka / nie-HTTPS): ekran „Sejf wymaga nowoczesnej przeglądarki i połączenia HTTPS.”

## Co zostaje dla wykonawcy (planu)

- Podział na zadania i testy (Vitest dla kryptografii z WebCrypto w Node 24, testy komponentów, e2e Playwright dla przepływu: ustaw → wpisz → zablokuj → odblokuj → pokaż/kopiuj → reset).
- Dokładny wygląd zakładki Ustawienia → Sejf w stylu CSettingsAccount.
- Szczegóły integracji z `use-table-store`, `row-edit`, `row-preview`, `cell-editor`, `add-field-dialog`, `column-menu`, `filter-popover`, ⌘K.
- Przegląd bezpieczeństwa całej gałęzi (osobny recenzent) przed scaleniem.

## Decyzje Mejsona (2026-11-21)

- Podejście A (szyfrogram w `page_rows.values`).
- Blokada zawsze po 5 min bezczynności (bez wyboru w ustawieniach).
- Sekret tylko na stronach z szablonu.
- Zakres: bez biometrii, telefon w Etapie 3.

## Decyzje Claude (do sprawdzenia przez Mejsona)

- Numer generacji sejfu w wartości Sekret i w `vaults` (ochrona przed zapisem starym kluczem po resecie w innej karcie).
- Szablon Passwords z onboardingu tworzy pustą stronę; sejf przy pierwszym otwarciu.
- Miernik siły liczony lokalnie z długości i klas znaków (bez HIBP).

- Ustawienia → Sejf zaprojektowane bez makiety, w stylu CSettingsAccount.
- Minimalne wymagania hasła głównego: 12 znaków i siła ≥ „Mocne”.
- Model zagrożeń: serwer niezaufany co do poufności, nie integralności — AAD wiąże szyfrogram z wersją sejfu (`g`), nie z wierszem; serwer mógłby przełożyć szyfrogram między wierszami, ale go nie odczyta. Zmiana hasła głównego nie zmienia klucza danych (stara kopia bazy + stare hasło otwierają sekrety).
- Blokada po 5 min **bezczynności** (nie od odblokowania); odświeżenie strony zawsze blokuje.
- Zmiana typu pola na/z Sekret zablokowana.
- Reset czyści też sekrety w wierszach w koszu.
- Schowek czyszczony po 30 s tylko, jeśli wciąż zawiera skopiowane hasło (gdy przeglądarka pozwala to sprawdzić); inaczej wpisanie pustego tekstu.
