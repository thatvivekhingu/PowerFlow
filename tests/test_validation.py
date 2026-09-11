"""
Validation, Safety and Failure-Case Tests for POWERFLOW MCP Server.
Verifies business validation, grid constraints, and privacy protection.
"""

import pytest
from unittest.mock import patch
from powerflow_mcp.tools.meter_tools import get_meter_reading
from powerflow_mcp.tools.grid_tools import get_grid_status
from powerflow_mcp.tools.market_tools import create_buy_order, create_sell_order
from powerflow_mcp.security import mask_sensitive_info
from powerflow_mcp.db.repository import db_repository


@pytest.mark.asyncio
async def test_non_existent_meter_id():
    """Verify querying an unknown meter returns METER_NOT_FOUND error."""
    res = await get_meter_reading("H999_NON_EXISTENT")
    assert res["status"] == "ERROR"
    assert res["error_code"] == "METER_NOT_FOUND"
    assert "not found" in res["message"].lower()


@pytest.mark.asyncio
async def test_non_existent_feeder_id():
    """Verify querying an unknown feeder returns FEEDER_NOT_FOUND error."""
    res = await get_grid_status("FEEDER-INVALID-99")
    assert res["status"] == "ERROR"
    assert res["error_code"] == "FEEDER_NOT_FOUND"


@pytest.mark.asyncio
async def test_consumer_cannot_create_sell_order():
    """Safety check: Pure consumers (no panels) cannot offer solar energy into marketplace."""
    # H011 is a consumer
    res = await create_sell_order(
        user_id="H011",
        quantity_kwh=2.0,
        min_price=4.50
    )
    assert res["status"] == "ERROR"
    assert res["error_code"] == "INVALID_ORDER_PARAMETERS"
    assert "only prosumers can create sell orders" in res["message"].lower()


@pytest.mark.asyncio
async def test_buy_order_price_below_floor_rejected():
    """Regulatory boundary: Bids below regulatory floor (₹3.00) must be rejected."""
    res = await create_buy_order(
        user_id="H011",
        quantity_kwh=2.0,
        max_price=1.50  # Below ₹3.00 floor
    )
    assert res["status"] == "ERROR"
    assert "regulatory limits" in res["message"].lower() or "range" in res["message"].lower()


@pytest.mark.asyncio
async def test_buy_order_quantity_too_low():
    """Order quantity below 0.1 kWh minimum is rejected."""
    res = await create_buy_order(
        user_id="H011",
        quantity_kwh=0.01,  # Below 0.1 kWh
        max_price=6.00
    )
    assert res["status"] == "ERROR"
    assert "quantity" in res["message"].lower()


@pytest.mark.asyncio
async def test_grid_congestion_blocks_order():
    """Grid safety rule: When feeder utilization exceeds critical threshold, orders are rejected."""
    # Mock feeder state to be congested
    congested_state = {
        "feeder_id": "FEEDER-A",
        "capacity_kw": 100.0,
        "current_load_kw": 96.0,
        "available_headroom_kw": 4.0,
        "utilization_pct": 96.0,
        "congestion_level": "CRITICAL",
        "trade_decision": "TRADE_REJECTED",
        "discom_safety_rule": "Overload protection triggered",
        "substation_status": "CONGESTED",
    }

    with patch.object(db_repository, "get_grid_state", return_value=congested_state):
        res = await create_buy_order(
            user_id="H011",
            quantity_kwh=5.0,
            max_price=7.00
        )
        assert res["status"] == "ERROR"
        assert res["error_code"] == "GRID_CONGESTION_REJECTION"
        assert "congested" in res["message"].lower() or "blocked" in res["message"].lower()


def test_pii_and_kyc_masking():
    """Ensure sensitive KYC and personal identifiers are purged from tool outputs."""
    raw_payload = {
        "meter_id": "H001",
        "customer_name": "Ramesh Sharma",
        "aadhaar": "XXXX-XXXX-1234",
        "bank_account": "SBIN00012345678",
        "email": "ramesh@example.com",
        "solar_generation_kw": 2.8,
        "nested": {
            "pan_number": "ABCDE1234F",
            "net_power_kw": 1.5
        }
    }

    sanitized = mask_sensitive_info(raw_payload)
    assert "customer_name" not in sanitized
    assert "aadhaar" not in sanitized
    assert "bank_account" not in sanitized
    assert "email" not in sanitized
    assert "pan_number" not in sanitized["nested"]
    assert sanitized["solar_generation_kw"] == 2.8
    assert sanitized["nested"]["net_power_kw"] == 1.5
