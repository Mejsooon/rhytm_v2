begin;
select plan(26);

-- A: oznaczone 31 dni temu (do usunięcia), B: 29 dni temu (zostaje), C: bez daty, D: konto do testów wyzwalacza.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a2', 'a2@test.pl', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@test.pl', '{"display_name":"B"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.pl', '{"display_name":"C"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@test.pl', '{"display_name":"D"}');

-- Dane A w kilku tabelach (kaskada) i nawyk B (musi zostać).
insert into public.categories (user_id, name, color, position)
values ('00000000-0000-0000-0000-0000000000a2', 'Praca', '#3b82f6', 0);
insert into public.pages (id, user_id, title)
values ('a2000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', 'Strona A');
insert into public.habits (id, user_id, name)
values
  ('a2000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'Nawyk A'),
  ('b2000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b2', 'Nawyk B');
insert into public.vaults (user_id, status, generation)
values ('00000000-0000-0000-0000-0000000000a2', 'active', 1);
insert into public.blocks (id, user_id, title, start_local, duration_min, timezone)
values ('a2000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a2', 'Blok A',
  '2026-12-01 08:00', 60, 'Europe/Warsaw');
insert into public.tasks (user_id, title, block_id, occurrence_date, due_date)
values ('00000000-0000-0000-0000-0000000000a2', 'Zadanie A', 'a2000000-0000-0000-0000-0000000000c2',
  '2026-12-01', '2026-12-01');

-- Schemat, uprawnienia, cron
select has_column('public', 'profiles', 'deletion_requested_at', 'profiles ma deletion_requested_at');
select has_function('public', 'purge_deleted_accounts', 'istnieje purge_deleted_accounts');
select is(has_function_privilege('authenticated', 'public.purge_deleted_accounts()', 'execute'), false,
  'authenticated nie wykonuje purge_deleted_accounts');
select is(has_function_privilege('anon', 'public.purge_deleted_accounts()', 'execute'), false,
  'anon nie wykonuje purge_deleted_accounts');
select is(
  (select j.schedule from cron.job as j where j.jobname = 'rhytm-purge-accounts'),
  '41 3 * * *',
  'zadanie rhytm-purge-accounts istnieje (codziennie 03:41)'
);
select is(
  (select j.command from cron.job as j where j.jobname = 'rhytm-purge-accounts'),
  'select public.purge_deleted_accounts()',
  'zadanie woła purge_deleted_accounts'
);

-- Wyzwalacz, jako zalogowany D
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);

update public.profiles as p set deletion_requested_at = now() - interval '1 year'
where p.user_id = '00000000-0000-0000-0000-0000000000d2';
select is(
  (select p.deletion_requested_at from public.profiles as p where p.user_id = '00000000-0000-0000-0000-0000000000d2'),
  now(),
  'data sprzed roku → now()'
);

update public.profiles as p set deletion_requested_at = null
where p.user_id = '00000000-0000-0000-0000-0000000000d2';
select is(
  (select p.deletion_requested_at from public.profiles as p where p.user_id = '00000000-0000-0000-0000-0000000000d2'),
  null,
  'przywrócenie (null) działa'
);

update public.profiles as p set deletion_requested_at = now() + interval '40 days'
where p.user_id = '00000000-0000-0000-0000-0000000000d2';
select is(
  (select p.deletion_requested_at from public.profiles as p where p.user_id = '00000000-0000-0000-0000-0000000000d2'),
  now(),
  'data w przyszłości → now()'
);

-- Cudzy profil (C): RLS nie pozwala go oznaczyć
update public.profiles as p set deletion_requested_at = now()
where p.user_id = '00000000-0000-0000-0000-0000000000c2';

-- Starsza data ustawiona z pominięciem wyzwalacza, żeby odróżnić „zostaje stara” od now()
reset role;
alter table public.profiles disable trigger profiles_deletion_guard;
update public.profiles as p set deletion_requested_at = '2026-01-01 10:00+00'
where p.user_id = '00000000-0000-0000-0000-0000000000d2';
alter table public.profiles enable trigger profiles_deletion_guard;

select is(
  (select p.deletion_requested_at from public.profiles as p where p.user_id = '00000000-0000-0000-0000-0000000000c2'),
  null,
  'cudzego profilu nie da się oznaczyć'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);

update public.profiles as p set deletion_requested_at = now()
where p.user_id = '00000000-0000-0000-0000-0000000000d2';
select is(
  (select p.deletion_requested_at from public.profiles as p where p.user_id = '00000000-0000-0000-0000-0000000000d2'),
  '2026-01-01 10:00+00'::timestamptz,
  'zmiana na inną datę zostawia starą'
);

update public.profiles as p set display_name = 'D nowe'
where p.user_id = '00000000-0000-0000-0000-0000000000d2';
select is(
  (select p.display_name from public.profiles as p where p.user_id = '00000000-0000-0000-0000-0000000000d2'),
  'D nowe',
  'inne kolumny profilu dalej się aktualizują'
);
select is(
  (select p.deletion_requested_at from public.profiles as p where p.user_id = '00000000-0000-0000-0000-0000000000d2'),
  '2026-01-01 10:00+00'::timestamptz,
  'zmiana innej kolumny nie rusza daty'
);

select throws_ok(
  'select public.purge_deleted_accounts()',
  '42501', null,
  'authenticated nie wywoła purge_deleted_accounts'
);

-- Purge jako właściciel (jak pg_cron). D nie bierze udziału (data z 2026-01-01 ustawiona wyżej
-- — przenosimy ją na dziś, żeby test nie zależał od daty uruchomienia).
reset role;
alter table public.profiles disable trigger profiles_deletion_guard;
update public.profiles as p set deletion_requested_at = now() - interval '31 days'
where p.user_id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles as p set deletion_requested_at = now() - interval '29 days'
where p.user_id = '00000000-0000-0000-0000-0000000000b2';
update public.profiles as p set deletion_requested_at = now()
where p.user_id = '00000000-0000-0000-0000-0000000000d2';
alter table public.profiles enable trigger profiles_deletion_guard;

select is(public.purge_deleted_accounts(), 1, 'purge usuwa jedno konto (A) i zwraca liczbę');

select is((select count(*) from auth.users as u where u.id = '00000000-0000-0000-0000-0000000000a2'), 0::bigint,
  'konto A usunięte z auth.users');
select is((select count(*) from public.profiles as p where p.user_id = '00000000-0000-0000-0000-0000000000a2'), 0::bigint,
  'profil A usunięty');
select is((select count(*) from public.categories as c where c.user_id = '00000000-0000-0000-0000-0000000000a2'), 0::bigint,
  'kategorie A usunięte');
select is((select count(*) from public.pages as p where p.user_id = '00000000-0000-0000-0000-0000000000a2'), 0::bigint,
  'strona A usunięta');
select is((select count(*) from public.habits as h where h.user_id = '00000000-0000-0000-0000-0000000000a2'), 0::bigint,
  'nawyk A usunięty');
select is((select count(*) from public.vaults as v where v.user_id = '00000000-0000-0000-0000-0000000000a2'), 0::bigint,
  'sejf A usunięty');
select is((select count(*) from public.tasks as t where t.user_id = '00000000-0000-0000-0000-0000000000a2'), 0::bigint,
  'blok i zadanie A usunięte');

select is((select count(*) from auth.users as u where u.id = '00000000-0000-0000-0000-0000000000b2'), 1::bigint,
  'konto B (29 dni) zostaje');
select is((select count(*) from public.habits as h where h.user_id = '00000000-0000-0000-0000-0000000000b2'), 1::bigint,
  'dane B zostają');
select is((select count(*) from auth.users as u where u.id in ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d2')),
  2::bigint, 'konta bez daty i z dzisiejszą datą zostają');

select is(public.purge_deleted_accounts(), 0, 'drugi purge nic nie usuwa');

select * from finish();
rollback;
