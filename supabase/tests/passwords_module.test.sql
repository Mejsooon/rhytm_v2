begin;
select plan(72);

-- Użytkownicy: C (strona systemowa przez ensure), D (pasujący stary układ), E (inny układ), F (dwie strony), G (bez stron).
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000c', 'c@test.pl'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.pl'),
  ('00000000-0000-0000-0000-00000000000e', 'e@test.pl'),
  ('00000000-0000-0000-0000-00000000000f', 'f@test.pl'),
  ('00000000-0000-0000-0000-0000000000a9', 'g@test.pl');

-- Schemat i uprawnienia.
select has_column('public', 'pages', 'is_system', 'pages.is_system istnieje');
select ok((select c.column_default = 'false' and c.is_nullable = 'NO' from information_schema.columns as c
  where c.table_schema = 'public' and c.table_name = 'pages' and c.column_name = 'is_system'), 'is_system not null, domyślnie false');
select ok((select i.indexdef like 'CREATE UNIQUE INDEX%WHERE is_system' from pg_indexes as i
  where i.schemaname = 'public' and i.indexname = 'pages_one_system_per_user'), 'unikalny indeks jednej strony systemowej na użytkownika');
select ok(has_function_privilege('authenticated', 'public.ensure_passwords_page()', 'execute'),
  'authenticated wykonuje ensure_passwords_page');
select is(has_function_privilege('anon', 'public.ensure_passwords_page()', 'execute'), false,
  'anon nie wykonuje ensure_passwords_page');
select is(has_function_privilege('authenticated', 'public.adopt_passwords_page(uuid)', 'execute'), false,
  'authenticated nie wykonuje adopt_passwords_page');
select hasnt_function('public', 'page_fields_secret_type_guard', ARRAY[]::text[], 'stary strażnik typu Sekret usunięty');

-- Od teraz jako zalogowany C.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

-- ensure_passwords_page: dwa wywołania, ta sama strona.
select set_config('test.sys', public.ensure_passwords_page()::text, true);
select is(public.ensure_passwords_page(), current_setting('test.sys')::uuid, 'drugie ensure zwraca to samo id');
select is((select count(*) from public.pages where is_system), 1::bigint, 'jedna strona systemowa');
select ok((select p.is_system and p.title = 'Hasła' and p.icon = 'lucide:lock' and p.template_key = 'passwords'
  and p.deleted_at is null from public.pages as p where p.id = current_setting('test.sys')::uuid),
  'strona systemowa: Hasła, lucide:lock, passwords');
select set_config('test.sys_block', (select b.id::text from public.page_blocks as b where b.page_id = current_setting('test.sys')::uuid), true);
select is((select b.content from public.page_blocks as b where b.id = current_setting('test.sys_block')::uuid),
  '{"name":"","settings":{"sort":[],"filters":[],"hidden_field_ids":[],"column_summaries":{},"pinned_cards":[],"column_widths":{}}}'::jsonb,
  'blok tabeli z pustymi ustawieniami');
select is((select array_agg(f.name || ':' || f.type order by f.position) from public.page_fields as f
  where f.block_id = current_setting('test.sys_block')::uuid),
  array['Serwis:text', 'Login:text', 'Hasło:secret', 'URL:url', 'Kategoria:select', 'Notatka:secret'],
  '6 stałych kolumn w kolejności');
select is((select array_agg(f.position order by f.position) from public.page_fields as f
  where f.block_id = current_setting('test.sys_block')::uuid), array[0, 1, 2, 3, 4, 5], 'pozycje 0–5');
select is((select f.name from public.page_fields as f where f.block_id = current_setting('test.sys_block')::uuid and f.is_title),
  'Serwis', 'tytułem jest Serwis');
select is((select f.config from public.page_fields as f where f.block_id = current_setting('test.sys_block')::uuid and f.name = 'Serwis'),
  '{"empty_label":"Bez nazwy"}'::jsonb, 'Serwis z empty_label „Bez nazwy”');
select is((select f.config from public.page_fields as f where f.block_id = current_setting('test.sys_block')::uuid and f.name = 'Kategoria'),
  '{"options":[]}'::jsonb, 'Kategoria bez opcji');

select set_config('test.f_haslo', (select f.id::text from public.page_fields as f
  where f.block_id = current_setting('test.sys_block')::uuid and f.name = 'Hasło'), true);
select set_config('test.f_kat', (select f.id::text from public.page_fields as f
  where f.block_id = current_setting('test.sys_block')::uuid and f.name = 'Kategoria'), true);
select set_config('test.f_notatka', (select f.id::text from public.page_fields as f
  where f.block_id = current_setting('test.sys_block')::uuid and f.name = 'Notatka'), true);

-- Zwykła strona C do testów Sekretu poza modułem.
select set_config('test.reg', public.create_page('Zwykła', '', null,
  '[{"type":"table","content":{"name":"","settings":{}},"fields":[{"name":"Nazwa","type":"text","config":{},"is_title":true},{"name":"Opis","type":"text","config":{}}],"rows":[]}]'::jsonb)::text, true);
select set_config('test.reg_block', (select b.id::text from public.page_blocks as b where b.page_id = current_setting('test.reg')::uuid), true);
select set_config('test.reg_field', (select f.id::text from public.page_fields as f
  where f.block_id = current_setting('test.reg_block')::uuid and not f.is_title), true);

-- Sekret tylko w module.
select throws_ok(
  format('insert into public.page_fields (block_id, name, type) values (%L, ''X'', ''secret'')', current_setting('test.reg_block')),
  'P0001', 'Pole Sekret jest dostępne tylko w module Hasła', 'pole Sekret na zwykłej stronie odrzucone');
select throws_ok(
  $$select public.create_page('S', '', null, '[{"type":"table","content":{},"fields":[{"name":"T","type":"text","is_title":true},{"name":"H","type":"secret"}],"rows":[]}]'::jsonb)$$,
  'P0001', 'Pole Sekret jest dostępne tylko w module Hasła', 'create_page z polem Sekret odrzucone');
select throws_ok(
  format('update public.page_fields set type = ''secret'' where id = %L', current_setting('test.reg_field')),
  'P0001', 'Nie można zmienić typu pola Sekret', 'zmiana typu na Sekret odrzucona');
select throws_ok(
  format('select public.change_field_type(%L, ''secret'', ''{}''::jsonb, ''{}''::jsonb)', current_setting('test.reg_field')),
  'P0001', 'Nie można zmienić typu pola Sekret', 'change_field_type na Sekret odrzucone');

-- Kolumny modułu są stałe.
select throws_ok(
  format('insert into public.page_fields (block_id, name, type) values (%L, ''Nowa'', ''text'')', current_setting('test.sys_block')),
  'P0001', 'Kolumn modułu Hasła nie można dodawać', 'dodanie kolumny do modułu odrzucone');
select throws_ok(
  format('delete from public.page_fields where id = %L', current_setting('test.f_haslo')),
  'P0001', 'Kolumn modułu Hasła nie można usuwać', 'usunięcie kolumny Hasło odrzucone');
select throws_ok(
  format('select public.delete_field(%L)', current_setting('test.f_haslo')),
  'P0001', 'Kolumn modułu Hasła nie można usuwać', 'delete_field na kolumnie Hasło odrzucone');
select throws_ok(
  format('update public.page_fields set type = ''text'' where id = %L', current_setting('test.f_kat')),
  'P0001', 'Kolumny modułu Hasła są stałe: można zmienić tylko ich ustawienia', 'zmiana typu Kategorii odrzucona');
select throws_ok(
  format('select public.change_field_type(%L, ''text'', ''{}''::jsonb, ''{}''::jsonb)', current_setting('test.f_kat')),
  'P0001', 'Kolumny modułu Hasła są stałe: można zmienić tylko ich ustawienia', 'change_field_type Kategorii odrzucone');
select throws_ok(
  format('update public.page_fields set name = ''Grupa'' where id = %L', current_setting('test.f_kat')),
  'P0001', 'Kolumny modułu Hasła są stałe: można zmienić tylko ich ustawienia', 'zmiana nazwy Kategorii odrzucona');
select throws_ok(
  format('update public.page_fields set position = 0 where id = %L', current_setting('test.f_kat')),
  'P0001', 'Kolumny modułu Hasła są stałe: można zmienić tylko ich ustawienia', 'zmiana pozycji Kategorii odrzucona');
select throws_ok(
  format('select public.reorder_fields(%L, array(select f.id from public.page_fields as f where f.block_id = %L order by f.position desc))',
    current_setting('test.sys_block'), current_setting('test.sys_block')),
  'P0001', 'Kolumny modułu Hasła są stałe: można zmienić tylko ich ustawienia', 'reorder_fields w module odrzucone');
-- Pola nie wyjdą ze strony modułu ani do niej nie wejdą; id i tytuł są stałe.
select throws_ok(
  format('update public.page_fields set block_id = %L where id = %L', current_setting('test.reg_block'), current_setting('test.f_haslo')),
  'P0001', 'Kolumny modułu Hasła są stałe: można zmienić tylko ich ustawienia', 'przeniesienie pola Hasło na zwykłą stronę odrzucone');
select throws_ok(
  format('update public.page_fields set block_id = %L where id = %L', current_setting('test.sys_block'), current_setting('test.reg_field')),
  'P0001', 'Kolumny modułu Hasła są stałe: można zmienić tylko ich ustawienia', 'przeniesienie zwykłego pola do modułu odrzucone');
select throws_ok(
  format('update public.page_fields set is_title = true where id = %L', current_setting('test.f_haslo')),
  'P0001', 'Kolumny modułu Hasła są stałe: można zmienić tylko ich ustawienia', 'zmiana tytułu w module odrzucona');
select throws_ok(
  format('update public.page_fields set id = gen_random_uuid() where id = %L', current_setting('test.f_haslo')),
  'P0001', 'Kolumny modułu Hasła są stałe: można zmienić tylko ich ustawienia', 'zmiana id pola Hasło odrzucona');
select lives_ok(
  format('update public.page_fields set config = ''{"options":[{"id":"o1","label":"Praca","color":"blue"}]}''::jsonb where id = %L',
    current_setting('test.f_kat')),
  'zmiana config Kategorii (nowa opcja) przechodzi');
select is((select jsonb_array_length(f.config -> 'options') from public.page_fields as f where f.id = current_setting('test.f_kat')::uuid),
  1, 'Kategoria ma nową opcję');

-- Strona systemowa: stały tytuł, ikona, flaga; nie trafia do kosza i nie znika.
select throws_ok(
  format('update public.pages set deleted_at = now() where id = %L', current_setting('test.sys')),
  'P0001', 'Strony Hasła nie można przemianować, zmienić jej ikony ani przenieść do kosza', 'kosz dla strony systemowej odrzucony');
select throws_ok(
  format('update public.pages set title = ''Inne'' where id = %L', current_setting('test.sys')),
  'P0001', 'Strony Hasła nie można przemianować, zmienić jej ikony ani przenieść do kosza', 'zmiana tytułu odrzucona');
select throws_ok(
  format('update public.pages set icon = ''lucide:key'' where id = %L', current_setting('test.sys')),
  'P0001', 'Strony Hasła nie można przemianować, zmienić jej ikony ani przenieść do kosza', 'zmiana ikony odrzucona');
select throws_ok(
  format('update public.pages set is_system = false where id = %L', current_setting('test.sys')),
  'P0001', 'Flagi strony systemowej nie można zmienić', 'zdjęcie is_system odrzucone');
select throws_ok(
  format('update public.pages set is_system = true where id = %L', current_setting('test.reg')),
  'P0001', 'Flagi strony systemowej nie można zmienić', 'nadanie is_system zwykłej stronie odrzucone');
select throws_ok(
  $$insert into public.pages (title, is_system) values ('Moja', true)$$,
  'P0001', 'Strony systemowej nie można utworzyć ręcznie', 'ręczne wstawienie strony systemowej odrzucone');
select throws_ok(
  format('delete from public.pages where id = %L', current_setting('test.sys')),
  'P0001', 'Strony Hasła nie można usunąć', 'usunięcie strony systemowej odrzucone');
select lives_ok(
  format('update public.pages set favorite = true where id = %L', current_setting('test.sys')),
  'ulubione strony systemowej można zmienić');

-- Blok strony systemowej.
select throws_ok(
  format('insert into public.page_blocks (page_id, type) values (%L, ''text'')', current_setting('test.sys')),
  'P0001', 'Do strony Hasła nie można dodawać bloków', 'dodanie bloku do strony systemowej odrzucone');
select throws_ok(
  format('update public.page_blocks set deleted_at = now() where id = %L', current_setting('test.sys_block')),
  'P0001', 'Bloku strony Hasła nie można usunąć, przenieść ani zmienić jego typu', 'kosz dla bloku modułu odrzucony');
select throws_ok(
  format('delete from public.page_blocks where id = %L', current_setting('test.sys_block')),
  'P0001', 'Bloku strony Hasła nie można usunąć', 'usunięcie bloku modułu odrzucone');
select throws_ok(
  format('update public.page_blocks set page_id = %L where id = %L', current_setting('test.reg'), current_setting('test.sys_block')),
  'P0001', 'Bloku strony Hasła nie można usunąć, przenieść ani zmienić jego typu', 'przeniesienie bloku modułu na zwykłą stronę odrzucone');
select throws_ok(
  format('update public.page_blocks set page_id = %L where id = %L', current_setting('test.sys'), current_setting('test.reg_block')),
  'P0001', 'Bloku strony Hasła nie można usunąć, przenieść ani zmienić jego typu', 'przeniesienie zwykłego bloku na stronę Hasła odrzucone');
-- Cudzy moduł: D nie doda pola ani bloku do strony Hasła użytkownika C (wyzwalacz albo RLS).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok(
  format('insert into public.page_fields (block_id, name, type) values (%L, ''X'', ''secret'')', current_setting('test.sys_block')),
  null, null, 'D nie doda pola Sekret do modułu C');
select throws_ok(
  format('insert into public.page_blocks (page_id, type) values (%L, ''text'')', current_setting('test.sys')),
  null, null, 'D nie doda bloku do strony Hasła C');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok(
  format('update public.page_blocks set content = jsonb_set(content, ''{settings,column_widths}'', ''{"x":120}''::jsonb) where id = %L',
    current_setting('test.sys_block')),
  'ustawienia bloku modułu można zmienić');

-- RPC stron odmawiają dla strony systemowej.
select throws_ok(
  format('select public.duplicate_page(%L)', current_setting('test.sys')),
  'P0001', 'Strony Hasła nie można zduplikować', 'duplicate_page odrzucone');
select throws_ok(
  format('select public.reorder_pages(array[%L, %L]::uuid[])', current_setting('test.reg'), current_setting('test.sys')),
  'P0001', 'Strony Hasła nie można przenosić', 'reorder_pages ze stroną systemową odrzucone');
select throws_ok(
  format('select public.move_page(array[%L]::uuid[], %L, true)', current_setting('test.sys'), current_setting('test.sys')),
  'P0001', 'Strony Hasła nie można przenosić', 'move_page strony systemowej odrzucone');
select lives_ok(
  format('select public.reorder_pages(array[%L]::uuid[])', current_setting('test.reg')),
  'reorder_pages bez strony systemowej przechodzi');

-- Sejf: count_secrets i reset_vault obejmują Notatkę. Strażnik wierszy wymaga aktywnego sejfu i poprawnego kształtu.
insert into public.vaults (user_id, status, generation)
values ('00000000-0000-0000-0000-00000000000c', 'active', 1);
insert into public.page_rows (block_id, values)
values (
  current_setting('test.sys_block')::uuid,
  jsonb_build_object(
    current_setting('test.f_haslo'), '{"v":1,"g":1,"iv":"AAAAAAAAAAAAAAAA","ct":"AAAAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
    current_setting('test.f_notatka'), '{"v":1,"g":1,"iv":"BBBBBBBBBBBBBBBB","ct":"BBBBBBBBBBBBBBBBBBBBBBBB"}'::jsonb
  )
);
select is(public.count_secrets(), 2, 'count_secrets liczy Hasło i Notatkę');
select is(public.reset_vault(), 2, 'reset_vault czyści Hasło i Notatkę');
select is((select jsonb_typeof(r.values -> current_setting('test.f_notatka')) from public.page_rows as r
  where r.block_id = current_setting('test.sys_block')::uuid), 'null', 'Notatka wyzerowana');
select is(public.count_secrets(), 0, 'po resecie brak sekretów');

-- adopt_passwords_page jako postgres. Strony testowe ze starym układem budujemy z wyjątkiem systemowym.
reset role;
select set_config('rhytm.system_write', 'on', true);

-- D: stary układ z innymi nazwami i pozycjami.
insert into public.pages (id, user_id, title, icon, template_key, position)
values ('dd000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'Passwords', '', 'passwords', 0);
insert into public.page_blocks (id, page_id, user_id, type, position, content)
values ('dd000000-0000-0000-0000-0000000000b1', 'dd000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d',
  'table', 0, '{"name":"","settings":{"sort":[]}}'::jsonb);
insert into public.page_fields (id, block_id, user_id, name, type, config, position, is_title)
values
  ('dd000000-0000-0000-0000-0000000000f1', 'dd000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000d', 'Service', 'text', '{}', 0, true),
  ('dd000000-0000-0000-0000-0000000000f2', 'dd000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000d', 'Link', 'url', '{}', 1, false),
  ('dd000000-0000-0000-0000-0000000000f3', 'dd000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000d', 'Username', 'text', '{}', 2, false),
  ('dd000000-0000-0000-0000-0000000000f4', 'dd000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000d', 'Password', 'secret', '{}', 3, false);
insert into public.page_rows (block_id, user_id, values, position)
values
  ('dd000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000d',
    '{"dd000000-0000-0000-0000-0000000000f1":"GitHub","dd000000-0000-0000-0000-0000000000f4":{"v":1,"g":1,"iv":"i1","ct":"c1"}}', 0),
  ('dd000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000d',
    '{"dd000000-0000-0000-0000-0000000000f1":"Bank","dd000000-0000-0000-0000-0000000000f4":{"v":1,"g":1,"iv":"i2","ct":"c2"}}', 1);

-- E: inny układ (3 pola).
insert into public.pages (id, user_id, title, template_key)
values ('ee000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'Passwords', 'passwords');
insert into public.page_blocks (id, page_id, user_id, type)
values ('ee000000-0000-0000-0000-0000000000b1', 'ee000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'table');
insert into public.page_fields (block_id, user_id, name, type, position, is_title)
values
  ('ee000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000e', 'Serwis', 'text', 0, true),
  ('ee000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000e', 'Hasło', 'secret', 1, false),
  ('ee000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000e', 'URL', 'url', 2, false);

-- F: dwie strony Passwords.
insert into public.pages (user_id, title, template_key)
values
  ('00000000-0000-0000-0000-00000000000f', 'Passwords', 'passwords'),
  ('00000000-0000-0000-0000-00000000000f', 'Passwords 2', 'passwords');

select set_config('rhytm.system_write', 'off', true);
select set_config('test.d_values', (select jsonb_agg(r.values order by r.position)::text from public.page_rows as r
  where r.block_id = 'dd000000-0000-0000-0000-0000000000b1'), true);

select is(public.adopt_passwords_page('00000000-0000-0000-0000-00000000000d'), 'dd000000-0000-0000-0000-000000000001'::uuid,
  'adopt zwraca id przyjętej strony');
select ok((select p.is_system and p.title = 'Hasła' and p.icon = 'lucide:lock' from public.pages as p
  where p.id = 'dd000000-0000-0000-0000-000000000001'), 'przyjęta strona jest systemowa, Hasła, lucide:lock');
select is((select array_agg(f.name || ':' || f.type order by f.position) from public.page_fields as f
  where f.block_id = 'dd000000-0000-0000-0000-0000000000b1'),
  array['Serwis:text', 'Login:text', 'Hasło:secret', 'URL:url', 'Kategoria:select', 'Notatka:secret'],
  'adopt: 6 kolumn ze stałymi nazwami i kolejnością');
select is((select array_agg(f.id order by f.position) filter (where f.position < 4) from public.page_fields as f
  where f.block_id = 'dd000000-0000-0000-0000-0000000000b1'),
  array['dd000000-0000-0000-0000-0000000000f1', 'dd000000-0000-0000-0000-0000000000f3',
        'dd000000-0000-0000-0000-0000000000f4', 'dd000000-0000-0000-0000-0000000000f2']::uuid[],
  'adopt zachowuje id istniejących kolumn');
select is((select jsonb_agg(r.values order by r.position)::text from public.page_rows as r
  where r.block_id = 'dd000000-0000-0000-0000-0000000000b1'), current_setting('test.d_values'),
  'adopt nie rusza wierszy ani szyfrogramów');
select is((select f.config ->> 'empty_label' from public.page_fields as f where f.id = 'dd000000-0000-0000-0000-0000000000f1'),
  'Bez nazwy', 'adopt dopisuje empty_label Serwisu');
select is(public.adopt_passwords_page('00000000-0000-0000-0000-00000000000d'), 'dd000000-0000-0000-0000-000000000001'::uuid,
  'drugie adopt zwraca tę samą stronę');
select is((select count(*) from public.page_fields as f where f.block_id = 'dd000000-0000-0000-0000-0000000000b1'), 6::bigint,
  'drugie adopt nie dopisuje kolumn');

select throws_like(
  $$select public.adopt_passwords_page('00000000-0000-0000-0000-00000000000e')$$,
  '%inny układ kolumn%', 'adopt odrzuca inny układ kolumn');
select ok((select not p.is_system and p.title = 'Passwords'
  and (select count(*) from public.page_fields as f where f.block_id = 'ee000000-0000-0000-0000-0000000000b1') = 3
  from public.pages as p where p.id = 'ee000000-0000-0000-0000-000000000001'), 'po odrzuceniu strona E bez zmian');
select throws_like(
  $$select public.adopt_passwords_page('00000000-0000-0000-0000-00000000000f')$$,
  '%2 stron Passwords%', 'adopt odrzuca dwie strony Passwords');
select is(public.adopt_passwords_page('00000000-0000-0000-0000-0000000000a9'), null::uuid, 'adopt bez strony zwraca null');

-- Usunięcie konta kasuje stronę systemową kaskadą.
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-00000000000c'$$,
  'usunięcie konta ze stroną systemową przechodzi');
select is((select count(*) from public.pages as p where p.user_id = '00000000-0000-0000-0000-00000000000c'), 0::bigint,
  'strony usuniętego konta znikają');

select * from finish();
rollback;
