begin;
select plan(48);

-- Konta (profil tworzy wyzwalacz; strefa Europe/Warsaw, tydzień od poniedziałku, waluta PLN):
--   A1 nawyki (2 włączone urządzenia + 1 wyłączone), A2 nawyki wyłączone w ustawieniach, A3 tylko wyłączone urządzenie,
--   A4 cicha noc 19:30–06:00 (przez północ), A5 konto oznaczone do usunięcia, A6 bloki, A7 odnowienia (bez wiersza ustawień).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000006a1', 'a61@test.pl', '{"display_name":"A1"}'),
  ('00000000-0000-0000-0000-0000000006a2', 'a62@test.pl', '{"display_name":"A2"}'),
  ('00000000-0000-0000-0000-0000000006a3', 'a63@test.pl', '{"display_name":"A3"}'),
  ('00000000-0000-0000-0000-0000000006a4', 'a64@test.pl', '{"display_name":"A4"}'),
  ('00000000-0000-0000-0000-0000000006a5', 'a65@test.pl', '{"display_name":"A5"}'),
  ('00000000-0000-0000-0000-0000000006a6', 'a66@test.pl', '{"display_name":"A6"}'),
  ('00000000-0000-0000-0000-0000000006a7', 'a67@test.pl', '{"display_name":"A7"}');

update public.profiles as p set timezone = 'Europe/Warsaw', week_start = 'mon', currency = 'PLN'
where p.user_id::text like '00000000-0000-0000-0000-0000000006a_';
update public.profiles as p set deletion_requested_at = now()
where p.user_id = '00000000-0000-0000-0000-0000000006a5';

-- Ustawienia (A7 bez wiersza = wartości domyślne: odnowienia włączone, dzień przed, o 9:00)
insert into public.notification_settings (user_id, habits_enabled, before_block_min, quiet_enabled, quiet_from, quiet_to)
values
  ('00000000-0000-0000-0000-0000000006a1', true, null, false, '23:00', '07:00'),
  ('00000000-0000-0000-0000-0000000006a2', false, null, false, '23:00', '07:00'),
  ('00000000-0000-0000-0000-0000000006a3', true, null, false, '23:00', '07:00'),
  ('00000000-0000-0000-0000-0000000006a4', true, null, true, '19:30', '06:00'),
  ('00000000-0000-0000-0000-0000000006a5', true, null, false, '23:00', '07:00'),
  ('00000000-0000-0000-0000-0000000006a6', false, 5, false, '23:00', '07:00')
on conflict (user_id) do update
  set habits_enabled = excluded.habits_enabled,
      before_block_min = excluded.before_block_min,
      quiet_enabled = excluded.quiet_enabled,
      quiet_from = excluded.quiet_from,
      quiet_to = excluded.quiet_to;
delete from public.notification_settings as ns where ns.user_id = '00000000-0000-0000-0000-0000000006a7';

-- Urządzenia (bezpośrednio jako właściciel; klient zapisuje przez save_push_subscription)
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, label, enabled)
values
  ('00000000-0000-0000-0000-0000000006a1', 'https://fcm.googleapis.com/fcm/send/a1-1', 'k1', 'x1', 'Chrome · Windows', true),
  ('00000000-0000-0000-0000-0000000006a1', 'https://fcm.googleapis.com/fcm/send/a1-2', 'k2', 'x2', 'Chrome · Android', true),
  ('00000000-0000-0000-0000-0000000006a1', 'https://fcm.googleapis.com/fcm/send/a1-3', 'k3', 'x3', 'Firefox · Linux', false),
  ('00000000-0000-0000-0000-0000000006a2', 'https://fcm.googleapis.com/fcm/send/a2', 'k', 'x', 'Chrome · Windows', true),
  ('00000000-0000-0000-0000-0000000006a3', 'https://fcm.googleapis.com/fcm/send/a3', 'k', 'x', 'Chrome · Windows', false),
  ('00000000-0000-0000-0000-0000000006a4', 'https://fcm.googleapis.com/fcm/send/a4', 'k', 'x', 'Chrome · Windows', true),
  ('00000000-0000-0000-0000-0000000006a5', 'https://fcm.googleapis.com/fcm/send/a5', 'k', 'x', 'Chrome · Windows', true),
  ('00000000-0000-0000-0000-0000000006a6', 'https://fcm.googleapis.com/fcm/send/a6', 'k', 'x', 'Chrome · Windows', true),
  ('00000000-0000-0000-0000-0000000006a7', 'https://fcm.googleapis.com/fcm/send/a7', 'k', 'x', 'Chrome · Windows', true);

-- Nawyki. Wywołanie 1: p_now = 2026-12-02 19:00 UTC = środa 20:00 w Warszawie.
--   01 codziennie 20:00 → należny; 02 odhaczony dziś; 03 pn, wt, czw; 04 2×/tydz. z dwoma odhaczeniami w tym tygodniu;
--   05 2×/tydz. o 19:50 z odhaczeniem w niedzielę poprzedniego tygodnia i w poniedziałek → należny (okno do 20:05);
--   06 o 20:30 (za wcześnie); 07 o 19:40 (okno minęło o 19:55); 0c harmonogram dopiero od jutra;
--   08 A2 (nawyki wyłączone), 09 A3 (urządzenie wyłączone), 0a A4 (cicha noc), 0b A5 (konto do usunięcia).
insert into public.habits (id, user_id, name, remind_at)
values
  ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a1', 'Woda', '20:00'),
  ('61000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000006a1', 'Odhaczony', '20:00'),
  ('61000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000006a1', 'Nie dziś', '20:00'),
  ('61000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000006a1', 'Tydzień zaliczony', '20:00'),
  ('61000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000006a1', 'Dwa razy', '19:50'),
  ('61000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000006a1', 'Później', '20:30'),
  ('61000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000006a1', 'Okno minęło', '19:40'),
  ('61000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000006a1', 'Od jutra', '20:00'),
  ('61000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-0000000006a2', 'Wyłączone', '20:00'),
  ('61000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000006a3', 'Bez urządzenia', '20:00'),
  ('61000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000006a4', 'Cisza', '20:00'),
  ('61000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000006a5', 'Do usunięcia', '20:00');

insert into public.habit_schedules (habit_id, user_id, valid_from, schedule_type, weekdays, times_per_week)
select h.id, h.user_id, '2026-11-01', 'daily', '{}', null
from public.habits as h
where h.id::text like '61000000-%'
  and h.id not in ('61000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000004',
    '61000000-0000-0000-0000-000000000005', '61000000-0000-0000-0000-00000000000c');
insert into public.habit_schedules (habit_id, user_id, valid_from, schedule_type, weekdays, times_per_week)
values
  ('61000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000006a1', '2026-11-01', 'weekdays', '{1,2,4}', null),
  ('61000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000006a1', '2026-11-01', 'times_per_week', '{}', 2),
  ('61000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000006a1', '2026-11-01', 'times_per_week', '{}', 2),
  ('61000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000006a1', '2026-12-03', 'daily', '{}', null);

insert into public.habit_checks (habit_id, user_id, date)
values
  ('61000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000006a1', '2026-12-02'),
  ('61000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000006a1', '2026-11-30'),
  ('61000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000006a1', '2026-12-01'),
  ('61000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000006a1', '2026-11-29'),
  ('61000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000006a1', '2026-11-30');

-- Bloki A6 (strefa bloku Europe/Warsaw):
--   01 jednorazowy 20:05 → należny; 02 jednorazowy 20:10 (10 min przed); 03 codziennie 20:05 z wyjątkiem cancelled 2.12;
--   04 codziennie 19:00 z wyjątkiem modified 2.12 → 20:05, „Przeniesiony”, 30 min; 05 pn–pt 20:05 od 30.11;
--   06 jednorazowy 3.12 00:03 (wywołanie 2 o 23:58); 07 jednorazowy 20:05 bez przypomnienia.
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone, recurrence, remind)
values
  ('62000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a6', 'Siłownia', '2026-12-02 20:05', 60, 'Europe/Warsaw', null, true),
  ('62000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000006a6', 'Za 10 min', '2026-12-02 20:10', 60, 'Europe/Warsaw', null, true),
  ('62000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000006a6', 'Codziennie', '2026-11-01 20:05', 30, 'Europe/Warsaw', '{"freq":"daily"}', true),
  ('62000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000006a6', 'Seria', '2026-11-01 19:00', 60, 'Europe/Warsaw', '{"freq":"daily"}', true),
  ('62000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000006a6', 'Dni robocze', '2026-11-30 20:05', 30, 'Europe/Warsaw', '{"freq":"weekdays"}', true),
  ('62000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000006a6', 'Po północy', '2026-12-03 00:03', 30, 'Europe/Warsaw', null, true),
  ('62000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000006a6', 'Bez przypomnienia', '2026-12-02 20:05', 30, 'Europe/Warsaw', null, false);

insert into public.block_exceptions (block_id, user_id, occurrence_date, kind, new_start_local, new_duration_min, new_title)
values
  ('62000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000006a6', '2026-12-02', 'cancelled', null, null, null),
  ('62000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000006a6', '2026-12-02', 'modified', '2026-12-02 20:05', 30, 'Przeniesiony');

-- Odnowienia A7. Wywołanie 4: p_now = 2027-02-27 08:00 UTC = sobota 09:00 w Warszawie → termin 28.02.2027 (rok nieprzestępny).
-- Strona 01: pola Nazwa (tytuł), Kwota (Kwota cykliczna), Aktywna (Checkbox), Odnowienie (Data odnowienia z odwołaniami).
--   01 Netflix, miesięcznie od 31.01.2027 → 28.02; 02 roczna od 28.02.2026 → 28.02.2027; 03 roczna od 28.08.2026 (6 miesięcy) → nic;
--   04 nieaktywna (checkbox false) → nic; 05 wiersz w koszu → nic; 06 bez nazwy i kwoty, od 28.01.2027 → 28.02.
-- Strona 02 w koszu z należnym wierszem 07 → nic.
insert into public.pages (id, user_id, title, template_key)
values
  ('63000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7', 'Subskrypcje', 'subscriptions'),
  ('63000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000006a7', 'Stara', 'subscriptions');
insert into public.page_blocks (id, page_id, user_id, type)
values
  ('64000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7', 'table'),
  ('64000000-0000-0000-0000-000000000002', '63000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000006a7', 'table');
insert into public.page_fields (id, block_id, user_id, name, type, config, position, is_title)
values
  ('65000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7', 'Nazwa', 'text', '{}', 0, true),
  ('65000000-0000-0000-0000-000000000002', '64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7', 'Kwota', 'recurring', '{"default_cycle":"month"}', 1, false),
  ('65000000-0000-0000-0000-000000000003', '64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7', 'Aktywna', 'checkbox', '{}', 2, false),
  ('65000000-0000-0000-0000-000000000004', '64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7', 'Odnowienie', 'renewal',
    '{"cycle_field_id":"65000000-0000-0000-0000-000000000002","active_field_id":"65000000-0000-0000-0000-000000000003","show_in_calendar":true}', 3, false),
  ('65000000-0000-0000-0000-000000000005', '64000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000006a7', 'Odnowienie', 'renewal', '{"cycle":"month"}', 0, false);
insert into public.page_rows (id, block_id, user_id, values, deleted_at)
values
  ('66000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7',
    '{"65000000-0000-0000-0000-000000000001":"Netflix","65000000-0000-0000-0000-000000000002":{"amount":43.5,"cycle":"month"},"65000000-0000-0000-0000-000000000003":true,"65000000-0000-0000-0000-000000000004":"2027-01-31"}', null),
  ('66000000-0000-0000-0000-000000000002', '64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7',
    '{"65000000-0000-0000-0000-000000000001":"Domena","65000000-0000-0000-0000-000000000002":{"amount":60,"cycle":"year"},"65000000-0000-0000-0000-000000000003":true,"65000000-0000-0000-0000-000000000004":"2026-02-28"}', null),
  ('66000000-0000-0000-0000-000000000003', '64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7',
    '{"65000000-0000-0000-0000-000000000001":"Inna roczna","65000000-0000-0000-0000-000000000002":{"amount":99,"cycle":"year"},"65000000-0000-0000-0000-000000000003":true,"65000000-0000-0000-0000-000000000004":"2026-08-28"}', null),
  ('66000000-0000-0000-0000-000000000004', '64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7',
    '{"65000000-0000-0000-0000-000000000001":"Nieaktywna","65000000-0000-0000-0000-000000000002":{"amount":10,"cycle":"month"},"65000000-0000-0000-0000-000000000003":false,"65000000-0000-0000-0000-000000000004":"2027-01-28"}', null),
  ('66000000-0000-0000-0000-000000000005', '64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7',
    '{"65000000-0000-0000-0000-000000000001":"W koszu","65000000-0000-0000-0000-000000000003":true,"65000000-0000-0000-0000-000000000004":"2027-01-28"}', now()),
  ('66000000-0000-0000-0000-000000000006', '64000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000006a7',
    '{"65000000-0000-0000-0000-000000000001":"  ","65000000-0000-0000-0000-000000000003":true,"65000000-0000-0000-0000-000000000004":"2027-01-28"}', null),
  ('66000000-0000-0000-0000-000000000007', '64000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000006a7',
    '{"65000000-0000-0000-0000-000000000005":"2027-01-28"}', null);
update public.pages as p set deleted_at = now() where p.id = '63000000-0000-0000-0000-000000000002';

-- Schemat, uprawnienia, cron
select has_table('public', 'push_log', 'istnieje push_log');
select has_function('public', 'claim_due_notifications', array['timestamp with time zone'], 'istnieje claim_due_notifications(timestamptz)');
select has_function('public', 'dispatch_notifications', 'istnieje dispatch_notifications()');
select has_function('public', 'remove_push_subscriptions', array['text', 'text[]'], 'istnieje remove_push_subscriptions(text, text[])');
select ok(not has_function_privilege('authenticated', 'public.claim_due_notifications(timestamptz)', 'execute'),
  'authenticated nie wykonuje claim_due_notifications');
select ok(not has_function_privilege('authenticated', 'public.dispatch_notifications()', 'execute'),
  'authenticated nie wykonuje dispatch_notifications');
select ok(not has_function_privilege('anon', 'public.claim_due_notifications(timestamptz)', 'execute'),
  'anon nie wykonuje claim_due_notifications');
select ok(has_function_privilege('anon', 'public.remove_push_subscriptions(text, text[])', 'execute'),
  'anon wykonuje remove_push_subscriptions (trasa crona, sekret sprawdza funkcja)');
select ok(not has_table_privilege('authenticated', 'public.push_log', 'SELECT'),
  'authenticated nie czyta push_log');
select is((select j.schedule from cron.job as j where j.jobname = 'rhytm-powiadomienia'), '* * * * *',
  'zadanie rhytm-powiadomienia co minutę');
select is((select j.command from cron.job as j where j.jobname = 'rhytm-powiadomienia'), 'select public.dispatch_notifications()',
  'zadanie woła dispatch_notifications');

-- Wywołanie 1: środa 2026-12-02 20:00 w Warszawie
create temp table w1 as select * from public.claim_due_notifications('2026-12-02 19:00:00+00');

select is(
  (select array_agg(w.endpoint order by w.endpoint) from w1 as w where w.tag = 'habit-61000000-0000-0000-0000-000000000001'),
  array['https://fcm.googleapis.com/fcm/send/a1-1', 'https://fcm.googleapis.com/fcm/send/a1-2'],
  'nawyk w oknie → wiersz na każde włączone urządzenie (bez wyłączonego)'
);
select is(
  (select w.kind || '|' || w.title || '|' || w.body || '|' || w.url || '|' || w.p256dh || '|' || w.auth
   from w1 as w where w.tag = 'habit-61000000-0000-0000-0000-000000000001' and w.endpoint like '%a1-1'),
  'habit|rhytm|Pora na: Woda|/nawyki/61000000-0000-0000-0000-000000000001|k1|x1',
  'treść przypomnienia nawyku i klucze urządzenia'
);
select is(
  (select count(*) from w1 as w where w.tag = 'habit-61000000-0000-0000-0000-000000000005'),
  2::bigint,
  '2×/tydz.: odhaczenie z poprzedniego tygodnia się nie liczy, okno 19:50–20:05 trwa'
);
select is(
  (select count(*) from w1 as w where w.tag in (
    'habit-61000000-0000-0000-0000-000000000002', 'habit-61000000-0000-0000-0000-000000000003',
    'habit-61000000-0000-0000-0000-000000000004', 'habit-61000000-0000-0000-0000-000000000006',
    'habit-61000000-0000-0000-0000-000000000007', 'habit-61000000-0000-0000-0000-00000000000c')),
  0::bigint,
  'odhaczony / niezaplanowany dziś / tydzień zaliczony / poza oknem / harmonogram od jutra → nic'
);
select is((select count(*) from w1 as w where w.tag = 'habit-61000000-0000-0000-0000-000000000008'), 0::bigint,
  'habits_enabled = false → nic');
select is((select count(*) from w1 as w where w.tag = 'habit-61000000-0000-0000-0000-000000000009'), 0::bigint,
  'tylko wyłączone urządzenie → nic');
select is((select count(*) from w1 as w where w.tag = 'habit-61000000-0000-0000-0000-00000000000a'), 0::bigint,
  'cicha noc przez północ (19:30–06:00) → nic');
select is(
  (select count(*) from public.push_log as pl where pl.ref = '61000000-0000-0000-0000-00000000000a'),
  0::bigint,
  'cicha noc nie wpisuje do push_log'
);
select is((select count(*) from w1 as w where w.tag = 'habit-61000000-0000-0000-0000-00000000000b'), 0::bigint,
  'konto oznaczone do usunięcia → nic');
select is(
  (select pl.for_date from public.push_log as pl where pl.kind = 'habit' and pl.ref = '61000000-0000-0000-0000-000000000001'),
  '2026-12-02'::date,
  'push_log: nawyk z lokalnym dniem profilu'
);
select is(
  (select count(*) from public.claim_due_notifications('2026-12-02 19:00:00+00')),
  0::bigint,
  'drugie wywołanie w tej samej chwili → nic (idempotencja)'
);
select is(
  (select count(*) from public.claim_due_notifications('2026-12-02 19:03:00+00') as c where c.kind = 'habit'),
  0::bigint,
  'kolejna minuta w oknie → nawyki nie wracają'
);

-- Bloki w wywołaniu 1
select is(
  (select w.kind || '|' || w.title || '|' || w.body || '|' || w.tag || '|' || w.url
   from w1 as w where w.tag like 'block-62000000-0000-0000-0000-000000000001-%'),
  'block|Za 5 min: Siłownia|20:05–21:05|block-62000000-0000-0000-0000-000000000001-2026-12-02|/kalendarz?widok=dzien&data=2026-12-02',
  'blok jednorazowy 5 min przed → wiersz z tytułem, godzinami, tagiem i adresem'
);
select is((select count(*) from w1 as w where w.tag like 'block-62000000-0000-0000-0000-000000000002-%'), 0::bigint,
  'blok 10 min przed → nic');
select is((select count(*) from w1 as w where w.tag like 'block-62000000-0000-0000-0000-000000000003-%'), 0::bigint,
  'wystąpienie odwołane (cancelled) → nic');
select is(
  (select w.title || '|' || w.body from w1 as w where w.tag like 'block-62000000-0000-0000-0000-000000000004-%'),
  'Za 5 min: Przeniesiony|20:05–20:35',
  'wyjątek modified → nowa godzina, tytuł i długość'
);
select is((select count(*) from w1 as w where w.tag like 'block-62000000-0000-0000-0000-000000000005-%'), 1::bigint,
  'seria pn–pt w środę → wiersz');
select is((select count(*) from w1 as w where w.tag like 'block-62000000-0000-0000-0000-000000000007-%'), 0::bigint,
  'blok bez przypomnienia → nic');
select is((select count(*) from w1 as w where w.kind = 'renewal'), 0::bigint,
  'o 20:00 odnowienia nie wychodzą');

-- Wywołanie 2: 2026-12-02 23:58 w Warszawie
create temp table w2 as select * from public.claim_due_notifications('2026-12-02 22:58:00+00');
select is(
  (select w.tag || '|' || w.url from w2 as w where w.kind = 'block'),
  'block-62000000-0000-0000-0000-000000000006-2026-12-03|/kalendarz?widok=dzien&data=2026-12-03',
  'blok jutro o 00:03 przy 23:58 → wiersz z jutrzejszą datą'
);
select is((select count(*) from w2), 1::bigint, 'o 23:58 tylko ten blok');

-- Wywołanie 3: sobota 2026-12-05 20:00 w Warszawie
create temp table w3 as select * from public.claim_due_notifications('2026-12-05 19:00:00+00');
select is((select count(*) from w3 as w where w.tag like 'block-62000000-0000-0000-0000-000000000005-%'), 0::bigint,
  'seria pn–pt w sobotę → nic');
select is(
  (select w.tag from w3 as w where w.tag like 'block-62000000-0000-0000-0000-000000000003-%'),
  'block-62000000-0000-0000-0000-000000000003-2026-12-05',
  'seria codzienna w sobotę → wiersz (wyjątek dotyczył tylko 2.12)'
);

-- Wywołanie 4: sobota 2027-02-27 09:00 w Warszawie (odnowienia dzień przed, o 9:00 — ustawienia domyślne)
create temp table w4 as select * from public.claim_due_notifications('2027-02-27 08:00:00+00');
select is(
  (select w.kind || '|' || w.title || '|' || w.body || '|' || w.tag || '|' || w.url
   from w4 as w where w.tag like 'renewal-66000000-0000-0000-0000-000000000001:%'),
  'renewal|Jutro odnowienie|Netflix · 43,50 zł|renewal-66000000-0000-0000-0000-000000000001:65000000-0000-0000-0000-000000000004|/strony/63000000-0000-0000-0000-000000000001',
  'odnowienie miesięczne z kotwicą 31.01 przypada 28.02 (rok nieprzestępny)'
);
select is(
  (select w.body from w4 as w where w.tag like 'renewal-66000000-0000-0000-0000-000000000002:%'),
  'Domena · 60,00 zł',
  'odnowienie roczne po 12 miesiącach'
);
select is((select count(*) from w4 as w where w.tag like 'renewal-66000000-0000-0000-0000-000000000003:%'), 0::bigint,
  'roczne po 6 miesiącach → nic');
select is((select count(*) from w4 as w where w.tag like 'renewal-66000000-0000-0000-0000-000000000004:%'), 0::bigint,
  'nieaktywny wiersz (checkbox false) → nic');
select is((select count(*) from w4 as w where w.tag like 'renewal-66000000-0000-0000-0000-000000000005:%'), 0::bigint,
  'wiersz w koszu → nic');
select is(
  (select w.body from w4 as w where w.tag like 'renewal-66000000-0000-0000-0000-000000000006:%'),
  'Bez nazwy',
  'wiersz bez nazwy i kwoty → „Bez nazwy”'
);
select is((select count(*) from w4 as w where w.tag like 'renewal-66000000-0000-0000-0000-000000000007:%'), 0::bigint,
  'strona w koszu → nic');
select is(
  (select pl.for_date from public.push_log as pl
   where pl.kind = 'renewal' and pl.ref = '66000000-0000-0000-0000-000000000001:65000000-0000-0000-0000-000000000004'),
  '2027-02-28'::date,
  'push_log: odnowienie z datą odnowienia'
);
select is(
  (select count(*) from public.claim_due_notifications('2027-02-27 08:10:00+00') as c where c.kind = 'renewal'),
  0::bigint,
  'odnowienie nie wraca w tym samym oknie'
);

-- dispatch_notifications bez sekretów w Vault: 0 i bez zmian w push_log (claim nie jest wołany)
create temp table log_przed as select count(*) as n from public.push_log;
select is(public.dispatch_notifications(), 0, 'dispatch bez sekretów zwraca 0');
select is((select count(*) from public.push_log), (select lp.n from log_przed as lp), 'dispatch bez sekretów nie zmienia push_log');

-- remove_push_subscriptions ze złym sekretem (anon, jak trasa crona)
set local role anon;
select throws_ok(
  $$select public.remove_push_subscriptions('zly-sekret', array['https://fcm.googleapis.com/fcm/send/a6'])$$,
  'P0001',
  'unauthorized',
  'zły sekret → unauthorized'
);
reset role;
select is(
  (select count(*) from public.push_subscriptions as ps where ps.endpoint = 'https://fcm.googleapis.com/fcm/send/a6'),
  1::bigint,
  'po odmowie urządzenie zostaje'
);

-- Kaskada: usunięcie konta usuwa jego wpisy w push_log
delete from auth.users as u where u.id = '00000000-0000-0000-0000-0000000006a1';
select is(
  (select count(*) from public.push_log as pl where pl.user_id = '00000000-0000-0000-0000-0000000006a1'),
  0::bigint,
  'usunięcie konta czyści push_log'
);

select * from finish();
rollback;
