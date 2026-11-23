-- Strony 2.0: ikony stron jako `lucide:<nazwa>` albo '' (brak → domyślna tabela). Koniec z emoji i kolorami ikon.

-- Zamienia starą wartość pages.icon (emoji, `lucide:<nazwa>:<kolor>`, `lucide:<nazwa>`, śmieci) na nowy format.
-- Wariant emoji z selektorem wariantu (U+FE0F) traktujemy tak samo jak bez niego.
create function public.page_icon_lucide(p_old text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    case
      -- Nowy lub dawny zapis z kolorem: zostaje sama nazwa.
      when p_old ~ '^lucide:[a-z0-9]+(-[a-z0-9]+)*(:[a-z]+)?$' then 'lucide:' || split_part(p_old, ':', 2)
      else case replace(p_old, chr(65039), '')
        when '📚' then 'lucide:book-open'
        when '📖' then 'lucide:book'
        when '📝' then 'lucide:notebook-pen'
        when '📁' then 'lucide:folder'
        when '🗂' then 'lucide:folder-archive'
        when '💼' then 'lucide:briefcase'
        when '💻' then 'lucide:laptop'
        when '🌐' then 'lucide:globe'
        when '🚀' then 'lucide:rocket'
        when '🎯' then 'lucide:target'
        when '💡' then 'lucide:lightbulb'
        when '🧠' then 'lucide:brain'
        when '🎓' then 'lucide:graduation-cap'
        when '📅' then 'lucide:calendar'
        when '✅' then 'lucide:circle-check'
        when '⭐' then 'lucide:star'
        when '❤' then 'lucide:heart'
        when '💪' then 'lucide:dumbbell'
        when '🏃' then 'lucide:footprints'
        when '🚴' then 'lucide:bike'
        when '🧘' then 'lucide:flower-2'
        when '😴' then 'lucide:bed'
        when '🍎' then 'lucide:apple'
        when '☕' then 'lucide:coffee'
        when '🍕' then 'lucide:pizza'
        when '🎬' then 'lucide:clapperboard'
        when '🎵' then 'lucide:music'
        when '🎮' then 'lucide:gamepad-2'
        when '📷' then 'lucide:camera'
        when '🎨' then 'lucide:palette'
        when '✈' then 'lucide:plane'
        when '🏠' then 'lucide:house'
        when '🚗' then 'lucide:car'
        when '🌱' then 'lucide:sprout'
        when '🔥' then 'lucide:flame'
        when '⚡' then 'lucide:zap'
        when '💰' then 'lucide:coins'
        when '💳' then 'lucide:wallet'
        when '🔒' then 'lucide:lock'
        when '🔑' then 'lucide:key'
        when '🛒' then 'lucide:shopping-cart'
        when '🎁' then 'lucide:gift'
        when '👥' then 'lucide:users'
        when '👤' then 'lucide:user'
        when '📈' then 'lucide:trending-up'
        when '📊' then 'lucide:chart-column'
        when '🔧' then 'lucide:wrench'
        when '⚙' then 'lucide:settings'
        when '🏆' then 'lucide:trophy'
        when '🌍' then 'lucide:earth'
        when '☀' then 'lucide:sun'
        when '🌙' then 'lucide:moon'
        when '🐶' then 'lucide:dog'
        when '🎉' then 'lucide:party-popper'
        when '📦' then 'lucide:package'
        when '🧾' then 'lucide:receipt'
      end
    end,
    ''
  );
$$;

revoke execute on function public.page_icon_lucide(text) from public, anon;
grant execute on function public.page_icon_lucide(text) to authenticated;

-- Wszystkie strony (także w koszu) przechodzą na nowy format.
update public.pages as p
set icon = public.page_icon_lucide(p.icon)
where p.icon <> public.page_icon_lucide(p.icon);

-- Constraint dopiero po aktualizacji, żeby istniejące wiersze go spełniały. pages_icon_length zostaje.
alter table public.pages add constraint pages_icon_format
  check (icon = '' or icon ~ '^lucide:[a-z0-9]+(-[a-z0-9]+)*$');

-- create_page: bez podanej ikony zostaje '' (wcześniej '▦'); reszta ciała bez zmian.
create or replace function public.create_page(p_title text, p_icon text, p_template_key text, p_blocks jsonb)
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
    coalesce(p_icon, ''),
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
