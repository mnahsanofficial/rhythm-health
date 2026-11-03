-- Removes the whole schema, for undoing the first setup of a new project.
-- Refuses if any profile exists, so it can never remove anyone's data: past that point,
-- use the per-migration rollbacks instead. Also clears the db push history, so the
-- migrations can be applied again.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profiles) THEN
    RAISE EXCEPTION 'Refusing to remove the schema: this project has profiles';
  END IF;
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    DELETE FROM supabase_migrations.schema_migrations;
  END IF;
END;
$$;

DROP TABLE IF EXISTS public.experiment_reports;
DROP TABLE IF EXISTS public.daily_checkins;
DROP TABLE IF EXISTS public.experiments;
DROP TABLE IF EXISTS public.profiles;
DROP FUNCTION IF EXISTS public.enforce_active_experiment_limit();
DROP FUNCTION IF EXISTS public.set_updated_at();

NOTIFY pgrst, 'reload schema';

COMMIT;
