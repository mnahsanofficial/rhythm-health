-- Removes analytics history; retain AI attempt history, translating timeout back to error.
BEGIN;
DROP TABLE IF EXISTS public.app_events;
UPDATE public.ai_calls SET status = 'error' WHERE status = 'timeout';
ALTER TABLE public.ai_calls DROP CONSTRAINT IF EXISTS ai_calls_status_check;
ALTER TABLE public.ai_calls ADD CONSTRAINT ai_calls_status_check
  CHECK (status IN ('ok', 'retry', 'invalid', 'error'));
COMMIT;
