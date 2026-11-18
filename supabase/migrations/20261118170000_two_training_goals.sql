-- Dwa niezależne cele treningowe: treningi / tydz. i km biegu / tydz. (jeden albo oba).
-- Konta po onboardingu zachowują dotychczasowy wybór z weekly_goal_type.
-- weekly_goal_type zostaje na razie (stary kod na produkcji czyta go do czasu wdrożenia); usuniemy go osobną migracją.
-- Nowe kolumny dziedziczą granty i RLS tabeli profiles.
alter table public.profiles
  add column workouts_goal_on boolean not null default true,
  add column km_goal_on boolean not null default true;

update public.profiles as p
set workouts_goal_on = (p.weekly_goal_type = 'workouts'),
    km_goal_on = (p.weekly_goal_type = 'km')
where p.onboarded_at is not null;

alter table public.profiles
  add constraint profiles_training_goal_on_check check (workouts_goal_on or km_goal_on);
