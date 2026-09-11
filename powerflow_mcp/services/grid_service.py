"""
Grid State & DISCOM Safety Service.
Monitors feeder capacity, calculates congestion, and validates physical electrical safety boundaries.
NOTE: This service strictly reads and validates simulation/backend states; it does NOT control physical grid switches.
"""

import logging
from typing import Any
from powerflow_mcp.config import settings
from powerflow_mcp.db.repository import db_repository
from powerflow_mcp.errors import GridCongestionError, FeederNotFoundError

logger = logging.getLogger("powerflow.mcp.grid")


class GridService:
    """Service evaluating distribution feeder health and DISCOM regulatory safety rules."""

    async def get_feeder_status(self, feeder_id: str) -> dict[str, Any]:
        """Fetch real-time grid metrics and congestion level for a feeder."""
        state = await db_repository.get_grid_state(feeder_id)
        return {
            "status": "SUCCESS",
            "feeder_id": state["feeder_id"],
            "capacity_kw": state["capacity_kw"],
            "current_load_kw": state["current_load_kw"],
            "available_headroom_kw": state["available_headroom_kw"],
            "utilization_pct": state["utilization_pct"],
            "congestion_level": state["congestion_level"],
            "trade_decision": state["trade_decision"],
            "discom_safety_rule": state["discom_safety_rule"],
            "substation_status": state["substation_status"],
        }

    async def validate_trade_allowed(self, feeder_id: str, additional_load_kw: float = 0.0) -> bool:
        """
        Validate whether grid conditions permit placing orders or matching trades.
        Raises GridCongestionError if feeder is congested.
        """
        state = await db_repository.get_grid_state(feeder_id)
        utilization = state["utilization_pct"]
        trade_decision = state["trade_decision"]

        if trade_decision == "TRADE_REJECTED" or utilization >= settings.CRITICAL_UTILIZATION_LIMIT_PCT:
            logger.warning(f"Grid safety rule triggered on {feeder_id}: utilization={utilization:.1f}%")
            raise GridCongestionError(
                feeder_id=feeder_id,
                utilization_pct=utilization,
                message=f"P2P trading blocked by DISCOM on {feeder_id}: feeder operating near capacity ({utilization:.1f}%)."
            )

        return True


grid_service = GridService()
