begin;
select plan(3);

-- „Pierwsze kroki” w profilu: domyślne wartości, zapis przez RLS i ograniczenie typu.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}');

select results_eq(
  $$select first_steps, first_steps_hidden from public.profiles
    where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  $$values ('{}'::jsonb, false)$$,
  'nowy profil nie ma odhaczonych kroków i widzi listę'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$update public.profiles set first_steps = '{"push": true}', first_steps_hidden = true
    where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  'A zapisuje swoje kroki'
);
select throws_ok(
  $$update public.profiles set first_steps = '[]' where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'tablica zamiast obiektu odrzucona'
);

reset role;
select * from finish();
rollback;
