begin;
select plan(6);

-- Inne aktywności: typ sesji, dane aktywności i własne rodzaje przez RLS.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl', '{"display_name":"B"}');
insert into public.sport_sessions (id, user_id, type, title, start_local)
values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'other', 'Tenis B', '2027-01-12 18:00');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.sport_sessions (id, user_id, type, title, start_local)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'other', 'Tenis', '2027-01-12 18:00')$$,
  'A dodaje sesję typu other'
);
select lives_ok(
  $$insert into public.activities (session_id, user_id, kind, duration_s)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Tenis', 4500)$$,
  'A zapisuje dane aktywności'
);
select throws_ok(
  $$insert into public.activities (session_id, user_id, kind)
    values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'Tenis')$$,
  '42501', null, 'cudza sesja odrzucona'
);
select lives_ok(
  $$insert into public.activity_kinds (user_id, name, color)
    values ('00000000-0000-0000-0000-00000000000a', 'Curling', '#0891b2')$$,
  'A dodaje własny rodzaj'
);
select throws_ok(
  $$insert into public.activity_kinds (user_id, name, color)
    values ('00000000-0000-0000-0000-00000000000a', 'curling', '#0891b2')$$,
  '23505', null, 'nazwa rodzaju unikalna bez wielkości liter'
);
select throws_ok(
  $$insert into public.activity_kinds (user_id, name, color)
    values ('00000000-0000-0000-0000-00000000000b', 'Obce', '#0891b2')$$,
  '42501', null, 'rodzaj dla innego konta odrzucony'
);

reset role;
select * from finish();
rollback;
