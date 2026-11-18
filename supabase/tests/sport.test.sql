begin;
select plan(82);

-- Użytkownicy A i B.
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl');

-- Uprawnienia do tabel (bez GRANT-ów RLS nie ma czego przepuścić).
select ok(has_table_privilege('authenticated', 'public.sport_sessions', 'select'),
  'authenticated ma select na sport_sessions');
select ok(has_table_privilege('authenticated', 'public.sport_sessions', 'insert'),
  'authenticated ma insert na sport_sessions');
select ok(has_table_privilege('authenticated', 'public.sport_sessions', 'update'),
  'authenticated ma update na sport_sessions');
select ok(has_table_privilege('authenticated', 'public.sport_sessions', 'delete'),
  'authenticated ma delete na sport_sessions');
select ok(has_table_privilege('service_role', 'public.sport_sessions', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do sport_sessions');
select ok(not has_table_privilege('anon', 'public.sport_sessions', 'select'),
  'anon nie czyta sport_sessions');
select ok(has_table_privilege('authenticated', 'public.runs', 'select'),
  'authenticated ma select na runs');
select ok(has_table_privilege('authenticated', 'public.runs', 'insert'),
  'authenticated ma insert na runs');
select ok(has_table_privilege('authenticated', 'public.runs', 'update'),
  'authenticated ma update na runs');
select ok(has_table_privilege('authenticated', 'public.runs', 'delete'),
  'authenticated ma delete na runs');
select ok(has_table_privilege('service_role', 'public.runs', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do runs');
select ok(not has_table_privilege('anon', 'public.runs', 'select'),
  'anon nie czyta runs');
select ok(has_table_privilege('authenticated', 'public.exercises', 'select'),
  'authenticated ma select na exercises');
select ok(has_table_privilege('authenticated', 'public.exercises', 'insert'),
  'authenticated ma insert na exercises');
select ok(has_table_privilege('authenticated', 'public.exercises', 'update'),
  'authenticated ma update na exercises');
select ok(has_table_privilege('authenticated', 'public.exercises', 'delete'),
  'authenticated ma delete na exercises');
select ok(has_table_privilege('service_role', 'public.exercises', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do exercises');
select ok(not has_table_privilege('anon', 'public.exercises', 'select'),
  'anon nie czyta exercises');
select ok(has_table_privilege('authenticated', 'public.gym_sets', 'select'),
  'authenticated ma select na gym_sets');
select ok(has_table_privilege('authenticated', 'public.gym_sets', 'insert'),
  'authenticated ma insert na gym_sets');
select ok(has_table_privilege('authenticated', 'public.gym_sets', 'update'),
  'authenticated ma update na gym_sets');
select ok(has_table_privilege('authenticated', 'public.gym_sets', 'delete'),
  'authenticated ma delete na gym_sets');
select ok(has_table_privilege('service_role', 'public.gym_sets', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do gym_sets');
select ok(not has_table_privilege('anon', 'public.gym_sets', 'select'),
  'anon nie czyta gym_sets');
select ok(has_table_privilege('authenticated', 'public.workout_templates', 'select'),
  'authenticated ma select na workout_templates');
select ok(has_table_privilege('authenticated', 'public.workout_templates', 'insert'),
  'authenticated ma insert na workout_templates');
select ok(has_table_privilege('authenticated', 'public.workout_templates', 'update'),
  'authenticated ma update na workout_templates');
select ok(has_table_privilege('authenticated', 'public.workout_templates', 'delete'),
  'authenticated ma delete na workout_templates');
select ok(has_table_privilege('service_role', 'public.workout_templates', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do workout_templates');
select ok(not has_table_privilege('anon', 'public.workout_templates', 'select'),
  'anon nie czyta workout_templates');
select ok(has_table_privilege('authenticated', 'public.workout_template_items', 'select'),
  'authenticated ma select na workout_template_items');
select ok(has_table_privilege('authenticated', 'public.workout_template_items', 'insert'),
  'authenticated ma insert na workout_template_items');
select ok(has_table_privilege('authenticated', 'public.workout_template_items', 'update'),
  'authenticated ma update na workout_template_items');
select ok(has_table_privilege('authenticated', 'public.workout_template_items', 'delete'),
  'authenticated ma delete na workout_template_items');
select ok(has_table_privilege('service_role', 'public.workout_template_items', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do workout_template_items');
select ok(not has_table_privilege('anon', 'public.workout_template_items', 'select'),
  'anon nie czyta workout_template_items');
select ok(has_table_privilege('authenticated', 'public.template_skips', 'select'),
  'authenticated ma select na template_skips');
select ok(has_table_privilege('authenticated', 'public.template_skips', 'insert'),
  'authenticated ma insert na template_skips');
select ok(has_table_privilege('authenticated', 'public.template_skips', 'update'),
  'authenticated ma update na template_skips');
select ok(has_table_privilege('authenticated', 'public.template_skips', 'delete'),
  'authenticated ma delete na template_skips');
select ok(has_table_privilege('service_role', 'public.template_skips', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do template_skips');
select ok(not has_table_privilege('anon', 'public.template_skips', 'select'),
  'anon nie czyta template_skips');

-- Indeksy
select has_index('public', 'sport_sessions', 'sport_sessions_user_id_start_local_idx', array['user_id', 'start_local'],
  'sport_sessions ma indeks po (user_id, start_local)');
select has_index('public', 'gym_sets', 'gym_sets_session_id_idx', array['session_id'],
  'gym_sets ma indeks po session_id');
select has_index('public', 'gym_sets', 'gym_sets_user_id_exercise_id_idx', array['user_id', 'exercise_id'],
  'gym_sets ma indeks po (user_id, exercise_id)');
select has_index('public', 'workout_template_items', 'workout_template_items_template_id_position_idx', array['template_id', '"position"'],
  'workout_template_items ma indeks po (template_id, position)');

-- profiles nie ma już kolumny weekly_goal_type.
select hasnt_column('public', 'profiles', 'weekly_goal_type', 'profiles bez weekly_goal_type');

-- Dane wstawione jako superuser: szablon, sesje (siłownia z serią, bieg), ćwiczenie, pozycja i pominięcie dla A; ćwiczenie i szablon dla B.
insert into public.workout_templates (id, user_id, name)
values
  ('c0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Push A'),
  ('c0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Push B');
insert into public.exercises (id, user_id, name)
values
  ('e0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Przysiad'),
  ('e0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Przysiad');
insert into public.sport_sessions (id, user_id, type, title, start_local, template_id, template_date)
values
  ('a1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'gym', 'Siłownia A', '2026-11-19 17:00', 'c0000000-0000-0000-0000-00000000000a', '2026-11-19'),
  ('a2000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'run', 'Bieg A', '2026-11-20 07:00', null, null),
  ('b1000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'run', 'Bieg B', '2026-11-19 07:00', null, null);
insert into public.runs (session_id, user_id)
values
  ('a2000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a'),
  ('b1000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');
insert into public.gym_sets (id, user_id, session_id, exercise_id, exercise_position, set_no, weight_kg, reps)
values
  ('d0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000a', 1, 1, 80, 5);
insert into public.workout_template_items (id, user_id, template_id, exercise_id, position, sets_count)
values
  ('f0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000a', 1, 3);
insert into public.template_skips (template_id, user_id, date)
values
  ('c0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-26'),
  ('c0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '2026-11-26');

-- Od teraz jako zalogowany B.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is((select count(*) from public.sport_sessions where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w sport_sessions');
select is((select count(*) from public.runs where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w runs');
select is((select count(*) from public.exercises where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w exercises');
select is((select count(*) from public.gym_sets where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w gym_sets');
select is((select count(*) from public.workout_templates where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w workout_templates');
select is((select count(*) from public.workout_template_items where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w workout_template_items');
select is((select count(*) from public.template_skips where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'B nie widzi wierszy A w template_skips');

-- B próbuje zmienić i usunąć wiersze A (RLS po cichu je pomija).
update public.sport_sessions set title = 'Przejęta' where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.sport_sessions where user_id = '00000000-0000-0000-0000-00000000000a';
update public.runs set distance_km = 99 where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.runs where user_id = '00000000-0000-0000-0000-00000000000a';
update public.exercises set name = 'Przejęte' where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.exercises where user_id = '00000000-0000-0000-0000-00000000000a';
update public.gym_sets set reps = 99 where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.gym_sets where user_id = '00000000-0000-0000-0000-00000000000a';
update public.workout_templates set name = 'Przejęty' where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.workout_templates where user_id = '00000000-0000-0000-0000-00000000000a';
update public.workout_template_items set sets_count = 9 where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.workout_template_items where user_id = '00000000-0000-0000-0000-00000000000a';
update public.template_skips set date = '2026-01-01' where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.template_skips where user_id = '00000000-0000-0000-0000-00000000000a';

-- B nie przepisze własnych wierszy na A ani nie podepnie ich pod rodziców A (with check w UPDATE).
select throws_ok(
  $$update public.sport_sessions set user_id = '00000000-0000-0000-0000-00000000000a' where id = 'b1000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'B nie przepisze własnej sesji na A');
select throws_ok(
  $$update public.runs set session_id = 'a1000000-0000-0000-0000-00000000000a' where session_id = 'b1000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'B nie przeniesie biegu pod sesję A');

-- B nie wstawi wierszy podpiętych pod rodziców A.
select throws_ok(
  $$insert into public.runs (session_id, user_id)
    values ('a1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'B nie wstawi biegu do sesji A');
select throws_ok(
  $$insert into public.gym_sets (user_id, session_id, exercise_id, exercise_position, set_no)
    values ('00000000-0000-0000-0000-00000000000b', 'a1000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000b', 1, 2)$$,
  '42501', null, 'B nie wstawi serii do sesji A');
select throws_ok(
  $$insert into public.gym_sets (user_id, session_id, exercise_id, exercise_position, set_no)
    values ('00000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000a', 1, 1)$$,
  '42501', null, 'B nie wstawi serii z ćwiczeniem A');
select throws_ok(
  $$insert into public.workout_template_items (user_id, template_id, exercise_id, position, sets_count)
    values ('00000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000a', 1, 3)$$,
  '42501', null, 'B nie wstawi pozycji szablonu z ćwiczeniem A');
select throws_ok(
  $$insert into public.workout_template_items (user_id, template_id, exercise_id, position, sets_count)
    values ('00000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000b', 2, 3)$$,
  '42501', null, 'B nie wstawi pozycji do szablonu A');
select throws_ok(
  $$insert into public.template_skips (template_id, user_id, date)
    values ('c0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '2026-12-03')$$,
  '42501', null, 'B nie wstawi pominięcia do szablonu A');

-- Od teraz jako zalogowany A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- Wiersze A przetrwały próby B z niezmienioną zawartością.
select is((select title || '|' || user_id from public.sport_sessions where id = 'a2000000-0000-0000-0000-00000000000a'),
  'Bieg A|00000000-0000-0000-0000-00000000000a', 'sesja A bez zmian');
select is((select distance_km from public.runs where session_id = 'a2000000-0000-0000-0000-00000000000a'),
  null, 'bieg A bez zmian');
select is((select name from public.exercises where id = 'e0000000-0000-0000-0000-00000000000a'),
  'Przysiad', 'ćwiczenie A bez zmian');
select is((select reps from public.gym_sets where id = 'd0000000-0000-0000-0000-00000000000a'),
  5::smallint, 'seria A bez zmian');
select is((select name from public.workout_templates where id = 'c0000000-0000-0000-0000-00000000000a'),
  'Push A', 'szablon A bez zmian');
select is((select sets_count from public.workout_template_items where id = 'f0000000-0000-0000-0000-00000000000a'),
  3::smallint, 'pozycja szablonu A bez zmian');
select is((select count(*) from public.template_skips), 1::bigint, 'A widzi tylko swoje pominięcie');

-- Unikalność i ograniczenia CHECK.
select throws_ok(
  $$insert into public.exercises (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'przysiad')$$,
  '23505', null, 'ćwiczenie „przysiad” przy „Przysiad” łamie unikalność');
select throws_ok(
  $$insert into public.sport_sessions (user_id, type, title, start_local, template_id, template_date)
    values ('00000000-0000-0000-0000-00000000000a', 'gym', 'Duplikat', '2026-11-19 18:00', 'c0000000-0000-0000-0000-00000000000a', '2026-11-19')$$,
  '23505', null, 'druga sesja z tym samym (template_id, template_date) łamie unikalność');
select throws_ok(
  $$insert into public.sport_sessions (user_id, type, title, start_local)
    values ('00000000-0000-0000-0000-00000000000a', 'swim', 'Pływanie', '2026-11-21 10:00')$$,
  '23514', null, 'nieznany typ sesji odrzucony');
select throws_ok(
  $$insert into public.sport_sessions (user_id, type, title, start_local, end_local)
    values ('00000000-0000-0000-0000-00000000000a', 'run', 'Koniec przed startem', '2026-11-21 10:00', '2026-11-21 09:00')$$,
  '23514', null, 'end_local przed start_local odrzucone');
select throws_ok(
  $$insert into public.runs (session_id, user_id, distance_km)
    values ('a1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 0)$$,
  '23514', null, 'dystans 0 odrzucony');
select throws_ok(
  $$insert into public.gym_sets (user_id, session_id, exercise_id, exercise_position, set_no, reps)
    values ('00000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000a', 1, 2, 1000)$$,
  '23514', null, '1000 powtórzeń odrzucone');
select throws_ok(
  $$insert into public.workout_templates (user_id, name, weekdays) values ('00000000-0000-0000-0000-00000000000a', 'Zły', '{8}')$$,
  '23514', null, 'dzień tygodnia 8 odrzucony');
select throws_ok(
  $$insert into public.workout_template_items (user_id, template_id, exercise_id, position, sets_count)
    values ('00000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000a', 2, 11)$$,
  '23514', null, '11 serii w pozycji szablonu odrzucone');

-- Usunięcie sesji usuwa bieg i serie.
delete from public.sport_sessions where id = 'a2000000-0000-0000-0000-00000000000a';
select is((select count(*) from public.runs where session_id = 'a2000000-0000-0000-0000-00000000000a'),
  0::bigint, 'usunięcie sesji usuwa bieg');
delete from public.sport_sessions where id = 'a1000000-0000-0000-0000-00000000000a';
select is((select count(*) from public.gym_sets where session_id = 'a1000000-0000-0000-0000-00000000000a'),
  0::bigint, 'usunięcie sesji usuwa serie');

-- Usunięcie szablonu zeruje template_id w sesjach i usuwa pozycje oraz pominięcia.
insert into public.sport_sessions (id, user_id, type, title, start_local, template_id, template_date)
values ('a3000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'gym', 'Z szablonu', '2026-11-26 17:00', 'c0000000-0000-0000-0000-00000000000a', '2026-11-26');
delete from public.workout_templates where id = 'c0000000-0000-0000-0000-00000000000a';
select is((select template_id from public.sport_sessions where id = 'a3000000-0000-0000-0000-00000000000a'),
  null, 'usunięcie szablonu zeruje template_id w sesji');
select is((select count(*) from public.workout_template_items where template_id = 'c0000000-0000-0000-0000-00000000000a'),
  0::bigint, 'usunięcie szablonu usuwa pozycje');
select is((select count(*) from public.template_skips where template_id = 'c0000000-0000-0000-0000-00000000000a'),
  0::bigint, 'usunięcie szablonu usuwa pominięcia');

reset role;
select * from finish();
rollback;