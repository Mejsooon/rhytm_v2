-- Ćwiczenia z masą ciała: gym_sets.weight_kg to wtedy dociążenie (null lub 0 = brak),
-- a efektywny ciężar = profiles.weight_kg + dociążenie (liczy aplikacja).
alter table public.exercises add column bodyweight boolean not null default false;

-- Istniejące ćwiczenia z biblioteki, które robi się z masą ciała
update public.exercises as e
set bodyweight = true
where lower(e.name) in ('podciąganie', 'pompki', 'pompki na poręczach', 'dipy', 'plank');
