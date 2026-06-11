import uuid as uuid_lib

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from db import get_db

router = APIRouter()


# ---------- schemas ----------

class ListOut(BaseModel):
    uuid: str


class ItemIn(BaseModel):
    name: str


class ItemOut(BaseModel):
    id: int
    list_uuid: str
    name: str
    checked: bool
    created_at: str


class ListDetail(BaseModel):
    uuid: str
    items: list[ItemOut]


class HistoryOut(BaseModel):
    names: list[str]


# ---------- helpers ----------

async def _require_list(uuid: str, db: aiosqlite.Connection) -> None:
    async with db.execute("SELECT 1 FROM lists WHERE uuid = ?", (uuid,)) as cur:
        if await cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="List not found")


def _row_to_item(row: aiosqlite.Row) -> ItemOut:
    return ItemOut(
        id=row["id"],
        list_uuid=row["list_uuid"],
        name=row["name"],
        checked=bool(row["checked"]),
        created_at=row["created_at"],
    )


# ---------- endpoints ----------

@router.post("", status_code=status.HTTP_201_CREATED, response_model=ListOut)
async def create_list(db: aiosqlite.Connection = Depends(get_db)):
    new_uuid = str(uuid_lib.uuid4())
    await db.execute("INSERT INTO lists (uuid) VALUES (?)", (new_uuid,))
    await db.commit()
    await db.close()
    return ListOut(uuid=new_uuid)


@router.get("/{uuid}", response_model=ListDetail)
async def get_list(uuid: str, db: aiosqlite.Connection = Depends(get_db)):
    await _require_list(uuid, db)
    async with db.execute(
        "SELECT id, list_uuid, name, checked, created_at FROM items WHERE list_uuid = ? ORDER BY id",
        (uuid,),
    ) as cur:
        rows = await cur.fetchall()
    await db.close()
    return ListDetail(uuid=uuid, items=[_row_to_item(r) for r in rows])


@router.post("/{uuid}/items", status_code=status.HTTP_201_CREATED, response_model=ItemOut)
async def add_item(uuid: str, body: ItemIn, db: aiosqlite.Connection = Depends(get_db)):
    await _require_list(uuid, db)
    async with db.execute(
        "INSERT INTO items (list_uuid, name) VALUES (?, ?) RETURNING id, list_uuid, name, checked, created_at",
        (uuid, body.name.strip()),
    ) as cur:
        row = await cur.fetchone()
    await db.commit()
    await db.close()
    return _row_to_item(row)


@router.patch("/{uuid}/items/{item_id}", response_model=ItemOut)
async def toggle_item(uuid: str, item_id: int, db: aiosqlite.Connection = Depends(get_db)):
    await _require_list(uuid, db)
    async with db.execute(
        "UPDATE items SET checked = NOT checked WHERE id = ? AND list_uuid = ? RETURNING id, list_uuid, name, checked, created_at",
        (item_id, uuid),
    ) as cur:
        row = await cur.fetchone()
    if row is None:
        await db.close()
        raise HTTPException(status_code=404, detail="Item not found")
    await db.commit()
    await db.close()
    return _row_to_item(row)


@router.delete("/{uuid}/items/checked", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checked(uuid: str, db: aiosqlite.Connection = Depends(get_db)):
    await _require_list(uuid, db)
    await db.execute(
        "DELETE FROM items WHERE list_uuid = ? AND checked = 1", (uuid,)
    )
    await db.commit()
    await db.close()


@router.get("/{uuid}/history", response_model=HistoryOut)
async def get_history(uuid: str, db: aiosqlite.Connection = Depends(get_db)):
    await _require_list(uuid, db)
    async with db.execute(
        "SELECT DISTINCT name FROM items WHERE list_uuid = ? ORDER BY name COLLATE NOCASE",
        (uuid,),
    ) as cur:
        rows = await cur.fetchall()
    await db.close()
    return HistoryOut(names=[r["name"] for r in rows])
