-- Profil użytkownika (spec 5). Wiersz tworzy wyłącznie trigger po rejestracji.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_path text,
  timezone text default 'Europe/Warsaw',
  week_start text default 'mon' check (week_start in ('mon', 'sun')),
  clock text default '24' check (clock in ('24', '12')),
  weight_kg numeric,
  height_cm numeric,
  sleep_goal_min integer default 480,
  weekly_km_goal numeric,
  currency text default 'PLN',
  roles text[],
  study_field text,
  goals text[],
  referral_source text,
  referral_other text,
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Tylko własny wiersz; brak polityk insert i delete (insert robi trigger, delete idzie kaskadą z auth.users).
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Po rejestracji tworzy profil; nazwa z display_name (formularz) lub full_name (Google).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
