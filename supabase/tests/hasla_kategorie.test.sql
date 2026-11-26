begin;
select plan(7);

-- Migracja 20261130110000_hasla_kategorie dodaje opcje funkcją hasla_domyslne_kategorie(); pgTAP działa już po niej,
-- więc strony testowe wstawiamy tu i wołamy tę samą funkcję (jako właściciel, bez RLS).
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000e1', 'hk1@test.pl'),
  ('00000000-0000-0000-0000-0000000000e2', 'hk2@test.pl');

select set_config('rhytm.system_write', 'on', true);

insert into public.pages (id, user_id, title, template_key, is_system)
values
  ('00000000-0000-0000-0000-00000000e101', '00000000-0000-0000-0000-0000000000e1', 'Hasła', 'passwords', true),
  ('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-0000000000e2', 'Hasła', 'passwords', true);

insert into public.page_blocks (id, user_id, page_id, type, position, content)
values
  -- pusta lista widoków zapisana, gdy nie było opcji: klucz ma zniknąć
  ('00000000-0000-0000-0000-00000000e102', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000e101',
   'table', 0, '{"settings":{"views":[],"group_by":null}}'::jsonb),
  -- użytkownik ma własną opcję i widok: bez zmian
  ('00000000-0000-0000-0000-00000000e202', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000e201',
   'table', 0, '{"settings":{"views":[{"id":"v1","name":"Bank"}]}}'::jsonb);

insert into public.page_fields (id, user_id, block_id, name, type, config, position, is_title)
values
  ('00000000-0000-0000-0000-00000000e103', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000e102',
   'Kategoria', 'select', '{"options":[]}'::jsonb, 4, false),
  ('00000000-0000-0000-0000-00000000e203', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000e202',
   'Kategoria', 'select', '{"options":[{"id":"o1","label":"Bank","color":""}]}'::jsonb, 4, false);

select set_config('rhytm.system_write', 'off', true);

select public.hasla_domyslne_kategorie();
-- Druga runda nic nie zmienia (idempotencja)
select public.hasla_domyslne_kategorie();

select is(
  (select array_agg(e.opt ->> 'label' order by e.ord) from public.page_fields as f,
     jsonb_array_elements(f.config -> 'options') with ordinality as e(opt, ord)
   where f.id = '00000000-0000-0000-0000-00000000e103'),
  array['Praca', 'Studia', 'Prywatne'], 'pusta Kategoria dostaje Praca, Studia, Prywatne (raz)');
select is(
  (select e.opt ->> 'label' from public.page_fields as f,
     jsonb_array_elements(f.config -> 'options') as e(opt)
   where f.id = '00000000-0000-0000-0000-00000000e103' and e.opt ->> 'id' = f.config ->> 'default_option'),
  'Prywatne', 'domyślna opcja nowego hasła to Prywatne');
select ok(
  not ((select b.content -> 'settings' from public.page_blocks as b where b.id = '00000000-0000-0000-0000-00000000e102') ? 'views'),
  'pusta lista widoków usunięta, żeby aplikacja dopisała gotowe widoki');
select is(
  (select b.content -> 'settings' -> 'group_by' from public.page_blocks as b where b.id = '00000000-0000-0000-0000-00000000e102'),
  'null'::jsonb, 'pozostałe ustawienia bez zmian');
select is(
  (select f.config from public.page_fields as f where f.id = '00000000-0000-0000-0000-00000000e203'),
  '{"options":[{"id":"o1","label":"Bank","color":""}]}'::jsonb, 'Kategoria z opcjami użytkownika bez zmian');
select is(
  (select jsonb_array_length(b.content -> 'settings' -> 'views') from public.page_blocks as b
   where b.id = '00000000-0000-0000-0000-00000000e202'),
  1, 'widoki użytkownika bez zmian');
select is(has_function_privilege('authenticated', 'public.hasla_domyslne_kategorie()', 'execute'), false,
  'authenticated nie wykonuje hasla_domyslne_kategorie');

select * from finish();
rollback;
