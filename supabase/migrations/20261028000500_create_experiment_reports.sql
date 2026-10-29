-- experiment_reports (TRD 12.4). One report per experiment. For now only `analysis`
-- (deterministic, computed in Python) is written; the AI-written parts come later.

create table public.experiment_reports (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null unique references public.experiments (id) on delete cascade,

  analysis jsonb not null,
  interpretation jsonb,
  learnings jsonb,
  next_experiment jsonb,

  created_at timestamptz not null default now()
);

-- Row level security: readable only through an experiment of the user's own profile.
-- Writes are backend-only.
alter table public.experiment_reports enable row level security;

create policy "experiment_reports_select_own" on public.experiment_reports
  for select to authenticated
  using (
    exists (
      select 1
      from public.experiments e
      join public.profiles p on p.id = e.profile_id
      where e.id = experiment_reports.experiment_id
        and p.user_id = (select auth.uid())
    )
  );

-- Tables created via SQL are not auto-exposed to API roles on this project.
grant select, insert, update, delete on public.experiment_reports to service_role;
grant select on public.experiment_reports to authenticated;
