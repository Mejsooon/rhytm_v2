-- Inne aktywności (tenis, rower itd.): trzeci typ sesji, ich dane i własne rodzaje użytkownika.

alter table public.sport_sessions
  drop constraint sport_sessions_type_check,
  add constraint sport_sessions_type_check check (type in ('run', 'gym', 'other'));

-- Dane aktywności: jeden wiersz na sesję typu 'other'.
create table public.activities (
  session_id uuid primary key references public.sport_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (length(trim(kind)) between 1 and 40),
  distance_km numeric(6, 2) check (distance_km > 0 and distance_km <= 1000),
  duration_s integer check (duration_s > 0 and duration_s <= 86400),
  difficulty smallint check (difficulty between 1 and 10),
  kcal integer check (kcal >= 0)
);
create index activities_user_id_idx on public.activities (user_id);

-- Tylko własne rodzaje i zmienione kolory; rodzaje podstawowe siedzą w kodzie.
create table public.activity_kinds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  has_distance boolean not null default false
);
create unique index activity_kinds_user_lower_name on public.activity_kinds (user_id, lower(name));

alter table public.activities enable row level security;
alter table public.activity_kinds enable row level security;

create policy "activities_select_own" on public.activities
  for select to authenticated using (user_id = (select auth.uid()));
create policy "activities_insert_own" on public.activities
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sport_sessions as s
      where s.id = activities.session_id and s.user_id = (select auth.uid())
    )
  );
create policy "activities_update_own" on public.activities
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sport_sessions as s
      where s.id = activities.session_id and s.user_id = (select auth.uid())
    )
  );
create policy "activities_delete_own" on public.activities
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "activity_kinds_own" on public.activity_kinds
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.activities, public.activity_kinds to authenticated;
grant all on public.activities, public.activity_kinds to service_role;
