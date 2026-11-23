begin;
select plan(57);

-- Użytkownicy A i B (profile tworzy trigger po rejestracji).
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl');

update public.profiles set pending_pages = '{Subscriptions,Books}', onboarded_at = now()
where user_id = '00000000-0000-0000-0000-00000000000a';
-- B jeszcze w kreatorze: claim nie może zdjąć nazw przed końcem onboardingu.
update public.profiles set pending_pages = '{Books}', onboarded_at = null
where user_id = '00000000-0000-0000-0000-00000000000b';

-- Uprawnienia i funkcje.
select ok(has_table_privilege('authenticated', 'public.pages', 'SELECT, INSERT, UPDATE, DELETE'), 'authenticated zarządza pages');
select ok(has_table_privilege('authenticated', 'public.page_blocks', 'SELECT, INSERT, UPDATE, DELETE'), 'authenticated zarządza page_blocks');
select ok(has_table_privilege('authenticated', 'public.page_fields', 'SELECT, INSERT, UPDATE, DELETE'), 'authenticated zarządza page_fields');
select ok(has_table_privilege('authenticated', 'public.page_rows', 'SELECT, INSERT, UPDATE, DELETE'), 'authenticated zarządza page_rows');
select ok(not has_table_privilege('anon', 'public.pages', 'select'), 'anon nie czyta pages');
select ok(not has_table_privilege('anon', 'public.page_blocks', 'select'), 'anon nie czyta page_blocks');
select ok(not has_table_privilege('anon', 'public.page_fields', 'select'), 'anon nie czyta page_fields');
select ok(not has_table_privilege('anon', 'public.page_rows', 'select'), 'anon nie czyta page_rows');
select has_function('public', 'purge_trash', 'istnieje purge_trash');
select is(has_function_privilege('authenticated', 'public.purge_trash()', 'execute'), false,
  'authenticated nie wykonuje purge_trash');
select ok(has_function_privilege('authenticated', 'public.move_page(uuid[], uuid, boolean)', 'execute'),
  'authenticated wykonuje move_page');
select is(has_function_privilege('anon', 'public.move_page(uuid[], uuid, boolean)', 'execute'), false,
  'anon nie wykonuje move_page');

-- Od teraz jako zalogowany A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select set_config('test.page_a', public.create_page('Books', '', 'books',
  '[{"type":"table","content":{"name":"","settings":{}},"fields":[{"name":"Tytuł","type":"text","config":{},"is_title":true}],"rows":[{"values":{}}]}]'::jsonb)::text, true);

select is((select count(*) from public.pages where id = current_setting('test.page_a')::uuid), 1::bigint, 'create_page tworzy stronę');
select is((select count(*) from public.page_blocks where page_id = current_setting('test.page_a')::uuid), 1::bigint, 'create_page tworzy blok');
select is((select count(*) from public.page_fields as f join public.page_blocks as b on b.id = f.block_id
  where b.page_id = current_setting('test.page_a')::uuid), 1::bigint, 'create_page tworzy pole');
select is((select count(*) from public.page_rows as r join public.page_blocks as b on b.id = r.block_id
  where b.page_id = current_setting('test.page_a')::uuid
    and r.user_id = '00000000-0000-0000-0000-00000000000a'), 1::bigint, 'create_page tworzy wiersz z user_id A');

-- Id z klienta: blok i pole z podanym id, ustawienia wskazują to pole.
select public.create_page('Z id', '', null,
  '[{"id":"b1000000-0000-0000-0000-00000000000a","type":"table","content":{"settings":{"sort":[{"field_id":"f1000000-0000-0000-0000-00000000000a","dir":"asc"}]}},"fields":[{"id":"f1000000-0000-0000-0000-00000000000a","name":"Nazwa","type":"text","config":{},"is_title":true}],"rows":[]}]'::jsonb);
select is((select count(*) from public.page_fields where id = 'f1000000-0000-0000-0000-00000000000a'), 1::bigint,
  'create_page używa id pola z klienta');

-- Pozycja: druga strona trafia za pierwszą.
select is((select position from public.pages where title = 'Z id'), 1, 'nowa strona na końcu listy');

-- Wiersz z wartością do testów duplikatu i zmiany typu.
select set_config('test.block_a', (select id::text from public.page_blocks where page_id = current_setting('test.page_a')::uuid), true);
select set_config('test.field_a', (select id::text from public.page_fields where block_id = current_setting('test.block_a')::uuid), true);
select set_config('test.row_a', (select id::text from public.page_rows where block_id = current_setting('test.block_a')::uuid), true);
update public.page_rows set values = jsonb_build_object(current_setting('test.field_a'), 'Dune') where id = current_setting('test.row_a')::uuid;
update public.page_blocks
set content = jsonb_build_object('settings', jsonb_build_object('hidden_field_ids', jsonb_build_array(current_setting('test.field_a'))))
where id = current_setting('test.block_a')::uuid;

-- claim_pending_pages
select is(public.claim_pending_pages(array['Books', 'Projects', 'Websites']), '{Books}'::text[], 'claim zwraca część wspólną');
select is((select pending_pages from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  '{Subscriptions}'::text[], 'profil zachowuje resztę');
select is(public.claim_pending_pages(array['Books', 'Projects', 'Websites']), '{}'::text[], 'drugie wywołanie zwraca pustą tablicę');

-- duplicate_page
select set_config('test.page_copy', public.duplicate_page(current_setting('test.page_a')::uuid)::text, true);
select is((select title from public.pages where id = current_setting('test.page_copy')::uuid), 'Books (kopia)', 'kopia ma tytuł z dopiskiem');
select is((select position from public.pages where id = current_setting('test.page_copy')::uuid), 1, 'kopia zaraz za oryginałem');
select is((select position from public.pages where title = 'Z id'), 2, 'późniejsza strona przesunięta o 1');
select ok((select r.values ? f.id::text
  from public.page_rows as r
  join public.page_blocks as b on b.id = r.block_id
  join public.page_fields as f on f.block_id = b.id
  where b.page_id = current_setting('test.page_copy')::uuid), 'values kopii używają id nowego pola');
select ok((select not (r.values ? current_setting('test.field_a'))
  from public.page_rows as r
  join public.page_blocks as b on b.id = r.block_id
  where b.page_id = current_setting('test.page_copy')::uuid), 'values kopii nie mają starego id pola');
select ok((select b.content::text like '%' || f.id::text || '%' and b.content::text not like '%' || current_setting('test.field_a') || '%'
  from public.page_blocks as b
  join public.page_fields as f on f.block_id = b.id
  where b.page_id = current_setting('test.page_copy')::uuid), 'ustawienia bloku kopii wskazują nowe pole');

-- Drugie pole (nie tytułowe) do testów zmiany typu i usuwania.
select set_config('test.field_b', gen_random_uuid()::text, true);
insert into public.page_fields (id, block_id, name, type, position, is_title)
values (current_setting('test.field_b')::uuid, current_setting('test.block_a')::uuid, 'Cena', 'text', 1, false);
update public.page_rows
set values = jsonb_build_object(current_setting('test.field_a'), 'Dune', current_setting('test.field_b'), 'abc')
where id = current_setting('test.row_a')::uuid;

-- Wiersz w koszu (klient go nie widzi) i żywy wiersz spoza p_values z wartością pola Cena.
select set_config('test.row_trash', gen_random_uuid()::text, true);
select set_config('test.row_live', gen_random_uuid()::text, true);
insert into public.page_rows (id, block_id, values, position, deleted_at)
values
  (current_setting('test.row_trash')::uuid, current_setting('test.block_a')::uuid,
    jsonb_build_object(current_setting('test.field_b'), 'xyz'), 5, now()),
  (current_setting('test.row_live')::uuid, current_setting('test.block_a')::uuid,
    jsonb_build_object(current_setting('test.field_b'), 'zostaje'), 6, null);

-- change_field_type
select throws_ok(
  format('select public.change_field_type(%L, ''number'', ''{}''::jsonb, ''{}''::jsonb)', current_setting('test.field_a')),
  'P0001', null, 'change_field_type odrzuca pole tytułowe');
select public.change_field_type(current_setting('test.field_b')::uuid, 'number', '{}'::jsonb,
  jsonb_build_object(current_setting('test.row_a'), 5));
select is((select type from public.page_fields where id = current_setting('test.field_b')::uuid), 'number', 'typ pola zmieniony');
select is((select r.values ->> current_setting('test.field_b') from public.page_rows as r where r.id = current_setting('test.row_a')::uuid),
  '5', 'wartość przeliczona');
select ok((select not (r.values ? current_setting('test.field_b')) from public.page_rows as r
  where r.id = current_setting('test.row_trash')::uuid), 'change_field_type usuwa klucz pola z wiersza w koszu spoza p_values');
select is((select r.values ->> current_setting('test.field_b') from public.page_rows as r
  where r.id = current_setting('test.row_live')::uuid), 'zostaje', 'change_field_type nie rusza żywego wiersza spoza p_values');
select public.change_field_type(current_setting('test.field_b')::uuid, 'text', '{}'::jsonb,
  jsonb_build_object(current_setting('test.row_a'), null));
select ok((select not (r.values ? current_setting('test.field_b')) from public.page_rows as r where r.id = current_setting('test.row_a')::uuid),
  'null usuwa klucz z values');

-- delete_field: klucz z wartością null w values i odwołania w ustawieniach znikają razem z polem
update public.page_rows
set values = jsonb_build_object(current_setting('test.field_a'), 'Dune', current_setting('test.field_b'), null)
where id = current_setting('test.row_a')::uuid;
update public.page_blocks
set content = jsonb_build_object('settings', jsonb_build_object(
  'sort', jsonb_build_array(jsonb_build_object('field_id', current_setting('test.field_b'), 'dir', 'asc'),
                            jsonb_build_object('field_id', current_setting('test.field_a'), 'dir', 'asc')),
  'filters', jsonb_build_array(jsonb_build_object('field_id', current_setting('test.field_b'), 'op', 'empty')),
  'hidden_field_ids', jsonb_build_array(current_setting('test.field_b')),
  'column_summaries', jsonb_build_object(current_setting('test.field_b'), jsonb_build_object('kind', 'sum')),
  'pinned_cards', jsonb_build_array(jsonb_build_object('label', 'X', 'field_id', current_setting('test.field_a'),
    'aggregation', 'avg', 'date_field_id', current_setting('test.field_b')))))
where id = current_setting('test.block_a')::uuid;
select throws_ok(
  format('select public.delete_field(%L)', current_setting('test.field_a')),
  'P0001', null, 'delete_field odrzuca pole tytułowe');
select public.delete_field(current_setting('test.field_b')::uuid);
select is((select count(*) from public.page_fields where id = current_setting('test.field_b')::uuid), 0::bigint, 'delete_field usuwa pole');
select ok((select not (r.values ? current_setting('test.field_b')) from public.page_rows as r where r.id = current_setting('test.row_a')::uuid),
  'delete_field usuwa klucz (także null) z values');
select ok((select b.content::text not like '%' || current_setting('test.field_b') || '%' from public.page_blocks as b
  where b.id = current_setting('test.block_a')::uuid), 'delete_field czyści ustawienia bloku');
select is((select jsonb_array_length(b.content -> 'settings' -> 'sort') from public.page_blocks as b
  where b.id = current_setting('test.block_a')::uuid), 1, 'delete_field zostawia sort po innym polu');

-- duplicate_page strony bez tytułu
select set_config('test.page_blank', public.create_page('', '', null, '[]'::jsonb)::text, true);
select set_config('test.page_blank_copy', public.duplicate_page(current_setting('test.page_blank')::uuid)::text, true);
select is((select title from public.pages where id = current_setting('test.page_blank_copy')::uuid),
  'Bez tytułu (kopia)', 'kopia strony bez tytułu to „Bez tytułu (kopia)”');

-- move_page: ulubione i kolejność naraz (oryginał Books ląduje za kopią i w ulubionych)
select public.move_page(
  array[current_setting('test.page_copy')::uuid, current_setting('test.page_a')::uuid],
  current_setting('test.page_a')::uuid, true);
select is((select p.favorite from public.pages as p where p.id = current_setting('test.page_a')::uuid), true,
  'move_page ustawia ulubione');
select is((select array_agg(p.id order by p.position) from public.pages as p
  where p.id in (current_setting('test.page_a')::uuid, current_setting('test.page_copy')::uuid)),
  array[current_setting('test.page_copy')::uuid, current_setting('test.page_a')::uuid],
  'move_page zmienia kolejność');

-- Od teraz jako zalogowany B.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(public.claim_pending_pages(array['Books', 'Projects', 'Websites']), '{}'::text[],
  'claim przed końcem onboardingu zwraca pustą tablicę');
select is((select pending_pages from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b'),
  '{Books}'::text[], 'claim przed końcem onboardingu nie zmienia pending_pages');

select is((select count(*) from public.pages), 0::bigint, 'B nie widzi stron A');

with upd as (update public.pages set title = 'hack' where id = current_setting('test.page_a')::uuid returning 1)
select is((select count(*) from upd), 0::bigint, 'B nie zmienia strony A');
with del as (delete from public.pages where id = current_setting('test.page_a')::uuid returning 1)
select is((select count(*) from del), 0::bigint, 'B nie usuwa strony A');
select public.move_page(array[current_setting('test.page_a')::uuid], current_setting('test.page_a')::uuid, false);

select throws_ok(
  format('insert into public.page_blocks (page_id, type) values (%L, ''text'')', current_setting('test.page_a')),
  '42501', null, 'B nie dodaje bloku do strony A');
select throws_ok(
  format('insert into public.page_rows (block_id) values (%L)', current_setting('test.block_a')),
  '42501', null, 'B nie dodaje wiersza do bloku A');

-- Czyszczenie kosza jako postgres.
reset role;

-- Ikona: nowa strona bez podanej ikony ma pustą (domyślna tabela w aplikacji).
insert into public.pages (id, user_id, title)
values ('d3000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'bez ikony');
select is((select p.icon from public.pages as p where p.id = 'd3000000-0000-0000-0000-00000000000a'), '',
  'domyślna ikona strony to pusty tekst');
select lives_ok(
  format('update public.pages set icon = %L where id = %L', 'lucide:' || repeat('x', 57), 'd3000000-0000-0000-0000-00000000000a'),
  'ikona 64 znaki przechodzi');
select throws_ok(
  format('update public.pages set icon = %L where id = %L', 'lucide:' || repeat('x', 58), 'd3000000-0000-0000-0000-00000000000a'),
  '23514', null, 'ikona dłuższa niż 64 znaki odrzucona');
-- move_page wołane przez B nie zmieniło strony A (RLS)
select is((select p.favorite from public.pages as p where p.id = current_setting('test.page_a')::uuid), true,
  'B nie zmienia ulubionych strony A przez move_page');

insert into public.pages (id, user_id, title, deleted_at)
values
  ('d1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'stara', now() - interval '31 days'),
  ('d2000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'świeża', now() - interval '29 days');
select public.purge_trash();
select is((select count(*) from public.pages where id in ('d1000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-00000000000a')),
  1::bigint, 'purge_trash usuwa tylko strony starsze niż 30 dni');

-- Ikony stron: constraint pages_icon_format (migracja 20261123100000); funkcja page_icon_lucide usunięta (20261124100000).
select hasnt_function('public', 'page_icon_lucide', ARRAY['text'], 'page_icon_lucide usunięta po konwersji ikon');
select throws_ok(
  format('update public.pages set icon = %L where id = %L', '📚', 'd3000000-0000-0000-0000-00000000000a'),
  '23514', null, 'emoji odrzucone przez pages_icon_format');
select lives_ok(
  format('update public.pages set icon = %L where id = %L', 'lucide:rocket', 'd3000000-0000-0000-0000-00000000000a'),
  'lucide:<nazwa> przyjęte');
-- create_page bez ikony zostawia pustą (jako zalogowany A)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
-- Strona powstaje w osobnym zapytaniu (jak wyżej), bo snapshot zapytania nie widzi wiersza dodanego przez funkcję w tym samym zapytaniu.
select set_config('test.page_no_icon', public.create_page('X', null, null, '[]'::jsonb)::text, true);
select is((select p.icon from public.pages as p where p.id = current_setting('test.page_no_icon')::uuid), '',
  'create_page bez ikony → pusta');
reset role;

select * from finish();
rollback;
