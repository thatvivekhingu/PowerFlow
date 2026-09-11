"""
Grid Telemetry & DISCOM Status Tools for POWERFLOW MCP.
Exposes electrical distribution grid capacity, headroom, and trade safety constraints.
"""

from typing import Any
from powerflow_mcp.schemas import FeederQuery, GridStatusResponse
from powerflow_mcp.services.grid_service import grid_service
from powerflow_mcp.security import mask_sensitive_info
from powerflow_mcp.errors import PowerFlowMCPError


async def get_grid_status(feeder_id: str) -> dict[str, Any]:
    """
    Retrieve electrical distribution grid status, capacity, and headroom for a feeder.

    Args:
        feeder_id: Feeder identifier (e.g. 'FEEDER-A', 'FEEDER-B', 'FEEDER-C')

    Returns:
        Structured report including capacity kW, active load kW, headroom kW, utilization %,
        congestion level, and whether P2P energy trading is permitted or restricted by DISCOM.
    """
    try:
        query = FeederQuery(feeder_id=feeder_id)
        status = await grid_service.get_feeder_status(query.feeder_id)
        response = GridStatusResponse(**status)
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "GRID_STATUS_FAILED", "message": str(e)}
