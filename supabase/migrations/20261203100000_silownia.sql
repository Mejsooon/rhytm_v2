-- Pakiet 3B: dziennik siłowni — rodzaje ćwiczeń, typy serii i start licznika.
-- Same nowe kolumny: stary kod działa po tej migracji, nic nie jest kasowane.

alter table public.exercises
  -- Rodzaj pomiaru; null = wynika z bodyweight (starsze ćwiczenia)
  add column kind text check (kind in ('wr', 'bw', 'wbw', 'dur', 'dist')),
  add column equipment text check (length(equipment) <= 30),
  add column note text check (length(note) <= 500),
  -- Przerwa po serii; null = 90 s
  add column rest_s integer check (rest_s between 0 and 1800);

alter table public.gym_sets
  -- N robocza, W rozgrzewkowa, D drop set, F do upadku
  add column set_type text not null default 'N' check (set_type in ('N', 'W', 'D', 'F')),
  add column duration_s integer check (duration_s > 0 and duration_s <= 86400),
  add column distance_km numeric(6, 2) check (distance_km > 0 and distance_km <= 300);

-- Chwila „Rozpocznij” (albo pierwszej odhaczonej serii) — od niej liczy się licznik
alter table public.sport_sessions
  add column started_at timestamptz;
