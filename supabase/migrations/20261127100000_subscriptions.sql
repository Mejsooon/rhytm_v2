-- Subscriptions: dwa nowe typy pól (Kwota cykliczna = recurring, Data odnowienia = renewal) oraz dwie funkcje,
-- które wiedzą o odwołaniach między polami tego samego bloku (config.cycle_field_id, config.active_field_id).
-- Migracja jest wstecznie zgodna i nie zmienia danych: rozszerza constraint typu pola, a duplicate_page
-- i delete_field przy starych danych (bez odwołań w config) działają dokładnie jak dotąd.

alter table public.page_fields drop constraint if exists page_fields_type_check;
alter table public.page_fields add constraint page_fields_type_check
  check (type in ('text', 'number', 'checkbox', 'url', 'select', 'status', 'date', 'rating', 'secret', 'recurring', 'renewal'));

-- duplicate_page: kopia strony nie może wskazywać pól oryginału. Pierwsze przejście po polach bloku buduje mapę
-- id stare → nowe, drugie wstawia pola z config przepisanym tą samą zamianą tekstu co content i values.
-- Blokada strony systemowej (Hasła) zostaje. Reszta ciała bez zmian.
create or replace function public.duplicate_page(p_page_id uuid)
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
  v_config text;
  v_map jsonb;
  v_pair record;
begin
  select * into v_page from public.pages as p where p.id = p_page_id and p.deleted_at is null;
  if not found then
    raise exception 'Nie znaleziono strony' using errcode = 'P0002';
  end if;
  if v_page.is_system then
    raise exception 'Strony Hasła nie można zduplikować';
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

    -- Pierwsze przejście: mapa id pól bloku (stare → nowe).
    for v_field in
      select * from public.page_fields as f where f.block_id = v_block.id order by f.position
    loop
      v_map := v_map || jsonb_build_object(v_field.id::text, gen_random_uuid()::text);
      v_content := replace(v_content, v_field.id::text, v_map ->> v_field.id::text);
    end loop;

    -- Drugie przejście: pola z config przepisanym przez mapę (odwołania do pól tego samego bloku).
    for v_field in
      select * from public.page_fields as f where f.block_id = v_block.id order by f.position
    loop
      v_config := v_field.config::text;
      for v_pair in select m.key, m.value #>> '{}' as new_id from jsonb_each(v_map) as m loop
        v_config := replace(v_config, v_pair.key, v_pair.new_id);
      end loop;
      insert into public.page_fields (id, block_id, name, type, config, position, is_title)
      values ((v_map ->> v_field.id::text)::uuid, v_new_block_id, v_field.name, v_field.type, v_config::jsonb, v_field.position, v_field.is_title);
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

-- delete_field: oprócz dotychczasowego sprzątania (wartości, ustawienia bloku) usuwa z config innych pól bloku
-- klucze cycle_field_id i active_field_id, jeśli wskazują usuwane pole. Reszta ciała bez zmian.
create or replace function public.delete_field(p_field_id uuid)
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

  update public.page_fields as f
  set config = f.config - 'cycle_field_id'
  where f.block_id = v_block_id and f.config ->> 'cycle_field_id' = v_id;
  update public.page_fields as f
  set config = f.config - 'active_field_id'
  where f.block_id = v_block_id and f.config ->> 'active_field_id' = v_id;

  delete from public.page_fields as f where f.id = p_field_id;
end;
$$;

revoke execute on function public.duplicate_page(uuid) from public, anon;
revoke execute on function public.delete_field(uuid) from public, anon;
grant execute on function public.duplicate_page(uuid) to authenticated;
grant execute on function public.delete_field(uuid) to authenticated;
