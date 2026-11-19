-- Ikony stron jak w Notion: emoji (sam znak), ikona liniowa `lucide:<nazwa>:<kolor>` albo '' (brak → domyślna tabela).
-- Nowe strony domyślnie bez ikony; znaczki z dawnej siatki zamieniamy jednorazowo na szare ikony liniowe.

alter table public.pages alter column icon set default '';

update public.pages as p
set icon = case p.icon
  when '▦' then ''
  when '▤' then 'lucide:table:gray'
  when '◉' then 'lucide:target:gray'
  when '★' then 'lucide:star:gray'
  when '♪' then 'lucide:music:gray'
  when '✈' then 'lucide:plane:gray'
  when '⌂' then 'lucide:home:gray'
  when '✎' then 'lucide:file-text:gray'
  when '⚑' then 'lucide:flag:gray'
  when '◷' then 'lucide:calendar:gray'
  when '✱' then 'lucide:zap:gray'
  when '☰' then 'lucide:file-text:gray'
  when '⚙' then 'lucide:briefcase:gray'
  when '◆' then 'lucide:star:gray'
  when '●' then 'lucide:target:gray'
  when '▲' then 'lucide:rocket:gray'
  when '♥' then 'lucide:heart:gray'
  when '✉' then 'lucide:file-text:gray'
end
where p.icon in ('▦', '▤', '◉', '★', '♪', '✈', '⌂', '✎', '⚑', '◷', '✱', '☰', '⚙', '◆', '●', '▲', '♥', '✉');

-- Ikona to emoji albo `lucide:<nazwa>:<kolor>` — limit jak w zod (schemas.ts).
alter table public.pages add constraint pages_icon_length check (char_length(icon) <= 64);

-- Przeniesienie strony w sidebarze między sekcjami (Ulubione ↔ Strony): ulubione i kolejność w jednej transakcji.
-- p_ids — pełna nowa kolejność stron (jak w reorder_pages); RLS ogranicza zmiany do stron właściciela.
create function public.move_page(p_ids uuid[], p_page_id uuid, p_favorite boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.pages as p
  set favorite = p_favorite
  where p.id = p_page_id;

  update public.pages as p
  set position = u.ord - 1
  from unnest(p_ids) with ordinality as u(id, ord)
  where p.id = u.id;
$$;

revoke execute on function public.move_page(uuid[], uuid, boolean) from public, anon;
grant execute on function public.move_page(uuid[], uuid, boolean) to authenticated;
