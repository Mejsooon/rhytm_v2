-- Powiadomienia push: urządzenia (subskrypcje Web Push) i ujednolicenie ustawień do makiety (spec E1).
-- Wysyłka (pg_cron + pg_net + trasa Vercel) jest w osobnej migracji 20261129130000_push_dispatch.sql.

-- 1. Subskrypcja Web Push jednej przeglądarki/urządzenia
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- „Chrome · Windows” z nagłówka user-agent (liczone na serwerze aplikacji)
  label text not null,
  -- Wyłączone urządzenie zostaje na liście, ale nie dostaje powiadomień
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- te same limity długości co w save_push_subscription i walidacji w push-actions.ts
  constraint push_subscriptions_lengths check (
    char_length(endpoint) between 1 and 1000
    and char_length(p256dh) between 1 and 1000
    and char_length(auth) between 1 and 1000
    and char_length(label) between 1 and 80)
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- 2. RLS: użytkownik widzi, wyłącza i usuwa tylko swoje urządzenia
alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Bez INSERT: jedyna droga zapisu to save_push_subscription, która sprawdza listę dozwolonych
-- serwerów push (inaczej cron wysyłałby żądania pod dowolny adres podany przez użytkownika).
-- UPDATE tylko kolumny enabled (klucze i endpoint zmienia wyłącznie funkcja).
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant update (enabled) on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- 3. Zapis urządzenia. RLS ukrywa cudze wiersze, a ta sama przeglądarka może przejść na inne konto,
-- więc funkcja działa z prawami właściciela:
--   - ten sam endpoint tego samego użytkownika → nowe klucze, etykieta i last_seen_at (enabled bez zmian);
--   - endpoint innego użytkownika z tymi samymi kluczami → jego wiersz znika, powstaje nowy (przejęcie);
--     z innymi kluczami → 'invalid subscription';
--   - endpoint musi być adresem https jednego ze znanych serwerów push, pola niepuste, najwyżej 1000 znaków.
-- Etykieta przycięta do 80 znaków, pusta → „Przeglądarka”. Zwraca id wiersza.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_host text;
  v_label text;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'unauthorized';
  end if;

  if coalesce(char_length(p_endpoint), 0) not between 1 and 1000
    or coalesce(char_length(p_p256dh), 0) not between 1 and 1000
    or coalesce(char_length(p_auth), 0) not between 1 and 1000
    or left(p_endpoint, 8) <> 'https://' then
    raise exception 'invalid subscription';
  end if;

  -- host = tekst między 'https://' a pierwszym '/'; dopuszczamy tylko litery, cyfry, '-' i kropki
  -- między etykietami, więc odpada userinfo ('@'), port (':'), '\', '?' i '#'
  v_host := lower(split_part(substr(p_endpoint, 9), '/', 1));
  if v_host !~ '^[a-z0-9-]+(\.[a-z0-9-]+)*$'
    or not (
      v_host in ('fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com')
      or v_host like '%.push.apple.com'
      or v_host like '%.notify.windows.com') then
    raise exception 'invalid subscription';
  end if;

  v_label := left(btrim(coalesce(p_label, '')), 80);
  if v_label = '' then
    v_label := 'Przeglądarka';
  end if;

  -- Przejęcie endpointu od innego konta (ta sama przeglądarka, inny użytkownik) tylko z identycznymi kluczami:
  -- adres endpointu może wyciec (np. z logów serwera push), ale p256dh i auth zna tylko przeglądarka,
  -- więc sama znajomość adresu nie pozwala odebrać komuś urządzenia
  if exists (
    select 1 from public.push_subscriptions as ps
    where ps.endpoint = p_endpoint
      and ps.user_id <> v_user_id
      and (ps.p256dh <> p_p256dh or ps.auth <> p_auth)) then
    raise exception 'invalid subscription';
  end if;

  delete from public.push_subscriptions as ps
  where ps.endpoint = p_endpoint
    and ps.user_id <> v_user_id;

  insert into public.push_subscriptions as ps (user_id, endpoint, p256dh, auth, label)
  values (v_user_id, p_endpoint, p_p256dh, p_auth, v_label)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        label = excluded.label,
        last_seen_at = now()
    where ps.user_id = v_user_id
  returning ps.id into v_id;

  -- Brak id = endpoint w międzyczasie zapisało inne konto (równoległe żądania)
  if v_id is null then
    raise exception 'invalid subscription';
  end if;

  return v_id;
end
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- 4. Ustawienia powiadomień jak na makiecie (decyzja C4): start bloku 5 min przed, odnowienie dzień przed.
-- Wyłączone przypomnienie o bloku (null) zostaje wyłączone.
alter table public.notification_settings alter column before_block_min set default 5;
update public.notification_settings as ns
set before_block_min = 5
where ns.before_block_min is not null
  and ns.before_block_min <> 5;

alter table public.notification_settings alter column renewal_days_before set default 1;
update public.notification_settings as ns
set renewal_days_before = 1
where ns.renewal_days_before <> 1;
