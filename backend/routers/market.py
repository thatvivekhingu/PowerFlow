"""
GET /api/market/price — Current indicative market price per feeder.

Price is computed on-demand from the latest meter readings interval.
Result is cached in Redis for 30 seconds to avoid repeated DB hits.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc
import json

from database import get_db
from redis_client import get_redis, price_cache_key
from models.meter_reading import MeterReading
from models.grid_state import GridState
from schemas import MarketPriceResponse
from auth import get_current_user
from models.user import User

router = APIRouter(prefix="/api/market", tags=["Market"])

PRICE_CACHE_TTL = 30  # seconds


@router.get("/price", response_model=MarketPriceResponse)
async def get_market_price(
    feeder_id: str = Query(..., description="Feeder ID to get price for"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the current indicative P2P market price for the given feeder.
    Formula: P_market = P_base + α×DemandIndex − β×SupplyIndex + C_congestion
    Result is cached in Redis for 30 seconds.
    """
    redis = await get_redis()
    cache_key = price_cache_key(feeder_id)

    # Try Redis cache first
    cached = await redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        return MarketPriceResponse(**data)

    # Compute from DB
    from services.pricing_engine import compute_price
    price_result = await compute_price(feeder_id, db)

    # Cache result
    await redis.setex(cache_key, PRICE_CACHE_TTL, price_result.model_dump_json())

    return price_result
