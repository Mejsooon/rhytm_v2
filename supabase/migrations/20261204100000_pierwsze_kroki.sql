-- „Pierwsze kroki” na Dziś: ręczne odhaczenia kroków i ukrycie listy.
-- Nowe kolumny dziedziczą granty i RLS tabeli profiles.
alter table public.profiles
  add column first_steps jsonb not null default '{}'
    constraint profiles_first_steps_check check (jsonb_typeof(first_steps) = 'object'),
  add column first_steps_hidden boolean not null default false;
