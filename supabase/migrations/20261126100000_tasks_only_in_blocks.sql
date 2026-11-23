-- Dziś: zadania istnieją tylko w blokach. Samodzielne zadania znikają,
-- usunięcie bloku (albo jego wystąpień) usuwa też zadania.

-- Luźne zadania (bez bloku) są usuwane (zgoda Mejsona z 23.11 i 24.11).
delete from public.tasks as t where t.block_id is null;

-- Wyzwalacz odpinający zadania przy usuwaniu bloku nie jest już potrzebny.
drop trigger blocks_detach_tasks_before_delete on public.blocks;
drop function public.detach_tasks_before_block_delete();

alter table public.tasks drop constraint tasks_block_occurrence_check;
alter table public.tasks alter column block_id set not null;
alter table public.tasks alter column occurrence_date set not null;

-- Usunięcie bloku usuwa jego zadania (dotąd on delete set null).
alter table public.tasks drop constraint tasks_block_id_fkey;
alter table public.tasks
  add constraint tasks_block_id_fkey foreign key (block_id) references public.blocks (id) on delete cascade;

-- Rozcina serię od daty p_from ("to i następne").
-- Edycja (p_delete = false): stara seria kończy się dzień przed p_from (albo znika, gdy p_from to pierwsze wystąpienie),
-- powstaje nowa seria od p_from z zastosowanym p_patch, a zadania i wyjątki od p_from przechodzą do niej.
-- Przy zmianie godziny, czasu trwania lub powtarzalności zmienione wystąpienia (kind = 'modified') są kasowane,
-- a odwołane przechodzą do nowej serii (przy nowej powtarzalności tylko te, które wciąż do niej należą).
-- Zwraca id nowej serii.
-- Usuwanie (p_delete = true): zadania od p_from są usuwane razem z wystąpieniami, zwraca null.
-- Cudzy lub nieistniejący blok (RLS go ukrywa) kończy się błędem, bez żadnych zmian.
-- p_from musi być datą wystąpienia policzoną przez aplikację: p_from <= data startu bloku oznacza całą serię
-- (p_from przed startem albo po końcu serii (recurrence.until) to błąd 22023, żeby nie wydłużać serii).
-- Gdy patch zawiera recurrence, do nowej serii przechodzą zadania od p_from z dni należących do nowego wzorca
-- (due_date = dzień wystąpienia), a pozostałe są usuwane; recurrence.until przed p_from to błąd 22023.
create or replace function public.split_block_series(
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
    -- Zadania od p_from są usuwane razem z wystąpieniami.
    delete from public.tasks as t
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

  -- Nowa seria nie może kończyć się przed swoim pierwszym dniem
  if v_recurrence ? 'until' and (v_recurrence ->> 'until')::date < p_from then
    raise exception 'until_before_p_from' using errcode = '22023';
  end if;

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
    -- Zmiana wzorca powtarzania: zadania z dni spoza nowego wzorca są usuwane
    -- (nowa seria bez powtarzania to jeden blok w dniu p_from, więc zostaje tylko zadanie z p_from).
    -- Dzień tygodnia: 1 = pn … 7 = nd; "weekly" powtarza dzień tygodnia p_from.
    delete from public.tasks as t
    where t.block_id = p_block_id
      and t.occurrence_date >= p_from
      and not (
        case
          when v_recurrence is null then t.occurrence_date = p_from
          when v_recurrence ? 'until' and t.occurrence_date > (v_recurrence ->> 'until')::date then false
          else (
            v_recurrence ->> 'freq' = 'daily'
            or (v_recurrence ->> 'freq' = 'weekdays' and extract(isodow from t.occurrence_date) <= 5)
            or (v_recurrence ->> 'freq' = 'weekly'
              and extract(isodow from t.occurrence_date) = extract(isodow from p_from))
            or (v_recurrence ->> 'freq' = 'custom'
              and coalesce(v_recurrence -> 'byWeekday', '[]'::jsonb)
                @> to_jsonb(extract(isodow from t.occurrence_date)::int))
          )
        end
      );
    -- Pozostałe zadania (dni wciąż w nowym wzorcu) przechodzą do nowej serii;
    -- przesunięcia wystąpień znikają, więc termin wraca na dzień wystąpienia.
    update public.tasks as t
    set block_id = v_new_id, due_date = t.occurrence_date
    where t.block_id = p_block_id and t.occurrence_date >= p_from;

    -- Zmienione wystąpienia oraz odwołania z dni spoza nowego wzorca są kasowane
    -- (nowa seria bez powtarzania to jeden blok, więc kasujemy wszystko).
    delete from public.block_exceptions as e
    where e.block_id = p_block_id
      and e.occurrence_date >= p_from
      and (
        e.kind = 'modified'
        or v_recurrence is null
        or (v_recurrence ? 'until' and e.occurrence_date > (v_recurrence ->> 'until')::date)
        or not (
          v_recurrence ->> 'freq' = 'daily'
          or (v_recurrence ->> 'freq' = 'weekdays' and extract(isodow from e.occurrence_date) <= 5)
          or (v_recurrence ->> 'freq' = 'weekly'
            and extract(isodow from e.occurrence_date) = extract(isodow from p_from))
          or (v_recurrence ->> 'freq' = 'custom'
            and coalesce(v_recurrence -> 'byWeekday', '[]'::jsonb)
              @> to_jsonb(extract(isodow from e.occurrence_date)::int))
        )
      );
    -- Pozostałe odwołania (dni wciąż w nowym wzorcu) przechodzą do nowej serii.
    update public.block_exceptions as e
    set block_id = v_new_id
    where e.block_id = p_block_id and e.occurrence_date >= p_from;
  else
    -- Zadania od p_from przechodzą do nowej serii. Przy zmianie godziny lub czasu trwania przesunięcia
    -- pojedynczych wystąpień znikają, więc termin zadań wraca na dzień wystąpienia.
    update public.tasks as t
    set block_id = v_new_id,
        due_date = case when v_time_changed then t.occurrence_date else t.due_date end
    where t.block_id = p_block_id and t.occurrence_date >= p_from;

    -- Przy zmianie godziny lub czasu trwania kasujemy zmienione wystąpienia; odwołania zostają.
    if v_time_changed then
      delete from public.block_exceptions as e
      where e.block_id = p_block_id and e.occurrence_date >= p_from and e.kind = 'modified';
    end if;
    -- Pozostałe wyjątki od p_from przechodzą do nowej serii.
    update public.block_exceptions as e
    set block_id = v_new_id
    where e.block_id = p_block_id and e.occurrence_date >= p_from;
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
