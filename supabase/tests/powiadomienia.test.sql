begin;
select plan(9);

-- Centrum powiadomień: wpis na listę powstaje także bez urządzeń i w cichej nocy; push bez zmian.
-- A bez urządzeń, B z urządzeniem i cichą nocą 19:30–06:00.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000007a1', 'a71@test.pl', '{"display_name":"A"}'),
       ('00000000-0000-0000-0000-0000000007b1', 'b71@test.pl', '{"display_name":"B"}');
update public.profiles as p set timezone = 'Europe/Warsaw'
where p.user_id in ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-0000000007b1');
insert into public.notification_settings (user_id, habits_enabled, quiet_enabled, quiet_from, quiet_to)
values ('00000000-0000-0000-0000-0000000007a1', true, false, '23:00', '07:00'),
       ('00000000-0000-0000-0000-0000000007b1', true, true, '19:30', '06:00')
on conflict (user_id) do update
  set habits_enabled = excluded.habits_enabled, quiet_enabled = excluded.quiet_enabled,
      quiet_from = excluded.quiet_from, quiet_to = excluded.quiet_to;
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, label, enabled)
values ('00000000-0000-0000-0000-0000000007b1', 'https://fcm.googleapis.com/fcm/send/b71', 'k', 'x', 'Chrome', true);
insert into public.habits (id, user_id, name, remind_at)
values ('71000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a1', 'Woda', '20:00'),
       ('71000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000007b1', 'Czytanie', '20:00');
insert into public.habit_schedules (habit_id, user_id, valid_from, schedule_type, weekdays, times_per_week)
select h.id, h.user_id, '2026-11-01', 'daily', '{}', null from public.habits as h where h.id::text like '71000000-%';

-- Środa 2026-12-02 20:00 w Warszawie, potem ta sama chwila jeszcze raz
create temp table w as select * from public.claim_due_notifications('2026-12-02 19:00:00+00');
create temp table w2 as select * from public.claim_due_notifications('2026-12-02 19:01:00+00');

select is((select count(*) from w), 0::bigint, 'bez urządzenia i w cichej nocy push nie wychodzi');
select results_eq(
  $$select n.title, n.body, n.url from public.notifications as n where n.user_id = '00000000-0000-0000-0000-0000000007a1'$$,
  $$values ('Pora na: Woda', 'Przypomnienie nawyku', '/nawyki/71000000-0000-0000-0000-00000000000a')$$,
  'bez urządzeń: jeden wpis na liście, bez duplikatu przy drugim wywołaniu'
);
select is((select count(*) from public.notifications as n where n.user_id = '00000000-0000-0000-0000-0000000007b1'),
  1::bigint, 'cicha noc: wpis na liście jest');
select is((select count(*) from public.push_log as pl where pl.ref like '71000000-%'), 0::bigint,
  'nic nie trafia do push_log');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', true);

select is((select count(*) from public.notifications), 1::bigint, 'A widzi tylko swoje');
select lives_ok($$update public.notifications set read_at = now()$$, 'A oznacza jako przeczytane');
select throws_ok($$update public.notifications set title = 'x'$$, '42501', null, 'treści nie da się zmienić');
select throws_ok(
  $$insert into public.notifications (user_id, kind, ref, for_date, title, body, url)
    values ('00000000-0000-0000-0000-0000000007a1', 'habit', 'x', '2026-12-02', 't', 'b', '/')$$,
  '42501', null, 'klient nie dodaje wpisów'
);

reset role;
select is((select count(*) from public.notifications as n
  where n.user_id = '00000000-0000-0000-0000-0000000007b1' and n.read_at is not null), 0::bigint,
  'oznaczenie A nie rusza wpisów B');

select * from finish();
rollback;
