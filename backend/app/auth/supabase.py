from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import Settings, settings

# auto_error=False so a missing header becomes our own 401 (HTTPBearer would send 403).
bearer = HTTPBearer(auto_error=False)

# Supabase signs access tokens with asymmetric keys published at the JWKS URL.
SIGNING_ALGORITHMS = ["RS256", "ES256"]


def get_settings() -> Settings:
    return settings


@lru_cache
def _jwk_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_keys=True)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    cfg: Settings = Depends(get_settings),
) -> str:
    """Verify the Supabase access token and return the user id (`sub`)."""
    if credentials is None:
        raise _unauthorized("Missing bearer token")
    if not cfg.supabase_url:
        raise HTTPException(status_code=503, detail="Auth is not configured")

    token = credentials.credentials
    try:
        signing_key = _jwk_client(cfg.jwks_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=SIGNING_ALGORITHMS,
            audience="authenticated",
            issuer=cfg.jwt_issuer,
            options={"require": ["exp", "iss", "sub"]},
        )
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(status_code=503, detail="Auth keys unavailable")
    except jwt.PyJWTError:
        raise _unauthorized("Invalid or expired token")

    return claims["sub"]
