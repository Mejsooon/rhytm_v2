# Makiety rhytm (wzorzec wyglądu)

Klikalne ekrany aplikacji (web i telefon `M*`) skopiowane z płótna „Rhytm Design”.
Implementacja ma wyglądać **identycznie** jak te ekrany.

**Od 2026-11-20 wiążące są makiety COSS:** `C*.dc.html` (web) i `CM*.dc.html` (telefon), ze wspólnym
arkuszem `coss/coss.css`. Stare pliki bez prefiksu `C` (web i `M*`) to **archiwum**, tylko do porównania.
**Od 2026-11-23 dla Stron 2.0 wiążące są makiety `S2*.dc.html`** (spec `docs/superpowers/specs/2026-11-22-strony-2-design.md`, punkt 15). Wygrywają z odpowiednikami `C*`. `S2Today` i `S2EmptyToday` należą do projektu Dziś, a `S2Main` (Subscriptions) do projektu Subscriptions.

**2026-11-26: pełne odświeżenie z kanwy** (95 plików zmienionych, 79 nowych). Kanwa ma teraz trzy strony makiet:
„Web Design” (`S2*`, wiążące dla całego webu — m.in. `S2Table` jako jedna makieta wszystkich tabel, kalendarz
z warstwami i panelem dnia, nowy Sport z „Dodaj aktywność”, Plan Free/Pro, kosz, import CSV), „Mobile Design”
(`CM*`) i „Trener — propozycje” (`Tr*`, jeszcze nie do wdrożenia). Lista różnic: dziennik `docs/superpowers/dziennik/2026-11-26.md`.

Ekrany C* są kopiowane z kanwy etapami: każdy etap przejścia na COSS (spec
`docs/superpowers/specs/2026-11-20-coss-ui-design.md`) dokłada makiety, których potrzebuje.

Podgląd: `npx serve docs/design/mockups` i otwórz `index.html` (spis ekranów w grupach).

- `*.dc.html` — jeden plik na ekran; szablon w `<x-dc>`, dane i interakcje w `<script data-dc-script>`.
- `support.js` — mały runtime, który renderuje szablony (tylko do podglądu makiet, nie do aplikacji).
- Źródło: https://claude.ai/artifact/KvjE15fBZZYBKr1gkScxdJ · Figma Make: https://www.figma.com/make/Uff5jAlN1nfHtoiacBVu5K
