"""Disposable PostgreSQL check: never reads app env or connects to an existing server.

Run: python3 backend/tests/migrations/check_ai_calls.py
Requires local PostgreSQL binaries in PATH or Homebrew PostgreSQL 18.
"""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "supabase/migrations/20261104100000_ai_calls.sql"
ROLLBACK = ROOT / "supabase/rollbacks/20261104100000_ai_calls.sql"
LOCKDOWN = ROOT / "supabase/migrations/20261104100100_ai_calls_service_role_only.sql"
# A clean process environment prevents PG* settings from selecting a real database.
ENV = {"PATH": os.defpath, "LC_ALL": "C"}
USER = "11111111-1111-1111-1111-111111111111"
PROFILE = "22222222-2222-2222-2222-222222222222"


def binary(name):
    found = shutil.which(name)
    homebrew = Path("/opt/homebrew/opt/postgresql@18/bin") / name
    if found:
        return found
    if homebrew.is_file():
        return str(homebrew)
    raise SystemExit(f"Install local PostgreSQL first: missing {name}")


def main():
    with tempfile.TemporaryDirectory(prefix="rhythm-ai-calls-") as scratch:
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
                 "-o", f"-h '' -k {socket} -p 55441", "start"])
        try:
            psql = [binary("psql"), "-X", "-qAt", "-h", str(socket), "-p", "55441", "-d", "postgres", "-v", "ON_ERROR_STOP=1"]

            def sql(query):
                return checked([*psql, "-c", query])

            def rejected(query):
                return run([*psql, "-c", query]).returncode != 0

            sql("""CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
                CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
                CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL STABLE AS
                $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
                GRANT USAGE ON SCHEMA auth TO authenticated;
                GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
                -- Supabase's default privileges, which gave these roles everything on a new table.
                ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;""")
            for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
                checked([*psql, "-f", str(path)])
            checked([*psql, "-f", str(MIGRATION)])  # Re-applying is safe.
            checked([*psql, "-f", str(LOCKDOWN)])
            grants = sql("SELECT string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee, privilege_type) "
                         "FROM information_schema.role_table_grants WHERE table_name='ai_calls' "
                         "AND grantee IN ('anon','authenticated','service_role')")
            assert grants == "service_role:INSERT,service_role:SELECT", grants

            sql(f"""INSERT INTO auth.users VALUES ('{USER}');
                INSERT INTO public.profiles(id, user_id, age_range, usual_sleep_hours, usual_sleep_schedule, activity_level)
                VALUES ('{PROFILE}', '{USER}', '25-34', 8, '{{}}', 'lightly_active');""")

            columns = sql("SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns "
                          "WHERE table_schema='public' AND table_name='ai_calls'")
            assert columns == "id,profile_id,kind,model,status,latency_ms,created_at", columns

            insert = "SET ROLE service_role; INSERT INTO public.ai_calls(profile_id, kind, model, status, latency_ms) "
            sql(f"{insert} VALUES ('{PROFILE}', 'propose', 'model', 'ok', 12)")
            assert rejected(f"{insert} VALUES ('{PROFILE}', 'chat', 'model', 'ok', 12)")
            assert rejected(f"{insert} VALUES ('{PROFILE}', 'propose', 'model', 'great', 12)")
            assert rejected(f"{insert} VALUES ('{PROFILE}', 'propose', 'model', 'ok', -1)")

            for role in ("authenticated", "anon"):
                assert rejected(f"SET ROLE {role}; SELECT * FROM public.ai_calls")
                assert rejected(f"SET ROLE {role}; TRUNCATE public.ai_calls")
                assert rejected(f"SET ROLE {role}; INSERT INTO public.ai_calls(profile_id, kind, model, status, latency_ms) "
                                f"VALUES ('{PROFILE}', 'propose', 'model', 'ok', 1)")
            assert sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.ai_calls'::regclass") == "t"
            assert sql("SET ROLE service_role; SELECT count(*) FROM public.ai_calls") == "1"

            experiments = sql("SELECT count(*) FROM public.experiments")
            checked([*psql, "-f", str(ROLLBACK)])
            assert sql("SELECT to_regclass('public.ai_calls') IS NULL") == "t"
            assert sql("SELECT count(*) FROM public.experiments") == experiments
            assert sql("SELECT count(*) FROM public.profiles") == "1"

            checked([*psql, "-f", str(MIGRATION)])
            sql(f"DELETE FROM auth.users WHERE id='{USER}'")
            assert sql("SELECT count(*) FROM public.ai_calls") == "0"
            print("PASS: columns hold no prompt text; bad values rejected; only the service role has access; "
                  "rollback removes only this table; re-applying is safe; deleting a person removes their rows")
        finally:
            checked([binary("pg_ctl"), "-D", str(data), "-m", "immediate", "stop"])


if __name__ == "__main__":
    main()
