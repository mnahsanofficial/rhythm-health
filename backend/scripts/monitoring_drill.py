"""Launch only our own worktree process. Never edit env files or handle credentials.

OpenRouter always points to a local stub and always gets a fake API key. Database
writes happen only through normal authenticated application actions.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("app", choices=["backend", "web", "mobile"])
    parser.add_argument("--env-file", required=True, type=Path)
    parser.add_argument("--case", choices=["crash", "ai-down", "ai-timeout", "ai-invalid", "db-down", "cap", "event-fail", "happy"], default="crash")
    parser.add_argument("--port", type=int, default=8106)
    parser.add_argument("--api-url", help="Phone-reachable URL of our own backend on port 8106")
    args = parser.parse_args()
    if args.port in {3000, 8000, 8001, 8081}:
        parser.error("Choose a separate drill port")
    if args.app == "mobile" and (not args.api_url or urlsplit(args.api_url).port != 8106):
        parser.error("Mobile requires --api-url pointing to our drill backend on port 8106")
    env = {**os.environ, **{k: v for k, v in dotenv_values(args.env_file).items() if v is not None}}
    env.update(DEV_FAILURE_DRILL="1", APP_ENVIRONMENT="development", EXPO_PUBLIC_APP_ENVIRONMENT="development",
               NEXT_PUBLIC_APP_ENVIRONMENT="development", EXPO_PUBLIC_DEV_TOOLS="1",
               NEXT_PUBLIC_API_URL="http://127.0.0.1:8106", CORS_ORIGINS="http://localhost:3106,http://127.0.0.1:3106",
               SENTRY_RELEASE=subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip())
    if args.app == "mobile":
        env["EXPO_PUBLIC_API_URL"] = args.api_url
    env["OPENROUTER_API_KEY"] = "local-drill-stub"
    env["AI_DAILY_LIMIT_PROPOSE"] = "0" if args.case == "cap" else "5"
    env["DEV_EVENT_WRITE_FAILURE"] = "1" if args.case == "event-fail" else "0"
    if args.case == "db-down":
        env["SUPABASE_JWT_ISSUER"] = env.get("SUPABASE_JWT_ISSUER") or env.get("SUPABASE_URL", "").rstrip("/") + "/auth/v1"
        env["SUPABASE_URL"] = "http://127.0.0.1:1"
    calls = 0
    class Stub(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass
        def do_POST(self):
            nonlocal calls
            self.rfile.read(int(self.headers.get("Content-Length", 0)))
            calls += 1
            print(json.dumps({"event": "drill_stub_call", "attempt": calls, "case": args.case}), flush=True)
            if args.case == "ai-timeout":
                time.sleep(2)
                return
            self.send_response(200 if args.case == "ai-invalid" else 500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b"not json" if args.case == "ai-invalid" else b'{"error":"local drill"}')
    stub = ThreadingHTTPServer(("127.0.0.1", 0), Stub)
    threading.Thread(target=stub.serve_forever, daemon=True).start()
    env["OPENROUTER_BASE_URL"] = f"http://127.0.0.1:{stub.server_port}"
    env["OPENROUTER_TIMEOUT_SECONDS"] = "0.25"
    if args.app == "backend":
        command, cwd = [str(ROOT / "backend/.venv/bin/python"), "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", str(args.port), "--no-access-log"], ROOT / "backend"
    elif args.app == "web":
        env["SENTRY_DSN"] = env.get("NEXT_PUBLIC_SENTRY_DSN", "")
        command, cwd = ["npm", "run", "dev", "--", "--port", str(args.port)], ROOT / "frontend"
    else:
        command, cwd = ["npx", "expo", "start", "--go", "--clear", "--port", str(args.port)], ROOT / "apps/mobile"
    print(json.dumps({"event": "drill_start", "app": args.app, "case": args.case, "port": args.port}), flush=True)
    try:
        subprocess.run(command, cwd=cwd, env=env, check=True)
    finally:
        stub.shutdown()


if __name__ == "__main__":
    main()
