-- Przypomnienie przed blokiem można wyłączyć (null) — krok 6 onboardingu zapisuje null, gdy wyłączone.
alter table public.notification_settings alter column before_block_min drop not null;
