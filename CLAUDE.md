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
  - zdalne gałęzie usuwa Mejson.
- **Migracje** (`pnpm exec supabase db push --remote`) uruchamia Mejson. Nie wysyłaj migracji na produkcję sam. Każda migracja ma test pgTAP w `supabase/tests/`.
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
- **Niestabilne testy e2e** (zależne od pory, niezwiązane ze zmianami) to `calendar.spec` (32, 239, 264), `sport.spec` (20, 203) i `today.spec:45`. Przed uznaniem błędu uruchom je ponownie (`gh run rerun <id> --failed`).

## Proces

- **Większe zmiany:** krótki projekt albo spec w `docs/superpowers/specs`, potem plan w `docs/superpowers/plans`, potem wykonanie.
  - Ryzykowne etapy (sejf, migracje danych, dużo plików) idą przez subagent-driven-development: wykonawca i recenzent na każde zadanie, na końcu przegląd całej gałęzi.
  - Małe pakiety Claude robi sam, z jednym przeglądem całej gałęzi na końcu, żeby oszczędzać tokeny.
- **Odłożone drobne uwagi** z przeglądów trafiają do `docs/superpowers/odlozone.md`.
