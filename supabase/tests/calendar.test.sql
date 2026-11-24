begin;
select plan(44);

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
insert into public.categories (id, user_id, name, color, position)
values ('c0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Kategoria B', '#000000', 0);
-- A: trzy kategorie z lukami w pozycjach (do move_category).
insert into public.categories (id, user_id, name, color, position)
values
  ('c1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A1', '#000000', 5),
  ('c2000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A2', '#000000', 7),
  ('c3000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A3', '#000000', 9);
-- B: blok, wyjątek i zadanie.
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone, recurrence)
values ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Blok B',
  '2026-11-03 08:00', 60, 'Europe/Warsaw', '{"freq":"weekly","byWeekday":[2]}');
insert into public.block_exceptions (block_id, user_id, occurrence_date, kind)
values ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '2026-11-10', 'cancelled');
insert into public.tasks (user_id, title, block_id, occurrence_date, due_date)
values ('00000000-0000-0000-0000-00000000000b', 'Zadanie B', 'b0000000-0000-0000-0000-00000000000b', '2026-11-10', '2026-11-10');

-- A: seria weekly od wt 2026-11-03 08:00, zadania na 10.11 i 17.11;
-- odwołany następny tydzień (24.11) i przesunięte wystąpienie 1.12.
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone, recurrence)
values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Seria A',
  '2026-11-03 08:00', 60, 'Europe/Warsaw', '{"freq":"weekly","byWeekday":[2]}');
insert into public.tasks (id, user_id, title, block_id, occurrence_date)
values
  ('a1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Zadanie 10.11',
    'a0000000-0000-0000-0000-00000000000a', '2026-11-10'),
  ('a2000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Zadanie 17.11',
    'a0000000-0000-0000-0000-00000000000a', '2026-11-17');
insert into public.block_exceptions (block_id, user_id, occurrence_date, kind, new_start_local)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-24', 'cancelled', null),
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-12-01', 'modified',
    '2026-12-02 08:00');

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
  '23502', null, 'zadanie z block_id bez occurrence_date odrzucone (NOT NULL)');

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
  (select t.due_date from public.tasks as t where t.id = 'a2000000-0000-0000-0000-00000000000a'),
  '2026-11-17'::date, 'zmiana godziny ustawia termin zadania na dzień wystąpienia');
select is(
  (select e.block_id from public.block_exceptions as e
   where e.occurrence_date = '2026-11-24' and e.kind = 'cancelled'),
  (select new_id from split_result), 'odwołanie z 24.11 przetrwało zmianę godziny w nowej serii');
select is(
  (select count(*) from public.block_exceptions as e where e.occurrence_date = '2026-12-01'),
  0::bigint, 'przesunięcie z 1.12 skasowane po zmianie godziny');

-- Usunięcie od pierwszego wystąpienia: seria znika razem z zadaniami.
select is(
  public.split_block_series('a0000000-0000-0000-0000-00000000000a', '2026-11-03', null, true),
  null::uuid, 'usunięcie zwraca null');
select is(
  (select count(*) from public.blocks where id = 'a0000000-0000-0000-0000-00000000000a'),
  0::bigint, 'seria usunięta');
select is(
  (select count(*) from public.tasks as t where t.id = 'a1000000-0000-0000-0000-00000000000a'),
  0::bigint, 'zadanie usunięte razem z serią');

-- Zwykły DELETE bloku z zadaniami: zadania są usuwane kaskadowo.
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone, recurrence)
values ('a3000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Do usunięcia',
  '2026-12-01 08:00', 60, 'Europe/Warsaw', '{"freq":"daily"}');
insert into public.tasks (user_id, title, block_id, occurrence_date)
values
  ('00000000-0000-0000-0000-00000000000a', 'Usuw 1', 'a3000000-0000-0000-0000-00000000000a', '2026-12-01'),
  ('00000000-0000-0000-0000-00000000000a', 'Usuw 2', 'a3000000-0000-0000-0000-00000000000a', '2026-12-02');
select lives_ok(
  $$delete from public.blocks where id = 'a3000000-0000-0000-0000-00000000000a'$$,
  'usunięcie bloku z zadaniami się udaje');
select is(
  (select count(*) from public.tasks as t where t.title in ('Usuw 1', 'Usuw 2')),
  0::bigint, 'oba zadania usunięte razem z blokiem');

-- Nowa seria A: wyjątek i zadania; zakres until.
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone, recurrence)
values ('a4000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Seria 4',
  '2026-12-01 08:00', 60, 'Europe/Warsaw', '{"freq":"weekly","byWeekday":[2],"until":"2026-12-31"}');
insert into public.tasks (id, user_id, title, block_id, occurrence_date)
values ('a4100000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'S4 15.12',
  'a4000000-0000-0000-0000-00000000000a', '2026-12-15');
insert into public.block_exceptions (block_id, user_id, occurrence_date, kind)
values ('a4000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-12-15', 'cancelled');

select throws_ok(
  $$select public.split_block_series('a4000000-0000-0000-0000-00000000000a', '2027-01-05', '{"title":"X"}', false)$$,
  '22023', null, 'p_from po until odrzucone (seria nie zostanie wydłużona)');
select throws_ok(
  $$select public.split_block_series('a4000000-0000-0000-0000-00000000000a', '2026-11-30', '{"title":"X"}', false)$$,
  '22023', null, 'p_from przed startem serii odrzucone');

-- Patch tylko z tytułem: wyjątek i zadanie przenoszone do nowej serii.
create temp table split_result2 on commit drop as
select public.split_block_series(
  'a4000000-0000-0000-0000-00000000000a', '2026-12-15', '{"title":"Nowy tytuł"}', false
) as new_id;
grant select on split_result2 to authenticated;

select is(
  (select count(*) from public.block_exceptions as e
   where e.block_id = (select new_id from split_result2) and e.occurrence_date = '2026-12-15'),
  1::bigint, 'wyjątek przeniesiony do nowej serii przy zmianie samego tytułu');
select is(
  (select t.block_id from public.tasks as t where t.id = 'a4100000-0000-0000-0000-00000000000a'),
  (select new_id from split_result2), 'zadanie przeniesione do nowej serii przy zmianie samego tytułu');

-- Zmiana recurrence: zadania z dni nowego wzorca przechodzą do nowej serii, pozostałe znikają; wyjątki jak dotąd.
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone, recurrence)
values ('a5000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Seria 5',
  '2026-12-01 08:00', 60, 'Europe/Warsaw', '{"freq":"weekly","byWeekday":[2]}');
insert into public.tasks (id, user_id, title, block_id, occurrence_date)
values
  ('a5100000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'S5 8.12',
    'a5000000-0000-0000-0000-00000000000a', '2026-12-08'),
  ('a5200000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'S5 19.12',
    'a5000000-0000-0000-0000-00000000000a', '2026-12-19');
-- Odwołania: 15.12 (wt, zostaje w nowym wzorcu pn–pt) i 19.12 (sb, poza nim); przesunięcie 22.12.
insert into public.block_exceptions (block_id, user_id, occurrence_date, kind, new_start_local)
values
  ('a5000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-12-15', 'cancelled', null),
  ('a5000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-12-19', 'cancelled', null),
  ('a5000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-12-22', 'modified',
    '2026-12-22 10:00');
create temp table split_result5 on commit drop as
select public.split_block_series(
  'a5000000-0000-0000-0000-00000000000a', '2026-12-08', '{"recurrence":{"freq":"weekdays"}}', false
) as new_id;
grant select on split_result5 to authenticated;
select is(
  (select (t.block_id = (select new_id from split_result5) and t.due_date = '2026-12-08')::int
   from public.tasks as t where t.id = 'a5100000-0000-0000-0000-00000000000a'),
  1, 'zmiana recurrence przenosi zadanie z dnia nowego wzorca do nowej serii');
select is(
  (select count(*) from public.tasks as t where t.id = 'a5200000-0000-0000-0000-00000000000a'),
  0::bigint, 'zmiana recurrence usuwa zadanie z dnia spoza nowego wzorca');
select is(
  (select e.block_id from public.block_exceptions as e
   where e.occurrence_date = '2026-12-15'
     and e.block_id in ('a5000000-0000-0000-0000-00000000000a', (select new_id from split_result5))),
  (select new_id from split_result5), 'odwołanie w nowym wzorcu przechodzi do nowej serii');
select is(
  (select count(*) from public.block_exceptions as e
   where e.occurrence_date in ('2026-12-19', '2026-12-22')
     and e.block_id in ('a5000000-0000-0000-0000-00000000000a', (select new_id from split_result5))),
  0::bigint, 'zmiana recurrence kasuje odwołania spoza wzorca i przesunięcia');
select throws_ok(
  $$select public.split_block_series('a5000000-0000-0000-0000-00000000000a', '2026-12-01',
    '{"recurrence":{"freq":"weekly","until":"2026-11-30"}}', false)$$,
  '22023', null, 'until przed p_from odrzucone');

-- Cudza kategoria.
select throws_ok(
  $$insert into public.blocks (user_id, title, start_local, duration_min, timezone, category_id)
    values ('00000000-0000-0000-0000-00000000000a', 'Cudza kat.', '2026-12-20 10:00', 30, 'Europe/Warsaw',
      'c0000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'A nie ustawi kategorii B w bloku');

-- Polityka update: blok A nie może wskazywać kategorii B.
select throws_ok(
  $$update public.blocks set category_id = 'c0000000-0000-0000-0000-00000000000b'
    where id = 'a4000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A nie przepnie bloku na kategorię B');

-- move_category: zamiana z sąsiadem i renumeracja 0..n-1.
select ok(not has_function_privilege('anon', 'public.move_category(uuid, int)', 'execute'),
  'anon nie może przesuwać kategorii');
select public.move_category('c2000000-0000-0000-0000-00000000000a', -1);
select is(
  (select string_agg(c.name, ',' order by c.position) from public.categories as c
   where c.id in ('c1000000-0000-0000-0000-00000000000a', 'c2000000-0000-0000-0000-00000000000a', 'c3000000-0000-0000-0000-00000000000a')),
  'A2,A1,A3', 'move_category zamienia z sąsiadem');
select is(
  (select array_agg(c.position order by c.position) from public.categories as c
   where c.user_id = '00000000-0000-0000-0000-00000000000a'),
  array[0, 1, 2], 'move_category numeruje pozycje od 0');
select public.move_category('c2000000-0000-0000-0000-00000000000a', -1);
select is(
  (select c.position from public.categories as c where c.id = 'c2000000-0000-0000-0000-00000000000a'),
  0, 'na brzegu listy nic się nie zmienia');
select throws_ok(
  $$select public.move_category('c0000000-0000-0000-0000-00000000000b', 1)$$,
  'P0002', null, 'cudzej kategorii nie da się przesunąć');

select * from finish();
rollback;
