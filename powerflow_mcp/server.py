"""
POWERFLOW Model Context Protocol (MCP) Server.
Production-ready MCP server for DISCOM-compatible, grid-aware renewable energy P2P trading.
"""

import sys
import logging
import argparse
import asyncio
from typing import Optional, Any

try:
    from mcp.server.mcpserver import MCPServer
except ImportError:
    from mcp.server.fastmcp import FastMCP as MCPServer

from powerflow_mcp.config import settings
from powerflow_mcp.db.session import db_manager
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

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)]  # Keep stdout free for MCP stdio protocol
)
logger = logging.getLogger("powerflow.mcp.server")

# Initialize MCP Server
mcp_server = MCPServer(
    name=settings.SERVER_NAME,
    instructions=(
        "POWERFLOW MCP Tool Layer for DISCOM-compatible, grid-aware renewable energy P2P trading. "
        "Exposes read-only telemetry, ML forecasts, and strictly validated digital trading operations. "
        "Does NOT provide direct control over physical electrical actuators."
    )
)


# ─────────────────────────────────────────────────────────────────────────────
#  REGISTER TOOLS WITH DETAILED SCHEMAS & DOCSTRINGS
# ─────────────────────────────────────────────────────────────────────────────

@mcp_server.tool(
    name="get_meter_reading",
    description="Retrieve real-time electricity smart-meter telemetry for a given meter ID (e.g. 'H001', 'H011'). Returns generation, load, net kW, and feeder ID."
)
async def tool_get_meter_reading(meter_id: str) -> dict[str, Any]:
    return await get_meter_reading(meter_id)


@mcp_server.tool(
    name="get_demand_forecast",
    description="Generate an ML-driven electricity demand forecast for a consumer or prosumer smart meter. Returns predicted kWh, confidence intervals, peak hour, model version, and timestamp."
)
async def tool_get_demand_forecast(meter_id: str, horizon_hours: int = 24) -> dict[str, Any]:
    return await get_demand_forecast(meter_id, horizon_hours)


@mcp_server.tool(
    name="get_solar_forecast",
    description="Generate a solar PV generation and exportable surplus forecast for a prosumer meter over a horizon (hours). Returns expected kWh, irradiance, and model version."
)
async def tool_get_solar_forecast(meter_id: str, horizon_hours: int = 24) -> dict[str, Any]:
    return await get_solar_forecast(meter_id, horizon_hours)


@mcp_server.tool(
    name="get_grid_status",
    description="Retrieve electrical distribution grid status, capacity, and headroom for a feeder (e.g. 'FEEDER-A'). Checks DISCOM congestion levels and trading permission."
)
async def tool_get_grid_status(feeder_id: str) -> dict[str, Any]:
    return await get_grid_status(feeder_id)


@mcp_server.tool(
    name="get_market_price",
    description="Get the current local P2P energy market price for a distribution feeder (e.g. 'FEEDER-A'). Returns indicative price in INR/kWh, bounds, and DISCOM wheeling charge."
)
async def tool_get_market_price(feeder_id: str) -> dict[str, Any]:
    return await get_market_price(feeder_id)


@mcp_server.tool(
    name="get_available_surplus",
    description="Check the current net exportable solar surplus available for P2P marketplace trading for a prosumer meter ID (e.g. 'H001')."
)
async def tool_get_available_surplus(meter_id: str) -> dict[str, Any]:
    return await get_available_surplus(meter_id)


@mcp_server.tool(
    name="get_open_orders",
    description="Retrieve currently open buy and sell orders in the P2P marketplace orderbook, optionally filtered by feeder_id."
)
async def tool_get_open_orders(feeder_id: Optional[str] = None) -> dict[str, Any]:
    return await get_open_orders(feeder_id)


@mcp_server.tool(
    name="create_buy_order",
    description=(
        "STATE-CHANGING: Place an explicit buy order to purchase renewable energy from the P2P marketplace. "
        "Requires explicit user purchase intent. Validates quantity (0.1-50 kWh), max_price (INR/kWh), and feeder grid headroom."
    )
)
async def tool_create_buy_order(
    user_id: str,
    quantity_kwh: float,
    max_price: float,
    meter_id: Optional[str] = None
) -> dict[str, Any]:
    return await create_buy_order(user_id, quantity_kwh, max_price, meter_id)


@mcp_server.tool(
    name="create_sell_order",
    description=(
        "STATE-CHANGING: Place an explicit sell order to trade surplus solar energy on the P2P marketplace. "
        "Requires prosumer role with solar generation capacity. Validates quantity (0.1-50 kWh), min_price (INR/kWh), and grid conditions."
    )
)
async def tool_create_sell_order(
    user_id: str,
    quantity_kwh: float,
    min_price: float,
    meter_id: Optional[str] = None
) -> dict[str, Any]:
    return await create_sell_order(user_id, quantity_kwh, min_price, meter_id)


@mcp_server.tool(
    name="get_trade_status",
    description="Query real-time delivery and execution status of a matched P2P energy trade using trade_id (e.g. 'TRD-2026-0001')."
)
async def tool_get_trade_status(trade_id: str) -> dict[str, Any]:
    return await get_trade_status(trade_id)


@mcp_server.tool(
    name="get_settlement_status",
    description="Retrieve post-delivery financial settlement, DISCOM grid wheeling fees, and payment status for a trade using trade_id."
)
async def tool_get_settlement_status(trade_id: str) -> dict[str, Any]:
    return await get_settlement_status(trade_id)


# ─────────────────────────────────────────────────────────────────────────────
#  SERVER LIFECYCLE & CLI
# ─────────────────────────────────────────────────────────────────────────────

async def startup():
    """Perform startup checks and establish database readiness."""
    logger.info(f"Starting {settings.SERVER_NAME} v{settings.SERVER_VERSION} [{settings.ENVIRONMENT}]")
    await db_manager.connect()


def run_stdio():
    """Run server over standard input/output (standard MCP agent communication)."""
    asyncio.run(startup())
    logger.info("Listening on stdio transport...")
    mcp_server.run(transport="stdio")


def main():
    parser = argparse.ArgumentParser(description="POWERFLOW MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default="stdio",
        help="Transport mode (default: stdio)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port for SSE transport (default: 8000)"
    )
    args = parser.parse_args()

    if args.transport == "stdio":
        run_stdio()
    elif args.transport == "sse":
        asyncio.run(startup())
        logger.info(f"Starting SSE server on port {args.port}...")
        mcp_server.run(transport="sse")


if __name__ == "__main__":
    main()
