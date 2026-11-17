begin;
select plan(15);

-- Użytkownicy A, B, C (długa nazwa) i D (same spacje w nazwie).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl', '{"display_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.pl', jsonb_build_object('full_name', repeat('x', 60))),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.pl', '{"full_name":"   "}');

select is(
  (select onboarding_step from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  1::smallint,
  'onboarding_step nowego profilu = 1'
);
select is(
  (select pending_pages from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  null,
  'pending_pages nowego profilu = null'
);
select is(
  (select char_length(display_name) from public.profiles where user_id = '00000000-0000-0000-0000-00000000000c'),
  40,
  'długie full_name przycięte do 40 znaków'
);
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-0000-0000-00000000000d'),
  null,
  'full_name z samych spacji daje display_name null'
);

-- Dane B wstawione jako superuser.
insert into public.categories (user_id, name, color, position)
values ('00000000-0000-0000-0000-00000000000b', 'Cudza', '#000000', 0);
insert into public.notification_settings (user_id)
values ('00000000-0000-0000-0000-00000000000b');

-- Od teraz jako zalogowany A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$update public.profiles set weight_kg = 20 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514',
  null,
  'waga poza zakresem odrzucona'
);
select throws_ok(
  $$update public.profiles set sleep_goal_min = 310 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514',
  null,
  'cel snu nie co 15 min odrzucony'
);

select complete_onboarding(
  '[{"name":"Studia","color":"#0070f3","is_system":false},{"name":"Sport","color":"#c2410c","is_system":true}]'::jsonb
);

select is(
  (select count(*) from public.categories where user_id = '00000000-0000-0000-0000-00000000000a'),
  2::bigint,
  'complete_onboarding tworzy 2 kategorie'
);
select isnt(
  (select onboarded_at from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  null,
  'onboarded_at ustawione'
);

-- Zapamiętujemy czas, żeby sprawdzić brak zmiany po drugim wywołaniu.
select set_config('t.first_onboarded_at',
  (select onboarded_at::text from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'), true);

select complete_onboarding('[{"name":"Inna","color":"#111111","is_system":false}]'::jsonb);

select is(
  (select count(*) from public.categories where user_id = '00000000-0000-0000-0000-00000000000a'),
  2::bigint,
  'drugie wywołanie nie dodaje kategorii'
);
select is(
  (select onboarded_at::text from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  current_setting('t.first_onboarded_at'),
  'drugie wywołanie nie zmienia onboarded_at'
);

select is(
  (select count(*) from public.categories where user_id = '00000000-0000-0000-0000-00000000000b'),
  0::bigint,
  'A nie widzi kategorii B'
);
select is(
  (select count(*) from public.notification_settings),
  0::bigint,
  'A nie widzi ustawień powiadomień B'
);
select throws_ok(
  $$insert into public.categories (user_id, name, color, position) values ('00000000-0000-0000-0000-00000000000b', 'X', '#fff', 0)$$,
  '42501',
  null,
  'A nie wstawi kategorii dla B'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('avatars', '00000000-0000-0000-0000-00000000000b/avatar.png', '00000000-0000-0000-0000-00000000000a')$$,
  '42501',
  null,
  'A nie wgra avatara do folderu B'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('avatars', '00000000-0000-0000-0000-00000000000a/avatar.png', '00000000-0000-0000-0000-00000000000a')$$,
  'A wgra avatar do własnego folderu'
);

reset role;
select * from finish();
rollback;
