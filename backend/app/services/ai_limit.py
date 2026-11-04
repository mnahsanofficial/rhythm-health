import logging
from datetime import UTC, datetime
from typing import Literal

from fastapi import HTTPException

from app.config import settings
from app.integrations.supabase import SupabaseUnavailable
from app.repositories import ai_calls

logger = logging.getLogger(__name__)


def _limit_message(kind: str, limit: int) -> str:
    if kind == "propose":
        plans = "experiment plan" if limit == 1 else "experiment plans"
        return f"You've made {limit} {plans} today, which is the daily limit. Please come back tomorrow."
    written = "report" if limit == 1 else "reports"
    return f"You've had {limit} {written} written today, which is the daily limit. You can write this one tomorrow."


def ensure_within_daily_limit(profile_id: str, kind: Literal["propose", "report"]) -> None:
    """Raise 429 once today's (UTC) limit is used. Call this before any paid work.

    If usage can't be read, the call goes ahead: a tracking problem must not stop someone
    using the app, and the app must keep working until the ai_calls migration is applied.
    """
    limit = settings.ai_daily_limit_propose if kind == "propose" else settings.ai_daily_limit_report
    midnight = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    try:
        used = ai_calls.count_since(profile_id, kind, midnight, limit)
    except SupabaseUnavailable as exc:
        logger.warning("ai_limit_unchecked kind=%s error_type=%s", kind, type(exc).__name__)
        return
    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail={"code": "ai_daily_limit", "message": _limit_message(kind, limit), "limit": limit},
        )
