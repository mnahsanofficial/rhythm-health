from fastapi import HTTPException

from app.repositories import experiments
from app.schemas.experiment import ActiveCapacity

# Must match supabase/migrations/20261104000000_active_experiment_limit.sql, which holds
# the rule under concurrent starts. Checking here gives a clear message, and lets
# /propose stop before any paid AI work.
MAX_ACTIVE_EXPERIMENTS = 3


def capacity(profile_id: str) -> ActiveCapacity:
    active = len(experiments.list_for_profile(profile_id, "active"))
    return ActiveCapacity(active=active, limit=MAX_ACTIVE_EXPERIMENTS, can_start=active < MAX_ACTIVE_EXPERIMENTS)


def limit_reached() -> HTTPException:
    return HTTPException(status_code=409, detail={
        "code": "active_limit_reached",
        "message": f"You're running {MAX_ACTIVE_EXPERIMENTS} experiments, the most at once. Finish one to start another.",
        "limit": MAX_ACTIVE_EXPERIMENTS,
    })
