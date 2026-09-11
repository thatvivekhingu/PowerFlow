"""
Tool Interface Layer for POWERFLOW LangGraph Agent.
Provides a standardized dispatcher bridging LangGraph nodes directly to POWERFLOW MCP tools.
"""

import logging
from typing import Any
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

logger = logging.getLogger("powerflow.agent.tools")

TOOL_MAP = {
    "get_meter_reading": get_meter_reading,
    "get_demand_forecast": get_demand_forecast,
    "get_solar_forecast": get_solar_forecast,
    "get_grid_status": get_grid_status,
    "get_market_price": get_market_price,
    "get_available_surplus": get_available_surplus,
    "get_open_orders": get_open_orders,
    "create_buy_order": create_buy_order,
    "create_sell_order": create_sell_order,
    "get_trade_status": get_trade_status,
    "get_settlement_status": get_settlement_status,
}


async def dispatch_tool(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
    """
    Execute a POWERFLOW tool by name with arguments.
    Catches any runtime error and returns a clean, structured error dict instead of crashing.
    """
    if tool_name not in TOOL_MAP:
        logger.error(f"Unknown tool requested: {tool_name}")
        return {
            "status": "ERROR",
            "error_code": "TOOL_NOT_FOUND",
            "message": f"Requested tool '{tool_name}' is not in the POWERFLOW tool registry."
        }

    func = TOOL_MAP[tool_name]
    logger.info(f"Executing tool '{tool_name}' with args: {args}")

    try:
        result = await func(**args)
        return result
    except TypeError as e:
        logger.error(f"Invalid tool arguments for '{tool_name}': {e}")
        return {
            "status": "ERROR",
            "error_code": "INVALID_TOOL_ARGUMENTS",
            "message": f"Arguments passed to '{tool_name}' were malformed: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Execution error in tool '{tool_name}': {e}")
        return {
            "status": "ERROR",
            "error_code": "TOOL_EXECUTION_FAILED",
            "message": f"Failed while executing '{tool_name}': {str(e)}"
        }