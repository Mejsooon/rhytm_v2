-- Etap 1: onboarding i profil. Kolumny profilu, kategorie, ustawienia powiadomień, avatary, complete_onboarding.

-- Krok onboardingu (1-7) i strony oczekujące na pokazanie.
alter table public.profiles
  add column onboarding_step smallint not null default 1
    constraint profiles_onboarding_step_check check (onboarding_step between 1 and 7),
  add column pending_pages text[];

-- Walidacja danych profilu; każda kolumna nadal dopuszcza null.
alter table public.profiles
  add constraint profiles_weight_kg_check check (weight_kg between 30 and 250),
  add constraint profiles_height_cm_check check (height_cm between 120 and 230),
  add constraint profiles_sleep_goal_min_check check (sleep_goal_min between 300 and 660 and sleep_goal_min % 15 = 0),
  add constraint profiles_weekly_km_goal_check check (weekly_km_goal between 1 and 300),
  add constraint profiles_currency_check check (currency in ('PLN', 'EUR', 'USD', 'GBP')),
  add constraint profiles_display_name_check check (char_length(btrim(display_name)) between 1 and 40),
  add constraint profiles_referral_source_check check (
    referral_source in ('friend', 'uni', 'tiktok', 'insta', 'yt', 'x', 'reddit', 'search', 'ai', 'other')
  );

-- Kategorie bloków czasu użytkownika.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  position int not null,
  is_system boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

-- Tylko własne wiersze.
create policy "categories_select_own" on public.categories
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "categories_insert_own" on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "categories_update_own" on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "categories_delete_own" on public.categories
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Ustawienia powiadomień (jeden wiersz na użytkownika).
create table public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default true,
  before_block_min int not null default 10 check (before_block_min in (5, 10, 15, 30)),
  renewals_enabled boolean not null default true,
  renewal_days_before int not null default 3,
  renewal_hour int not null default 9,
  weekly_summary boolean not null default true,
  weekly_summary_at text not null default 'sun 18:00',
  habits_enabled boolean not null default false,
  quiet_enabled boolean not null default false,
  quiet_from time not null default '23:00',
  quiet_to time not null default '07:00',
  created_at timestamptz default now()
);

alter table public.notification_settings enable row level security;

create policy "notification_settings_select_own" on public.notification_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notification_settings_insert_own" on public.notification_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "notification_settings_update_own" on public.notification_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Prywatny bucket na avatary: max 2 MB, tylko png/jpeg/webp.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/png', 'image/jpeg', 'image/webp']);

-- Użytkownik zarządza plikami tylko w folderze o nazwie swojego id.
create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Nazwa przycięta do 40 znaków; pusta po przycięciu = null (inaczej CHECK blokowałby rejestrację z Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    nullif(
      left(
        btrim(coalesce(
          new.raw_user_meta_data ->> 'display_name',
          new.raw_user_meta_data ->> 'full_name'
        )),
        40
      ),
      ''
    )
  );
  return new;
end;
$$;

-- Kończy onboarding: zakłada kategorie (tylko gdy użytkownik nie ma żadnej) i ustawia onboarded_at (tylko raz).
create function public.complete_onboarding(p_categories jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.categories where user_id = (select auth.uid())) then
    insert into public.categories (user_id, name, color, position, is_system)
    select
      (select auth.uid()),
      c.value ->> 'name',
      c.value ->> 'color',
      (c.ordinality - 1)::int,
      coalesce((c.value ->> 'is_system')::boolean, false)
    from jsonb_array_elements(p_categories) with ordinality as c (value, ordinality);
  end if;

  update public.profiles
  set onboarded_at = now()
  where user_id = (select auth.uid()) and onboarded_at is null;
end;
$$;

grant execute on function public.complete_onboarding(jsonb) to authenticated;
