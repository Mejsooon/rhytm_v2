# Etap 3 / pakiet 10: wyszukiwanie (CMSearch) — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (nowa funkcja z dostępem do danych). Steps use checkbox (`- [ ]`) syntax.

**Goal:** `/szukaj` przestaje być zaślepką. Wyszukuje strony, wiersze tabel, bloki kalendarza, nawyki i treningi użytkownika i pokazuje wyniki w grupach według CMSearch. Na telefonie pełny ekran z „Anuluj”, na webie ten sam ekran w treści modułu.

**Spec:** `docs/superpowers/specs/2026-11-24-telefon-design.md`: inwentaryzacja (CMSearch), „Konflikty” punkt 2, decyzje T11, T14. Czytaj w całości przed każdym zadaniem.

**Makiety (wiążące):** `docs/design/mockups/CMSearch.dc.html` (stany: puste pole, wyniki, brak wyników). Zrzut: `PW_CHANNEL=chrome pnpm -s mockups:shots CMSearch`.

**Tech Stack:** Next.js 16 (cacheComponents: dane zależne od sesji za `connection()` + `Suspense`, jak `ustawienia/[zakladka]/page.tsx`), React 19, Supabase (RLS), kontrolki, Vitest, Playwright (CI).

## Global Constraints

- Zasady `CLAUDE.md`:
  - płaski kod;
  - polskie teksty i komentarze;
  - commity na `feat/telefon-szukaj` z trailerem:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
    ```
- **Bez migracji** (T11). Tylko zapytania klienta serwerowego Supabase z RLS i filtrem `user_id`.
- **Prywatność sejfu:**
  - nigdy nie przeszukujemy pól `secret`;
  - nie pokazujemy wierszy strony systemowej (Hasła): nawet jawne kolumny Serwis i Login nie trafiają do wyników;
  - Hasła jako strona mogą się pojawić tylko po tytule „Hasła”.
- Fraza:
  - przycięta, 2–80 znaków (krótsza = stan pusty);
  - znaki `%`, `_` i `\` są escapowane przed `ilike`;
  - limit 5 wyników na grupę.
- Cele 44 px, wiersze wyników 52 px. Teksty z makiety.
- Po każdym zadaniu `pnpm -s test`, `pnpm -s typecheck` i `pnpm -s lint`.

## Task 1: Server Action `searchAll`

**Files:** create `src/features/search/actions.ts` (+ `actions.test.ts`, mock klienta Supabase jak w `src/features/pages/actions.test.ts`); read `src/features/pages/load-pages.ts`, `src/features/calendar/occurrences.ts` (następne wystąpienie bloku), `src/features/habits/model.ts` (`currentStreak`), `src/features/sport/model.ts` (`formatKm`), `src/features/pages/fields.ts` (`formatValue`, `isTitle`).

- [ ] `searchAll(q: string): Promise<{ ok: true; groups: { title: "Strony" | "Kalendarz" | "Nawyki" | "Sport"; items: { title: string; meta: string; href: string }[] }[] } | { ok: false; message: string }>`. Walidacja zod frazy. Brak sesji → `redirect("/logowanie")`.
- [ ] Zapytania równolegle (`Promise.all`), każde z `.eq("user_id", user.id)` i limitem:
  1. **Strony:** `pages` nieusunięte, `title ilike %q%`. Meta: liczba wierszy („N wierszy” z odmianą `rowsForm`) albo „pusta strona”. Href `/strony/<id>`, dla `is_system` `/hasla`.
  2. **Wiersze:** pola tytułowe (`page_fields` `is_title`) bloków nieusuniętych na stronach nieusuniętych i **nie systemowych**, potem `page_rows` nieusunięte tych bloków z `values ->> <id pola> ilike %q%`. Przy kilku polach tytułowych zbuduj `or(...)` (PostgREST `values->>id.ilike.*q*`). Wynik w grupie „Strony”: tytuł wiersza, meta „w <tytuł strony>”, href `/strony/<pageId>`.
  3. **Kalendarz:** `blocks` z `title ilike`. Meta:
     - najbliższe wystąpienie od dziś w 60 dniach (funkcja z `occurrences.ts`), np. „dziś 10:30–12:30”, „pt 28.11 16:00”;
     - bez przyszłego wystąpienia: data ostatniego.

     Href `/kalendarz?widok=dzien&data=RRRR-MM-DD`.
  4. **Nawyki:** `habits` (nieusunięte/aktywne według modelu) z `name ilike`. Meta „seria N dni” (`currentStreak`), href `/nawyki/<id>`.
  5. **Sport:** `sport_sessions` z `title ilike`, najnowsze najpierw. Meta „czw 12.11” + dla biegu km. Href: bieg → `/sport?miesiac=RRRR-MM&wybrany=s:<id>`, trening → `/sport/trening/<id>` (sprawdź istniejące adresy w `sport-view.tsx`).
- [ ] Kolejność grup jak w makiecie: Strony, Kalendarz, Nawyki, Sport. Puste grupy pomijane.
- [ ] Testy:
  - escapowanie `%`/`_`;
  - fraza < 2 znaki → pusty wynik bez zapytań;
  - wiersze strony systemowej i pola Sekret nigdy nie są pytane (asercja na wywołaniach mocka);
  - limit 5;
  - kolejność grup;
  - `user_id` w każdym zapytaniu.
- [ ] Commit: `feat(szukaj): wyszukiwanie po stronach, kalendarzu, nawykach i sporcie`.

## Task 2: Ekran Szukaj (CMSearch)

**Files:** modify `src/app/(app)/szukaj/page.tsx`; create `src/features/search/search-view.tsx` (+ `search-view.test.tsx`).

- [ ] Strona: `ModuleHeader title="Szukaj" webOnly` (web), a pod nim `SearchView`. Na telefonie `SearchView` ma własny nagłówek.
- [ ] `SearchView` (klient):
  - nagłówek telefonu (`m-head` bez ramki, `gap-2 pl-4 pr-2`): `igroup` z lupą i polem `type="search"` (placeholder „Szukaj w rhytm”, `aria-label` „Szukaj”, `autoFocus` na telefonie, 16 px) i „Anuluj” (`btng`, `router.back()`, a bez historii `/dzis`). Na webie samo pole (max 480 px);
  - wpisywanie: debounce 250 ms, potem `searchAll`. Wynik z nieaktualnej frazy jest odrzucany (porównanie z ostatnią frazą). Stan ładowania nie miga poniżej 250 ms;
  - **pusta fraza:**
    - „Ostatnio”: `.lbl` + chipy z ikoną zegara (5 ostatnich fraz z `localStorage` klucz `rhytm_szukaj_ostatnio`, zapis po wyniku z ≥ 1 trafieniem, bez duplikatów; stuknięcie wpisuje frazę). Gdy pusto, sekcja się nie pokazuje;
    - „Szybkie akcje”: `Card` z `m-row`:
      - „Nowy blok” (→ `/dzis?szybko=blok`, albo istniejące otwarcie szybkiego dodawania; T5 / konflikt 2);
      - „Zapisz bieg” (→ `/sport?nowy=bieg`);
      - „Wpis snu” (→ otwarcie wpisu snu w `/nawyki`, istniejący parametr adresu albo dodaj `?sen=nowy` obsłużony w `m-habits`/`habits-view`);
      - „Nowa strona” (→ `/strony/nowa`);
  - **wyniki:** dla każdej grupy `.lbl` z nazwą i `Card` z linkami `m-row` 52 px: tytuł, `.hint` meta, chevron;
  - **brak wyników:** `EmptyState` z ikoną lupy i tekstem „Nic nie znaleziono dla „q””;
  - błąd: toast „Nie udało się wyszukać”.
- [ ] Dodaj obsługę parametrów szybkich akcji tylko tam, gdzie jej brakuje (sprawdź `grep -rn "useSearchParams\|searchParams" src/features/today src/features/habits src/features/sport`). Każdy nowy parametr ma test.
- [ ] Testy:
  - debounce i odrzucanie starych wyników;
  - „Ostatnio” z `localStorage`;
  - szybkie akcje mają poprawne `href`;
  - pusty wynik;
  - „Anuluj”.
- [ ] Commit: `feat(szukaj): ekran wyszukiwania według CMSearch`.

## Task 3: Wejścia do Szukaj i e2e

**Files:** `src/features/today/mobile/m-today.tsx`, `src/features/calendar/calendar-header.tsx` (oba już linkują `/szukaj` — sprawdź), `src/components/shell/app-sidebar.tsx` (wyłączone pole „Szukaj…” z pilota COSS), `e2e/shell.spec.ts` albo nowy `e2e/search.spec.ts`, `e2e/visual.spec.ts`.

- [ ] Sidebar webu: pole „Szukaj…” staje się linkiem do `/szukaj` (ten sam wygląd, bez `disabled`). Skrót `Ctrl+K` / `⌘K` przenosi do `/szukaj`, jeśli wyłączone pole pokazuje `Kbd` (CCommandK jako okno nie powstaje — poza zakresem; odnotuj w „Do decyzji”).
- [ ] e2e (web i mobile):
  - konto z blokiem „Matematyka”, nawykiem „Czytanie” i stroną „Books” z wierszem „Dune”;
  - fraza „mat” → wynik w „Kalendarz” prowadzi do dnia;
  - „dune” → wiersz w „Strony”;
  - moduł Hasła z wierszem „GitHub” → fraza „git” nie daje wyniku z Haseł;
  - „xyz” → „Nic nie znaleziono”.
- [ ] `visual.spec.ts`: zrzut `/szukaj` pusty i z wynikami (makieta CMSearch).
- [ ] Commit: `test(szukaj): e2e i zrzuty`.

## Task 4 (koordynator): przegląd, CI, scalenie, zamknięcie Etapu 3

- [ ] **Przed Task 1:** gałąź `feat/telefon-szukaj` z `main`, kopia planu, dziennik.
- [ ] Recenzja bezpieczeństwa Task 1:
  - tylko dane użytkownika;
  - brak sekretów i wierszy Haseł;
  - escapowanie;
  - brak N+1 ponad 6 zapytań na frazę.
- [ ] Przegląd gałęzi, CI zielone, scalenie według zasad serii.
- [ ] **Zamknięcie Etapu 3:**
  - `stan-projektu.md`: Etap 3 w „Zrobione” z listą merge'ów 10 pakietów; seria autonomiczna zakończona, wraca zasada „scal do main” (`CLAUDE.md`, punkt wyjątku: oznacz serię jako zakończoną);
  - `odlozone.md`: wszystkie uwagi „Etap 3” oznaczone (naprawione albo z adnotacją, czemu nie);
  - dziennik.
- [ ] „Do decyzji” dla Mejsona — zbiorcza lista Etapu 3:
  - T1–T18 i „Do decyzji” ze specu;
  - decyzje zapisane w poszczególnych pakietach;
  - CCommandK na webie;

  każda pozycja z kosztem pomyłki.
