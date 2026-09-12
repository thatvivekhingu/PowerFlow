"""
GET /api/grid/{feeder_id}/status — Grid constraint status for a feeder.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.grid_state import GridState
from models.user import UserRole
from schemas import GridStateResponse
from auth import require_roles

router = APIRouter(prefix="/api/grid", tags=["Grid"])


@router.get("/{feeder_id}/status", response_model=GridStateResponse)
async def get_feeder_status(
    feeder_id: str,
    db: AsyncSession = Depends(get_db),
    # Any authenticated user can read grid status (consumers need it too)
    current_user=Depends(require_roles(
        UserRole.prosumer, UserRole.consumer, UserRole.discom_operator, UserRole.regulator
    )),
):
    """
    Return the latest grid state snapshot for the given feeder.
    Used by the DISCOM dashboard and the grid constraint engine.
    """
    result = await db.execute(
        select(GridState)
        .where(GridState.feeder_id == feeder_id)
        .order_by(GridState.recorded_at.desc())
        .limit(1)
    )
    state = result.scalar_one_or_none()
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No grid state found for feeder {feeder_id}",
        )
    return state


@router.get("", response_model=list[GridStateResponse])
async def list_feeders(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(UserRole.discom_operator, UserRole.regulator)),
):
    """List latest grid state for all feeders (DISCOM operator view)."""
    # Get latest snapshot per feeder using a subquery
    from sqlalchemy import func as sqlfunc
    subq = (
        select(
            GridState.feeder_id,
            sqlfunc.max(GridState.recorded_at).label("latest")
        )
        .group_by(GridState.feeder_id)
        .subquery()
    )
    result = await db.execute(
        select(GridState).join(
            subq,
            (GridState.feeder_id == subq.c.feeder_id) &
            (GridState.recorded_at == subq.c.latest)
        )
    )
    return result.scalars().all()
