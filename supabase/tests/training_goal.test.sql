begin;
select plan(9);

-- Cel treningowy: rodzaj (treningi albo km) i liczba treningów w tygodniu.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}');

-- Domyślnie 'km', żeby zapisany cel istniejących kont się nie zmienił.
select is(
  (select weekly_goal_type from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  'km',
  'domyślny rodzaj celu = km'
);
select is(
  (select weekly_workouts_goal from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  null,
  'liczba treningów nowego profilu = null'
);

-- Od teraz jako zalogowany A (zapis przez RLS i granty profilu).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$update public.profiles set weekly_goal_type = 'workouts', weekly_workouts_goal = 3 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  'A zapisuje cel 3 treningi'
);
select is(
  (select weekly_goal_type || ':' || weekly_workouts_goal from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  'workouts:3',
  'cel treningowy zapisany'
);
select throws_ok(
  $$update public.profiles set weekly_goal_type = 'min' where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514',
  null,
  'nieznany rodzaj celu odrzucony'
);
select throws_ok(
  $$update public.profiles set weekly_goal_type = null where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23502',
  null,
  'rodzaj celu nie może być null'
);
select throws_ok(
  $$update public.profiles set weekly_workouts_goal = 0 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514',
  null,
  '0 treningów odrzucone'
);
select throws_ok(
  $$update public.profiles set weekly_workouts_goal = 15 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514',
  null,
  '15 treningów odrzucone'
);
select lives_ok(
  $$update public.profiles set weekly_workouts_goal = 14 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '14 treningów przyjęte'
);

reset role;
select * from finish();
rollback;
