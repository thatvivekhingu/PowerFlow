"""
Smart Meter Simulator — generates 15-minute interval readings.

Runs as a standalone service (docker-compose simulator service).
Each "tick" corresponds to one 15-minute interval (wall-clock time
compressed by SIMULATOR_SPEED_MULTIPLIER).

At each tick:
  1. Generate generation + consumption for each simulated household
  2. Compute feeder aggregate load
  3. Update GridState in DB
  4. POST meter readings to the backend API (which validates + persists)
  5. Emit price update via the pricing engine
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone, timedelta

import httpx
import numpy as np

# Make sure the parent directory is on the path when run as a module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings
from database import db_session
from models.user import User, UserRole
from models.grid_state import GridState
from services.grid_engine import update_grid_state
from services.pricing_engine import compute_price
from redis_client import get_redis, price_cache_key
from simulator.profiles import (
    generate_household_profiles,
    solar_generation_curve,
    load_consumption_curve,
    feeder_aggregate_load_kw,
    FEEDER_TRANSFORMER_CONFIG,
    HouseholdProfile,
)
from auth import create_access_token


# ── Service token (simulator acts as a discom_operator service account) ────────
SIMULATOR_TOKEN: str | None = None
SIMULATOR_METER_TO_USER: dict[str, str] = {}  # meter_id -> user_id


async def _get_or_create_simulator_token(db) -> str:
    """Get or create a service account token for the simulator."""
    global SIMULATOR_TOKEN
    if SIMULATOR_TOKEN:
        return SIMULATOR_TOKEN

    from sqlalchemy import select
    result = await db.execute(
        select(User).where(User.username == "simulator_service")
    )
    svc = result.scalar_one_or_none()

    if svc is None:
        # Create a service account user for the simulator
        import uuid
        from passlib.context import CryptContext
        pwd_ctx = CryptContext(schemes=["bcrypt"])
        svc = User(
            username="simulator_service",
            hashed_password=pwd_ctx.hash("simulator_secret"),
            role=UserRole.discom_operator,
            meter_id="METER-SVC-0000",
            feeder_id="FEEDER-01",
            wallet_id="wallet_simulator",
        )
        db.add(svc)
        await db.flush()
        await db.refresh(svc)

    SIMULATOR_TOKEN = create_access_token({
        "sub": str(svc.user_id),
        "role": svc.role.value,
        "feeder_id": svc.feeder_id,
        "meter_id": svc.meter_id,
    })
    return SIMULATOR_TOKEN


async def _ensure_users_exist(profiles: list[HouseholdProfile]) -> None:
    """
    Ensure each simulated household has a corresponding User row in the DB.
    Idempotent — safe to call multiple times.
    """
    global SIMULATOR_METER_TO_USER
    from sqlalchemy import select
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"])
    hashed_demo_pw = pwd_ctx.hash("demo")

    async with db_session() as db:
        for p in profiles:
            result = await db.execute(select(User).where(User.meter_id == p.meter_id))
            user = result.scalar_one_or_none()
            if user is None:
                role = UserRole.prosumer if p.role == "prosumer" else UserRole.consumer
                user = User(
                    username=f"user_{p.meter_id.lower()}",
                    hashed_password=hashed_demo_pw,
                    role=role,
                    meter_id=p.meter_id,
                    feeder_id=p.feeder_id,
                )
                db.add(user)
                await db.flush()
                await db.refresh(user)
                print(f"  ➕ Created {role.value} user: {user.username} ({p.meter_id})")
            SIMULATOR_METER_TO_USER[p.meter_id] = str(user.user_id)


async def _post_reading(
    client: httpx.AsyncClient,
    token: str,
    meter_id: str,
    feeder_id: str,
    timestamp: datetime,
    generation_kwh: float,
    consumption_kwh: float,
    export_kwh: float,
) -> bool:
    """POST a meter reading to the backend API."""
    try:
        resp = await client.post(
            f"{settings.backend_url}/api/meters/readings",
            json={
                "meter_id": meter_id,
                "feeder_id": feeder_id,
                "timestamp": timestamp.isoformat(),
                "generation_kwh": generation_kwh,
                "consumption_kwh": consumption_kwh,
                "export_kwh": export_kwh,
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        return resp.status_code == 201
    except Exception as e:
        print(f"⚠️  Failed to POST reading for {meter_id}: {e}")
        return False


async def run_simulation_tick(
    profiles: list[HouseholdProfile],
    sim_time: datetime,
    client: httpx.AsyncClient,
    token: str,
    cloud_factor: float = 1.0,
) -> None:
    """
    Run one 15-minute simulation tick:
      1. Generate readings for all households
      2. Update GridState per feeder
      3. POST readings to API
      4. Update price cache
    """
    hour = sim_time.hour + sim_time.minute / 60.0
    day_type = "weekend" if sim_time.weekday() >= 5 else "weekday"

    rng = np.random.default_rng(int(sim_time.timestamp()))

    # Group profiles by feeder
    feeders: dict[str, list[HouseholdProfile]] = {}
    for p in profiles:
        feeders.setdefault(p.feeder_id, []).append(p)

    readings_posted = 0
    feeder_loads: dict[str, float] = {}

    for feeder_id, feeder_profiles in feeders.items():
        feeder_total_load_kw = 0.0

        for p in feeder_profiles:
            gen = solar_generation_curve(hour, p.solar_capacity_kw, cloud_factor)
            con = load_consumption_curve(hour, p.base_load_kw, day_type, p.seed + int(sim_time.timestamp()) % 1000)
            # Add small per-tick noise
            con = round(con * float(rng.uniform(0.92, 1.08)), 4)
            export = round(max(0.0, gen - con), 4)

            ok = await _post_reading(
                client, token,
                meter_id=p.meter_id,
                feeder_id=feeder_id,
                timestamp=sim_time,
                generation_kwh=gen,
                consumption_kwh=con,
                export_kwh=export,
            )
            if ok:
                readings_posted += 1
            feeder_total_load_kw += con * 4.0  # kWh to kW

        feeder_loads[feeder_id] = feeder_total_load_kw

    # Update GridState for each feeder
    async with db_session() as db:
        token_svc = await _get_or_create_simulator_token(db)
        for feeder_id, load_kw in feeder_loads.items():
            cfg = FEEDER_TRANSFORMER_CONFIG.get(feeder_id, {"transformer_id": feeder_id, "capacity_kw": 100.0})
            state = await update_grid_state(
                feeder_id=feeder_id,
                transformer_id=cfg["transformer_id"],
                load_kw=load_kw,
                capacity_kw=cfg["capacity_kw"],
                db=db,
            )

    # Update price cache in Redis
    async with db_session() as db:
        redis = await get_redis()
        for feeder_id in feeder_loads:
            try:
                price_result = await compute_price(feeder_id, db)
                await redis.setex(price_cache_key(feeder_id), 60, price_result.model_dump_json())

                # Broadcast to WebSocket clients
                from routers.websocket import emit_price_update
                await emit_price_update(feeder_id, price_result.price)
            except Exception as e:
                print(f"⚠️  Price cache error for {feeder_id}: {e}")

    print(
        f"⚡ Tick {sim_time.strftime('%H:%M')} | "
        f"{readings_posted}/{len(profiles)} readings | "
        f"loads: {', '.join(f'{fid}={kw:.1f}kW' for fid, kw in feeder_loads.items())}"
    )


async def main() -> None:
    """
    Main simulator loop.
    Generates readings for configured households at the configured speed.
    """
    profiles = generate_household_profiles(
        n_households=settings.simulator_households,
        n_feeders=settings.simulator_feeders,
    )
    print(f"🏘️  GRIDMIND Simulator starting: {len(profiles)} households, {settings.simulator_feeders} feeders")
    print(f"⚡ Speed multiplier: {settings.simulator_speed_multiplier}× (15-min interval = {900 // settings.simulator_speed_multiplier}s wall-clock)")

    # Ensure all household users exist in DB
    print("👥 Seeding household users...")
    await _ensure_users_exist(profiles)

    # Get service token
    async with db_session() as db:
        token = await _get_or_create_simulator_token(db)

    # Wait for backend to be ready
    backend_ready = False
    async with httpx.AsyncClient() as client:
        for attempt in range(30):
            try:
                r = await client.get(f"{settings.backend_url}/health", timeout=5.0)
                if r.status_code == 200:
                    backend_ready = True
                    print("✅ Backend is ready")
                    break
            except Exception:
                pass
            print(f"⏳ Waiting for backend... ({attempt + 1}/30)")
            await asyncio.sleep(3)

    if not backend_ready:
        print("❌ Backend did not become ready. Exiting.")
        return

    # Start simulation from current real time (or configurable start time)
    sim_time = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    # Round down to nearest 15-min boundary
    sim_time = sim_time - timedelta(minutes=sim_time.minute % 15)

    tick_interval_seconds = 900 // settings.simulator_speed_multiplier  # real seconds per sim 15-min

    print(f"🕐 Simulation starts at: {sim_time.isoformat()}")
    print(f"🕐 One sim-tick every {tick_interval_seconds}s wall-clock time")

    async with httpx.AsyncClient() as client:
        while True:
            try:
                # Vary cloud factor throughout the day for realism
                hour = sim_time.hour
                if 6 <= hour <= 18:
                    cloud_factor = float(np.random.default_rng(int(sim_time.timestamp())).uniform(0.7, 1.0))
                else:
                    cloud_factor = 0.0  # no solar at night

                await run_simulation_tick(profiles, sim_time, client, token, cloud_factor)
                sim_time += timedelta(minutes=15)

            except asyncio.CancelledError:
                print("⏹️  Simulator stopped.")
                break
            except Exception as e:
                print(f"⚠️  Simulator tick error: {e}")

            await asyncio.sleep(tick_interval_seconds)


if __name__ == "__main__":
    asyncio.run(main())
