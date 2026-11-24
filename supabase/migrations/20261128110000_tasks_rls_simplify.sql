-- Polityki RLS zadań bez martwej gałęzi: po 20261126100000_tasks_only_in_blocks.sql
-- tasks.block_id jest NOT NULL, więc warunek "block_id is null or ..." nigdy nie był prawdziwy.
-- Zachowanie bez zmian: zadanie może wskazywać tylko blok tego samego użytkownika. Dane nietknięte.

drop policy "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.blocks as b
      where b.id = tasks.block_id and b.user_id = (select auth.uid())
    )
  );

drop policy "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.blocks as b
      where b.id = tasks.block_id and b.user_id = (select auth.uid())
    )
  );
