-- Removes usage tracking and its history. Changes nothing else. The backend keeps working
-- without this table: it logs a warning and doesn't apply the daily limit.
BEGIN;

DROP TABLE IF EXISTS public.ai_calls;

COMMIT;
