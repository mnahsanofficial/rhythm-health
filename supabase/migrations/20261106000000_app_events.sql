-- Backend-only counters. No answers, notes, questions or arbitrary properties.
BEGIN;
CREATE TABLE IF NOT EXISTS public.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_name text NOT NULL CHECK (event_name IN (
    'experiment_started', 'checkin_saved', 'checkin_updated', 'baseline_completed',
    'experiment_completed', 'report_written', 'outcome_chosen', 'soft_check_shown', 'safety_blocked'
  )),
  experiment_id uuid REFERENCES public.experiments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_events_created ON public.app_events(created_at);
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.app_events TO service_role;
ALTER TABLE public.ai_calls DROP CONSTRAINT IF EXISTS ai_calls_status_check;
ALTER TABLE public.ai_calls ADD CONSTRAINT ai_calls_status_check
  CHECK (status IN ('ok', 'retry', 'invalid', 'error', 'timeout'));
COMMIT;
