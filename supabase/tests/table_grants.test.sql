-- Uprawnienia do tabel dla roli authenticated (bez nich RLS nie ma czego przepuścić)
begin;
select plan(3);

select ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT, UPDATE'),
  'authenticated czyta i zmienia profile');
select ok(has_table_privilege('authenticated', 'public.categories', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated zarządza kategoriami');
select ok(has_table_privilege('authenticated', 'public.notification_settings', 'SELECT, INSERT, UPDATE'),
  'authenticated zapisuje ustawienia powiadomień');

select * from finish();
rollback;
