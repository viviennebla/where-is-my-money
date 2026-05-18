from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine, Base
from app.routers import auth, accounts, tags, tag_rules, transactions, import_pipeline, settings, tasks
import app.models  # noqa: F401 — ensure all models are registered on Base.metadata


async def _migrate():
    """Add missing columns for SQLite (create_all doesn't alter existing tables)."""
    migrations = [
        "ALTER TABLE accounts ADD COLUMN alias VARCHAR(100)",
        "ALTER TABLE accounts ADD COLUMN card_number VARCHAR(50)",
        "ALTER TABLE import_templates ADD COLUMN is_preset BOOLEAN DEFAULT 0",
    ]
    async with engine.begin() as conn:
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass  # Column already exists


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # Fix import_templates.user_id: SQLite can't ALTER COLUMN, must recreate table
        result = await conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='import_templates'"
        ))
        if result.scalar():
            pragma = await conn.execute(text("PRAGMA table_info(import_templates)"))
            for row in pragma:
                if row[1] == 'user_id' and row[3] == 1:  # notnull=1
                    await conn.execute(text("DROP TABLE import_templates"))
                    break
        await conn.run_sync(Base.metadata.create_all)
    await _migrate()
    yield


app = FastAPI(title="WIMM API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(tags.router)
app.include_router(tag_rules.router)
app.include_router(transactions.router)
app.include_router(import_pipeline.router)
app.include_router(settings.router)
app.include_router(tasks.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
