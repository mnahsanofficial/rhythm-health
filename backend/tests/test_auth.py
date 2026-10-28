import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.auth import supabase as auth
from app.config import Settings
from app.main import app

ISSUER = "https://test.supabase.co/auth/v1"
USER_ID = "11111111-1111-1111-1111-111111111111"

key = ec.generate_private_key(ec.SECP256R1())
other_key = ec.generate_private_key(ec.SECP256R1())


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    app.dependency_overrides[auth.get_settings] = lambda: Settings(
        supabase_url="https://test.supabase.co"
    )
    fake = SimpleNamespace(
        get_signing_key_from_jwt=lambda _t: SimpleNamespace(key=key.public_key())
    )
    monkeypatch.setattr(auth, "_jwk_client", lambda _url: fake)
    yield
    app.dependency_overrides.clear()


client = TestClient(app)


def make_token(signing_key=key, **overrides):
    claims = {
        "sub": USER_ID,
        "iss": ISSUER,
        "aud": "authenticated",
        "exp": int(time.time()) + 300,
    }
    claims.update(overrides)
    return jwt.encode(claims, signing_key, algorithm="ES256")


def get_me(token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.get("/api/me", headers=headers)


def test_valid_token_returns_user_id():
    res = get_me(make_token())
    assert res.status_code == 200
    assert res.json() == {"user_id": USER_ID}


def test_missing_token_is_401():
    assert get_me().status_code == 401


def test_expired_token_is_401():
    assert get_me(make_token(exp=int(time.time()) - 10)).status_code == 401


def test_wrong_issuer_is_401():
    assert get_me(make_token(iss="https://evil.example/auth/v1")).status_code == 401


def test_wrong_audience_is_401():
    assert get_me(make_token(aud="anon")).status_code == 401


def test_bad_signature_is_401():
    assert get_me(make_token(signing_key=other_key)).status_code == 401


def test_garbage_token_is_401():
    assert get_me("not-a-jwt").status_code == 401
