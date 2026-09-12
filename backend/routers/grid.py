"""
GET /api/grid/{feeder_id}/status — Grid constraint status for a feeder.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.grid_state import GridState
from models.user import UserRole
from schemas import GridStateResponse, InterOperatorHandshakeResponse, InterOperatorHandshakeRequest
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


@router.post("/inter-operator/handshake", response_model=InterOperatorHandshakeResponse)
async def trigger_inter_operator_handshake(
    req: InterOperatorHandshakeRequest,
    current_user=Depends(require_roles(
        UserRole.prosumer, UserRole.consumer, UserRole.discom_operator, UserRole.regulator
    )),
):
    """
    Execute inter-operator communication handshake when buyer and seller
    are on different feeders/operators, or verify local operator mediation.
    """
    from services.inter_operator_service import perform_inter_operator_handshake
    result = await perform_inter_operator_handshake(
        buyer_feeder_id=req.buyer_feeder_id,
        seller_feeder_id=req.seller_feeder_id,
        quantity_kwh=req.quantity_kwh,
        buyer_max_price=req.buyer_max_price or 5.0,
        seller_min_price=req.seller_min_price or 4.0,
    )
    return result


@router.get("/operators")
async def list_grid_operators():
    """List all registered substation grid operators and interconnecting tie-lines."""
    from services.inter_operator_service import GRID_OPERATORS, TIE_LINES
    tie_lines_list = [
        {"from_feeder": k[0], "to_feeder": k[1], **v}
        for k, v in TIE_LINES.items()
    ]
    return {
        "operators": list(GRID_OPERATORS.values()),
        "tie_lines": tie_lines_list,
    }


@router.get("/locations")
async def list_participant_locations(
    buyer_feeder: str = "FEEDER-02",
    seller_feeder: str = "FEEDER-01",
):
    """Get physical geographic & electrical grid location metadata for buyer and seller."""
    from services.inter_operator_service import get_participant_location, calculate_grid_distance, GRID_OPERATORS
    return {
        "buyer_location": get_participant_location("demo_consumer_01", buyer_feeder),
        "seller_location": get_participant_location("demo_prosumer_01", seller_feeder),
        "mediating_operator": GRID_OPERATORS.get(buyer_feeder, GRID_OPERATORS["FEEDER-01"]),
        "distance_info": calculate_grid_distance(buyer_feeder, seller_feeder),
    }

