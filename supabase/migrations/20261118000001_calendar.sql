-- Etap 2: kalendarz i zadania. Bloki czasu, wyjątki od serii, zadania i funkcja rozcinania serii.

-- Bloki czasu (pojedyncze albo powtarzalne serie).
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category_id uuid references public.categories (id) on delete set null,
  note text check (char_length(note) <= 2000),
  start_local timestamp not null,
  duration_min int not null check (duration_min between 15 and 1440),
  timezone text not null,
  recurrence jsonb,
  remind boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Blok nie przechodzi przez północ (liczone w minutach, bo time + interval zawija się o 24:00).
  constraint blocks_no_midnight_check check (
    extract(epoch from start_local::time) / 60 + duration_min <= 1440
  ),
  constraint blocks_recurrence_freq_check check (
    recurrence is null or recurrence ->> 'freq' in ('daily', 'weekdays', 'weekly', 'custom')
  )
);

create index blocks_user_id_start_local_idx on public.blocks (user_id, start_local);

-- Wyjątki od serii: odwołane albo zmienione pojedyncze wystąpienia.
create table public.block_exceptions (
  block_id uuid not null references public.blocks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  occurrence_date date not null,
  kind text not null check (kind in ('cancelled', 'modified')),
  new_start_local timestamp,
  new_duration_min int,
  new_title text,
  primary key (block_id, occurrence_date)
);

-- Zadania: samodzielne albo przypięte do wystąpienia bloku.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  done boolean not null default false,
  done_at timestamptz,
  due_date date,
  block_id uuid references public.blocks (id) on delete set null,
  occurrence_date date,
  position int not null default 0,
  created_at timestamptz default now(),
  constraint tasks_block_occurrence_check check ((block_id is null) = (occurrence_date is null))
);

create index tasks_user_id_due_date_idx on public.tasks (user_id, due_date);
create index tasks_block_id_occurrence_date_idx on public.tasks (block_id, occurrence_date);

alter table public.blocks enable row level security;
alter table public.block_exceptions enable row level security;
alter table public.tasks enable row level security;

-- Bloki: tylko własne wiersze.
create policy "blocks_select_own" on public.blocks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "blocks_insert_own" on public.blocks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      category_id is null
      or exists (
        select 1 from public.categories as c
        where c.id = blocks.category_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "blocks_update_own" on public.blocks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      category_id is null
      or exists (
        select 1 from public.categories as c
        where c.id = blocks.category_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "blocks_delete_own" on public.blocks
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Wyjątki: własne wiersze, a blok musi należeć do tego samego użytkownika.
create policy "block_exceptions_select_own" on public.block_exceptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "block_exceptions_insert_own" on public.block_exceptions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.blocks as b
      where b.id = block_exceptions.block_id and b.user_id = (select auth.uid())
    )
  );

create policy "block_exceptions_update_own" on public.block_exceptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.blocks as b
      where b.id = block_exceptions.block_id and b.user_id = (select auth.uid())
    )
  );

create policy "block_exceptions_delete_own" on public.block_exceptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Zadania: własne wiersze; jeśli zadanie ma blok, blok musi być tego samego użytkownika.
create policy "tasks_select_own" on public.tasks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "tasks_insert_own" on public.tasks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      block_id is null
      or exists (
        select 1 from public.blocks as b
        where b.id = tasks.block_id and b.user_id = (select auth.uid())
      )
    )
  );

create policy "tasks_update_own" on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      block_id is null
      or exists (
        select 1 from public.blocks as b
        where b.id = tasks.block_id and b.user_id = (select auth.uid())
      )
    )
  );

create policy "tasks_delete_own" on public.tasks
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Jawne uprawnienia do tabel (chmura Supabase nie nadaje ich automatycznie); dostęp do wierszy ogranicza RLS.
grant select, insert, update, delete on public.blocks to authenticated;
grant select, insert, update, delete on public.block_exceptions to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.blocks, public.block_exceptions, public.tasks to service_role;

-- Przed usunięciem bloku jego zadania stają się samodzielne (due_date = data wystąpienia),
-- bo samo ON DELETE SET NULL naruszyłoby CHECK (block_id is null) = (occurrence_date is null).
create function public.detach_tasks_before_block_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.tasks as t
  set due_date = t.occurrence_date, block_id = null, occurrence_date = null
  where t.block_id = old.id;
  return old;
end;
$$;

create trigger blocks_detach_tasks_before_delete
  before delete on public.blocks
  for each row execute function public.detach_tasks_before_block_delete();

revoke execute on function public.detach_tasks_before_block_delete() from public, anon;

-- Rozcina serię od daty p_from ("to i następne").
-- Edycja (p_delete = false): stara seria kończy się dzień przed p_from (albo znika, gdy p_from to pierwsze wystąpienie),
-- powstaje nowa seria od p_from z zastosowanym p_patch, a zadania i wyjątki od p_from przechodzą do niej
-- (wyjątki są kasowane, gdy zmienia się czas lub powtarzalność). Zwraca id nowej serii.
-- Usuwanie (p_delete = true): zadania od p_from stają się samodzielne (due_date = data wystąpienia), zwraca null.
-- Cudzy lub nieistniejący blok (RLS go ukrywa) kończy się błędem, bez żadnych zmian.
-- p_from musi być datą wystąpienia policzoną przez aplikację: p_from <= data startu bloku oznacza całą serię
-- (p_from przed startem albo po końcu serii (recurrence.until) to błąd 22023, żeby nie wydłużać serii).
-- Gdy patch zawiera recurrence, zadania od p_from stają się samodzielne, a wyjątki od p_from są kasowane.
create function public.split_block_series(
  p_block_id uuid,
  p_from date,
  p_patch jsonb,
  p_delete boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old public.blocks%rowtype;
  v_new_id uuid;
  v_first_date date;
  v_time_changed boolean;
  v_start_time time;
  v_recurrence jsonb;
begin
  select b.* into v_old from public.blocks as b where b.id = p_block_id for update;
  if not found then
    raise exception 'block_not_found' using errcode = 'P0002';
  end if;
  if v_old.recurrence is null then
    raise exception 'block_not_recurring' using errcode = '22023';
  end if;

  v_first_date := v_old.start_local::date;
  if p_from < v_first_date
    or (v_old.recurrence ? 'until' and p_from > (v_old.recurrence ->> 'until')::date) then
    raise exception 'p_from_out_of_series' using errcode = '22023';
  end if;
  p_patch := coalesce(p_patch, '{}'::jsonb);

  if p_delete then
    -- Zadania od p_from stają się samodzielne; due_date = data wystąpienia.
    update public.tasks as t
    set due_date = t.occurrence_date, block_id = null, occurrence_date = null
    where t.block_id = p_block_id and t.occurrence_date >= p_from;

    if p_from <= v_first_date then
      delete from public.blocks as b where b.id = p_block_id;
    else
      delete from public.block_exceptions as e
      where e.block_id = p_block_id and e.occurrence_date >= p_from;
      update public.blocks as b
      set recurrence = jsonb_set(b.recurrence, '{until}', to_jsonb(to_char(p_from - 1, 'YYYY-MM-DD'))),
          updated_at = now()
      where b.id = p_block_id;
    end if;
    return null;
  end if;

  v_time_changed := p_patch ? 'start_time' or p_patch ? 'duration_min' or p_patch ? 'recurrence';

  v_start_time := case
    when p_patch ? 'start_time' then (p_patch ->> 'start_time')::time
    else v_old.start_local::time
  end;
  v_recurrence := case
    when p_patch ? 'recurrence' and jsonb_typeof(p_patch -> 'recurrence') = 'object' then p_patch -> 'recurrence'
    when p_patch ? 'recurrence' then null
    else v_old.recurrence
  end;

  insert into public.blocks (
    user_id, title, category_id, note, start_local, duration_min, timezone, recurrence, remind
  )
  values (
    v_old.user_id,
    case when p_patch ? 'title' then p_patch ->> 'title' else v_old.title end,
    case when p_patch ? 'category_id' then (p_patch ->> 'category_id')::uuid else v_old.category_id end,
    case when p_patch ? 'note' then p_patch ->> 'note' else v_old.note end,
    p_from + v_start_time,
    case when p_patch ? 'duration_min' then (p_patch ->> 'duration_min')::int else v_old.duration_min end,
    v_old.timezone,
    v_recurrence,
    case when p_patch ? 'remind' then (p_patch ->> 'remind')::boolean else v_old.remind end
  )
  returning id into v_new_id;

  if p_patch ? 'recurrence' then
    -- Zmiana wzorca powtarzania: zadania od p_from stają się samodzielne, wyjątki są kasowane.
    update public.tasks as t
    set due_date = t.occurrence_date, block_id = null, occurrence_date = null
    where t.block_id = p_block_id and t.occurrence_date >= p_from;
    delete from public.block_exceptions as e
    where e.block_id = p_block_id and e.occurrence_date >= p_from;
  else
    -- Zadania od p_from przechodzą do nowej serii.
    update public.tasks as t
    set block_id = v_new_id
    where t.block_id = p_block_id and t.occurrence_date >= p_from;

    -- Wyjątki od p_from: kasowane przy zmianie godziny lub czasu trwania, inaczej przenoszone.
    if v_time_changed then
      delete from public.block_exceptions as e
      where e.block_id = p_block_id and e.occurrence_date >= p_from;
    else
      update public.block_exceptions as e
      set block_id = v_new_id
      where e.block_id = p_block_id and e.occurrence_date >= p_from;
    end if;
  end if;

  if p_from <= v_first_date then
    delete from public.blocks as b where b.id = p_block_id;
  else
    update public.blocks as b
    set recurrence = jsonb_set(b.recurrence, '{until}', to_jsonb(to_char(p_from - 1, 'YYYY-MM-DD'))),
        updated_at = now()
    where b.id = p_block_id;
  end if;

  return v_new_id;
end;
$$;

revoke execute on function public.split_block_series(uuid, date, jsonb, boolean) from public, anon;
grant execute on function public.split_block_series(uuid, date, jsonb, boolean) to authenticated;
