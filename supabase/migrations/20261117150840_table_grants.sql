-- Jawne uprawnienia do tabel dla ról API.
-- Nowe projekty Supabase nie nadają ich automatycznie; dostęp do wierszy dalej ogranicza RLS.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update on public.notification_settings to authenticated;
grant all on public.profiles, public.categories, public.notification_settings to service_role;
