begin;
select plan(51);

-- Użytkownicy A i B.
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl');

-- Uprawnienia do tabel (bez GRANT-ów RLS nie ma czego przepuścić).
select ok(has_table_privilege('authenticated', 'public.habits', 'select'),
  'authenticated ma select na habits');
select ok(has_table_privilege('authenticated', 'public.habits', 'insert'),
  'authenticated ma insert na habits');
select ok(has_table_privilege('authenticated', 'public.habits', 'update'),
  'authenticated ma update na habits');
select ok(has_table_privilege('authenticated', 'public.habits', 'delete'),
  'authenticated ma delete na habits');
select ok(has_table_privilege('service_role', 'public.habits', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do habits');
select ok(not has_table_privilege('anon', 'public.habits', 'select'),
  'anon nie czyta habits');
select ok(has_table_privilege('authenticated', 'public.habit_schedules', 'select'),
  'authenticated ma select na habit_schedules');
select ok(has_table_privilege('authenticated', 'public.habit_schedules', 'insert'),
  'authenticated ma insert na habit_schedules');
select ok(has_table_privilege('authenticated', 'public.habit_schedules', 'update'),
  'authenticated ma update na habit_schedules');
select ok(has_table_privilege('authenticated', 'public.habit_schedules', 'delete'),
  'authenticated ma delete na habit_schedules');
select ok(has_table_privilege('service_role', 'public.habit_schedules', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do habit_schedules');
select ok(not has_table_privilege('anon', 'public.habit_schedules', 'select'),
  'anon nie czyta habit_schedules');
select ok(has_table_privilege('authenticated', 'public.habit_checks', 'select'),
  'authenticated ma select na habit_checks');
select ok(has_table_privilege('authenticated', 'public.habit_checks', 'insert'),
  'authenticated ma insert na habit_checks');
select ok(has_table_privilege('authenticated', 'public.habit_checks', 'update'),
  'authenticated ma update na habit_checks');
select ok(has_table_privilege('authenticated', 'public.habit_checks', 'delete'),
  'authenticated ma delete na habit_checks');
select ok(has_table_privilege('service_role', 'public.habit_checks', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do habit_checks');
select ok(not has_table_privilege('anon', 'public.habit_checks', 'select'),
  'anon nie czyta habit_checks');
select ok(has_table_privilege('authenticated', 'public.habit_notes', 'select'),
  'authenticated ma select na habit_notes');
select ok(has_table_privilege('authenticated', 'public.habit_notes', 'insert'),
  'authenticated ma insert na habit_notes');
select ok(has_table_privilege('authenticated', 'public.habit_notes', 'update'),
  'authenticated ma update na habit_notes');
select ok(has_table_privilege('authenticated', 'public.habit_notes', 'delete'),
  'authenticated ma delete na habit_notes');
select ok(has_table_privilege('service_role', 'public.habit_notes', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do habit_notes');
select ok(not has_table_privilege('anon', 'public.habit_notes', 'select'),
  'anon nie czyta habit_notes');
select ok(has_table_privilege('authenticated', 'public.sleep_logs', 'select'),
  'authenticated ma select na sleep_logs');
select ok(has_table_privilege('authenticated', 'public.sleep_logs', 'insert'),
  'authenticated ma insert na sleep_logs');
select ok(has_table_privilege('authenticated', 'public.sleep_logs', 'update'),
  'authenticated ma update na sleep_logs');
select ok(has_table_privilege('authenticated', 'public.sleep_logs', 'delete'),
  'authenticated ma delete na sleep_logs');
select ok(has_table_privilege('service_role', 'public.sleep_logs', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do sleep_logs');
select ok(not has_table_privilege('anon', 'public.sleep_logs', 'select'),
  'anon nie czyta sleep_logs');

-- Dane wstawione jako superuser: nawyk A z wersją, odhaczeniem, notatką i snem; nawyk B tak samo.
insert into public.habits (id, user_id, name)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Nawyk A'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Nawyk B');
insert into public.habit_schedules (habit_id, user_id, valid_from, schedule_type)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-01', 'daily'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '2026-11-01', 'daily');
insert into public.habit_checks (habit_id, user_id, date)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-17'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '2026-11-17');
insert into public.habit_notes (habit_id, user_id, date, text)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-17', 'Notatka A'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '2026-11-17', 'Notatka B');
insert into public.sleep_logs (user_id, date, slept_at, woke_at)
values
  ('00000000-0000-0000-0000-00000000000a', '2026-11-17', '23:00', '07:00'),
  ('00000000-0000-0000-0000-00000000000b', '2026-11-17', '23:00', '07:00');

-- Od teraz jako zalogowany B.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is((select count(*) from public.habits where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w habits');
select is((select count(*) from public.habit_schedules where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w habit_schedules');
select is((select count(*) from public.habit_checks where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w habit_checks');
select is((select count(*) from public.habit_notes where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w habit_notes');
select is((select count(*) from public.sleep_logs where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w sleep_logs');

-- B próbuje zmienić i usunąć wiersze A (RLS po cichu je pomija).
update public.habits set user_id = '00000000-0000-0000-0000-00000000000b' where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.habits where user_id = '00000000-0000-0000-0000-00000000000a';
update public.habit_schedules set user_id = '00000000-0000-0000-0000-00000000000b' where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.habit_schedules where user_id = '00000000-0000-0000-0000-00000000000a';
update public.habit_checks set user_id = '00000000-0000-0000-0000-00000000000b' where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.habit_checks where user_id = '00000000-0000-0000-0000-00000000000a';
update public.habit_notes set user_id = '00000000-0000-0000-0000-00000000000b' where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.habit_notes where user_id = '00000000-0000-0000-0000-00000000000a';
update public.sleep_logs set user_id = '00000000-0000-0000-0000-00000000000b' where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.sleep_logs where user_id = '00000000-0000-0000-0000-00000000000a';

-- B nie wstawi wierszy podpiętych pod nawyk A.
select throws_ok(
  $$insert into public.habit_checks (habit_id, user_id, date)
    values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '2026-11-18')$$,
  '42501', null, 'B nie wstawi odhaczenia do nawyku A');
select throws_ok(
  $$insert into public.habit_schedules (habit_id, user_id, valid_from, schedule_type)
    values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '2026-11-18', 'daily')$$,
  '42501', null, 'B nie wstawi wersji harmonogramu do nawyku A');
select throws_ok(
  $$insert into public.habit_notes (habit_id, user_id, date, text)
    values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '2026-11-18', 'Wstrzyknięta')$$,
  '42501', null, 'B nie wstawi notatki do nawyku A');

-- Od teraz jako zalogowany A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- Wiersze A przetrwały próby B.
select is((select count(*) from public.habits where user_id = '00000000-0000-0000-0000-00000000000a'),
  1::bigint, 'wiersz A w habits nietknięty przez B');
select is((select count(*) from public.habit_schedules where user_id = '00000000-0000-0000-0000-00000000000a'),
  1::bigint, 'wiersz A w habit_schedules nietknięty przez B');
select is((select count(*) from public.habit_checks where user_id = '00000000-0000-0000-0000-00000000000a'),
  1::bigint, 'wiersz A w habit_checks nietknięty przez B');
select is((select count(*) from public.habit_notes where user_id = '00000000-0000-0000-0000-00000000000a'),
  1::bigint, 'wiersz A w habit_notes nietknięty przez B');
select is((select count(*) from public.sleep_logs where user_id = '00000000-0000-0000-0000-00000000000a'),
  1::bigint, 'wiersz A w sleep_logs nietknięty przez B');

select is((select count(*) from public.habits), 1::bigint, 'A widzi tylko swój nawyk');

-- Ograniczenia CHECK i klucze.
select throws_ok(
  $$insert into public.sleep_logs (user_id, date, slept_at, woke_at)
    values ('00000000-0000-0000-0000-00000000000a', '2026-11-17', '22:00', '06:00')$$,
  '23505', null, 'drugi wpis snu z tą samą datą łamie klucz');
select throws_ok(
  $$insert into public.sleep_logs (user_id, date, slept_at, woke_at)
    values ('00000000-0000-0000-0000-00000000000a', '2026-11-18', '22:00', '22:00')$$,
  '23514', null, 'woke_at = slept_at odrzucone');
select throws_ok(
  $$insert into public.habit_schedules (habit_id, user_id, valid_from, schedule_type, weekdays)
    values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-18', 'weekdays', '{}')$$,
  '23514', null, 'weekdays z pustą listą dni odrzucone');
select throws_ok(
  $$insert into public.habit_schedules (habit_id, user_id, valid_from, schedule_type, times_per_week)
    values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-19', 'times_per_week', 8)$$,
  '23514', null, 'times_per_week = 8 odrzucone');

-- Usunięcie nawyku usuwa jego wersje, odhaczenia i notatki.
delete from public.habits where id = 'a0000000-0000-0000-0000-00000000000a';
select is((select count(*) from public.habit_schedules where habit_id = 'a0000000-0000-0000-0000-00000000000a'),
  0::bigint, 'usunięcie nawyku usuwa wersje harmonogramu');
select is((select count(*) from public.habit_checks where habit_id = 'a0000000-0000-0000-0000-00000000000a'),
  0::bigint, 'usunięcie nawyku usuwa odhaczenia');
select is((select count(*) from public.habit_notes where habit_id = 'a0000000-0000-0000-0000-00000000000a'),
  0::bigint, 'usunięcie nawyku usuwa notatki');

select * from finish();
rollback;
