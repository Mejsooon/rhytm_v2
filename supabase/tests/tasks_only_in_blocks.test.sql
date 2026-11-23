begin;
select plan(20);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl');

-- Schemat: kolumny NOT NULL, stary wyzwalacz i constraint zniknęły.
select col_not_null('public', 'tasks', 'block_id', 'tasks.block_id jest NOT NULL');
select col_not_null('public', 'tasks', 'occurrence_date', 'tasks.occurrence_date jest NOT NULL');
select hasnt_trigger('public', 'blocks', 'blocks_detach_tasks_before_delete', 'wyzwalacz odpinania zniknął');
select hasnt_function('public', 'detach_tasks_before_block_delete', 'funkcja odpinania zniknęła');
select is(
  (select count(*) from pg_constraint
   where conname = 'tasks_block_occurrence_check' and conrelid = 'public.tasks'::regclass),
  0::bigint, 'constraint tasks_block_occurrence_check zniknął');

-- B: blok z zadaniem (do testu RLS).
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone, recurrence)
values ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Blok B',
  '2026-11-03 08:00', 60, 'Europe/Warsaw', '{"freq":"weekly","byWeekday":[2]}');

-- A: blok dzienny do usunięcia (kaskada), seria do usuwania od p_from, seria do zmiany wzorca.
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone, recurrence)
values
  ('a1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Do usunięcia',
    '2026-12-01 08:00', 60, 'Europe/Warsaw', '{"freq":"daily"}'),
  ('a2000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Seria usuwana',
    '2026-12-01 08:00', 60, 'Europe/Warsaw', '{"freq":"daily"}'),
  ('a3000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Seria zmieniana',
    '2026-12-01 08:00', 60, 'Europe/Warsaw', '{"freq":"daily"}'),
  ('a4000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Seria do jednego dnia',
    '2026-12-01 08:00', 60, 'Europe/Warsaw', '{"freq":"daily"}'),
  ('a5000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Seria na wybrane dni',
    '2026-12-01 08:00', 60, 'Europe/Warsaw', '{"freq":"daily"}');

insert into public.tasks (user_id, title, block_id, occurrence_date, due_date)
values
  ('00000000-0000-0000-0000-00000000000a', 'K1', 'a1000000-0000-0000-0000-00000000000a', '2026-12-01', '2026-12-01'),
  ('00000000-0000-0000-0000-00000000000a', 'K2', 'a1000000-0000-0000-0000-00000000000a', '2026-12-02', '2026-12-02'),
  ('00000000-0000-0000-0000-00000000000a', 'U1', 'a2000000-0000-0000-0000-00000000000a', '2026-12-02', '2026-12-02'),
  ('00000000-0000-0000-0000-00000000000a', 'U2', 'a2000000-0000-0000-0000-00000000000a', '2026-12-09', '2026-12-09'),
  ('00000000-0000-0000-0000-00000000000a', 'U3', 'a2000000-0000-0000-0000-00000000000a', '2026-12-10', '2026-12-10'),
  -- Z: wzorzec zmieniony na pn–pt; wt 8.12 należy do wzorca (due_date przesunięte), sb 12.12 nie.
  ('00000000-0000-0000-0000-00000000000a', 'Z1', 'a3000000-0000-0000-0000-00000000000a', '2026-12-02', '2026-12-02'),
  ('00000000-0000-0000-0000-00000000000a', 'Z2', 'a3000000-0000-0000-0000-00000000000a', '2026-12-08', '2026-12-09'),
  ('00000000-0000-0000-0000-00000000000a', 'Z3', 'a3000000-0000-0000-0000-00000000000a', '2026-12-12', '2026-12-12'),
  ('00000000-0000-0000-0000-00000000000a', 'Z4', 'a3000000-0000-0000-0000-00000000000a', '2026-12-14', '2026-12-14'),
  -- J: wzorzec zmieniony na pojedynczy blok w dniu p_from (8.12).
  ('00000000-0000-0000-0000-00000000000a', 'J1', 'a4000000-0000-0000-0000-00000000000a', '2026-12-08', '2026-12-08'),
  ('00000000-0000-0000-0000-00000000000a', 'J2', 'a4000000-0000-0000-0000-00000000000a', '2026-12-09', '2026-12-09'),
  -- C: wzorzec custom pn + śr do 23.12; śr 9.12 należy do wzorca, czw 10.12 nie, pn 28.12 jest po until.
  ('00000000-0000-0000-0000-00000000000a', 'C1', 'a5000000-0000-0000-0000-00000000000a', '2026-12-09', '2026-12-09'),
  ('00000000-0000-0000-0000-00000000000a', 'C2', 'a5000000-0000-0000-0000-00000000000a', '2026-12-10', '2026-12-10'),
  ('00000000-0000-0000-0000-00000000000a', 'C3', 'a5000000-0000-0000-0000-00000000000a', '2026-12-28', '2026-12-28');

-- Zadanie bez bloku (jako superuser, żeby RLS nie wyprzedził błędu NOT NULL).
select throws_ok(
  $$insert into public.tasks (user_id, title)
    values ('00000000-0000-0000-0000-00000000000a', 'Luźne')$$,
  '23502', null, 'zadanie bez bloku odrzucone');

-- Usunięcie bloku usuwa jego zadania.
delete from public.blocks where id = 'a1000000-0000-0000-0000-00000000000a';
select is(
  (select count(*) from public.tasks as t where t.title in ('K1', 'K2')),
  0::bigint, 'usunięcie bloku usuwa jego zadania');

-- Od teraz jako zalogowany A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- RLS: cudzy blok.
select throws_ok(
  $$insert into public.tasks (user_id, title, block_id, occurrence_date)
    values ('00000000-0000-0000-0000-00000000000a', 'Wstrzyknięte', 'b0000000-0000-0000-0000-00000000000b', '2026-11-17')$$,
  '42501', null, 'A nie wstawi zadania do bloku B');

-- Usuwanie serii od 9.12: wcześniejsze zadania zostają, późniejsze znikają.
select is(
  public.split_block_series('a2000000-0000-0000-0000-00000000000a', '2026-12-09', null, true),
  null::uuid, 'usuwanie od p_from zwraca null');
select is(
  (select array_agg(t.title order by t.title) from public.tasks as t
   where t.block_id = 'a2000000-0000-0000-0000-00000000000a'),
  array['U1'], 'zadania od p_from usunięte, wcześniejsze zostają przy starej serii');
select is(
  (select count(*) from public.tasks as t where t.title in ('U2', 'U3')),
  0::bigint, 'zadania od p_from nie stały się samodzielne');

-- Zmiana wzorca na pn–pt od 8.12.
create temp table split_z on commit drop as
select public.split_block_series(
  'a3000000-0000-0000-0000-00000000000a', '2026-12-08', '{"recurrence":{"freq":"weekdays"}}', false
) as new_id;
grant select on split_z to authenticated;

select is(
  (select t.block_id from public.tasks as t where t.title = 'Z1'),
  'a3000000-0000-0000-0000-00000000000a'::uuid, 'zadanie sprzed p_from zostaje przy starej serii');
select is(
  (select (t.block_id = (select new_id from split_z) and t.due_date = '2026-12-08')::int
   from public.tasks as t where t.title = 'Z2'),
  1, 'zadanie z dnia należącego do wzorca przechodzi do nowej serii (due_date = dzień wystąpienia)');
select is(
  (select count(*) from public.tasks as t where t.title = 'Z3'),
  0::bigint, 'zadanie z dnia spoza nowego wzorca (sobota) usunięte');
select is(
  (select t.block_id from public.tasks as t where t.title = 'Z4'),
  (select new_id from split_z), 'zadanie z poniedziałku przechodzi do nowej serii');

-- Zmiana wzorca na pojedynczy blok (recurrence = null): zostaje tylko zadanie z p_from.
create temp table split_j on commit drop as
select public.split_block_series(
  'a4000000-0000-0000-0000-00000000000a', '2026-12-08', '{"recurrence":null}', false
) as new_id;
grant select on split_j to authenticated;
select is(
  (select t.block_id from public.tasks as t where t.title = 'J1'),
  (select new_id from split_j), 'zadanie z p_from przechodzi do pojedynczego bloku');
select is(
  (select count(*) from public.tasks as t where t.title = 'J2'),
  0::bigint, 'pozostałe zadania usunięte przy zmianie na pojedynczy blok');

-- Zmiana wzorca na custom (pn + śr, do 23.12) od 8.12.
create temp table split_c on commit drop as
select public.split_block_series(
  'a5000000-0000-0000-0000-00000000000a', '2026-12-08',
  '{"recurrence":{"freq":"custom","byWeekday":[1,3],"until":"2026-12-23"}}', false
) as new_id;
grant select on split_c to authenticated;
select is(
  (select (t.block_id = (select new_id from split_c) and t.due_date = '2026-12-09')::int
   from public.tasks as t where t.title = 'C1'),
  1, 'custom: zadanie z dnia ze wzorca (środa) przechodzi do nowej serii');
select is(
  (select count(*) from public.tasks as t where t.title = 'C2'),
  0::bigint, 'custom: zadanie z dnia poza wzorcem (czwartek) usunięte');
select is(
  (select count(*) from public.tasks as t where t.title = 'C3'),
  0::bigint, 'custom: zadanie po until usunięte');

select * from finish();
rollback;
