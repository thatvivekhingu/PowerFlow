"""
Mocked DISCOM Billing Adapter.

In production, this would make an authenticated HTTP call to the DISCOM's
billing API, dispatching a settlement instruction.

For the MVP, it simulates a successful API call with realistic response
structure and a small random failure rate to demonstrate error handling.
"""

import random
import uuid
from datetime import datetime, timezone


async def dispatch_billing(
    trade_id: str,
    seller_ref: str,
    buyer_ref: str,
    quantity_kwh: float,
    clearing_price: float,
    gross_value: float,
    failure_rate: float = 0.02,  # 2% simulated failure rate
) -> tuple[str | None, bool]:
    """
    Dispatch a settlement instruction to the mocked DISCOM billing system.

    Returns:
        (utility_reference, success)
        utility_reference: DISCOM's reference ID (None on failure)
        success: bool

    In production:
        POST https://discom.example.com/api/v1/billing/p2p-settlement
        Authorization: Bearer <service-account-token>
        Body: { trade_id, seller_ref, buyer_ref, quantity_kwh, price, value }
    """
    # Simulate network call latency (non-blocking)
    import asyncio
    await asyncio.sleep(0.05)  # 50ms mock latency

    # Simulate occasional failure
    if random.random() < failure_rate:
        print(f"⚠️  Billing adapter: simulated failure for trade {trade_id}")
        return None, False

    # Generate a mock DISCOM reference number
    utility_ref = f"DISCOM-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    print(
        f"✅ Billing adapter: dispatched trade {trade_id} | "
        f"qty={quantity_kwh:.3f}kWh @ ₹{clearing_price:.2f} | "
        f"gross=₹{gross_value:.2f} | ref={utility_ref}"
    )

    # Mock response payload (what the real DISCOM API would return)
    _mock_response = {
        "status": "ACCEPTED",
        "utility_reference": utility_ref,
        "trade_id": trade_id,
        "acknowledged_at": datetime.now(timezone.utc).isoformat(),
        "note": "P2P settlement instruction received. Will be reflected in next billing cycle.",
    }

    return utility_ref, True
