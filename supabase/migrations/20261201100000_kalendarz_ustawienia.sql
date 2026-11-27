-- Ustawienia kalendarza i warstwy zapamiętane na koncie.
-- Nowe kolumny dziedziczą granty i RLS tabeli profiles.
alter table public.profiles
  add column calendar_view text not null default 'week'
    constraint profiles_calendar_view_check check (calendar_view in ('day', 'week', 'month')),
  add column calendar_from_hour smallint not null default 7
    constraint profiles_calendar_from_hour_check check (calendar_from_hour between 0 and 20),
  add column calendar_to_hour smallint not null default 23
    constraint profiles_calendar_to_hour_check check (calendar_to_hour <= 24),
  add column calendar_block_min smallint not null default 60
    constraint profiles_calendar_block_min_check check (calendar_block_min in (30, 60, 90)),
  add column calendar_week_numbers boolean not null default true,
  add column calendar_show_sport boolean not null default true,
  add column calendar_show_renewals boolean not null default true,
  add constraint profiles_calendar_hours_check check (calendar_to_hour >= calendar_from_hour + 4);
