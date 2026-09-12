"""
Settlement Service — finalizes approved trades and writes to the audit ledger.

Flow:
  1. Verify trade is in MATCHED or GRID_LIMITED state
  2. Compute gross value, platform fee, net credits/debits
  3. Write Settlement record (pseudonymised — no raw user data)
  4. Update Trade status to SETTLED
  5. Call mocked DISCOM billing adapter
  6. Generate SHA-256 audit hash
  7. Emit WebSocket settlement_complete event
"""

import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from models.trade import Trade, TradeStatus
from models.order import Order
from models.user import User
from models.settlement import Settlement, BillingStatus
from services.billing_adapter import dispatch_billing
from routers.websocket import emit_settlement_complete

PLATFORM_FEE_RATE = 0.005  # 0.5% of gross trade value


def _pseudonymise(wallet_id: str) -> str:
    """One-way hash of wallet_id for the audit ledger."""
    return hashlib.sha256(wallet_id.encode()).hexdigest()[:16]


def _make_audit_hash(
    trade_id: uuid.UUID,
    seller_ref: str,
    buyer_ref: str,
    quantity_kwh: float,
    clearing_price: float,
    timestamp: datetime,
) -> str:
    """SHA-256 of canonical trade string. Used as the audit_tx field."""
    raw = f"{trade_id}|{seller_ref}|{buyer_ref}|{quantity_kwh:.4f}|{clearing_price:.4f}|{timestamp.isoformat()}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def settle(trade: Trade, db: AsyncSession) -> Settlement:
    """
    Settle a MATCHED or GRID_LIMITED trade.
    Returns the created Settlement record.
    """
    # Determine the actual quantity to settle
    settled_qty = trade.allowed_kwh if trade.allowed_kwh is not None else trade.quantity_kwh

    # Resolve participant wallet IDs via their orders
    sell_result = await db.execute(
        select(Order).where(Order.order_id == trade.sell_order_id)
    )
    sell_order = sell_result.scalar_one_or_none()

    buyer_wallet = "utility_export"
    seller_wallet = "unknown"

    if sell_order:
        user_result = await db.execute(select(User).where(User.user_id == sell_order.user_id))
        seller = user_result.scalar_one_or_none()
        if seller:
            seller_wallet = seller.wallet_id

    if trade.buy_order_id:
        buy_result = await db.execute(select(Order).where(Order.order_id == trade.buy_order_id))
        buy_order = buy_result.scalar_one_or_none()
        if buy_order:
            buyer_result = await db.execute(select(User).where(User.user_id == buy_order.user_id))
            buyer = buyer_result.scalar_one_or_none()
            if buyer:
                buyer_wallet = buyer.wallet_id

    # Pseudonymise for audit ledger
    seller_ref = _pseudonymise(seller_wallet)
    buyer_ref = _pseudonymise(buyer_wallet)

    # Financial calculations
    gross_value = round(settled_qty * trade.clearing_price, 4)
    platform_fee = round(gross_value * PLATFORM_FEE_RATE, 4)
    seller_credit = round(gross_value - platform_fee, 4)
    buyer_debit = round(gross_value + platform_fee, 4)  # buyer pays fee too

    now = datetime.now(timezone.utc)
    audit_hash = _make_audit_hash(
        trade.trade_id, seller_ref, buyer_ref, settled_qty, trade.clearing_price, now
    )

    # Call mocked DISCOM billing adapter
    billing_ref, billing_ok = await dispatch_billing(
        trade_id=str(trade.trade_id),
        seller_ref=seller_ref,
        buyer_ref=buyer_ref,
        quantity_kwh=settled_qty,
        clearing_price=trade.clearing_price,
        gross_value=gross_value,
    )

    settlement = Settlement(
        trade_id=trade.trade_id,
        seller_ref=seller_ref,
        buyer_ref=buyer_ref,
        quantity_kwh=settled_qty,
        clearing_price=trade.clearing_price,
        gross_value=gross_value,
        platform_fee=platform_fee,
        seller_credit=seller_credit,
        buyer_debit=buyer_debit,
        utility_reference=billing_ref,
        billing_status=BillingStatus.confirmed if billing_ok else BillingStatus.failed,
        audit_tx=audit_hash,
    )
    db.add(settlement)

    # Mark trade as SETTLED
    trade.status = TradeStatus.settled
    trade.settled_at = now

    await db.flush()

    # WebSocket broadcast
    await emit_settlement_complete(str(trade.trade_id), TradeStatus.settled.value)

    return settlement
