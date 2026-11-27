-- Opinie i zgłoszenia błędów z „Pomoc i opinie”. Czytane w panelu Supabase; aplikacja tylko dodaje.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('idea', 'bug', 'other')),
  message text not null check (length(trim(message)) between 1 and 4000),
  -- ekran, przeglądarka, wersja, kod błędu (tylko przy błędzie)
  context jsonb not null default '{}' check (jsonb_typeof(context) = 'object' and length(context::text) <= 2000),
  contact boolean not null default false,
  created_at timestamptz not null default now()
);

create index feedback_user_id_idx on public.feedback (user_id);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant insert (kind, message, context, contact) on public.feedback to authenticated;

create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));
