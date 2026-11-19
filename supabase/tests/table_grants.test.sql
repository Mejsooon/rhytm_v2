-- Jawne uprawnienia do tabel i funkcji dla ról API (bez nich RLS nie ma czego przepuścić).
-- Lokalnie config.toml ma [api] auto_expose_new_tables = false, więc — jak w chmurze —
-- nic nie jest nadawane automatycznie i te testy naprawdę łapią brakujące GRANT-y.
begin;
select plan(25);

-- Etap 0/1
select ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT, UPDATE'),
  'authenticated czyta i zmienia profile');
select ok(has_table_privilege('authenticated', 'public.categories', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated zarządza kategoriami');
select ok(has_table_privilege('authenticated', 'public.notification_settings', 'SELECT, INSERT, UPDATE'),
  'authenticated zapisuje ustawienia powiadomień');
select ok(has_table_privilege('service_role', 'public.profiles', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do profili');
select ok(has_table_privilege('service_role', 'public.categories', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do kategorii');
select ok(has_table_privilege('service_role', 'public.notification_settings', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do ustawień powiadomień');
select ok(has_function_privilege('authenticated', 'public.complete_onboarding(jsonb)', 'execute'),
  'authenticated kończy onboarding');
select ok(not has_function_privilege('anon', 'public.complete_onboarding(jsonb)', 'execute'),
  'anon nie kończy onboardingu');

-- Etap 2
select ok(has_table_privilege('service_role', 'public.blocks', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do bloków');
select ok(has_table_privilege('service_role', 'public.block_exceptions', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do wyjątków');
select ok(has_table_privilege('service_role', 'public.tasks', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do zadań');
select ok(has_function_privilege('authenticated', 'public.move_category(uuid, int)', 'execute'),
  'authenticated przesuwa kategorie');
select ok(has_function_privilege('authenticated', 'public.split_block_series(uuid, date, jsonb, boolean)', 'execute'),
  'authenticated rozcina serie');

-- Etap 6
select ok(has_table_privilege('authenticated', 'public.pages', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated zarządza stronami');
select ok(has_table_privilege('authenticated', 'public.page_blocks', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated zarządza blokami stron');
select ok(has_table_privilege('authenticated', 'public.page_fields', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated zarządza polami stron');
select ok(has_table_privilege('authenticated', 'public.page_rows', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated zarządza wierszami stron');
select ok(has_table_privilege('service_role', 'public.pages', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do stron');
select ok(has_table_privilege('service_role', 'public.page_blocks', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do bloków stron');
select ok(has_table_privilege('service_role', 'public.page_fields', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do pól stron');
select ok(has_table_privilege('service_role', 'public.page_rows', 'SELECT, INSERT, UPDATE, DELETE'),
  'service_role ma dostęp do wierszy stron');

-- anon nie ma dostępu do danych użytkowników
select ok(not has_table_privilege('anon', 'public.blocks', 'SELECT'), 'anon nie czyta bloków');
select ok(not has_table_privilege('anon', 'public.block_exceptions', 'SELECT'), 'anon nie czyta wyjątków');
select ok(not has_table_privilege('anon', 'public.tasks', 'SELECT'), 'anon nie czyta zadań');
select ok(not has_table_privilege('anon', 'public.categories', 'SELECT'), 'anon nie czyta kategorii');

select * from finish();
rollback;
