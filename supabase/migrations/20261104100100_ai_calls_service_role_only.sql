-- Supabase's default privileges gave anon and authenticated every privilege on ai_calls.
-- RLS with no policies already blocks their row access, but TRUNCATE isn't covered by RLS,
-- so this removes the grants too and leaves the service role with only what it uses.
-- Announce before applying to the shared project. Re-applying this file is safe.
BEGIN;

REVOKE ALL ON public.ai_calls FROM anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.ai_calls TO service_role;

COMMIT;
