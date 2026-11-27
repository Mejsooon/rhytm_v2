begin;
select plan(5);

-- Dziennik siłowni: rodzaje ćwiczeń, typy serii i ich granice (przez RLS właściciela).
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.exercises (id, user_id, name, kind, equipment, note, rest_s)
    values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Plank', 'dur', 'Masa ciała', 'proste plecy', 60)$$,
  'ćwiczenie z rodzajem, sprzętem, notatką i przerwą'
);
select throws_ok(
  $$insert into public.exercises (user_id, name, kind)
    values ('00000000-0000-0000-0000-00000000000a', 'Zły rodzaj', 'xx')$$,
  '23514', null, 'nieznany rodzaj odrzucony'
);

insert into public.sport_sessions (id, user_id, type, title, start_local, started_at)
values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'gym', 'Push', '2027-01-12 18:00', now());

select lives_ok(
  $$insert into public.gym_sets (user_id, session_id, exercise_id, exercise_position, set_no, duration_s)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 1, 1, 60)$$,
  'seria na czas'
);
select is(
  (select set_type from public.gym_sets where set_no = 1),
  'N', 'domyślnie seria robocza'
);
select throws_ok(
  $$insert into public.gym_sets (user_id, session_id, exercise_id, exercise_position, set_no, set_type)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 1, 2, 'X')$$,
  '23514', null, 'nieznany typ serii odrzucony'
);

reset role;
select * from finish();
rollback;
