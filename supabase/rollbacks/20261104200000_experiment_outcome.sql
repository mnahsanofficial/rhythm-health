-- Undoes 20261104200000_experiment_outcome.sql. This deletes every stored choice, so "Habits I kept" empties.
-- The backend reads the column as optional, so the app keeps working afterwards.
BEGIN;
ALTER TABLE public.experiments DROP CONSTRAINT IF EXISTS experiments_outcome_choice;
ALTER TABLE public.experiments DROP COLUMN IF EXISTS outcome;
NOTIFY pgrst, 'reload schema';
COMMIT;
