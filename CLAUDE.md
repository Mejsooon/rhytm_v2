@AGENTS.md

# rhytm — zasady pracy z Mejsonem

Każda rozmowa zaczyna się od przeczytania dwóch plików:
- `docs/superpowers/stan-projektu.md`: co jest zrobione, co jest w toku i co dalej;
- najnowszego pliku w `docs/superpowers/dziennik/`, nie całego folderu.

## Dziennik sesji

- **Gdzie pisać:** do dzisiejszego pliku `docs/superpowers/dziennik/RRRR-MM-DD.md` (utwórz go, jeśli go nie ma).
- **Kiedy:** nie czekaj na koniec rozmowy. Dopisz wpis po każdym skończonym kawałku pracy (zadanie, poprawka, scalenie) i przy zmianie tematu. Nie dopisuj go po każdej pojedynczej wiadomości, bo to kosztuje tokeny.
- **Nagłówki wpisu:**
  - Co zrobione (polecenia, pliki, funkcje);
  - Decyzje (z uzasadnieniem);
  - Otwarte wątki (do podjęcia następnym razem);
  - Błędy (co poszło źle i jak to rozwiązano).
- **Gałąź:** dziennik commitujesz na bieżącej gałęzi roboczej, nie na `main`.
- **Stan projektu:** przy zmianie etapu albo gałęzi zaktualizuj też `stan-projektu.md`.

## Stałe zasady

- **Odpowiadaj po polsku.**
- **Git:**
  - commit i push tylko na gałęziach `feat/*` albo `docs/*`, nigdy commit na `main` poza merge;
  - scalanie do `main` tylko po słowach Mejsona „scal do main”, przez `git merge --no-ff`, z testami na połączonym kodzie;
  - **wyjątek: seria autonomiczna z 2026-11-24.** Mejson zlecił projekty Dziś → Subscriptions (pełne, z odnowieniami w kalendarzu) → sprzątanie odłożonych uwag webu → Etap 3 (telefon) bez swojego udziału. W tej serii Claude sam scala do `main` po zielonym CI (lokalne testy + CI na GitHubie) i od razu zaczyna następny projekt. Decyzje, które normalnie należałyby do Mejsona, Claude podejmuje sam i zapisuje w „Do decyzji” z kosztem pomyłki. Mejson z góry potwierdził usunięcie 6 zadań bez bloku w migracji Dziś. Po zakończeniu serii wraca zwykła zasada „scal do main”;
  - **seria „nowe makiety” od 2026-11-26** (kolejność: Tabele → Kalendarz → Sport i trening siłowy → Dziś, Nawyki i sen → Ustawienia, kosz i nowe ekrany → Telefon → Plan Free/Pro → Trener po decyzji Mejsona). Mejson: „wszystko robisz sam”. Claude sam scala do `main` po zielonym CI i przechodzi do następnego pakietu. Przed pakietem pyta o to, czego nie da się rozstrzygnąć z makiet, zawsze z rekomendacją (pierwsza opcja oznaczona „(Rekomendowane)”);
  - zdalne gałęzie usuwa Mejson.
- **Od 2026-11-26 migracje na produkcję wykonuje Mejson** (`pnpm exec supabase db push --remote`). Claude pisze migrację z testem pgTAP i podaje Mejsonowi gotowe polecenie oraz kolejność. Kod pakietu z migracją, który nie działa na starej bazie, Claude scala dopiero po potwierdzeniu Mejsona, że migracja przeszła; migracje usuwające dane opisuje wprost przed uruchomieniem. Poniższe zasady konektora są archiwalne.
- **Migracje (archiwum, do 2026-11-25)** wykonywał Claude przez konektor Supabase (decyzja Mejsona z 2026-11-23). Każda migracja ma test pgTAP w `supabase/tests/`. Zasady:
  - migracja idzie na produkcję dopiero po zielonym CI i po scaleniu do `main` („scal do main”), nigdy z gałęzi w trakcie pracy;
  - przed wykonaniem Claude podaje, czy migracja idzie przed wdrożeniem kodu na Vercel, czy po nim, i trzyma się tej kolejności;
  - **migracje usuwające dane** (DELETE, DROP z danymi, zawężenie typu) tylko po wyraźnym potwierdzeniu Mejsona w rozmowie;
  - po wykonaniu `list_migrations` musi pokazać tę samą wersję co nazwa pliku w `supabase/migrations/`. Konektor (`apply_migration`) nadaje wersję z bieżącej godziny, więc zaraz po migracji popraw wersję w historii produkcji na numer z nazwy pliku: `update supabase_migrations.schema_migrations as m set version = '<wersja z pliku>' where m.version = '<wersja nadana>' and m.name = '<nazwa>';` (zgoda Mejsona z 2026-11-24). **Nie zmieniaj nazwy pliku w repo** — wersja z godziny może wypaść przed późniejszymi migracjami i zepsuć kolejność na czystej bazie w CI. Bez tej poprawki `supabase db push` puściłby migrację drugi raz;
  - konektor przy każdej migracji pyta Mejsona o zgodę w interfejsie (wygasa po 120 s), więc migracji nie da się wykonać, gdy Mejsona nie ma — wtedy kod musi działać na starej bazie, a migracja czeka;
  - jeśli konektor nie działa, migrację uruchamia Mejson (`pnpm exec supabase db push --remote`).
- **Sekretów** (kluczy, haseł, tokenów) nie wpisuje się w czacie.
- **Kod:**
  - płaski, bez funkcji pomocniczych skaczących po plikach;
  - komentarze i teksty UI po polsku;
  - w SQL aliasy zawsze z jawnym `AS`.
- **Trailer każdego commita:**
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <link do bieżącej sesji>
  ```
- **Makiety na kanwie „Rhytm Design”** (artefakt `9944efef-e205-44c2-b3d9-bd664070ef9d`) są wiążące w sprawach wyglądu i wygrywają z planem.
  - Kopie makiet leżą w `docs/design/mockups`.
  - Zrzut makiety: `PW_CHANNEL=chrome pnpm -s mockups:shots <Nazwa>`.
  - Przy kopiowaniu z kanwy zamień `/_blob/80c2d54ff511454fab6252a309224534` na `coss/coss.css`.
- **Komentarze na kanwie:** odpowiadaj w wątku i nie rozwiązuj go. W rozmowie wystarczy jedna krótka linijka.
- **Na koniec etapu** daj Mejsonowi listę „Do decyzji”: rzeczy do potwierdzenia i decyzje podjęte po drodze, każdą z kosztem pomyłki.

## Technika

- **Stos:** Next.js 16 z cacheComponents, React 19, Supabase (projekt `yazntcoocfxfxqqevxoh`), Tailwind 4, kontrolki z `@/components/controls` w wyglądzie COSS, `lucide-react` 1.73, Vitest, Playwright.
- **Next.js 16 ma zmiany łamiące.** Przy wątpliwościach czytaj `node_modules/next/dist/docs/`.
- **Lokalnie** uruchamiasz `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint`.
- **e2e i pgTAP działają tylko w CI na GitHubie,** bo lokalnie nie ma Dockera.
  - Artefaktów CI (zrzutów) nie da się pobrać z sesji, czytaj logi przez `gh run view <id> --log-failed`.
  - GraphQL w `gh` jest zablokowany.
- **Niestabilne testy e2e:** pakiet sprzątania (24.11) ustabilizował kliknięcia w siatkę kalendarza i testy przy północy (`e2e/helpers/kalendarz.ts`: `czekajNaSiatke`, `kliknijSlot`). Znany pozostały niestabilny test: `[mobile] today.spec.ts:185` („nawyk odhaczony na Dziś → kafelek Nawyki 1/1”), przyczyna niezbadana. Krok `supabase/setup-cli` w CI czasem pada na limicie GitHuba („rate limit exceeded”) — to nie błąd kodu. W obu przypadkach przed uznaniem błędu uruchom ponownie (`gh run rerun <id> --failed`).

## Proces

- **Większe zmiany:** krótki projekt albo spec w `docs/superpowers/specs`, potem plan w `docs/superpowers/plans`, potem wykonanie.
  - Ryzykowne etapy (sejf, migracje danych, dużo plików) idą przez subagent-driven-development: wykonawca i recenzent na każde zadanie, na końcu przegląd całej gałęzi.
  - Małe pakiety Claude robi sam, z jednym przeglądem całej gałęzi na końcu, żeby oszczędzać tokeny.
- **Odłożone drobne uwagi** z przeglądów trafiają do `docs/superpowers/odlozone.md`.
