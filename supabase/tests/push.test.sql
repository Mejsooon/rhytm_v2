begin;
select plan(37);

-- A i B: dwa konta; endpointy na dozwolonych serwerach push.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a3', 'a3@test.pl', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'b3@test.pl', '{"display_name":"B"}');

-- Schemat i uprawnienia
select has_table('public', 'push_subscriptions', 'istnieje push_subscriptions');
select has_function('public', 'save_push_subscription', array['text', 'text', 'text', 'text'],
  'istnieje save_push_subscription(text, text, text, text)');
select ok(not has_function_privilege('anon', 'public.save_push_subscription(text, text, text, text)', 'execute'),
  'anon nie wykonuje save_push_subscription');
select ok(has_function_privilege('authenticated', 'public.save_push_subscription(text, text, text, text)', 'execute'),
  'authenticated wykonuje save_push_subscription');
select ok(not has_table_privilege('authenticated', 'public.push_subscriptions', 'INSERT'),
  'authenticated nie ma insert (zapis tylko przez funkcję)');
select ok(has_table_privilege('authenticated', 'public.push_subscriptions', 'SELECT, DELETE'),
  'authenticated czyta i usuwa');
select ok(not has_column_privilege('authenticated', 'public.push_subscriptions', 'endpoint', 'UPDATE'),
  'authenticated nie zmienia kolumny endpoint');
select ok(not has_column_privilege('authenticated', 'public.push_subscriptions', 'p256dh', 'UPDATE'),
  'authenticated nie zmienia kluczy');
select ok(has_column_privilege('authenticated', 'public.push_subscriptions', 'enabled', 'UPDATE'),
  'authenticated zmienia kolumnę enabled');
select ok(not has_table_privilege('anon', 'public.push_subscriptions', 'SELECT'),
  'anon nie czyta urządzeń');

-- Wartości domyślne ustawień powiadomień (decyzja C4) i brak starych wartości
insert into public.notification_settings (user_id) values ('00000000-0000-0000-0000-0000000000b3')
on conflict (user_id) do nothing;
select is(
  (select ns.before_block_min from public.notification_settings as ns where ns.user_id = '00000000-0000-0000-0000-0000000000b3'),
  5,
  'domyślnie 5 min przed blokiem'
);
select is(
  (select ns.renewal_days_before from public.notification_settings as ns where ns.user_id = '00000000-0000-0000-0000-0000000000b3'),
  1,
  'domyślnie dzień przed odnowieniem'
);
select is(
  (select count(*) from public.notification_settings as ns
   where (ns.before_block_min is not null and ns.before_block_min <> 5) or ns.renewal_days_before <> 1),
  0::bigint,
  'po migracji wszystkie wiersze mają 5 min (albo null) i 1 dzień'
);

-- Bez zalogowania funkcja odmawia
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/x', 'k', 'a', 'Chrome · Linux')$$,
  'P0001',
  'unauthorized',
  'bez auth.uid() → unauthorized'
);

-- Od teraz jako A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);

select isnt(
  public.save_push_subscription('https://fcm.googleapis.com/fcm/send/a1', 'klucz-a1', 'auth-a1', 'Chrome · Linux'),
  null,
  'zapis z dozwolonym hostem zwraca id'
);
select results_eq(
  $$select ps.user_id, ps.label, ps.enabled, ps.p256dh from public.push_subscriptions as ps
    where ps.endpoint = 'https://fcm.googleapis.com/fcm/send/a1'$$,
  $$values ('00000000-0000-0000-0000-0000000000a3'::uuid, 'Chrome · Linux', true, 'klucz-a1')$$,
  'wiersz należy do A, z etykietą, włączony'
);
select lives_ok(
  $$select public.save_push_subscription('https://wns2-par02p.notify.windows.com/w/?token=x', 'k', 'a', 'Edge · Windows')$$,
  'host *.notify.windows.com dozwolony'
);
select public.save_push_subscription('https://web.push.apple.com/a2', 'k', 'a', '   ');
select is(
  (select ps.label from public.push_subscriptions as ps where ps.endpoint = 'https://web.push.apple.com/a2'),
  'Przeglądarka',
  'pusta etykieta → „Przeglądarka”'
);
select public.save_push_subscription('https://web.push.apple.com/a3', 'k', 'a', repeat('x', 200));
select is(
  (select char_length(ps.label) from public.push_subscriptions as ps where ps.endpoint = 'https://web.push.apple.com/a3'),
  80,
  'etykieta przycięta do 80 znaków'
);

-- Odrzucenia
select throws_ok(
  $$select public.save_push_subscription('http://fcm.googleapis.com/fcm/send/x', 'k', 'a', 'L')$$,
  'P0001', 'invalid subscription', 'http:// odrzucony'
);
select throws_ok(
  $$select public.save_push_subscription('https://zly.example.com/push', 'k', 'a', 'L')$$,
  'P0001', 'invalid subscription', 'obcy host odrzucony'
);
select throws_ok(
  $$select public.save_push_subscription('https://zly.example.com@fcm.googleapis.com/x', 'k', 'a', 'L')$$,
  'P0001', 'invalid subscription', '@ w hoście odrzucone'
);
select throws_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com:8443/x', 'k', 'a', 'L')$$,
  'P0001', 'invalid subscription', 'port w hoście odrzucony'
);
select throws_ok(
  $$select public.save_push_subscription('https://xpush.apple.com/x', 'k', 'a', 'L')$$,
  'P0001', 'invalid subscription', 'host podszywający się pod *.push.apple.com odrzucony'
);
select throws_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com/' || repeat('x', 1000), 'k', 'a', 'L')$$,
  'P0001', 'invalid subscription', 'za długi endpoint odrzucony'
);
select throws_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/y', '', 'a', 'L')$$,
  'P0001', 'invalid subscription', 'pusty klucz odrzucony'
);
select throws_ok(
  $$insert into public.push_subscriptions (endpoint, p256dh, auth, label)
    values ('https://fcm.googleapis.com/fcm/send/z', 'k', 'a', 'L')$$,
  '42501', null, 'bezpośredni insert zabroniony'
);
select throws_ok(
  $$update public.push_subscriptions as ps set endpoint = 'https://zly.example.com/x'
    where ps.endpoint = 'https://fcm.googleapis.com/fcm/send/a1'$$,
  '42501', null, 'zmiana endpointu zabroniona'
);

-- A wyłącza urządzenie; ponowny zapis tego samego endpointu odświeża klucze, nie zmienia enabled ani id
update public.push_subscriptions as ps set enabled = false
where ps.endpoint = 'https://fcm.googleapis.com/fcm/send/a1';
select is(
  public.save_push_subscription('https://fcm.googleapis.com/fcm/send/a1', 'klucz-a1-nowy', 'auth-a1', 'Chrome · Linux'),
  (select ps.id from public.push_subscriptions as ps where ps.endpoint = 'https://fcm.googleapis.com/fcm/send/a1'),
  'ponowny zapis zwraca to samo id'
);
select results_eq(
  $$select ps.enabled, ps.p256dh from public.push_subscriptions as ps
    where ps.endpoint = 'https://fcm.googleapis.com/fcm/send/a1'$$,
  $$values (false, 'klucz-a1-nowy')$$,
  'ponowny zapis: nowe klucze, enabled bez zmian'
);

-- RLS: B nie widzi, nie zmienia i nie usuwa urządzeń A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select is((select count(*) from public.push_subscriptions), 0::bigint, 'B nie widzi urządzeń A');
update public.push_subscriptions as ps set enabled = true
where ps.endpoint = 'https://fcm.googleapis.com/fcm/send/a1';
delete from public.push_subscriptions as ps
where ps.endpoint = 'https://web.push.apple.com/a2';

reset role;
select results_eq(
  $$select ps.enabled from public.push_subscriptions as ps
    where ps.endpoint = 'https://fcm.googleapis.com/fcm/send/a1'$$,
  $$values (false)$$,
  'update B nie zmienił urządzenia A'
);
select ok(
  exists (select 1 from public.push_subscriptions as ps where ps.endpoint = 'https://web.push.apple.com/a2'),
  'delete B nie usunął urządzenia A'
);

-- Przejęcie endpointu A przez B: z innymi kluczami odrzucone (sama znajomość adresu nie wystarcza)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select throws_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/a1', 'klucz-b', 'auth-b', 'Firefox · Linux')$$,
  'P0001', 'invalid subscription', 'przejęcie z innymi kluczami odrzucone'
);
reset role;
select results_eq(
  $$select ps.user_id, ps.p256dh from public.push_subscriptions as ps
    where ps.endpoint = 'https://fcm.googleapis.com/fcm/send/a1'$$,
  $$values ('00000000-0000-0000-0000-0000000000a3'::uuid, 'klucz-a1-nowy')$$,
  'po odmowie urządzenie zostaje przy A z jego kluczami'
);

-- Przejęcie z tymi samymi kluczami (ta sama przeglądarka, inne konto)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/a1', 'klucz-a1-nowy', 'auth-a1', 'Firefox · Linux');

reset role;
select results_eq(
  $$select ps.user_id, ps.enabled, ps.label from public.push_subscriptions as ps
    where ps.endpoint = 'https://fcm.googleapis.com/fcm/send/a1'$$,
  $$values ('00000000-0000-0000-0000-0000000000b3'::uuid, true, 'Firefox · Linux')$$,
  'przejęcie: jeden wiersz, należy do B, włączony'
);

-- Usunięcie konta usuwa jego urządzenia (kaskada)
delete from auth.users as u where u.id = '00000000-0000-0000-0000-0000000000b3';
select is(
  (select count(*) from public.push_subscriptions as ps where ps.user_id = '00000000-0000-0000-0000-0000000000b3'),
  0::bigint,
  'usunięcie konta usuwa urządzenia'
);

select * from finish();
rollback;
