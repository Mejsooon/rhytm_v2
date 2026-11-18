-- Cel treningowy: liczba treningów albo kilometrów w tygodniu.
-- Istniejące konta dostają 'km', więc ich zapisany cel się nie zmienia.
-- Nowe kolumny dziedziczą granty i RLS tabeli profiles.
alter table public.profiles
  add column weekly_goal_type text not null default 'km'
    constraint profiles_weekly_goal_type_check check (weekly_goal_type in ('workouts', 'km')),
  add column weekly_workouts_goal smallint
    constraint profiles_weekly_workouts_goal_check check (weekly_workouts_goal between 1 and 14);
