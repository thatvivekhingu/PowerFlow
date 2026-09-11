"""
Marketplace & Order Trading Tools for POWERFLOW MCP Server.
Provides read-only market discovery and state-changing order creation with strict grid checks.
"""

from typing import Any, Optional
from powerflow_mcp.schemas import (
    FeederQuery,
    TradeQuery,
    CreateBuyOrderRequest,
    CreateSellOrderRequest,
    MarketPriceResponse,
    OpenOrdersResponse,
    OrderCreatedResponse,
    TradeStatusResponse,
)
from powerflow_mcp.services.market_service import market_service
from powerflow_mcp.services.settlement_service import settlement_service
from powerflow_mcp.security import mask_sensitive_info
from powerflow_mcp.errors import PowerFlowMCPError


# ─────────────────────────────────────────────────────────────────────────────
#  READ-ONLY TOOLS
# ─────────────────────────────────────────────────────────────────────────────

async def get_market_price(feeder_id: str) -> dict[str, Any]:
    """
    Get the current local P2P energy market clearing price for a distribution feeder.

    Args:
        feeder_id: Distribution feeder identifier (e.g. 'FEEDER-A', 'FEEDER-B')

    Returns:
        Structured breakdown containing indicative price INR/kWh, regulatory price floor/cap,
        local demand/supply ratio, and DISCOM wheeling charge.
    """
    try:
        query = FeederQuery(feeder_id=feeder_id)
        price_data = await market_service.get_market_price(query.feeder_id)
        response = MarketPriceResponse(**price_data)
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "MARKET_PRICE_FAILED", "message": str(e)}


async def get_open_orders(feeder_id: Optional[str] = None) -> dict[str, Any]:
    """
    Retrieve currently open buy and sell bids in the P2P energy marketplace orderbook.

    Args:
        feeder_id: Optional feeder filter (e.g. 'FEEDER-A'). If omitted, returns across all feeders.

    Returns:
        Structured listing of active bids, ask prices, total requested buy kWh, and total offered sell kWh.
    """
    try:
        clean_feeder = feeder_id.strip().upper() if feeder_id else None
        orders_data = await market_service.get_open_orders(clean_feeder)
        response = OpenOrdersResponse(**orders_data)
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "OPEN_ORDERS_FAILED", "message": str(e)}


async def get_trade_status(trade_id: str) -> dict[str, Any]:
    """
    Query the real-time execution status of a matched P2P energy trade.

    Args:
        trade_id: Unique trade identifier (e.g. 'TRD-2026-0001')

    Returns:
        Structured status containing traded energy volume, clearing price, DISCOM wheeling fee, and delivery status.
    """
    try:
        query = TradeQuery(trade_id=trade_id)
        status_data = await settlement_service.get_trade_status(query.trade_id)
        response = TradeStatusResponse(**status_data)
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "TRADE_STATUS_FAILED", "message": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
#  STATE-CHANGING TOOLS (Strict safety & validation required)
# ─────────────────────────────────────────────────────────────────────────────

async def create_buy_order(
    user_id: str,
    quantity_kwh: float,
    max_price: float,
    meter_id: Optional[str] = None
) -> dict[str, Any]:
    """
    Submit an explicit buy order to purchase renewable energy from the P2P marketplace.
    [STATE-CHANGING OPERATION: Only invoke when the user explicitly requests an energy purchase.]

    Args:
        user_id: ID of the registered consumer or prosumer placing the order (e.g., 'H011')
        quantity_kwh: Quantity of electricity to purchase in kilowatt-hours (kWh)
        max_price: Maximum price willing to pay in INR/kWh (must be within regulatory bounds ₹3.00 - ₹15.00)
        meter_id: Optional smart meter ID. Defaults to user_id if omitted.

    Returns:
        Structured order confirmation including order_id, grid validation status, and audit hash.
    """
    try:
        req = CreateBuyOrderRequest(
            user_id=user_id,
            quantity_kwh=quantity_kwh,
            max_price=max_price,
            meter_id=meter_id
        )
        result = await market_service.create_buy_order(
            user_id=req.user_id,
            quantity_kwh=req.quantity_kwh,
            max_price=req.max_price,
            meter_id=req.meter_id
        )
        response = OrderCreatedResponse(**result)
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "BUY_ORDER_REJECTED", "message": str(e)}


async def create_sell_order(
    user_id: str,
    quantity_kwh: float,
    min_price: float,
    meter_id: Optional[str] = None
) -> dict[str, Any]:
    """
    Submit an explicit sell order to trade surplus solar energy on the P2P marketplace.
    [STATE-CHANGING OPERATION: Only invoke when the user explicitly requests to sell energy.]

    Args:
        user_id: ID of the registered prosumer offering surplus solar power (e.g., 'H001')
        quantity_kwh: Quantity of electricity to sell in kilowatt-hours (kWh)
        min_price: Minimum price willing to accept in INR/kWh (must be within regulatory bounds ₹3.00 - ₹10.00)
        meter_id: Optional smart meter ID. Defaults to user_id if omitted.

    Returns:
        Structured order confirmation including order_id, grid validation status, and audit hash.
    """
    try:
        req = CreateSellOrderRequest(
            user_id=user_id,
            quantity_kwh=quantity_kwh,
            min_price=min_price,
            meter_id=meter_id
        )
        result = await market_service.create_sell_order(
            user_id=req.user_id,
            quantity_kwh=req.quantity_kwh,
            min_price=req.min_price,
            meter_id=req.meter_id
        )
        response = OrderCreatedResponse(**result)
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "SELL_ORDER_REJECTED", "message": str(e)}
