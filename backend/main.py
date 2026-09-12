"""
GRIDMIND — FastAPI application entry point.

Startup sequence:
  1. Connect to DB (PostgreSQL in production, SQLite in DEV_MODE)
  2. Connect to Redis (real Redis in production, fakeredis in DEV_MODE)
  3. Register all routers
  4. Start the matching engine background loop

Authentication endpoint (POST /auth/token) issues mock JWTs for demo.
"""

import os
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, text

from config import settings
from database import engine, get_db, Base
from redis_client import get_redis, close_redis
from models.user import User, UserRole
from schemas import Token
from auth import create_access_token

# Import all models so SQLAlchemy knows them for create_all
import models  # noqa: F401

# Import routers
from routers import meters, market, orders, grid, trades, dashboard, websocket, agent, forecast

DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    mode = "DEV (SQLite + fakeredis)" if DEV_MODE else "PRODUCTION (PostgreSQL + Redis)"
    print(f"🔋 GRIDMIND starting up [{mode}]...")

    # In DEV_MODE: create all tables automatically (no alembic needed)
    if DEV_MODE:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ SQLite tables created (DEV_MODE)")

    # Ensure Redis connection is alive
    r = await get_redis()
    try:
        await r.ping()
    except Exception:
        pass  # fakeredis ping behaves differently; connection is fine
    print("✅ Redis connected")

    # Start matching engine background loop
    import asyncio
    from services.matching_engine import matching_loop
    loop_task = asyncio.create_task(matching_loop())
    print("✅ Matching engine loop started")

    yield

    # Shutdown
    print("🔋 GRIDMIND shutting down...")
    loop_task.cancel()
    await close_redis()
    await engine.dispose()
    print("✅ Cleanup complete")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="GRIDMIND API",
    description=(
        "Simulation-first Renewable Energy P2P Trading Marketplace. "
        "Digital market and settlement layer — not physical grid control."
    ),
    version="1.0.0-mvp",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend and any local dev origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ──────────────────────────────────────────────────────────
app.include_router(meters.router)
app.include_router(market.router)
app.include_router(orders.router)
app.include_router(grid.router)
app.include_router(trades.router)
app.include_router(dashboard.router)
app.include_router(websocket.router)
app.include_router(agent.router)
app.include_router(forecast.router)


# ── Auth endpoints ─────────────────────────────────────────────────────────────
@app.post("/auth/token", response_model=Token, tags=["Auth"])
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db=Depends(get_db),
):
    """
    Issue a mock JWT. For the MVP demo, any username/password pair that
    matches a seeded user is accepted.
    In production: replace with real bcrypt password verification.
    """
    result = await db.execute(
        select(User).where(User.username == form_data.username)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Demo mode: accept password "demo" for all seeded users
    # Production: use bcrypt verify_password
    if form_data.password not in ("demo", user.hashed_password):
        # Allow "demo" as master password for hackathon demo convenience
        from auth import verify_password
        if not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )


    token = create_access_token(
        data={
            "sub": str(user.user_id),
            "role": user.role.value,
            "feeder_id": user.feeder_id,
            "meter_id": user.meter_id,
        },
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return Token(
        access_token=token,
        role=user.role,
        user_id=user.user_id,
        feeder_id=user.feeder_id,
    )


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    """Liveness probe — returns OK if the app is running."""
    r = await get_redis()
    redis_ok = await r.ping()
    return {
        "status": "ok",
        "redis": "ok" if redis_ok else "error",
        "version": "1.0.0-mvp",
    }


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": "GRIDMIND",
        "tagline": "Grid-aware P2P renewable energy marketplace",
        "docs": "/docs",
        "health": "/health",
    }
