begin;
select plan(24);

-- Użytkownicy A i B.
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl');

-- Uprawnienia do tabel i funkcji.
select ok(has_table_privilege('authenticated', 'public.blocks', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated zarządza blokami');
select ok(has_table_privilege('authenticated', 'public.block_exceptions', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated zarządza wyjątkami');
select ok(has_table_privilege('authenticated', 'public.tasks', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated zarządza zadaniami');
select ok(has_table_privilege('service_role', 'public.tasks', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do zadań');
select ok(not has_function_privilege('anon', 'public.split_block_series(uuid, date, jsonb, boolean)', 'execute'),
  'anon nie może rozcinać serii');
select ok(has_function_privilege('authenticated', 'public.split_block_series(uuid, date, jsonb, boolean)', 'execute'),
  'authenticated może rozcinać serie');

-- Dane wstawione jako superuser.
-- B: blok, wyjątek i zadanie.
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone, recurrence)
values ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Blok B',
  '2026-11-03 08:00', 60, 'Europe/Warsaw', '{"freq":"weekly","days":[2]}');
insert into public.block_exceptions (block_id, user_id, occurrence_date, kind)
values ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '2026-11-10', 'cancelled');
insert into public.tasks (user_id, title, due_date)
values ('00000000-0000-0000-0000-00000000000b', 'Zadanie B', '2026-11-10');

-- A: seria weekly od wt 2026-11-03 08:00, zadania na 10.11 i 17.11, wyjątek 17.11.
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone, recurrence)
values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Seria A',
  '2026-11-03 08:00', 60, 'Europe/Warsaw', '{"freq":"weekly","days":[2]}');
insert into public.tasks (id, user_id, title, block_id, occurrence_date)
values
  ('a1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Zadanie 10.11',
    'a0000000-0000-0000-0000-00000000000a', '2026-11-10'),
  ('a2000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Zadanie 17.11',
    'a0000000-0000-0000-0000-00000000000a', '2026-11-17');
insert into public.block_exceptions (block_id, user_id, occurrence_date, kind)
values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-17', 'cancelled');

-- Od teraz jako zalogowany A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*) from public.blocks where user_id = '00000000-0000-0000-0000-00000000000b'),
  0::bigint, 'A nie widzi bloków B');
select is((select count(*) from public.block_exceptions where user_id = '00000000-0000-0000-0000-00000000000b'),
  0::bigint, 'A nie widzi wyjątków B');
select is((select count(*) from public.tasks where user_id = '00000000-0000-0000-0000-00000000000b'),
  0::bigint, 'A nie widzi zadań B');

select throws_ok(
  $$insert into public.tasks (user_id, title, block_id, occurrence_date)
    values ('00000000-0000-0000-0000-00000000000a', 'Wstrzyknięte', 'b0000000-0000-0000-0000-00000000000b', '2026-11-17')$$,
  '42501', null, 'A nie wstawi zadania z blokiem B');
select throws_ok(
  $$insert into public.block_exceptions (block_id, user_id, occurrence_date, kind)
    values ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', '2026-11-17', 'cancelled')$$,
  '42501', null, 'A nie wstawi wyjątku do bloku B');

-- Ograniczenia CHECK.
select throws_ok(
  $$insert into public.blocks (user_id, title, start_local, duration_min, timezone)
    values ('00000000-0000-0000-0000-00000000000a', 'Za krótki', '2026-11-20 10:00', 10, 'Europe/Warsaw')$$,
  '23514', null, 'duration_min = 10 odrzucone');
select throws_ok(
  $$insert into public.blocks (user_id, title, start_local, duration_min, timezone)
    values ('00000000-0000-0000-0000-00000000000a', 'Przez północ', '2026-11-20 23:30', 60, 'Europe/Warsaw')$$,
  '23514', null, 'blok przez północ odrzucony');
select lives_ok(
  $$insert into public.blocks (user_id, title, start_local, duration_min, timezone)
    values ('00000000-0000-0000-0000-00000000000a', 'Do północy', '2026-11-20 23:00', 60, 'Europe/Warsaw')$$,
  'blok kończący się równo o 24:00 dozwolony');
select throws_ok(
  $$insert into public.tasks (user_id, title, block_id)
    values ('00000000-0000-0000-0000-00000000000a', 'Bez daty', 'a0000000-0000-0000-0000-00000000000a')$$,
  '23514', null, 'zadanie z block_id bez occurrence_date odrzucone');

-- Cudzy blok: rozcięcie kończy się błędem.
select throws_ok(
  $$select public.split_block_series('b0000000-0000-0000-0000-00000000000b', '2026-11-17', '{"start_time":"09:00"}', false)$$,
  'P0002', null, 'A nie rozetnie serii B');

-- Rozcięcie serii A od 17.11 ze zmianą godziny.
create temp table split_result on commit drop as
select public.split_block_series(
  'a0000000-0000-0000-0000-00000000000a', '2026-11-17', '{"start_time":"09:00"}', false
) as new_id;
grant select on split_result to authenticated;

select is(
  (select recurrence ->> 'until' from public.blocks where id = 'a0000000-0000-0000-0000-00000000000a'),
  '2026-11-16', 'stara seria kończy się 16.11');
select is(
  (select b.start_local from public.blocks as b where b.id = (select new_id from split_result)),
  '2026-11-17 09:00:00'::timestamp, 'nowa seria startuje 17.11 o 9:00');
select is(
  (select t.block_id from public.tasks as t where t.id = 'a2000000-0000-0000-0000-00000000000a'),
  (select new_id from split_result), 'zadanie z 17.11 w nowej serii');
select is(
  (select t.block_id from public.tasks as t where t.id = 'a1000000-0000-0000-0000-00000000000a'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'zadanie z 10.11 zostaje przy starej serii');
select is(
  (select count(*) from public.block_exceptions as e where e.occurrence_date = '2026-11-17'),
  0::bigint, 'wyjątek z 17.11 skasowany po zmianie godziny');

-- Usunięcie od pierwszego wystąpienia: seria znika, zadania stają się samodzielne.
select is(
  public.split_block_series('a0000000-0000-0000-0000-00000000000a', '2026-11-03', null, true),
  null::uuid, 'usunięcie zwraca null');
select is(
  (select count(*) from public.blocks where id = 'a0000000-0000-0000-0000-00000000000a'),
  0::bigint, 'seria usunięta');
select is(
  (select (t.block_id is null and t.occurrence_date is null and t.due_date = '2026-11-10')::int
   from public.tasks as t where t.id = 'a1000000-0000-0000-0000-00000000000a'),
  1, 'zadanie samodzielne z due_date = data wystąpienia');

select * from finish();
rollback;
