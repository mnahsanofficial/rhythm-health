-- Up to three active experiments per profile, replacing the one-active unique index.
-- A count alone would let two simultaneous starts both pass, so each start takes a lock
-- for its profile first. The backend checks first for a clear message; this makes the
-- rule hold under concurrent starts and on every write path. 23505 reaches the backend
-- as HTTP 409 from PostgREST, the same as the old index.
-- Announce before applying to the shared project. Re-applying this file is safe.
BEGIN;

DROP INDEX IF EXISTS public.experiments_one_active_per_profile;

CREATE OR REPLACE FUNCTION public.enforce_active_experiment_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  active_count integer;
BEGIN
  IF NEW.status <> 'active'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'active' AND OLD.profile_id = NEW.profile_id) THEN
    RETURN NEW;
  END IF;

  -- Held until this transaction ends, so the count below sees any start that got here first.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.profile_id::text, 0));

  SELECT count(*) INTO active_count
  FROM public.experiments
  WHERE profile_id = NEW.profile_id AND status = 'active' AND id <> NEW.id;

  IF active_count >= 3 THEN
    RAISE EXCEPTION 'This profile already has the maximum number of active experiments'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experiments_active_limit ON public.experiments;
CREATE TRIGGER experiments_active_limit
BEFORE INSERT OR UPDATE OF status, profile_id ON public.experiments
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_experiment_limit();

COMMIT;
