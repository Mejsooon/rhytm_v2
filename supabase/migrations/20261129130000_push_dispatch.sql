-- Powiadomienia push: wysyłka (spec F1).
-- pg_cron co minutę woła dispatch_notifications(), która wybiera należne przypomnienia (claim_due_notifications)
-- i jednym żądaniem pg_net przekazuje je trasie Vercel /api/cron/powiadomienia (Authorization: Bearer <sekret>).
-- Sekret crona i adres aplikacji leżą w Supabase Vault (rhytm_cron_secret, rhytm_app_url) — bez nich nic nie wychodzi.
-- Migracja tylko dokłada obiekty; nie zmienia ani nie usuwa danych.

create extension if not exists pg_net with schema extensions;

-- 1. Dziennik wysłanych przypomnień: klucz (kind, ref, for_date) pilnuje, żeby każde przypomnienie poszło raz,
-- także przy ponownym wywołaniu crona albo dwóch wywołaniach naraz.
create table public.push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('habit', 'block', 'renewal')),
  -- habit: id nawyku; block: id bloku; renewal: '<id wiersza>:<id pola>'
  ref text not null,
  -- habit: lokalny dzień profilu; block: dzień wystąpienia (oryginalny, przed przeniesieniem); renewal: data odnowienia
  for_date date not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref, for_date)
);
-- Kaskada z auth.users i sprzątanie starych wpisów
create index push_log_user_id_idx on public.push_log (user_id);
create index push_log_for_date_idx on public.push_log (for_date);

-- Tylko funkcje crona (właściciel); klient nie widzi dziennika
alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

-- 2. Wybór należnych przypomnień. Jedno wywołanie:
--   - wybiera wszystkie przypomnienia, które wypadają w chwili p_now (nawyki, start bloku, odnowienia),
--   - wpisuje je do push_log (insert ... on conflict do nothing), więc ponowne wywołanie nic już nie zwróci,
--   - zwraca jeden wiersz na parę (przypomnienie, włączone urządzenie użytkownika).
-- Strefy czasowe (profiles.timezone, blocks.timezone) to wolny tekst: nieznana strefa rzuciłaby błędem
-- w "at time zone" i zablokowała wysyłkę wszystkim, więc takie wiersze pomijamy. Strażnik jest w CASE
-- (a nie tylko w WHERE), bo planer może policzyć wyrażenie przed filtrem.
create function public.claim_due_notifications(p_now timestamptz)
returns table (endpoint text, p256dh text, auth text, kind text, title text, body text, tag text, url text)
language sql
security definer
set search_path = ''
as $$
  with uzytkownicy as (
    -- Warunki wspólne użytkownika: konto nie czeka na usunięcie, strefa profilu poprawna, co najmniej jedno
    -- włączone urządzenie i lokalny czas poza cichą nocą (cicha noc pomija bez wpisu do push_log — decyzja C12).
    -- Brak wiersza notification_settings = wartości domyślne kolumn (te same literały co w migracjach:
    -- habits_enabled false, before_block_min 5, renewals_enabled true, renewal_days_before 1, renewal_hour 9).
    select
      p.user_id,
      lt.local_ts,
      coalesce(p.week_start, 'mon') as week_start,
      coalesce(p.currency, 'PLN') as currency,
      coalesce(ns.habits_enabled, false) as habits_enabled,
      case when ns.user_id is null then 5 else ns.before_block_min end as before_block_min,
      coalesce(ns.renewals_enabled, true) as renewals_enabled,
      coalesce(ns.renewal_days_before, 1) as renewal_days_before,
      coalesce(ns.renewal_hour, 9) as renewal_hour
    from public.profiles as p
    cross join lateral (
      select case when p.timezone in (select tzn.name from pg_catalog.pg_timezone_names as tzn)
        then p_now at time zone p.timezone
      end as local_ts
    ) as lt
    left join public.notification_settings as ns on ns.user_id = p.user_id
    where p.deletion_requested_at is null
      and lt.local_ts is not null
      and exists (
        select 1 from public.push_subscriptions as ps
        where ps.user_id = p.user_id and ps.enabled)
      and not (
        coalesce(ns.quiet_enabled, false)
        and case
          -- zwykły przedział, np. 13:00–15:00
          when ns.quiet_from <= ns.quiet_to
            then lt.local_ts::time >= ns.quiet_from and lt.local_ts::time < ns.quiet_to
          -- przez północ, np. 23:00–07:00
          else lt.local_ts::time >= ns.quiet_from or lt.local_ts::time < ns.quiet_to
        end)
  ),
  nawyki as (
    -- Nawyki: lokalny czas profilu w [remind_at, remind_at + 15 min) — liczone na znacznikach czasu, żeby
    -- 23:50 + 15 min nie zawijało się przez północ. Harmonogram obowiązujący dziś = największe valid_from <= dziś
    -- (brak = nawyk jeszcze nie istnieje). Zaplanowany dziś: daily; weekdays → dzień ISO w weekdays;
    -- times_per_week → odhaczeń w bieżącym tygodniu (od profiles.week_start, jak src/features/habits/model.ts)
    -- mniej niż times_per_week. Nawyk odhaczony dziś nie dostaje przypomnienia.
    select
      u.user_id,
      'habit'::text as kind,
      h.id::text as ref,
      u.local_ts::date as for_date,
      'rhytm'::text as title,
      'Pora na: ' || h.name as body,
      'habit-' || h.id as tag,
      '/nawyki/' || h.id as url
    from uzytkownicy as u
    join public.habits as h on h.user_id = u.user_id
    join lateral (
      select s.schedule_type, s.weekdays, s.times_per_week
      from public.habit_schedules as s
      where s.habit_id = h.id and s.valid_from <= u.local_ts::date
      order by s.valid_from desc
      limit 1
    ) as sch on true
    cross join lateral (
      select u.local_ts::date - case
        when u.week_start = 'sun' then extract(isodow from u.local_ts)::int % 7
        else extract(isodow from u.local_ts)::int - 1
      end as week_start_day
    ) as tydzien
    where u.habits_enabled
      and h.remind_at is not null
      and u.local_ts >= u.local_ts::date + h.remind_at
      and u.local_ts < u.local_ts::date + h.remind_at + interval '15 minutes'
      and case sch.schedule_type
        when 'daily' then true
        when 'weekdays' then extract(isodow from u.local_ts)::smallint = any (sch.weekdays)
        when 'times_per_week' then (
          select count(*)
          from public.habit_checks as c
          where c.habit_id = h.id
            and c.date >= tydzien.week_start_day
            and c.date < tydzien.week_start_day + 7
        ) < sch.times_per_week
        else false
      end
      and not exists (
        select 1 from public.habit_checks as c
        where c.habit_id = h.id and c.date = u.local_ts::date)
  ),
  bloki_teraz as (
    -- Bloki z przypomnieniem użytkowników z włączonym „Start bloku”; czas lokalny w strefie bloku
    select
      u.user_id,
      u.before_block_min,
      b.id as block_id,
      b.title as block_title,
      b.start_local,
      b.duration_min,
      -- jsonb null traktujemy jak brak powtarzania (blok jednorazowy)
      case when jsonb_typeof(b.recurrence) = 'object' then b.recurrence end as recurrence,
      bt.block_ts
    from uzytkownicy as u
    join public.blocks as b on b.user_id = u.user_id
    cross join lateral (
      select case when b.timezone in (select tzn.name from pg_catalog.pg_timezone_names as tzn)
        then p_now at time zone b.timezone
      end as block_ts
    ) as bt
    where u.before_block_min is not null
      and b.remind
      and bt.block_ts is not null
  ),
  bloki_dni as (
    -- Kandydaci na wystąpienie: dziś i jutro w strefie bloku (blok o 00:03 przypominamy o 23:58 dnia wcześniej)
    -- oraz dni, których wystąpienie wyjątek „modified” przeniósł na dziś albo jutro
    select bt.*, d.occurrence_date
    from bloki_teraz as bt
    cross join lateral (
      select bt.block_ts::date + g.n as occurrence_date
      from generate_series(0, 1) as g (n)
      union
      select e.occurrence_date
      from public.block_exceptions as e
      where e.block_id = bt.block_id
        and e.kind = 'modified'
        and e.new_start_local is not null
        and e.new_start_local::date between bt.block_ts::date and bt.block_ts::date + 1
    ) as d
  ),
  bloki as (
    -- Start bloku: wystąpienie jak w src/features/calendar/occurrences.ts (start_local::date <= dzień <= until;
    -- jednorazowy tylko w dniu startu; daily; weekdays = pn–pt; weekly = ten sam dzień tygodnia co start;
    -- custom = byWeekday zawiera dzień ISO). Wyjątek cancelled pomija, modified podmienia start i tytuł.
    -- Należne, gdy start − before_block_min <= czas lokalny bloku < start − before_block_min + 5 min.
    select
      bd.user_id,
      'block'::text as kind,
      bd.block_id::text as ref,
      bd.occurrence_date as for_date,
      'Za ' || bd.before_block_min || ' min: ' || coalesce(e.new_title, bd.block_title) as title,
      to_char(st.start_ts, 'HH24:MI') || '–'
        || to_char(st.start_ts + make_interval(mins => coalesce(e.new_duration_min, bd.duration_min)), 'HH24:MI') as body,
      'block-' || bd.block_id || '-' || bd.occurrence_date as tag,
      '/kalendarz?widok=dzien&data=' || st.start_ts::date as url
    from bloki_dni as bd
    left join public.block_exceptions as e
      on e.block_id = bd.block_id and e.occurrence_date = bd.occurrence_date
    cross join lateral (
      select case
        when e.kind = 'modified' and e.new_start_local is not null then e.new_start_local
        else bd.occurrence_date + bd.start_local::time
      end as start_ts
    ) as st
    cross join lateral (
      -- Ostatni dzień serii: jednorazowy = dzień startu, seria = until (zła albo brak = bez końca)
      select case
        when bd.recurrence is null then bd.start_local::date
        when jsonb_typeof(bd.recurrence -> 'until') = 'string'
          and pg_catalog.pg_input_is_valid(bd.recurrence ->> 'until', 'date')
          then (bd.recurrence ->> 'until')::date
        else date '9999-12-31'
      end as last_day
    ) as koniec
    where bd.occurrence_date >= bd.start_local::date
      and bd.occurrence_date <= koniec.last_day
      and case
        when bd.recurrence is null then true
        when bd.recurrence ->> 'freq' = 'daily' then true
        when bd.recurrence ->> 'freq' = 'weekdays' then extract(isodow from bd.occurrence_date) <= 5
        when bd.recurrence ->> 'freq' = 'weekly'
          then extract(isodow from bd.occurrence_date) = extract(isodow from bd.start_local)
        when bd.recurrence ->> 'freq' = 'custom'
          then coalesce(bd.recurrence -> 'byWeekday', '[]'::jsonb) @> to_jsonb(extract(isodow from bd.occurrence_date)::int)
        else false
      end
      and e.kind is distinct from 'cancelled'
      and bd.block_ts >= st.start_ts - make_interval(mins => bd.before_block_min)
      and bd.block_ts < st.start_ts - make_interval(mins => bd.before_block_min) + interval '5 minutes'
  ),
  odnowienia_wiersze as (
    -- Odnowienia: lokalny czas profilu w [renewal_hour:00, renewal_hour:15), termin = dziś + renewal_days_before.
    -- Pola Data odnowienia jak w loadRenewals (src/features/calendar/load-calendar.ts): strona i blok nieusunięte,
    -- strona nie systemowa, wiersz nieusunięty, źródło widoczne w kalendarzu (show_in_calendar !== false).
    select
      u.user_id,
      u.currency,
      u.renewal_days_before,
      u.local_ts::date + u.renewal_days_before as due_date,
      p.id as page_id,
      f.id as field_id,
      f.block_id,
      f.config,
      r.id as row_id,
      r.values
    from uzytkownicy as u
    join public.page_fields as f on f.user_id = u.user_id and f.type = 'renewal'
    join public.page_blocks as pb on pb.id = f.block_id and pb.deleted_at is null
    join public.pages as p on p.id = pb.page_id and p.user_id = u.user_id and p.deleted_at is null and not p.is_system
    join public.page_rows as r on r.block_id = f.block_id and r.deleted_at is null and r.remind
    where u.renewals_enabled
      and u.local_ts >= u.local_ts::date + make_interval(hours => u.renewal_hour)
      and u.local_ts < u.local_ts::date + make_interval(hours => u.renewal_hour) + interval '15 minutes'
      and f.config -> 'show_in_calendar' is distinct from 'false'::jsonb
  ),
  odnowienia as (
    -- Kotwica = wartość pola jako data ISO (zła → pomijana). Cykl jak rowCycle (src/features/pages/fields.ts):
    -- pole cycle_field_id typu recurring → cykl z jego wartości, potem jego default_cycle, potem 'month';
    -- bez takiego pola → config.cycle pola odnowienia, domyślnie 'month'. Aktywność jak rowActive: pole
    -- active_field_id typu checkbox → wartość true; brak takiego pola = aktywny. Termin D jest odnowieniem
    -- (jak addCycle), gdy k = różnica miesięcy D i kotwicy, k >= 0, k dzieli się przez krok (1 albo 12)
    -- i dzień(D) = least(dzień kotwicy, ostatni dzień miesiąca D).
    select
      ow.user_id,
      'renewal'::text as kind,
      ow.row_id || ':' || ow.field_id as ref,
      ow.due_date as for_date,
      case ow.renewal_days_before
        when 0 then 'Dziś odnowienie'
        when 1 then 'Jutro odnowienie'
        else 'Odnowienie za ' || ow.renewal_days_before || ' dni'
      end as title,
      tytul.tekst || coalesce(
        ' · ' || replace(to_char(kwota.amount, 'FM99999999990.00'), '.', ',') || ' ' || case ow.currency
          when 'PLN' then 'zł'
          when 'EUR' then '€'
          when 'USD' then '$'
          when 'GBP' then '£'
          else ow.currency
        end,
        '') as body,
      'renewal-' || ow.row_id || ':' || ow.field_id as tag,
      '/strony/' || ow.page_id as url
    from odnowienia_wiersze as ow
    cross join lateral (
      select case
        when jsonb_typeof(ow.values -> ow.field_id::text) = 'string'
          and (ow.values ->> ow.field_id::text) ~ '^\d{4}-\d{2}-\d{2}$'
          and pg_catalog.pg_input_is_valid(ow.values ->> ow.field_id::text, 'date')
          then (ow.values ->> ow.field_id::text)::date
      end as anchor
    ) as kotwica
    -- Pole Kwota cykliczna wskazane przez cycle_field_id (ten sam blok, typ recurring) i jego wartość
    left join lateral (
      select kf.id, kf.config, ow.values -> kf.id::text as v
      from public.page_fields as kf
      where kf.block_id = ow.block_id
        and kf.type = 'recurring'
        and kf.id::text = ow.config ->> 'cycle_field_id'
    ) as kf on true
    -- Pole Checkbox „Aktywna” wskazane przez active_field_id (ten sam blok, typ checkbox)
    left join lateral (
      select af.id
      from public.page_fields as af
      where af.block_id = ow.block_id
        and af.type = 'checkbox'
        and af.id::text = ow.config ->> 'active_field_id'
    ) as af on true
    -- Pole tytułowe bloku (pierwsze według pozycji)
    left join lateral (
      select tf.id, tf.config
      from public.page_fields as tf
      where tf.block_id = ow.block_id and tf.is_title
      order by tf.position
      limit 1
    ) as tf on true
    cross join lateral (
      select case
        when kf.id is not null then
          case
            when jsonb_typeof(kf.v) = 'object'
              and jsonb_typeof(kf.v -> 'amount') = 'number'
              and kf.v ->> 'cycle' in ('month', 'year')
              then kf.v ->> 'cycle'
            when kf.config ->> 'default_cycle' in ('month', 'year') then kf.config ->> 'default_cycle'
            else 'month'
          end
        when ow.config ->> 'cycle' in ('month', 'year') then ow.config ->> 'cycle'
        else 'month'
      end as cycle
    ) as cykl
    cross join lateral (
      -- Kwota jak normalizeValue dla recurring: obiekt {amount, cycle}, liczba albo tekst („43,5”); 0..1e9, 2 miejsca
      select case
        when z.raw between 0 and 1000000000 then round(z.raw, 2)
      end as amount
      from (
        select case jsonb_typeof(kf.v)
          when 'object' then
            case
              when jsonb_typeof(kf.v -> 'amount') = 'number' and kf.v ->> 'cycle' in ('month', 'year')
                then (kf.v -> 'amount')::numeric
            end
          when 'number' then kf.v::numeric
          when 'string' then
            case
              when pg_catalog.pg_input_is_valid(replace(btrim(kf.v #>> '{}'), ',', '.'), 'numeric')
                then replace(btrim(kf.v #>> '{}'), ',', '.')::numeric
            end
        end as raw
      ) as z
    ) as kwota
    cross join lateral (
      -- Tytuł wiersza: wartość pola tytułowego, pusty → empty_label pola, potem „Bez nazwy”
      select case
        when jsonb_typeof(ow.values -> tf.id::text) = 'string' and btrim(ow.values ->> tf.id::text) <> ''
          then btrim(ow.values ->> tf.id::text)
        else coalesce(tf.config ->> 'empty_label', 'Bez nazwy')
      end as tekst
    ) as tytul
    cross join lateral (
      select
        (extract(year from ow.due_date)::int * 12 + extract(month from ow.due_date)::int)
          - (extract(year from kotwica.anchor)::int * 12 + extract(month from kotwica.anchor)::int) as k,
        case cykl.cycle when 'year' then 12 else 1 end as krok
    ) as seria
    where kotwica.anchor is not null
      and (af.id is null or ow.values -> af.id::text = 'true'::jsonb)
      and seria.k >= 0
      and seria.k % seria.krok = 0
      and extract(day from ow.due_date)::int = least(
        extract(day from kotwica.anchor)::int,
        extract(day from (date_trunc('month', ow.due_date::timestamp) + interval '1 month - 1 day'))::int)
  ),
  nalezne as (
    select n.user_id, n.kind, n.ref, n.for_date, n.title, n.body, n.tag, n.url from nawyki as n
    union all
    select b.user_id, b.kind, b.ref, b.for_date, b.title, b.body, b.tag, b.url from bloki as b
    union all
    select o.user_id, o.kind, o.ref, o.for_date, o.title, o.body, o.tag, o.url from odnowienia as o
  ),
  zapisane as (
    -- Znacznik wysłania: wpis, który już jest (poprzednia minuta, równoległe wywołanie), nie wraca drugi raz
    insert into public.push_log as pl (user_id, kind, ref, for_date)
    select n.user_id, n.kind, n.ref, n.for_date
    from nalezne as n
    on conflict (kind, ref, for_date) do nothing
    returning pl.kind, pl.ref, pl.for_date
  )
  select ps.endpoint, ps.p256dh, ps.auth, n.kind, n.title, n.body, n.tag, n.url
  from zapisane as z
  join nalezne as n on n.kind = z.kind and n.ref = z.ref and n.for_date = z.for_date
  join public.push_subscriptions as ps on ps.user_id = n.user_id and ps.enabled
$$;

-- Tylko właściciel (cron działa jako postgres)
revoke execute on function public.claim_due_notifications(timestamptz)
  from public, anon, authenticated, service_role;

-- 3. Wysyłka wołana przez pg_cron. Bez sekretów w Vault (rhytm_cron_secret, rhytm_app_url) zwraca 0
-- i NIE woła claim — przypomnienia nie przepadają przed konfiguracją. Inaczej jedno żądanie pg_net z wszystkimi
-- wierszami (tylko gdy są). claim i zakolejkowanie żądania zatwierdzają się razem, a pg_net tylko ustawia żądanie
-- w kolejce: gdy Vercel nie odpowie, przypomnienie nie jest ponawiane (ślad zostaje w net._http_response).
create function public.dispatch_notifications()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_app_url text;
  v_notifications jsonb;
  v_count int;
begin
  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets as ds
  where ds.name = 'rhytm_cron_secret';

  select ds.decrypted_secret into v_app_url
  from vault.decrypted_secrets as ds
  where ds.name = 'rhytm_app_url';

  if coalesce(v_secret, '') = '' or coalesce(btrim(v_app_url), '') = '' then
    return 0;
  end if;

  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb), count(*)
  into v_notifications, v_count
  from public.claim_due_notifications(now()) as c;

  if v_count > 0 then
    perform net.http_post(
      url := rtrim(btrim(v_app_url), '/') || '/api/cron/powiadomienia',
      body := jsonb_build_object('notifications', v_notifications),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret),
      timeout_milliseconds := 10000
    );
  end if;

  -- Dziennik starszy niż tydzień nie jest już potrzebny (okna przypomnień mają najwyżej 15 minut)
  delete from public.push_log as pl
  where pl.for_date < (now() at time zone 'UTC')::date - 7;

  return v_count;
end
$$;

revoke execute on function public.dispatch_notifications()
  from public, anon, authenticated, service_role;

-- 4. Usuwanie wygasłych subskrypcji (404/410 od serwera push). Trasa crona woła ją kluczem publicznym
-- (rola anon, bez sesji), więc funkcja sama sprawdza sekret z Vault.
create function public.remove_push_subscriptions(p_secret text, p_endpoints text[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_deleted int;
begin
  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets as ds
  where ds.name = 'rhytm_cron_secret';

  if coalesce(v_secret, '') = '' or p_secret is distinct from v_secret then
    raise exception 'unauthorized';
  end if;

  delete from public.push_subscriptions as ps
  where ps.endpoint = any (p_endpoints);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end
$$;

revoke execute on function public.remove_push_subscriptions(text, text[])
  from public, authenticated, service_role;
grant execute on function public.remove_push_subscriptions(text, text[]) to anon;

-- 5. Cron: co minutę (ponowne uruchomienie migracji nie dubluje zadania)
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(j.jobid) from cron.job as j where j.jobname = 'rhytm-powiadomienia';
select cron.schedule('rhytm-powiadomienia', '* * * * *', 'select public.dispatch_notifications()');
