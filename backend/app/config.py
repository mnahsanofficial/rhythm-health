from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    cors_origins: str = "http://localhost:3000"

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # Defaults to {supabase_url}/auth/v1, which is what Supabase puts in the `iss` claim.
    supabase_jwt_issuer: str = ""

    openrouter_api_key: str = ""
    openrouter_reasoning_model: str = "anthropic/claude-sonnet-5.5"
    # Jev classifier, served through OpenRouter.
    openrouter_jev_model: str = "typesafe/jev-router"

    @field_validator("openrouter_reasoning_model", "openrouter_jev_model", mode="before")
    @classmethod
    def _blank_means_default(cls, v, info):
        # `KEY=` in .env.local arrives as "", which should fall back to the default.
        return v if v else cls.model_fields[info.field_name].default

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def jwt_issuer(self) -> str:
        return self.supabase_jwt_issuer or f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.jwt_issuer}/.well-known/jwks.json"


settings = Settings()
