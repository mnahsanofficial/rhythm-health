-- One row per OpenRouter call, for usage tracking and the daily limit. No prompt or response
-- text is ever stored. The backend reads and writes this with the service role; nobody else
-- has access, because it holds usage data people don't need to see.
-- Announce before applying to the shared project. Re-applying this file is safe.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('propose', 'report', 'other')),
  model text NOT NULL,
  -- ok, and invalid (still bad after the retry), count towards the limit: both were paid for
  -- and finished one attempt. retry is the first half of an attempt; error never reached a model.
  status text NOT NULL CHECK (status IN ('ok', 'retry', 'invalid', 'error')),
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_calls_profile_kind_created
  ON public.ai_calls (profile_id, kind, created_at DESC);

ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.ai_calls TO service_role;

COMMIT;
