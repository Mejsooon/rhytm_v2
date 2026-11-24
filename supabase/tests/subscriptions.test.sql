begin;
select plan(22);

-- Użytkownicy A i B.
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.pl'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.pl');

-- Od teraz jako zalogowany A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1. Nowe typy pól przechodzą, nieznany typ (formula) daje błąd constraintu 23514, Sekret poza modułem dalej blokuje strażnik.
select set_config('test.plain', public.create_page('Zwykła', '', null,
  '[{"type":"table","content":{"name":"","settings":{}},"fields":[{"name":"Nazwa","type":"text","config":{},"is_title":true}],"rows":[]}]'::jsonb)::text, true);
select set_config('test.plain_block', (select b.id::text from public.page_blocks as b where b.page_id = current_setting('test.plain')::uuid), true);

select lives_ok(
  format('insert into public.page_fields (block_id, name, type, position) values (%L, ''Kwota'', ''recurring'', 1)', current_setting('test.plain_block')),
  'pole recurring przechodzi');
select lives_ok(
  format('insert into public.page_fields (block_id, name, type, position) values (%L, ''Odnowienie'', ''renewal'', 2)', current_setting('test.plain_block')),
  'pole renewal przechodzi');
select throws_ok(
  format('insert into public.page_fields (block_id, name, type, position) values (%L, ''Wzór'', ''formula'', 3)', current_setting('test.plain_block')),
  '23514', null, 'pole formula odrzucone przez constraint typu');
-- 2. Sekret poza stroną systemową dalej jest blokowany (strażnik page_fields_guard).
select throws_ok(
  format('insert into public.page_fields (block_id, name, type, position) values (%L, ''Tajne'', ''secret'', 4)', current_setting('test.plain_block')),
  'P0001', 'Pole Sekret jest dostępne tylko w module Hasła', 'Sekret poza modułem Haseł nadal zablokowany');

-- 3. Strona Subscriptions z polami recurring i renewal wskazującymi pola z p_blocks (id z klienta).
select set_config('test.sub', public.create_page('Subscriptions', 'lucide:wallet', 'subscriptions',
  '[{"id":"b2000000-0000-0000-0000-00000000000a","type":"table","content":{"name":"","settings":{"sort":[{"field_id":"f2000000-0000-0000-0000-000000000002","dir":"asc"}]}},
     "fields":[
       {"id":"f2000000-0000-0000-0000-000000000001","name":"Nazwa","type":"text","config":{},"is_title":true},
       {"id":"f2000000-0000-0000-0000-000000000002","name":"Kwota cykliczna","type":"recurring","config":{}},
       {"id":"f2000000-0000-0000-0000-000000000003","name":"Data odnowienia","type":"renewal","config":{"cycle_field_id":"f2000000-0000-0000-0000-000000000002","active_field_id":"f2000000-0000-0000-0000-000000000004"}},
       {"id":"f2000000-0000-0000-0000-000000000004","name":"Aktywna","type":"checkbox","config":{}}
     ],
     "rows":[{"values":{"f2000000-0000-0000-0000-000000000001":"Netflix","f2000000-0000-0000-0000-000000000002":{"amount":49.99,"cycle":"monthly"},"f2000000-0000-0000-0000-000000000003":"2026-12-01","f2000000-0000-0000-0000-000000000004":true}}]}]'::jsonb)::text, true);

select is((select count(*) from public.pages as p where p.id = current_setting('test.sub')::uuid and p.template_key = 'subscriptions'
  and p.icon = 'lucide:wallet'), 1::bigint, 'create_page tworzy stronę Subscriptions');
select is((select count(*) from public.page_fields as f where f.block_id = 'b2000000-0000-0000-0000-00000000000a'), 4::bigint,
  'strona Subscriptions ma 4 pola');
select is((select f.type from public.page_fields as f where f.id = 'f2000000-0000-0000-0000-000000000003'), 'renewal',
  'pole Data odnowienia ma typ renewal');

-- 4. duplicate_page: odwołania w config i klucze w values wskazują pola kopii, nie oryginału.
select set_config('test.sub_copy', public.duplicate_page(current_setting('test.sub')::uuid)::text, true);
select set_config('test.copy_block', (select b.id::text from public.page_blocks as b where b.page_id = current_setting('test.sub_copy')::uuid), true);
select set_config('test.copy_recurring', (select f.id::text from public.page_fields as f
  where f.block_id = current_setting('test.copy_block')::uuid and f.type = 'recurring'), true);
select set_config('test.copy_checkbox', (select f.id::text from public.page_fields as f
  where f.block_id = current_setting('test.copy_block')::uuid and f.type = 'checkbox'), true);
select set_config('test.copy_renewal', (select f.id::text from public.page_fields as f
  where f.block_id = current_setting('test.copy_block')::uuid and f.type = 'renewal'), true);

select is((select count(*) from public.page_fields as f where f.block_id = current_setting('test.copy_block')::uuid), 4::bigint,
  'kopia ma 4 pola');
select is((select f.config ->> 'cycle_field_id' from public.page_fields as f where f.id = current_setting('test.copy_renewal')::uuid),
  current_setting('test.copy_recurring'), 'cycle_field_id kopii wskazuje pole recurring kopii');
select isnt((select f.config ->> 'cycle_field_id' from public.page_fields as f where f.id = current_setting('test.copy_renewal')::uuid),
  'f2000000-0000-0000-0000-000000000002', 'cycle_field_id kopii nie wskazuje pola oryginału');
select is((select f.config ->> 'active_field_id' from public.page_fields as f where f.id = current_setting('test.copy_renewal')::uuid),
  current_setting('test.copy_checkbox'), 'active_field_id kopii wskazuje pole checkbox kopii');
select ok((select r.values -> current_setting('test.copy_recurring') = '{"amount":49.99,"cycle":"monthly"}'::jsonb
  and not r.values ? 'f2000000-0000-0000-0000-000000000002'
  from public.page_rows as r where r.block_id = current_setting('test.copy_block')::uuid),
  'wartość {amount, cycle} w kopii leży pod nowym kluczem');
select is((select b.content -> 'settings' -> 'sort' -> 0 ->> 'field_id' from public.page_blocks as b where b.id = current_setting('test.copy_block')::uuid),
  current_setting('test.copy_recurring'), 'ustawienia bloku kopii wskazują pole kopii');

-- 5. Strona systemowa (Hasła) dalej nie daje się zduplikować (nowa wersja duplicate_page zachowuje blokadę).
select set_config('test.sys', public.ensure_passwords_page()::text, true);
select throws_ok(
  format('select public.duplicate_page(%L)', current_setting('test.sys')),
  'P0001', 'Strony Hasła nie można zduplikować', 'duplicate_page strony systemowej odrzucone');

-- 6. delete_field(recurring) czyści cycle_field_id, zostawia active_field_id.
select public.delete_field('f2000000-0000-0000-0000-000000000002');
select ok((select not f.config ? 'cycle_field_id' and f.config ->> 'active_field_id' = 'f2000000-0000-0000-0000-000000000004'
  from public.page_fields as f where f.id = 'f2000000-0000-0000-0000-000000000003'),
  'delete_field(recurring) usuwa cycle_field_id i zostawia active_field_id');

-- 7. delete_field(checkbox) czyści active_field_id.
select public.delete_field('f2000000-0000-0000-0000-000000000004');
select ok((select not f.config ? 'active_field_id'
  from public.page_fields as f where f.id = 'f2000000-0000-0000-0000-000000000003'),
  'delete_field(checkbox) usuwa active_field_id');

-- 8. RLS: B nie widzi pól renewal użytkownika A.
select is((select count(*) from public.page_fields as f where f.type = 'renewal'), 3::bigint, 'A widzi swoje pola renewal (plain, oryginał, kopia)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*) from public.page_fields as f where f.type = 'renewal'), 0::bigint, 'B nie widzi pól renewal użytkownika A');

-- 9. Uprawnienia: anon nie wykonuje, authenticated wykonuje.
select is(has_function_privilege('anon', 'public.duplicate_page(uuid)', 'execute'), false, 'anon nie wykonuje duplicate_page');
select is(has_function_privilege('authenticated', 'public.duplicate_page(uuid)', 'execute'), true, 'authenticated wykonuje duplicate_page');
select is(has_function_privilege('anon', 'public.delete_field(uuid)', 'execute'), false, 'anon nie wykonuje delete_field');
select is(has_function_privilege('authenticated', 'public.delete_field(uuid)', 'execute'), true, 'authenticated wykonuje delete_field');

select * from finish();
rollback;
