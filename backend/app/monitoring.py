"""Allowlisted error reports and structured request logs; never collect payloads."""
import hashlib
import hmac
import json
import logging
import os
import secrets
import subprocess
import sys
import time
import uuid
from contextvars import ContextVar
from types import ModuleType

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("app.request")
_context: ContextVar[dict | None] = ContextVar("monitoring_request", default=None)
_hash_key = secrets.token_bytes(32)
TITLES = {
    "unhandled_error": "Unhandled backend error", "database_unavailable": "Database unavailable",
    "ai_http_error": "AI provider unavailable", "ai_timeout": "AI provider timeout",
    "ai_invalid_output": "AI output invalid", "ai_error": "AI request failed",
    "http_server_error": "Backend service unavailable",
}


def git_release() -> str:
    explicit = os.getenv("SENTRY_RELEASE") or os.getenv("GITHUB_SHA")
    if explicit:
        return explicit
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.SubprocessError):
        return "unknown"


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        message = record.getMessage()
        try:
            data = json.loads(message)
        except (ValueError, TypeError):
            data = {"event": message.split(" ", 1)[0], "message": message}
        context = _context.get() or {}
        return json.dumps({**data, "level": record.levelname.lower(),
                           **({"request_id": context["request_id"]} if "request_id" in context else {})})


def configure_logging() -> None:
    app_logger = logging.getLogger("app")
    app_logger.setLevel(logging.INFO)
    if not app_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        app_logger.addHandler(handler)
    logging.getLogger("uvicorn.access").disabled = True


def identify_profile(profile_id: str) -> None:
    context = _context.get()
    if context is not None:
        context["profile_hash"] = hmac.new(_hash_key, str(profile_id).encode(), hashlib.sha256).hexdigest()[:24]


def report_failure(code: str) -> None:
    """Only fixed titles; never exception objects, provider responses or arbitrary text."""
    context = _context.get()
    if context is not None:
        context["reported"] = True
    from app.config import settings
    if not settings.sentry_dsn:
        return
    try:
        sdk = _load_sentry()
        if sdk.is_initialized():
            sdk.capture_message(TITLES[code], level="error")
    except Exception:
        logger.warning("error_report_not_sent")


class RequestLogMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        context = {"request_id": uuid.uuid4().hex, "profile_hash": None}
        token = _context.set(context)
        scope.setdefault("state", {})["request_id"] = context["request_id"]
        started, status = time.monotonic(), 500

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                if status >= 500 and not context.get("reported"):
                    report_failure("http_server_error")
                message["headers"] = [*message.get("headers", []), (b"x-request-id", context["request_id"].encode())]
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            route = getattr(scope.get("route"), "path", "unmatched")
            logger.log(logging.WARNING if status >= 500 else logging.INFO, json.dumps({
                "event": "request", "request_id": context["request_id"], "method": scope["method"],
                "route": route, "status": status, "latency_ms": int((time.monotonic() - started) * 1000),
                "profile_hash": context["profile_hash"],
            }))
            _context.reset(token)


class SafeErrorMiddleware:
    """Inside CORS, outside routes: even unhandled errors remain readable by the web."""
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        sent = False

        async def track_start(message: Message) -> None:
            nonlocal sent
            if message["type"] == "http.response.start":
                sent = True
            await send(message)

        try:
            await self.app(scope, receive, track_start)
        except Exception as exc:
            from app.integrations.supabase import SupabaseUnavailable
            unavailable = isinstance(exc, SupabaseUnavailable)
            report_failure("database_unavailable" if unavailable else "unhandled_error")
            context = _context.get()
            if context is not None:
                context["reported"] = True
            if not sent:
                await JSONResponse(
                    {"detail": "Database unavailable" if unavailable else "Something went wrong. Please try again."},
                    status_code=503 if unavailable else 500,
                )(scope, receive, send)
            # No private exception values in ASGI traceback logs.


def scrub_event(event: dict, _hint: dict) -> dict:
    """An allowlist: new SDK fields cannot silently disclose health data."""
    clean = {k: event[k] for k in ("event_id", "timestamp", "platform", "level", "release", "environment") if k in event}
    context = _context.get() or {}
    request_id = context.get("request_id") or event.get("tags", {}).get("request_id")
    if isinstance(request_id, str) and len(request_id) == 32 and all(c in "0123456789abcdef" for c in request_id):
        clean["tags"] = {"request_id": request_id}
    message = event.get("message")
    clean["message"] = message if message in TITLES.values() else "Unhandled backend error"
    return clean


def _load_sentry() -> ModuleType:
    import sentry_sdk
    return sentry_sdk


def init_error_reporting(dsn: str, *, environment: str = "development", release: str | None = None) -> bool:
    if not dsn:
        return False
    _load_sentry().init(
        dsn=dsn, environment=environment, release=release or git_release(),
        send_default_pii=False, traces_sample_rate=0, max_request_body_size="never",
        include_local_variables=False, max_breadcrumbs=0, default_integrations=False,
        before_send=scrub_event,
    )
    return True
