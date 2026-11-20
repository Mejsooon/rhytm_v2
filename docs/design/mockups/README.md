# Makiety rhytm (wzorzec wyglądu)

Klikalne ekrany aplikacji (web i telefon `M*`) skopiowane z płótna „Rhytm Design”.
Implementacja ma wyglądać **identycznie** jak te ekrany.

**Od 2026-11-20 wiążące są makiety COSS:** `C*.dc.html` (web) i `CM*.dc.html` (telefon), ze wspólnym
arkuszem `coss/coss.css`. Stare pliki bez prefiksu `C` (web i `M*`) to **archiwum**, tylko do porównania.
Ekrany C* są kopiowane z kanwy etapami: każdy etap przejścia na COSS (spec
`docs/superpowers/specs/2026-11-20-coss-ui-design.md`) dokłada makiety, których potrzebuje.

Podgląd: `npx serve docs/design/mockups` i otwórz `index.html` (spis ekranów w grupach).

- `*.dc.html` — jeden plik na ekran; szablon w `<x-dc>`, dane i interakcje w `<script data-dc-script>`.
- `support.js` — mały runtime, który renderuje szablony (tylko do podglądu makiet, nie do aplikacji).
- Źródło: https://claude.ai/artifact/KvjE15fBZZYBKr1gkScxdJ · Figma Make: https://www.figma.com/make/Uff5jAlN1nfHtoiacBVu5K
