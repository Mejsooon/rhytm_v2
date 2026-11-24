begin;
select plan(36);

-- Użytkownik P: strona Hasła (ensure_passwords_page), zwykła strona z dwiema tabelami i strona z Sekretem w koszu.
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000c1', 'p@test.pl'),
  ('00000000-0000-0000-0000-0000000000c2', 'v@test.pl');

-- Schemat i uprawnienia.
select has_trigger('public', 'page_rows', 'page_rows_guard', 'wyzwalacz page_rows_guard istnieje');
select is(has_function_privilege('authenticated', 'public.page_rows_guard()', 'execute'), false,
  'authenticated nie wykonuje page_rows_guard');
select is(has_function_privilege('anon', 'public.page_rows_guard()', 'execute'), false,
  'anon nie wykonuje page_rows_guard');
select ok(has_function_privilege('authenticated', 'public.reset_vault()', 'execute'),
  'authenticated dalej wykonuje reset_vault');

-- V (ofiara): strona Hasła i aktywny sejf; P nie może się o nich niczego dowiedzieć.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
-- ensure_passwords_page w osobnym poleceniu: w jednym zapytaniu podzapytanie nie widzi bloku wstawionego przez
-- funkcję w trakcie tego samego polecenia (migawka sprzed wywołania) i zwracało pusty id.
select set_config('test.v_page', public.ensure_passwords_page()::text, true);
select set_config('test.v_block', (select b.id::text from public.page_blocks as b
  where b.page_id = current_setting('test.v_page')::uuid), true);
select ok(current_setting('test.v_block') <> '', 'id bloku Haseł V ustawione');
insert into public.vaults (status, generation) values ('active', 1);

-- Od teraz jako zalogowany P.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

select set_config('test.sys', public.ensure_passwords_page()::text, true);
select set_config('test.sys_block', (select b.id::text from public.page_blocks as b where b.page_id = current_setting('test.sys')::uuid), true);
select set_config('test.f_serwis', (select f.id::text from public.page_fields as f
  where f.block_id = current_setting('test.sys_block')::uuid and f.name = 'Serwis'), true);
select set_config('test.f_haslo', (select f.id::text from public.page_fields as f
  where f.block_id = current_setting('test.sys_block')::uuid and f.name = 'Hasło'), true);

select set_config('test.reg', public.create_page('Zwykła', '', null,
  '[{"type":"table","content":{"name":"","settings":{}},"fields":[{"name":"Nazwa","type":"text","config":{},"is_title":true}],"rows":[]},
    {"type":"table","content":{"name":"","settings":{}},"fields":[{"name":"Nazwa","type":"text","config":{},"is_title":true}],"rows":[]}]'::jsonb)::text, true);
select set_config('test.reg_block1', (select b.id::text from public.page_blocks as b
  where b.page_id = current_setting('test.reg')::uuid and b.position = 0), true);
select set_config('test.reg_block2', (select b.id::text from public.page_blocks as b
  where b.page_id = current_setting('test.reg')::uuid and b.position = 1), true);

-- Szyfrogramy o poprawnym kształcie: iv 16 znaków base64 (12 B), ct 24 znaki (16 B, sam tag GCM).
select set_config('test.g1', '{"v":1,"g":1,"iv":"AAAAAAAAAAAAAAAA","ct":"AAAAAAAAAAAAAAAAAAAAAAAA"}', true);
select set_config('test.g2', '{"v":1,"g":2,"iv":"BBBBBBBBBBBBBBBB","ct":"BBBBBBBBBBBBBBBBBBBBBBB="}', true);

-- Bez sejfu sekretu nie da się zapisać.
select throws_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, %L::jsonb))',
    current_setting('test.sys_block'), current_setting('test.f_haslo'), current_setting('test.g1')),
  'P0001', 'Sejf zmienił się albo jest zablokowany', 'sekret bez sejfu odrzucony');

insert into public.vaults (status, generation) values ('active', 1);

-- (1) Poprawny sekret przy aktywnym sejfie i g = generation.
select lives_ok(
  format('insert into public.page_rows (id, block_id, values) values (%L, %L, jsonb_build_object(%L, ''GitHub'', %L, %L::jsonb))',
    'a0000000-0000-0000-0000-000000000001', current_setting('test.sys_block'),
    current_setting('test.f_serwis'), current_setting('test.f_haslo'), current_setting('test.g1')),
  'poprawny sekret przy aktywnym sejfie zapisany');

-- (2)–(6) Zły kształt.
select throws_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, ''jawne hasło''))',
    current_setting('test.sys_block'), current_setting('test.f_haslo')),
  'P0001', 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość', 'jawny tekst pod Hasłem odrzucony');
select throws_ok(
  format('update public.page_rows set values = jsonb_set(values, array[%L], ''"jawne"''::jsonb) where id = %L',
    current_setting('test.f_haslo'), 'a0000000-0000-0000-0000-000000000001'),
  'P0001', 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość', 'zmiana sekretu na jawny tekst odrzucona');
select throws_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, %L::jsonb))',
    current_setting('test.sys_block'), current_setting('test.f_haslo'),
    '{"v":1,"g":1,"iv":"AAAAAAAAAAAAAAAA"}'),
  'P0001', 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość', 'obiekt bez ct odrzucony');
select throws_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, %L::jsonb))',
    current_setting('test.sys_block'), current_setting('test.f_haslo'),
    '{"v":1,"g":1,"iv":"AAAAAAAAAAAAAAAA","ct":"AAAAAAAAAAAAAAAAAAAAAAAA","plain":"x"}'),
  'P0001', 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość', 'dodatkowy klucz odrzucony');
select throws_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, %L::jsonb))',
    current_setting('test.sys_block'), current_setting('test.f_haslo'),
    '{"v":1,"g":1,"iv":"AAAAAAAAAAAAAAA","ct":"AAAAAAAAAAAAAAAAAAAAAAAA"}'),
  'P0001', 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość', 'iv złej długości odrzucone');
select throws_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, jsonb_build_object(''v'', 1, ''g'', 1, ''iv'', ''AAAAAAAAAAAAAAAA'', ''ct'', repeat(''A'', 8196))))',
    current_setting('test.sys_block'), current_setting('test.f_haslo')),
  'P0001', 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość', 'ct dłuższe niż 8192 znaki odrzucone');
select throws_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, %L::jsonb))',
    current_setting('test.sys_block'), current_setting('test.f_haslo'),
    '{"v":1,"g":"1","iv":"AAAAAAAAAAAAAAAA","ct":"AAAAAAAAAAAAAAAAAAAAAAAA"}'),
  'P0001', 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość', 'g jako tekst odrzucone');
select throws_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, %L::jsonb))',
    current_setting('test.sys_block'), current_setting('test.f_haslo'),
    '{"v":1,"g":1,"iv":"AAAAAAAAAAAAAAAA","ct":"AAAAAAAAAAAA AAAAAAAAAAA"}'),
  'P0001', 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość', 'ct spoza alfabetu base64 odrzucone');

-- (11) Wiersz modułu Hasła nie wychodzi do zwykłego bloku.
select throws_ok(
  format('update public.page_rows set block_id = %L where id = %L',
    current_setting('test.reg_block1'), 'a0000000-0000-0000-0000-000000000001'),
  'P0001', 'Wiersza modułu Hasła nie można przenieść', 'przeniesienie wiersza z bloku Haseł odrzucone');

-- (13) Zwykła strona: dowolne wartości i przeniesienia między zwykłymi blokami.
select lives_ok(
  format('insert into public.page_rows (id, block_id, values) values (%L, %L, %L::jsonb)',
    'a0000000-0000-0000-0000-000000000002', current_setting('test.reg_block1'),
    '{"x":"jawny tekst","y":{"v":1,"g":99,"iv":"?","ct":"?"}}'),
  'zwykła tabela przyjmuje dowolne wartości');
select lives_ok(
  format('update public.page_rows set block_id = %L where id = %L',
    current_setting('test.reg_block2'), 'a0000000-0000-0000-0000-000000000002'),
  'przeniesienie między zwykłymi blokami przechodzi');

-- (12) Zwykły wiersz nie wchodzi do bloku Haseł.
select throws_ok(
  format('update public.page_rows set block_id = %L where id = %L',
    current_setting('test.sys_block'), 'a0000000-0000-0000-0000-000000000002'),
  'P0001', 'Wiersza modułu Hasła nie można przenieść', 'przeniesienie wiersza do bloku Haseł odrzucone');

-- (14) reset_vault dalej czyści sekrety i podbija generation.
select is(public.reset_vault(), 1, 'reset_vault liczy wyczyszczony sekret');
select is((select jsonb_typeof(r.values -> current_setting('test.f_haslo')) from public.page_rows as r
  where r.id = 'a0000000-0000-0000-0000-000000000001'), 'null', 'reset_vault zeruje Hasło');
select ok((select v.status = 'reset' and v.generation = 2 from public.vaults as v
  where v.user_id = '00000000-0000-0000-0000-0000000000c1'), 'reset_vault: status reset, generation 2');

-- (8) Sejf po resecie: nawet g = generation nie przechodzi.
select throws_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, %L::jsonb))',
    current_setting('test.sys_block'), current_setting('test.f_haslo'), current_setting('test.g2')),
  'P0001', 'Sejf zmienił się albo jest zablokowany', 'sejf w stanie reset odrzuca sekret');

-- (9) null pod Hasłem przechodzi także przy sejfie po resecie.
select lives_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, ''Bank'', %L, null::jsonb))',
    current_setting('test.sys_block'), current_setting('test.f_serwis'), current_setting('test.f_haslo')),
  'null pod Hasłem przy sejfie po resecie zapisany');

-- Odtworzenie sejfu (nowe hasło główne, generation zostaje 2).
update public.vaults set status = 'active', kdf = '{"alg":"PBKDF2-SHA-256"}'::jsonb
where user_id = '00000000-0000-0000-0000-0000000000c1';

-- (7) Szyfrogram ze starej generacji odrzucony.
select throws_ok(
  format('update public.page_rows set values = jsonb_set(values, array[%L], %L::jsonb) where id = %L',
    current_setting('test.f_haslo'), current_setting('test.g1'), 'a0000000-0000-0000-0000-000000000001'),
  'P0001', 'Sejf zmienił się albo jest zablokowany', 'g = generation − 1 odrzucone');
select lives_ok(
  format('update public.page_rows set values = jsonb_set(values, array[%L], %L::jsonb) where id = %L',
    current_setting('test.f_haslo'), current_setting('test.g2'), 'a0000000-0000-0000-0000-000000000001'),
  'g = bieżące generation przechodzi');

-- (10) Wiersz ze starym g (np. z innej karty) wstawiony z pominięciem strażnika: zmiana samego Serwisu przechodzi.
reset role;
select set_config('rhytm.system_write', 'on', true);
insert into public.page_rows (id, block_id, user_id, values)
values ('a0000000-0000-0000-0000-000000000003', current_setting('test.sys_block')::uuid, '00000000-0000-0000-0000-0000000000c1',
  jsonb_build_object(current_setting('test.f_serwis'), 'Stary', current_setting('test.f_haslo'), current_setting('test.g1')::jsonb));
select set_config('rhytm.system_write', 'off', true);
set local role authenticated;
select lives_ok(
  format('update public.page_rows set values = jsonb_set(values, array[%L], ''"Nowy"''::jsonb) where id = %L',
    current_setting('test.f_serwis'), 'a0000000-0000-0000-0000-000000000003'),
  'zmiana samego Serwisu w wierszu ze starym g przechodzi');

-- (15) Przywracanie z kosza: strona nie-systemowa z polem Sekret (stary układ) zostaje w koszu, zwykła wraca.
reset role;
select set_config('rhytm.system_write', 'on', true);
insert into public.pages (id, user_id, title, template_key, deleted_at)
values ('a0000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000c1', 'Stare hasła', 'passwords', now());
insert into public.page_blocks (id, page_id, user_id, type)
values ('a0000000-0000-0000-0000-0000000000b0', 'a0000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000c1', 'table');
insert into public.page_fields (block_id, user_id, name, type, position, is_title)
values
  ('a0000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c1', 'Serwis', 'text', 0, true),
  ('a0000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c1', 'Hasło', 'secret', 1, false);
select set_config('rhytm.system_write', 'off', true);
set local role authenticated;

select throws_ok(
  $$update public.pages set deleted_at = null where id = 'a0000000-0000-0000-0000-0000000000f0'$$,
  'P0001', 'Strony z polem Sekret nie można przywrócić poza modułem Hasła', 'przywrócenie strony z Sekretem odrzucone');
select lives_ok(
  format('update public.pages set deleted_at = now() where id = %L', current_setting('test.reg')),
  'zwykła strona trafia do kosza');
select lives_ok(
  format('update public.pages set deleted_at = null where id = %L', current_setting('test.reg')),
  'zwykła strona wraca z kosza');
select ok((select p.deleted_at is not null from public.pages as p where p.id = 'a0000000-0000-0000-0000-0000000000f0'),
  'strona z Sekretem dalej w koszu');

-- Cudzy user_id albo cudzy blok: zawsze ten sam błąd, niezależnie od stanu sejfu i bloku ofiary.
select throws_ok(
  format('insert into public.page_rows (block_id, user_id, values) values (%L, %L, jsonb_build_object(%L, %L::jsonb))',
    current_setting('test.sys_block'), '00000000-0000-0000-0000-0000000000c2', current_setting('test.f_haslo'), current_setting('test.g1')),
  '42501', 'Brak dostępu do wiersza', 'cudzy user_id przy aktywnym sejfie ofiary: wspólny błąd');
select throws_ok(
  format('insert into public.page_rows (block_id, values) values (%L, jsonb_build_object(%L, ''jawne''))',
    current_setting('test.v_block'), current_setting('test.f_haslo')),
  '42501', 'Brak dostępu do wiersza', 'cudzy blok Haseł: wspólny błąd, bez zdradzania pól');
select throws_ok(
  format('update public.page_rows set block_id = %L where id = %L',
    current_setting('test.v_block'), 'a0000000-0000-0000-0000-000000000003'),
  '42501', 'Brak dostępu do wiersza', 'przeniesienie do cudzego bloku: wspólny błąd');

reset role;
update public.vaults set status = 'reset', generation = 5 where user_id = '00000000-0000-0000-0000-0000000000c2';
set local role authenticated;
select throws_ok(
  format('insert into public.page_rows (block_id, user_id, values) values (%L, %L, jsonb_build_object(%L, %L::jsonb))',
    current_setting('test.sys_block'), '00000000-0000-0000-0000-0000000000c2', current_setting('test.f_haslo'), current_setting('test.g1')),
  '42501', 'Brak dostępu do wiersza', 'cudzy user_id przy sejfie ofiary po resecie: ten sam błąd');
select throws_ok(
  format('insert into public.page_rows (block_id, user_id, values) values (%L, %L, %L::jsonb)',
    current_setting('test.sys_block'), '00000000-0000-0000-0000-0000000000c2', '{}'),
  '42501', 'Brak dostępu do wiersza', 'cudzy user_id bez sekretu: ten sam błąd');

select * from finish();
rollback;
