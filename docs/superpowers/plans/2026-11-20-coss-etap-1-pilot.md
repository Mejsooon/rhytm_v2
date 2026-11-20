# COSS UI — Etap 1 (fundamenty + pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikacja rhytm dostaje tokeny, font i kontrolki COSS w całości, a sidebar i ekran Dziś (web) wyglądają dokładnie jak makiety C*.

**Architecture:**
1. Tokeny COSS trafiają do `src/app/globals.css`, a font to Inter z `@fontsource-variable/inter`.
2. Skrypt `scripts/coss-kolory.mjs` jednorazowo zamienia kolory UI wpisane na sztywno w klasach Tailwind na klasy tokenów w całym `src/`.
3. Kontrolki `src/components/controls/*` i `src/components/ui/*` dostają wygląd COSS z zachowaniem API.
4. Pilotowe ekrany (powłoka, Dziś, wspólne dymki bloków) są przepisane wizualnie według makiet.

**Tech Stack:** Next.js 16, React 19, Tailwind 4 (`@theme inline`), radix-ui, lucide-react, sonner, Vitest + Testing Library, Playwright (e2e tylko w CI).

**Spec:** `docs/superpowers/specs/2026-11-20-coss-ui-design.md`

## Global Constraints

- **Makiety są wiążące** i w sprawach wyglądu wygrywają z planem.
  - Pilot web: `docs/design/mockups/CSidebar.dc.html`, `CPageMenu.dc.html`, `CIconPicker.dc.html`, `CToday.dc.html`, `CEmptyToday.dc.html`.
  - Arkusz: `docs/design/mockups/coss/coss.css`, odwzorowywany 1:1. Wartości px, rgba i cieni bierz stamtąd, nie zgaduj.
  - Podgląd: `pnpm mockups:shots CToday` → `test-results/mockups/CToday.png`.
- **Funkcjonalnie nic się nie zmienia:** dane, teksty, stany, przepływy, role ARIA i etykiety. Jeśli makieta różni się funkcjonalnie od aplikacji, zostaje aplikacja, a różnicę wpisujesz do raportu zadania w sekcji „Do decyzji”.
- **Bez nowych bibliotek UI.** Jedyna nowa zależność to `@fontsource-variable/inter`.
- **Płaski kod bez funkcji pomocniczych** rozrzuconych po plikach. Stałe z klasami (np. `export const MENU_ITEM = "..."`) są dozwolone. Komentarze po polsku.
- **API kontrolek** wolno tylko rozszerzać (nowe warianty i rozmiary). Nie usuwaj propsów i nie zmieniaj ich znaczenia.
- **Telefon (`max-[799px]:`):** cele dotykowe ≥ 44 px zostają. Układy telefonu w tym etapie się nie zmieniają, dostają tylko tokeny i kontrolki.
- **Kolory danych zostają nietknięte:** paleta kategorii, ikon stron, heatmapy i wykresów (hexy w tablicach i obiektach TS i w `style={{}}`).
- **Testy:** `pnpm test`, `pnpm typecheck` i `pnpm lint` muszą przejść lokalnie.
  - e2e tylko w CI: `gh run list --branch feat/coss-pilot -L1`, przy limitach infrastruktury `gh run rerun --failed`.
  - Testy sprawdzające klasy kolorów aktualizujesz razem ze zmianą. Testów zachowania nie zmieniasz.
- **Git:** commity tylko na `feat/coss-pilot`, nigdy na main. Trailer każdego commita:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` oraz `Claude-Session: https://claude.ai/code/session_01WRp6JuSYwef6J2Ypw1fKow`.

## Tokeny COSS (wspólne dla wszystkich zadań)

Nazwy klas Tailwind (`bg-*`, `text-*`, `border-*`, `ring-*`, `fill-*`, `stroke-*`) dla `:root` w `globals.css` i `@theme inline`:

| token | wartość | token | wartość |
|---|---|---|---|
| background, card, popover | #ffffff | foreground, card-foreground, popover-foreground | #262626 |
| primary | #262626 | primary-hover | #3a3a3a |
| primary-foreground | #fafafa | soft-foreground | rgba(38,38,38,.8) |
| muted-foreground, meta | #686868 | faint-foreground | rgba(104,104,104,.72) |
| muted, accent, secondary, hover | rgba(0,0,0,.04) | active | rgba(0,0,0,.06) |
| panel, sidebar | #fafafa | accent-foreground, secondary-foreground | #262626 |
| border | rgba(0,0,0,.08) | border-soft, sidebar-border | rgba(0,0,0,.06) |
| input | rgba(0,0,0,.1) | border-strong | rgba(0,0,0,.16) |
| ring | #a3a3a3 | destructive | #ef4444 |
| destructive-hover | #f05252 | destructive-foreground | #b91c1c |
| destructive-soft | rgba(239,68,68,.08) | destructive-border | rgba(239,68,68,.24) |
| success, accent-brand | #15803d | success-soft | rgba(21,128,61,.08) |
| success-border | rgba(21,128,61,.24) | info | #3b82f6 |
| info-foreground | #1d4ed8 | info-soft | rgba(59,130,246,.08) |
| info-border | rgba(59,130,246,.24) | warning | #f59e0b |
| warning-foreground | #b45309 | warning-soft | rgba(245,158,11,.08) |
| warning-border | rgba(245,158,11,.28) | | |

**Promienie (`@theme`):**

| token | wartość |
|---|---|
| `--radius` | 10px |
| `--radius-sm` | 6px |
| `--radius-md` | var(--radius) |
| `--radius-lg` | 12px |
| `--radius-xl` | 16px |

**Cienie (`@theme`):**

| token | wartość |
|---|---|
| `--shadow-xs` | 0 1px 2px rgba(0,0,0,.05) |
| `--shadow-lg` | 0 10px 15px -3px rgba(0,0,0,.06), 0 4px 6px -4px rgba(0,0,0,.06) |
| `--shadow-pop` | shadow-lg + `0 24px 48px -12px rgba(0,0,0,.14)` (dialogi) |

**Font:** `--font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif`. Na `body` ustaw `font-feature-settings: "cv11"`. Geist Mono zostaje jako `--font-mono`.

## Review Focus

1. **Telefon <800 px po przestylowaniu kontrolek:** przyciski `md`/`lg` mają 44 px (`max-[799px]:h-11`), pola 44 px, a segmenty i chipy nadal są łatwe do trafienia palcem. Test: Task 3 i Task 4.
2. **Kolory danych po zamianie skryptem:** kolory bloków kategorii, kropek, ikon stron i heatmapy wyglądają jak przed zmianą. Hex w tablicy TS albo w `style` nie może zostać zmieniony. Test: Task 2.
3. **Stan wyłączony:** `disabled` i `aria-disabled="true"` muszą być nadal widocznie wyłączone (opacity .64) i nieklikalne we wszystkich kontrolkach. Test: Task 3.
4. **Fokus z klawiatury:** każda kontrolka ma widoczny pierścień `focus-visible` (`0 0 0 2px #fff, 0 0 0 4px ring` dla przycisków, a dla pól `border-ring` + `0 0 0 3px rgba(163,163,163,.24)`). Test: Task 3.
5. **Przycisk primary jako link (`asChild` z `<a>`):** tekst zostaje jasny (`primary-foreground`) także po najechaniu, bo globalne style linków nie mogą go przebić. Test: Task 3.

---

### Task 1: Tokeny COSS, font Inter i narzędzia makiet

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `package.json` (+ lockfile), `scripts/mockup-shots.mjs:40`, `docs/design/mockups/coss/coss.css`
- Create: `src/app/tokens.test.ts`, `docs/design/mockups/coss/inter-latin.woff2`, `docs/design/mockups/coss/inter-latin-ext.woff2`

**Interfaces:**
- Produces: klasy Tailwind wszystkich tokenów z tabeli „Tokeny COSS”, promienie `rounded-sm/md/lg/xl` = 6/10/12/16 px, cienie `shadow-xs`, `shadow-lg`, `shadow-pop`, font `font-sans` = Inter.

- [ ] **Step 1: Napisz test `src/app/tokens.test.ts`.** Czyta `src/app/globals.css` przez `fs`. Test `"tokeny COSS w :root"` sprawdza po kolei każdy wiersz tabeli tokenów, np. `expect(css).toMatch(/--foreground:\s*#262626;/)`, `/--border:\s*rgba\(0,\s*0,\s*0,\s*\.08\);/`, `/--radius:\s*10px;/`. Test `"@theme mapuje tokeny i promienie"` sprawdza `--color-faint-foreground: var(--faint-foreground)`, `--radius-lg: 12px`, `--radius-xl: 16px` i `--shadow-xs:`.
- [ ] **Step 2:** `pnpm vitest run src/app/tokens.test.ts`. Oczekiwane: FAIL.
- [ ] **Step 3: Przepisz tokeny.**
  - `:root` i `@theme inline` w `globals.css` według tabeli, ze starymi nazwami zachowanymi jako aliasy (hover, active, meta, accent-brand, panel, border-soft, border-strong).
  - Na `body` font Inter i `font-feature-settings: "cv11"`.
  - `pnpm add @fontsource-variable/inter`. W `layout.tsx` zaimportuj `@fontsource-variable/inter` w miejsce GeistSans. GeistMono zostaje.
  - `themeColor` zostaje `#ffffff`.
- [ ] **Step 4: Makiety offline.**
  - Skopiuj z `node_modules/@fontsource-variable/inter/files/` pliki `inter-latin-wght-normal.woff2` → `docs/design/mockups/coss/inter-latin.woff2` oraz `inter-latin-ext-wght-normal.woff2` → `inter-latin-ext.woff2`.
  - W `coss.css` zamień `@import` Google Fonts na dwa `@font-face` (`font-family:"Inter"`, `font-weight:100 900`) z `url(inter-latin.woff2)` i `url(inter-latin-ext.woff2)` oraz `unicode-range` jak w Inter z fontsource.
  - W `scripts/mockup-shots.mjs:40` zmień warunek na `/^C?M[A-Z]/.test(name)` (CM* to telefon) i popraw komentarz w linii 3.
- [ ] **Step 5:** `pnpm vitest run src/app/tokens.test.ts && pnpm typecheck && pnpm build`. Oczekiwane: PASS i build OK. Potem `pnpm mockups:shots CToday CMToday`, oba PNG powstają, a CMToday ma 390×844.
- [ ] **Step 6: Commit** `feat(coss): tokeny COSS i font Inter`.

### Task 2: Kolory i promienie wpisane na sztywno → tokeny (cała aplikacja)

**Files:**
- Create: `scripts/coss-kolory.mjs`, `scripts/coss-kolory.test.mjs`
- Modify: wszystkie pliki `src/**/*.{ts,tsx}` (w tym testy), które skrypt zmieni

**Interfaces:**
- Consumes: tokeny z Task 1.
- Produces: w `src/` nie ma już klas Tailwind z hexami UI z tabeli mapowania. Eksporty skryptu: `mapClass(cls: string): string` oraz `mapSource(src: string): string`. CLI `node scripts/coss-kolory.mjs [--check]` zmienia pliki albo z `--check` wypisuje listę i kończy kodem 1, jeśli coś zostało.

**Tabela mapowania (hex → token według prefiksu).**
- Prefiksy: `text`, `bg`, `border` (też `border-t/b/l/r/x/y`), `divide`, `ring`, `outline`, `fill`, `stroke`, `decoration`, `placeholder`, `caret`.
- Kolumna „border” obejmuje też `divide-`, `ring-` i `outline-`, chyba że podano inaczej.
- Pusta komórka oznacza, że klasa zostaje bez zmian i trafia do raportu.

| hex | text / fill / stroke / placeholder / caret / decoration | bg | border |
|---|---|---|---|
| #171717 #000000 | foreground | primary | primary (ring/outline → ring) |
| #2e2e2e | foreground | primary-hover | primary |
| #404040 #525252 #555555 | soft-foreground | | border-strong |
| #666666 #666 #6b6b6b #737373 #7a7a7a | muted-foreground | muted-foreground | border-strong |
| #8a8a8a #a3a3a3 #b0b0b0 #b5b5b5 #c4c4c4 | faint-foreground | faint-foreground | ring |
| #cfcfcf #d4d4d4 #d9d9d9 | faint-foreground | border-strong | border-strong |
| #e0e0e0 #e5e5e5 | faint-foreground | input | input |
| #eaeaea #ebebeb #efefef | | border | border |
| #f0f0f0 | | active | border |
| #f2f2f2 #f4f4f5 #f5f5f5 | | muted | border |
| #fafafa #fcfcfc | primary-foreground | panel | border |
| #b91c1c | destructive-foreground | destructive | destructive |
| #991b1b | destructive-foreground | destructive-hover | destructive |
| #fef2f2 #fee2e2 | | destructive-soft | destructive-border |
| #fecaca #f3c7c7 | | destructive-soft | destructive-border |
| #15803d | success | success | success |
| #f0faf4 #f0fdf4 #f7fbf8 | | success-soft | success-border |
| #bbe5cc | | success-soft | success-border |
| #c2410c | warning-foreground | warning | warning |
| #fff4ed | | warning-soft | warning-border |
| #fed7aa | | warning-soft | warning-border |
| #0070f3 | info-foreground | info | info |
| #eef5ff | | info-soft | info-border |
| #cfe2ff | | info-soft | info-border |

**Promienie:** `rounded-[6px]` → `rounded-sm`, `rounded-[10px]` → `rounded-md`, `rounded-[12px]` → `rounded-lg`, `rounded-[16px]` → `rounded-xl` (także `rounded-t-[…]` i inne strony). Pozostałe `rounded-[…]` zostają.

**Algorytm `mapSource`:**
- Zmienia wyłącznie tokeny klas pasujące do `(warianty:)*(!)?prefiks-[#hex](/NN)?` i `rounded(-strona)?-[Npx]`.
- Zachowuje warianty (`hover:`, `max-[799px]:`, `group-hover:`, `data-[…]:`, `aria-[…]:`) oraz sufiks przezroczystości `/NN`.
- Wielkość liter hexa nie ma znaczenia.
- Gołe stringi `'#15803d'` (tablice, `style`, obiekty) i hexy w `bg-[var(...)]` zostają nietknięte, bo dopasowanie wymaga prefiksu klasy i nawiasów kwadratowych.

- [ ] **Step 1: Napisz testy `scripts/coss-kolory.test.mjs`** (vitest):
  - `mapClass("text-[#171717]")` === `"text-foreground"`
  - `mapClass("hover:bg-[#f5f5f5]")` === `"hover:bg-muted"`
  - `mapClass("max-[799px]:border-[#e0e0e0]")` === `"max-[799px]:border-input"`
  - `mapClass("focus-visible:ring-[#171717]/20")` === `"focus-visible:ring-ring/20"`
  - `mapClass("border-b-[#EAEAEA]")` === `"border-b-border"`
  - `mapClass("rounded-[10px]")` === `"rounded-md"`
  - `mapClass("bg-[#7c3aed]")` === `"bg-[#7c3aed]"` (poza tabelą)
  - `mapSource('const K = ["#15803d", "#3b82f6"]; <span style={{ background: "#b91c1c" }} className="text-[#b91c1c]" />')` zmienia tylko `text-[#b91c1c]` → `text-destructive-foreground`. Literały w tablicy i w `style` zostają identyczne.
  - `mapSource('toHaveClass("bg-[#171717]", "text-white")')` === `'toHaveClass("bg-primary", "text-white")'`
- [ ] **Step 2:** `pnpm vitest run scripts/coss-kolory.test.mjs`. Oczekiwane: FAIL.
- [ ] **Step 3: Zaimplementuj `scripts/coss-kolory.mjs`** z tabelą jako stałym obiektem `MAPA` (hex → `{ text, bg, border, ring }`) i CLI chodzącym po `src/**/*.{ts,tsx}`.
- [ ] **Step 4:** `pnpm vitest run scripts/coss-kolory.test.mjs`. Oczekiwane: PASS.
- [ ] **Step 5: Uruchom zamianę.**
  - `node scripts/coss-kolory.mjs`, potem `node scripts/coss-kolory.mjs --check`.
  - Wypisane pozostałości (klasy poza tabelą) przejrzyj. Jeśli to kolor UI, zamień ręcznie na najbliższy token. Jeśli to kolor danych albo marki, zostaw i wymień w raporcie.
  - Przejrzyj diff plików z paletami: `src/features/categories`, `src/features/pages/page-icons.ts`, heatmapa nawyków, `src/features/calendar`. Kolory danych muszą być identyczne.
- [ ] **Step 6:** `pnpm test && pnpm typecheck && pnpm lint`. Oczekiwane: PASS. Testy, które sprawdzały stare klasy, zostały przepisane przez skrypt. Testów zachowania nie zmieniaj ręcznie.
- [ ] **Step 7: Commit** `refactor(coss): kolory i promienie UI z tokenów zamiast hexów`.

### Task 3: Przyciski i pola

**Files:**
- Modify:
  - `src/components/controls/button.tsx`, `field.tsx`, `dropdown.tsx`, `date-picker.tsx`, `time-picker.tsx`, `word-confirm.tsx`
  - `src/components/auth/password-input.tsx`
  - `src/components/ui/button.tsx`, `src/components/ui/input.tsx`
- Test: `src/components/controls/button.test.tsx`, `dropdown.test.tsx`, `date-picker.test.tsx`, `time-picker.test.tsx`

**Interfaces:**
- Consumes: tokeny (Task 1).
- Produces:
  - `Button`: `variant?: "primary" | "secondary" | "soft" | "ghost" | "destructive" | "destructive-outline"` (nowe: `soft`, `destructive-outline`); `size?: "xs" | "sm" | "md" | "lg"` (nowe: `xs`, `lg`); `icon?: boolean` (nowy, kwadratowy). Domyślne bez zmian (`secondary`, `md`).
  - Stała `export const FIELD = "..."` (klasy pola `.inp`) w `field.tsx`, eksportowana z `index.ts` dla innych pól.

**Odwzorowanie z `coss.css`:**

| kontrolka | klasa w coss.css |
|---|---|
| `primary` | `.btnp` |
| `secondary` | `.btn` |
| `soft` | `.btns` |
| `ghost` | `.btng` |
| `destructive` | `.btnd` |
| `destructive-outline` | `.btndo` |
| rozmiary `xs`/`sm`/`md`/`lg` | 24/28/32/36 px (`.xs`/`.sm`/domyślny/`.lg`), promień `rounded-md`, przy `xs` 8 px |
| `icon` | szerokość = wysokość |
| pola, `Dropdown` (wyzwalacz), pole w `DatePicker`/`TimePicker` | `.inp` / `.dd` / `.igroup` |
| wyskakujące listy | `.ddpop` + `.ddopt` |

Na telefonie `max-[799px]:` przyciski `sm` mają 40 px, a `md`/`lg` oraz pola 44 px, z promieniem `rounded-md`.

- [ ] **Step 1: Testy w `button.test.tsx`** (stare asercje kolorów zastąp):
  - `"primary ma klasy COSS"`: `toHaveClass("bg-primary", "text-primary-foreground", "border-primary")`.
  - `"md na telefonie ma 44 px"`: `toHaveClass("max-[799px]:h-11")`.
  - `"wyłączony"`: `disabled` daje `toBeDisabled()` oraz `toHaveClass("disabled:opacity-[.64]")`.
  - `"fokus z klawiatury"`: `toHaveClass("focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--ring)]")` albo równoważna klasa ring. Wybierz jedną i asercję napisz pod nią.
  - `"primary jako link zachowuje jasny tekst"`: `<Button asChild variant="primary"><a href="/x">X</a></Button>` ma `hover:text-primary-foreground`.
  - `"destructive-outline i soft"`: odpowiednio `text-destructive-foreground` i `bg-muted`.
  - `"icon jest kwadratowy"`: `size="sm" icon` → `toHaveClass("w-7")`.
- [ ] **Step 2:** `pnpm vitest run src/components/controls`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 3: Przestyluj** pliki z listy według tabeli odwzorowania. W `dropdown`, `date-picker`, `time-picker` testy zachowania zostają, a asercje klas aktualizujesz.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint`. Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(coss): przyciski i pola w stylu COSS`.

### Task 4: Przełączniki, wybór i odznaki

**Files:**
- Modify: `src/components/controls/segment.tsx`, `switch.tsx`, `checkbox.tsx`, `chip.tsx`, `status-badge.tsx`, `stepper.tsx`
- Test: `segment.test.tsx`, `switch.test.tsx`, `checkbox.test.tsx`, `chip.test.tsx`, `stepper.test.tsx`; nowy `status-badge.test.tsx`

**Interfaces:**
- Produces: `BadgeTone = "green" | "orange" | "blue" | "red" | "gray" | "outline" | "dark"` (nowe: `outline`, `dark`). `StatusBadge` ma nowy prop `size?: "sm" | "lg"` (18/22 px).

**Odwzorowanie:**

| kontrolka | klasa w coss.css |
|---|---|
| `Segment` | `.seg` (przycisk 28 px; na telefonie 40 px) |
| `Switch` | `.sw` 36×20 (obszar dotyku na telefonie ≥ 44 px przez padding/pseudo) |
| `Checkbox` | `.cbx` 16 px |
| `Chip` | `.chip` (outline) i `aria-pressed` = wybrany; `solid` = `.bdg` domyślny ciemny; telefon 36 px |
| `StatusBadge` | `.bdg` w tonach: green → `.ok`, orange → `.warn`, blue → `.info`, red → `.bad`, gray → `.sec`, outline → `.out`, dark → domyślny |
| `Stepper` | krok +/− `m-step` z bloku CM-BASE w `docs/design/mockups/CMToday.dc.html` na telefonie oraz `.btn.sm.ic` na webie |

- [ ] **Step 1: Testy:**
  - `status-badge.test.tsx`: `"ton green"` → `toHaveClass("bg-success-soft", "text-success")`; `"ton outline"` → `toHaveClass("border-input", "bg-white")`; `"size lg"` → `toHaveClass("h-[22px]")`.
  - `segment.test.tsx`: wybrany przycisk ma `aria-pressed="true"` (albo jak dotąd) i `bg-white`; na telefonie `max-[799px]:h-10`.
  - `switch.test.tsx`: `checked` → `toHaveClass("bg-primary")`, rozmiar `h-5 w-9`.
  - `chip.test.tsx`: wybrany → `toHaveClass("bg-muted")`.
  - Pozostałe asercje kolorów aktualizujesz, testów zachowania nie zmieniasz.
- [ ] **Step 2:** `pnpm vitest run src/components/controls`. Oczekiwane: FAIL.
- [ ] **Step 3: Przestyluj** pliki według tabeli.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint`. Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(coss): segmenty, przełączniki, chipy i odznaki w stylu COSS`.

### Task 5: Okna, dymki, menu i powiadomienia

**Files:**
- Modify: `src/components/controls/form-dialog.tsx`, `action-popover.tsx`, `index.ts`; `src/components/ui/dialog.tsx`, `popover.tsx`, `tooltip.tsx`, `sonner.tsx`
- Test: `form-dialog.test.tsx`, `src/components/ui/sonner.test.tsx`

**Interfaces:**
- Produces: stałe w `action-popover.tsx`, eksportowane z `index.ts`:
  - `export const MENU_ITEM` (`.mi`, min. 32 px, na telefonie 44 px),
  - `export const MENU_ITEM_DANGER` (`.mi.bad`),
  - `export const MENU_SEPARATOR` (`.mi-sep`),
  - `export const MENU_LABEL` (`.mi-lbl`).

**Odwzorowanie:**

| element | klasa w coss.css |
|---|---|
| `FormDialog` i `ui/dialog` | `.dlg` (`rounded-xl`, `shadow-pop`) + `.dlg-h` / `.dlg-t` / `.dlg-d` / `.dlg-b`; stopka = `.dlg-f` (szare tło rgba(0,0,0,.025), ramka u góry) |
| tło okna | `.backdrop` (rgba(0,0,0,.32) + blur 4 px) |
| `ActionPopover` i `ui/popover` | `.pop` (`rounded-lg`, `shadow-lg`, padding 4 px) |
| `tooltip` | ciemny: `bg-primary text-primary-foreground rounded-sm text-xs`, bez strzałki, jeśli makieta jej nie ma |
| toast `sonner` | `.toast` |

- [ ] **Step 1: Testy:**
  - `form-dialog.test.tsx`: `"stopka ma tło i ramkę COSS"`, czyli element stopki ma `toHaveClass("border-t", "bg-black/[.025]")`; `"okno ma promień 16 px"` → `toHaveClass("rounded-xl")`.
  - `sonner.test.tsx`: toast ma `rounded-lg` i `shadow-lg`.
- [ ] **Step 2:** `pnpm vitest run src/components`. Oczekiwane: FAIL.
- [ ] **Step 3: Przestyluj** pliki. Zamień lokalne klasy pozycji menu w `src/features/pages/page-menu.tsx` i `src/components/shell/account-popover.tsx` na nowe stałe `MENU_*`.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint`. Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(coss): okna, dymki, menu i toasty w stylu COSS`.

### Task 6: Nowe prymitywy COSS

**Files:**
- Create: `src/components/controls/card.tsx`, `kbd.tsx`, `avatar.tsx`, `progress.tsx`, `empty-state.tsx` + testy `card.test.tsx`, `progress.test.tsx`
- Modify: `src/components/controls/index.ts`

**Interfaces:**
- Produces:
  - `Card({ className, children, ...div })` (`.card`) oraz `CardHeader`, `CardTitle` (`h2`/`h3` przez prop `as?: "h2" | "h3"`, domyślnie `h3`), `CardDescription`, `CardContent` (`.card-p`), `CardFooter` (`.foot`).
  - `Kbd({ children })` (`.kbd`).
  - `Avatar({ initials, className })` (`.avatar`, 32 px).
  - `Progress({ value, max = 100, ariaLabel })` z `role="progressbar"`, `aria-valuenow`, `aria-valuemax`; tor `.prog` i wypełnienie `bg-primary`.
  - `EmptyState({ icon?: React.ReactNode, title, description?, children? })` (`.empty` + `.empty-ic`).
  - Wszystkie eksportowane z `index.ts`.

- [ ] **Step 1: Testy:**
  - `card.test.tsx`: `"karta ma ramkę i promień 16 px"` → `toHaveClass("rounded-xl", "border-border", "shadow-xs")`; `"CardFooter ma szare tło"` → `toHaveClass("bg-black/[.025]", "border-t")`.
  - `progress.test.tsx`: `render(<Progress value={2} max={4} ariaLabel="Zadania" />)` → `getByRole("progressbar", { name: "Zadania" })` ma `aria-valuenow="2"`, a wypełnienie `style.width === "50%"`. Przy `value={0} max={0}` szerokość wynosi `"0%"` i nie ma `NaN`.
- [ ] **Step 2:** `pnpm vitest run src/components/controls/card.test.tsx src/components/controls/progress.test.tsx`. Oczekiwane: FAIL.
- [ ] **Step 3: Zaimplementuj** komponenty (każdy w swoim pliku, bez helperów).
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint`. Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(coss): karta, kbd, avatar, pasek postępu i pusty stan`.

### Task 7: Powłoka web — sidebar, menu konta, menu strony, wybór ikony, nagłówek modułu

**Files:**
- Modify: `src/components/shell/app-sidebar.tsx`, `account-popover.tsx`, `module-header.tsx`, `app-shell.tsx`; `src/features/pages/page-menu.tsx` (wariant web), `src/features/pages/icon-picker.tsx`
- Test: `src/components/shell/app-sidebar.test.tsx`, `module-header.test.tsx` (aktualizacja asercji klas)

**Interfaces:**
- Consumes: `Kbd`, `Avatar` (Task 6); `MENU_*` (Task 5); `Segment` (Task 4); `FIELD` (Task 3).
- Produces: `ModuleHeader` z niezmienionym API, wyglądający jak `.topbar` z `CToday` (tytuł `.h-title` 18 px/600, ramka dolna `border`, padding 10px 24px, min-h 36 px).

**Wzorzec:**

| element | wzorzec |
|---|---|
| sidebar | `CSidebar.dc.html`: szerokość, `bg-panel`, ramka `border-soft`, pozycje `.sb-i` (32 px, `rounded-[8px]`, aktywna `bg-black/5`, tekst `rgba(38,38,38,.72)`), nagłówki grup `.sb-g`, sekcje Moduły / Ulubione / Strony, pole „Szukaj…” z `Kbd` (dalej nieaktywne, z dymkiem „Wkrótce”), stopka z kontem (`Avatar`) |
| menu konta | jak w `CSidebar` |
| menu strony (web) | `CPageMenu.dc.html` |
| wybór ikony | `CIconPicker.dc.html` |

**Zostaje bez zmian:** przeciąganie stron, strefa upuszczania „Upuść tutaj, aby dodać do ulubionych”, ukrywanie pustej sekcji Ulubione, zachowanie menu i wszystkie etykiety ARIA. Wygląd strefy upuszczania: przerywana ramka `border-strong`, `rounded-md`, `bg-muted`, chyba że makieta pokazuje inaczej.

- [ ] **Step 1: Zaktualizuj** asercje klas w testach powłoki pod nowy wygląd, np. aktywna pozycja → `toHaveClass("bg-black/5")`. Testy zachowania zostają. Uruchom: `pnpm vitest run src/components/shell src/features/pages`. Oczekiwane: FAIL na nowych asercjach.
- [ ] **Step 2: Przestyluj** pliki według makiet. Porównuj z `pnpm mockups:shots CSidebar CPageMenu CIconPicker`. Różnice funkcjonalne wpisz do raportu w sekcji „Do decyzji”.
- [ ] **Step 3:** `pnpm test && pnpm typecheck && pnpm lint`. Oczekiwane: PASS.
- [ ] **Step 4: Commit** `feat(coss): sidebar, menu i nagłówek modułu jak w makietach COSS`.

### Task 8: Dziś (web) i wspólne dymki bloków

**Files:**
- Modify:
  - `src/features/today/today-view.tsx` (część web), `week-card.tsx`, `day-plan.tsx`, `empty-today.tsx`
  - `src/features/calendar/block-popover.tsx`, `new-entry-popover.tsx`, `delete-block-dialog.tsx`
- Test: `today-view.test.tsx`, `week-card.test.tsx`, `day-plan.test.tsx`, `empty-today.test.tsx` (asercje klas) oraz testy dymków w `src/features/calendar`

**Interfaces:**
- Consumes: `Card`, `Progress`, `EmptyState`, `Kbd` (Task 6); `StatusBadge` (`outline`, `dark`, `size="lg"`) (Task 4); `Button` (Task 3); `MENU_ITEM` (Task 5); `ModuleHeader` (Task 7).

**Wzorzec:** `CToday.dc.html` i `CEmptyToday.dc.html`.

| element | wygląd |
|---|---|
| nagłówek | `.topbar`: „Dziś”, odznaka `sec lg` z datą, „tydz. N” `.hint`, przycisk primary „Nowy blok” z ikoną `+` |
| sekcja „Ten tydzień” | 5 kart `.card` (padding 16, etykieta `.lbl`, wartość 24 px/600 tabular-nums, mini-słupki 7 dni wysokości 28 px) |
| plan dnia | ramka `.frame > .inner`, linie godzin rgba(0,0,0,.05), godziny 12 px `muted-foreground` |
| blok | tło `kolor+12`, ramka 1 px `kolor+4d`, `rounded-md`, padding 6px 10px, bez paska po lewej; zaznaczony ma pierścień `0 0 0 2px #fff, 0 0 0 4px kolor+66` |
| linia „teraz” | 2 px `#ef4444` z etykietą godziny (biała na `#ef4444`, `rounded-sm`, 11 px) |
| podgląd zaznaczania | przerywana ramka `rgba(0,0,0,.45)` przy zakresie i `rgba(0,0,0,.24)` przy najechaniu |

**Dymki (wspólne z kalendarzem):**
- `BlockPopover`: `.pop`, kropka kategorii, tytuł 16 px/600, `Progress` zadań, checkboxy, pole „Dodaj zadanie” `.igroup`, stopka z Edytuj (`secondary sm`) i Usuń (`destructive-outline sm`) na szarym tle oraz odznaka powtarzania.
- `NewEntryPopover`: pozycje 44 px z kolorowym kafelkiem ikony 28 px, kolory jak w makiecie.

**Kolor kategorii:** jak dotąd pochodzi z danych. Zmienia się tylko sposób jego użycia.

- [ ] **Step 1: Test bloku** w `day-plan.test.tsx`: `"blok ma ramkę w kolorze kategorii i bez paska"`. Dla bloku z kategorią `#3b82f6`: `style.borderColor` (lub `border`) zawiera `#3b82f6` z `4d`, `style.background` zawiera `#3b82f6` z `12`, a `style.boxShadow` nie zawiera `inset`. Pozostałe asercje klas aktualizujesz.
- [ ] **Step 2:** `pnpm vitest run src/features/today src/features/calendar`. Oczekiwane: FAIL.
- [ ] **Step 3: Przestyluj** pliki według makiet. Porównuj z `pnpm mockups:shots CToday CEmptyToday`. Telefon (`mobile/`) nie zmienia się w tym zadaniu.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint`. Oczekiwane: PASS.
- [ ] **Step 5: Commit** `feat(coss): Dziś i dymki bloków jak w makietach COSS`.

### Task 9: Weryfikacja gałęzi

- [ ] **Step 1:** `git push` i `gh run list --branch feat/coss-pilot -L1`, aż CI (unit + e2e) będzie zielone. Przy błędach infrastruktury `gh run rerun --failed`, przy prawdziwych błędach poprawka.
- [ ] **Step 2:** `node scripts/coss-kolory.mjs --check`. Lista pozostałości jest tylko tą zaakceptowaną w Task 2 (kolory danych i marki).
- [ ] **Step 3: Zbierz** sekcję „Do decyzji” z raportów zadań 7–8 do opisu PR (bez merge). Podaj Mejsonowi link do podglądu Vercel gałęzi.
