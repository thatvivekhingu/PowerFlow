"""
Redis connection pool.

DEV_MODE=true  → fakeredis (in-memory, no server required)
DEV_MODE=false → real Redis via redis-py asyncio (default, used in Docker)
"""

import os
from typing import Optional

DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"

if DEV_MODE:
    import fakeredis.aioredis as fake_aioredis
    _redis_client: Optional[fake_aioredis.FakeRedis] = None

    async def get_redis():
        global _redis_client
        if _redis_client is None:
            _redis_client = fake_aioredis.FakeRedis(decode_responses=True)
        return _redis_client

    async def close_redis():
        global _redis_client
        if _redis_client is not None:
            await _redis_client.aclose()
            _redis_client = None

else:
    import redis.asyncio as aioredis
    from config import settings

    _redis_client: Optional[aioredis.Redis] = None

    async def get_redis() -> aioredis.Redis:
        global _redis_client
        if _redis_client is None:
            _redis_client = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20,
            )
        return _redis_client

    async def close_redis() -> None:
        global _redis_client
        if _redis_client is not None:
            await _redis_client.aclose()
            _redis_client = None


# ── Order book Redis key helpers (same regardless of mode) ────────────────────
def buy_order_key(feeder_id: str) -> str:
    return f"orderbook:{feeder_id}:buy"

def sell_order_key(feeder_id: str) -> str:
    return f"orderbook:{feeder_id}:sell"

def price_cache_key(feeder_id: str) -> str:
    return f"price:{feeder_id}:current"

def grid_state_key(feeder_id: str) -> str:
    return f"grid:{feeder_id}:state"
