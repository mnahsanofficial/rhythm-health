-- S6: nullable so existing experiments and clients keep working.
-- Apply to the shared project only by Nazmul after the announced notice time.
BEGIN;
ALTER TABLE public.experiments
    ADD COLUMN IF NOT EXISTS personal_guess_percent double precision;
-- Re-applying this file is safe; the range matches the AI forecast scale.
ALTER TABLE public.experiments DROP CONSTRAINT IF EXISTS experiments_personal_guess_range;
ALTER TABLE public.experiments ADD CONSTRAINT experiments_personal_guess_range
    CHECK (personal_guess_percent IS NULL OR
           personal_guess_percent BETWEEN -100 AND 200);
COMMENT ON COLUMN public.experiments.personal_guess_percent IS
    'User guess before seeing the AI forecast: signed percent change from baseline; null for old experiments.';
NOTIFY pgrst, 'reload schema';
COMMIT;
