"""
Marketplace Service for POWERFLOW MCP Server.
Handles dynamic pricing, order validation, DISCOM price bounds, and order placement.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional
import numpy as np

from powerflow_mcp.config import settings
from powerflow_mcp.db.repository import db_repository
from powerflow_mcp.errors import InvalidOrderError, MeterNotFoundError
from powerflow_mcp.services.grid_service import grid_service
from powerflow_mcp.audit import log_audit_event

logger = logging.getLogger("powerflow.mcp.market")


class MarketService:
    """Service managing P2P marketplace operations, pricing, and orderbook."""

    async def get_market_price(self, feeder_id: str) -> dict[str, Any]:
        """
        Compute real-time bounded dynamic price for a feeder based on local supply and demand.
        P = P_base + alpha*DemandIdx - beta*SupplyIdx + congestion_term
        """
        grid_state = await db_repository.get_grid_state(feeder_id)
        open_orders = await db_repository.get_open_orders(feeder_id)

        total_buy_kwh = sum(o["quantity_kwh"] for o in open_orders if o["side"] == "BUY")
        total_sell_kwh = sum(o["quantity_kwh"] for o in open_orders if o["side"] == "SELL")

        # Demand and supply indices
        demand_idx = min(total_buy_kwh / max(total_sell_kwh, 0.001), 1.0)
        supply_idx = min(total_sell_kwh / max(total_buy_kwh, 0.001), 1.0)
        
        # Congestion factor from grid utilization
        util_pct = grid_state["utilization_pct"] / 100.0
        congestion_term = 0.5 * util_pct

        raw_price = (
            settings.P_BASE_INR
            + settings.PRICE_ALPHA * demand_idx
            - settings.PRICE_BETA * supply_idx
            + congestion_term
        )
        final_price = float(np.clip(raw_price, settings.P_MIN_INR, settings.P_MAX_INR))

        ratio = total_buy_kwh / max(total_sell_kwh, 0.001)

        return {
            "status": "SUCCESS",
            "feeder_id": feeder_id,
            "indicative_price_inr_per_kwh": round(final_price, 2),
            "base_price_inr_per_kwh": settings.P_BASE_INR,
            "price_floor_inr_per_kwh": settings.P_MIN_INR,
            "price_cap_inr_per_kwh": settings.P_MAX_INR,
            "demand_supply_ratio": round(ratio, 2),
            "discom_wheeling_charge_inr": settings.DISCOM_WHEELING_RATE_INR_PER_KWH,
            "market_interval": "15_MIN_ROLLING_AUCTION",
            "pricing_model": "BOUNDED_DYNAMIC_SENSITIVITY",
        }

    async def get_open_orders(self, feeder_id: Optional[str] = None) -> dict[str, Any]:
        """Fetch all currently open buy and sell orders."""
        orders = await db_repository.get_open_orders(feeder_id)
        total_buy = sum(o["quantity_kwh"] for o in orders if o["side"] == "BUY")
        total_sell = sum(o["quantity_kwh"] for o in orders if o["side"] == "SELL")

        return {
            "status": "SUCCESS",
            "feeder_id": feeder_id,
            "total_open_orders": len(orders),
            "total_buy_kwh": round(total_buy, 4),
            "total_sell_kwh": round(total_sell, 4),
            "orders": orders[:25],  # Return up to 25 items for token efficiency
        }

    async def create_buy_order(
        self,
        user_id: str,
        quantity_kwh: float,
        max_price: float,
        meter_id: Optional[str] = None
    ) -> dict[str, Any]:
        """
        Validate and submit a buy order to the P2P marketplace.
        """
        target_meter = (meter_id or user_id).upper()
        hh = await db_repository.get_household(target_meter)
        feeder_id = hh["feeder"]

        # 1. Grid condition safety check
        await grid_service.validate_trade_allowed(feeder_id, additional_load_kw=quantity_kwh * 4)

        # 2. Business validation
        if quantity_kwh < settings.MIN_ORDER_KWH or quantity_kwh > settings.MAX_ORDER_KWH:
            raise InvalidOrderError(
                f"Order quantity {quantity_kwh} kWh is out of allowed range [{settings.MIN_ORDER_KWH}, {settings.MAX_ORDER_KWH}] kWh."
            )
        if max_price < settings.P_MIN_INR or max_price > 15.0:
            raise InvalidOrderError(
                f"Max price ₹{max_price} is out of permitted range [₹{settings.P_MIN_INR}, ₹15.00] / kWh."
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        order_id = f"BUY-{target_meter}-{int(datetime.now().timestamp())}"

        order_dict = {
            "order_id": order_id,
            "user_id": user_id,
            "meter_id": target_meter,
            "feeder_id": feeder_id,
            "side": "BUY",
            "quantity_kwh": quantity_kwh,
            "price_inr": max_price,
            "market_interval": "15-MIN-P2P",
            "created_at": now_iso,
            "status": "OPEN",
        }

        await db_repository.save_order(order_dict)

        # Audit log state mutation
        audit = log_audit_event(
            action="CREATE_BUY_ORDER",
            actor_id=user_id,
            tool_name="create_buy_order",
            payload=order_dict,
            status="SUCCESS",
            notes=f"Buy order placed for {quantity_kwh} kWh on {feeder_id}"
        )

        return {
            "status": "SUCCESS",
            "order_id": order_id,
            "user_id": user_id,
            "meter_id": target_meter,
            "feeder_id": feeder_id,
            "side": "BUY",
            "quantity_kwh": quantity_kwh,
            "price_inr": max_price,
            "market_interval": "15-MIN-P2P",
            "grid_validation_status": "PASSED_GRID_HEADROOM_CHECK",
            "audit_hash": audit["record_hash"],
            "message": f"Buy order {order_id} successfully validated and registered on {feeder_id}.",
        }

    async def create_sell_order(
        self,
        user_id: str,
        quantity_kwh: float,
        min_price: float,
        meter_id: Optional[str] = None
    ) -> dict[str, Any]:
        """
        Validate and submit a sell order for renewable energy surplus.
        """
        target_meter = (meter_id or user_id).upper()
        hh = await db_repository.get_household(target_meter)
        feeder_id = hh["feeder"]

        # 1. Role verification: seller must be a prosumer with generation capacity
        if hh["type"] != "prosumer" or hh["panel_kw"] <= 0:
            raise InvalidOrderError(
                f"User '{user_id}' (Meter: {target_meter}) is registered as a '{hh['type']}' with no solar generation capacity. Only prosumers can create sell orders."
            )

        # 2. Grid condition safety check
        await grid_service.validate_trade_allowed(feeder_id)

        # 3. Business validation
        if quantity_kwh < settings.MIN_ORDER_KWH or quantity_kwh > settings.MAX_ORDER_KWH:
            raise InvalidOrderError(
                f"Order quantity {quantity_kwh} kWh is out of allowed range [{settings.MIN_ORDER_KWH}, {settings.MAX_ORDER_KWH}] kWh."
            )
        if min_price < settings.P_MIN_INR or min_price > settings.P_MAX_INR + 2.0:
            raise InvalidOrderError(
                f"Min price ₹{min_price} is out of permitted range [₹{settings.P_MIN_INR}, ₹{settings.P_MAX_INR + 2.0}] / kWh."
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        order_id = f"SELL-{target_meter}-{int(datetime.now().timestamp())}"

        order_dict = {
            "order_id": order_id,
            "user_id": user_id,
            "meter_id": target_meter,
            "feeder_id": feeder_id,
            "side": "SELL",
            "quantity_kwh": quantity_kwh,
            "price_inr": min_price,
            "market_interval": "15-MIN-P2P",
            "created_at": now_iso,
            "status": "OPEN",
        }

        await db_repository.save_order(order_dict)

        # Audit log state mutation
        audit = log_audit_event(
            action="CREATE_SELL_ORDER",
            actor_id=user_id,
            tool_name="create_sell_order",
            payload=order_dict,
            status="SUCCESS",
            notes=f"Sell order placed for {quantity_kwh} kWh on {feeder_id}"
        )

        return {
            "status": "SUCCESS",
            "order_id": order_id,
            "user_id": user_id,
            "meter_id": target_meter,
            "feeder_id": feeder_id,
            "side": "SELL",
            "quantity_kwh": quantity_kwh,
            "price_inr": min_price,
            "market_interval": "15-MIN-P2P",
            "grid_validation_status": "PASSED_GRID_HEADROOM_CHECK",
            "audit_hash": audit["record_hash"],
            "message": f"Sell order {order_id} successfully validated and registered on {feeder_id}.",
        }


market_service = MarketService()
