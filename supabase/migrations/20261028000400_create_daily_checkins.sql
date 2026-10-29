-- daily_checkins (TRD 12.3). One row per experiment day; phase and day_number are
-- derived by the backend, never taken from the client.

create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments (id) on delete cascade,

  phase text not null check (phase in ('baseline', 'intervention')),
  day_number integer not null check (day_number > 0),

  intervention_completed boolean not null,

  metric_values jsonb not null,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (experiment_id, day_number)
);

create trigger daily_checkins_set_updated_at
before update on public.daily_checkins
for each row execute function public.set_updated_at();

-- Row level security: readable only through an experiment of the user's own profile.
-- Writes are backend-only so the day, phase and metric rules cannot be bypassed.
alter table public.daily_checkins enable row level security;

create policy "daily_checkins_select_own" on public.daily_checkins
  for select to authenticated
  using (
    exists (
      select 1
      from public.experiments e
      join public.profiles p on p.id = e.profile_id
      where e.id = daily_checkins.experiment_id
        and p.user_id = (select auth.uid())
    )
  );

-- Tables created via SQL are not auto-exposed to API roles on this project.
grant select, insert, update, delete on public.daily_checkins to service_role;
grant select on public.daily_checkins to authenticated;
