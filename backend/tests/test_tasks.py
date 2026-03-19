import pytest
from httpx import AsyncClient


async def _auth_headers(client: AsyncClient, suffix: str) -> dict:
    """Register a user and return auth headers."""
    await client.post("/api/auth/register", json={
        "username": f"task_user_{suffix}",
        "email": f"task_{suffix}@example.com",
        "password": "password123",
    })
    login = await client.post("/api/auth/login", json={
        "email": f"task_{suffix}@example.com",
        "password": "password123",
    })
    token = login.json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}


# ─── CRUD ─────────────────────────────────────────────────────────────────────

async def test_create_task(client: AsyncClient):
    headers = await _auth_headers(client, "create1")
    resp = await client.post("/api/tasks", json={"name": "Work", "color": "#FFD700"}, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["name"] == "Work"
    assert data["data"]["is_active"] is False
    assert data["data"]["total_time"] == 0


async def test_list_tasks(client: AsyncClient):
    headers = await _auth_headers(client, "list1")
    await client.post("/api/tasks", json={"name": "T1", "color": "#FF0000"}, headers=headers)
    await client.post("/api/tasks", json={"name": "T2", "color": "#00FF00"}, headers=headers)
    resp = await client.get("/api/tasks", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2


async def test_update_task(client: AsyncClient):
    headers = await _auth_headers(client, "update1")
    create = await client.post("/api/tasks", json={"name": "Old", "color": "#111111"}, headers=headers)
    task_id = create.json()["data"]["id"]

    resp = await client.put(f"/api/tasks/{task_id}", json={"name": "New"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["name"] == "New"


async def test_delete_task(client: AsyncClient):
    headers = await _auth_headers(client, "del1")
    create = await client.post("/api/tasks", json={"name": "Delete me", "color": "#FF00FF"}, headers=headers)
    task_id = create.json()["data"]["id"]

    resp = await client.delete(f"/api/tasks/{task_id}", headers=headers)
    assert resp.status_code == 200

    # Should not appear in list anymore
    tasks = await client.get("/api/tasks", headers=headers)
    task_ids = [t["id"] for t in tasks.json()["data"]]
    assert task_id not in task_ids


async def test_update_other_user_task_forbidden(client: AsyncClient):
    h1 = await _auth_headers(client, "own1")
    h2 = await _auth_headers(client, "own2")

    create = await client.post("/api/tasks", json={"name": "Mine", "color": "#AABBCC"}, headers=h1)
    task_id = create.json()["data"]["id"]

    resp = await client.put(f"/api/tasks/{task_id}", json={"name": "Stolen"}, headers=h2)
    assert resp.status_code in (403, 404)


# ─── Timer ────────────────────────────────────────────────────────────────────

async def test_start_stop_timer(client: AsyncClient):
    headers = await _auth_headers(client, "timer1")
    create = await client.post("/api/tasks", json={"name": "Timed", "color": "#00FFFF"}, headers=headers)
    task_id = create.json()["data"]["id"]

    # Start
    start = await client.post(f"/api/tasks/{task_id}/start", headers=headers)
    assert start.status_code == 200
    assert start.json()["data"]["is_active"] is True

    # Stop
    import asyncio
    await asyncio.sleep(0.05)  # tiny wait so elapsed > 0
    stop = await client.post(f"/api/tasks/{task_id}/stop", headers=headers)
    assert stop.status_code == 200
    stop_data = stop.json()["data"]
    assert stop_data["is_active"] is False
    assert stop_data["total_time"] >= 0
    assert len(stop_data["history"]) >= 1


async def test_starting_new_task_stops_previous(client: AsyncClient):
    headers = await _auth_headers(client, "auto_stop1")
    t1 = (await client.post("/api/tasks", json={"name": "Task A", "color": "#111"}, headers=headers)).json()["data"]["id"]
    t2 = (await client.post("/api/tasks", json={"name": "Task B", "color": "#222"}, headers=headers)).json()["data"]["id"]

    await client.post(f"/api/tasks/{t1}/start", headers=headers)
    await client.post(f"/api/tasks/{t2}/start", headers=headers)

    tasks = (await client.get("/api/tasks", headers=headers)).json()["data"]
    task_map = {t["id"]: t for t in tasks}
    assert task_map[t1]["is_active"] is False
    assert task_map[t2]["is_active"] is True


async def test_stop_inactive_timer_returns_error(client: AsyncClient):
    headers = await _auth_headers(client, "stop_err1")
    create = await client.post("/api/tasks", json={"name": "Never started", "color": "#333"}, headers=headers)
    task_id = create.json()["data"]["id"]

    resp = await client.post(f"/api/tasks/{task_id}/stop", headers=headers)
    assert resp.status_code == 400


# ─── Stats ────────────────────────────────────────────────────────────────────

async def test_get_stats(client: AsyncClient):
    headers = await _auth_headers(client, "stats1")
    await client.post("/api/tasks", json={"name": "StatsTask", "color": "#F0F0F0"}, headers=headers)

    resp = await client.get("/api/tasks/stats", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "total_time" in data
    assert "tasks_count" in data
    assert "daily_stats" in data
