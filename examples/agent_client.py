"""
Example AI-Agent MCP Client for POWERFLOW.
Demonstrates how an AI Agent or LLM runner communicates with the POWERFLOW MCP Server
to retrieve telemetry, forecasts, market prices, and execute validated orders.
"""

import sys
from pathlib import Path

# Ensure package root is importable
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))

import asyncio
import json
from powerflow_mcp.server import mcp_server, startup


async def simulate_ai_agent():
    print("=" * 70)
    print("  POWERFLOW AI AGENT — Model Context Protocol (MCP) Client")
    print("=" * 70)

    # 1. Initialize Server Lifecycle
    await startup()

    # 2. Discover Tools Available to the Agent
    tools = await mcp_server.list_tools()
    print(f"\n[Agent] Discovered {len(tools)} MCP Tools:")
    for t in tools:
        is_write = "create_" in t.name
        tag = "[STATE-CHANGING]" if is_write else "[READ-ONLY]     "
        print(f"  {tag} {t.name:<25} - {t.description[:45]}...")

    print("\n" + "-" * 70)

    # ── CONVERSATION 1: "What is the expected demand in feeder FEEDER-A?" ──
    print("\nUser Query: 'What is the expected demand in feeder FEEDER-A?'")
    print("Agent Reasoning: I should first check the feeder grid status and then run a demand forecast.")
    
    grid_res = await mcp_server.call_tool("get_grid_status", {"feeder_id": "FEEDER-A"})
    demand_res = await mcp_server.call_tool("get_demand_forecast", {"meter_id": "H011", "horizon_hours": 24})
    
    grid_data = grid_res.structured_content
    demand_data = demand_res.structured_content

    print(f"[Agent Call -> get_grid_status('FEEDER-A')] -> {grid_data}")
    print(f"[Agent Call -> get_demand_forecast('H011')] -> {demand_data}")
    print("\nAI Response:")
    print(f"  \"Feeder FEEDER-A currently has an active load of {grid_data.get('current_load_kw')} kW with "
          f"{grid_data.get('available_headroom_kw')} kW headroom ({grid_data.get('utilization_pct')}% utilization). "
          f"According to model {demand_data.get('model_version')}, predicted 24-hour demand for meter H011 is "
          f"{demand_data.get('predicted_demand_kwh')} kWh (95% CI: {demand_data.get('confidence_interval_lower_kwh')} - "
          f"{demand_data.get('confidence_interval_upper_kwh')} kWh) with peak consumption around {demand_data.get('peak_expected_hour')}:00.\"")

    print("\n" + "-" * 70)

    # ── CONVERSATION 2: "How much solar surplus is expected?" ──
    print("\nUser Query: 'How much solar surplus is expected for prosumer H001?'")
    print("Agent Reasoning: Prosumer meter H001 has solar panels. I will call get_available_surplus and get_solar_forecast.")

    surplus_res = await mcp_server.call_tool("get_available_surplus", {"meter_id": "H001"})
    solar_res = await mcp_server.call_tool("get_solar_forecast", {"meter_id": "H001", "horizon_hours": 24})

    surplus_data = surplus_res.structured_content
    solar_data = solar_res.structured_content

    print(f"[Agent Call -> get_available_surplus('H001')] -> {surplus_data}")
    print(f"[Agent Call -> get_solar_forecast('H001')]   -> {solar_data}")
    print("\nAI Response:")
    print(f"  \"Smart meter H001 currently has {surplus_data.get('net_exportable_surplus_kwh')} kWh of net exportable surplus "
          f"ready for P2P trading (generation: {surplus_data.get('solar_generation_kw')} kW, load: {surplus_data.get('current_load_kw')} kW). "
          f"Over the next 24 hours, predicted solar generation is {solar_data.get('predicted_solar_generation_kwh')} kWh, "
          f"with an estimated exportable surplus of {solar_data.get('expected_surplus_kwh')} kWh.\"")

    print("\n" + "-" * 70)

    # ── CONVERSATION 3: "What is the current local energy price?" ──
    print("\nUser Query: 'What is the current local energy price in FEEDER-A?'")
    print("Agent Reasoning: I should call get_market_price for FEEDER-A to retrieve clearing price and bounds.")

    price_res = await mcp_server.call_tool("get_market_price", {"feeder_id": "FEEDER-A"})
    price_data = price_res.structured_content

    print(f"[Agent Call -> get_market_price('FEEDER-A')] -> {price_data}")
    print("\nAI Response:")
    print(f"  \"The indicative local P2P energy price in FEEDER-A is INR {price_data.get('indicative_price_inr_per_kwh')}/kWh. "
          f"The regulatory floor is INR {price_data.get('price_floor_inr_per_kwh')}/kWh, cap is INR {price_data.get('price_cap_inr_per_kwh')}/kWh, "
          f"and the DISCOM wheeling charge is INR {price_data.get('discom_wheeling_charge_inr')}/kWh. "
          f"Current local demand-to-supply ratio is {price_data.get('demand_supply_ratio')}.\"")

    print("\n" + "-" * 70)

    # ── CONVERSATION 4: "Create a buy order for 2 kWh up to INR 6/kWh" ──
    print("\nUser Query: 'Create a buy order for 2 kWh up to INR 6/kWh for user H011'")
    print("Agent Reasoning: User explicitly requested an order creation. This is a state-changing tool call. "
          "I will invoke create_buy_order with user_id='H011', quantity_kwh=2.0, max_price=6.00.")

    order_res = await mcp_server.call_tool("create_buy_order", {
        "user_id": "H011",
        "quantity_kwh": 2.0,
        "max_price": 6.00
    })
    order_data = order_res.structured_content

    print(f"[Agent Call -> create_buy_order(...)] -> {order_data}")
    print("\nAI Response:")
    print(f"  \"Your buy order {order_data.get('order_id')} has been successfully placed!\n"
          f"   • Quantity: {order_data.get('quantity_kwh')} kWh\n"
          f"   • Bid Price: Up to INR {order_data.get('price_inr')}/kWh\n"
          f"   • Grid Status: {order_data.get('grid_validation_status')}\n"
          f"   • Status: {order_data.get('order_status')}\n"
          f"   • Audit Signature Hash: {order_data.get('audit_hash')}\"")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(simulate_ai_agent())
