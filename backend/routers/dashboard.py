"""
GET /api/dashboard/summary — All 6 evaluation KPIs + market snapshot.
Accessible to DISCOM operators and regulators.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc

from database import get_db
from models.trade import Trade, TradeStatus
from models.settlement import Settlement, BillingStatus
from models.meter_reading import MeterReading
from models.grid_state import GridState
from models.order import Order, OrderStatus
from models.user import UserRole
from schemas import DashboardSummary
from auth import get_current_user
from config import settings

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Compute and return all 6 marketplace KPIs:
    1. Prosumer revenue uplift
    2. Consumer savings
    3. Local matching rate
    4. Grid utilization
    5. Unmatched energy rate
    6. Settlement success rate
    """
    # ── Trade counts ──────────────────────────────────────────────────────────
    total_q = await db.execute(select(sqlfunc.count()).select_from(Trade))
    total_trades = total_q.scalar() or 0

    settled_q = await db.execute(
        select(sqlfunc.count()).select_from(Trade).where(Trade.status == TradeStatus.settled)
    )
    settled_trades = settled_q.scalar() or 0

    rejected_q = await db.execute(
        select(sqlfunc.count()).select_from(Trade).where(Trade.status == TradeStatus.rejected)
    )
    rejected_trades = rejected_q.scalar() or 0

    utility_q = await db.execute(
        select(sqlfunc.count()).select_from(Trade).where(Trade.status == TradeStatus.utility_export)
    )
    utility_export_trades = utility_q.scalar() or 0

    # ── kWh summaries ─────────────────────────────────────────────────────────
    # Total surplus generated (sum of positive surplus readings)
    surplus_q = await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(MeterReading.surplus_kwh), 0.0))
        .where(MeterReading.is_valid == True)
    )
    total_surplus_kwh: float = surplus_q.scalar() or 0.0

    # Matched kWh (settled trades use allowed_kwh if grid-limited)
    matched_q = await db.execute(
        select(
            sqlfunc.coalesce(
                sqlfunc.sum(sqlfunc.coalesce(Trade.allowed_kwh, Trade.quantity_kwh)), 0.0
            )
        )
        .where(Trade.status == TradeStatus.settled)
    )
    matched_kwh: float = matched_q.scalar() or 0.0

    unmatched_kwh = max(0.0, total_surplus_kwh - matched_kwh)

    # ── KPI 1: Prosumer revenue uplift ────────────────────────────────────────
    # P2P revenue from settled settlements
    p2p_revenue_q = await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(Settlement.seller_credit), 0.0))
        .where(Settlement.billing_status == BillingStatus.confirmed)
    )
    p2p_revenue: float = p2p_revenue_q.scalar() or 0.0
    baseline_export_value = matched_kwh * settings.utility_export_rate
    prosumer_revenue_uplift = p2p_revenue - baseline_export_value

    # ── KPI 2: Consumer savings ────────────────────────────────────────────────
    p2p_buyer_cost_q = await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(Settlement.buyer_debit), 0.0))
        .where(Settlement.billing_status == BillingStatus.confirmed)
    )
    p2p_buyer_cost: float = p2p_buyer_cost_q.scalar() or 0.0
    baseline_retail_cost = matched_kwh * settings.retail_baseline
    consumer_savings = baseline_retail_cost - p2p_buyer_cost

    # ── KPI 3: Local matching rate ─────────────────────────────────────────────
    local_matching_rate = (matched_kwh / total_surplus_kwh) if total_surplus_kwh > 0 else 0.0

    # ── KPI 4: Grid utilization (peak) ────────────────────────────────────────
    peak_q = await db.execute(
        select(sqlfunc.max(GridState.congestion_level))
    )
    peak_congestion: float = peak_q.scalar() or 0.0
    grid_utilization_pct = peak_congestion * 100.0

    # ── KPI 5: Unmatched energy rate ──────────────────────────────────────────
    unmatched_energy_rate = (unmatched_kwh / total_surplus_kwh) if total_surplus_kwh > 0 else 0.0

    # ── KPI 6: Settlement success rate ────────────────────────────────────────
    finalized = settled_trades + rejected_trades
    settlement_success_rate = (settled_trades / finalized) if finalized > 0 else 0.0

    # ── Active orders count ────────────────────────────────────────────────────
    active_q = await db.execute(
        select(sqlfunc.count()).select_from(Order).where(Order.status == OrderStatus.open)
    )
    active_orders = active_q.scalar() or 0

    # ── Current prices per feeder ─────────────────────────────────────────────
    from redis_client import get_redis, price_cache_key
    import json
    redis = await get_redis()

    feeders_q = await db.execute(
        select(GridState.feeder_id).distinct()
    )
    feeder_ids = [row[0] for row in feeders_q.all()]

    current_prices: dict[str, float] = {}
    for fid in feeder_ids:
        cached = await redis.get(price_cache_key(fid))
        if cached:
            data = json.loads(cached)
            current_prices[fid] = data.get("price", settings.p_base)
        else:
            current_prices[fid] = settings.p_base

    return DashboardSummary(
        prosumer_revenue_uplift_inr=round(prosumer_revenue_uplift, 2),
        consumer_savings_inr=round(consumer_savings, 2),
        local_matching_rate=round(local_matching_rate, 4),
        grid_utilization_pct=round(grid_utilization_pct, 2),
        unmatched_energy_rate=round(unmatched_energy_rate, 4),
        settlement_success_rate=round(settlement_success_rate, 4),
        total_trades=total_trades,
        settled_trades=settled_trades,
        rejected_trades=rejected_trades,
        utility_export_trades=utility_export_trades,
        total_surplus_kwh=round(total_surplus_kwh, 4),
        matched_kwh=round(matched_kwh, 4),
        unmatched_kwh=round(unmatched_kwh, 4),
        current_price_inr=current_prices,
        active_orders=active_orders,
        as_of=datetime.now(timezone.utc),
    )
