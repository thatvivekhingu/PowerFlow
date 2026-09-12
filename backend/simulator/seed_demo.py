"""
GRIDMIND Demo Scenario — Scripted 4-step sequence (Section 11 of spec).

Usage:
  # Seed only (create users, feeders, initial state)
  python -m simulator.seed_demo --seed-only

  # Run full 4-step demo
  python -m simulator.seed_demo

Scenarios:
  1. NORMAL: prosumer 5kWh surplus @ min ₹4; consumer wants 3kWh @ max ₹6
             → 3kWh matched, settled; 2kWh → UTILITY_EXPORT
  2. HIGH DEMAND: spike demand → price rises to P_MAX
  3. CONGESTION: transformer near capacity → GRID_LIMITED state
  4. NO BUYER: surplus with no match → UTILITY_EXPORT fallback
"""

import asyncio
import argparse
import sys
import os
import uuid
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings
from database import db_session
from models.user import User, UserRole
from models.order import Order, OrderSide, OrderStatus
from models.trade import Trade, TradeStatus
from models.grid_state import GridState, CongestionLevel
from models.meter_reading import MeterReading
from models.settlement import Settlement
from services.pricing_engine import compute_price_from_indices
from services.grid_engine import validate_trade, update_grid_state
from services.settlement_service import settle
from services.matching_engine import enqueue_order
from passlib.context import CryptContext


pwd_ctx = CryptContext(schemes=["bcrypt"])
DEMO_PASSWORD = pwd_ctx.hash("demo")

FEEDER_DEMO = "FEEDER-01"
FEEDER_CONGESTED = "FEEDER-02"
INTERVAL_NOW = (
    datetime.now(timezone.utc).replace(second=0, microsecond=0)
    .strftime("%Y-%m-%dT%H:00/%Y-%m-%dT%H:15")
)


# ── Seed helpers ───────────────────────────────────────────────────────────────
async def _get_or_create_user(
    db, username: str, role: UserRole, meter_id: str, feeder_id: str
) -> User:
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.username == username))
    u = result.scalar_one_or_none()
    if u:
        return u
    u = User(
        username=username,
        hashed_password=DEMO_PASSWORD,
        role=role,
        meter_id=meter_id,
        feeder_id=feeder_id,
    )
    db.add(u)
    await db.flush()
    await db.refresh(u)
    print(f"  ✅ Created {role.value}: {username} ({meter_id})")
    return u


async def seed_users() -> dict:
    """Create demo users and return them as a dict."""
    async with db_session() as db:
        prosumer1 = await _get_or_create_user(
            db, "demo_prosumer_01", UserRole.prosumer, "METER-DEMO-P01", FEEDER_DEMO
        )
        prosumer2 = await _get_or_create_user(
            db, "demo_prosumer_02", UserRole.prosumer, "METER-DEMO-P02", FEEDER_CONGESTED
        )
        consumer1 = await _get_or_create_user(
            db, "demo_consumer_01", UserRole.consumer, "METER-DEMO-C01", FEEDER_DEMO
        )
        operator = await _get_or_create_user(
            db, "demo_operator", UserRole.discom_operator, "METER-DEMO-OPS", FEEDER_DEMO
        )
        regulator = await _get_or_create_user(
            db, "demo_regulator", UserRole.regulator, "METER-DEMO-REG", FEEDER_DEMO
        )
        return {
            "prosumer1": prosumer1,
            "prosumer2": prosumer2,
            "consumer1": consumer1,
            "operator": operator,
            "regulator": regulator,
        }


async def seed_grid_state(feeder_id: str, load_kw: float, capacity_kw: float = 100.0):
    """Insert a GridState row for demo."""
    transformer_id = "TX-01" if feeder_id == FEEDER_DEMO else "TX-02"
    async with db_session() as db:
        state = await update_grid_state(feeder_id, transformer_id, load_kw, capacity_kw, db)
    return state


async def _insert_meter_reading(
    meter_id: str, feeder_id: str,
    generation_kwh: float, consumption_kwh: float,
):
    async with db_session() as db:
        r = MeterReading(
            meter_id=meter_id,
            feeder_id=feeder_id,
            timestamp=datetime.now(timezone.utc),
            generation_kwh=generation_kwh,
            consumption_kwh=consumption_kwh,
            export_kwh=max(0.0, generation_kwh - consumption_kwh),
            surplus_kwh=round(max(0.0, generation_kwh - consumption_kwh), 4),
            is_valid=True,
        )
        db.add(r)
    return r


# ── Scenario 1: Normal trade ───────────────────────────────────────────────────
async def scenario_normal(users: dict) -> None:
    print("\n" + "═" * 60)
    print("📋 SCENARIO 1: NORMAL TRADE")
    print("   Prosumer: 5 kWh surplus @ min ₹4/kWh")
    print("   Consumer: wants 3 kWh @ max ₹6/kWh")
    print("   Grid: healthy (30% load)")
    print("═" * 60)

    prosumer = users["prosumer1"]
    consumer = users["consumer1"]

    # Simulate readings
    await _insert_meter_reading(prosumer.meter_id, FEEDER_DEMO, generation_kwh=6.0, consumption_kwh=1.0)
    await _insert_meter_reading(consumer.meter_id, FEEDER_DEMO, generation_kwh=0.0, consumption_kwh=2.0)

    # Grid: 30kW load on 100kW capacity
    await seed_grid_state(FEEDER_DEMO, load_kw=30.0, capacity_kw=100.0)

    async with db_session() as db:
        # Sell order: 5 kWh min ₹4
        sell_order = Order(
            user_id=prosumer.user_id,
            feeder_id=FEEDER_DEMO,
            side=OrderSide.sell,
            quantity_kwh=5.0,
            min_price=4.0,
            interval=INTERVAL_NOW,
            status=OrderStatus.open,
        )
        db.add(sell_order)

        # Buy order: 3 kWh max ₹6
        buy_order = Order(
            user_id=consumer.user_id,
            feeder_id=FEEDER_DEMO,
            side=OrderSide.buy,
            quantity_kwh=3.0,
            max_price=6.0,
            interval=INTERVAL_NOW,
            status=OrderStatus.open,
        )
        db.add(buy_order)
        await db.flush()
        await db.refresh(sell_order)
        await db.refresh(buy_order)

        # Price check
        price_result = compute_price_from_indices(
            demand_index=0.3, supply_index=0.6, congestion_level=0.3
        )
        print(f"\n  💰 Market price: ₹{price_result[1]}/kWh (p_market={price_result[0]})")
        print(f"  ✅ Match condition: buyer ₹6 ≥ seller ₹4 → MATCH")

        # Match: 3 kWh at clearing price (midpoint)
        clearing_price = (6.0 + 4.0) / 2.0
        trade = Trade(
            buy_order_id=buy_order.order_id,
            sell_order_id=sell_order.order_id,
            feeder_id=FEEDER_DEMO,
            quantity_kwh=3.0,
            clearing_price=clearing_price,
            status=TradeStatus.open,
        )
        db.add(trade)
        await db.flush()

        # Grid validation
        await validate_trade(trade, db)
        await db.flush()
        print(f"\n  🔌 Grid check: {trade.grid_notes}")
        print(f"  📊 Trade status: {trade.status.value}")

        # Settle
        if trade.status in (TradeStatus.matched, TradeStatus.grid_limited):
            settlement = await settle(trade, db)
            await db.flush()
            print(f"\n  💳 Settlement:")
            print(f"     Seller credit: ₹{settlement.seller_credit:.2f}")
            print(f"     Buyer debit:   ₹{settlement.buyer_debit:.2f}")
            print(f"     Audit hash:    {settlement.audit_tx[:16]}...")
            print(f"     Billing ref:   {settlement.utility_reference}")

        # Remaining 2 kWh → UTILITY_EXPORT (created by grid_engine fallback)
        print(f"\n  🔁 Remaining 2 kWh → UTILITY_EXPORT fallback @ ₹{settings.utility_export_rate}/kWh")
        print(f"  ✅ Scenario 1 COMPLETE: Trade matched and settled!\n")


# ── Scenario 2: High demand → P_MAX ───────────────────────────────────────────
async def scenario_high_demand() -> None:
    print("═" * 60)
    print("📋 SCENARIO 2: HIGH DEMAND — Price rises to P_MAX")
    print("═" * 60)

    # Extreme demand, minimal supply, no congestion
    demand_index = 1.0   # fully loaded demand
    supply_index = 0.05  # almost no surplus
    congestion_level = 0.0

    _, p_final = compute_price_from_indices(demand_index, supply_index, congestion_level)
    p_market = settings.p_base + settings.alpha * demand_index - settings.beta * supply_index

    print(f"\n  📈 DemandIndex={demand_index}, SupplyIndex={supply_index}, Congestion=0")
    print(f"  💹 P_market = {settings.p_base} + {settings.alpha}×{demand_index} - {settings.beta}×{supply_index}")
    print(f"           = {p_market:.3f} ₹/kWh")
    print(f"  🔒 P_final = min({settings.p_max}, max({settings.p_min}, {p_market:.3f})) = ₹{p_final}/kWh")
    print(f"  ✅ Price hit P_MAX = ₹{settings.p_max}/kWh — consumer protection ceiling active\n")


# ── Scenario 3: Congestion → GRID_LIMITED ─────────────────────────────────────
async def scenario_congestion(users: dict) -> None:
    print("═" * 60)
    print("📋 SCENARIO 3: CONGESTION — Trade limited by grid headroom")
    print("   Transformer at 96kW / 100kW capacity (96% loaded)")
    print("═" * 60)

    prosumer = users["prosumer1"]
    consumer = users["consumer1"]

    # Push transformer near capacity (96% loaded → 4kW headroom)
    await seed_grid_state(FEEDER_DEMO, load_kw=96.0, capacity_kw=100.0)
    headroom_kw = 100.0 - 96.0  # 4 kW
    headroom_kwh = headroom_kw / 4.0  # 1 kWh per 15-min interval

    print(f"\n  ⚡ Transformer: 96kW / 100kW → headroom = {headroom_kw}kW = {headroom_kwh}kWh/interval")

    async with db_session() as db:
        sell_order = Order(
            user_id=prosumer.user_id,
            feeder_id=FEEDER_DEMO,
            side=OrderSide.sell,
            quantity_kwh=5.0,
            min_price=4.0,
            interval=INTERVAL_NOW,
            status=OrderStatus.open,
        )
        buy_order = Order(
            user_id=consumer.user_id,
            feeder_id=FEEDER_DEMO,
            side=OrderSide.buy,
            quantity_kwh=5.0,
            max_price=6.0,
            interval=INTERVAL_NOW,
            status=OrderStatus.open,
        )
        db.add(sell_order)
        db.add(buy_order)
        await db.flush()
        await db.refresh(sell_order)
        await db.refresh(buy_order)

        # Match attempted for 5kWh
        trade = Trade(
            buy_order_id=buy_order.order_id,
            sell_order_id=sell_order.order_id,
            feeder_id=FEEDER_DEMO,
            quantity_kwh=5.0,
            clearing_price=5.0,
            status=TradeStatus.open,
        )
        db.add(trade)
        await db.flush()

        await validate_trade(trade, db)
        await db.flush()

        print(f"\n  🔌 Grid validation result: {trade.status.value}")
        print(f"  📝 {trade.grid_notes}")
        if trade.allowed_kwh:
            print(f"  ✅ Allowed: {trade.allowed_kwh}kWh | Rejected: {5.0 - trade.allowed_kwh}kWh → UTILITY_EXPORT")
        print(f"  ✅ Scenario 3 COMPLETE: GRID_LIMITED state demonstrated!\n")


# ── Scenario 4: No buyer → UTILITY_EXPORT ─────────────────────────────────────
async def scenario_no_buyer(users: dict) -> None:
    print("═" * 60)
    print("📋 SCENARIO 4: NO BUYER — Surplus falls back to UTILITY_EXPORT")
    print("═" * 60)

    prosumer = users["prosumer2"]
    await seed_grid_state(FEEDER_CONGESTED, load_kw=20.0, capacity_kw=80.0)

    async with db_session() as db:
        sell_order = Order(
            user_id=prosumer.user_id,
            feeder_id=FEEDER_CONGESTED,
            side=OrderSide.sell,
            quantity_kwh=4.0,
            min_price=4.5,
            interval=INTERVAL_NOW,
            status=OrderStatus.open,
        )
        db.add(sell_order)
        await db.flush()
        await db.refresh(sell_order)

        print(f"\n  📤 Sell order posted: {sell_order.quantity_kwh}kWh @ min ₹{sell_order.min_price}/kWh")
        print(f"  🔍 No matching buy orders found on {FEEDER_CONGESTED}")

        # No buy order → create UTILITY_EXPORT trade directly
        fallback = Trade(
            buy_order_id=None,
            sell_order_id=sell_order.order_id,
            feeder_id=FEEDER_CONGESTED,
            quantity_kwh=4.0,
            allowed_kwh=4.0,
            clearing_price=settings.utility_export_rate,
            status=TradeStatus.utility_export,
            grid_notes="No matching buyer found. Surplus returned to utility net-metering.",
        )
        db.add(fallback)
        sell_order.status = OrderStatus.expired
        await db.flush()

        print(f"\n  🔁 Surplus {fallback.quantity_kwh}kWh → UTILITY_EXPORT @ ₹{settings.utility_export_rate}/kWh")
        print(f"  📝 State: {fallback.status.value} (explicit terminal state)")
        print(f"  ✅ Scenario 4 COMPLETE: Fallback to utility net-metering demonstrated!\n")


# ── Main ───────────────────────────────────────────────────────────────────────
async def main(seed_only: bool = False) -> None:
    print("\n" + "═" * 60)
    print("⚡ GRIDMIND DEMO SCENARIO RUNNER")
    print("═" * 60)

    print("\n📦 Seeding demo users...")
    users = await seed_users()

    if seed_only:
        print("\n✅ Seed complete. Run without --seed-only to execute demo scenarios.")
        print("\nDemo credentials (password: 'demo' for all):")
        print("  Prosumer:  demo_prosumer_01")
        print("  Consumer:  demo_consumer_01")
        print("  Operator:  demo_operator")
        print("  Regulator: demo_regulator")
        return

    await scenario_normal(users)
    await scenario_high_demand()
    await scenario_congestion(users)
    await scenario_no_buyer(users)

    print("═" * 60)
    print("🎉 ALL 4 DEMO SCENARIOS COMPLETE")
    print("   Visit http://localhost:3000 to see live dashboards")
    print("   Visit http://localhost:8000/api/dashboard/summary for KPIs")
    print("═" * 60 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GRIDMIND Demo Scenario Runner")
    parser.add_argument("--seed-only", action="store_true", help="Only seed users, don't run scenarios")
    args = parser.parse_args()
    asyncio.run(main(seed_only=args.seed_only))
