"""
Pricing Engine — implements the GRIDMIND dynamic pricing formula exactly.

Formula:
  P_market = P_base + α × DemandIndex − β × SupplyIndex + C_congestion
  P_final  = min(P_max, max(P_min, P_market))

DemandIndex: normalized 0–1 measure of local demand vs capacity in current interval
SupplyIndex:  normalized 0–1 measure of available surplus vs total demand
C_congestion: positive adjustment proportional to feeder load factor
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc

from config import settings
from models.meter_reading import MeterReading
from models.grid_state import GridState
from schemas import MarketPriceResponse


def compute_price_from_indices(
    demand_index: float,
    supply_index: float,
    congestion_level: float,
) -> tuple[float, float]:
    """
    Pure function — compute market and final price from normalized indices.
    Returns (p_market, p_final).

    demand_index:    0–1  (1 = feeder at full demand)
    supply_index:    0–1  (1 = surplus equals or exceeds demand)
    congestion_level: 0–1 (1 = transformer at full capacity)
    """
    c_congestion = congestion_level * settings.c_congestion_max

    p_market = (
        settings.p_base
        + settings.alpha * demand_index
        - settings.beta * supply_index
        + c_congestion
    )

    p_final = min(settings.p_max, max(settings.p_min, p_market))

    return round(p_market, 4), round(p_final, 4)


async def compute_price(feeder_id: str, db: AsyncSession) -> MarketPriceResponse:
    """
    Compute the current indicative market price for a feeder by querying
    the latest 15-minute interval readings.
    """
    # Use the most recent complete 15-min interval window
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=30)  # look back 30 min for data

    # Aggregate meter readings for this feeder in the window
    agg = await db.execute(
        select(
            sqlfunc.coalesce(sqlfunc.sum(MeterReading.consumption_kwh), 0.0).label("total_demand"),
            sqlfunc.coalesce(sqlfunc.sum(MeterReading.surplus_kwh), 0.0).label("total_surplus"),
            sqlfunc.count().label("n_meters"),
        )
        .where(MeterReading.feeder_id == feeder_id)
        .where(MeterReading.timestamp >= window_start)
        .where(MeterReading.is_valid == True)
    )
    row = agg.one()
    total_demand: float = float(row.total_demand)
    total_surplus: float = float(row.total_surplus)

    # Get latest grid state for congestion
    gs_result = await db.execute(
        select(GridState)
        .where(GridState.feeder_id == feeder_id)
        .order_by(GridState.recorded_at.desc())
        .limit(1)
    )
    grid_state = gs_result.scalar_one_or_none()
    congestion_level = grid_state.congestion_level if grid_state else 0.0
    capacity_kw = grid_state.capacity_kw if grid_state else settings.default_transformer_capacity_kw

    # Normalize indices (0–1)
    # DemandIndex: how much demand vs theoretical capacity
    # capacity_kw/4 ≈ kWh capacity per 15-min interval
    capacity_kwh_per_interval = capacity_kw / 4.0
    demand_index = min(1.0, total_demand / capacity_kwh_per_interval) if capacity_kwh_per_interval > 0 else 0.0

    # SupplyIndex: how much surplus vs demand (capped at 1)
    supply_index = min(1.0, total_surplus / total_demand) if total_demand > 0 else 0.0

    _, p_final = compute_price_from_indices(demand_index, supply_index, congestion_level)
    c_congestion = congestion_level * settings.c_congestion_max

    return MarketPriceResponse(
        feeder_id=feeder_id,
        price=p_final,
        p_base=settings.p_base,
        demand_index=round(demand_index, 4),
        supply_index=round(supply_index, 4),
        c_congestion=round(c_congestion, 4),
        timestamp=now,
    )
