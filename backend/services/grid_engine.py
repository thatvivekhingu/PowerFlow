"""
Grid Constraint Engine — validates trades against transformer headroom.

Decision logic (section 6 of spec):
  headroom = transformer_capacity_kw - current_loading_kw

  requested_kw ≤ headroom  → TRADE_ALLOWED  (status: MATCHED)
  0 < headroom < requested → TRADE_LIMITED  (status: GRID_LIMITED, allowed_kwh < quantity_kwh)
  headroom ≤ 0             → TRADE_REJECTED (status: REJECTED)

Fallback rule: unmatched / grid-limited remainder is logged as UTILITY_EXPORT.
"""

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from models.trade import Trade, TradeStatus
from models.grid_state import GridState, CongestionLevel
from routers.websocket import emit_grid_alert


def _compute_congestion_band(load_factor: float) -> CongestionLevel:
    if load_factor < settings.congestion_threshold:
        return CongestionLevel.green
    elif load_factor < 0.9:
        return CongestionLevel.amber
    else:
        return CongestionLevel.red


async def get_feeder_headroom(feeder_id: str, db: AsyncSession) -> tuple[float, float, GridState | None]:
    """
    Returns (headroom_kw, capacity_kw, latest_grid_state).
    Uses default capacity if no GridState record exists.
    """
    result = await db.execute(
        select(GridState)
        .where(GridState.feeder_id == feeder_id)
        .order_by(GridState.recorded_at.desc())
        .limit(1)
    )
    state = result.scalar_one_or_none()
    if state is None:
        capacity = settings.default_transformer_capacity_kw
        headroom = capacity  # assume empty feeder
        return headroom, capacity, None

    headroom = state.capacity_kw - state.load_kw
    return headroom, state.capacity_kw, state


async def validate_trade(trade: Trade, db: AsyncSession) -> Trade:
    """
    Run headroom check for the given trade.
    Mutates trade.status and trade.allowed_kwh in-place.
    Also creates a UTILITY_EXPORT fallback trade for any rejected/limited surplus.
    """
    # Convert kWh quantity to kW (assuming 15-min interval = 0.25 h → ×4)
    requested_kw = trade.quantity_kwh * 4.0

    headroom_kw, capacity_kw, grid_state = await get_feeder_headroom(trade.feeder_id, db)

    if headroom_kw <= 0:
        # Grid full — reject trade entirely
        trade.status = TradeStatus.rejected
        trade.grid_notes = (
            f"TRADE_REJECTED: headroom={headroom_kw:.2f}kW ≤ 0 "
            f"(load={grid_state.load_kw if grid_state else '?'}kW / capacity={capacity_kw:.1f}kW)"
        )
        # Log surplus as UTILITY_EXPORT fallback
        await _create_utility_export(trade, trade.quantity_kwh, db)

    elif requested_kw <= headroom_kw:
        # Full quantity approved
        trade.status = TradeStatus.matched
        trade.allowed_kwh = trade.quantity_kwh
        trade.grid_notes = (
            f"TRADE_ALLOWED: headroom={headroom_kw:.2f}kW ≥ requested={requested_kw:.2f}kW"
        )

    else:
        # Partial fill — only allow up to headroom
        allowed_kwh = headroom_kw / 4.0  # convert kW back to kWh
        remainder_kwh = trade.quantity_kwh - allowed_kwh

        trade.status = TradeStatus.grid_limited
        trade.allowed_kwh = round(allowed_kwh, 4)
        trade.grid_notes = (
            f"TRADE_LIMITED: headroom={headroom_kw:.2f}kW allows "
            f"{allowed_kwh:.2f}kWh of {trade.quantity_kwh:.2f}kWh requested. "
            f"Remainder {remainder_kwh:.2f}kWh → UTILITY_EXPORT."
        )
        # Log remainder as UTILITY_EXPORT
        await _create_utility_export(trade, remainder_kwh, db)

    # Emit grid alert if congestion is significant
    if grid_state and grid_state.congestion_level >= settings.congestion_threshold:
        await emit_grid_alert(
            feeder_id=trade.feeder_id,
            congestion_level=grid_state.congestion_level,
            headroom_kw=headroom_kw,
            band=grid_state.congestion_band.value,
        )

    return trade


async def _create_utility_export(source_trade: Trade, kwh: float, db: AsyncSession) -> Trade:
    """
    Create a terminal UTILITY_EXPORT trade record for unmatched/rejected surplus.
    This gives the surplus an explicit terminal state (never left in limbo).
    """
    fallback = Trade(
        buy_order_id=None,  # no buyer — going to utility
        sell_order_id=source_trade.sell_order_id,
        feeder_id=source_trade.feeder_id,
        quantity_kwh=round(kwh, 4),
        allowed_kwh=round(kwh, 4),
        clearing_price=settings.utility_export_rate,  # compensated at utility export rate
        status=TradeStatus.utility_export,
        grid_notes=f"Surplus returned to utility net-metering. Source trade: {source_trade.trade_id}",
    )
    db.add(fallback)
    return fallback


async def update_grid_state(
    feeder_id: str,
    transformer_id: str,
    load_kw: float,
    capacity_kw: float,
    db: AsyncSession,
) -> GridState:
    """
    Record a new grid state snapshot. Called by the simulator after each interval.
    """
    load_factor = load_kw / capacity_kw if capacity_kw > 0 else 0.0
    headroom = capacity_kw - load_kw
    band = _compute_congestion_band(load_factor)

    state = GridState(
        feeder_id=feeder_id,
        transformer_id=transformer_id,
        load_kw=round(load_kw, 2),
        capacity_kw=capacity_kw,
        headroom_kw=round(headroom, 2),
        congestion_level=round(load_factor, 4),
        congestion_band=band,
    )
    db.add(state)

    # Emit grid alert if crossing into congestion territory
    if load_factor >= settings.congestion_threshold:
        await emit_grid_alert(
            feeder_id=feeder_id,
            congestion_level=load_factor,
            headroom_kw=headroom,
            band=band.value,
        )

    return state
