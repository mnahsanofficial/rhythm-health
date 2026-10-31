"""Disposable PostgreSQL check: never reads app env or connects to an existing server.

Run: python3 backend/tests/migrations/check_personal_guess.py
Requires local PostgreSQL binaries in PATH or Homebrew PostgreSQL 18.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "supabase/migrations/20261031000000_personal_guess.sql"
ROLLBACK = ROOT / "supabase/rollbacks/20261031000000_personal_guess.sql"
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
    with tempfile.TemporaryDirectory(prefix="rhythm-s6-postgres-") as scratch:
        temp = Path(scratch)
        data, socket = temp / "data", temp / "socket"
        socket.mkdir()
        def run(args, **kwargs):
            return subprocess.run(args, env=ENV, capture_output=True, text=True, **kwargs)
        def checked(args):
            result = run(args)
            if result.returncode:
                raise AssertionError(result.stderr)
            return result.stdout.strip()
        checked([binary("initdb"), "-D", str(data), "--auth=trust", "--no-locale", "--encoding=UTF8"])
        checked([binary("pg_ctl"), "-D", str(data), "-l", str(temp / "postgres.log"),
                 "-o", f"-h '' -k {socket} -p 55439", "start"])
        try:
            psql = [binary("psql"), "-X", "-qAt", "-h", str(socket), "-p", "55439", "-d", "postgres", "-v", "ON_ERROR_STOP=1"]
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
            security = sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.experiments'::regclass")
            policies = sql("SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename='experiments'")
            privileges = sql("SELECT grantee,privilege_type FROM information_schema.role_table_grants WHERE table_name='experiments' ORDER BY 1,2")
            file(MIGRATION)
            file(MIGRATION)  # Idempotent forward application.
            after = json.loads(sql("SELECT row_to_json(e) FROM public.experiments e"))
            assert after.pop("personal_guess_percent") is None
            # Compare logical data, ignoring no columns: ALTER must not touch existing values/timestamps.
            assert after == json.loads(before)
            for value in ["-100", "-12.5", "0", "200", "NULL"]:
                sql(f"UPDATE public.experiments SET personal_guess_percent={value}")
            for value in ["-101", "201", "'NaN'::float8", "'Infinity'::float8", "'-Infinity'::float8"]:
                result = run([*psql, "-c", f"UPDATE public.experiments SET personal_guess_percent={value}"])
                assert result.returncode != 0 and "experiments_personal_guess_range" in result.stderr
            assert sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.experiments'::regclass") == security
            assert sql("SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename='experiments'") == policies
            assert sql("SELECT grantee,privilege_type FROM information_schema.role_table_grants WHERE table_name='experiments' ORDER BY 1,2") == privileges
            assert sql("SET ROLE authenticated; SET request.jwt.claim.sub='11111111-1111-1111-1111-111111111111'; SELECT count(*) FROM public.experiments") == "1"
            assert sql("SET ROLE authenticated; SET request.jwt.claim.sub='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; SELECT count(*) FROM public.experiments") == "0"
            file(ROLLBACK)
            assert sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='experiments' AND column_name='personal_guess_percent'") == "0"
            assert sql("SELECT count(*) FROM public.experiments") == "1"
            file(MIGRATION)
            assert sql("SELECT personal_guess_percent IS NULL FROM public.experiments") == "t"
            print("PASS: six original migrations; nullable rollout; bounds/nonfinite rejection; unchanged RLS/grants; owner-only reads; rollback/reapply. Disposable Unix socket only; no shared DB connection.")
        finally:
            checked([binary("pg_ctl"), "-D", str(data), "-m", "immediate", "stop"])


if __name__ == "__main__":
    main()
