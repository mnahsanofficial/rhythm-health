-- Restores one active experiment per profile. Changes no experiment.
-- If any profile has two or more active, the index below fails and the whole transaction
-- aborts with nothing changed: those people must finish the extras first. Never complete
-- or delete their experiments from here. Read-only check:
--   SELECT profile_id, count(*) FROM public.experiments
--   WHERE status = 'active' GROUP BY 1 HAVING count(*) > 1;
BEGIN;

DROP TRIGGER IF EXISTS experiments_active_limit ON public.experiments;
DROP FUNCTION IF EXISTS public.enforce_active_experiment_limit();

CREATE UNIQUE INDEX experiments_one_active_per_profile
  ON public.experiments (profile_id)
  WHERE status = 'active';

COMMIT;
