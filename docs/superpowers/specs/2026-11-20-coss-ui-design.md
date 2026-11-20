# rhytm — przejście na wygląd COSS UI (design)

Data: 2026-11-20 · Autor: Mejson + Claude · Status: do akceptacji

## Intencja i po co

Aplikacja ma wyglądać jak SaaS, a nie jak techniczne narzędzie bazodanowe. Mejson przygotował na kanwie „Rhytm Design” (artefakt `9944efef-e205-44c2-b3d9-bd664070ef9d`) nowy język wizualny w stylu biblioteki COSS UI:
- stronę **COSS UI**, czyli 51 ekranów webowych `C*.dc.html`,
- stronę **COSS Mobile**, czyli 26 ekranów telefonu `CM*.dc.html`.

Obie strony są zaakceptowane i od 2026-11-20 są **wiążącym wzorcem wyglądu**. Zastępują strony „Web Design” i „Mobile Design”, które zostają na kanwie tylko do porównania.

Funkcjonalnie nic się nie zmienia. Ekrany C* i CM* mają te same dane, stany, teksty i przepływy co stare makiety i obecna aplikacja (Etapy 0–6). Zmienia się wyłącznie wygląd.

## Cele

- Każdy ekran aplikacji wygląda jak odpowiadająca mu makieta C* (web, ≥800 px) albo CM* (telefon, <800 px).
- Wygląd opiera się na jednym źródle: tokenach i wspólnych kontrolkach. Zmiana koloru czy promienia w jednym miejscu przechodzi na całą aplikację.
- Przejście odbywa się etapami. Mejson ocenia efekt w prawdziwej aplikacji po pilocie i po każdym etapie.

## Nie-cele

- Zmiany funkcji, danych, schematu bazy, tekstów i przepływów. Jeśli makieta C*/CM* różni się funkcjonalnie od aplikacji, wygrywa aplikacja, a różnicę zgłaszamy Mejsonowi.
- Ciemny motyw.
- Nowe ekrany, których nie ma w aplikacji.

## Anty-cele (porażka, nawet jeśli „działa”)

- Aplikacja w połowie w starym stylu, w połowie w nowym, utrwalona na dłużej niż do następnego etapu.
- Kolory wpisane na sztywno w ekranach, które nie reagują na zmianę tokenów.
- Regresje funkcjonalne: zepsute testy e2e, utracone stany, mniejsze niż 44 px cele dotykowe na telefonie.

## Stan obecny (zbadany w repo)

- **Tokeny:** `src/app/globals.css` ma tokeny starego stylu: #171717, ramki #eaeaea, promień 6 px i fonty Geist (`src/app/layout.tsx`).
- **Kontrolki:** własna biblioteka kontrolek `src/components/controls/` (Button, TextField, Dropdown, Segment, Switch, Checkbox, Chip, StatusBadge, DatePicker, TimePicker, Stepper, FormDialog, ActionPopover, WordConfirm) oraz shadcn w `src/components/ui/` (button, dialog, input, label, popover, separator, sonner, tooltip).
- **Kolory w kodzie:** około 2000 wystąpień kolorów hex wpisanych w klasy Tailwind w 167 plikach `.tsx`. Najczęstsze to `[#171717]` (434 razy), `[#6b6b6b]`, `[#666666]`, `[#eaeaea]`, `[#e0e0e0]`, `[#f0f0f0]`, `[#f5f5f5]`, `[#b91c1c]`, `[#fafafa]` i `[#15803d]`. Promienie mają podobny problem: `rounded-md`, `rounded-[10px]`, `rounded-lg` i inne. Sama zmiana tokenów niczego więc nie przestawi.
- **Powłoka:** `src/components/shell/` (app-sidebar, tab-bar, module-header, account-popover, app-shell).
- **Podział web/telefon:** klasy `max-[799px]:` / `min-[800px]:` oraz osobne komponenty `mobile/` w modułach.
- **Kopie makiet w repo:** `docs/design/mockups/` zawiera jeszcze stare `*.dc.html` i `M*.dc.html`.

## Wzorzec wyglądu COSS (z arkusza `/_blob/80c2d54ff511454fab6252a309224534` na kanwie)

**Tokeny:**

| Token | Wartość |
|---|---|
| foreground | #262626 |
| muted-foreground | #686868 |
| muted / accent | rgba(0,0,0,.04) |
| border | rgba(0,0,0,.08) |
| input | rgba(0,0,0,.1) |
| primary | #262626 |
| primary-foreground | #fafafa |
| destructive | #ef4444 (tekst #b91c1c) |
| success | #15803d |
| info | #3b82f6 (tekst #1d4ed8) |
| warning | #f59e0b (tekst #b45309) |
| ring | #a3a3a3 |
| sidebar | #fafafa (ramka rgba(0,0,0,.06)) |
| radius | 10 px (karty 16 px, ramki 12 px, menu 12 px, pozycje menu 6 px, chip i segment 8 px) |
| shadow-xs | 0 1px 2px rgba(0,0,0,.05) |
| shadow-lg | 0 10px 15px -3px rgba(0,0,0,.06), 0 4px 6px -4px rgba(0,0,0,.06) |

Font to **Inter** z `font-feature-settings: "cv11"`, a cyfry są tabelaryczne tam, gdzie są liczby.

**Kontrolki:**
- Przyciski: default, outline, secondary, ghost, destructive i destructive-outline. Wysokości 24/28/32/36 px, a na telefonie 44 px.
- Pola mają 32 px (na telefonie 44 px), focus ring `0 0 0 3px rgba(163,163,163,.24)`.
- Checkbox 16 px, switch 36×20, segment (pill tabs), zakładki podkreślane, chip, odznaki (default/secondary/outline/success/info/warning/error).
- Karta z nagłówkiem i stopką `foot`, frame/inner, tabela, menu i popover, dialog z nagłówkiem, treścią i stopką, toast, alert, kbd, progress, avatar i pusty stan.
- Sidebar: elementy 32 px, aktywny z tłem rgba(0,0,0,.05).

**Bloki kalendarza:** tło w kolorze kategorii o przezroczystości `12`, ramka 1px w kolorze kategorii o przezroczystości `4d`, równy padding. Bez paska po lewej. Zaznaczenie to pierścień `0 0 0 2px #fff, 0 0 0 4px kolor+66`.

**Telefon (blok CM-BASE w każdym CM*):** cele dotykowe 44 px, arkusz od dołu (`dlg` z zaokrągleniem 16 px u góry i uchwytem), krok +/− 44 px, FAB 56 px nad paskiem zakładek, wiersze listy 48 px.

## Podejścia (rozważone)

| | Podejście | Za | Przeciw |
|---|---|---|---|
| **A — wybrane** | Etapami z pilotem: fundamenty i pilot, ocena, potem reszta webu modułami, potem telefon. | Wczesna ocena w prawdziwej aplikacji. Poprawki fundamentów przechodzą na resztę. Ryzyko rozłożone. | Przejściowo mieszany styl między etapami. |
| B | Globalna podmiana tokenów i kontrolek naraz, potem dopieszczanie. | Najszybciej „mniej więcej” COSS wszędzie. | Jeden duży skok bez momentu na ocenę. Długo stan „prawie”. |
| C | Każdy ekran przepisany od zera z makiety. | Każdy ekran od razu dokładny. | Powtarzana praca, rozjazdy między ekranami, najdroższe. |

Mejson wybrał **A** (2026-11-20).

## Etapy

Każdy etap ma osobny plan (`docs/superpowers/plans/`), osobną gałąź i realizację subagent-driven. Do main trafia dopiero po akceptacji Mejsona.

### Etap 1 — fundamenty + pilot (gałąź `feat/coss-pilot`)

1. **Makiety w repo:** skopiować wszystkie C* i CM* z kanwy do `docs/design/mockups/` wraz z arkuszem COSS i fontem Inter, tak żeby podgląd działał offline. Zaktualizować README (wzorcem są C*/CM*, stare pliki to archiwum). Stare pliki zostają.
2. **Tokeny:**
   - `globals.css` dostaje tokeny COSS z tabeli wyżej oraz zmapowane zmienne shadcn i `@theme`: kolory, promienie (`--radius` 10 px plus nazwane dla karty, ramki i menu) i cienie (`shadow-xs`, `shadow-lg`).
   - Font Inter z paczki `@fontsource-variable/inter` (z `cv11`) zamiast Geist Sans. Build działa offline. Geist Mono zostaje do `mono`.
3. **Kolory i promienie wpisane na sztywno → tokeny, w całej aplikacji:**
   - Mechaniczna zamiana starych wartości na klasy tokenów według jednej tabeli mapowania, na przykład `[#171717]` → `foreground`/`primary`, `[#eaeaea]` → `border`, `[#666666]`/`[#6b6b6b]` → `muted-foreground`, `[#f5f5f5]` → `muted`.
   - Kolory kategorii i danych (paleta kategorii, heatmapa, wykresy) zostają jako dane, nie jako tokeny.
   - Po tym kroku cała aplikacja przechodzi na paletę COSS. Układy zostają stare.
4. **Kontrolki:**
   - Przestylować `src/components/controls/*` i `src/components/ui/*` na wygląd COSS (warianty i rozmiary jak wyżej, telefon 44 px). API komponentów zostaje bez zmian, więc ekrany nie wymagają przeróbek.
   - Dodać brakujące prymitywy, gdy pilot ich potrzebuje: Card (nagłówek, treść, stopka), Badge w wariantach COSS, Kbd, Avatar, Empty, Alert. Każdy w jednym pliku, bez helperów rozrzuconych po plikach.
5. **Pilot ekranów, dokładnie jak makiety:**
   - sidebar (`CSidebar`) z menu konta i menu strony (`CPageMenu`),
   - nagłówek modułu,
   - Dziś (`CToday`, `CEmptyToday`),
   - (szybkie dodawanie i ⌘K na webie nie istnieją jeszcze w aplikacji, w pilocie tylko wyłączone pole „Szukaj…” w sidebarze; `CQuickAdd`/`CCommandK` wejdą razem z tymi funkcjami),
   - toasty.
   - Telefon w pilocie dostaje tylko tokeny i kontrolki. Układy CM* przychodzą w Etapie 3.

Akceptacja: Mejson ogląda aplikację i mówi „pasuje”. Poprawki tokenów i kontrolek robimy jeszcze w tym etapie.

### Etap 2 — reszta webu (jedna gałąź na moduł albo grupę)

Kolejność: kalendarz (C* kalendarza i dialogi) → nawyki i sen → sport → strony i tabele (CNewPage, CEmptyPage, CMain/CBooks/CProjects/CWebsites, kolumny, filtr, pola, ikony) → sejf → ustawienia → start i konto (login, rejestracja, reset, e-mail, onboarding, 404).

### Etap 3 — telefon

Ekrany `mobile/` i odpowiedzi `max-[799px]:` zgodne z CM*: pasek zakładek, Dziś, kalendarz, nawyki, sport, strony, edytor, sejf, ustawienia, start i onboarding.

## Ograniczenia (z projektu)

- Next.js 16 + Supabase + Tailwind 4 + shadcn/radix-ui. Żadnych nowych bibliotek UI, czyli nie instalujemy COSS UI. Odwzorowujemy jego wygląd we własnych komponentach.
- Makiety są wiążące i w sprawach wyglądu wygrywają z planem.
- Płaski kod bez helperów skaczących po plikach. Komentarze po polsku, jak w reszcie repo.
- Testy jednostkowe i e2e muszą przechodzić. e2e działa tylko w CI (`gh run list --branch …`), bo nie ma lokalnego Supabase.
- Testy sprawdzające konkretne klasy kolorów aktualizujemy razem ze zmianą. Testów zachowania nie zmieniamy.
- Commity tylko na gałęziach, merge do main po akceptacji Mejsona.

## Decyzje Claude (do sprawdzenia przez Mejsona)

- Zamiana kolorów wpisanych na sztywno na tokeny obejmuje **całą aplikację już w Etapie 1**, a nie tylko pilot. Bez tego późniejsze zmiany tokenów niczego nie przestawią. Efekt uboczny: po Etapie 1 wszystkie ekrany mają nową paletę i font, ale stare układy.
- Inter z paczki npm `@fontsource-variable/inter`, a nie z `next/font/google` ani z bloba kanwy, bo build ma działać bez dostępu do Google Fonts.
- Stare makiety zostają w repo i na kanwie jako archiwum, nic nie usuwamy.
- **Pobranie makiet:** pliki C*, CM*, `canvas.json`, arkusz COSS i font Inter pobiera z kanwy koordynator (Claude, który ma narzędzia artefaktów). Robi to przed pierwszym zadaniem i commituje je na gałęzi. Wykonawcy pracują już na kopiach w repo.
- **Ocena pilota:** Mejson ogląda pilot na podglądzie Vercel gałęzi `feat/coss-pilot`, z prawdziwym logowaniem i swoimi danymi, tak jak przy wcześniejszych etapach. Nie potrzeba dodatkowego środowiska.
- **API kontrolek:** wolno je rozszerzać o nowe warianty i rozmiary (np. `destructive-outline`, `xs`/`sm`/`lg`, tony odznak), byle bez łamania istniejących wywołań. Usuwanie i zmiana znaczenia istniejących propsów są zabronione.
- **Kolory danych kontra UI:** skrypt zamiany działa na liście mapowania obejmującej tylko szarości i kolory UI: tekst, ramki, tła, primary, destructive i success. Kolory kategorii, heatmapy i wykresów nie są na tej liście i zostają nietknięte. Każdy plik po zamianie przechodzi przegląd diffu. Wspólny hex, np. #15803d jako „success” i jako kolor kategorii, zamieniamy tylko w klasach UI (`text-`/`bg-`/`border-` kontrolek i stanów), a nie w tablicach palet.
- **Różnice funkcjonalne makieta–aplikacja:** wykonawcy wpisują je do raportu zadania, a koordynator zbiera je w sekcji „Do decyzji” w opisie PR i zgłasza Mejsonowi w czacie. Aplikacja zostaje bez zmian, dopóki Mejson nie zdecyduje.

## Co zostaje dla wykonawcy (planu)

- Dokładna tabela mapowania starych hexów i promieni na tokeny oraz sposób przeprowadzenia zamiany (skrypt i przegląd).
- Podział Etapu 1 na zadania i kolejność.
- Które testy aktualizować.
- Szczegóły odwzorowania każdej kontrolki z arkusza COSS.
