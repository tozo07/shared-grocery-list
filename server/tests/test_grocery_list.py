"""
Integration tests for the grocery-list API endpoints.

Uses an in-memory SQLite database so no Docker / disk I/O is needed.
The `get_db` dependency is overridden for every test to hand each test
its own isolated connection, keeping tests fully independent.
"""

import pytest
import pytest_asyncio
import aiosqlite
from httpx import ASGITransport, AsyncClient

import sys
from pathlib import Path

# Make `server/` and the repo root (for `features/`) importable.
_server = Path(__file__).parent.parent
_repo_root = _server.parent
sys.path.insert(0, str(_server))
sys.path.insert(0, str(_repo_root))

from main import app
from db import get_db


# ---------- fixtures ----------

async def _make_test_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(":memory:")
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("""
        CREATE TABLE lists (
            uuid       TEXT PRIMARY KEY,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    await db.execute("""
        CREATE TABLE items (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            list_uuid  TEXT NOT NULL REFERENCES lists(uuid) ON DELETE CASCADE,
            name       TEXT NOT NULL,
            checked    INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    await db.execute("CREATE INDEX idx_items_list ON items(list_uuid)")
    await db.commit()
    return db


@pytest_asyncio.fixture
async def client():
    db = await _make_test_db()

    async def override_get_db():
        try:
            yield db
        finally:
            pass  # keep the connection alive for the test; closed below

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    await db.close()


# ---------- helpers ----------

async def _create_list(client: AsyncClient) -> str:
    r = await client.post("/lists")
    assert r.status_code == 201
    return r.json()["uuid"]


# ---------- POST /lists ----------

@pytest.mark.asyncio
async def test_create_list_returns_uuid(client):
    r = await client.post("/lists")
    assert r.status_code == 201
    body = r.json()
    assert "uuid" in body
    assert len(body["uuid"]) == 36  # UUID4 canonical length


@pytest.mark.asyncio
async def test_create_list_each_call_gives_unique_uuid(client):
    r1 = await client.post("/lists")
    r2 = await client.post("/lists")
    assert r1.json()["uuid"] != r2.json()["uuid"]


# ---------- GET /lists/{uuid} ----------

@pytest.mark.asyncio
async def test_get_list_empty(client):
    uuid = await _create_list(client)
    r = await client.get(f"/lists/{uuid}")
    assert r.status_code == 200
    assert r.json() == {"uuid": uuid, "items": []}


@pytest.mark.asyncio
async def test_get_list_unknown_returns_404(client):
    r = await client.get("/lists/does-not-exist")
    assert r.status_code == 404


# ---------- POST /lists/{uuid}/items ----------

@pytest.mark.asyncio
async def test_add_item_returns_created_item(client):
    uuid = await _create_list(client)
    r = await client.post(f"/lists/{uuid}/items", json={"name": "Milk"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Milk"
    assert body["checked"] is False
    assert body["list_uuid"] == uuid


@pytest.mark.asyncio
async def test_add_item_strips_whitespace(client):
    uuid = await _create_list(client)
    r = await client.post(f"/lists/{uuid}/items", json={"name": "  Eggs  "})
    assert r.status_code == 201
    assert r.json()["name"] == "Eggs"


@pytest.mark.asyncio
async def test_add_item_unknown_list_returns_404(client):
    r = await client.post("/lists/no-such-list/items", json={"name": "Milk"})
    assert r.status_code == 404


# ---------- PATCH /lists/{uuid}/items/{id} ----------

@pytest.mark.asyncio
async def test_toggle_item_checks_and_unchecks(client):
    uuid = await _create_list(client)
    item = (await client.post(f"/lists/{uuid}/items", json={"name": "Bread"})).json()
    item_id = item["id"]

    r = await client.patch(f"/lists/{uuid}/items/{item_id}")
    assert r.status_code == 200
    assert r.json()["checked"] is True

    r2 = await client.patch(f"/lists/{uuid}/items/{item_id}")
    assert r2.status_code == 200
    assert r2.json()["checked"] is False


@pytest.mark.asyncio
async def test_toggle_item_unknown_list_returns_404(client):
    r = await client.patch("/lists/no-such-list/items/1")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_toggle_item_unknown_item_returns_404(client):
    uuid = await _create_list(client)
    r = await client.patch(f"/lists/{uuid}/items/9999")
    assert r.status_code == 404


# ---------- DELETE /lists/{uuid}/items/checked ----------

@pytest.mark.asyncio
async def test_delete_checked_removes_only_checked(client):
    uuid = await _create_list(client)
    milk = (await client.post(f"/lists/{uuid}/items", json={"name": "Milk"})).json()
    eggs = (await client.post(f"/lists/{uuid}/items", json={"name": "Eggs"})).json()

    # Check Milk
    await client.patch(f"/lists/{uuid}/items/{milk['id']}")

    r = await client.delete(f"/lists/{uuid}/items/checked")
    assert r.status_code == 204

    remaining = (await client.get(f"/lists/{uuid}")).json()["items"]
    assert len(remaining) == 1
    assert remaining[0]["name"] == "Eggs"


@pytest.mark.asyncio
async def test_delete_checked_unknown_list_returns_404(client):
    r = await client.delete("/lists/no-such-list/items/checked")
    assert r.status_code == 404


# ---------- GET /lists/{uuid}/history ----------

@pytest.mark.asyncio
async def test_history_returns_distinct_names(client):
    uuid = await _create_list(client)
    for name in ["Milk", "Eggs", "Milk"]:
        await client.post(f"/lists/{uuid}/items", json={"name": name})

    r = await client.get(f"/lists/{uuid}/history")
    assert r.status_code == 200
    assert sorted(r.json()["names"]) == ["Eggs", "Milk"]


@pytest.mark.asyncio
async def test_history_unknown_list_returns_404(client):
    r = await client.get("/lists/no-such-list/history")
    assert r.status_code == 404
