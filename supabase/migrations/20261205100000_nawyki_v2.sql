-- Nawyki v2: archiwum (wersja harmonogramu „paused”), cel ilościowy i pora snu.

-- Archiwizacja to wersja harmonogramu bez planu; przypomnienia (push_dispatch) pomijają nieznany typ.
alter table public.habit_schedules
  drop constraint habit_schedules_schedule_type_check,
  add constraint habit_schedules_schedule_type_check
    check (schedule_type in ('daily', 'weekdays', 'times_per_week', 'paused'));

-- Cel ilościowy: oba puste = „Zrobione / nie”.
alter table public.habits
  add column goal_qty numeric(8, 2)
    constraint habits_goal_qty_check check (goal_qty > 0),
  add column goal_unit text
    constraint habits_goal_unit_check check (char_length(btrim(goal_unit)) between 1 and 12),
  add constraint habits_goal_check check ((goal_qty is null) = (goal_unit is null));

-- Częściowy postęp dnia. Odhaczenie (habit_checks) powstaje dopiero po osiągnięciu celu.
create table public.habit_progress (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  qty numeric(8, 2) not null check (qty > 0),
  primary key (habit_id, date)
);
create index habit_progress_user_id_date_idx on public.habit_progress (user_id, date);

alter table public.habit_progress enable row level security;

create policy "habit_progress_select_own" on public.habit_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "habit_progress_insert_own" on public.habit_progress
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits as h
      where h.id = habit_progress.habit_id and h.user_id = (select auth.uid())
    )
  );
create policy "habit_progress_update_own" on public.habit_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits as h
      where h.id = habit_progress.habit_id and h.user_id = (select auth.uid())
    )
  );
create policy "habit_progress_delete_own" on public.habit_progress
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.habit_progress to authenticated;
grant all on public.habit_progress to service_role;

-- Pora snu (początek okna na wykresie „Pory snu”; koniec = pora + cel snu).
alter table public.profiles
  add column sleep_bedtime time not null default '23:00';
