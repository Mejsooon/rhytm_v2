# „Do decyzji” — seria autonomiczna (od 2026-11-24)

Decyzje podjęte przez Claude bez Mejsona w serii Dziś → Subscriptions → sprzątanie → telefon.
Każdy punkt: co wybrano, dlaczego, koszt pomyłki (ile pracy, żeby to zmienić).

## Projekt Dziś
| # | Decyzja | Dlaczego | Koszt pomyłki |
|---|---|---|---|
| 1 | Usunięcie bloku, wystąpienia albo serii **usuwa** jego zadania; zmiana wzorca powtarzania przenosi zadania tylko na dni, które zostają w serii, resztę usuwa; przesunięcie bloku jednorazowego przenosi zadania razem z nim. | Zadanie musi należeć do bloku, więc nie ma gdzie go „odpiąć”. | Średni: usuniętych zadań nie da się odzyskać; zmiana na inne zachowanie = nowa migracja funkcji `split_block_series`. |
| 2 | Szybkie dodawanie na telefonie nie ma już rodzaju „Zadanie” (zostały Blok, Bieg, Nawyk); w dymku bloku zniknęło „Odepnij”. | Zadanie bez bloku jest niemożliwe. | Niski. |
| 3 | Nawyki „X razy w tygodniu” widać na Dziś każdego dnia; nawyki z wyłączonym „Pokaż na Dziś” są ukryte. | Tak jak na telefonie. | Niski. |
| 4 | „Nawyki N % dni z celem” = ten sam procent co dawny kafelek tygodnia. | Makieta nie definiuje liczenia. | Niski: jedna funkcja. |
| 5 | Wyłączony cel treningów/km → wiersz bez „/ cel”, pusty pasek i „—”. | Makieta pokazuje tylko wariant z celem. | Niski. |
| 6 | Przerwa ≥ 3 h jest „wysoka”; kliknięcie przerwy otwiera „Nowy blok” od najbliższej pełnej godziny. | Makieta: 8 h i 7 h wysokie, 1 h 30 min niskie. | Niski. |
| 7 | Nawyki zawsze w 4 kolumnach (jak makieta), długie nazwy ucięte. | Makieta wygrywa. | Niski. |
| 8 | Ekran Dziś na telefonie zostaje stary do Etapu 3 (tylko bez luźnych zadań). | Zakres projektu. | Brak. |

## Subscriptions
Pełna tabela decyzji D1–D18 z kosztem pomyłki: `docs/superpowers/specs/2026-11-24-subscriptions-design.md`, sekcja „Decyzje Claude”. Najważniejsze:
| # | Decyzja | Koszt pomyłki |
|---|---|---|
| 1 | Tylko cykle miesiąc i rok (bez tygodnia i kwartału z S2AddField). | Niski, bez migracji. |
| 2 | „Data odnowienia” to osobny typ pola; w bazie zostaje pierwsza data serii, wszędzie widać następne odnowienie (31.01 → 28.02 → 31.03). | Średni. |
| 3 | Kalendarz pokazuje tylko odnowienia; terminy Projects dalej nie (opis szablonu Projects obiecuje kalendarz). | Średni: mały pakiet później. |
| 4 | „Subscriptions” w menu „Kategorie” kalendarza przełącza „Pokaż w kalendarzu” pola, nie jest kategorią systemową. | Niski. |
| 5 | Onboarding bez Subscriptions (makieta S2OnboardingPages go nie ma). | Niski. |
| 6 | Pomarańczowa odznaka przy 0–10 dniach do odnowienia (jak S2Main). | Niski. |
| 7 | Migracja Subscriptions idzie zaraz po scaleniu (wstecznie zgodna, nic nie usuwa). | Niski. |
| 8 | Ponowny wybór daty, która już należy do serii, nic nie zapisuje (żeby seria nie „dryfowała”). | Niski. |

## Sprzątanie uwag webu

## Etap 3: telefon

### Pakiet fundament

| Decyzja | Dlaczego | Koszt pomyłki |
|---|---|---|
| T1–T6 ze specu telefonu (wspólne drzewo web/telefon, CM-BASE jako `@utility`, bez paska statusu, 5 zakładek bez Haseł, Szybkie dodawanie bez zadania, jedno okno usuwania) | spec `specs/2026-11-24-telefon-design.md` | niski–średni, opisane w specu |
| Tło za arkuszem na telefonie bez rozmycia (makieta ma blur) | odłożona uwaga z Etapu 1: wydajność na telefonie | niski: jedna klasa |
| Okno „Usunąć nawyk?” na webie przeszło na wspólne `ConfirmDialog` (400 px zamiast 460, bez ✕) | jedno okno usuwania w całej aplikacji (plan, T6) | niski: drobna zmiana wyglądu webu |
| Przyciski okna usuwania na telefonie obok siebie (Anuluj · Usuń, 44 px) | makieta CMDeleteBlock wygrywa z planem (kolumna 48 px) | niski |

## Ustawienia i sejf — web (24.11, na prośbę Mejsona)
Pełna lista C1–C18 w `specs/2026-11-24-ustawienia-web-design.md`. Najważniejsze:
| # | Decyzja | Koszt pomyłki |
|---|---|---|
| 1 | Zamknięty sejf bez tytułu „Hasła”; okruszki i tabela pod rozmyciem, okno odblokowania na środku (bez `aria-modal`). | Niski. |
| 2 | Usunięcie konta: oznaczenie + 30 dni, ekran „Przywróć konto” po zalogowaniu, purge przez pg_cron 03:41 UTC; zdjęcie profilowe kasowane od razu. | Średni: po 30 dniach dane nie do odzyskania. |
| 3 | Przypomnienia ujednolicone do makiety: 5 min przed blokiem, dzień przed odnowieniem o 9:00 — migracja nadpisuje też wybrane wcześniej 10/15/30 min i 3 dni. | Niski. |
| 4 | `secure_password_change` (zmiana hasła z kodem OTP) wyłączone; obecne hasło sprawdza funkcja w bazie z limitem 5 prób / 15 min. | Wysoki przy skradzionej sesji: można zmienić hasło przez API bez obecnego. |
| 5 | Brak kluczy VAPID nie wyszarza rodzajów i przypomnień (zapis ustawień działa). | Niski. |
| 6 | Klucze urządzeń push nie trafiają do eksportu JSON. | Niski. |
| 7 | Konto Google z hasłem ustawionym linkiem może zmienić e-mail. | Niski. |
| 8 | Migracje idą po wdrożeniu kodu (kod działa na starej bazie). | Niski. |

### Pakiet kalendarz

| Decyzja | Dlaczego | Koszt pomyłki |
|---|---|---|
| Dzień na telefonie bez strzałek poprzedni/następny; inny tydzień przez Tydzień/Miesiąc | makieta CMCalendarDay ich nie ma | niski: dłuższa droga do innego tygodnia |
| Tydzień na telefonie zachowuje strzałki poprzedni/następny; „Kategorie” tylko w dniu | bez strzałek nie ma nawigacji między tygodniami; makiety tygodnia/miesiąca nie mają „Kategorii” | niski |
| Przy usuwaniu serii napis „Usunięte wystąpienia znikną razem z zadaniami.” (makiety poprawione) | zadania kasują się z blokiem — stare zdanie było nieprawdziwe | niski |
| „Powtarzaj do” jako wybór daty (z „Wyczyść”) zamiast chipa | chip nie ma skąd wziąć daty | niski |
| Pasek dnia „Zaplanowane · wolne (8–20) · zadania” liczy też treningi Sportu | treningi zajmują czas dnia | niski |
| W Dziś arkusz edycji bloku też ma „Usuń blok” | Dziś używa tego samego arkusza | niski |
| W szczegółach bloku na telefonie bez paska postępu i bez usuwania zadań (usuwanie w edycji) | makieta CMBlockDetail | niski |
