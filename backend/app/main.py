from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import monitoring

from app.api import checkins, demo, experiments, me, profile, reports
from app.config import settings
from app.integrations import supabase

monitoring.configure_logging()
monitoring.init_error_reporting(settings.sentry_dsn)

app = FastAPI(title="Rhythm Health Lab API")

app.include_router(me.router)
app.include_router(profile.router)
app.include_router(experiments.router)
app.include_router(checkins.router)
app.include_router(checkins.today_router)
app.include_router(reports.router)
app.include_router(demo.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
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
    """For an uptime monitor: 503 means the app is up but can't reach its database."""
    if supabase.check_connection():
        return JSONResponse({"status": "ok", "database": "ok"})
    return JSONResponse({"status": "degraded", "database": "unavailable"}, status_code=503)
