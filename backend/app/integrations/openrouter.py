import asyncio
import logging
import time
from collections.abc import Callable
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
T = TypeVar("T", bound=BaseModel)
CONNECT_TIMEOUT_SECONDS = 5.0
DECISION_READ_TIMEOUT_SECONDS = 30.0
RETRY_DELAY_SECONDS = 0.5
# Worth one more try: the request never reached a model, or the service said to try again.
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class AIError(Exception):
    """Base class for failures that should surface as a safe application error."""


class AIUnavailable(AIError):
    """OpenRouter could not be reached or rejected the request. Retryable."""


class AIInvalidOutput(AIError):
    """The model answered, but not with data matching the schema (after one retry)."""


async def complete(
    *,
    task: str,
    model: str,
    schema: type[T],
    system: str,
    user: str,
    timeout: float | None = None,
    check: Callable[[T], None] | None = None,
) -> T:
    """Ask `model` for JSON matching `schema`; validate with Pydantic, retry once.

    `check` is an extra semantic validation run on a schema-valid result. It raises
    ValueError to reject it; the message is fed back to the model for the retry.

    Prompts and responses are never logged: they contain personal data.
    """
    if not settings.openrouter_api_key:
        raise AIUnavailable("OpenRouter is not configured")
    timeout = settings.openrouter_timeout_seconds if timeout is None else timeout

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    for attempt in (0, 1):
        started = time.monotonic()
        content = await _call(task, model, schema, messages, timeout)
        try:
            result = schema.model_validate_json(content)
            if check is not None:
                check(result)
        except ValueError as exc:  # pydantic's ValidationError is a ValueError
            logger.warning(
                "ai_invalid_output task=%s model=%s validation_retry=%s",
                task, model, attempt,
            )
            if attempt == 1:
                raise AIInvalidOutput(task) from exc
            messages += [
                {"role": "assistant", "content": content},
                {
                    "role": "user",
                    "content": "That was rejected. "
                    f"Errors: {_feedback(exc)}. "
                    "Reply again with only corrected JSON that satisfies the schema and rules.",
                },
            ]
            continue
        logger.info(
            "ai_complete task=%s model=%s latency_ms=%d validation_retry=%s",
            task, model, (time.monotonic() - started) * 1000, attempt,
        )
        return result
    raise AssertionError("unreachable")


def _feedback(exc: ValueError) -> str:
    return exc.json(include_input=False) if isinstance(exc, ValidationError) else str(exc)


async def decide(
    *, task: str, model: str, state: dict, questions: dict, timeout: float = DECISION_READ_TIMEOUT_SECONDS
) -> dict:
    """Typed decisions (Jev) via OpenRouter's Decisions API. Returns the `answers` map."""
    if not settings.openrouter_api_key:
        raise AIUnavailable("OpenRouter is not configured")
    data = await _post(task, model, DECISIONS_URL, {"model": model, "state": state, "questions": questions}, timeout)
    try:
        return data["answers"]
    except (KeyError, TypeError) as exc:
        raise AIInvalidOutput(task) from exc


async def _call(task: str, model: str, schema: type[BaseModel], messages: list[dict], timeout: float) -> str:
    payload = {
        "model": model,
        "messages": messages,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": schema.__name__,
                "strict": True,
                "schema": schema.model_json_schema(),
            },
        },
    }
    data = await _post(task, model, OPENROUTER_URL, payload, timeout)
    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as exc:
        raise AIUnavailable(task) from exc


async def _post(task: str, model: str, url: str, payload: dict, timeout: float) -> dict:
    """POST once, and once more if the first try failed in a way that cost nothing.

    A read timeout isn't retried: the model probably ran and was paid for, and trying again
    would double a wait that's already long. The person can choose to retry from the screen.
    """
    limits = httpx.Timeout(timeout, connect=CONNECT_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=limits) as client:
        for attempt in (0, 1):
            try:
                res = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
                    json=payload,
                )
                res.raise_for_status()
                return res.json()
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                logger.error("ai_http_error task=%s model=%s status=%s attempt=%s", task, model, status, attempt)
                if attempt == 1 or status not in RETRYABLE_STATUS:
                    raise AIUnavailable(task) from exc
            except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
                logger.error("ai_error task=%s model=%s error_type=%s attempt=%s", task, model, type(exc).__name__, attempt)
                if attempt == 1:
                    raise AIUnavailable(task) from exc
            except (httpx.HTTPError, ValueError) as exc:
                logger.error("ai_error task=%s model=%s error_type=%s attempt=%s", task, model, type(exc).__name__, attempt)
                raise AIUnavailable(task) from exc
            await asyncio.sleep(RETRY_DELAY_SECONDS)
    raise AssertionError("unreachable")
