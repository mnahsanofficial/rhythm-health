-- TRD 2.5 / 34: one active experiment per user. The backend checks first for a clear
-- error message; this index makes the rule hold even under concurrent start requests.

create unique index experiments_one_active_per_profile
  on public.experiments (profile_id)
  where status = 'active';
