begin;
select plan(8);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl');

insert into public.blocks (id, user_id, title, start_local, duration_min, timezone)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Blok A',
    '2026-12-01 08:00', 60, 'Europe/Warsaw'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Blok B',
    '2026-12-01 08:00', 60, 'Europe/Warsaw');

insert into public.tasks (user_id, title, block_id, occurrence_date)
values
  ('00000000-0000-0000-0000-00000000000a', 'Zadanie A', 'a0000000-0000-0000-0000-00000000000a', '2026-12-01'),
  ('00000000-0000-0000-0000-00000000000b', 'Zadanie B', 'b0000000-0000-0000-0000-00000000000b', '2026-12-01');

-- Zestaw polityk bez zmian.
select policies_are(
  'public', 'tasks',
  array['tasks_select_own', 'tasks_insert_own', 'tasks_update_own', 'tasks_delete_own'],
  'tasks ma cztery polityki o tych samych nazwach');

-- Martwa gałąź zniknęła z obu polityk.
select is(
  (select p.with_check ilike '%block_id IS NULL%' from pg_policies as p
   where p.schemaname = 'public' and p.tablename = 'tasks' and p.policyname = 'tasks_insert_own'),
  false, 'tasks_insert_own bez gałęzi block_id IS NULL');
select is(
  (select p.with_check ilike '%block_id IS NULL%' from pg_policies as p
   where p.schemaname = 'public' and p.tablename = 'tasks' and p.policyname = 'tasks_update_own'),
  false, 'tasks_update_own bez gałęzi block_id IS NULL');

-- Od teraz jako zalogowany A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.tasks (user_id, title, block_id, occurrence_date)
    values ('00000000-0000-0000-0000-00000000000a', 'Nowe A', 'a0000000-0000-0000-0000-00000000000a', '2026-12-02')$$,
  'A wstawia zadanie do własnego bloku');

select throws_ok(
  $$insert into public.tasks (user_id, title, block_id, occurrence_date)
    values ('00000000-0000-0000-0000-00000000000a', 'Wstrzyknięte', 'b0000000-0000-0000-0000-00000000000b', '2026-12-02')$$,
  '42501', null, 'A nie wstawi zadania do bloku B');

select throws_ok(
  $$update public.tasks set block_id = 'b0000000-0000-0000-0000-00000000000b' where title = 'Zadanie A'$$,
  '42501', null, 'A nie przepnie swojego zadania na blok B');

select lives_ok(
  $$update public.tasks set title = 'Zadanie A po zmianie' where title = 'Zadanie A'$$,
  'A zmienia tytuł swojego zadania w swoim bloku');

select is(
  (select count(*) from public.tasks as t where t.title = 'Zadanie B'),
  0::bigint, 'A nie widzi zadań B');

select * from finish();
rollback;
