"""Request logs and optional error reporting. Neither ever sees a body, a token or a query string."""
import json
import logging
import sys
import time
import uuid
from types import ModuleType

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("app.request")


def configure_logging() -> None:
    """Send the app's own logs to stdout. Only `app.*`, because httpx logs full URLs at INFO."""
    app_logger = logging.getLogger("app")
    app_logger.setLevel(logging.INFO)
    if not app_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        app_logger.addHandler(handler)
    # The request log replaces this one, which prints full paths with their query strings.
    logging.getLogger("uvicorn.access").disabled = True


class RequestLogMiddleware:
    """One JSON line per request, and an X-Request-ID on the response to match it."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Always generated here: a client-sent id could put anything into the logs.
        request_id = uuid.uuid4().hex
        started = time.monotonic()
        status = 500

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message["headers"] = [*message.get("headers", []), (b"x-request-id", request_id.encode())]
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            route = getattr(scope.get("route"), "path", "unmatched")
            logger.info(json.dumps({
                "event": "request",
                "request_id": request_id,
                "method": scope["method"],
                "route": route,
                "status": status,
                "latency_ms": int((time.monotonic() - started) * 1000),
            }))


def scrub_event(event: dict, _hint: dict) -> dict:
    """Keep only the request's method and URL path on anything sent to Sentry."""
    request = event.get("request")
    if isinstance(request, dict):
        event["request"] = {key: request[key] for key in ("url", "method") if key in request}
    return event


def _load_sentry() -> ModuleType:
    import sentry_sdk
    return sentry_sdk


def init_error_reporting(dsn: str) -> bool:
    """Start Sentry when a DSN is set. Without one, nothing is even imported."""
    if not dsn:
        return False
    _load_sentry().init(
        dsn=dsn,
        send_default_pii=False,
        traces_sample_rate=0,
        max_request_body_size="never",
        # Local variables and breadcrumbs could hold prompts, notes or row ids.
        include_local_variables=False,
        max_breadcrumbs=0,
        before_send=scrub_event,
    )
    return True
