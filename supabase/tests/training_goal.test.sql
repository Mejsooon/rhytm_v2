begin;
select plan(6);

-- Cel treningowy: liczba treningów w tygodniu.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}');

select is(
  (select weekly_workouts_goal from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  null,
  'liczba treningów nowego profilu = null'
);

-- Od teraz jako zalogowany A (zapis przez RLS i granty profilu).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$update public.profiles set weekly_workouts_goal = 3 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  'A zapisuje cel 3 treningi'
);
select is(
  (select weekly_workouts_goal from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  3,
  'cel treningowy zapisany'
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
