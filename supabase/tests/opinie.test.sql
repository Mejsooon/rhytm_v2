begin;
select plan(5);

-- Opinie: zalogowany dodaje tylko swoje i niczego nie czyta.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}'),
       ('00000000-0000-0000-0000-00000000000b', 'b@test.pl', '{"display_name":"B"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.feedback (kind, message, contact) values ('idea', 'Widok tablicy', true)$$,
  'A wysyła opinię (user_id z sesji)'
);
select throws_ok(
  $$insert into public.feedback (user_id, kind, message) values ('00000000-0000-0000-0000-00000000000b', 'bug', 'x')$$,
  '42501', null, 'nie da się podać cudzego user_id'
);
select throws_ok(
  $$insert into public.feedback (kind, message) values ('spam', 'x')$$,
  '23514', null, 'rodzaj spoza listy odrzucony'
);
select throws_ok(
  $$insert into public.feedback (kind, message) values ('other', '   ')$$,
  '23514', null, 'pusta treść odrzucona'
);
select throws_ok(
  $$select * from public.feedback$$,
  '42501', null, 'zalogowany nie czyta zgłoszeń'
);

reset role;
select * from finish();
rollback;
