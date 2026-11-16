begin;
select plan(4);

-- Dwóch użytkowników; trigger on_auth_user_created tworzy im profile.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl', '{"full_name":"B G"}');

-- Trigger bierze full_name, gdy brak display_name (logowanie Google).
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b'),
  'B G',
  'display_name z full_name, gdy brak display_name'
);

-- Od teraz działamy jako zalogowany użytkownik A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'A widzi tylko swój profil'
);

update public.profiles set display_name = 'HACK'
where user_id = '00000000-0000-0000-0000-00000000000b';

reset role;

select is(
  (select display_name from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b'),
  'B G',
  'A nie zmienia profilu B'
);

select is(
  (select timezone from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  'Europe/Warsaw',
  'domyślna strefa czasowa'
);

select * from finish();
rollback;
