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
