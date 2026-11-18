begin;
select plan(7);

-- Kolumna exercises.bodyweight: istnieje, domyślnie false, właściciel może ją zmienić (RLS).
select has_column('public', 'exercises', 'bodyweight', 'exercises.bodyweight istnieje');
select col_not_null('public', 'exercises', 'bodyweight', 'bodyweight jest not null');
select col_default_is('public', 'exercises', 'bodyweight', 'false', 'bodyweight domyślnie false');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl', '{"display_name":"B"}');

insert into public.exercises (id, user_id, name)
values
  ('d0000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Pompki'),
  ('d0000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Dipy');

select is(
  (select e.bodyweight from public.exercises as e where e.id = 'd0000000-0000-4000-8000-00000000000a'),
  false,
  'nowe ćwiczenie bez podanej flagi ma bodyweight = false'
);

-- Od teraz jako zalogowany A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$update public.exercises set bodyweight = true where id = 'd0000000-0000-4000-8000-00000000000a'$$,
  'A zmienia flagę własnego ćwiczenia'
);
select is(
  (select e.bodyweight from public.exercises as e where e.id = 'd0000000-0000-4000-8000-00000000000a'),
  true,
  'flaga A zapisana'
);

-- Cudzego ćwiczenia RLS nie pokazuje ani nie zmienia
update public.exercises set bodyweight = true where id = 'd0000000-0000-4000-8000-00000000000b';
reset role;
select is(
  (select e.bodyweight from public.exercises as e where e.id = 'd0000000-0000-4000-8000-00000000000b'),
  false,
  'A nie zmienia flagi ćwiczenia B'
);

select * from finish();
rollback;
