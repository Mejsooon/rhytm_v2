begin;
select plan(7);

-- Nawyki v2: przerwa w harmonogramie, cel ilościowy, częściowy postęp (RLS) i pora snu.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl', '{"display_name":"B"}');

select results_eq(
  $$select sleep_bedtime from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  $$values ('23:00'::time)$$,
  'nowy profil ma porę snu 23:00'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into public.habits (id, user_id, name, goal_qty, goal_unit)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'Woda', 2, 'l');

select lives_ok(
  $$insert into public.habit_schedules (habit_id, user_id, valid_from, schedule_type)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', '2026-11-01', 'paused')$$,
  'wersja „paused” przechodzi'
);
select throws_ok(
  $$update public.habits set goal_unit = null where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'ilość bez jednostki odrzucona'
);
select throws_ok(
  $$update public.habits set goal_qty = 0 where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'cel zero odrzucony'
);
select lives_ok(
  $$insert into public.habit_progress (habit_id, user_id, date, qty)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', '2026-11-02', 1)$$,
  'A zapisuje częściowy postęp'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is_empty(
  $$select 1 from public.habit_progress$$,
  'B nie widzi postępu A'
);
select throws_ok(
  $$insert into public.habit_progress (habit_id, user_id, date, qty)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', '2026-11-03', 1)$$,
  '42501', null, 'B nie dopisze postępu do cudzego nawyku'
);

reset role;
select * from finish();
rollback;
