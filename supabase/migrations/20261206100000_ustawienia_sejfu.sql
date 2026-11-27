-- Ustawienia sejfu zapamiętane na koncie (Ustawienia → Sejf, „Blokada i schowek”).
-- Nowe kolumny dziedziczą granty i RLS tabeli profiles.
alter table public.profiles
  add column vault_lock_min smallint not null default 5
    constraint profiles_vault_lock_min_check check (vault_lock_min in (1, 5, 15, 60)),
  add column vault_clear_clipboard boolean not null default true,
  add column vault_ask_on_reveal boolean not null default false;
