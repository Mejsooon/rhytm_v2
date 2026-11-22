# Etap 2g — logowanie, konto i onboarding w wyglądzie COSS (krótki projekt)

Część migracji wyglądu z `docs/superpowers/specs/2026-11-20-coss-ui-design.md` („start i konto”). Gałąź `feat/coss-start`. Zatwierdzone przez Mejsona 2026-11-22.

## Cel i powód
Ekrany przed wejściem do aplikacji (logowanie, rejestracja, reset hasła, potwierdzenia, 404) i onboarding wyglądają jak wiążące makiety COSS. Funkcjonalnie nic się nie zmienia: Google OAuth, Turnstile, walidacje, przekierowania, zapisy onboardingu, teksty i kroki zostają. Strony „Start” nie ma — `/` zawsze przekierowuje (route-guard).

## Zakres
| Część | Makieta (wiążąca) | Pliki dziś |
|---|---|---|
| Logowanie | `CLogin` | `src/app/(auth)/logowanie`, `src/features/auth/login-form.tsx`, `src/components/auth/*` |
| Rejestracja | `CRegister` | `src/app/(auth)/rejestracja`, `register-form.tsx` |
| Reset hasła (prośba) | `CForgot` | `src/app/(auth)/reset-hasla` |
| E-mail potwierdzony i „Link wygasł” | `CEmailConfirmed` (dwie karty: lewa = potwierdzono, prawa = link wygasł) | `src/app/(auth)/potwierdzono`, `src/app/(auth)/link-wygasl`, `link-expired.tsx` |
| 404 | `CNotFound` | `src/app/not-found.tsx` |
| „Sprawdź skrzynkę”, „Nowe hasło” | brak — styl karty z `CForgot`/`CEmailConfirmed` (decyzja Claude'a) | `check-inbox.tsx`, `new-password-form.tsx`, `src/app/(auth)/nowe-haslo` |
| Onboarding (7 kroków) i podgląd | `COnboarding`, `COnboardingRole`, `COnboardingSource`, `COnboardingGoals`, `COnboardingPages`, `COnboardingNotify`, `COnboardingDone`, `COnbPreview` | `src/app/(onboarding)`, `src/features/onboarding/*` |

Wspólny układ ekranów konta: logo „rhytm” w lewym górnym rogu, przycisk w prawym („Załóż konto” / „Zaloguj się”), karta ~400 px na środku. Onboarding: pasek górny (logo, „Krok N z 7”, „Wyloguj”), ramka z 7-segmentowym paskiem postępu, kolumna kroku z nagłówkiem i stopką „Wstecz / Dalej”, podgląd na żywo po prawej.

## Poza zakresem (non-goals)
- Układy telefonu (`CMLogin`, `CMRegister`, `CMForgot`, `CMOnboarding`) — Etap 3. Na telefonie nic nie może się zepsuć, cele ≥ 44 px.
- Elementy makiet, których aplikacja nie ma lub które opisują nieistniejące funkcje (np. „Ctrl K” w ostatnim kroku — szybkie dodawanie jeszcze nie istnieje; zostaje dzisiejszy tekst).

## Anty-cele
- Zmiana zachowania: logowania, OAuth, Turnstile (sprawdzanie po stronie serwera), walidacji haseł, przekierowań, zapisu szkicu i kroków onboardingu, uprawnień powiadomień.
- Utrata dostępności formularzy (etykiety, `autoComplete`, komunikaty `role="alert"`).
- Kolory spoza tokenów (`node scripts/coss-kolory.mjs --check`).

## Podejścia
- **Tylko wygląd, jak w 2f (wybrane).** Jedyna sensowna droga: funkcje istnieją, makiety są wiążące.
- Odrzucone: przy okazji dodawanie funkcji z makiet (np. skrót Ctrl K) — to osobne etapy.

## Ograniczenia
Konwencje COSS z poprzednich etapów: kontrolki z `@/components/controls` (`Card`, `FIELD`/`TextField`, `Button`, `Checkbox`, `Dropdown variant="select"`, `Stepper`, `StatusBadge`, segmenty), fokus `focus-visible:shadow-focus outline-none`, wyłączone `opacity-[.64]`, telefon `max-[799px]:` z celami ≥ 44 px, bez `font-mono` w treści, kod płaski bez funkcji pomocniczych, wspólne kontrolki tylko z opcjonalnymi wariantami (domyślny wygląd bez zmian), porównanie wizualne z makietą przez tymczasową trasę.

## Zostawione wykonawcy
Dokładne odstępy, rozmiary i kolejność elementów — wg zrzutów makiet (`PW_CHANNEL=chrome pnpm mockups:shots <Nazwa>`).
