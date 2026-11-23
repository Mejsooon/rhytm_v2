-- Strony 2.0, krok 3: Hasła jako moduł. Każdy użytkownik ma co najwyżej jedną stronę systemową (is_system)
-- z blokiem tabeli i stałymi kolumnami: Serwis, Login, Hasło, URL, Kategoria, Notatka.
-- Pole Sekret istnieje tylko na stronie systemowej. Strony, jej bloku ani kolumn nie da się usunąć, przenieść,
-- zduplikować ani przebudować; wolno zmieniać config kolumn (opcje Kategorii), ustawienia bloku i wiersze.
-- Funkcje systemowe (ensure_passwords_page, adopt_passwords_page) omijają wyzwalacze przez lokalną zmienną
-- transakcji rhytm.system_write = 'on'; klient przez PostgREST nie może jej ustawić.

-- Warunek wstępny: pole Sekret tylko na stronach z szablonu passwords (także w koszu). Inaczej przerywamy,
-- bo po migracji takie pole nie miałoby gdzie żyć.
do $$
declare
  v_count int;
begin
  select count(*)::int into v_count
  from public.page_fields as f
  join public.page_blocks as b on b.id = f.block_id
  join public.pages as p on p.id = b.page_id
  where f.type = 'secret'
    and p.template_key is distinct from 'passwords';

  if v_count > 0 then
    raise exception 'Migracja Haseł przerwana: % pól Sekret poza stronami Passwords. Przenieś je ręcznie i uruchom migrację ponownie.', v_count;
  end if;
end;
$$;

alter table public.pages add column is_system boolean not null default false;

-- Najwyżej jedna strona systemowa (Hasła) na użytkownika.
create unique index pages_one_system_per_user on public.pages (user_id) where is_system;

-- Stary strażnik typu Sekret zastępuje page_fields_guard niżej.
drop trigger if exists page_fields_secret_type_guard on public.page_fields;
drop function if exists public.page_fields_secret_type_guard();

-- Strażnik stron: is_system ustawia tylko funkcja systemowa; strona systemowa ma stały tytuł, ikonę,
-- szablon i właściciela, nie trafia do kosza i nie da się jej usunąć (poza kaskadą po usunięciu konta).
create function public.pages_system_guard()
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
    return new;
  end if;

  -- DELETE: kaskada po usunięciu konta (użytkownika już nie ma w auth.users) przechodzi.
  if old.is_system and exists (select 1 from auth.users as u where u.id = old.user_id) then
    raise exception 'Strony Hasła nie można usunąć';
  end if;
  return old;
end;
$$;

create trigger pages_system_guard
  before insert or update or delete on public.pages
  for each row execute function public.pages_system_guard();

-- Strażnik bloków: na stronie systemowej nie dodaje się bloków, a jej blok nie trafia do kosza, nie zmienia
-- strony ani typu i nie znika. content (ustawienia tabeli: sort, filtry, szerokości) wolno zmieniać.
create function public.page_blocks_system_guard()
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
    if exists (select 1 from public.pages as p where p.id = new.page_id and p.is_system) then
      raise exception 'Do strony Hasła nie można dodawać bloków';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (
      new.deleted_at is distinct from old.deleted_at
      or new.page_id is distinct from old.page_id
      or new.type is distinct from old.type
      or new.user_id is distinct from old.user_id
    ) and exists (
      select 1 from public.pages as p where p.id in (old.page_id, new.page_id) and p.is_system
    ) then
      raise exception 'Bloku strony Hasła nie można usunąć, przenieść ani zmienić jego typu';
    end if;
    return new;
  end if;

  -- DELETE: przy kaskadzie (strona albo konto już usunięte) strony nie ma, więc blok znika.
  if exists (
    select 1 from public.pages as p
    where p.id = old.page_id
      and p.is_system
      and exists (select 1 from auth.users as u where u.id = p.user_id)
  ) then
    raise exception 'Bloku strony Hasła nie można usunąć';
  end if;
  return old;
end;
$$;

create trigger page_blocks_system_guard
  before insert or update or delete on public.page_blocks
  for each row execute function public.page_blocks_system_guard();

-- Strażnik pól (kolumn):
-- - pole Sekret istnieje tylko na stronie systemowej, a kolumny strony systemowej są stałe:
--   nie dodaje się ich, nie usuwa, nie przemianowuje, nie przesuwa i nie zmienia typu ani tytułu, wolno zmienić config;
-- - poza stroną systemową typu nie da się zmienić na Sekret ani z Sekretu (także przez change_field_type),
--   inaczej szyfrogramy stałyby się tekstem albo tekst jawny trafiłby do pola udającego Sekret.
create function public.page_fields_guard()
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
    if exists (
      select 1 from public.page_blocks as b
      join public.pages as p on p.id = b.page_id
      where b.id = new.block_id and p.is_system
    ) then
      raise exception 'Kolumn modułu Hasła nie można dodawać';
    end if;
    if new.type = 'secret' then
      raise exception 'Pole Sekret jest dostępne tylko w module Hasła';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if exists (
      select 1 from public.page_blocks as b
      join public.pages as p on p.id = b.page_id
      where b.id in (old.block_id, new.block_id) and p.is_system
    ) then
      if new.name is distinct from old.name
        or new.type is distinct from old.type
        or new.position is distinct from old.position
        or new.is_title is distinct from old.is_title
        or new.block_id is distinct from old.block_id
        or new.user_id is distinct from old.user_id
      then
        raise exception 'Kolumny modułu Hasła są stałe: można zmienić tylko ich ustawienia';
      end if;
      return new;
    end if;
    if (old.type = 'secret' or new.type = 'secret') and old.type <> new.type then
      raise exception 'Nie można zmienić typu pola Sekret';
    end if;
    return new;
  end if;

  -- DELETE: przy kaskadzie (blok, strona albo konto już usunięte) pole znika.
  if exists (
    select 1 from public.page_blocks as b
    join public.pages as p on p.id = b.page_id
    where b.id = old.block_id
      and p.is_system
      and exists (select 1 from auth.users as u where u.id = p.user_id)
  ) then
    raise exception 'Kolumn modułu Hasła nie można usuwać';
  end if;
  return old;
end;
$$;

create trigger page_fields_guard
  before insert or update or delete on public.page_fields
  for each row execute function public.page_fields_guard();

revoke execute on function public.pages_system_guard() from public, anon, authenticated;
revoke execute on function public.page_blocks_system_guard() from public, anon, authenticated;
revoke execute on function public.page_fields_guard() from public, anon, authenticated;

-- Zwraca id strony Hasła zalogowanego użytkownika, a jeśli jej nie ma, tworzy ją ze stałymi kolumnami.
-- Blokada doradcza na użytkownika sprawia, że dwa równoległe wywołania zwracają tę samą stronę.
create function public.ensure_passwords_page()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_page_id uuid;
  v_block_id uuid;
begin
  if v_user is null then
    raise exception 'Brak zalogowanego użytkownika' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rhytm.passwords_page.' || v_user::text, 0));

  select p.id into v_page_id from public.pages as p where p.user_id = v_user and p.is_system;
  if found then
    return v_page_id;
  end if;

  perform set_config('rhytm.system_write', 'on', true);

  insert into public.pages (user_id, title, icon, template_key, position, is_system)
  values (
    v_user, 'Hasła', 'lucide:lock', 'passwords',
    (select coalesce(max(p.position), -1) + 1 from public.pages as p where p.user_id = v_user and p.deleted_at is null),
    true
  )
  returning id into v_page_id;

  insert into public.page_blocks (user_id, page_id, type, position, content)
  values (
    v_user, v_page_id, 'table', 0,
    '{"name":"","settings":{"sort":[],"filters":[],"hidden_field_ids":[],"column_summaries":{},"pinned_cards":[],"column_widths":{}}}'::jsonb
  )
  returning id into v_block_id;

  insert into public.page_fields (user_id, block_id, name, type, config, position, is_title)
  values
    (v_user, v_block_id, 'Serwis', 'text', '{"empty_label":"Bez nazwy"}'::jsonb, 0, true),
    (v_user, v_block_id, 'Login', 'text', '{}'::jsonb, 1, false),
    (v_user, v_block_id, 'Hasło', 'secret', '{}'::jsonb, 2, false),
    (v_user, v_block_id, 'URL', 'url', '{}'::jsonb, 3, false),
    (v_user, v_block_id, 'Kategoria', 'select', '{"options":[]}'::jsonb, 4, false),
    (v_user, v_block_id, 'Notatka', 'secret', '{}'::jsonb, 5, false);

  perform set_config('rhytm.system_write', 'off', true);

  return v_page_id;
end;
$$;

revoke execute on function public.ensure_passwords_page() from public, anon;
grant execute on function public.ensure_passwords_page() to authenticated;

-- Przyjmuje istniejącą stronę z szablonu passwords jako stronę systemową (tylko migracja i testy).
-- Wymaga dokładnie jednej nieusuniętej strony passwords z jednym blokiem tabeli i 4 polami:
-- tytuł text (Serwis), text (Login), secret (Hasło), url (URL). Dopisuje Kategorię i Notatkę,
-- nadaje stałe nazwy, kolejność, tytuł „Hasła” i ikonę. Wiersze i szyfrogramy zostają nietknięte.
-- Bez strony zwraca null; użytkownik ze stroną systemową dostaje jej id.
create function public.adopt_passwords_page(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page_id uuid;
  v_count int;
  v_block_id uuid;
  v_title_id uuid;
  v_login_id uuid;
  v_secret_id uuid;
  v_url_id uuid;
begin
  select p.id into v_page_id from public.pages as p where p.user_id = p_user and p.is_system;
  if found then
    return v_page_id;
  end if;

  select count(*)::int into v_count
  from public.pages as p
  where p.user_id = p_user and p.template_key = 'passwords' and p.deleted_at is null;

  if v_count = 0 then
    return null;
  end if;
  if v_count > 1 then
    raise exception 'Użytkownik % ma % stron Passwords; zostaw jedną i uruchom migrację ponownie.', p_user, v_count;
  end if;

  select p.id into v_page_id
  from public.pages as p
  where p.user_id = p_user and p.template_key = 'passwords' and p.deleted_at is null;

  -- Dokładnie jeden blok (także licząc kosz), typu tabela: blok z kosza zablokowałby później purge_trash.
  select count(*)::int into v_count from public.page_blocks as b where b.page_id = v_page_id;
  select b.id into v_block_id
  from public.page_blocks as b
  where b.page_id = v_page_id and b.type = 'table' and b.deleted_at is null;
  if v_count <> 1 or v_block_id is null then
    raise exception 'Strona Passwords % ma inny układ bloków niż jedna tabela; migracja przerwana.', v_page_id;
  end if;

  select count(*)::int into v_count from public.page_fields as f where f.block_id = v_block_id;
  select f.id into v_title_id from public.page_fields as f
  where f.block_id = v_block_id and f.is_title and f.type = 'text';
  select f.id into v_login_id from public.page_fields as f
  where f.block_id = v_block_id and not f.is_title and f.type = 'text';
  select f.id into v_secret_id from public.page_fields as f
  where f.block_id = v_block_id and not f.is_title and f.type = 'secret';
  select f.id into v_url_id from public.page_fields as f
  where f.block_id = v_block_id and not f.is_title and f.type = 'url';

  if v_count <> 4 or v_title_id is null or v_login_id is null or v_secret_id is null or v_url_id is null then
    raise exception 'Strona Passwords % ma inny układ kolumn niż Serwis, Login, Hasło, URL; migracja przerwana.', v_page_id;
  end if;

  perform set_config('rhytm.system_write', 'on', true);

  update public.pages as p
  set is_system = true, title = 'Hasła', icon = 'lucide:lock'
  where p.id = v_page_id;

  update public.page_fields as f
  set name = 'Serwis', position = 0, config = f.config || '{"empty_label":"Bez nazwy"}'::jsonb
  where f.id = v_title_id;
  update public.page_fields as f set name = 'Login', position = 1 where f.id = v_login_id;
  update public.page_fields as f set name = 'Hasło', position = 2 where f.id = v_secret_id;
  update public.page_fields as f set name = 'URL', position = 3 where f.id = v_url_id;

  insert into public.page_fields (user_id, block_id, name, type, config, position, is_title)
  values
    (p_user, v_block_id, 'Kategoria', 'select', '{"options":[]}'::jsonb, 4, false),
    (p_user, v_block_id, 'Notatka', 'secret', '{}'::jsonb, 5, false);

  perform set_config('rhytm.system_write', 'off', true);

  return v_page_id;
end;
$$;

revoke execute on function public.adopt_passwords_page(uuid) from public, anon, authenticated;

-- duplicate_page: strony Hasła nie duplikujemy (kopia miałaby pola Sekret poza modułem). Reszta ciała bez zmian.
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

-- reorder_pages: strona Hasła żyje w sekcji Moduły, nie na liście stron.
create or replace function public.reorder_pages(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.pages as p where p.id = any (p_ids) and p.is_system) then
    raise exception 'Strony Hasła nie można przenosić';
  end if;

  update public.pages as p
  set position = u.ord - 1
  from unnest(p_ids) with ordinality as u(id, ord)
  where p.id = u.id;
end;
$$;

-- move_page: jak reorder_pages, strony Hasła nie przenosi się między sekcjami sidebaru.
create or replace function public.move_page(p_ids uuid[], p_page_id uuid, p_favorite boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.pages as p where (p.id = p_page_id or p.id = any (p_ids)) and p.is_system) then
    raise exception 'Strony Hasła nie można przenosić';
  end if;

  update public.pages as p
  set favorite = p_favorite
  where p.id = p_page_id;

  update public.pages as p
  set position = u.ord - 1
  from unnest(p_ids) with ordinality as u(id, ord)
  where p.id = u.id;
end;
$$;

-- Przyjęcie istniejących stron Passwords. Błąd w adopt_passwords_page przerywa całą migrację (transakcja).
do $$
declare
  v_user uuid;
begin
  for v_user in
    select distinct p.user_id from public.pages as p
    where p.template_key = 'passwords' and p.deleted_at is null
  loop
    perform public.adopt_passwords_page(v_user);
  end loop;
end;
$$;
