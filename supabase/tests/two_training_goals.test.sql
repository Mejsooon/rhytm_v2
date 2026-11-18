begin;
select plan(5);

-- Dwa cele treningowe: domyślnie oba włączone, co najmniej jeden musi zostać.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000b', 'b@test.pl', '{"display_name":"B"}');

select is(
  (select p.workouts_goal_on::text || ':' || p.km_goal_on::text from public.profiles as p where p.user_id = '00000000-0000-0000-0000-00000000000b'),
  'true:true',
  'nowy profil: oba cele włączone'
);

-- Od teraz jako zalogowany B (zapis przez RLS i granty profilu).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select lives_ok(
  $$update public.profiles set km_goal_on = false where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  'B wyłącza cel km'
);
select is(
  (select p.workouts_goal_on::text || ':' || p.km_goal_on::text from public.profiles as p where p.user_id = '00000000-0000-0000-0000-00000000000b'),
  'true:false',
  'zostały same treningi'
);
select throws_ok(
  $$update public.profiles set workouts_goal_on = false where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  '23514',
  null,
  'nie da się wyłączyć obu celów'
);
select throws_ok(
  $$update public.profiles set km_goal_on = null where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  '23502',
  null,
  'przełącznik celu nie może być null'
);

reset role;
select * from finish();
rollback;
