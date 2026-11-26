-- Domyślne kategorie modułu Hasła (makieta S2Passwords: Praca, Studia, Prywatne; nowe hasło dostaje „Prywatne”).
-- 1) ensure_passwords_page tworzy pole Kategoria z tymi opcjami u nowych kont.
-- 2) Istniejące konta: opcje dostaje tylko pole Kategoria strony systemowej, które nie ma jeszcze żadnej opcji
--    (opcje dodane przez użytkownika zostają). Nic nie usuwa.
-- 3) Tam, gdzie tabela Haseł zapisała pustą listę widoków (bo nie było opcji), klucz „views” znika,
--    żeby aplikacja raz dopisała gotowe widoki Praca / Studia / Prywatne. Pusta lista nie zawiera danych.

create or replace function public.ensure_passwords_page()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_page_id uuid;
  v_block_id uuid;
  v_praca text := gen_random_uuid()::text;
  v_prywatne text := gen_random_uuid()::text;
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
    (v_user, v_block_id, 'Kategoria', 'select', jsonb_build_object(
      'options', jsonb_build_array(
        jsonb_build_object('id', v_praca, 'label', 'Praca', 'color', ''),
        jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Studia', 'color', ''),
        jsonb_build_object('id', v_prywatne, 'label', 'Prywatne', 'color', '')
      ),
      'default_option', v_prywatne
    ), 4, false),
    (v_user, v_block_id, 'Notatka', 'secret', '{}'::jsonb, 5, false);

  perform set_config('rhytm.system_write', 'off', true);

  return v_page_id;
end;
$$;


create or replace function public.hasla_domyslne_kategorie()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pole record;
  v_prywatne text;
begin
  for v_pole in
    select f.id, f.block_id
    from public.page_fields as f
    join public.page_blocks as b on b.id = f.block_id
    join public.pages as p on p.id = b.page_id
    where p.is_system
      and f.name = 'Kategoria'
      and f.type = 'select'
      and jsonb_array_length(coalesce(f.config -> 'options', '[]'::jsonb)) = 0
  loop
    v_prywatne := gen_random_uuid()::text;
    update public.page_fields as f
    set config = f.config || jsonb_build_object(
      'options', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Praca', 'color', ''),
        jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Studia', 'color', ''),
        jsonb_build_object('id', v_prywatne, 'label', 'Prywatne', 'color', '')
      ),
      'default_option', v_prywatne
    )
    where f.id = v_pole.id;

    update public.page_blocks as b
    set content = jsonb_set(b.content, '{settings}', (b.content -> 'settings') - 'views')
    where b.id = v_pole.block_id
      and b.content -> 'settings' -> 'views' = '[]'::jsonb;
  end loop;
end;
$$;

revoke execute on function public.hasla_domyslne_kategorie() from public, anon, authenticated;

select public.hasla_domyslne_kategorie();
