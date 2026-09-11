"""
Unit and Integration Tests for POWERFLOW MCP Tools.
Verifies all 11 MCP tools return valid structured responses according to schemas.
"""

import pytest
from powerflow_mcp.tools.meter_tools import get_meter_reading, get_available_surplus
from powerflow_mcp.tools.forecast_tools import get_demand_forecast, get_solar_forecast
from powerflow_mcp.tools.grid_tools import get_grid_status
from powerflow_mcp.tools.market_tools import (
    get_market_price,
    get_open_orders,
    get_trade_status,
    create_buy_order,
    create_sell_order,
)
from powerflow_mcp.tools.settlement_tools import get_settlement_status


@pytest.mark.asyncio
async def test_get_meter_reading_prosumer():
    """Test reading telemetry for a solar prosumer meter."""
    res = await get_meter_reading("H001")
    assert res["status"] == "SUCCESS"
    assert res["meter_id"] == "H001"
    assert res["household_type"] == "prosumer"
    assert "feeder_id" in res
    assert "solar_generation_kw" in res
    assert "current_load_kw" in res
    assert "net_power_kw" in res
    assert res["panel_capacity_kw"] > 0


@pytest.mark.asyncio
async def test_get_meter_reading_consumer():
    """Test reading telemetry for a consumer without solar."""
    res = await get_meter_reading("H011")
    assert res["status"] == "SUCCESS"
    assert res["meter_id"] == "H011"
    assert res["household_type"] == "consumer"
    assert res["solar_generation_kw"] == 0.0


@pytest.mark.asyncio
async def test_get_demand_forecast():
    """Test demand forecast returns structured forecast horizon and confidence bounds."""
    res = await get_demand_forecast("H011", horizon_hours=24)
    assert res["status"] == "SUCCESS"
    assert res["meter_id"] == "H011"
    assert res["forecast_horizon_hours"] == 24
    assert res["predicted_demand_kwh"] > 0
    assert res["confidence_interval_lower_kwh"] <= res["predicted_demand_kwh"]
    assert res["confidence_interval_upper_kwh"] >= res["predicted_demand_kwh"]
    assert "model_version" in res
    assert "forecast_generated_at" in res


@pytest.mark.asyncio
async def test_get_solar_forecast():
    """Test solar forecast for prosumer."""
    res = await get_solar_forecast("H001", horizon_hours=24)
    assert res["status"] == "SUCCESS"
    assert res["meter_id"] == "H001"
    assert res["panel_capacity_kw"] > 0
    assert res["predicted_solar_generation_kwh"] > 0
    assert res["expected_surplus_kwh"] >= 0
    assert "model_version" in res


@pytest.mark.asyncio
async def test_get_grid_status():
    """Test electrical grid status and DISCOM headroom."""
    res = await get_grid_status("FEEDER-A")
    assert res["status"] == "SUCCESS"
    assert res["feeder_id"] == "FEEDER-A"
    assert res["capacity_kw"] == 100.0
    assert res["available_headroom_kw"] > 0
    assert res["congestion_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert res["trade_decision"] in ["TRADE_ALLOWED", "TRADE_LIMITED", "TRADE_REJECTED"]


@pytest.mark.asyncio
async def test_get_market_price():
    """Test dynamic pricing calculation."""
    res = await get_market_price("FEEDER-A")
    assert res["status"] == "SUCCESS"
    assert res["feeder_id"] == "FEEDER-A"
    assert 3.0 <= res["indicative_price_inr_per_kwh"] <= 8.0
    assert res["price_floor_inr_per_kwh"] == 3.0
    assert res["price_cap_inr_per_kwh"] == 8.0
    assert "discom_wheeling_charge_inr" in res


@pytest.mark.asyncio
async def test_get_available_surplus():
    """Test exportable surplus calculation."""
    res = await get_available_surplus("H001")
    assert res["status"] == "SUCCESS"
    assert res["meter_id"] == "H001"
    assert "net_exportable_surplus_kwh" in res
    assert "eligible_for_p2p_trade" in res


@pytest.mark.asyncio
async def test_get_open_orders():
    """Test orderbook query."""
    res = await get_open_orders("FEEDER-A")
    assert res["status"] == "SUCCESS"
    assert res["feeder_id"] == "FEEDER-A"
    assert "total_open_orders" in res
    assert isinstance(res["orders"], list)


@pytest.mark.asyncio
async def test_create_buy_order_success():
    """Test creating a valid buy order."""
    res = await create_buy_order(
        user_id="H011",
        quantity_kwh=2.5,
        max_price=6.50
    )
    assert res["status"] == "SUCCESS"
    assert res["side"] == "BUY"
    assert res["quantity_kwh"] == 2.5
    assert res["price_inr"] == 6.50
    assert res["grid_validation_status"] == "PASSED_GRID_HEADROOM_CHECK"
    assert "order_id" in res
    assert "audit_hash" in res


@pytest.mark.asyncio
async def test_create_sell_order_success():
    """Test creating a valid sell order by a prosumer."""
    res = await create_sell_order(
        user_id="H001",
        quantity_kwh=3.0,
        min_price=4.50
    )
    assert res["status"] == "SUCCESS"
    assert res["side"] == "SELL"
    assert res["quantity_kwh"] == 3.0
    assert res["price_inr"] == 4.50
    assert "order_id" in res
    assert "audit_hash" in res


@pytest.mark.asyncio
async def test_get_trade_and_settlement_status():
    """Test querying pre-seeded matched trade and its settlement reconciliation."""
    trade_res = await get_trade_status("TRD-2026-0001")
    assert trade_res["status"] == "SUCCESS"
    assert trade_res["trade_id"] == "TRD-2026-0001"
    assert trade_res["traded_quantity_kwh"] == 2.0

    settle_res = await get_settlement_status("TRD-2026-0001")
    assert settle_res["status"] == "SUCCESS"
    assert settle_res["trade_id"] == "TRD-2026-0001"
    assert settle_res["payment_status"] == "DISBURSED"
    assert settle_res["meter_verified"] is True
