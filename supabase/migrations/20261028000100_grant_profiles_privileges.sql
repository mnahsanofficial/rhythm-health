-- Tables created via SQL are not automatically exposed to the API roles.
-- The backend uses service_role; authenticated is for direct client access under RLS.
-- anon gets nothing: profiles are never public.

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update on public.profiles to authenticated;
