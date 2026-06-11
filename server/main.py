from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db

# Grocery-list router wired in ticket #3
# from features.grocery_list.api.router import router as grocery_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Shared Grocery List API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten when moving to VPS (AgDR-0002)
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.include_router(grocery_router, prefix="/lists")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
