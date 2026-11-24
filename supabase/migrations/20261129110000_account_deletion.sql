-- Usuwanie konta z 30 dniami na cofnięcie (spec D3).
-- Prośba o usunięcie = profiles.deletion_requested_at (ustawia użytkownik przez RLS, datę nadaje wyzwalacz).
-- Przywrócenie = deletion_requested_at = null. Po 30 dniach pg_cron usuwa auth.users (reszta kaskadą).

-- 1. Kolumna dziedziczy granty i RLS tabeli profiles (update tylko własnego wiersza).
alter table public.profiles add column deletion_requested_at timestamptz;

-- 2. Strażnik daty: null → wartość zawsze daje now() (bez daty wstecz ani w przód),
-- wartość → inna wartość zostawia starą, wartość → null (przywrócenie) przechodzi.
create function public.guard_deletion_requested_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.deletion_requested_at is null then
    return new;
  end if;
  if old.deletion_requested_at is null then
    new.deletion_requested_at := now();
  else
    new.deletion_requested_at := old.deletion_requested_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_deletion_requested_at() from public, anon, authenticated;

create trigger profiles_deletion_guard
  before update of deletion_requested_at on public.profiles
  for each row execute function public.guard_deletion_requested_at();

-- 3. Trwałe usunięcie kont oznaczonych co najmniej 30 dni temu (wołane tylko przez pg_cron).
-- Usuwa wiersz auth.users; dane we wszystkich tabelach znikają kaskadą (on delete cascade).
-- Zwraca liczbę usuniętych kont.
create function public.purge_deleted_accounts()
returns int
language sql
security definer
set search_path = ''
as $$
  with usuniete as (
    delete from auth.users as u
    using public.profiles as p
    where p.user_id = u.id
      and p.deletion_requested_at is not null
      and p.deletion_requested_at <= now() - interval '30 days'
    returning u.id
  )
  select count(*)::int from usuniete as us;
$$;

revoke execute on function public.purge_deleted_accounts() from public, anon, authenticated;

-- 4. Codziennie o 03:41; odpięcie istniejącego zadania robi migrację idempotentną.
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(j.jobid) from cron.job as j where j.jobname = 'rhytm-purge-accounts';
select cron.schedule('rhytm-purge-accounts', '41 3 * * *', 'select public.purge_deleted_accounts()');
