"""Disposable PostgreSQL check: never reads app env or connects to an existing server.

Proves the three-active limit under real concurrent sessions, which faked tests cannot.

Run: python3 backend/tests/migrations/check_active_limit.py
Requires local PostgreSQL binaries in PATH or Homebrew PostgreSQL 18.
"""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "supabase/migrations/20261104000000_active_experiment_limit.sql"
ROLLBACK = ROOT / "supabase/rollbacks/20261104000000_active_experiment_limit.sql"
# A clean process environment prevents PG* settings from selecting a real database.
ENV = {"PATH": os.defpath, "LC_ALL": "C"}
PROFILE_A = "22222222-2222-2222-2222-222222222222"
PROFILE_B = "22222222-2222-2222-2222-333333333333"


def binary(name):
    found = shutil.which(name)
    homebrew = Path("/opt/homebrew/opt/postgresql@18/bin") / name
    if found:
        return found
    if homebrew.is_file():
        return str(homebrew)
    raise SystemExit(f"Install local PostgreSQL first: missing {name}")


def main():
    if not MIGRATION.is_file() or not ROLLBACK.is_file():
        raise AssertionError("The active-limit migration and rollback must both exist")
    with tempfile.TemporaryDirectory(prefix="rhythm-limit-postgres-") as scratch:
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
        checked([binary("pg_ctl"), "-D", str(data), "-l", str(temp / "postgres.log"), "-w",
                 "-o", f"-h '' -k {socket} -p 55440", "start"])
        try:
            psql = [binary("psql"), "-X", "-qAt", "-h", str(socket), "-p", "55440", "-d", "postgres",
                    "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"]

            def sql(query):
                return checked([*psql, "-c", query])

            def file(path):
                checked([*psql, "-f", str(path)])

            def rejected(result):
                """A refused start: the error code PostgREST turns into HTTP 409."""
                return result.returncode != 0 and "23505" in result.stderr

            sql("""CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
                CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
                CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL STABLE AS
                $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
                GRANT USAGE ON SCHEMA auth TO authenticated;
                GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;""")
            for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
                if path != MIGRATION:
                    file(path)
            sql(f"""INSERT INTO auth.users VALUES ('11111111-1111-1111-1111-111111111111'), ('11111111-1111-1111-1111-222222222222');
                INSERT INTO public.profiles(id, user_id, age_range, usual_sleep_hours, usual_sleep_schedule, activity_level) VALUES
                ('{PROFILE_A}', '11111111-1111-1111-1111-111111111111', '25-34', 8, '{{}}', 'lightly_active'),
                ('{PROFILE_B}', '11111111-1111-1111-1111-222222222222', '25-34', 8, '{{}}', 'lightly_active');""")

            def proposed(profile):
                return sql(f"""INSERT INTO public.experiments(profile_id, question, category, hypothesis, intervention, baseline_days, intervention_days, metrics, success_criteria, prediction)
                    VALUES ('{profile}', 'q', 'energy', 'h', '{{}}', 3, 7, '[]', '{{}}', '{{}}') RETURNING id""").splitlines()[0]

            def start_sql(experiment):
                return f"UPDATE public.experiments SET status='active', started_at=now() WHERE id='{experiment}'"

            def start(experiment):
                return run([*psql, "-c", start_sql(experiment)])

            def finish(experiment):
                sql(f"UPDATE public.experiments SET status='completed', completed_at=now() WHERE id='{experiment}'")

            def active(profile):
                return int(sql(f"SELECT count(*) FROM public.experiments WHERE profile_id='{profile}' AND status='active'"))

            def clear():
                sql("DELETE FROM public.experiments")

            security = sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.experiments'::regclass")
            policies = sql("SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename='experiments'")
            privileges = sql("SELECT grantee,privilege_type FROM information_schema.role_table_grants WHERE table_name='experiments' ORDER BY 1,2")
            # An existing active experiment must survive the migration untouched.
            existing = proposed(PROFILE_A)
            assert start(existing).returncode == 0
            before = sql(f"SELECT row_to_json(e) FROM public.experiments e WHERE id='{existing}'")

            file(MIGRATION)
            file(MIGRATION)  # Idempotent forward application.

            assert sql(f"SELECT row_to_json(e) FROM public.experiments e WHERE id='{existing}'") == before
            assert sql("SELECT count(*) FROM pg_indexes WHERE indexname='experiments_one_active_per_profile'") == "0"
            assert security == sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.experiments'::regclass")
            assert policies == sql("SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename='experiments'")
            assert privileges == sql("SELECT grantee,privilege_type FROM information_schema.role_table_grants WHERE table_name='experiments' ORDER BY 1,2")

            # Three allowed, the fourth refused and left as it was.
            second, third, fourth = proposed(PROFILE_A), proposed(PROFILE_A), proposed(PROFILE_A)
            assert start(second).returncode == 0
            assert start(third).returncode == 0
            result = start(fourth)
            assert rejected(result), result.stderr
            assert active(PROFILE_A) == 3
            assert sql(f"SELECT status FROM public.experiments WHERE id='{fourth}'") == "proposed"

            # A direct insert (the sample) cannot get around the limit.
            direct = run([*psql, "-c", f"""INSERT INTO public.experiments(profile_id, status, question, category, hypothesis, intervention, baseline_days, intervention_days, metrics, success_criteria, prediction)
                VALUES ('{PROFILE_A}', 'active', 'q', 'energy', 'h', '{{}}', 3, 7, '[]', '{{}}', '{{}}')"""])
            assert rejected(direct), direct.stderr

            # At the limit, other writes still work: an active row can be edited.
            sql(f"UPDATE public.experiments SET question='edited' WHERE id='{existing}'")
            sql(f"UPDATE public.experiments SET status='active', question='edited again' WHERE id='{existing}'")
            sql(f"UPDATE public.experiments SET question='edited' WHERE id='{fourth}'")

            # One profile's limit never affects another.
            other = proposed(PROFILE_B)
            assert start(other).returncode == 0
            assert active(PROFILE_B) == 1

            # Finishing one frees a slot.
            finish(existing)
            assert start(fourth).returncode == 0
            assert active(PROFILE_A) == 3
            clear()

            # Two sessions race for the last slot. The first holds its transaction open, so
            # the second must wait, then see the committed row and be refused.
            first, second = proposed(PROFILE_A), proposed(PROFILE_A)
            assert start(first).returncode == 0
            assert start(second).returncode == 0
            racer_a, racer_b = proposed(PROFILE_A), proposed(PROFILE_A)
            holder = subprocess.Popen(psql, env=ENV, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, text=True)
            holder.stdin.write(f"BEGIN; {start_sql(racer_a)}; SELECT 'holding';\n")
            holder.stdin.flush()
            assert holder.stdout.readline().strip() == "holding"
            waiter = subprocess.Popen([*psql, "-c", start_sql(racer_b)], env=ENV, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, text=True)
            time.sleep(1)
            assert waiter.poll() is None, "the second start should wait for the first to commit"
            holder.stdin.write("COMMIT;\n")
            holder.stdin.close()
            holder.wait(timeout=20)
            _, waiter_error = waiter.communicate(timeout=20)
            assert waiter.returncode != 0 and "23505" in waiter_error, waiter_error
            assert active(PROFILE_A) == 3
            clear()

            # Eight starts at the same moment end with exactly three active.
            candidates = [proposed(PROFILE_A) for _ in range(8)]
            racers = [subprocess.Popen([*psql, "-c", start_sql(c)], env=ENV, stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE, text=True) for c in candidates]
            outcomes = [(r.communicate(timeout=30)[1], r.returncode) for r in racers]
            assert sum(1 for _, code in outcomes if code == 0) == 3, outcomes
            assert all("23505" in error for error, code in outcomes if code != 0), outcomes
            assert active(PROFILE_A) == 3
            clear()

            # Rollback refuses while a profile has two active, and changes nothing.
            first, second = proposed(PROFILE_A), proposed(PROFILE_A)
            assert start(first).returncode == 0
            assert start(second).returncode == 0
            result = run([*psql, "-f", str(ROLLBACK)])
            assert result.returncode != 0, "rollback must fail with two active experiments"
            assert sql("SELECT count(*) FROM pg_trigger WHERE tgname='experiments_active_limit'") == "1"
            assert sql("SELECT count(*) FROM pg_indexes WHERE indexname='experiments_one_active_per_profile'") == "0"
            assert active(PROFILE_A) == 2

            # With the extras finished it restores the old rule, and the migration reapplies.
            finish(second)
            file(ROLLBACK)
            assert sql("SELECT count(*) FROM pg_trigger WHERE tgname='experiments_active_limit'") == "0"
            assert sql("SELECT count(*) FROM pg_proc WHERE proname='enforce_active_experiment_limit'") == "0"
            result = start(proposed(PROFILE_A))
            assert rejected(result), result.stderr
            file(MIGRATION)
            assert start(proposed(PROFILE_A)).returncode == 0
            assert active(PROFILE_A) == 2

            # The first-setup rollback refuses while any profile exists, and changes nothing.
            initial = ROOT / "supabase/rollbacks/20261028000000_initial_schema.sql"
            result = run([*psql, "-f", str(initial)])
            assert result.returncode != 0 and "has profiles" in result.stderr, result.stderr
            assert sql("SELECT count(*) FROM public.profiles") == "2"
            # On an empty project it removes everything, and the migrations apply again.
            sql("DELETE FROM public.profiles")
            file(initial)
            assert sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'") == "0"
            assert sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'") == "0"
            for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
                file(path)
            assert sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'") == "4"
        finally:
            checked([binary("pg_ctl"), "-D", str(data), "-m", "immediate", "stop"])
    print("Active-limit migration: all checks passed on a disposable cluster.")


if __name__ == "__main__":
    main()
