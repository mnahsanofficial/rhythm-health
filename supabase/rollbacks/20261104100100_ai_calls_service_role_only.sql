-- Restores the grants Supabase's default privileges gave. Changes no rows. RLS stays on.
BEGIN;

GRANT ALL ON public.ai_calls TO anon, authenticated, service_role;

COMMIT;
