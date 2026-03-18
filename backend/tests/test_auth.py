import pytest
from httpx import AsyncClient


# ─── Register ─────────────────────────────────────────────────────────────────

async def test_register_success(client: AsyncClient):
    resp = await client.post("/api/auth/register", json={
        "username": "alice",
        "email": "alice@example.com",
        "password": "secret123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "token" in data["data"]
    assert data["data"]["user"]["email"] == "alice@example.com"


async def test_register_duplicate_email(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "username": "bob",
        "email": "dup@example.com",
        "password": "secret123",
    })
    resp = await client.post("/api/auth/register", json={
        "username": "bob2",
        "email": "dup@example.com",
        "password": "secret123",
    })
    assert resp.status_code == 400


async def test_register_short_password(client: AsyncClient):
    resp = await client.post("/api/auth/register", json={
        "username": "charlie",
        "email": "charlie@example.com",
        "password": "12",
    })
    assert resp.status_code == 400


# ─── Login ────────────────────────────────────────────────────────────────────

async def _register_user(client, suffix="x"):
    await client.post("/api/auth/register", json={
        "username": f"user_{suffix}",
        "email": f"user_{suffix}@example.com",
        "password": "password123",
    })


async def test_login_success(client: AsyncClient):
    await _register_user(client, "login1")
    resp = await client.post("/api/auth/login", json={
        "email": "user_login1@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "token" in data["data"]
    assert "refresh_token" in data["data"]


async def test_login_wrong_password(client: AsyncClient):
    await _register_user(client, "login2")
    resp = await client.post("/api/auth/login", json={
        "email": "user_login2@example.com",
        "password": "wrongpass",
    })
    assert resp.status_code == 401


async def test_login_unknown_email(client: AsyncClient):
    resp = await client.post("/api/auth/login", json={
        "email": "nobody@example.com",
        "password": "password123",
    })
    assert resp.status_code == 401


# ─── Verify ───────────────────────────────────────────────────────────────────

async def test_verify_valid_token(client: AsyncClient):
    await _register_user(client, "verify1")
    login = await client.post("/api/auth/login", json={
        "email": "user_verify1@example.com",
        "password": "password123",
    })
    token = login.json()["data"]["token"]
    resp = await client.get("/api/auth/verify", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_verify_invalid_token(client: AsyncClient):
    resp = await client.get("/api/auth/verify", headers={"Authorization": "Bearer bad.token.here"})
    assert resp.status_code == 401


# ─── Logout ───────────────────────────────────────────────────────────────────

async def test_logout_blacklists_token(client: AsyncClient):
    await _register_user(client, "logout1")
    login = await client.post("/api/auth/login", json={
        "email": "user_logout1@example.com",
        "password": "password123",
    })
    token = login.json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}

    logout_resp = await client.post("/api/auth/logout", headers=headers)
    assert logout_resp.status_code == 200

    # Token should now be blacklisted
    verify_resp = await client.get("/api/auth/verify", headers=headers)
    assert verify_resp.status_code == 401


# ─── Refresh ──────────────────────────────────────────────────────────────────

async def test_refresh_token(client: AsyncClient):
    await _register_user(client, "refresh1")
    login = await client.post("/api/auth/login", json={
        "email": "user_refresh1@example.com",
        "password": "password123",
    })
    refresh_token = login.json()["data"]["refresh_token"]

    resp = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "token" in data
    assert "refresh_token" in data
    # Old refresh token should be revoked
    resp2 = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp2.status_code == 401
