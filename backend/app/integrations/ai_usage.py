"""Writes one ai_calls row per OpenRouter call. Tracking must never break the feature it tracks."""
import logging
import time
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

from app.integrations.supabase import SupabaseConflict, SupabaseUnavailable
from app.repositories import ai_calls

logger = logging.getLogger(__name__)

# Which limit a task's calls count towards. Classification is cheap and runs on every question,
# including ones the safety rules stop, so it's tracked but isn't one of the limited actions.
KIND_BY_TASK = {"experiment_design": "propose", "report_narrative": "report"}

_profile_id: ContextVar[str | None] = ContextVar("ai_usage_profile_id", default=None)


@contextmanager
def for_profile(profile_id: str) -> Iterator[None]:
    """Attribute the OpenRouter calls made inside this block to one person."""
    token = _profile_id.set(profile_id)
    try:
        yield
    finally:
        _profile_id.reset(token)


def record(task: str, model: str, status: str, started: float) -> None:
    profile_id = _profile_id.get()
    if profile_id is None:
        logger.warning("ai_call_unattributed task=%s model=%s status=%s", task, model, status)
        return
    latency_ms = max(0, int((time.monotonic() - started) * 1000))
    try:
        ai_calls.insert(profile_id, KIND_BY_TASK.get(task, "other"), model, status, latency_ms)
    except (SupabaseUnavailable, SupabaseConflict, ValueError) as exc:
        logger.warning("ai_call_not_recorded task=%s error_type=%s", task, type(exc).__name__)
