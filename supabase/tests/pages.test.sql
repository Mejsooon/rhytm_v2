begin;
select plan(34);

-- Użytkownicy A i B (profile tworzy trigger po rejestracji).
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl');

update public.profiles set pending_pages = '{Subscriptions,Books}'
where user_id = '00000000-0000-0000-0000-00000000000a';

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

-- Od teraz jako zalogowany A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select set_config('test.page_a', public.create_page('Books', '▦', 'books',
  '[{"type":"table","content":{"name":"","settings":{}},"fields":[{"name":"Tytuł","type":"text","config":{},"is_title":true}],"rows":[{"values":{}}]}]'::jsonb)::text, true);

select is((select count(*) from public.pages where id = current_setting('test.page_a')::uuid), 1::bigint, 'create_page tworzy stronę');
select is((select count(*) from public.page_blocks where page_id = current_setting('test.page_a')::uuid), 1::bigint, 'create_page tworzy blok');
select is((select count(*) from public.page_fields as f join public.page_blocks as b on b.id = f.block_id
  where b.page_id = current_setting('test.page_a')::uuid), 1::bigint, 'create_page tworzy pole');
select is((select count(*) from public.page_rows as r join public.page_blocks as b on b.id = r.block_id
  where b.page_id = current_setting('test.page_a')::uuid
    and r.user_id = '00000000-0000-0000-0000-00000000000a'), 1::bigint, 'create_page tworzy wiersz z user_id A');

-- Id z klienta: blok i pole z podanym id, ustawienia wskazują to pole.
select public.create_page('Z id', '▦', null,
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

-- change_field_type
select public.change_field_type(current_setting('test.field_a')::uuid, 'number', '{}'::jsonb,
  jsonb_build_object(current_setting('test.row_a'), 5));
select is((select type from public.page_fields where id = current_setting('test.field_a')::uuid), 'number', 'typ pola zmieniony');
select is((select r.values ->> current_setting('test.field_a') from public.page_rows as r where r.id = current_setting('test.row_a')::uuid),
  '5', 'wartość przeliczona');
select public.change_field_type(current_setting('test.field_a')::uuid, 'text', '{}'::jsonb,
  jsonb_build_object(current_setting('test.row_a'), null));
select ok((select not (r.values ? current_setting('test.field_a')) from public.page_rows as r where r.id = current_setting('test.row_a')::uuid),
  'null usuwa klucz z values');

-- Od teraz jako zalogowany B.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is((select count(*) from public.pages), 0::bigint, 'B nie widzi stron A');

with upd as (update public.pages set title = 'hack' where id = current_setting('test.page_a')::uuid returning 1)
select is((select count(*) from upd), 0::bigint, 'B nie zmienia strony A');
with del as (delete from public.pages where id = current_setting('test.page_a')::uuid returning 1)
select is((select count(*) from del), 0::bigint, 'B nie usuwa strony A');

select throws_ok(
  format('insert into public.page_blocks (page_id, type) values (%L, ''text'')', current_setting('test.page_a')),
  '42501', null, 'B nie dodaje bloku do strony A');
select throws_ok(
  format('insert into public.page_rows (block_id) values (%L)', current_setting('test.block_a')),
  '42501', null, 'B nie dodaje wiersza do bloku A');

-- Czyszczenie kosza jako postgres.
reset role;
insert into public.pages (id, user_id, title, deleted_at)
values
  ('d1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'stara', now() - interval '31 days'),
  ('d2000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'świeża', now() - interval '29 days');
select public.purge_trash();
select is((select count(*) from public.pages where id in ('d1000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-00000000000a')),
  1::bigint, 'purge_trash usuwa tylko strony starsze niż 30 dni');

select * from finish();
rollback;
