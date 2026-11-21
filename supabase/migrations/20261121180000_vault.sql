-- Sejf (zero-knowledge): tabela vaults, typ pola „secret” i funkcje resetu.
-- Serwer przechowuje tylko materiał kluczowy owinięty w przeglądarce oraz szyfrogramy; hasło główne i klucz danych nigdy tu nie trafiają.

-- Sejf użytkownika. Wiersz ze status = 'reset' oznacza „brak sejfu” dla aplikacji; zostaje po to, by zachować i podbić generation
-- (inaczej nowy sejf zacząłby od 1 i stare szyfrogramy z innej karty przeszłyby walidację).
create table public.vaults (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  status text not null default 'active' check (status in ('active', 'reset')),
  -- { "alg": "PBKDF2-SHA-256", "iterations": 600000, "salt": "<base64 16 B>" }
  kdf jsonb not null default '{}',
  -- Klucz danych AES-GCM-256 owinięty kluczem z hasła głównego (base64) i jego IV 12 B (base64).
  wrapped_key text not null default '',
  wrap_iv text not null default '',
  generation int not null default 1 check (generation >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vaults enable row level security;

create policy "vaults_select_own" on public.vaults
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "vaults_insert_own" on public.vaults
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "vaults_update_own" on public.vaults
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "vaults_delete_own" on public.vaults
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.vaults to authenticated;
grant all on public.vaults to service_role;

-- Nowy typ pola: Sekret (wartość to szyfrogram {v, g, iv, ct} albo null).
alter table public.page_fields drop constraint if exists page_fields_type_check;
alter table public.page_fields add constraint page_fields_type_check
  check (type in ('text', 'number', 'checkbox', 'url', 'select', 'status', 'date', 'rating', 'secret'));

-- Liczba niepustych wartości Sekret użytkownika (także w wierszach z kosza).
create function public.count_secrets()
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.page_fields as f
  join public.page_rows as r on r.block_id = f.block_id
  where f.type = 'secret'
    and f.user_id = auth.uid()
    and r.user_id = auth.uid()
    and coalesce(jsonb_typeof(r.values -> f.id::text), 'null') <> 'null';
$$;

-- Reset sejfu w jednej transakcji: czyści wartości pól Sekret (także w koszu), zamienia sejf w „reset”
-- z podbitym generation i zwraca liczbę wyczyszczonych niepustych wartości.
create function public.reset_vault()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  select count(*)::int into v_count
  from public.page_fields as f
  join public.page_rows as r on r.block_id = f.block_id
  where f.type = 'secret'
    and f.user_id = auth.uid()
    and r.user_id = auth.uid()
    and coalesce(jsonb_typeof(r.values -> f.id::text), 'null') <> 'null';

  -- Każdy klucz z id pola Sekret obecny w values dostaje null.
  update public.page_rows as r
  set values = r.values || (
    select jsonb_object_agg(f.id::text, 'null'::jsonb)
    from public.page_fields as f
    where f.block_id = r.block_id
      and f.type = 'secret'
      and f.user_id = auth.uid()
      and r.values ? f.id::text
  )
  where r.user_id = auth.uid()
    and exists (
      select 1 from public.page_fields as f
      where f.block_id = r.block_id
        and f.type = 'secret'
        and f.user_id = auth.uid()
        and r.values ? f.id::text
    );

  update public.vaults as v
  set status = 'reset',
      generation = v.generation + 1,
      kdf = '{}'::jsonb,
      wrapped_key = '',
      wrap_iv = '',
      updated_at = now()
  where v.user_id = auth.uid();

  return v_count;
end;
$$;

revoke execute on function public.count_secrets() from public, anon;
revoke execute on function public.reset_vault() from public, anon;
grant execute on function public.count_secrets() to authenticated;
grant execute on function public.reset_vault() to authenticated;
