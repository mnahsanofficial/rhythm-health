"""Applies every migration, rolls each back in reverse, then applies them all again.

Fails if a migration has no rollback, a rollback changes nothing or leaves anything behind, or
re-applying gives a different schema. Touches only a disposable database.

Locally:  python3 backend/tests/migrations/check_all_migrations.py
          (starts a temporary PostgreSQL; needs its binaries in PATH or Homebrew PostgreSQL 18)
In CI:    MIGRATION_CHECK_DB_URL points at the job's Postgres service. Anything but localhost is refused.
"""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = ROOT / "supabase/migrations"
ROLLBACKS = ROOT / "supabase/rollbacks"
# These first files are undone together by the one schema rollback.
INITIAL_ROLLBACK = "20261028000000_initial_schema.sql"
COVERED_BY_INITIAL = {
    "20261028000000_create_profiles.sql",
    "20261028000100_grant_profiles_privileges.sql",
    "20261028000200_create_experiments.sql",
    "20261028000300_one_active_experiment_per_profile.sql",
    "20261028000400_create_daily_checkins.sql",
    "20261028000500_create_experiment_reports.sql",
}
# A clean process environment, so PG* settings can't select a real database.
ENV = {"PATH": os.environ.get("PATH", os.defpath), "LC_ALL": "C"}
USER = "11111111-1111-1111-1111-111111111111"

# Supabase's roles, auth schema and default privileges, as far as the migrations depend on them.
BOOTSTRAP = """
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
"""

# Everything in public a migration can change, read from the catalog so any psql version works.
SNAPSHOT = """
SELECT 'column ' || table_name || '.' || column_name || ' ' || data_type || ' null=' || is_nullable
       || ' default=' || coalesce(column_default, '')
  FROM information_schema.columns WHERE table_schema = 'public'
UNION ALL SELECT 'constraint ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
  FROM pg_constraint WHERE connamespace = 'public'::regnamespace
UNION ALL SELECT 'index ' || indexdef FROM pg_indexes WHERE schemaname = 'public'
UNION ALL SELECT 'trigger ' || tgrelid::regclass || ' ' || pg_get_triggerdef(oid)
  FROM pg_trigger WHERE NOT tgisinternal
UNION ALL SELECT 'function ' || pg_get_functiondef(oid) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
UNION ALL SELECT 'policy ' || tablename || ' ' || policyname || ' ' || cmd || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
  FROM pg_policies WHERE schemaname = 'public'
UNION ALL SELECT 'rls ' || relname || ' ' || relrowsecurity
  FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
UNION ALL SELECT 'grant ' || table_name || ' ' || grantee || ' ' || privilege_type
  FROM information_schema.role_table_grants WHERE table_schema = 'public'
ORDER BY 1
"""


def paired_files():
    """Each migration in order, and the rollbacks in the order to run them. Fails on a missing rollback."""
    migrations = sorted(path.name for path in MIGRATIONS.glob("*.sql"))
    rollbacks = []
    missing = []
    for name in migrations:
        if name in COVERED_BY_INITIAL:
            continue
        if (ROLLBACKS / name).is_file():
            rollbacks.append(name)
        else:
            missing.append(name)
    if missing:
        raise SystemExit(f"FAIL: no rollback in supabase/rollbacks/ for: {', '.join(missing)}")
    gone = COVERED_BY_INITIAL - set(migrations)
    if gone:
        raise SystemExit(f"FAIL: COVERED_BY_INITIAL names files that don't exist: {', '.join(sorted(gone))}")
    if not (ROLLBACKS / INITIAL_ROLLBACK).is_file():
        raise SystemExit(f"FAIL: missing {INITIAL_ROLLBACK}")
    return migrations, [*reversed(rollbacks), INITIAL_ROLLBACK]


def check(psql_base):
    def run(args):
        return subprocess.run([*psql_base, *args], env=ENV, capture_output=True, text=True)

    def checked(args, what):
        result = run(args)
        if result.returncode:
            raise SystemExit(f"FAIL: {what}\n{result.stderr}")
        return result.stdout.strip()

    def snapshot():
        return checked(["-c", SNAPSHOT], "reading the schema")

    migrations, rollbacks = paired_files()
    checked(["-c", BOOTSTRAP], "bootstrap")

    def apply_all(label):
        for name in migrations:
            checked(["-f", str(MIGRATIONS / name)], f"{label}: {name}")

    apply_all("applying")
    first = snapshot()
    assert first, "applying the migrations created nothing"

    # The schema rollback must refuse while anyone's data exists.
    checked(["-c", f"""INSERT INTO auth.users VALUES ('{USER}');
        INSERT INTO public.profiles(user_id, age_range, usual_sleep_hours, usual_sleep_schedule, activity_level)
        VALUES ('{USER}', '25-34', 8, '{{}}', 'lightly_active');"""], "adding a profile")
    if run(["-f", str(ROLLBACKS / INITIAL_ROLLBACK)]).returncode == 0:
        raise SystemExit(f"FAIL: {INITIAL_ROLLBACK} ran while a profile existed")
    checked(["-c", f"DELETE FROM auth.users WHERE id = '{USER}'"], "removing the profile")

    before = first
    for name in rollbacks:
        checked(["-f", str(ROLLBACKS / name)], f"rolling back: {name}")
        after = snapshot()
        if after == before:
            raise SystemExit(f"FAIL: rollback changed nothing: {name}")
        before = after
    if before:
        raise SystemExit(f"FAIL: rollbacks left this behind:\n{before}")

    apply_all("re-applying")
    second = snapshot()
    if second != first:
        was, now = set(first.splitlines()), set(second.splitlines())
        raise SystemExit(f"FAIL: re-applying gave a different schema.\nOnly first: {was - now}\nOnly second: {now - was}")
    print(f"PASS: {len(migrations)} migrations applied, {len(rollbacks)} rollbacks each changed the schema and "
          "left nothing behind, the schema rollback refused while a profile existed, and re-applying matched.")


def binary(name):
    found = shutil.which(name)
    homebrew = Path("/opt/homebrew/opt/postgresql@18/bin") / name
    if found:
        return found
    if homebrew.is_file():
        return str(homebrew)
    raise SystemExit(f"Install local PostgreSQL first: missing {name}")


def psql_flags():
    return ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"]


def main():
    url = os.environ.get("MIGRATION_CHECK_DB_URL")
    if url:
        if urlparse(url).hostname not in {"localhost", "127.0.0.1"}:
            raise SystemExit("Refusing: MIGRATION_CHECK_DB_URL must be a disposable database on localhost.")
        check([binary("psql"), *psql_flags(), url])
        return
    with tempfile.TemporaryDirectory(prefix="rhythm-migrations-") as scratch:
        temp = Path(scratch)
        data, socket = temp / "data", temp / "socket"
        socket.mkdir()
        subprocess.run([binary("initdb"), "-D", str(data), "--auth=trust", "--no-locale", "--encoding=UTF8"],
                       env=ENV, capture_output=True, check=True)
        subprocess.run([binary("pg_ctl"), "-D", str(data), "-l", str(temp / "postgres.log"),
                        "-o", f"-h '' -k {socket} -p 55442", "-w", "start"], env=ENV, capture_output=True, check=True)
        try:
            check([binary("psql"), *psql_flags(), "-h", str(socket), "-p", "55442", "-d", "postgres"])
        finally:
            subprocess.run([binary("pg_ctl"), "-D", str(data), "-m", "immediate", "stop"], env=ENV, capture_output=True)


if __name__ == "__main__":
    main()
