-- Etap 4: sport — sesje (bieg/siłownia), biegi, ćwiczenia, serie, szablony treningów i pominięcia szablonów.

-- Szablony treningów (przed sesjami, bo sesja wskazuje szablon).
create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  -- Dni tygodnia: 1 = pn … 7 = nd.
  weekdays smallint[] not null default '{}'
    check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  start_time time not null default '17:00',
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- Polityki RLS i kaskada z auth.users po user_id
create index workout_templates_user_id_idx on public.workout_templates (user_id);

-- Sesje sportowe: wspólny wiersz dla biegu i siłowni.
create table public.sport_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('run', 'gym')),
  title text not null check (length(trim(title)) between 1 and 80),
  -- Czas lokalny użytkownika (bez strefy).
  start_local timestamp not null,
  end_local timestamp check (end_local > start_local),
  note text check (length(note) <= 1000),
  completed boolean not null default false,
  show_in_calendar boolean not null default true,
  -- Trudność treningu siłowego (bieg ma własną w runs.difficulty).
  difficulty smallint check (difficulty between 1 and 10),
  -- Sesja wygenerowana z szablonu na dany dzień; usunięcie szablonu zostawia sesję.
  template_id uuid references public.workout_templates (id) on delete set null,
  template_date date,
  created_at timestamptz default now(),
  unique (template_id, template_date)
);

-- Lista i kalendarz użytkownika w zakresie dat
create index sport_sessions_user_id_start_local_idx on public.sport_sessions (user_id, start_local);

-- Dane biegu: jeden wiersz na sesję typu 'run'.
create table public.runs (
  session_id uuid primary key references public.sport_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'easy' check (kind in ('easy', 'tempo', 'intervals', 'long', 'race')),
  distance_km numeric(6, 2) check (distance_km > 0 and distance_km <= 300),
  duration_s integer check (duration_s > 0 and duration_s <= 86400),
  difficulty smallint check (difficulty between 1 and 10),
  -- Waga z chwili biegu (do liczenia kcal po zmianie wagi w profilu).
  weight_kg_snapshot numeric(5, 1),
  kcal integer check (kcal >= 0)
);

-- Polityki RLS i kaskada z auth.users po user_id
create index runs_user_id_idx on public.runs (user_id);

-- Ćwiczenia użytkownika.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  muscle_group text,
  created_at timestamptz default now()
);

-- Nazwa ćwiczenia unikalna per użytkownik, bez rozróżniania wielkości liter
create unique index exercises_user_lower_name on public.exercises (user_id, lower(name));

-- Serie na siłowni: kolejność ćwiczenia w sesji i numer serii.
create table public.gym_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.sport_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  exercise_position smallint not null,
  set_no smallint not null,
  weight_kg numeric(6, 2) check (weight_kg >= 0 and weight_kg <= 1000),
  reps smallint check (reps >= 0 and reps <= 999),
  done boolean not null default false,
  -- Numer serii jednoznaczny w ćwiczeniu sesji (dwa szybkie „+ seria” nie dadzą dwóch serii nr 3)
  unique (session_id, exercise_id, set_no)
);

-- Serie sesji oraz historia ćwiczenia użytkownika
create index gym_sets_session_id_idx on public.gym_sets (session_id);
create index gym_sets_user_id_exercise_id_idx on public.gym_sets (user_id, exercise_id);
-- Klucz obcy exercise_id przy kaskadzie z exercises (user_id, exercise_id nie pokrywa go jako prefiks)
create index gym_sets_exercise_id_idx on public.gym_sets (exercise_id);

-- Pozycje szablonu: ćwiczenie, liczba serii, zakres powtórzeń i przerwa.
create table public.workout_template_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position smallint not null,
  sets_count smallint not null check (sets_count between 1 and 10),
  reps_text text not null default '8–10' check (length(reps_text) <= 20),
  rest_s integer not null default 120 check (rest_s between 0 and 1800)
);

create index workout_template_items_template_id_position_idx on public.workout_template_items (template_id, position);
-- Polityki RLS, kaskada z auth.users i z exercises po kluczach obcych
create index workout_template_items_user_id_idx on public.workout_template_items (user_id);
create index workout_template_items_exercise_id_idx on public.workout_template_items (exercise_id);

-- Pominięte dni szablonu (żeby nie generować sesji ponownie).
create table public.template_skips (
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  primary key (template_id, date)
);

-- Polityki RLS i kaskada z auth.users po user_id
create index template_skips_user_id_idx on public.template_skips (user_id);

-- Indeks pod klucz obcy template_id w sesjach (kaskada set null przy usunięciu szablonu)
create index sport_sessions_template_id_idx on public.sport_sessions (template_id);

alter table public.workout_templates enable row level security;
alter table public.sport_sessions enable row level security;
alter table public.runs enable row level security;
alter table public.exercises enable row level security;
alter table public.gym_sets enable row level security;
alter table public.workout_template_items enable row level security;
alter table public.template_skips enable row level security;

-- Szablony: tylko własne wiersze.
create policy "workout_templates_select_own" on public.workout_templates
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "workout_templates_insert_own" on public.workout_templates
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "workout_templates_update_own" on public.workout_templates
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "workout_templates_delete_own" on public.workout_templates
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Ćwiczenia: tylko własne wiersze.
create policy "exercises_select_own" on public.exercises
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "exercises_insert_own" on public.exercises
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "exercises_update_own" on public.exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "exercises_delete_own" on public.exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Sesje: własne wiersze, a wskazany szablon (jeśli jest) musi należeć do tego samego użytkownika.
create policy "sport_sessions_select_own" on public.sport_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "sport_sessions_insert_own" on public.sport_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      template_id is null
      or exists (
        select 1 from public.workout_templates as t
        where t.id = sport_sessions.template_id and t.user_id = (select auth.uid())
      )
    )
  );

create policy "sport_sessions_update_own" on public.sport_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      template_id is null
      or exists (
        select 1 from public.workout_templates as t
        where t.id = sport_sessions.template_id and t.user_id = (select auth.uid())
      )
    )
  );

create policy "sport_sessions_delete_own" on public.sport_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Biegi: własne wiersze, a sesja musi należeć do tego samego użytkownika.
create policy "runs_select_own" on public.runs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "runs_insert_own" on public.runs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sport_sessions as s
      where s.id = runs.session_id and s.user_id = (select auth.uid())
    )
  );

create policy "runs_update_own" on public.runs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sport_sessions as s
      where s.id = runs.session_id and s.user_id = (select auth.uid())
    )
  );

create policy "runs_delete_own" on public.runs
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Serie: własne wiersze, a sesja i ćwiczenie muszą należeć do tego samego użytkownika.
create policy "gym_sets_select_own" on public.gym_sets
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "gym_sets_insert_own" on public.gym_sets
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sport_sessions as s
      where s.id = gym_sets.session_id and s.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises as e
      where e.id = gym_sets.exercise_id and e.user_id = (select auth.uid())
    )
  );

create policy "gym_sets_update_own" on public.gym_sets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sport_sessions as s
      where s.id = gym_sets.session_id and s.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises as e
      where e.id = gym_sets.exercise_id and e.user_id = (select auth.uid())
    )
  );

create policy "gym_sets_delete_own" on public.gym_sets
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Pozycje szablonu: własne wiersze, a szablon i ćwiczenie muszą należeć do tego samego użytkownika.
create policy "workout_template_items_select_own" on public.workout_template_items
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "workout_template_items_insert_own" on public.workout_template_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_templates as t
      where t.id = workout_template_items.template_id and t.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises as e
      where e.id = workout_template_items.exercise_id and e.user_id = (select auth.uid())
    )
  );

create policy "workout_template_items_update_own" on public.workout_template_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_templates as t
      where t.id = workout_template_items.template_id and t.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises as e
      where e.id = workout_template_items.exercise_id and e.user_id = (select auth.uid())
    )
  );

create policy "workout_template_items_delete_own" on public.workout_template_items
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Pominięcia: własne wiersze, a szablon musi należeć do tego samego użytkownika.
create policy "template_skips_select_own" on public.template_skips
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "template_skips_insert_own" on public.template_skips
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_templates as t
      where t.id = template_skips.template_id and t.user_id = (select auth.uid())
    )
  );

create policy "template_skips_update_own" on public.template_skips
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_templates as t
      where t.id = template_skips.template_id and t.user_id = (select auth.uid())
    )
  );

create policy "template_skips_delete_own" on public.template_skips
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Jawne uprawnienia do tabel (chmura Supabase nie nadaje ich automatycznie); dostęp do wierszy ogranicza RLS.
grant select, insert, update, delete on public.workout_templates to authenticated;
grant select, insert, update, delete on public.sport_sessions to authenticated;
grant select, insert, update, delete on public.runs to authenticated;
grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.gym_sets to authenticated;
grant select, insert, update, delete on public.workout_template_items to authenticated;
grant select, insert, update, delete on public.template_skips to authenticated;
grant all on public.workout_templates, public.sport_sessions, public.runs, public.exercises, public.gym_sets, public.workout_template_items, public.template_skips to service_role;

-- Cel treningowy ma już osobne flagi workouts_goal_on i km_goal_on; stara kolumna jest zbędna.
alter table public.profiles drop column weekly_goal_type;
