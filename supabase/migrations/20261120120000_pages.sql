-- Etap 6: strony — strony, bloki, pola i wiersze tabel, RLS, funkcje SQL i cykliczne czyszczenie kosza.

-- Strony użytkownika (edytor bloków albo strona-tabela z szablonu).
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null default '' check (char_length(title) <= 200),
  icon text not null default '▦',
  template_key text check (template_key in ('empty', 'books', 'projects', 'websites', 'subscriptions', 'passwords')),
  position int not null default 0,
  favorite boolean not null default false,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- Bloki strony: tekst, nagłówek, zadanie, separator albo tabela.
create table public.page_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  type text not null check (type in ('text', 'heading', 'todo', 'divider', 'table')),
  position int not null default 0,
  content jsonb not null default '{}',
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- Pola (kolumny) bloku tabeli.
create table public.page_fields (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.page_blocks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  type text not null check (type in ('text', 'number', 'checkbox', 'url', 'select', 'status', 'date', 'rating')),
  config jsonb not null default '{}',
  position int not null default 0,
  is_title boolean not null default false
);

-- Wiersze bloku tabeli; wartości w jsonb pod kluczem id pola.
create table public.page_rows (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.page_blocks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  values jsonb not null default '{}',
  remind boolean not null default true,
  position int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- Lista stron użytkownika w kolejności
create index pages_user_id_position_idx on public.pages (user_id, position) where deleted_at is null;
-- Bloki strony, pola i wiersze bloku w kolejności (także kaskady z kluczy obcych)
create index page_blocks_page_id_position_idx on public.page_blocks (page_id, position);
create index page_fields_block_id_position_idx on public.page_fields (block_id, position);
create index page_rows_block_id_position_idx on public.page_rows (block_id, position);
-- Czyszczenie kosza po deleted_at
create index pages_deleted_at_idx on public.pages (deleted_at) where deleted_at is not null;
create index page_blocks_deleted_at_idx on public.page_blocks (deleted_at) where deleted_at is not null;
create index page_rows_deleted_at_idx on public.page_rows (deleted_at) where deleted_at is not null;
-- Polityki RLS i kaskada z auth.users po user_id
create index page_blocks_user_id_idx on public.page_blocks (user_id);
create index page_fields_user_id_idx on public.page_fields (user_id);
create index page_rows_user_id_idx on public.page_rows (user_id);

-- updated_at wiersza tabeli odświeżany przy każdej zmianie.
create function public.page_rows_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger page_rows_set_updated_at
  before update on public.page_rows
  for each row execute function public.page_rows_set_updated_at();

revoke execute on function public.page_rows_set_updated_at() from public, anon;

alter table public.pages enable row level security;
alter table public.page_blocks enable row level security;
alter table public.page_fields enable row level security;
alter table public.page_rows enable row level security;

-- Strony: tylko własne wiersze.
create policy "pages_own" on public.pages
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Bloki: własne wiersze, a strona musi należeć do tego samego użytkownika.
create policy "page_blocks_own" on public.page_blocks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.pages as p
      where p.id = page_blocks.page_id and p.user_id = (select auth.uid())
    )
  );

-- Pola: własne wiersze, a blok musi należeć do tego samego użytkownika.
create policy "page_fields_own" on public.page_fields
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.page_blocks as b
      where b.id = page_fields.block_id and b.user_id = (select auth.uid())
    )
  );

-- Wiersze: własne wiersze, a blok musi należeć do tego samego użytkownika.
create policy "page_rows_own" on public.page_rows
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.page_blocks as b
      where b.id = page_rows.block_id and b.user_id = (select auth.uid())
    )
  );

-- Jawne uprawnienia do tabel (chmura Supabase nie nadaje ich automatycznie); dostęp do wierszy ogranicza RLS.
grant select, insert, update, delete on public.pages to authenticated;
grant select, insert, update, delete on public.page_blocks to authenticated;
grant select, insert, update, delete on public.page_fields to authenticated;
grant select, insert, update, delete on public.page_rows to authenticated;
grant all on public.pages, public.page_blocks, public.page_fields, public.page_rows to service_role;

-- Tworzy stronę z blokami, polami i wierszami w jednej transakcji.
-- p_blocks: [{id?, type, content, fields: [{id?, name, type, config, is_title}], rows: [{values}]}].
-- Id bloków i pól można podać (UUID-y z klienta, bo ustawienia wskazują id pól); bez id powstaje nowe.
-- Pozycje wynikają z kolejności w tablicach, strona trafia na koniec listy.
create function public.create_page(p_title text, p_icon text, p_template_key text, p_blocks jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_page_id uuid;
  v_block jsonb;
  v_block_idx bigint;
  v_block_id uuid;
  v_field jsonb;
  v_field_idx bigint;
  v_row jsonb;
  v_row_idx bigint;
begin
  insert into public.pages (title, icon, template_key, position)
  values (
    coalesce(p_title, ''),
    coalesce(p_icon, '▦'),
    p_template_key,
    (select coalesce(max(p.position), -1) + 1 from public.pages as p where p.user_id = auth.uid() and p.deleted_at is null)
  )
  returning id into v_page_id;

  for v_block, v_block_idx in
    select e.value, e.ordinality - 1 from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) with ordinality as e
  loop
    v_block_id := coalesce((v_block ->> 'id')::uuid, gen_random_uuid());

    insert into public.page_blocks (id, page_id, type, position, content)
    values (v_block_id, v_page_id, v_block ->> 'type', v_block_idx, coalesce(v_block -> 'content', '{}'::jsonb));

    for v_field, v_field_idx in
      select e.value, e.ordinality - 1 from jsonb_array_elements(coalesce(v_block -> 'fields', '[]'::jsonb)) with ordinality as e
    loop
      insert into public.page_fields (id, block_id, name, type, config, position, is_title)
      values (
        coalesce((v_field ->> 'id')::uuid, gen_random_uuid()),
        v_block_id,
        v_field ->> 'name',
        v_field ->> 'type',
        coalesce(v_field -> 'config', '{}'::jsonb),
        v_field_idx,
        coalesce((v_field ->> 'is_title')::boolean, false)
      );
    end loop;

    for v_row, v_row_idx in
      select e.value, e.ordinality - 1 from jsonb_array_elements(coalesce(v_block -> 'rows', '[]'::jsonb)) with ordinality as e
    loop
      insert into public.page_rows (block_id, values, position)
      values (v_block_id, coalesce(v_row -> 'values', '{}'::jsonb), v_row_idx);
    end loop;
  end loop;

  return v_page_id;
end;
$$;

-- Duplikuje stronę (bez usuniętych bloków i wierszy) zaraz za oryginałem.
-- Id pól w kluczach values wierszy i w content.settings bloku (sort, filters, hidden_field_ids, column_summaries,
-- pinned_cards) podmieniamy zwykłym zastąpieniem tekstu old -> new w jsonb::text; UUID-y są unikalne, więc to bezpieczne.
create function public.duplicate_page(p_page_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_page public.pages;
  v_new_page_id uuid;
  v_block public.page_blocks;
  v_new_block_id uuid;
  v_field public.page_fields;
  v_row public.page_rows;
  v_content text;
  v_values text;
  v_map jsonb;
  v_pair record;
begin
  select * into v_page from public.pages as p where p.id = p_page_id and p.deleted_at is null;
  if not found then
    raise exception 'Nie znaleziono strony' using errcode = 'P0002';
  end if;

  -- Kopia trafia zaraz za oryginał, późniejsze strony przesuwają się o 1.
  update public.pages as p
  set position = p.position + 1
  where p.user_id = auth.uid() and p.deleted_at is null and p.position > v_page.position;

  insert into public.pages (title, icon, template_key, position, favorite)
  -- Strona bez tytułu daje „Bez tytułu (kopia)”, a nie „ (kopia)” ze spacją na początku.
  values (
    case when btrim(v_page.title) = '' then 'Bez tytułu' else left(v_page.title, 191) end || ' (kopia)',
    v_page.icon, v_page.template_key, v_page.position + 1, false
  )
  returning id into v_new_page_id;

  for v_block in
    select * from public.page_blocks as b where b.page_id = p_page_id and b.deleted_at is null order by b.position
  loop
    v_new_block_id := gen_random_uuid();
    v_content := v_block.content::text;
    v_map := '{}'::jsonb;

    insert into public.page_blocks (id, page_id, type, position, content)
    values (v_new_block_id, v_new_page_id, v_block.type, v_block.position, '{}'::jsonb);

    for v_field in
      select * from public.page_fields as f where f.block_id = v_block.id order by f.position
    loop
      v_map := v_map || jsonb_build_object(v_field.id::text, gen_random_uuid()::text);
      insert into public.page_fields (id, block_id, name, type, config, position, is_title)
      values ((v_map ->> v_field.id::text)::uuid, v_new_block_id, v_field.name, v_field.type, v_field.config, v_field.position, v_field.is_title);
      v_content := replace(v_content, v_field.id::text, v_map ->> v_field.id::text);
    end loop;

    update public.page_blocks as b set content = v_content::jsonb where b.id = v_new_block_id;

    for v_row in
      select * from public.page_rows as r where r.block_id = v_block.id and r.deleted_at is null order by r.position
    loop
      v_values := v_row.values::text;
      for v_pair in select m.key, m.value #>> '{}' as new_id from jsonb_each(v_map) as m loop
        v_values := replace(v_values, v_pair.key, v_pair.new_id);
      end loop;
      insert into public.page_rows (block_id, values, remind, position)
      values (v_new_block_id, v_values::jsonb, v_row.remind, v_row.position);
    end loop;
  end loop;

  return v_new_page_id;
end;
$$;

-- Atomowo zdejmuje z profiles.pending_pages podane nazwy i zwraca je w kolejności z pending_pages.
-- Dopiero po onboardingu (onboarded_at): wcześniej krok 5 kreatora może jeszcze przepisać pending_pages.
create function public.claim_pending_pages(p_available text[])
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pending text[];
  v_claimed text[];
begin
  -- Bez części wspólnej wychodzimy bez blokady i zapisu (zwykła nawigacja nie dotyka profilu).
  select pr.pending_pages into v_pending
  from public.profiles as pr
  where pr.user_id = auth.uid() and pr.onboarded_at is not null;

  if v_pending is null or not (v_pending && coalesce(p_available, '{}'::text[])) then
    return '{}'::text[];
  end if;

  -- Ponowny odczyt pod blokadą, żeby równoległe wywołania nie zdublowały wyniku.
  select pr.pending_pages into v_pending
  from public.profiles as pr
  where pr.user_id = auth.uid() and pr.onboarded_at is not null
  for update;

  if v_pending is null then
    return '{}'::text[];
  end if;

  v_claimed := array(
    select t.name from unnest(v_pending) with ordinality as t(name, ord)
    where t.name = any (coalesce(p_available, '{}'::text[])) order by t.ord
  );

  update public.profiles as pr
  set pending_pages = array(
    select t.name from unnest(v_pending) with ordinality as t(name, ord)
    where not (t.name = any (coalesce(p_available, '{}'::text[]))) order by t.ord
  )
  where pr.user_id = auth.uid();

  return v_claimed;
end;
$$;

-- Zmienia typ pola i przelicza wartości wierszy jedną transakcją.
-- p_values: {row_id: nowa wartość | null}; null usuwa klucz z values. Klient liczy wartości tylko dla żywych
-- wierszy, więc wierszom z kosza spoza p_values klucz pola znika (po przywróceniu nie niosą starego typu).
create function public.change_field_type(p_field_id uuid, p_type text, p_config jsonb, p_values jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_block_id uuid;
  v_is_title boolean;
  v_item record;
begin
  select f.block_id, f.is_title into v_block_id, v_is_title
  from public.page_fields as f
  where f.id = p_field_id;

  if not found then
    raise exception 'Nie znaleziono pola' using errcode = 'P0002';
  end if;
  if v_is_title then
    raise exception 'Typu pola tytułowego nie można zmienić';
  end if;

  update public.page_fields as f
  set type = p_type, config = coalesce(p_config, '{}'::jsonb)
  where f.id = p_field_id;

  for v_item in select e.key, e.value from jsonb_each(coalesce(p_values, '{}'::jsonb)) as e loop
    update public.page_rows as r
    set values = case
      when v_item.value = 'null'::jsonb then r.values - p_field_id::text
      else jsonb_set(r.values, array[p_field_id::text], v_item.value)
    end
    where r.id = v_item.key::uuid and r.block_id = v_block_id;
  end loop;

  update public.page_rows as r
  set values = r.values - p_field_id::text
  where r.block_id = v_block_id
    and r.deleted_at is not null
    and r.values ? p_field_id::text
    and not (coalesce(p_values, '{}'::jsonb) ? r.id::text);
end;
$$;

-- Usuwa pole (nie tytułowe) razem z jego śladami: kluczem w values wszystkich wierszy bloku (także z kosza,
-- także z wartością null) oraz odwołaniami w content.settings (sort, filters, hidden_field_ids, column_summaries, pinned_cards).
create function public.delete_field(p_field_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_block_id uuid;
  v_is_title boolean;
  v_id text := p_field_id::text;
  v_settings jsonb;
begin
  select f.block_id, f.is_title into v_block_id, v_is_title
  from public.page_fields as f
  where f.id = p_field_id;

  if not found then
    raise exception 'Nie znaleziono pola' using errcode = 'P0002';
  end if;
  if v_is_title then
    raise exception 'Pola tytułowego nie można usunąć';
  end if;

  update public.page_rows as r
  set values = r.values - v_id
  where r.block_id = v_block_id and r.values ? v_id;

  select b.content -> 'settings' into v_settings
  from public.page_blocks as b
  where b.id = v_block_id;

  if jsonb_typeof(v_settings) = 'object' then
    if jsonb_typeof(v_settings -> 'sort') = 'array' then
      v_settings := v_settings || jsonb_build_object('sort', coalesce(
        (select jsonb_agg(e.el) from jsonb_array_elements(v_settings -> 'sort') as e(el)
         where (e.el ->> 'field_id') is distinct from v_id), '[]'::jsonb));
    end if;
    if jsonb_typeof(v_settings -> 'filters') = 'array' then
      v_settings := v_settings || jsonb_build_object('filters', coalesce(
        (select jsonb_agg(e.el) from jsonb_array_elements(v_settings -> 'filters') as e(el)
         where (e.el ->> 'field_id') is distinct from v_id), '[]'::jsonb));
    end if;
    if jsonb_typeof(v_settings -> 'hidden_field_ids') = 'array' then
      v_settings := v_settings || jsonb_build_object('hidden_field_ids', coalesce(
        (select jsonb_agg(e.el) from jsonb_array_elements(v_settings -> 'hidden_field_ids') as e(el)
         where (e.el #>> '{}') is distinct from v_id), '[]'::jsonb));
    end if;
    if jsonb_typeof(v_settings -> 'column_summaries') = 'object' then
      v_settings := v_settings || jsonb_build_object('column_summaries', coalesce(
        (select jsonb_object_agg(e.key, e.value) from jsonb_each(v_settings -> 'column_summaries') as e
         where e.key <> v_id and (e.value -> 'where' ->> 'field_id') is distinct from v_id), '{}'::jsonb));
    end if;
    if jsonb_typeof(v_settings -> 'pinned_cards') = 'array' then
      v_settings := v_settings || jsonb_build_object('pinned_cards', coalesce(
        (select jsonb_agg(e.el) from jsonb_array_elements(v_settings -> 'pinned_cards') as e(el)
         where (e.el ->> 'field_id') is distinct from v_id
           and (e.el ->> 'date_field_id') is distinct from v_id
           and (e.el ->> 'title_field_id') is distinct from v_id), '[]'::jsonb));
    end if;

    update public.page_blocks as b
    set content = jsonb_set(b.content, '{settings}', v_settings)
    where b.id = v_block_id;
  end if;

  delete from public.page_fields as f where f.id = p_field_id;
end;
$$;

-- Przepisuje pozycje stron według kolejności id.
create function public.reorder_pages(p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.pages as p
  set position = u.ord - 1
  from unnest(p_ids) with ordinality as u(id, ord)
  where p.id = u.id;
$$;

-- Przepisuje pozycje pól bloku według kolejności id.
create function public.reorder_fields(p_block_id uuid, p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.page_fields as f
  set position = u.ord - 1
  from unnest(p_ids) with ordinality as u(id, ord)
  where f.id = u.id and f.block_id = p_block_id;
$$;

-- Trwale usuwa wiersze, bloki i strony z kosza starsze niż 30 dni (wołane tylko przez pg_cron).
create function public.purge_trash()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.page_rows as r where r.deleted_at < now() - interval '30 days';
  delete from public.page_blocks as b where b.deleted_at < now() - interval '30 days';
  delete from public.pages as p where p.deleted_at < now() - interval '30 days';
$$;

revoke execute on function public.create_page(text, text, text, jsonb) from public, anon;
revoke execute on function public.duplicate_page(uuid) from public, anon;
revoke execute on function public.claim_pending_pages(text[]) from public, anon;
revoke execute on function public.change_field_type(uuid, text, jsonb, jsonb) from public, anon;
revoke execute on function public.delete_field(uuid) from public, anon;
revoke execute on function public.reorder_pages(uuid[]) from public, anon;
revoke execute on function public.reorder_fields(uuid, uuid[]) from public, anon;
revoke execute on function public.purge_trash() from public, anon, authenticated;
grant execute on function public.create_page(text, text, text, jsonb) to authenticated;
grant execute on function public.duplicate_page(uuid) to authenticated;
grant execute on function public.claim_pending_pages(text[]) to authenticated;
grant execute on function public.change_field_type(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.delete_field(uuid) to authenticated;
grant execute on function public.reorder_pages(uuid[]) to authenticated;
grant execute on function public.reorder_fields(uuid, uuid[]) to authenticated;

-- Codzienne czyszczenie kosza o 03:17; odpięcie istniejącego zadania robi migrację idempotentną.
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(j.jobid) from cron.job as j where j.jobname = 'rhytm-purge-trash';
select cron.schedule('rhytm-purge-trash', '17 3 * * *', 'select public.purge_trash()');
