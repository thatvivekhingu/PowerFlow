"""
POST /api/trades/{id}/settle — Finalize an approved trade.
GET  /api/trades            — List trades (operator view).
GET  /api/trades/{id}       — Trade detail.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.trade import Trade, TradeStatus
from models.settlement import Settlement
from models.user import UserRole, User
from schemas import TradeResponse, SettlementResponse
from auth import get_current_user

router = APIRouter(prefix="/api/trades", tags=["Trades"])


@router.get("", response_model=List[TradeResponse])
async def list_trades(
    feeder_id: Optional[str] = Query(None),
    trade_status: Optional[TradeStatus] = Query(None, alias="status"),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all trades."""
    query = select(Trade)
    if feeder_id:
        query = query.where(Trade.feeder_id == feeder_id)
    if trade_status:
        query = query.where(Trade.status == trade_status)
    query = query.order_by(Trade.timestamp.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade(
    trade_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get trade detail. All authenticated users can read trade status."""
    result = await db.execute(select(Trade).where(Trade.trade_id == trade_id))
    trade = result.scalar_one_or_none()
    if trade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    return trade


@router.post("/{trade_id}/settle", response_model=SettlementResponse)
async def settle_trade(
    trade_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Finalize a MATCHED trade — runs settlement, writes audit ledger entry,
    dispatches to mocked DISCOM billing adapter.
    """
    result = await db.execute(select(Trade).where(Trade.trade_id == trade_id))
    trade = result.scalar_one_or_none()
    if trade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    if trade.status not in (TradeStatus.matched, TradeStatus.grid_limited):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Trade is in state {trade.status.value} — only MATCHED or GRID_LIMITED trades can be settled",
        )

    from services.settlement_service import settle
    settlement = await settle(trade, db)
    return settlement


@router.get("/{trade_id}/settlement", response_model=SettlementResponse)
async def get_trade_settlement(
    trade_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the settlement and billing invoice for a settled trade."""
    result = await db.execute(select(Settlement).where(Settlement.trade_id == trade_id))
    settlement = result.scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settlement not found for this trade")
    return settlement


@router.get("/{trade_id}/blockchain-proof")
async def get_blockchain_proof(
    trade_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get on-chain smart contract transaction receipt & cryptographic proof."""
    result = await db.execute(select(Trade).where(Trade.trade_id == trade_id))
    trade = result.scalar_one_or_none()
    if trade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    from services.blockchain_service import generate_blockchain_proof
    proof = generate_blockchain_proof(
        trade_id=str(trade.trade_id),
        seller_ref=str(trade.sell_order_id)[:8] if trade.sell_order_id else "PROSUMER",
        buyer_ref=str(trade.buy_order_id)[:8] if trade.buy_order_id else "CONSUMER",
        quantity_kwh=float(trade.quantity_kwh),
        clearing_price=float(trade.clearing_price),
        discom_invoice_ref=f"DISCOM-{str(trade.trade_id)[:8].upper()}",
    )
    return proof
