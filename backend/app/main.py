from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import monitoring

from app.api import checkins, demo, experiments, me, profile, reports
from app.config import settings
from app.integrations import supabase

monitoring.configure_logging()
monitoring.init_error_reporting(settings.sentry_dsn, environment=settings.app_environment)

app = FastAPI(title="Rhythm Health Lab API")

app.include_router(me.router)
app.include_router(profile.router)
app.include_router(experiments.router)
app.include_router(checkins.router)
app.include_router(checkins.today_router)
app.include_router(reports.router)
app.include_router(demo.router)

app.add_middleware(monitoring.SafeErrorMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Request-ID"],
)
# Added last so it's outermost, and also logs what CORS answers by itself.
app.add_middleware(monitoring.RequestLogMiddleware)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/supabase")
def health_supabase() -> dict[str, str]:
    return {"status": "ok" if supabase.check_connection() else "unavailable"}


@app.get("/api/health")
def api_health() -> JSONResponse:
    """A cheap table query, plus configuration presence; never values."""
    up = supabase.check_connection()
    if not up:
        monitoring.report_failure("database_unavailable")
    return JSONResponse({"status": "ok" if up else "degraded",
                         "database": "ok" if up else "unavailable", "db": "up" if up else "down",
                         "ai_config_present": bool(settings.openrouter_api_key)}, status_code=200 if up else 503)


@app.get("/api/dev/failure-drill", include_in_schema=False)
def failure_drill():
    if not settings.dev_failure_drill or settings.app_environment != "development":
        raise HTTPException(status_code=404, detail="Not found")
    raise RuntimeError("Rhythm backend failure drill")
