import pytest
from httpx import AsyncClient


async def _register_and_login(client: AsyncClient, suffix: str) -> dict:
    await client.post("/api/auth/register", json={
        "username": f"prof_{suffix}",
        "email": f"prof_{suffix}@example.com",
        "password": "password123",
    })
    login = await client.post("/api/auth/login", json={
        "email": f"prof_{suffix}@example.com",
        "password": "password123",
    })
    token = login.json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


async def test_get_profile(client: AsyncClient):
    headers = await _register_and_login(client, "get1")
    resp = await client.get("/api/user/profile", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "username" in data
    assert "email" in data
    assert "tasks_count" in data
    assert "total_time_tracked" in data


async def test_update_profile_username(client: AsyncClient):
    headers = await _register_and_login(client, "upd1")
    resp = await client.put("/api/user/profile", json={"username": "prof_upd1_new"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["username"] == "prof_upd1_new"


async def test_change_password_success(client: AsyncClient):
    headers = await _register_and_login(client, "pwd1")
    resp = await client.put("/api/user/password", json={
        "current_password": "password123",
        "new_password": "newpassword456",
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_change_password_wrong_current(client: AsyncClient):
    headers = await _register_and_login(client, "pwd2")
    resp = await client.put("/api/user/password", json={
        "current_password": "wrongpassword",
        "new_password": "newpassword456",
    }, headers=headers)
    assert resp.status_code == 400


async def test_change_password_too_short(client: AsyncClient):
    headers = await _register_and_login(client, "pwd3")
    resp = await client.put("/api/user/password", json={
        "current_password": "password123",
        "new_password": "ab",
    }, headers=headers)
    assert resp.status_code == 400
