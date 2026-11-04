-- What someone chose after finishing an experiment: keep the habit, try a variation, or test something new.
-- Nullable, so existing experiments and clients keep working. No backfill: nobody has chosen yet.
-- Announce before applying to the shared project. Re-applying this file is safe.
BEGIN;
ALTER TABLE public.experiments
    ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE public.experiments DROP CONSTRAINT IF EXISTS experiments_outcome_choice;
ALTER TABLE public.experiments ADD CONSTRAINT experiments_outcome_choice
    CHECK (outcome IS NULL OR outcome IN ('keep', 'variation', 'new'));
COMMENT ON COLUMN public.experiments.outcome IS
    'The choice made after finishing: keep, variation or new. Null until someone chooses. Written by the backend only.';
NOTIFY pgrst, 'reload schema';
COMMIT;
