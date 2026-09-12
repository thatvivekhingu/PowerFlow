"""
Matching Engine — FIFO price-time priority order book.

Match condition:
  buyer_max_price ≥ seller_min_price  AND  GridApproved == TRUE

Order book state is maintained in Redis sorted sets per feeder:
  - Sell book: sorted by min_price ASC (cheapest first)
  - Buy book:  sorted by max_price DESC (highest willing-to-pay first)

When a match is found, the trade goes through grid validation before
being persisted as MATCHED or GRID_LIMITED.

Extension point: feeder_location_filter() — currently a no-op passthrough.
Replace with feeder-location or forecasted-demand logic in the future.
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import db_session
from models.order import Order, OrderSide, OrderStatus
from models.trade import Trade, TradeStatus
from redis_client import get_redis, buy_order_key, sell_order_key
from routers.websocket import emit_order_matched


# ── Extension point stub ───────────────────────────────────────────────────────
def feeder_location_filter(buy_order: dict, sell_order: dict) -> bool:
    """
    FUTURE: Filter matches by feeder location or demand forecast.
    Currently a no-op — returns True for all pairs on the same feeder.
    """
    return buy_order.get("feeder_id") == sell_order.get("feeder_id")


# ── Order book queue operations ────────────────────────────────────────────────
async def enqueue_order(order: Order) -> None:
    """Add a newly created order to the Redis order book."""
    redis = await get_redis()
    payload = json.dumps({
        "order_id": str(order.order_id),
        "user_id": str(order.user_id),
        "feeder_id": order.feeder_id,
        "quantity_kwh": order.quantity_kwh,
        "filled_kwh": order.filled_kwh,
        "min_price": order.min_price,
        "max_price": order.max_price,
        "interval": order.interval,
        "created_at": order.created_at.isoformat() if order.created_at else datetime.now(timezone.utc).isoformat(),
    })

    if order.side == OrderSide.sell:
        # Score = min_price (lower = more competitive sell offer)
        await redis.zadd(sell_order_key(order.feeder_id), {payload: order.min_price})
    else:
        # Score = -max_price (negated so highest max_price has lowest score → pops first)
        await redis.zadd(buy_order_key(order.feeder_id), {payload: -order.max_price})


async def _get_best_orders(feeder_id: str) -> tuple[dict | None, dict | None]:
    """Return the best (most competitive) buy and sell orders for a feeder."""
    redis = await get_redis()

    # Best sell: lowest min_price (score ascending)
    sells = await redis.zrange(sell_order_key(feeder_id), 0, 0, withscores=True)
    # Best buy: highest max_price (score = -max_price, so lowest score)
    buys = await redis.zrange(buy_order_key(feeder_id), 0, 0, withscores=True)

    best_sell = json.loads(sells[0][0]) if sells else None
    best_buy = json.loads(buys[0][0]) if buys else None

    return best_buy, best_sell


async def _remove_from_book(feeder_id: str, side: str, payload_str: str) -> None:
    redis = await get_redis()
    if side == "sell":
        await redis.zrem(sell_order_key(feeder_id), payload_str)
    else:
        await redis.zrem(buy_order_key(feeder_id), payload_str)


# ── Core matching logic ────────────────────────────────────────────────────────
async def try_match_feeder(feeder_id: str) -> None:
    """
    Attempt to match orders on a single feeder. Runs one matching pass.
    Called by the background loop and can also be triggered on new order creation.
    """
    best_buy, best_sell = await _get_best_orders(feeder_id)

    if not best_buy or not best_sell:
        return  # Nothing to match

    # Extension point: feeder location filter
    if not feeder_location_filter(best_buy, best_sell):
        return

    # Match condition: buyer willing to pay ≥ seller minimum
    if best_buy["max_price"] < best_sell["min_price"]:
        return  # No price overlap

    # Clearing price: midpoint (could also use seller's min or buyer's max)
    clearing_price = round(
        (best_buy["max_price"] + best_sell["min_price"]) / 2.0, 4
    )
    # Quantity: fill as much as possible (min of remaining quantities)
    buy_remaining = best_buy["quantity_kwh"] - best_buy.get("filled_kwh", 0.0)
    sell_remaining = best_sell["quantity_kwh"] - best_sell.get("filled_kwh", 0.0)
    match_qty = min(buy_remaining, sell_remaining)

    if match_qty <= 0:
        return

    async with db_session() as db:
        # Create the trade (OPEN state — grid engine will validate)
        trade = Trade(
            buy_order_id=uuid.UUID(best_buy["order_id"]),
            sell_order_id=uuid.UUID(best_sell["order_id"]),
            feeder_id=feeder_id,
            quantity_kwh=match_qty,
            clearing_price=clearing_price,
            status=TradeStatus.open,
        )
        db.add(trade)
        await db.flush()

        # Run grid validation immediately
        from services.grid_engine import validate_trade
        await validate_trade(trade, db)

        await db.refresh(trade)

        # Update order filled quantities
        await _update_order_filled(best_buy["order_id"], match_qty, db)
        await _update_order_filled(best_sell["order_id"], match_qty, db)

        # Remove from Redis book (or re-queue with updated fill if partial)
        redis = await get_redis()
        sells_raw = await redis.zrange(sell_order_key(feeder_id), 0, 0)
        buys_raw = await redis.zrange(buy_order_key(feeder_id), 0, 0)
        if sells_raw:
            await redis.zrem(sell_order_key(feeder_id), sells_raw[0])
        if buys_raw:
            await redis.zrem(buy_order_key(feeder_id), buys_raw[0])

        # Re-queue partially filled orders
        if sell_remaining - match_qty > 0.01:
            updated_sell = {**best_sell, "filled_kwh": best_sell.get("filled_kwh", 0.0) + match_qty}
            r = await get_redis()
            await r.zadd(sell_order_key(feeder_id), {json.dumps(updated_sell): best_sell["min_price"]})
        if buy_remaining - match_qty > 0.01:
            updated_buy = {**best_buy, "filled_kwh": best_buy.get("filled_kwh", 0.0) + match_qty}
            r = await get_redis()
            await r.zadd(buy_order_key(feeder_id), {json.dumps(updated_buy): -best_buy["max_price"]})

    # Broadcast WebSocket event
    if trade.status in (TradeStatus.matched, TradeStatus.grid_limited):
        await emit_order_matched(str(trade.trade_id), match_qty, clearing_price)


async def _update_order_filled(order_id: str, qty: float, db: AsyncSession) -> None:
    """Update order filled_kwh and status in DB."""
    result = await db.execute(select(Order).where(Order.order_id == uuid.UUID(order_id)))
    order = result.scalar_one_or_none()
    if order is None:
        return
    order.filled_kwh = round(order.filled_kwh + qty, 4)
    if order.filled_kwh >= order.quantity_kwh - 0.001:
        order.status = OrderStatus.matched
    else:
        order.status = OrderStatus.partially_filled


# ── Background matching loop ───────────────────────────────────────────────────
async def matching_loop() -> None:
    """
    Runs continuously in the background (started at app startup).
    Polls each feeder's order book and attempts matches every 5 seconds.
    """
    from models.grid_state import GridState
    print("🔄 Matching engine loop running (5s interval)...")
    while True:
        try:
            async with db_session() as db:
                result = await db.execute(
                    select(GridState.feeder_id).distinct()
                )
                feeder_ids = [row[0] for row in result.all()]

            for feeder_id in feeder_ids:
                await try_match_feeder(feeder_id)

        except asyncio.CancelledError:
            print("🔄 Matching engine loop stopped.")
            break
        except Exception as e:
            print(f"⚠️  Matching loop error: {e}")

        await asyncio.sleep(5)
