-- Etap 3: nawyki (wersje harmonogramu, odhaczenia, notatki) i dziennik snu.

-- Nawyki.
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  remind_at time,
  show_on_today boolean not null default true,
  created_at timestamptz default now()
);

create index habits_user_id_created_at_idx on public.habits (user_id, created_at);

-- Wersje harmonogramu nawyku: obowiązuje ta z największym valid_from <= dnia.
create table public.habit_schedules (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  valid_from date not null,
  schedule_type text not null check (schedule_type in ('daily', 'weekdays', 'times_per_week')),
  weekdays smallint[] not null default '{}',
  times_per_week smallint,
  primary key (habit_id, valid_from),
  -- Dni tygodnia: 1 = pn … 7 = nd; przy 'weekdays' niepuste i w 1..7, w pozostałych typach puste.
  constraint habit_schedules_weekdays_check check (
    (schedule_type = 'weekdays'
      and cardinality(weekdays) > 0
      and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
    or (schedule_type <> 'weekdays' and cardinality(weekdays) = 0)
  ),
  -- Liczba razy w tygodniu: 1..7 przy 'times_per_week', w pozostałych typach null.
  constraint habit_schedules_times_per_week_check check (
    (schedule_type = 'times_per_week' and times_per_week between 1 and 7)
    or (schedule_type <> 'times_per_week' and times_per_week is null)
  )
);

-- Wczytywanie wersji użytkownika (lista nawyków) i polityki RLS po user_id
create index habit_schedules_user_id_idx on public.habit_schedules (user_id);

-- Odhaczenia: jedno na nawyk i dzień.
create table public.habit_checks (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  primary key (habit_id, date)
);

-- Wczytywanie odhaczeń użytkownika w zakresie dat
create index habit_checks_user_id_date_idx on public.habit_checks (user_id, date);

-- Notatki do nawyku w danym dniu.
create table public.habit_notes (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  created_at timestamptz default now()
);

create index habit_notes_habit_id_date_idx on public.habit_notes (habit_id, date);
-- Polityki RLS i kaskada z auth.users po user_id
create index habit_notes_user_id_idx on public.habit_notes (user_id);

-- Dziennik snu: jeden wpis na dzień (data przebudzenia).
create table public.sleep_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  slept_at time not null,
  woke_at time not null check (woke_at <> slept_at),
  feeling smallint check (feeling between 1 and 5),
  tags text[] not null default '{}',
  note text check (char_length(note) <= 1000),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, date)
);

alter table public.habits enable row level security;
alter table public.habit_schedules enable row level security;
alter table public.habit_checks enable row level security;
alter table public.habit_notes enable row level security;
alter table public.sleep_logs enable row level security;

-- Nawyki: tylko własne wiersze.
create policy "habits_select_own" on public.habits
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "habits_insert_own" on public.habits
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "habits_update_own" on public.habits
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "habits_delete_own" on public.habits
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Tabele podrzędne: własne wiersze, a nawyk musi należeć do tego samego użytkownika.
create policy "habit_schedules_select_own" on public.habit_schedules
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "habit_schedules_insert_own" on public.habit_schedules
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits as h
      where h.id = habit_schedules.habit_id and h.user_id = (select auth.uid())
    )
  );

create policy "habit_schedules_update_own" on public.habit_schedules
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits as h
      where h.id = habit_schedules.habit_id and h.user_id = (select auth.uid())
    )
  );

create policy "habit_schedules_delete_own" on public.habit_schedules
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "habit_checks_select_own" on public.habit_checks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "habit_checks_insert_own" on public.habit_checks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits as h
      where h.id = habit_checks.habit_id and h.user_id = (select auth.uid())
    )
  );

create policy "habit_checks_update_own" on public.habit_checks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits as h
      where h.id = habit_checks.habit_id and h.user_id = (select auth.uid())
    )
  );

create policy "habit_checks_delete_own" on public.habit_checks
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "habit_notes_select_own" on public.habit_notes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "habit_notes_insert_own" on public.habit_notes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits as h
      where h.id = habit_notes.habit_id and h.user_id = (select auth.uid())
    )
  );

create policy "habit_notes_update_own" on public.habit_notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits as h
      where h.id = habit_notes.habit_id and h.user_id = (select auth.uid())
    )
  );

create policy "habit_notes_delete_own" on public.habit_notes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Sen: tylko własne wiersze.
create policy "sleep_logs_select_own" on public.sleep_logs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "sleep_logs_insert_own" on public.sleep_logs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "sleep_logs_update_own" on public.sleep_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "sleep_logs_delete_own" on public.sleep_logs
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Jawne uprawnienia do tabel (chmura Supabase nie nadaje ich automatycznie); dostęp do wierszy ogranicza RLS.
grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, update, delete on public.habit_schedules to authenticated;
grant select, insert, update, delete on public.habit_checks to authenticated;
grant select, insert, update, delete on public.habit_notes to authenticated;
grant select, insert, update, delete on public.sleep_logs to authenticated;
grant all on public.habits, public.habit_schedules, public.habit_checks, public.habit_notes, public.sleep_logs to service_role;
