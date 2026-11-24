-- Obrona w głąb modułu Hasła (B4, M3, B5): baza sama pilnuje wierszy z polem Sekret.
-- - page_rows_guard: pod polem Sekret zapisze się tylko szyfrogram {v, g, iv, ct} z generation aktywnego sejfu,
--   a wiersz modułu Hasła nie przechodzi do zwykłego bloku (ani odwrotnie);
-- - reset_vault blokuje wiersz sejfu (FOR UPDATE), więc zapis sekretu (FOR SHARE w strażniku) i reset się nie mijają;
-- - pages_system_guard nie przywraca z kosza zwykłej strony z polem Sekret.
-- Migracja niczego nie usuwa ani nie zmienia w danych; strażnik sprawdza tylko nowe i zmienione wartości.

-- Strażnik wierszy tabel stron. Funkcje systemowe omijają go przez rhytm.system_write = 'on', jak pozostałych strażników.
create function public.page_rows_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_field_id uuid;
  v_value jsonb;
  v_generations text[] := array[]::text[];
  v_status text;
  v_generation int;
begin
  if coalesce(current_setting('rhytm.system_write', true), '') = 'on' then
    return new;
  end if;

  -- Wiersz modułu Hasła nie wychodzi z jego bloku, a zwykły wiersz do niego nie wchodzi
  -- (inaczej szyfrogram trafiłby pod zwykłe pole albo jawny tekst pod Sekret bez sprawdzenia kształtu).
  if tg_op = 'UPDATE' and new.block_id is distinct from old.block_id and exists (
    select 1 from public.page_blocks as b
    join public.pages as p on p.id = b.page_id
    where b.id in (old.block_id, new.block_id) and p.is_system
  ) then
    raise exception 'Wiersza modułu Hasła nie można przenieść';
  end if;

  -- Kształt każdej nowej albo zmienionej wartości Sekret (null zawsze przechodzi: reset sejfu, czyszczenie komórki).
  -- Stare wartości bez zmian nie są sprawdzane, żeby wiersz ze starym g dało się edytować w innych kolumnach.
  for v_field_id in
    select f.id from public.page_fields as f where f.block_id = new.block_id and f.type = 'secret'
  loop
    v_value := new.values -> v_field_id::text;
    if v_value is null or jsonb_typeof(v_value) = 'null' then
      continue;
    end if;
    if tg_op = 'UPDATE' and v_value is not distinct from (old.values -> v_field_id::text) then
      continue;
    end if;

    -- Najpierw sam typ: jsonb_object_keys na wartości innej niż obiekt rzuca własny błąd.
    if jsonb_typeof(v_value) <> 'object' then
      raise exception 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość';
    end if;
    -- Dokładnie v, g, iv, ct; v = 1; g całkowite ≥ 1 (bez zer wiodących, porównywane z generation jako tekst);
    -- iv = 16 znaków base64 (12 B), ct = 24–8192 znaków base64 (co najmniej sam tag GCM).
    if not (
      (select count(*) from jsonb_object_keys(v_value)) = 4
      and v_value ?& array['v', 'g', 'iv', 'ct']
      and jsonb_typeof(v_value -> 'v') = 'number'
      and (v_value ->> 'v') = '1'
      and jsonb_typeof(v_value -> 'g') = 'number'
      and (v_value ->> 'g') ~ '^[1-9][0-9]*$'
      and jsonb_typeof(v_value -> 'iv') = 'string'
      and length(v_value ->> 'iv') = 16
      and (v_value ->> 'iv') ~ '^[A-Za-z0-9+/]*={0,2}$'
      and jsonb_typeof(v_value -> 'ct') = 'string'
      and length(v_value ->> 'ct') between 24 and 8192
      and (v_value ->> 'ct') ~ '^[A-Za-z0-9+/]*={0,2}$'
    ) then
      raise exception 'Pole Sekret przyjmuje tylko zaszyfrowaną wartość';
    end if;

    v_generations := v_generations || (v_value ->> 'g');
  end loop;

  -- Sejf musi być aktywny, a każdy nowy szyfrogram z jego bieżącej generacji. FOR SHARE czeka na trwający reset_vault
  -- (FOR UPDATE): zapis po resecie widzi już nowe generation i zostaje odrzucony.
  if cardinality(v_generations) > 0 then
    select v.status, v.generation into v_status, v_generation
    from public.vaults as v
    where v.user_id = new.user_id
    for share;

    if not found or v_status <> 'active' or not (v_generation::text = all (v_generations)) then
      raise exception 'Sejf zmienił się albo jest zablokowany';
    end if;
  end if;

  return new;
end;
$$;

create trigger page_rows_guard
  before insert or update on public.page_rows
  for each row execute function public.page_rows_guard();

revoke execute on function public.page_rows_guard() from public, anon, authenticated;

-- reset_vault: ciało jak w 20261121180000_vault.sql, na początku blokada wiersza sejfu (szeregowanie z zapisem sekretu).
create or replace function public.reset_vault()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  -- Zapis sekretu trwający przed resetem kończy się przed nim (i reset go wyczyści),
  -- a zapis po resecie zobaczy podbite generation.
  perform 1 from public.vaults as v where v.user_id = auth.uid() for update;

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

revoke execute on function public.reset_vault() from public, anon;
grant execute on function public.reset_vault() to authenticated;

-- pages_system_guard: pełna kopia z 20261125100000_passwords_module.sql, a w gałęzi UPDATE nowy warunek:
-- zwykłej strony z polem Sekret (stary układ sprzed modułu) nie przywraca się z kosza, bo Sekret żyje tylko w module Hasła.
create or replace function public.pages_system_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('rhytm.system_write', true), '') = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.is_system then
      raise exception 'Strony systemowej nie można utworzyć ręcznie';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.is_system is distinct from old.is_system then
      raise exception 'Flagi strony systemowej nie można zmienić';
    end if;
    if old.is_system and (
      new.title is distinct from old.title
      or new.icon is distinct from old.icon
      or new.deleted_at is distinct from old.deleted_at
      or new.template_key is distinct from old.template_key
      or new.user_id is distinct from old.user_id
    ) then
      raise exception 'Strony Hasła nie można przemianować, zmienić jej ikony ani przenieść do kosza';
    end if;
    if old.deleted_at is not null and new.deleted_at is null and not new.is_system and exists (
      select 1 from public.page_blocks as b
      join public.page_fields as f on f.block_id = b.id
      where b.page_id = new.id and f.type = 'secret'
    ) then
      raise exception 'Strony z polem Sekret nie można przywrócić poza modułem Hasła';
    end if;
    return new;
  end if;

  -- DELETE: kaskada po usunięciu konta (użytkownika już nie ma w auth.users) przechodzi.
  if old.is_system and exists (select 1 from auth.users as u where u.id = old.user_id) then
    raise exception 'Strony Hasła nie można usunąć';
  end if;
  return old;
end;
$$;

revoke execute on function public.pages_system_guard() from public, anon, authenticated;
