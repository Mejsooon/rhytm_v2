begin;
select plan(25);

-- A: konto z hasłem, B: drugie konto z hasłem, C: konto tylko Google (bez hasła).
insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.pl', extensions.crypt('Dobre-Haslo-123', extensions.gen_salt('bf')), '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.pl', extensions.crypt('Haslo-B-12345', extensions.gen_salt('bf')), '{"display_name":"B"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.pl', null, '{"display_name":"C"}');

-- Sesje: A1 bieżąca, A2 inna aktywna, A3 wygasła (not_after w przeszłości), B1 cudza.
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at, not_after, user_agent, ip)
values
  ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000000a1', now() - interval '2 days', now() - interval '2 days', (now() - interval '1 minute') at time zone 'UTC', null, 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0', '10.0.0.1'),
  ('00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-0000000000a1', now() - interval '3 days', now() - interval '1 day', null, null, 'Mozilla/5.0 (iPhone) Safari/604.1', '10.0.0.2'),
  ('00000000-0000-0000-0000-0000000005a3', '00000000-0000-0000-0000-0000000000a1', now() - interval '9 days', now() - interval '9 days', null, now() - interval '1 day', 'stara', '10.0.0.3'),
  ('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000000b1', now() - interval '1 day', now() - interval '1 day', null, null, 'cudza', '10.0.0.4');

-- Uprawnienia: anon nie wywoła żadnej z funkcji, authenticated tak.
select ok(
  not has_function_privilege('anon', 'public.list_my_sessions()', 'execute'),
  'anon nie może wywołać list_my_sessions'
);
select ok(
  not has_function_privilege('anon', 'public.revoke_my_session(uuid)', 'execute'),
  'anon nie może wywołać revoke_my_session'
);
select ok(
  not has_function_privilege('anon', 'public.verify_my_password(text)', 'execute'),
  'anon nie może wywołać verify_my_password'
);
select ok(
  has_function_privilege('authenticated', 'public.list_my_sessions()', 'execute')
  and has_function_privilege('authenticated', 'public.revoke_my_session(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.verify_my_password(text)', 'execute'),
  'authenticated może wywołać trzy funkcje'
);

-- Od teraz jako zalogowany A w sesji A1.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-0000000005a1"}', true);

-- Lista sesji
select is(
  (select count(*) from public.list_my_sessions()),
  2::bigint,
  'lista zawiera tylko własne, niewygasłe sesje (2)'
);
select is(
  (select l.id from public.list_my_sessions() as l limit 1),
  '00000000-0000-0000-0000-0000000005a1'::uuid,
  'bieżąca sesja jest pierwsza'
);
select is(
  (select array_agg(l.id order by l.id) from public.list_my_sessions() as l where l.is_current),
  array['00000000-0000-0000-0000-0000000005a1'::uuid],
  'is_current tylko dla session_id z JWT'
);
select ok(
  not exists (select 1 from public.list_my_sessions() as l where l.id = '00000000-0000-0000-0000-0000000005a3'),
  'sesja z not_after w przeszłości pominięta'
);
select ok(
  not exists (select 1 from public.list_my_sessions() as l where l.id = '00000000-0000-0000-0000-0000000005b1'),
  'cudza sesja niewidoczna'
);
select is(
  (select l.ip from public.list_my_sessions() as l where l.id = '00000000-0000-0000-0000-0000000005a2'),
  '10.0.0.2',
  'ip jako tekst bez maski'
);

-- Wylogowanie pojedynczej sesji
select is(
  public.revoke_my_session('00000000-0000-0000-0000-0000000005b1'),
  false,
  'cudzej sesji nie da się wylogować'
);
select is(
  public.revoke_my_session('00000000-0000-0000-0000-0000000005a1'),
  false,
  'bieżącej sesji nie da się wylogować tą funkcją'
);
select is(
  public.revoke_my_session('00000000-0000-0000-0000-0000000005a2'),
  true,
  'własna inna sesja wylogowana'
);

-- authenticated nie czyta tabeli porażek
select throws_ok(
  $$select * from public.password_check_failures$$,
  '42501',
  null,
  'authenticated nie czyta password_check_failures'
);

-- Weryfikacja hasła
select is(public.verify_my_password('Dobre-Haslo-123'), true, 'dobre hasło → true');
select is(public.verify_my_password('Zle-Haslo-123'), false, 'złe hasło → false');

reset role;
select is(
  (select array_agg(s.id order by s.id) from auth.sessions as s where s.id in (
    '00000000-0000-0000-0000-0000000005a1',
    '00000000-0000-0000-0000-0000000005a2',
    '00000000-0000-0000-0000-0000000005b1'
  )),
  array['00000000-0000-0000-0000-0000000005a1'::uuid, '00000000-0000-0000-0000-0000000005b1'::uuid],
  'po revoke: A2 usunięta, bieżąca A1 i cudza B1 zostały'
);
select is(
  (select count(*) from public.password_check_failures as f where f.user_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'złe hasło zapisane jako porażka'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-0000000005a1"}', true);
select is(public.verify_my_password('Dobre-Haslo-123'), true, 'dobre hasło po porażce → true');

reset role;
select is(
  (select count(*) from public.password_check_failures as f where f.user_id = '00000000-0000-0000-0000-0000000000a1'),
  0::bigint,
  'sukces czyści porażki'
);

-- 5 porażek → 6. wywołanie rzuca za_duzo_prob (nawet z dobrym hasłem)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-0000000005a1"}', true);
do $$
begin
  for i in 1..5 loop
    perform public.verify_my_password('Zle-Haslo-123');
  end loop;
end;
$$;
select throws_ok(
  $$select public.verify_my_password('Dobre-Haslo-123')$$,
  'P0001',
  'za_duzo_prob',
  '6. próba po 5 porażkach → za_duzo_prob'
);

-- B ma własny licznik
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(public.verify_my_password('Haslo-B-12345'), true, 'limit A nie dotyczy B');

-- C bez hasła (Google) → false
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(public.verify_my_password('cokolwiek-123'), false, 'konto bez hasła → false');

-- Bez zalogowania → unauthorized
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select public.verify_my_password('Dobre-Haslo-123')$$,
  'P0001',
  'unauthorized',
  'bez auth.uid() → unauthorized'
);
select is(
  (select count(*) from public.list_my_sessions()),
  0::bigint,
  'bez auth.uid() lista sesji pusta'
);

reset role;
select * from finish();
rollback;
