-- Destructive only to optional S6 guesses. Export them before rolling back if needed.
-- Application retains its no-guess path after this rollback.
BEGIN;
ALTER TABLE public.experiments DROP COLUMN IF EXISTS personal_guess_percent;
NOTIFY pgrst, 'reload schema';
COMMIT;
