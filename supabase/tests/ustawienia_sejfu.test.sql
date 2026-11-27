begin;
select plan(3);

-- Ustawienia sejfu w profilu: domyślne wartości, zapis przez RLS i dozwolone czasy blokady.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}');

select results_eq(
  $$select vault_lock_min, vault_clear_clipboard, vault_ask_on_reveal from public.profiles
    where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  $$values (5::smallint, true, false)$$,
  'nowy profil: blokada po 5 min, czyszczenie schowka wł., bez pytania o hasło'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$update public.profiles set vault_lock_min = 60, vault_clear_clipboard = false, vault_ask_on_reveal = true
    where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  'A zapisuje swoje ustawienia sejfu'
);
select throws_ok(
  $$update public.profiles set vault_lock_min = 120 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'czas blokady spoza listy odrzucony'
);

reset role;
select * from finish();
rollback;
