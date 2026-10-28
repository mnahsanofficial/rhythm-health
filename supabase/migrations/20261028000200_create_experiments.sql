-- experiments (TRD 12.2). Owned through profiles: experiments.profile_id -> profiles.id.
-- Only the saved/proposed shape is written for now, so the definition columns are NOT NULL.

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  status text not null default 'proposed'
    check (status in ('draft', 'proposed', 'active', 'completed')),
  question text not null,
  category text not null,

  hypothesis text not null,
  intervention jsonb not null,

  baseline_days integer not null check (baseline_days > 0),
  intervention_days integer not null check (intervention_days > 0),

  metrics jsonb not null,
  success_criteria jsonb not null,
  prediction jsonb not null,

  started_at timestamptz,
  completed_at timestamptz,

  is_seeded boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index experiments_profile_id_created_at_idx
  on public.experiments (profile_id, created_at desc);

create trigger experiments_set_updated_at
before update on public.experiments
for each row execute function public.set_updated_at();

-- Row level security: a user can read experiments of their own profile.
-- Writes are backend-only (service role) so lifecycle rules such as "prediction is
-- immutable once active" cannot be bypassed from the browser.
alter table public.experiments enable row level security;

create policy "experiments_select_own" on public.experiments
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = experiments.profile_id
        and p.user_id = (select auth.uid())
    )
  );

-- Tables created via SQL are not auto-exposed to API roles on this project.
grant select, insert, update, delete on public.experiments to service_role;
grant select on public.experiments to authenticated;
