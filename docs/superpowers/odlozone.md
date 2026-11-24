# Odłożone drobne uwagi z przeglądów (najnowsze sekcje na dole; górne linie to surowy ledger etapu 1–2a)

Task 1: complete (commits 3410de0..f502137, review clean; minor: tokens.test file-wide regex, dead geist mock in sonner.test — parked as nits)
Task 2: dispatched (BASE f502137, impl ac23f8ef63d5d20f5, sonnet). Ruling: ring/outline hex → border column except #171717→ring; shadow/gradient/var hex out of scope — plan silent, keeps focus rings consistent — costs a few manual fixes later
Task 2: complete (commits f502137..27d5d80, review clean; minors parked: brak testu mapSource toHaveClass/ring, button.test substring+nazwa → Task 3 przepisze button.test; heatmap text-soft-foreground do wizualnej kontroli w final review)
Task 3: dispatched (BASE 27d5d80, impl a03a1ed46254301c9, sonnet). Ruling: focus ring = focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--ring)]; disabled opacity .64 — plan leaves choice; matches coss.css — cheap to change
Task 3: minor (deferred): ui/input text 15px on phone (<16px → iOS zoom for ui/Input users)
Task 3: minor (deferred): disabled:pointer-events-none dropped (matches coss.css)
Task 3: minor (deferred): no tests for FIELD/Dropdown popup/ui/*; Dropdown compact 28px on phone (pre-existing)
Task 4: minor (deferred): stepper phone overflow-hidden clips focus ring; chip disabled hover; segment no flex-wrap; no tests for Stepper/Checkbox size/Switch disabled; StatusBadge callers lost font-mono (dropdown, step-pages, step-notify) — visual check in final
Task 5: dispatched (BASE c6b079a, impl a4dbc35b05b49327e, sonnet). Ruling: phone sheets keep layout, only colours/radii; page-menu/account-popover only MENU_* swap — phone layouts are Stage 3, Task 7 owns those files
Ruling: ActionPopover default padding back to p-2.5, menu popovers pass p-1 — .pop has no padding, .ddpop/menus 4px; content popovers need room — costs callers one className
Task 5: minor (deferred): form-dialog backdrop blur on phone unconfirmed vs mockup
Task 5: minor (deferred): ui/dialog DialogContent p-6 doubles header/footer padding + footer radius at all widths (ui/dialog has no consumers — latent)
Task 6: minor (deferred): Card lacks .card inset bottom line (inset 0 -1px 0 rgba(0,0,0,.04)); Avatar aria-hidden w/o label; EmptyState title <p>; no tests Kbd/Avatar/EmptyState
Task 7: dispatched (BASE ac85e6c, impl ae33cad980eb22c94, opus — visual fidelity pilot). Rulings: web only; .sb-i text rgba(38,38,38,.72) arbitrary ok; mockup-only features → Do decyzji
Ruling: keep „Moduły / X” crumb (no-text-change constraint + CEmptyToday) styled as .crumb; CToday title-only → Do decyzji — cost: header differs slightly from CToday
Task 7: minor (deferred): sidebar inline wordmark duplicates RhytmLogo withWordmark; page-menu builds both icon sets per render
Task 7: minor (deferred): task-7-report „Do decyzji” #1 and screenshot notes stale re. header (crumb now restored)
Task 8: minor (deferred): 5× hex #525252/#404040 → soft-foreground/foreground; selected+focused block loses focus ring; EmptyState [&>p] selectors; phone BlockDetails sheet now black Progress/primary checkbox (tokens+controls, expected)
Final review: Important #1 focus rings /20 invisible, #2 5 hex; fix wave dispatched with minors 3,4,5,6,8,14. Deferred to Stage 2/3: 9,10,11,12,13,15,16; #7/#17 → Mejson
Final fix wave: f54f88b, re-review all 8 ADDRESSED; parked: chip disabled:hover:bg-white beats selected hover (latent, no disabled chips) — Ruling: defer to Stage 2 — no caller passes disabled — cost: white hover on a future selected+disabled chip
Decisions round (Mejson approved 7 points): impl a652ccefed1d3ca57, BASE f54f88b. Ruling: now-label via new token destructive-strong #dc2626; EmptyToday header also title-only (consistency) — cost: one more token
Ruling: keep CardTitle h2 („Dzień w liczbach”, same text, mockup h2) → Do decyzji — cost: one more heading in a11y tree
Task 1: minor (deferred): today in mini calendar now border-strong outline (DatePicker style) — accepted
Task 2: minor (deferred): `ciasny` rule (<30 min no top/bottom border) not in mockup, double border on stacked 30-59 min blocks — final review to triage; day wrapper left-2→left-1 (+4px hit zone); focus outline covers selection ring band
Task 3: complete (02eee05..115036a, review clean). Renewal preview not built — app has no renewals in calendar (verified) → Do decyzji.
Ruling: month selection ring without #fff gap per month mockup/brief (constraints text describes week grid) — cost: none visible
Task 3: minor (deferred): planned training chip inline #ffffff; active-day ring-2 ring-ring ring-inset old style; no test for uncategorised selected chip
Task 4: minor (deferred): delete-block-dialog Trash2 icon + scope Info icon not in Do decyzji; duplicated class ternary pb-4/pb-5; React import for CSSProperties; scope-dialog phone radio restyled (16px custom)
Final review: Important = process (CI, Do decyzji list) → controller; fix wave minors 1,2,6,9 dispatched
Decisions round 2a (A–E per Mejson): impl a83bf11e00c6b16a5, BASE ce87588; point 1 (renewals) deferred as separate feature; 6,8,9 unchanged
Task 1: impl bf0f647 (DONE_WITH_CONCERNS: heat-2 = #4ade80 as in CHabits AND old Habits — kept per mockup, PO muted-green wish → Do decyzji); review next
**[naprawione 24.11, sprzątanie webu]** Task 1: minor (deferred): month heatmap cell focus outline overlaps ring band (offset-4); week-grid test parentElement chain fragile; --heat-2 #4ade80 → Do decyzji
Task 2: minor (deferred): mood seg duplicates Segment shadow literal rgba; bar fill border-strong .16 vs mockup .12; tooltip div structure
Ruling: keep szare = bg-panel (legend true, info preserved) over mockup's all-white — cost: slight deviation from CHabitDetail
Task 3: minor (deferred): today ring added (mockup) — accepted; phone branches interleaved in habit-month; out-of-month text faint/50 contrast
Ruling: plan Task 4 colour picker does not exist (no colour in Habit model/mockup) — skipping is correct — plan defect, no cost
Task 4: minor (deferred): phone Segment overflow in habit dialog (pre-existing, Stage 3); .btnp shadow literal duplicated
Final review: Important #1 phone delete dialog leak → fix; #2 heat-2 → Do decyzji to Mejson; fix wave 1–3 dispatched

## Z Etapu 2c (Sport), 2026-11-21
- `.seg` skopiowany w run-dialog.tsx i template-editor.tsx (aria-pressed / wielokrotny wybór) — rozszerzyć `Segment` o tryb pressed/multiple i podmienić kopie.
- Zmiany układu telefonu przez wspólne drzewo web/tel. w Sporcie (kafelki exercise-detail jako osobne karty, odstępy w template-editor/templates-list) — zweryfikować w Etapie 3 z CM*.
- **[naprawione 24.11, sprzątanie webu]** Okruszki: `<nav aria-label="Okruszki">` tylko w exercise-detail — ujednolicić na pozostałych ekranach Sportu.
- **[naprawione 24.11, sprzątanie webu]** Kruche `parentElement` w templates-list.test.tsx (l.102, ~141).

## Z Etapu 2d (Strony), 2026-11-21
- FormDialog (src/components/controls/form-dialog.tsx): aria-describedby={undefined} i <p> zamiast Dialog.Description — opis okna niepowiązany dla czytników.
- Okno usuwania strony: na telefonie arkusz (FormDialog), od 800 px karta .dlg; Sport ma kartę także na telefonie — ujednolicić w Etapie 3.
- Klasy wyzwalacza „Filtruj” w template-page-view skopiowane z Button secondary — rozszerzyć FilterPopover o render Button.
- slash-menu: min-h-11 także na desktopie.

## Sejf (feat/sejf) — odłożone po przeglądzie bezpieczeństwa (2026-11-21)
- M3: atomowość sprawdzenia g vs reset_vault — trigger BEFORE INSERT/UPDATE na page_rows (kształt + g = generation, select … for share), reset_vault z select … for update
- M6: blokada per karta — BroadcastChannel("rhytm-vault") dla lock/reset + pagehide → lock (bfcache)
- M9: telefon nie edytuje Sekretu (m-row-sheet pomija pole) — Etap 3 (CMPasswords)
- M10: brak CSP z nonce w aplikacji (XSS = kompromitacja sejfu)
- T2/T3: e2e zmiany hasła głównego, IndexedDB/Cache Storage; test zachowania reset_vault/count_secrets na Postgresie (kosz, cudze wiersze)
- updated_at z zegara aplikacji (ms) w kontroli optymistycznej rewrap
- zapisujeRef cicho ignoruje „Zapisz” innego wiersza podczas zapisu — dodać toast
- komunikat „Sejf musi być odblokowany” przy za długim ct — mylący

## E2E — niestabilne testy (zauważone 2026-11-21/22 przy etapie 2f)
- calendar.spec.ts:32 i :264, sport.spec.ts:203 — kliknięcie siatki w stałą pozycję (y=490) trafia w 14:30/16:00 zamiast 10:00; padają też na main. Prawdopodobnie przewinięcie siatki zależne od pory/obciążenia — klikać w slot przez data-testid godziny albo przewijać do 10:00 przed kliknięciem
- today.spec.ts:45 i :140 — padły przy uruchomieniu koło północy czasu Warszawy (data „dziś” po stronie serwera vs przeglądarki)

## Etap 2f — odłożone
- etykiety pól i tekst stopki 13 px vs 14 px w makietach (wspólny TextField/FIELD) — decyzja dla całej aplikacji
- nagłówki kart h2 pod h2 zakładki (formalnie h3)
- testy dosłownych klas przycisków domyślnego Stepper i wariantów przycisków zdjęcia; test ramki strefy niebezpiecznej Sejfu

## Etap 2g (odłożone)
- Token tła stopki .025 (bg-black/[.025] w AuthShell, kreatorze, kartach wyboru) — dodać do tokenów
- Etap 3: pusty kontener stopki na telefonie w kroku 1 resetu; notka sejfu alert.info na telefonie; PhoneStrengthBar hex; tytuł kroku/„Gotowe” 600 i opis muted na telefonie; Wyloguj na telefonie font-medium + hover tła z Button
- Testy: brak asertu kolejności plakietek „W kalendarzu”; nieużywany data-testid roles-calendar-phone; testy wyglądu na klasach Tailwind; brak testu strony nowe-haslo; 404 ikona Search/opacity bez testu
- Kosmetyka: zbędne justify-between/flex-wrap w header 404; zbędny min-[800px]: w step-pages; formatowanie step-notify; kolejność podpisów Onboarding 4/3 w mockups/index.html; stare nazwy makiet bez C w e2e/visual.spec.ts (moduły spoza 2g)
- RhytmLogo: napis 17 px/-0.045em vs makiety 16 px/-0.03em; akcent hex #15803d w komponencie
- coss-kolory: teoretyczny fałszywy alarm dla url(#id) w wartościach arbitralnych

## Poprawki webu — Dziś (makieta S2Today = wariant F zatwierdzona przez Mejsona 2026-11-22, wdrożenie po Stronach 2.0)
- Ten tydzień: paski celów (Treningi, Bieg, Nawyki, Sen) z „jeszcze N”
- Nawyki na dziś: kafelki z polem do odhaczenia i passą („N dni z rzędu”, płomień; od 3 dni pomarańczowy; 0 → „zacznij passę”)
- Bez „Zadania bez godziny”; plan dnia na całą szerokość, cała doba 00:00–23:00: puste godziny zwinięte w znaczniki (np. „8 h wolne” od północy, „7 h wolne” po ostatnim bloku)
- Między blokami w planie dnia: przerywana linia z „N min wolne” / „N h M min wolne” (wariant F, makieta S2Today na stronie Strony 2.0)
- DECYZJA Mejsona (22.11): zadania bez bloku znikają całkowicie, każde zadanie musi należeć do bloku. Wdrożenie w rundzie Dziś:
  - DB: tasks.block_id i occurrence_date NOT NULL (dziś constraint tasks_block_occurrence_check dopuszcza oba null). Na produkcji 6 zadań, wszystkie bez bloku: przed migracją trzeba zdecydować, co z nimi zrobić (usunąć albo przypiąć do bloku), pytanie do Mejsona.
  - Kod do usunięcia: tworzenie luźnego zadania (src/features/tasks/actions.ts, block_id: null), grupowanie luźnych zadań (src/features/tasks/model.ts), „Zadania bez godziny” na Dziś (web i telefon), opcja zadania bez bloku w szybkim dodawaniu (m-quick-add) i w CQuickAdd/S2QuickAdd.
- Dziś nowe konto (S2EmptyToday, 22.11): ten sam układ co Dziś. Paski tygodnia na 0 (0/4, 0/25 km, 0 %, sen „—”, „brak wpisów”), w nawykach kafelek „Utwórz nowy nawyk”, plan dnia pusty z jedną przerwą 00:00 „24 h wolne” i wierszem 23:00. Lista „Pierwsze kroki” znika.
- Strony 2.0 (22.11): lista wyboru w edycji wiersza (status/select) ma u góry pole „Szukaj lub dodaj opcję…”. Wpisanie nowej nazwy pokazuje „+ Utwórz «nazwa»”, a Enter tworzy opcję, dopisuje ją do pola i od razu wybiera. Makieta: S2Books. Do specu i planu Stron 2.0.
- Strony 2.0 (22.11): każda opcja na liście ma „⋯” (widoczne po najechaniu). Otwiera panel opcji: nazwa (zmiana obejmuje też wiersze), kolor (6: bez koloru, szary, niebieski, zielony, pomarańczowy, czerwony), „Usuń opcję” z informacją, ile wierszy jej używa (te wiersze zostają puste), przyciski Wstecz i Gotowe. Nowa opcja domyślnie szara. Makieta: S2Books.
- Strony 2.0 (22.11): koniec trybu edycji całego wiersza (Edytuj/Zapisz). Edytuje się pojedynczą komórkę jak w Notion: klik w tekst daje pole w miejscu (Enter lub kliknięcie obok zapisuje, Esc cofa), status i data otwierają okienko pod komórką, gwiazdki klika się od razu. Zapis natychmiastowy. Tabela ma stałe szerokości kolumn (table-layout: fixed), więc nic nie skacze. W wierszu po najechaniu zostaje tylko kosz. „+ Nowy” dodaje wiersz i od razu otwiera tytuł. Makieta: S2Books.
- Strony 2.0 (22.11): szerokość kolumn tabeli zmienia się przeciąganiem prawej krawędzi nagłówka albo strzałkami (min 80 px). Szerokości to część ustawień bloku tabeli. Tabela szersza niż ekran przewija się w poziomie suwakiem na dole ramki. Makieta: S2Books.
- Strony 2.0 (22.11): wspólny silnik tabeli w makietach (generator /home/claude/canvas-s2/gentable.py). Ma edycję komórek, listy z dodawaniem/edycją/kolorem/usuwaniem opcji, zmianę szerokości kolumn i suwak poziomy. Jest w: Books (własny kod), Projects, Websites, Subscriptions (kwota + przełącznik mies./rok, checkbox Aktywna), Hasła i Sejf (pole hasła i notatki z oczkiem, w zablokowanym sejfie komórki tylko do odczytu), oraz w nakładkach Books (AddField, CardDialog, CardMenu, TableMenu). Bez zmian: tabela-blok na Pustej stronie (osobny silnik siatki, komórki już edytowalne, bez zmiany szerokości) i statyczne tła ColumnMenu i FilterPopover.
- Strony 2.0 / web (23.11): sidebar da się schować. W nagłówku sidebara obok „rhytm” jest przycisk „Schowaj pasek boczny” (ikona panel-left-close, skrót Ctrl+\). Po schowaniu treść zajmuje całą szerokość, a w górnym pasku przed okruszkami pojawia się przycisk „Pokaż pasek boczny” (panel-left-open). Stan zapamiętany w przeglądarce (localStorage). Makiety: S2Sidebar, S2SidebarCollapsed. Pasuje do kroku 1 (fundament) albo 2.

## Strony 2.0 krok 1 — odłożone drobne uwagi (do kroku 2), stan 2026-11-23
- Task 1: minor (deferred): regex dopuszcza dowolną nazwę w formacie (nie sprawdza iconNames); pełna blokada tabeli przy migracji (mała skala).
- Task 2: minor (deferred): brak testu, że nazwy ICON_KEYWORDS ∈ iconNames (sprawdzone ręcznie); tytuł testu m-pages mówi o emoji; podwójny fallback Table w page-icon.tsx.
- Task 3: minor (deferred): brak .catch przy imporcie iconNames; mignięcie „Brak wyników” przed załadowaniem listy; pusty span licznika; brak aria-live; test leniwego importu niczego nie dowodzi (nazwa przesadzona).
- Task 4: minor (deferred): powtarzane .find(type==="table")! w testach; test Passwords używa [0]; w S2NewPage Projects ma 4 pola, w kodzie 5 (było tak już wcześniej).
- Task 5: minor (deferred): rollback moveField przywraca całą listę pól; addOption/removeOption przez patchField z domknięciem; przesuwanie liczy ukryte kolumny; renameTable bez trim; wyścig content na serwerze (był już wcześniej); PageTable bez onStaleGeneration (nie kierować tabel z sekretem — T6); minWidth heurystyka.
- Task 5: minor (deferred): removeOption nie jest atomowe (wiele zapisów, przy częściowym błędzie serwer zostaje częściowo zmieniony do resynchronizacji); rollback może nadpisać równoległą edycję; wiersze tymczasowe czyszczone tylko lokalnie.
- Task 6: minor (deferred): opóźnienie ikony na webie po „Zmień ikonę” (dwa źródła stanu: ikona i pagesStore); PageMenu align="start" przy prawej krawędzi (sprawdzić w T9); brak testów: rollback błędu addRow i zachowanie wiersza tmp- przy resynchronizacji.
- Task 7: minor (deferred): liczenie columnheader nie odróżnia kolumn tymczasowych (wyścig przy kliknięciu w menu); druga zmiana typu bez sprawdzenia okna utraty.
- Task 8: minor (deferred): fokus znika, gdy chowa się kontener przycisku; test sidebar-toggle klika bez asercji.
- Task 8: minor (deferred): regex ciasteczka w skrypcie inline bez zakotwiczenia końca (tylko szkielet, bez szkód).
- Task 9: minor (deferred): nazwa tabeli w menu „⋯” zapisuje się tylko onBlur (Escape może zgubić szkic); dwa pola aria-label „Nazwa tabeli” przy otwartym menu; aria-label sortu bez widocznego tekstu; „Usuń tabelę” bez potwierdzenia; ukryte pole 0 nie do przywrócenia z menu (brzegowe).
- Task 9: minor (deferred): ref edycjaPoZapisie nie zerowany przy szkicu „Nowy”/cancel; klik w wiersz w toku przy trwającej edycji innego wiersza nie przełącza; setMenuTabeli(false) omija zapis szkicu nazwy.
- Przegląd końcowy (odłożone): migające ikony DynamicIcon (statyczny import polecanych); funkcja page_icon_lucide zostaje w bazie z grantem dla authenticated; data-testid w app-shell; rollback moveField przywraca całą listę; „Przesuń w lewo” pozwala przesunąć kolumnę przed tytuł.
- Uwaga: część punktów z T3/T6/T9 już naprawiona (.catch importu, PageMenu align end, zapis nazwy przy zamknięciu menu, przywracanie ukrytej kolumny 0).

## Strony 2.0 krok 2 — odłożone drobne uwagi (stan 2026-11-23)
- **[naprawione 24.11, sprzątanie webu]** Task 1: minor (deferred → do T2): column_widths z serwera — tablica przechodzi przez typeof object (dodać !Array.isArray); brak walidacji wartości przy wczytaniu (konsumenci robią clamp ≥80 i Number.isFinite); brak testu górnej granicy karty 4001.
- Task 2: minor (deferred): updateCell porównanie z domknięcia (dwa wywołania tej samej komórki w jednym renderze); createOption/updateOption/updateCell nie odrzucają pola z tymczasowym id (toast po nieudanym RPC); moveField przy równych pozycjach ze starych danych — kolizja wizualna do odświeżenia.
- Task 2: minor (deferred): potwierdzenie wg kolejności zakończeń, nie kolejności na serwerze (odwrócone zakończenia); zatwierdzone z wartości saveRow/removeOption; removeOption i applyTypeChange poza zapisyPol (może przywrócić usuniętą opcję); „Pokaż w kalendarzu” bez bazy z zapisu w toku.
- Task 3: minor (deferred → do T4): nowyId w page-table nigdy się nie czyści (autoFocus może kraść fokus przy ponownym zamontowaniu wiersza po zmianie filtra).
- Task 3: minor (deferred): aria-label komórek i kosza bez tytułu wiersza (jak w makiecie); link w komórce url niedostępny z klawiatury i zmiana tekstu liczby przy fokusie (kursor może przeskoczyć).
- Task 4: minor (deferred): wielokrotne spacje w nazwie opcji nie normalizowane; pusta/zduplikowana nazwa w panelu po cichu pomijana; podwójny Enter woła onCreate dwa razy (bezpieczne przez dedup); Enter na bieżącą opcję ją czyści; „⋯” niewidoczne na dotyku.
- Task 4: minor (deferred): podświetlenie wiersza gaśnie przy najechaniu na „⋯”; „najechana” może wskazać zniknięta opcję po filtrze.
- Task 4: minor (deferred): panelRef bez cleanupu na unmount; Tab z opcji nie idzie do jej „⋯” (osobna warstwa).
- **[naprawione 24.11, sprzątanie webu]** Task 5: minor (deferred): martwe klucze usuniętych kolumn w column_widths; brak testu odfiltrowania niepoprawnych wpisów; rollback patchSettings przy dwóch szybkich zapisach nadpisuje nowszą mapę (istniejące zachowanie store).
- Task 5: minor (deferred): ucinanie nazwy i przeciąganie dotykiem/piórem do sprawdzenia w przeglądarce (T10/podgląd); brak releasePointerCapture w gałęzi buttons===0.
- Task 6: minor (deferred): onPointerUp karty bierze indeks z domknięcia (zmiana kolejności z zewnątrz w trakcie przeciągania trafi w inną kartę); key={i} — po przesunięciu fokus wraca na „⋯” karty na starym miejscu; „⋯” niewidoczne na tablecie ≥800 px bez hovera; brak aria-valuemax uchwytu; toast „Cofnij” po nawigacji używa starego onChange.
- Task 7: minor (deferred): edycja nearest_date nadpisuje field_id pierwszą kolumną status; grupy radio bez nawigacji strzałkami.
- Task 7: minor (deferred): podpowiedź limitu tylko w title (a11y); brak testów: unit zachowany przy tym samym sposobie, maxLength; unit przechodzi przy zmianie kolumny z tym samym sposobem.
- Task 8: minor (deferred): plan i spec nadal opisują page_icon_lucide jako do zrobienia.
- **[naprawione 24.11, sprzątanie webu]** Task 9: minor (deferred): stanWBazie w e2e ignoruje error zapytania; expect.poll timeout 5 s < actionTimeout 10 s; brak asercji trwałości „Cofnij” w Books.
- Task 9: minor (deferred): removeOption — cofnięcie wierszy/ustawień bez warunku „nadal z tej zmiany” przy równoległym zapisie; Promise.all wszystko-albo-nic bez resynchronizacji; settings z domknięcia przy dwóch removeOption w jednym renderze.
- Przegląd końcowy (odłożone): M1 utrata szkicu przy zamknięciu karty w 600 ms; M4 rerender całej tabeli przy zapisie komórki (memo); pozostałe Minor z final-review kroku 2; onBlur odpina przy alt-tab; dwie identyczne karty przy edycji po treści.

## Strony 2.0 krok 3 (Hasła i onboarding) — odłożone drobne uwagi (stan 2026-11-23)
- A1: na telefonie `/hasla` nie zaznacza zakładki „Strony” w dolnym pasku (`tab-bar.tsx`). Do Etapu 3 (telefon).
- A4: brak testu pgTAP warunku wstępnego migracji (przerwanie przy polu Sekret poza modułem); „dwie karty naraz” sprawdzone tylko sekwencyjnie (`ensure_passwords_page` ma blokadę doradczą i unikalny indeks).
- B4: brak strażnika `page_rows`: właściciel przez bezpośrednie API może przenieść wiersz z modułu (`block_id`) albo wpisać jawny string pod pole Hasło. Obrona w głąb: wyzwalacz na `page_rows` (zakaz zmiany `block_id` przy stronie systemowej, kształt `SecretValue` pod polem secret).
- B5: warunek wstępny migracji pomija pola Sekret na stronach Passwords w koszu; po przywróceniu z kosza byłby Sekret poza modułem. Na produkcji takich stron nie ma.
- B6 (informacyjnie): treść błędu wyzwalacza zdradza 1 bit, czy cudzy UUID to blok modułu. Praktycznie nieosiągalne.
- Z zadania 3: status „ladowanie” chwilowo pokazuje „zablokowane”; arkusz telefonu odszyfrowuje sekrety od razu po otwarciu; klik w trakcie szyfrowania otwiera starą wartość; brak testu kopiowania z dwóch wierszy.
- Z zadania 5: `m-row-sheet.test` raz zachował się niestabilnie.

## Projekt Dziś (wariant F) — odłożone drobne uwagi (stan 2026-11-24)
- RLS `tasks`: polityki insert/update mają martwą gałąź `block_id is null` (po `20261126100000_tasks_only_in_blocks.sql`) — uprościć osobną migracją (pakiet sprzątania).
- `today-view.tsx`: `HabitDialog` woła `router.refresh()` także po „Anuluj” (zbędne odświeżenie; okno nie odróżnia zapisu od anulowania).
- Nawyki na dziś: 4 kolumny także przy 800–1100 px; długie nazwy są ucinane (`truncate`), makieta zawija. Sprawdzić na żywo.
- `StatusBadge green` („Teraz”) ma tekst `text-success`, makieta `.bdg.ok` — drobna różnica koloru kontrolki.
- `delete-block-dialog`: zdanie o zadaniach zawsze w formie „jeśli są” (okno nie zna liczby zadań).
- Scope-dialog: przy edycji „Tylko to wystąpienie” tekst o usuwaniu zadań może niepotrzebnie straszyć (zadania nie są tam usuwane).

## Subscriptions — odłożone drobne uwagi (stan 2026-11-24)
- `use-table-store.updateCell` i `szkicZmieniony()` porównują `Object.is`: obiekt kwoty `{amount, cycle}` z tą samą wartością i tak idzie na serwer (zbędne żądanie, bez szkody).
- `relativeDue`: „za N mies.” od 61 dni, makieta S2Main od 45 dni (funkcja wspólna z Projects).
- Plakietka sortu „Sort: Data odnowienia” — makieta raz pisze „Sort: Odnowienie”, a kolumnę „Data odnowienia”.
- Telefon wczytuje `loadRenewals` na `/kalendarz`, choć widoki telefonu odnowień nie pokazują (1–3 zbędne zapytania) — Etap 3.
- Arkusz „Kategorie” na telefonie przełącza źródło odnowień, którego telefon nie pokazuje — Etap 3.
- `przelaczZrodlo` nadpisuje cały `config` pola wersją z chwili wczytania (edycja z innej karty może się zgubić).
- `loadRenewals` bez paginacji `page_rows` (limit PostgREST 1000 wierszy).
- `visual.spec` Subscriptions liczy daty w UTC (tekst zrzutu koło północy może się przesunąć o dzień).
- Test pgTAP `subscriptions.test.sql` używa `"cycle":"monthly"` w danych (powinno `"month"`; bez wpływu na wynik).
- Telefon (arkusz wiersza): bez dopisku „następne: dd.mm.rrrr” — pole pokazuje od razu następne odnowienie.

## Sprzątanie webu — odłożone (stan 2026-11-24)
- `e2e/helpers/kalendarz.ts:121`: komentarz „+10 px = środek 30 minut” nieścisły (środek to +12 px); wynik poprawny.
- `duplicate_page` kopiuje wartości Sekret: dla starej niesystemowej strony z polem Sekret i szyfrogramem starej generacji duplikat zakończy się ogólnym błędem (dane bezpieczne). Na później: zerować pola `secret` w kopii.
- Strażnik `page_rows` robi przy każdym zapisie dodatkowe zapytanie do `page_blocks` (bez „szybkiego wyjścia” ze specu); koszt pomijalny.
- Niestabilny `[mobile] today.spec.ts:185` (nawyk odhaczony na Dziś → 1/1) — przyczyna niezbadana.

## Ustawienia i sejf — web: odłożone (stan 2026-11-24)
- `?email=potwierdzono` zostaje w adresie, komunikat wraca po odświeżeniu.
- Okno „Odblokuj sejf” (`absolute top-[160px]`) przewija się z treścią przy długiej tabeli.
- „Zablokuj teraz” ukryty przy zamkniętym sejfie (makieta ma go pod rozmyciem).
- `TimePicker` bez strzałki ▾; etykiety urządzeń bez „(PWA)”.
- Makiety CBlockDialog, CMBlockSheet, COnboardingNotify, COnbPreview nadal mówią „10 min” / „3 dni” (kod: 5 min / dzień wcześniej o 9:00, C4).
- Onboarding pokazuje „Podsumowanie tygodnia” bez wysyłki (C15).
- `/konto-usuniete` i onboarding wylogowują zwykłym `signOut` bez wypisania push.
- Eksport JSON budowany w pamięci, bez limitu wywołań.
- Przypomnienie oznaczone przez `claim` przepada bez ponowienia, gdy trasa Vercel zwróci błąd.
- IP sesji to IP serwera (bez `X-Forwarded-For`), nieużywane w UI.

## Niestabilne e2e (24.11, pakiet kalendarz)

- `[web] e2e/sport.spec.ts:20` — kliknięcie podglądu biegu w tygodniu kalendarza czasem nie przechodzi na /sport (było już na feat/ustawienia-web i feat/telefon-fundament); przyczyna niezbadana, przechodzi przy powtórce.
- `[web] e2e/settings.spec.ts:205` — opis karty „Usuń konto” raz znaleziony podwójnie (ukryty fragment, prawdopodobnie strumieniowanie Suspense); przechodzi przy powtórce.

## Telefon / sport (24.11, z przeglądu gałęzi)

- Lista szablonów: kolejność fokusu odwrotna do wzrokowej.
- Szczegóły ćwiczenia: tytuł nagłówka 18 px zamiast 16 px z makiety.
- `ModuleHeader` z `phoneOnly` i `webOnly` naraz nie renderuje nic (dziś nikt tak nie woła).
- e2e: teksty „Z masą ciała”, „Nowy szablon” są w obu układach — dziś bezpieczne (`display:none`), uważać przy nowych selektorach.
