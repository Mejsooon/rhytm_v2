# Centrum powiadomień — plan

**Spec:** `docs/superpowers/specs/2026-11-28-centrum-powiadomien-design.md`. Makieta `S2Notifications` ze skryptem. Wykonuje Claude sam, przegląd na końcu.

**Czego łatwo nie zauważyć:** push działa dokładnie jak dotąd (cicha noc, urządzenia, brak sekretów); ten sam wpis nie powstaje dwa razy; błąd zapisu „przeczytane” cofa stan; adres wpisu tylko wewnętrzny (`/…`).

1. Migracja `20261208100000_powiadomienia.sql` + `supabase/tests/powiadomienia.test.sql` + typy.
2. `features/notifications/inbox-actions.ts` (`loadInbox`, `markRead(ids?)`), `inbox.tsx` (dzwonek i panel), w `app-sidebar.tsx` (nagłówek i szyna). Testy.
3. Przełączniki rodzajów w Ustawieniach bez wyszarzenia. Testy.
4. e2e, test/typecheck/lint/build, dziennik, stan, PR.
