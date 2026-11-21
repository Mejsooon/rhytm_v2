# Etap 2f — Ustawienia w wyglądzie COSS (krótki projekt)

Część migracji wyglądu z `docs/superpowers/specs/2026-11-20-coss-ui-design.md`. Gałąź `feat/coss-ustawienia`.

## Cel i powód
Ustawienia (web) wyglądają jak wiążące makiety COSS, tak jak po etapach 2c (Sport) i 2d (Strony). Funkcjonalnie nic się nie zmienia: te same dane, walidacje, zapisy i teksty co dziś. Etap kończy mieszany styl w Ustawieniach.

## Zakres
Makiety: `CSettings.dc.html` (Ogólne), `CSettingsAccount.dc.html` i `CSettingsNotifications.dc.html` (tylko nawigacja, nagłówek i układ strony), `CCategoryDialog.dc.html` (okno kategorii).

1. Układ strony Ustawień (`src/app/(app)/ustawienia/[zakladka]/page.tsx`): okruszki „Ustawienia / {zakładka}”, nagłówek zakładki z podtytułem jak w makiecie (np. Ogólne: „Profil, cele i podstawowe preferencje aplikacji.”), szerokości i odstępy kolumn wg makiet.
2. Nawigacja zakładek (`settings-tabs.tsx`): wysokość 32 px, zaokrąglenie 8 px, hover i stan aktywny wg makiety (kolory z tokenów).
3. Ogólne: karty Profil (z wierszem zdjęcia), Cele i Kosz w stylu kart z makiety — nagłówek karty z opisem, wiersze z separatorami, stopka „Cofnij / Zapisz” z „Masz niezapisane zmiany.” i „Zapisano ✓” (zasada kart z §6.11 speca aplikacji), błędy pod polem.
4. Kategorie kalendarza: karta listy w tym samym stylu kart; okno dodawania/edycji kategorii wg `CCategoryDialog` (nagłówek z opisem, nazwa, siatka kolorów z wyblakłymi zajętymi, podgląd bloku, „Anuluj / Dodaj kategorię”).
5. Zakładki Konto i bezpieczeństwo oraz Powiadomienia: nadal informacja „Ta zakładka powstanie w kolejnym etapie.”, ale w układzie i stylu COSS (pusty stan w karcie), z nagłówkiem zakładki.
6. Zakładka Sejf: tylko dopasowanie do wspólnego nagłówka i odstępów (karta została zrobiona w etapie sejfu).

## Poza zakresem (non-goals)
- Karty „Konto” (e-mail, hasło, sesja) i „Usuń konto” z makiety `CSettings` — zostają tylko na makiecie do etapu 10 (decyzja Mejsona: wariant A).
- Funkcje zakładek Konto i bezpieczeństwo (etap 10) i Powiadomienia (etap 9).
- Układy telefonu `CMSettings` — Etap 3. Na telefonie nic nie może się zepsuć (dzisiejszy układ `max-[799px]:` zostaje działający, cele ≥ 44 px).

## Anty-cele
- Zmiana zachowania: walidacji (nazwa wymagana, waga 30–250, wzrost 120–230, cele treningowe 1–14 i km 1–300, „Włącz co najmniej jeden cel.”), zapisów, uprawnień albo tekstów, które już działają.
- Utrata danych przy edycji karty (niezapisane zmiany, „Cofnij”).
- Kolory spoza tokenów (`node scripts/coss-kolory.mjs --check`).

## Podejścia
- **A — tylko wygląd (wybrane przez Mejsona).** Ogólne, Kategorie, nawigacja i puste zakładki w COSS. Mały etap zgodny z planem migracji.
- B — wygląd + funkcje Konta i bezpieczeństwa (zmiana hasła/e-maila, sesje, eksport, usunięcie konta). Odrzucone: to etap 10, skala zbliżona do sejfu.
- C — wszystko z powiadomieniami push. Odrzucone: etapy 9 i 10 naraz.

## Ograniczenia
Konwencje COSS z poprzednich etapów: kontrolki z `@/components/controls` (`FIELD`, `Button`, `FormDialog`, `StatusBadge`, `Progress`, menu), focus `focus-visible:shadow-focus outline-none`, disabled `opacity-[.64]`, telefon `max-[799px]:` z celami ≥ 44 px, kod płaski bez funkcji pomocniczych, porównanie wizualne z makietą przez tymczasową trasę.

## Decyzje Claude'a (do sprawdzenia przy czytaniu)
- Kosz zostaje w Ogólnych (jest w §6.11 speca aplikacji), choć makieta COSS go nie pokazuje — w stylu pozostałych kart.
- Karta listy kategorii nie ma makiety COSS — w stylu kart Ogólnych; zachowanie bez zmian.
- Podtytuły zakładek bez makiety (Kategorie, Sejf) — z makiet, jeśli są; inaczej krótki opis w stylu Ogólnych, wypisany w tabeli „Do decyzji”.

## Zostawione wykonawcy
Dokładne odstępy, rozmiary i kolejność elementów — wg zrzutów makiet (`PW_CHANNEL=chrome pnpm mockups:shots CSettings` itd.).
