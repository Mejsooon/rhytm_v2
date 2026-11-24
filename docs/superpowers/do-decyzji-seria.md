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
