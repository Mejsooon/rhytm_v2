begin;
select plan(6);

-- Ustawienia kalendarza w profilu: domyślne wartości, zapis przez RLS i ograniczenia.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}');

select results_eq(
  $$select calendar_view, calendar_from_hour::int, calendar_to_hour::int, calendar_block_min::int,
           calendar_week_numbers, calendar_show_sport, calendar_show_renewals
    from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  $$values ('week'::text, 7, 23, 60, true, true, true)$$,
  'nowy profil ma domyślne ustawienia kalendarza'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$update public.profiles set calendar_view = 'month', calendar_from_hour = 5, calendar_to_hour = 24,
      calendar_block_min = 90, calendar_show_sport = false
    where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  'A zapisuje swoje ustawienia'
);
select throws_ok(
  $$update public.profiles set calendar_view = 'year' where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'nieznany widok odrzucony'
);
select throws_ok(
  $$update public.profiles set calendar_from_hour = 12, calendar_to_hour = 15 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'siatka krótsza niż 4 godziny odrzucona'
);
select throws_ok(
  $$update public.profiles set calendar_to_hour = 25 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'godzina 25 odrzucona'
);
select throws_ok(
  $$update public.profiles set calendar_block_min = 45 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'długość 45 min odrzucona'
);

reset role;
select * from finish();
rollback;
