begin;
select plan(7);

-- Migracja 20261130100000_szablony_po_polsku zmienia tytuły przy zwykłym `db push`, a pgTAP działa już po niej,
-- więc strony testowe wstawiamy tu i ponownie wykonujemy to samo polecenie update (jako właściciel, bez RLS).
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000d1', 'szablony@test.pl');

insert into public.pages (id, user_id, title, template_key, deleted_at)
values
  -- domyślne angielskie tytuły: mają zostać zmienione
  ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-0000000000d1', 'Books', 'books', null),
  ('00000000-0000-0000-0000-00000000d102', '00000000-0000-0000-0000-0000000000d1', 'Projects', 'projects', null),
  ('00000000-0000-0000-0000-00000000d103', '00000000-0000-0000-0000-0000000000d1', 'Websites', 'websites', null),
  ('00000000-0000-0000-0000-00000000d104', '00000000-0000-0000-0000-0000000000d1', 'Subscriptions', 'subscriptions', null),
  -- przemianowana przez użytkownika: bez zmian
  ('00000000-0000-0000-0000-00000000d105', '00000000-0000-0000-0000-0000000000d1', 'Moje lektury', 'books', null),
  -- tytuł Books na stronie innego szablonu i bez szablonu: bez zmian
  ('00000000-0000-0000-0000-00000000d106', '00000000-0000-0000-0000-0000000000d1', 'Books', 'projects', null),
  ('00000000-0000-0000-0000-00000000d107', '00000000-0000-0000-0000-0000000000d1', 'Books', null, null),
  -- w koszu: bez zmian
  ('00000000-0000-0000-0000-00000000d108', '00000000-0000-0000-0000-0000000000d1', 'Books', 'books', now());

update public.pages as p
set title = case p.template_key
  when 'books' then 'Książki'
  when 'projects' then 'Projekty'
  when 'websites' then 'Strony WWW'
  when 'subscriptions' then 'Subskrypcje'
end
where p.deleted_at is null
  and (
    (p.template_key = 'books' and p.title = 'Books')
    or (p.template_key = 'projects' and p.title = 'Projects')
    or (p.template_key = 'websites' and p.title = 'Websites')
    or (p.template_key = 'subscriptions' and p.title = 'Subscriptions')
  );

select is(
  (select array_agg(p.title order by p.id) from public.pages as p
    where p.id in ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-00000000d102',
                   '00000000-0000-0000-0000-00000000d103', '00000000-0000-0000-0000-00000000d104')),
  array['Książki', 'Projekty', 'Strony WWW', 'Subskrypcje'],
  'domyślne angielskie tytuły czterech szablonów zmienione na polskie');
select is((select p.title from public.pages as p where p.id = '00000000-0000-0000-0000-00000000d105'),
  'Moje lektury', 'strona przemianowana przez użytkownika bez zmian');
select is((select p.title from public.pages as p where p.id = '00000000-0000-0000-0000-00000000d106'),
  'Books', 'tytuł Books na stronie innego szablonu bez zmian');
select is((select p.title from public.pages as p where p.id = '00000000-0000-0000-0000-00000000d107'),
  'Books', 'tytuł Books na stronie bez szablonu bez zmian');
select is((select p.title from public.pages as p where p.id = '00000000-0000-0000-0000-00000000d108'),
  'Books', 'strona w koszu bez zmian');
select is((select count(*)::int from public.pages as p
  where p.user_id = '00000000-0000-0000-0000-0000000000d1' and p.title = 'Książki'), 1,
  'dokładnie jedna strona dostała tytuł Książki');
select is((select count(*)::int from public.pages as p
  where p.user_id = '00000000-0000-0000-0000-0000000000d1' and p.title in ('Projects', 'Websites', 'Subscriptions')), 0,
  'żadna aktywna strona nie została przy angielskim tytule szablonu (poza innymi szablonami)');

select * from finish();
rollback;
