# COSS UI — Etap 2f (Ustawienia) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ustawienia na webie (Ogólne, Kategorie, nawigacja zakładek, puste zakładki Konto i Powiadomienia) wyglądają jak makiety COSS, bez zmian funkcji.

**Architecture:** Fundamenty są na main: tokeny, kontrolki `@/components/controls`, `ModuleHeader` z okruszkami „Ustawienia / {zakładka}”, okno kategorii (`src/features/categories/category-dialog.tsx`, zrobione w etapie 2a wg `CCategoryDialog`). Zakładka Sejf (`vault-card.tsx`) jest gotowa z etapu sejfu. Ten etap zmienia wyłącznie wygląd w `src/features/settings`, `src/app/(app)/ustawienia/[zakladka]/page.tsx` i dodaje opcjonalne warianty dwóch wspólnych kontrolek (`Dropdown`, `Stepper`) — bez zmiany ich domyślnego wyglądu na innych ekranach.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, radix-ui, lucide-react, Vitest + Testing Library, Playwright (e2e w CI).

**Spec:** `docs/superpowers/specs/2026-11-21-coss-etap-2f-ustawienia-design.md` (nadrzędny: `docs/superpowers/specs/2026-11-20-coss-ui-design.md`)

## Global Constraints

- **Makiety są wiążące, odwzorowujemy je 1:1.** `docs/design/mockups/` (arkusz `coss/coss.css`): `CSettings` (Ogólne: karty Profil i Cele, nagłówek, nawigacja), `CSettingsAccount` i `CSettingsNotifications` (tylko nawigacja i nagłówek zakładki), `CCategoryDialog`. Podgląd: `PW_CHANNEL=chrome pnpm mockups:shots <Nazwa>` → `test-results/mockups/<Nazwa>.png`.
- **Funkcjonalnie nic się nie zmienia.** Dane, walidacje, zapisy, teksty, stany, role ARIA i etykiety zostają. Elementy z makiety, których nie ma w aplikacji (karty „Konto” i „Usuń konto” w `CSettings`, cała treść Konta i Powiadomień), NIE są dodawane.
- **Kosz i lista kategorii nie mają makiety COSS** — dostają styl kart z `CSettings` (nagłówek `card-t`/`card-d`, wiersze z separatorem, stopka `.foot`), zachowanie bez zmian.
- **Podtytuł zakładki** tylko tam, gdzie ma go makieta: Ogólne → „Profil, cele i podstawowe preferencje aplikacji.”. Pozostałe zakładki bez podtytułu (jak `CSettingsAccount`, `CSettingsNotifications`).
- **Wspólne kontrolki:** wolno tylko dodać opcjonalne warianty; domyślny wygląd `Dropdown` i `Stepper` na innych ekranach (kalendarz, nawyki, onboarding, strony, sport) zostaje bit w bit. Istniejące testy tych kontrolek przechodzą bez zmian.
- **Kolory UI wyłącznie z tokenów.** `node scripts/coss-kolory.mjs --check` pokazuje tylko 2 znane pozostałości w `sport/mobile/m-sport`.
- **Konwencje COSS:** fokus `focus-visible:shadow-focus outline-none`; wyłączone `opacity-[.64]`; pola `FIELD`/`TextField`; odznaki `StatusBadge`; okna `FormDialog`; `cn` to twMerge (nadpisania na końcu); w treści COSS nie używamy `font-mono` (liczby: `tabular-nums`).
- **Telefon** (`max-[799px]:`): układ zostaje (zrobi go Etap 3), cele dotykowe ≥ 44 px, nie mniejsze niż dziś.
- **Bez nowych bibliotek.** Kod płaski, bez funkcji pomocniczych skaczących po plikach, komentarze po polsku.
- **Testy:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `node scripts/coss-kolory.mjs --check`; e2e w CI. Asercje klas aktualizujesz razem ze zmianą, testów zachowania nie zmieniasz.
- **Git:** commity tylko na `feat/coss-ustawienia`, robi je koordynator (implementer nie commituje). Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` oraz `Claude-Session: https://claude.ai/code/session_01WRp6JuSYwef6J2Ypw1fKow`.

## Review Focus

1. **Wspólne kontrolki na innych ekranach:** `Dropdown` i `Stepper` bez nowego propa renderują dokładnie to samo co przed etapem. Test: Task 2 i Task 3 (snapshot klas domyślnego wariantu).
2. **Granice celu snu (5:00 i 11:00):** szeroki `Stepper` nadal wyłącza „−”/„+” na granicy i zachowuje etykiety „Zmniejsz Cel snu”/„Zwiększ Cel snu”. Test: Task 3.
3. **Karta z niezapisanymi zmianami:** „Cofnij” przywraca wartości, „Zapisz” wyłączony ma `opacity-[.64]`, po zapisie „Zapisano ✓”. Test: Task 2.
4. **Długie nazwy w Koszu i kategoriach:** tytuł skraca się wielokropkiem, przyciski nie zjeżdżają do nowej linii na webie. Test: Task 4.
5. **Telefon:** nawigacja zakładek przewija się poziomo, cele ≥ 44 px (klasy `max-[799px]:` zachowane). Test: Task 1.

---

### Task 1: Ramka strony Ustawień, nawigacja zakładek i puste zakładki

**Files:**
- Modify: `src/features/settings/settings-tabs.tsx`, `src/app/(app)/ustawienia/[zakladka]/page.tsx`, `docs/design/mockups/index.html`
- Test: `src/features/settings/settings-tabs.test.tsx`

**Interfaces:**
- Produces: `SETTINGS_TABS` — każdy element dostaje opcjonalne `description?: string`; tylko `ogolne` ma `"Profil, cele i podstawowe preferencje aplikacji."`.

- [ ] **Step 1: Testy (FAIL)** w `settings-tabs.test.tsx`:
  - `"SETTINGS_TABS: tylko Ogólne ma podtytuł z makiety"` — `expect(SETTINGS_TABS.find((t) => t.slug === "ogolne")?.description).toBe("Profil, cele i podstawowe preferencje aplikacji.")`, a pozostałe `description` są `undefined`.
  - `"zakładka: wysokość 32 px, zaokrąglenie 8 px, aktywna z tłem i aria-current"` — aktywny link ma `aria-current="page"` i klasy wysokości/zaokrąglenia z makiety (`.snav a`: `height:32px; border-radius:8px; font-weight:500`), nieaktywny ma `hover:` tła.
  - `"telefon: pasek przewijany i cele 44 px"` — zachowane `max-[799px]:overflow-x-auto` i `max-[799px]:min-h-11`.
- [ ] **Step 2:** `pnpm vitest run src/features/settings/settings-tabs.test.tsx` → FAIL.
- [ ] **Step 3: Zaimplementuj.**
  - `settings-tabs.tsx`: wygląd `.snav a` z `CSettings` (wysokość 32 px, `rounded-lg`, `font-medium`, kolor nieaktywnej `text-muted-foreground`, hover tło jak `rgba(0,0,0,.04)` z tokenu, aktywna tło jak `rgba(0,0,0,.05)` z tokenu `bg-active`). Telefon bez zmian.
  - `page.tsx`: nagłówek zakładki (`h2` 24 px, 600, `tracking-[-0.02em]`) i pod nim podtytuł `tab.description` (`text-muted-foreground`, odstęp 4 px), gdy jest; odstępy kolumn i szerokości wg makiety (nawigacja 180 px, odstęp 32 px, treść do 840 px).
  - Zakładki `konto` i `powiadomienia`: zamiast `EmptyModule` karta w stylu kart ustawień (`rounded-xl border bg-white`, cień karty z tokenu jak w innych kartach) z wyśrodkowanym tekstem „Ta zakładka powstanie w kolejnym etapie.” (`text-muted-foreground`, padding pionowy ~40 px).
  - `docs/design/mockups/index.html`: w sekcji „COSS UI — web, wiążące” dopisz pozycje `CSettings` („Ustawienia — Ogólne”), `CSettingsAccount` („Konto i bezpieczeństwo”), `CSettingsNotifications` („Powiadomienia”) oraz zaktualizuj licznik w `<span>`.
- [ ] **Step 4:** testy → PASS; `pnpm typecheck && pnpm lint`.
- [ ] **Step 5:** porównanie wizualne z `CSettings`, `CSettingsAccount`, `CSettingsNotifications` (tymczasowa trasa `src/app/(public)/zz-*/page.tsx`, `pnpm exec next dev -p 3999`, skrypt Playwright; potem usuń trasę i skrypt, `kill $(lsof -ti:3999)`, `git checkout AGENTS.md`, `rm -rf .next/dev`). Zrzuty i ocena w raporcie.

### Task 2: Karta Profil, wariant `select` w `Dropdown`, stopka kart

**Files:**
- Modify: `src/components/controls/dropdown.tsx`, `src/features/settings/profile-card.tsx`, `src/features/settings/avatar-row.tsx`, `src/features/settings/card-footer.tsx`
- Test: `src/components/controls/dropdown.test.tsx`, `src/features/settings/profile-card.test.tsx`, `src/features/settings/avatar-row.test.tsx`

**Interfaces:**
- Produces: `Dropdown` dostaje opcjonalny prop `variant?: "menu" | "select"` (domyślnie `"menu"` = dzisiejszy wygląd). `"select"` = `.dd` z `coss.css`: wysokość 32 px, ikona `ChevronsUpDown` 16 px `text-muted-foreground` zamiast `ChevronDown`, a w wyzwalaczu po etykiecie wybranej opcji jej `hint` (`text-xs text-muted-foreground`, bez `font-mono`).

- [ ] **Step 1: Testy (FAIL):**
  - `dropdown.test.tsx`: `"variant select: ikona góra-dół i podpowiedź wybranej opcji w wyzwalaczu"` — `render(<Dropdown variant="select" value="PLN" options={[{value:"PLN",label:"PLN",hint:"zł"}]} … />)` → wyzwalacz zawiera tekst `"zł"`; `"domyślny wariant bez zmian"` — bez propa wyzwalacz nie zawiera hintu, a klasy wyzwalacza są równe dzisiejszym (zapisz je w teście dosłownie z obecnego kodu).
  - `profile-card.test.tsx`: `"strefa czasowa: wyzwalacz pokazuje miasto i UTC"` (np. `Warszawa` i `UTC+01:00`); `"waga i wzrost bez font-mono, z tabular-nums"`.
  - `avatar-row.test.tsx`: `"Wgraj/Zmień z ikoną wysyłania"` — przycisk ma ikonę `Upload` (`aria-hidden`) i dotychczasowy tekst.
  - `card-footer`: w `profile-card.test.tsx` `"Zapisz wyłączony ma opacity-[.64]"` (nie `opacity-40`).
- [ ] **Step 2:** `pnpm vitest run src/components/controls/dropdown.test.tsx src/features/settings` → FAIL.
- [ ] **Step 3: Zaimplementuj** wg `CSettings` (`.card`, `.card-h`, `.card-t`, `.card-d`, `.row`, `.foot`): karta `rounded-xl` z cieniem karty z tokenu, nagłówek 16 px/600 + opis muted, wiersz zdjęcia z separatorem, siatka pól 2 kolumny; `Dropdown variant="select"` dla strefy czasowej; `CardFooter` wyłączony `opacity-[.64]` (zamiast `disabled:opacity-40`) — dotyczy też karty Cele.
- [ ] **Step 4:** testy → PASS; `pnpm test && pnpm typecheck && pnpm lint && node scripts/coss-kolory.mjs --check`.
- [ ] **Step 5:** porównanie wizualne karty Profil z `CSettings` (procedura i sprzątanie jak w Task 1).

### Task 3: Karta Cele i szeroki wariant `Stepper`

**Files:**
- Modify: `src/components/controls/stepper.tsx`, `src/features/settings/goals-card.tsx`
- Test: `src/components/controls/stepper.test.tsx`, `src/features/settings/goals-card.test.tsx`

**Interfaces:**
- Consumes: `Dropdown variant="select"` (Task 2).
- Produces: `Stepper` dostaje opcjonalny prop `wide?: boolean` (domyślnie `false` = dzisiejszy wygląd). `wide` = jedna ramka jak `.igroup` z `CSettings`: pełna szerokość kolumny, wysokość 32 px, przyciski „−”/„+” po bokach oddzielone pionową linią, wartość wyśrodkowana `tabular-nums` (bez `font-mono`). Telefon: jak dziś (ramka 44 px).

- [ ] **Step 1: Testy (FAIL):**
  - `stepper.test.tsx`: `"wide: jedna ramka na pełną szerokość, wartość bez font-mono"`; `"domyślny wariant bez zmian"` (klasy grupy i wartości równe dzisiejszym, zapisane dosłownie).
  - `goals-card.test.tsx`: `"cel snu: szeroki stepper, granice 5:00 i 11:00 wyłączają przyciski"` — przy 5:00 `Zmniejsz Cel snu` disabled, przy 11:00 `Zwiększ Cel snu` disabled; `"waluta: wyzwalacz PLN zł"`; `"liczby celów bez font-mono"`.
- [ ] **Step 2:** `pnpm vitest run src/components/controls/stepper.test.tsx src/features/settings/goals-card.test.tsx` → FAIL.
- [ ] **Step 3: Zaimplementuj** kartę Cele wg `CSettings`: `Stepper wide` dla celu snu, `Dropdown variant="select"` dla waluty i tygodnia, checkboxy i pola liczb celów treningowych jak w makiecie (pola 72 px, wyrównanie do prawej, `tabular-nums`), stopka bez zmian tekstów.
- [ ] **Step 4:** testy → PASS; pełne sprawdzenie jak w Task 2.
- [ ] **Step 5:** porównanie wizualne karty Cele z `CSettings`.

### Task 4: Kosz i Kategorie kalendarza w stylu kart COSS

**Files:**
- Modify: `src/features/settings/trash-card.tsx`, `src/features/settings/categories-card.tsx`
- Test: `src/features/settings/trash-card.test.tsx`, `src/features/settings/categories-card.test.tsx`

- [ ] **Step 1: Testy (FAIL):**
  - `trash-card.test.tsx`: `"nagłówki sekcji i daty bez font-mono"`; `"długi tytuł skraca się (truncate), przycisk Przywróć zostaje w wierszu"`.
  - `categories-card.test.tsx`: `"systemowa jako StatusBadge"` (tekst „systemowa”, bez `font-mono`); `"akcje wyrównane: strzałki kolejności w stałym miejscu w każdym wierszu"` (kontener akcji o stałej szerokości slotu strzałek, także gdy strzałki brak); `"długa nazwa kategorii skraca się"`.
- [ ] **Step 2:** `pnpm vitest run src/features/settings/trash-card.test.tsx src/features/settings/categories-card.test.tsx` → FAIL.
- [ ] **Step 3: Zaimplementuj** w stylu kart z Task 2 (bez makiety — styl `.card`/`.row`/`.foot` z `CSettings`): etykiety sekcji Kosza („Strony”, „Wiersze”) jak etykiety grup w `CSidebar` (12 px, `font-medium`, `text-muted-foreground`, bez wersalików i mono); daty i „zostało N dni” `text-xs text-muted-foreground tabular-nums`; w kategoriach odznaka `StatusBadge` „systemowa”, akcje w stałym układzie (slot strzałek ↑/↓ o stałej szerokości, „Ukryj”/„Pokaż” i „Usuń” zawsze w tych samych kolumnach). Okno kategorii (`category-dialog.tsx`) tylko sprawdź z `CCategoryDialog` i zapisz w raporcie zgodność; nie zmieniaj go, chyba że jest rozbieżność — wtedy opisz ją w „Do decyzji”.
- [ ] **Step 4:** testy → PASS; pełne sprawdzenie jak w Task 2.
- [ ] **Step 5:** porównanie wizualne Kosza i Kategorii ze stylem kart `CSettings` oraz okna z `CCategoryDialog`.
