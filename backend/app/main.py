from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import checkins, experiments, me, profile
from app.config import settings
from app.integrations import supabase

app = FastAPI(title="Rhythm Health Lab API")

app.include_router(me.router)
app.include_router(profile.router)
app.include_router(experiments.router)
app.include_router(checkins.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/supabase")
def health_supabase() -> dict[str, str]:
    return {"status": "ok" if supabase.check_connection() else "unavailable"}
