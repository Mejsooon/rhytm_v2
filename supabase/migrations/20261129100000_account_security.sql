-- Konto i bezpieczeństwo: lista własnych sesji, wylogowanie pojedynczej sesji,
-- weryfikacja obecnego hasła z limitem prób (5 porażek / 15 min).
-- Funkcje są security definer (czytają auth.*), ale działają wyłącznie dla auth.uid().

-- 1. Lista własnych, niewygasłych sesji. Bieżąca (session_id z JWT) pierwsza, potem ostatnia aktywność malejąco.
create function public.list_my_sessions()
returns table (
  id uuid,
  user_agent text,
  ip text,
  created_at timestamptz,
  last_active_at timestamptz,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.user_agent,
    host(s.ip) as ip,
    s.created_at,
    -- refreshed_at to timestamp bez strefy (UTC), updated_at/created_at to timestamptz
    coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at) as last_active_at,
    coalesce(s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid, false) as is_current
  from auth.sessions as s
  where s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
  order by
    coalesce(s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid, false) desc,
    coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at) desc;
$$;

-- 2. Wylogowanie innej własnej sesji: usunięcie wiersza (refresh tokeny znikają kaskadą).
-- Cudzej ani bieżącej nie usunie — wtedy zwraca false.
create function public.revoke_my_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_biezaca uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_usunieto int;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  delete from auth.sessions as s
  where s.id = p_session_id
    and s.user_id = v_uid
    and s.id is distinct from v_biezaca;
  get diagnostics v_usunieto = row_count;
  return v_usunieto > 0;
end;
$$;

-- 3. Nieudane próby weryfikacji hasła (limit prób). Tylko dla funkcji — API nie ma dostępu.
create table public.password_check_failures (
  user_id uuid not null references auth.users (id) on delete cascade,
  failed_at timestamptz not null default now()
);

create index password_check_failures_user_idx
  on public.password_check_failures (user_id, failed_at);

alter table public.password_check_failures enable row level security;
revoke all on public.password_check_failures from anon, authenticated;

-- 4. Sprawdzenie obecnego hasła bez tworzenia nowej sesji.
-- ≥ 5 porażek w ostatnich 15 min → wyjątek za_duzo_prob (także przy dobrym haśle).
create function public.verify_my_password(p_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_porazki int;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  -- Równoległe próby tego samego użytkownika czekają na siebie (limit nie przecieka)
  perform pg_advisory_xact_lock(hashtextextended('verify_my_password:' || v_uid::text, 0));

  select count(*) into v_porazki
  from public.password_check_failures as f
  where f.user_id = v_uid
    and f.failed_at > now() - interval '15 minutes';
  if v_porazki >= 5 then
    raise exception 'za_duzo_prob';
  end if;

  select u.encrypted_password into v_hash
  from auth.users as u
  where u.id = v_uid;

  -- Konto bez hasła (tylko Google): nie ma czego sprawdzać
  if v_hash is null or v_hash = '' or p_password is null then
    return false;
  end if;

  if v_hash = extensions.crypt(p_password, v_hash) then
    delete from public.password_check_failures as f where f.user_id = v_uid;
    return true;
  end if;

  insert into public.password_check_failures (user_id) values (v_uid);
  return false;
end;
$$;

-- 5. Uprawnienia: tylko zalogowani
revoke execute on function public.list_my_sessions() from public, anon;
revoke execute on function public.revoke_my_session(uuid) from public, anon;
revoke execute on function public.verify_my_password(text) from public, anon;
grant execute on function public.list_my_sessions() to authenticated;
grant execute on function public.revoke_my_session(uuid) to authenticated;
grant execute on function public.verify_my_password(text) to authenticated;
