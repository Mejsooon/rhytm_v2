# Onboarding w 4 krokach (pakiet „Ustawienia, kosz i nowe ekrany”, część C)

## Po co
Dzisiejszy kreator ma 7 ekranów. Makiety `S2OnboardingFlow` i `CMOnboarding` skracają go i kończą realnym planem dnia. Są wiążące razem ze skryptem.

## Decyzje Mejsona (2026-11-27, 28)
- Bez kroku z kalendarzami, więc zostają 4 kroki: **Profil, Do czego, Pierwszy dzień, Przypomnienia**.
- Web i telefon naraz.
- Wybór w „Do czego” nie ukrywa modułów.
- „Przed blokiem” zostaje 5 minut.

## Zakres
1. **Profil:** imię (wymagane), opcjonalne zdjęcie, „Wykryte z przeglądarki” ze strefą, początkiem tygodnia i zegarem pod „Zmień”.
2. **Do czego:** pigułki w grupach „Plan dnia”, „Ruch”, „Reszta” i cele na tydzień dla wybranych (bieganie w km, siłownia w treningach, sen w godzinach).
3. **Pierwszy dzień:** podpowiedzi bloków z wyborów, edycja godzin, własny blok; „Dalej” zapisuje je jako bloki na dziś. Można pominąć.
4. **Przypomnienia:** zgoda przeglądarki, trzy przełączniki, opcjonalnie „Skąd o nas wiesz?”; „Zacznij korzystać” prowadzi na Dziś.

Układ z makiet: kroki w nagłówku, „Wstecz” / „Pomiń” / „Dalej”, podgląd obok karty (web).

**Co robią wybory**
- Kategorie: Studia → Studia; Praca → Praca; Klienci i zlecenia → Projekty; Dom i sprawy → Dom; bieganie, siłownia, inne sporty → Sport; nic z tego → Dom.
- Strony: Subskrypcje → Subscriptions; Projekty albo Klienci i zlecenia → Projects; Książki → Books.
- Cele: bieganie → cel w km; siłownia → cel liczby treningów; sen → cel snu. Bez biegania i siłowni cele treningowe zostają domyślne.

## Bez migracji
Wybory trafiają do istniejącej `profiles.roles`, postęp do `onboarding_step` (kroki 1–4). Konta po onboardingu nic nie zauważą. Konto w połowie starego kreatora wznawia od kroku nie dalszego niż 4.

## Podejścia
- **Przebudowa istniejącego kreatora (wybrane):** te same trasy `/onboarding/[krok]`, zapis i wznawianie; stare kroki znikają.
- Jeden ekran bez tras, zapis na końcu: prostszy kod, ale odświeżenie gubi dane.
- Nowy kreator obok starego: dwa przebiegi do utrzymania.

## Decyzje Claude'a (do potwierdzenia)
| Decyzja | Koszt pomyłki |
|---|---|
| Strefa czasowa z pełnej listy, nie trzech miast z makiety | inny wygląd jednego pola |
| Znika ekran podsumowania i wybór strony „Websites” (nie ma ich w makiecie) | stronę można dodać później z „Nowa strona” |
| Pole „kierunek studiów” przestaje być zbierane | danych z tego pola nie będzie |
| Cofnięcie się do „Pierwszego dnia” pokazuje zapisane bloki jako dodane i ich nie powiela; edytuje się je w kalendarzu | brak edycji bloku po zapisie w kreatorze |
| Bloki zapisują się jednorazowe, z przypomnieniem | powtarzanie trzeba ustawić w kalendarzu |
| „Skąd o nas wiesz?” w ośmiu opcjach z makiety (znikają X i Reddit) | uboższa statystyka |

## Poza zakresem
Google Calendar i inne kalendarze, ukrywanie modułów, przypomnienie 10 min, podsumowanie tygodnia.

## Co zostaje dla wykonawcy
Układ plików; testy kroków, zapisu (w tym bloków) i wznawiania; e2e onboardingu przepisane na 4 kroki.
