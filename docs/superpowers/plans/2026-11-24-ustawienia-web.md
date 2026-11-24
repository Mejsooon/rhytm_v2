# Ustawienia i sejf — web — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Hasła przy zamkniętym sejfie pod rozmyciem jak S2Vault; Ogólne z kartami „Konto” i „Usuń konto” (30 dni na cofnięcie); zakładki „Konto i bezpieczeństwo” (hasło, sesje, eksport) i „Powiadomienia” (push na urządzeniach, 3 rodzaje przypomnień, cicha noc, test, przypomnienia nawyków) z pełną wysyłką przez pg_cron + pg_net + trasę Vercel.

**Spec:** `docs/superpowers/specs/2026-11-24-ustawienia-web-design.md` (czytaj w całości przed każdym zadaniem; litery A–G w zadaniach odnoszą się do sekcji specu, C1–C18 do „Decyzji Claude”).

**Makiety (wiążące, wygrywają z planem):** `docs/design/mockups/S2Settings.dc.html`, `S2SettingsAccount.dc.html`, `S2SettingsNotifications.dc.html`, `S2Vault.dc.html` (+ `S2VaultSetup`, `S2VaultReset` dla spójności) i arkusz `docs/design/mockups/coss/coss.css`. Czytaj inline-style i skrypt `<script data-dc-script>` (dane, stany, teksty). Zrzuty: `PW_CHANNEL=chrome pnpm -s mockups:shots <Nazwa>`.

**Wzorce ze starego rhytm (tylko do czytania):** `/home/claude/mejsooon/rhytm/src/app/api/cron/przypomnienia/route.ts` (+ `route.test.ts`), `supabase/migrations/0004_habit_reminders.sql`, `supabase/setup/przypomnienia-cron.sql`, `src/components/settings/PushToggle.tsx`, `public/sw.js`.

**Tech Stack:** Next.js 16 (cacheComponents — przy wątpliwościach `node_modules/next/dist/docs/`), React 19, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Tailwind 4, kontrolki `@/components/controls` (COSS), `lucide-react`, `web-push`, Vitest, Playwright (tylko CI), pgTAP (tylko CI).

## Global Constraints

- Zasady `CLAUDE.md`: płaski kod bez funkcji pomocniczych skaczących po plikach (jedyny wyjątek: `describeUserAgent`, decyzja C11), komentarze i teksty UI po polsku, SQL z jawnym `AS` przy aliasach, commity tylko na gałęzi `feat/ustawienia-web`, każdy z trailerem:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WRp6JqEaGBCeDzY48esGr5
  ```
- Każda migracja ma test pgTAP w `supabase/tests/`; wersje migracji dokładnie jak w specu (`20261129100000`, `20261129110000`, `20261129120000`, `20261129130000`). Funkcje: `set search_path = ''`, nazwy w pełni kwalifikowane, jawne `revoke`/`grant`.
- **Nie wykonuj migracji na żadnej bazie** (lokalnie nie ma Dockera; pgTAP i e2e uruchamia CI). Migracje na produkcji wykonuje koordynator po scaleniu.
- **Kod musi działać na starej bazie** (spec, „Kolejność wdrożenia i zgodność ze starą bazą”): każde nowe zapytanie do nowych kolumn, tabel i funkcji ma obsłużony błąd z komunikatem albo wariantem zastępczym.
- **Kod musi działać bez kluczy push** (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`): przełącznik pokazuje „Push nie jest jeszcze skonfigurowany”, reszta działa. Żadnych wartości sekretów w repo, testach (poza oczywistymi atrapami w testach jednostkowych) ani w czacie.
- Po każdym zadaniu: `pnpm -s test`, `pnpm -s typecheck`, `pnpm -s lint` zielone (w trakcie możesz zawężać testy do dotkniętych plików, przed commitem pełny zestaw).
- Testy e2e w `e2e/` aktualizuj albo dopisuj, gdy zmieniasz zachowanie, które sprawdzają (`settings.spec.ts`, `sejf.spec.ts`, `auth.spec.ts`, `visual.spec.ts`); uruchomi je CI. Konta testowe: `e2e/helpers/konto.ts` (`createConfirmedUser`, `uniqueEmail`, `randomPassword`), maile z Mailpit jak w istniejących testach.
- Typy bazy: dopisuj ręcznie nowe tabele, kolumny i funkcje do `src/types/database.ts` (jak w poprzednich projektach), żeby `typecheck` przechodził.
- Wygląd 1:1 z makietami (wymiary, odstępy, kolory z inline-stylów); gdy makieta i spec się różnią w wyglądzie — wygrywa makieta, poza decyzjami C1 i C2.

## Task 1: Hasła przy zamkniętym sejfie pod rozmyciem (spec A)

**Files:** modify `src/features/passwords/passwords-view.tsx` (+ `passwords-view.test.tsx`), `src/features/vault/vault-unlock-card.tsx` (+ test); read `docs/design/mockups/S2Vault.dc.html` (linie 42–84: struktura, nakładka, okno), `src/features/pages/table/secret-table-cell.tsx`, `src/features/pages/table/page-table.tsx` (jak tabela zachowuje się przy zamkniętym sejfie: `readOnly`, „zablokowane”), `src/components/shell/module-header.tsx`; e2e `e2e/sejf.spec.ts`, `e2e/visual.spec.ts`.

Kontrakt:
- `PasswordsView` przy `vault.status === "zablokowany"`: korzeń widoku to `relative` kontener obejmujący `ModuleHeader` i treść; tabela renderowana (bez `hidden`), tylko do odczytu; wiersz tytułu (ikona + „Hasła”) **nie jest renderowany**; plakietki i pasek narzędzi są.
- Treść pod nakładką w jednym opakowaniu z `inert` i `aria-hidden="true"`.
- Nakładka: `absolute inset-0 z-10 bg-white/60 backdrop-blur-[3px]`, `aria-hidden="true"`.
- `VaultUnlockCard`: korzeń `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (jak dziś); pozycja nadawana przez rodzica (`absolute left-1/2 top-[160px] -translate-x-1/2 w-[min(400px,calc(100%-32px))] z-20`, na telefonie `top-6`); pole hasła `autoFocus`.
- `ladowanie`: tabela dalej ukryta (bez mignięcia), bez nakładki; `brak`, `odblokowany`, `nieobslugiwany`: jak dziś.
- Komentarz nad `PasswordsView` opisuje nowe zachowanie (zamiast „tabela pojawia się dopiero po wpisaniu hasła”).

- [ ] Testy (najpierw czerwone): zablokowany → jest tabela z tekstem „zablokowane” w komórce sekretu, jest element z klasą `backdrop-blur-[3px]`, jest `role="dialog"` z nazwą „Odblokuj sejf”, nie ma akapitu-tytułu „Hasła” w treści (okruszki/`h1` nagłówka są w poddrzewie `aria-hidden`), treść ma atrybut `inert`; po zmianie statusu na `odblokowany` nakładki i dialogu nie ma, tytuł wraca; `ladowanie` → brak tabeli i brak nakładki.
- [ ] Implementacja; sprawdź, że „Zablokuj teraz” pokazuje się tylko przy `odblokowany`.
- [ ] e2e: `sejf.spec.ts` — jeśli test oczekuje ukrytej tabeli przy zamkniętym sejfie, zmień na: tabela widoczna z „zablokowane”, okno „Odblokuj sejf” widoczne, klik w komórkę tabeli nic nie robi; `visual.spec.ts` — zrzut zamkniętego sejfu, jeśli istnieje, zaktualizuj opis.
- [ ] Zrzut porównawczy z `S2Vault` (`pnpm -s mockups:shots S2Vault`) i własna ocena zgodności (rozmycie, położenie okna).
- [ ] Commit: `feat(hasla): zamknięty sejf pod rozmyciem jak S2Vault`.

## Task 2: Ogólne — karta „Konto” i zmiana e-maila (spec B)

**Files:** create `src/lib/user-agent.ts` (+ `user-agent.test.ts`), `src/features/settings/account-card.tsx` (+ test), `supabase/templates/email_change.html`; modify `src/app/(app)/ustawienia/[zakladka]/page.tsx` (komponent `Ogolne`: karta po „Cele”, przed „Kosz”), `src/features/settings/account-actions.ts` (nowy plik akcji konta; tu `requestEmailChange`), `src/app/auth/confirm/route.ts` (+ `route.test.ts`), `supabase/config.toml` (`[auth.email.template.email_change]`), e2e `e2e/settings.spec.ts`; read `docs/design/mockups/S2Settings.dc.html` (linie 70–78 i skrypt: `mailLine`, `mailSend`, `mailErr`), `src/features/auth/actions.ts` (`signOut`), `src/lib/auth/schemas.ts`, `supabase/templates/confirmation.html`.

Kontrakt:
- `describeUserAgent(ua: string | null): { label: string; mobile: boolean }` — reguły w specu E3.
- `AccountCard` (klient) props: `{ email: string; newEmail: string | null; hasPassword: boolean; passwordChangedAt: string | null; sessionLabel: string; emailConfirmed: boolean; timeZone: string }` (`emailConfirmed` = parametr `?email=potwierdzono`). Strona liczy `hasPassword` z `user.identities` (`provider === "email"`), `passwordChangedAt` z `user.user_metadata.password_changed_at`, `sessionLabel` z `headers().get("user-agent")`.
- `requestEmailChange(email: string): Promise<{ ok: true } | { ok: false; message: string }>` — kroki i komunikaty w specu B; `revalidatePath("/ustawienia/ogolne")` po sukcesie.
- `auth/confirm`: `TYPY` + `email_change` → `/ustawienia/ogolne?email=potwierdzono`.

- [ ] `user-agent.test.ts`: Chrome na Linuksie, Chrome na Windows, Safari na iPhonie (`mobile: true`), Firefox na Androidzie, Edge, Safari na macOS, `null` → „Przeglądarka · nieznany system”.
- [ ] `account-card.test.tsx`: podpis e-maila z i bez `newEmail`; „Zmień” → pole + „Wyślij link” + „Anuluj”; zły adres → „To nie wygląda na adres e-mail.” bez wywołania akcji; sukces → podpis „link potwierdzający wysłany na …” i dopisek o obu wiadomościach; błąd akcji pokazany; konto Google → brak „Zmień”, „konto Google”, przycisk „Ustaw hasło”; „zmienione DD.MM.RRRR” / „ustawione przy rejestracji”; wiersz Sesja z plakietką „Aktywna” i „Wyloguj”.
- [ ] Test akcji (mock klienta Supabase jak w `src/features/settings/actions.test.ts`): ten sam adres, zajęty adres, limit, sukces.
- [ ] `route.test.ts` dla `email_change` (sukces → `/ustawienia/ogolne?email=potwierdzono`, błąd → `/link-wygasl?type=signup`).
- [ ] Szablon `email_change.html` w stylu `confirmation.html` (spec B) + wpis w `config.toml`.
- [ ] e2e `settings.spec.ts`: zmiana e-maila wysyła maile na oba adresy (Mailpit), po kliknięciu obu linków Ogólne pokazuje nowy adres; wiersz Sesja ma „Wyloguj”, który prowadzi na `/logowanie`.
- [ ] Commit: `feat(ustawienia): karta Konto w Ogólnych i zmiana e-maila`.

## Task 3: Konto i bezpieczeństwo — hasło, sesje, eksport (spec C)

**Files:** create `supabase/migrations/20261129100000_account_security.sql`, `supabase/tests/account_security.test.sql`, `src/features/settings/password-card.tsx`, `src/features/settings/sessions-card.tsx`, `src/features/settings/export-card.tsx` (+ testy każdego), `src/app/api/eksport/route.ts` (+ `route.test.ts`); modify `src/features/settings/account-actions.ts` (`changePassword`, `sendSetPasswordLink`, `signOutOtherSessions`, `revokeSession`), `src/app/(app)/ustawienia/[zakladka]/page.tsx` (komponent serwerowy `Konto()` pod `Suspense` dla `tab.slug === "konto"`), `src/types/database.ts`, e2e `e2e/settings.spec.ts`; read `docs/design/mockups/S2SettingsAccount.dc.html` (cały skrypt), `src/features/auth/actions.ts` (`updatePassword`: HIBP, `signOut({ scope: "others" })`), `src/lib/auth/hibp.ts`, `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, wszystkie migracje (klucze tabel do sortowania w eksporcie).

Kontrakt:
- SQL: `list_my_sessions()`, `revoke_my_session(uuid)`, `verify_my_password(text)`, tabela `password_check_failures` — dokładnie jak spec C4.
- `changePassword(input: { current: string; next: string; repeat: string }): Promise<{ ok: true } | { ok: false; message: string }>`; `sendSetPasswordLink(): Promise<{ ok: true; email: string } | { ok: false; message: string }>`; `signOutOtherSessions(): Promise<{ ok: boolean }>`; `revokeSession(id: string): Promise<{ ok: true } | { ok: false; message: string }>` — komunikaty w specu C1–C2.
- `PasswordCard` props `{ hasPassword: boolean; email: string }`; `SessionsCard` props `{ sessions: { id: string; label: string; mobile: boolean; lastActiveAt: string; current: boolean }[]; loadError: boolean; currentLabel: string; currentMobile: boolean; timeZone: string }`; `ExportCard` bez props.
- `GET /api/eksport` — kształt JSON, nagłówki, lista tabel i obsługa braków jak w specu C3.

- [ ] Migracja + pgTAP (przypadki ze specu C4; użytkowników zakładaj jak w `supabase/tests/onboarding.test.sql`, sesje wstawiaj do `auth.sessions`, `request.jwt.claims` ustawiaj z `sub` i `session_id`). Jeśli lokalnie nie da się tego uruchomić — CI zrobi to po pushu koordynatora; zadbaj o poprawność składni (`plan(N)` = liczba asercji).
- [ ] `password-card.test.tsx`: paski i podpisy siły dla kilku haseł (z makiety), kolejność komunikatów w stopce, przycisk `aria-disabled` do czasu poprawnych danych, sukces czyści pola i pokazuje „Hasło zmienione ✓ …”, błąd akcji pokazany; wariant Google: „Ustaw hasło do konta” + „Wyślij link” → „Link wysłany na …”.
- [ ] Testy akcji: złe obecne hasło (`rpc` → `false`), `za_duzo_prob`, brak funkcji (`PGRST202`), hasło z wycieku, nowe = obecne, sukces wywołuje `updateUser` z `data.password_changed_at` i `signOut({ scope: "others" })`; `revokeSession` z `false` → „Ta sesja już wygasła.”.
- [ ] `sessions-card.test.tsx`: odmiana liczby sesji (1, 2, 5, 12), bieżąca z „Aktualna” bez „Wyloguj”, inne z „Wyloguj” → komunikat „Wylogowano: …”, „Wyloguj wszystkie inne” → komunikat i `aria-disabled` bez innych sesji, `loadError` → tekst „Nie udało się wczytać listy sesji.”.
- [ ] `export-card.test.tsx` (mock `fetch`, `URL.createObjectURL`): „ostatni eksport: nigdy”, stan „przygotowuję plik…”, po sukcesie nazwa z `Content-Disposition`, rozmiar z przecinkiem i „Pobierz ponownie”, zapis do `localStorage`, błąd → komunikat.
- [ ] `api/eksport/route.test.ts` (mock `createClient` z `@/lib/supabase/server`): 401 bez sesji; stronicowanie (1000 + 1 wiersz → dwa zapytania); błąd jednej tabeli → `pominiete`, reszta jest; `push_subscriptions` bez `p256dh`/`auth`; nagłówki.
- [ ] e2e: zmiana hasła (złe obecne → komunikat; dobre → sukces; wylogowanie i logowanie nowym hasłem), druga sesja w osobnym kontekście przeglądarki widoczna na liście i „Wyloguj wszystkie inne” ją kończy (po odświeżeniu drugi kontekst ląduje na `/logowanie` najpóźniej po wygaśnięciu tokenu — jeśli to niestabilne, sprawdzaj tylko zniknięcie z listy), eksport pobiera plik `.json` z kluczem `tabele`.
- [ ] Commit(y): `feat(db): sesje i weryfikacja hasła`, `feat(ustawienia): konto i bezpieczeństwo`.

## Task 4: Usuwanie konta z 30 dniami na cofnięcie (spec D)

**Files:** create `supabase/migrations/20261129110000_account_deletion.sql`, `supabase/tests/account_deletion.test.sql`, `src/features/settings/delete-account-card.tsx` (+ test), `src/app/(auth)/konto-usuniete/page.tsx` (+ `page.test.tsx`), `src/features/settings/restore-account.tsx` (klient z przyciskami, jeśli strona tego wymaga); modify `src/features/settings/account-actions.ts` (`requestAccountDeletion`, `restoreAccount`), `src/proxy.ts` (+ `src/proxy.test.ts`), `src/lib/auth/route-guard.ts` (+ test), `src/app/(auth)/logowanie/page.tsx` (komunikat `?konto=usuniete`), `src/app/(app)/ustawienia/[zakladka]/page.tsx` (karta na końcu Ogólnych), `src/types/database.ts`, e2e `e2e/auth.spec.ts` albo `e2e/settings.spec.ts`; read `docs/design/mockups/S2Settings.dc.html` (linie 80–84 i `delTxt`/`delOk`/`delS` w skrypcie), `src/components/controls/word-confirm.tsx` (użyj, jeśli da się ułożyć dokładnie jak makieta; inaczej pole w karcie), `src/features/settings/actions.ts` (`removeAvatar`), `src/app/(auth)/link-wygasl/page.tsx` (wzór ekranu), `supabase/migrations/20261120120000_pages.sql` (wzór crona).

Kontrakt:
- SQL jak spec D3 (`deletion_requested_at`, `guard_deletion_requested_at` + wyzwalacz `profiles_deletion_guard`, `purge_deleted_accounts()`, zadanie `rhytm-purge-accounts`).
- `requestAccountDeletion(word: string): Promise<{ ok: false; message: string }>` (sukces kończy się `redirect`); `restoreAccount(): Promise<{ ok: false; message: string }>` (sukces → `redirect("/dzis")`).
- `resolveRoute({ pathname, isLoggedIn, isOnboarded, deletionRequestedAt })` — reguły w specu D2; proxy z drugim zapytaniem przy kodzie `42703`.
- `DeleteAccountCard` bez props (stan lokalny + akcja).

- [ ] Migracja + pgTAP (przypadki ze specu D3).
- [ ] `route-guard.test.ts`: zalogowany z datą → `/dzis`, `/ustawienia/ogolne`, `/`, `/logowanie`, `/onboarding` przekierowują na `/konto-usuniete`; `/konto-usuniete`, `/api/eksport`, `/auth/confirm`, `/regulamin` przepuszczone; `/konto-usuniete` bez daty → `/dzis` (albo `/onboarding`), niezalogowany → `/logowanie`; istniejące przypadki bez zmian.
- [ ] `proxy.test.ts`: błąd `42703` → drugie zapytanie bez kolumny i brak przekierowania na `/konto-usuniete`; data ustawiona → przekierowanie.
- [ ] `delete-account-card.test.tsx`: tekst z decyzji C2, „Usuń konto” → pole, przycisk `aria-disabled` do wpisania „usuń ” (małe litery i spacja też przechodzą, jak w makiecie), „Anuluj” wraca, błąd akcji pokazany.
- [ ] Test akcji: złe słowo → błąd bez zapisu; błąd zapisu → komunikat i brak `signOut`; sukces → zapis, usunięcie urządzeń push (błąd ignorowany — tabela może nie istnieć), usunięcie zdjęcia, `signOut({ scope: "global" })`, `redirect("/logowanie?konto=usuniete")`.
- [ ] Strona `/konto-usuniete`: data trwałego usunięcia = `deletion_requested_at + 30 dni` po polsku (np. „24 grudnia 2026”), trzy przyciski ze specu D2; test komponentu.
- [ ] e2e: usuń konto (wpisz USUŃ) → `/logowanie` z komunikatem → zaloguj się → `/konto-usuniete` → „Przywróć konto” → `/dzis` i Ogólne bez zmian.
- [ ] Commit(y): `feat(db): usuwanie konta po 30 dniach`, `feat(ustawienia): usuwanie konta z możliwością przywrócenia`.

## Task 5: Push — baza, service worker, subskrypcja urządzenia (spec E)

**Files:** create `supabase/migrations/20261129120000_push.sql`, `supabase/tests/push.test.sql`, `public/sw.js`, `src/features/notifications/push-actions.ts` (+ test), `src/features/notifications/use-push-device.ts` (+ test); modify `next.config.ts` (nagłówki `/sw.js`), `src/proxy.ts` (`matcher` bez `sw.js`), `src/features/onboarding/actions.ts` (`before_block_min: d.before ? 5 : null`) i jego test, `.env.example`, `src/types/database.ts`; read stary rhytm: `supabase/migrations/0004_habit_reminders.sql` (`save_push_subscription`), `public/sw.js`, `src/components/settings/PushToggle.tsx`, `src/lib/push/subscription.ts`; `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`.

Kontrakt:
- SQL jak spec E1 (tabela, RLS, granty bez `insert`, `save_push_subscription(text, text, text, text) returns uuid`, wartości domyślne i normalizacja `notification_settings`).
- `savePushDevice(input: { endpoint: string; p256dh: string; auth: string }): Promise<{ ok: true; id: string } | { ok: false; message: string }>`; `removePushDevice(endpoint: string): Promise<{ ok: boolean }>`; `setDeviceEnabled(id: string, enabled: boolean): Promise<{ ok: true } | { ok: false; message: string }>`.
- `usePushDevice(): { stan: "ladowanie" | "nieskonfigurowany" | "nieobslugiwany" | "ios-instalacja" | "zablokowany" | "wylaczony" | "wlaczony"; endpoint: string | null; blad: string | null; zajety: boolean; wlacz(): Promise<void>; wylacz(): Promise<void> }` — zachowanie w specu E3. Komunikaty błędów: „Nie udało się włączyć powiadomień.”, „Nie udało się wyłączyć powiadomień.”, „Nie udało się zapisać urządzenia.”.

- [ ] Migracja + pgTAP (przypadki ze specu E1).
- [ ] `use-push-device.test.ts` (mocki `navigator.serviceWorker`, `PushManager`, `Notification`, akcji): brak klucza → `nieskonfigurowany`; brak API → `nieobslugiwany`; iPhone bez standalone → `ios-instalacja`; `denied` → `zablokowany`; istniejąca subskrypcja → `wlaczony` i wywołanie `savePushDevice`; `wlacz()` → `register`, `subscribe` z kluczem `Uint8Array`, zapis; błąd zapisu → `unsubscribe()` i `blad`; `wylacz()` → `removePushDevice` i `unsubscribe()`.
- [ ] `push-actions.test.ts`: walidacja, etykieta z nagłówka `user-agent`, błąd RPC → komunikat, `setDeviceEnabled` aktualizuje tylko `enabled`.
- [ ] `sw.js` (kopia ze zmianami ze specu E2), nagłówki w `next.config.ts`, `matcher`, `.env.example` (puste wartości, polskie komentarze, gdzie je wziąć — odsyłacz do „Kroki Mejsona” w specu).
- [ ] Onboarding zapisuje 5 zamiast 10 (decyzja C4) — popraw test.
- [ ] Commit(y): `feat(db): subskrypcje push`, `feat(powiadomienia): service worker i subskrypcja urządzenia`.

## Task 6: Push — wysyłka (cron, trasa, test) (spec F)

**Files:** create `supabase/migrations/20261129130000_push_dispatch.sql`, `supabase/tests/push_dispatch.test.sql`, `src/app/api/cron/powiadomienia/route.ts` (+ `route.test.ts`), `src/features/notifications/actions.ts` (`sendTestPush`) (+ test); modify `package.json`/`pnpm-lock.yaml` (`web-push`, `@types/web-push`), `src/lib/auth/route-guard.ts` (+ test: `/api/cron/` publiczny), `src/types/database.ts`; read stary rhytm (`route.ts`, `route.test.ts`, `0004_habit_reminders.sql`: `claim_due_habit_reminders`, `remove_push_subscriptions`; `supabase/setup/przypomnienia-cron.sql`), `src/features/calendar/occurrences.ts`, `src/features/pages/fields.ts` (`addCycle`, `rowCycle`, `rowActive`), loader odnowień kalendarza (znajdź: `grep -rn "renewal" src/features/calendar src/app/\(app\)/kalendarz`), `src/features/habits/model.ts` (tydzień dla `times_per_week`), `supabase/migrations/20261127100000_subscriptions.sql`, `20261120120000_pages.sql` (kolumny stron, `deleted_at`).

Kontrakt:
- SQL jak spec F1: `push_log`, `claim_due_notifications(timestamptz)` (kolumny wyniku: `endpoint, p256dh, auth, kind, title, body, tag, url`), `dispatch_notifications() returns int`, `remove_push_subscriptions(text, text[]) returns int`, zadanie `rhytm-powiadomienia`, `pg_net` w schemacie `extensions`. Każdy rodzaj w osobnym CTE z komentarzem po polsku; jedna funkcja (bez funkcji pomocniczych SQL).
- `POST /api/cron/powiadomienia` → `{ sent: number; failed: number; removed: number }`, statusy 401/400/500 jak w specu F2.
- `sendTestPush(): Promise<{ ok: true; sent: number } | { ok: false; message: string }>`.

- [ ] Migracja + pgTAP: wszystkie przypadki z listy w specu F1 (stały `p_now`, np. `'2026-12-02 19:00:00+00'`, profil `Europe/Warsaw`). Dane zasiewaj jako `postgres` z jawnym `user_id`; strony/pola/wiersze Subscriptions buduj ręcznie (`pages`, `page_blocks`, `page_fields` z `type = 'renewal'`/`'recurring'`/`'checkbox'`, `page_rows.values`).
- [ ] `route.test.ts`: przypadki z testu starego rhytm (401 × 5 wariantów, 500 bez VAPID tylko po poprawnym tokenie, 400, 410 → `removed` i `rpc` z endpointem, 500 z serwera push → `failed` bez usuwania, payload `{ title, body, tag, url }` z `TTL: 3600` i `timeout: 10000`) + klient Supabase tworzony z `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Test `sendTestPush`: brak VAPID → komunikat; brak urządzeń → komunikat; dwa urządzenia → `sent: 2`; 410 → usunięcie własnego wiersza.
- [ ] `route-guard`: `/api/cron/powiadomienia` bez sesji nie przekierowuje.
- [ ] Commit(y): `feat(db): wysyłka przypomnień push`, `feat(powiadomienia): trasa crona i powiadomienie testowe`.

## Task 7: Zakładka Powiadomienia i przypomnienia nawyków (spec G)

**Files:** create `src/features/notifications/notifications-card.tsx`, `src/features/notifications/devices-card.tsx`, `src/features/notifications/habit-reminders-card.tsx` (+ testy każdego); modify `src/features/notifications/actions.ts` (`saveNotificationSettings`, `setHabitReminder`) (+ test), `src/app/(app)/ustawienia/[zakladka]/page.tsx` (komponent `Powiadomienia()` pod `Suspense`; usuń kartę „Ta zakładka powstanie w kolejnym etapie”, jeśli nie ma już zakładek bez treści), e2e `e2e/settings.spec.ts`, `e2e/visual.spec.ts`; read `docs/design/mockups/S2SettingsNotifications.dc.html` (cały skrypt: `KL`, `mkTP`, `devices`, `habits`, `testMsg`), `src/components/controls/switch.tsx`, `time-picker.tsx`, `src/features/habits/text.ts`, `src/features/habits/load-habits.ts`.

Kontrakt:
- `saveNotificationSettings(patch: Partial<{ habits_enabled: boolean; before_block_min: 5 | null; renewals_enabled: boolean; quiet_enabled: boolean; quiet_from: string; quiet_to: string }>): Promise<{ ok: true } | { ok: false; message: string }>`; `setHabitReminder(habitId: string, remindAt: string | null): Promise<{ ok: true } | { ok: false; message: string }>`.
- `NotificationsCard` props `{ settings: { habits: boolean; block: boolean; renewals: boolean; quiet: boolean; quietFrom: string; quietTo: string }; deviceCreatedAt: Record<string, string>; activeDevices: number }` (+ hook `usePushDevice` wewnątrz; `deviceCreatedAt` po `endpoint` do podpisu „włączone DD.MM.RRRR”). Stan push i endpoint przekazuj do `DevicesCard` i `HabitRemindersCard` przez wspólnego rodzica-klienta w tym samym pliku strony albo w `notifications-card.tsx` (jeden komponent kliencki składający trzy karty — bez kontekstu).
- `DevicesCard` props `{ devices: { id: string; endpoint: string; label: string; mobile: boolean; enabled: boolean; lastSeenAt: string }[]; currentEndpoint: string | null; loadError: boolean; timeZone: string }`.
- `HabitRemindersCard` props `{ habits: { id: string; name: string; schedule: string; remindAt: string | null }[]; disabled: boolean }`.

- [ ] Testy komponentów: podpisy przełącznika push dla każdego stanu hooka (mock `usePushDevice`); rodzaje wyszarzone i `aria-disabled` przy push wyłączonym, zapisane wartości nietknięte; przełączenie rodzaju wywołuje akcję z właściwym polem (`before_block_min` 5 ↔ null), błąd cofa przełącznik i pokazuje komunikat; cicha noc: podpis „Bez powiadomień 23:00–07:00”, wybór godziny zapisuje `quiet_from`; „Wyślij testowe” `aria-disabled` bez urządzeń, sukces → „Wysłano testowe powiadomienie na 2 urządzenia ✓” (odmiana: 1 urządzenie, 2–4 urządzenia, 5+ urządzeń); urządzenia: plakietka „TO” przy bieżącym endpoincie, „Wyłącz”/„Włącz”, podpis „powiadomienia wyłączone”, pusta lista, błąd; nawyki: podpis harmonogramu, `TimePicker` przy włączonym, „wyłączone” przy `null`, włączenie ustawia „20:30”, brak nawyków → tekst i link.
- [ ] Test akcji: walidacja `quiet_from` (`HH:MM`, minuty co 5), `upsert` z `onConflict: "user_id"`, `setHabitReminder` z `null` i z godziną.
- [ ] e2e `settings.spec.ts`: w CI bez VAPID przełącznik ma podpis „Push nie jest jeszcze skonfigurowany”; przełączenie „Odnowienia subskrypcji” i cichej nocy przetrwa odświeżenie strony; włączenie przypomnienia nawyku (nawyk zasiany przez API) i zmiana godziny są widoczne w module Nawyki (okno nawyku pokazuje godzinę). `visual.spec.ts`: zrzuty zakładek Konto i Powiadomienia obok makiet, jeśli plik ma taki wzorzec.
- [ ] Zrzuty porównawcze `S2SettingsNotifications`, `S2SettingsAccount`, `S2Settings` i własna ocena zgodności.
- [ ] Commit: `feat(ustawienia): zakładka Powiadomienia`.

## Task 8 (koordynator): przegląd, CI, scalenie, migracje, kroki Mejsona, dziennik

**Files:** `docs/superpowers/dziennik/2026-11-24.md` (albo dzisiejszy), `docs/superpowers/stan-projektu.md`, `docs/superpowers/odlozone.md`, `docs/superpowers/do-decyzji-seria.md`.

- [ ] **Przed Task 1:** gałąź `feat/ustawienia-web` (już utworzona z `main`); pierwszy commit `docs(ustawienia): spec i plan` z tym planem i specem; wpis w dzienniku i w `stan-projektu.md` („W toku: Ustawienia i sejf — web”).
- [ ] Po każdym zadaniu recenzent (subagent-driven-development) sprawdza zgodność ze specem i makietami (zrzuty `pnpm -s mockups:shots S2Vault S2Settings S2SettingsAccount S2SettingsNotifications`), kontrakty, obsługę starej bazy i braku kluczy push. Zadania 3, 4, 5 i 6 (migracje, sesje, usuwanie konta, sekret crona) recenzent sprawdza także pod kątem bezpieczeństwa: `security definer` tylko z `auth.uid()`, `search_path = ''`, granty, brak sekretów w logach i odpowiedziach. Drobne uwagi → `odlozone.md`.
- [ ] Przegląd całej gałęzi: płaski kod (jedyna wspólna funkcja `describeUserAgent`), teksty po polsku, SQL z `AS`, cztery migracje z testami pgTAP, wersje plików zgodne ze specem, brak wartości sekretów w repo.
- [ ] Push gałęzi, CI zielone (pgTAP: `account_security`, `account_deletion`, `push`, `push_dispatch` + dotychczasowe; e2e). Niestabilne testy z `CLAUDE.md` (`[mobile] today.spec.ts:185`, limit GitHuba w `supabase/setup-cli`) ponów przez `gh run rerun <id> --failed`, logi przez `gh run view <id> --log-failed`. Jeśli pgTAP pokaże brak praw `postgres` do `auth.sessions` albo `auth.users`, zastosuj wariant awaryjny z decyzji C8 i zapisz to w „Do decyzji”.
- [ ] Scalenie (seria autonomiczna według `CLAUDE.md`): `git checkout main && git merge --no-ff feat/ustawienia-web`; `pnpm -s test && pnpm -s typecheck && pnpm -s lint` na połączonym kodzie; push `main`.
- [ ] **Migracje po wdrożeniu kodu na Vercel** (spec, „Kolejność wdrożenia”): po zakończonym wdrożeniu `main` na Vercel, przez konektor Supabase `apply_migration` na projekcie `yazntcoocfxfxqqevxoh`, po kolei: `account_security`, `account_deletion`, `push`, `push_dispatch` (treść = pliki). Po każdej `list_migrations` i poprawa wersji w historii produkcji na numer z nazwy pliku (`update supabase_migrations.schema_migrations as m set version = '<wersja z pliku>' where m.version = '<wersja nadana>' and m.name = '<nazwa>';`). **Nie zmieniaj nazw plików.** Migracje niczego nie usuwają (zmiana `before_block_min`/`renewal_days_before` to aktualizacja ustawień), więc nie wymagają osobnego potwierdzenia Mejsona poza zgodą w konektorze. Gdy Mejsona nie ma (konektor nie dostaje zgody), zapisz w dzienniku, że migracje czekają; kod działa na starej bazie.
- [ ] Sprawdzenie na produkcji po migracjach (tylko odczyt, `execute_sql`): `select jobname from cron.job as j where j.jobname in ('rhytm-powiadomienia', 'rhytm-purge-accounts')`; `select count(*) from public.list_my_sessions()` nie jest możliwe jako `postgres` — zamiast tego sprawdź w aplikacji, że zakładka Konto pokazuje sesje. `dispatch_notifications()` przed krokami Mejsona zwraca 0 (sprawdź `cron.job_run_details` po kilku minutach: status `succeeded`).
- [ ] Przekaż Mejsonowi sekcję „Kroki Mejsona” ze specu (VAPID, `CRON_SECRET`, Vault, szablon maila, sprawdzenie) — bez wartości.
- [ ] Dziennik (Co zrobione, Decyzje, Otwarte wątki, Błędy) i `stan-projektu.md`: projekt w „Zrobione” z merge'em i migracjami; „Otwarte wątki”: kroki Mejsona dla push i szablonu maila; w „Dalej”: telefon (CMSettings*, CMVault) w Etapie 3.
- [ ] Lista „Do decyzji” dla Mejsona: decyzje C1–C18 ze specu, każda z kosztem pomyłki (dopisz do `docs/superpowers/do-decyzji-seria.md`).
