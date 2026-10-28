-- profiles: one row per authenticated user (TRD 12.1).
-- Only table that references auth.users; later tables hang off profiles.id.

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,

  age_range text not null,
  usual_sleep_hours numeric not null,
  usual_sleep_schedule jsonb not null,
  activity_level text not null,
  goals jsonb not null default '[]'::jsonb,
  regular_habits jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Row level security: users only see and change their own profile.
-- The backend uses the service-role key (bypasses RLS) and scopes queries itself.
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
