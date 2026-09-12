"""
POST /api/meters/readings — Submit simulated meter telemetry.

Validates incoming readings before persisting:
  - Non-negative generation/consumption/export
  - Physical plausibility bounds
  - export_kwh ≤ generation_kwh

Invalid readings are flagged (is_valid=False) but still persisted for audit.
After ingestion, triggers a price update and publishes to WebSocket.
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc

from database import get_db
from models.meter_reading import MeterReading
from schemas import MeterReadingCreate, MeterReadingResponse
from auth import get_current_user, require_roles
from models.user import UserRole, User

router = APIRouter(prefix="/api/meters", tags=["Meters"])


def _validate_reading(data: MeterReadingCreate) -> tuple[bool, str | None]:
    """
    Sanity-check a meter reading.
    Returns (is_valid, notes).
    """
    issues = []

    if data.generation_kwh < 0:
        issues.append("negative generation")
    if data.consumption_kwh < 0:
        issues.append("negative consumption")
    if data.export_kwh < 0:
        issues.append("negative export")
    if data.export_kwh > data.generation_kwh + 0.001:  # small float tolerance
        issues.append(f"export ({data.export_kwh}) exceeds generation ({data.generation_kwh})")
    if data.generation_kwh > 20.0:
        issues.append(f"generation {data.generation_kwh} kWh/interval exceeds 20 kWh physical max")
    if data.consumption_kwh > 10.0:
        issues.append(f"consumption {data.consumption_kwh} kWh/interval exceeds 10 kWh physical max")

    if issues:
        return False, "; ".join(issues)
    return True, None


@router.post("/readings", response_model=MeterReadingResponse, status_code=status.HTTP_201_CREATED)
async def submit_reading(
    data: MeterReadingCreate,
    db: AsyncSession = Depends(get_db),
    # Allow both prosumer role and the simulator service (discom_operator used as service account)
    current_user: User = Depends(require_roles(UserRole.prosumer, UserRole.discom_operator)),
):
    """Submit a 15-minute interval meter reading. Validates before persisting."""
    is_valid, notes = _validate_reading(data)

    surplus = max(0.0, data.generation_kwh - data.consumption_kwh)

    reading = MeterReading(
        meter_id=data.meter_id,
        feeder_id=data.feeder_id,
        timestamp=data.timestamp,
        generation_kwh=data.generation_kwh,
        consumption_kwh=data.consumption_kwh,
        export_kwh=data.export_kwh,
        surplus_kwh=round(surplus, 4),
        is_valid=is_valid,
        validation_notes=notes,
    )
    db.add(reading)
    await db.flush()
    await db.refresh(reading)
    return reading


@router.get("/readings/{meter_id}", response_model=List[MeterReadingResponse])
async def get_readings(
    meter_id: str,
    limit: int = 96,  # 96 × 15 min = 24 hours
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve recent readings for a specific meter (last 24 hours by default)."""
    result = await db.execute(
        select(MeterReading)
        .where(MeterReading.meter_id == meter_id)
        .order_by(MeterReading.timestamp.desc())
        .limit(limit)
    )
    return result.scalars().all()
