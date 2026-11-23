-- Strony 2.0: funkcja pomocnicza page_icon_lucide była potrzebna tylko do jednorazowej konwersji ikon
-- w migracji 20261123100000. Constraint pages_icon_format zostaje.
drop function if exists public.page_icon_lucide(text);
