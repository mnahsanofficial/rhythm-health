"""Disposable PostgreSQL check: never reads app env or connects to an existing server.

Run: python3 backend/tests/migrations/check_experiment_outcome.py
Requires local PostgreSQL binaries in PATH or Homebrew PostgreSQL 18.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "supabase/migrations/20261104200000_experiment_outcome.sql"
ROLLBACK = ROOT / "supabase/rollbacks/20261104200000_experiment_outcome.sql"
# A clean process environment prevents PG* settings from selecting a real database.
ENV = {"PATH": os.defpath, "LC_ALL": "C"}


def binary(name):
    found = shutil.which(name)
    homebrew = Path("/opt/homebrew/opt/postgresql@18/bin") / name
    if found:
        return found
    if homebrew.is_file():
        return str(homebrew)
    raise SystemExit(f"Install local PostgreSQL first: missing {name}")


def main():
    with tempfile.TemporaryDirectory(prefix="rhythm-outcome-postgres-") as scratch:
        temp = Path(scratch)
        data, socket = temp / "data", temp / "socket"
        socket.mkdir()

        def run(args):
            return subprocess.run(args, env=ENV, capture_output=True, text=True)

        def checked(args):
            result = run(args)
            if result.returncode:
                raise AssertionError(result.stderr)
            return result.stdout.strip()

        checked([binary("initdb"), "-D", str(data), "--auth=trust", "--no-locale", "--encoding=UTF8"])
        checked([binary("pg_ctl"), "-D", str(data), "-l", str(temp / "postgres.log"),
                 "-o", f"-h '' -k {socket} -p 55440", "start"])
        try:
            psql = [binary("psql"), "-X", "-qAt", "-h", str(socket), "-p", "55440", "-d", "postgres", "-v", "ON_ERROR_STOP=1"]

            def sql(query):
                return checked([*psql, "-c", query])

            def file(path):
                checked([*psql, "-f", str(path)])

            sql("""CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
                CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
                CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL STABLE AS
                $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
                GRANT USAGE ON SCHEMA auth TO authenticated;
                GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;""")
            for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
                if path != MIGRATION:
                    file(path)
            sql("""INSERT INTO auth.users VALUES ('11111111-1111-1111-1111-111111111111');
                INSERT INTO public.profiles(id, user_id, age_range, usual_sleep_hours, usual_sleep_schedule, activity_level)
                VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '25-34', 8, '{}', 'lightly_active');
                INSERT INTO public.experiments(id, profile_id, question, category, hypothesis, intervention, baseline_days, intervention_days, metrics, success_criteria, prediction)
                VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Does an evening walk help?', 'energy', 'A small change', '{}', 3, 7, '[]', '{}', '{}');""")
            before = sql("SELECT row_to_json(e) FROM public.experiments e")
            security = "SELECT relrowsecurity FROM pg_class WHERE oid='public.experiments'::regclass"
            policies = "SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename='experiments'"
            grants = "SELECT grantee,privilege_type FROM information_schema.role_table_grants WHERE table_name='experiments' ORDER BY 1,2"
            expected = [sql(security), sql(policies), sql(grants)]
            file(MIGRATION)
            file(MIGRATION)  # Re-applying is safe.
            after = json.loads(sql("SELECT row_to_json(e) FROM public.experiments e"))
            assert after.pop("outcome") is None
            assert after == json.loads(before), "Existing rows and timestamps must not change"
            for value in ["'keep'", "'variation'", "'new'", "NULL"]:
                sql(f"UPDATE public.experiments SET outcome={value}")
            for value in ["'maybe'", "''", "'KEEP'"]:
                result = run([*psql, "-c", f"UPDATE public.experiments SET outcome={value}"])
                assert result.returncode != 0 and "experiments_outcome_choice" in result.stderr
            assert [sql(security), sql(policies), sql(grants)] == expected
            refused = run([*psql, "-c", "SET ROLE authenticated; SET request.jwt.claim.sub='11111111-1111-1111-1111-111111111111'; UPDATE public.experiments SET outcome='keep'"])
            assert refused.returncode != 0, "Only the backend writes a choice"
            sql("UPDATE public.experiments SET outcome='keep'")
            file(ROLLBACK)
            assert sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='experiments' AND column_name='outcome'") == "0"
            assert sql("SELECT count(*) FROM public.experiments") == "1"
            file(MIGRATION)
            assert sql("SELECT outcome IS NULL FROM public.experiments") == "t"
            print("PASS: nullable rollout; existing rows unchanged; only the three choices; unchanged RLS and grants; backend-only writes; rollback and re-apply. Disposable Unix socket only; no shared DB connection.")
        finally:
            checked([binary("pg_ctl"), "-D", str(data), "-m", "immediate", "stop"])


if __name__ == "__main__":
    main()
