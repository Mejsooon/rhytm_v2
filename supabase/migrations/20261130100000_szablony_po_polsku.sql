-- Tytuły stron z szablonów po polsku: Books -> Książki, Projects -> Projekty, Websites -> Strony WWW,
-- Subscriptions -> Subskrypcje. Zmieniamy tylko strony z szablonu, które nadal mają domyślny angielski tytuł
-- (przemianowane przez użytkownika i usunięte zostają bez zmian).
-- Logika siedzi w funkcji, żeby test pgTAP sprawdzał dokładnie to, co robi migracja; funkcja jest idempotentna.
create or replace function public.pl_szablony_tytuly()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.pages as p
  set title = case p.template_key
    when 'books' then 'Książki'
    when 'projects' then 'Projekty'
    when 'websites' then 'Strony WWW'
    when 'subscriptions' then 'Subskrypcje'
  end
  where p.deleted_at is null
    and (
      (p.template_key = 'books' and p.title = 'Books')
      or (p.template_key = 'projects' and p.title = 'Projects')
      or (p.template_key = 'websites' and p.title = 'Websites')
      or (p.template_key = 'subscriptions' and p.title = 'Subscriptions')
    );
$$;

revoke execute on function public.pl_szablony_tytuly() from public, anon, authenticated;

select public.pl_szablony_tytuly();
