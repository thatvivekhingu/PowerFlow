"""
Database Repository for POWERFLOW MCP Server.
Provides typed access to meter readings, grid state, orderbook, trades, and settlements.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from powerflow_mcp.db.session import db_manager
from powerflow_mcp.errors import MeterNotFoundError, FeederNotFoundError, TradeNotFoundError

logger = logging.getLogger("powerflow.mcp.repo")

# Static household registry calibrated to POWERFLOW simulation
HOUSEHOLDS = {
    "H001": {"type": "prosumer", "panel_kw": 3.5, "base_load_kw": 0.15, "feeder": "FEEDER-A"},
    "H002": {"type": "prosumer", "panel_kw": 4.0, "base_load_kw": 0.18, "feeder": "FEEDER-A"},
    "H003": {"type": "prosumer", "panel_kw": 2.8, "base_load_kw": 0.12, "feeder": "FEEDER-A"},
    "H004": {"type": "prosumer", "panel_kw": 5.0, "base_load_kw": 0.22, "feeder": "FEEDER-A"},
    "H005": {"type": "prosumer", "panel_kw": 3.2, "base_load_kw": 0.14, "feeder": "FEEDER-A"},
    "H006": {"type": "prosumer", "panel_kw": 4.5, "base_load_kw": 0.20, "feeder": "FEEDER-B"},
    "H007": {"type": "prosumer", "panel_kw": 3.0, "base_load_kw": 0.16, "feeder": "FEEDER-B"},
    "H008": {"type": "prosumer", "panel_kw": 6.0, "base_load_kw": 0.25, "feeder": "FEEDER-B"},
    "H009": {"type": "prosumer", "panel_kw": 2.5, "base_load_kw": 0.13, "feeder": "FEEDER-B"},
    "H010": {"type": "prosumer", "panel_kw": 3.8, "base_load_kw": 0.17, "feeder": "FEEDER-B"},
    "H011": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.20, "feeder": "FEEDER-A"},
    "H012": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.25, "feeder": "FEEDER-A"},
    "H013": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.18, "feeder": "FEEDER-A"},
    "H014": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.30, "feeder": "FEEDER-A"},
    "H015": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.22, "feeder": "FEEDER-B"},
    "H016": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.19, "feeder": "FEEDER-B"},
    "H017": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.28, "feeder": "FEEDER-B"},
    "H018": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.24, "feeder": "FEEDER-B"},
    "H019": {"type": "prosumer", "panel_kw": 4.2, "base_load_kw": 0.19, "feeder": "FEEDER-C"},
    "H020": {"type": "prosumer", "panel_kw": 3.6, "base_load_kw": 0.16, "feeder": "FEEDER-C"},
    "H021": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.21, "feeder": "FEEDER-C"},
    "H022": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.26, "feeder": "FEEDER-C"},
    "H023": {"type": "prosumer", "panel_kw": 5.5, "base_load_kw": 0.23, "feeder": "FEEDER-C"},
    "H024": {"type": "consumer", "panel_kw": 0.0, "base_load_kw": 0.17, "feeder": "FEEDER-C"},
    "H025": {"type": "prosumer", "panel_kw": 3.0, "base_load_kw": 0.14, "feeder": "FEEDER-C"},
}

FEEDER_CAPACITIES = {
    "FEEDER-A": 100.0,
    "FEEDER-B": 80.0,
    "FEEDER-C": 60.0,
}


class Repository:
    """Repository handling all database operations."""

    def __init__(self):
        self._in_memory_orders: list[dict[str, Any]] = []
        self._in_memory_trades: dict[str, dict[str, Any]] = {}
        self._in_memory_settlements: dict[str, dict[str, Any]] = {}
        self._seed_sample_trades()

    def _seed_sample_trades(self):
        """Seed initial realistic trades and settlement entries for testing."""
        t1 = {
            "trade_id": "TRD-2026-0001",
            "seller_meter_id": "H001",
            "buyer_meter_id": "H011",
            "feeder_id": "FEEDER-A",
            "traded_quantity_kwh": 2.0,
            "clearing_price_inr_per_kwh": 5.50,
            "gross_amount_inr": 11.00,
            "discom_wheeling_charge_inr": 0.50,
            "net_seller_payout_inr": 10.50,
            "trade_timestamp": "2026-09-12T11:15:00",
            "status": "COMPLETED",
        }
        self._in_memory_trades[t1["trade_id"]] = t1

        self._in_memory_settlements[t1["trade_id"]] = {
            "trade_id": t1["trade_id"],
            "settlement_id": "SETTL-2026-0001",
            "buyer_id": "H011",
            "seller_id": "H001",
            "feeder_id": "FEEDER-A",
            "quantity_kwh": 2.0,
            "energy_cost_inr": 11.00,
            "discom_grid_fee_inr": 0.50,
            "total_settled_inr": 11.50,
            "payment_status": "DISBURSED",
            "meter_verified": True,
            "audit_signature": "0x4a9b2c8e1f03d57a",
            "settlement_completed_at": "2026-09-12T11:30:00",
        }

    async def get_household(self, meter_id: str) -> dict[str, Any]:
        """Fetch household metadata by meter ID."""
        meter_id = meter_id.upper()
        if meter_id in HOUSEHOLDS:
            info = dict(HOUSEHOLDS[meter_id])
            info["meter_id"] = meter_id
            return info
        raise MeterNotFoundError(meter_id)

    async def get_latest_meter_reading(self, meter_id: str) -> dict[str, Any]:
        """Fetch latest meter reading for a smart meter."""
        hh = await self.get_household(meter_id)
        
        # Search mock DB for the latest record
        readings = db_manager.mock_data.get("meter_readings", [])
        matched = [r for r in readings if r.get("household_id") == meter_id]
        
        if matched:
            latest = matched[-1]
            return {
                "meter_id": meter_id,
                "feeder_id": latest.get("feeder_id", hh["feeder"]),
                "household_type": latest.get("household_type", hh["type"]),
                "solar_generation_kw": round(latest.get("solar_gen_kwh", 0.0) * 4, 3), # 15-min to kW
                "current_load_kw": round(latest.get("load_kwh", 0.0) * 4, 3),
                "net_power_kw": round(latest.get("net_kwh", 0.0) * 4, 3),
                "surplus_kwh": latest.get("surplus_kwh", 0.0),
                "demand_kwh": latest.get("demand_kwh", 0.0),
                "panel_capacity_kw": latest.get("panel_kw", hh["panel_kw"]),
                "reading_timestamp": latest.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "grid_decision": latest.get("grid_decision", "TRADE_ALLOWED"),
            }
        
        # Default active reading synthesis if meter is valid but no row in sample
        solar_gen = hh["panel_kw"] * 0.4 if hh["type"] == "prosumer" else 0.0
        load = hh["base_load_kw"] * 1.5
        surplus = max(0.0, solar_gen - load) * 0.25
        demand = max(0.0, load - solar_gen) * 0.25
        return {
            "meter_id": meter_id,
            "feeder_id": hh["feeder"],
            "household_type": hh["type"],
            "solar_generation_kw": round(solar_gen, 3),
            "current_load_kw": round(load, 3),
            "net_power_kw": round(solar_gen - load, 3),
            "surplus_kwh": round(surplus, 4),
            "demand_kwh": round(demand, 4),
            "panel_capacity_kw": hh["panel_kw"],
            "reading_timestamp": datetime.now(timezone.utc).isoformat(),
            "grid_decision": "TRADE_ALLOWED",
        }

    async def get_grid_state(self, feeder_id: str) -> dict[str, Any]:
        """Fetch electrical grid status for a feeder."""
        feeder_id = feeder_id.upper()
        if feeder_id not in FEEDER_CAPACITIES:
            raise FeederNotFoundError(feeder_id)

        capacity = FEEDER_CAPACITIES[feeder_id]
        
        # Look up in mock DB grid states
        states = db_manager.mock_data.get("grid_states", [])
        matched = [s for s in states if s.get("feeder_id") == feeder_id]
        
        if matched:
            latest = matched[-1]
            load = latest.get("load_kw", capacity * 0.25)
            headroom = latest.get("headroom_kw", capacity - load)
            util_pct = latest.get("utilization_pct", (load / capacity) * 100)
            congestion = latest.get("congestion_level", "LOW")
            decision = latest.get("trade_decision", "TRADE_ALLOWED")
        else:
            load = capacity * 0.35
            headroom = capacity - load
            util_pct = (load / capacity) * 100
            congestion = "LOW"
            decision = "TRADE_ALLOWED"

        return {
            "feeder_id": feeder_id,
            "capacity_kw": capacity,
            "current_load_kw": round(load, 2),
            "available_headroom_kw": round(headroom, 2),
            "utilization_pct": round(util_pct, 1),
            "congestion_level": congestion,
            "trade_decision": decision,
            "discom_safety_rule": "Enforcing IEEE 1547 / CEA Technical Standards for Grid Connectivity",
            "substation_status": "NORMAL_OPERATION",
        }

    async def get_open_orders(self, feeder_id: Optional[str] = None) -> list[dict[str, Any]]:
        """Retrieve open buy and sell orders, optionally filtered by feeder."""
        # Combine mock DB initial orders + in-memory new orders
        all_orders = []
        
        # Take active sample from mock DB
        for o in db_manager.mock_data.get("buy_orders", [])[:50]:
            all_orders.append({
                "order_id": o["order_id"],
                "user_id": o["household_id"],
                "feeder_id": o["feeder_id"],
                "side": "BUY",
                "quantity_kwh": o["quantity_kwh"],
                "price_inr": o.get("max_price_inr", 5.5),
                "created_at": o.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "status": o.get("status", "OPEN"),
            })
            
        for o in db_manager.mock_data.get("sell_orders", [])[:50]:
            all_orders.append({
                "order_id": o["order_id"],
                "user_id": o["household_id"],
                "feeder_id": o["feeder_id"],
                "side": "SELL",
                "quantity_kwh": o["quantity_kwh"],
                "price_inr": o.get("min_price_inr", 4.8),
                "created_at": o.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "status": o.get("status", "OPEN"),
            })

        # Include dynamically placed orders
        all_orders.extend(self._in_memory_orders)

        if feeder_id:
            feeder_clean = feeder_id.upper()
            all_orders = [o for o in all_orders if o["feeder_id"] == feeder_clean]

        return all_orders

    async def save_order(self, order: dict[str, Any]) -> dict[str, Any]:
        """Save a new buy or sell order into the registry."""
        self._in_memory_orders.append(order)
        return order

    async def get_trade(self, trade_id: str) -> dict[str, Any]:
        """Retrieve trade information by ID."""
        trade_id = trade_id.upper()
        if trade_id in self._in_memory_trades:
            return self._in_memory_trades[trade_id]
        raise TradeNotFoundError(trade_id)

    async def get_settlement(self, trade_id: str) -> dict[str, Any]:
        """Retrieve settlement information for a trade ID."""
        trade_id = trade_id.upper()
        if trade_id in self._in_memory_settlements:
            return self._in_memory_settlements[trade_id]
        raise TradeNotFoundError(trade_id)


db_repository = Repository()
