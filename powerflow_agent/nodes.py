"""
LangGraph Nodes for POWERFLOW Agent Workflow.
Integrates the LLM Reasoning Layer with the MCP tool bridge:
understand -> route -> call_tools -> validate -> analyze -> confirm -> respond.
"""

import time
import logging
from typing import Any

from powerflow_agent.state import AgentState
from powerflow_agent.llm import llm_reasoning_engine, ConversationMemory, observability_tracker
from powerflow_agent.tools import dispatch_tool
from powerflow_agent.config import agent_settings
from powerflow_mcp.db.repository import HOUSEHOLDS

logger = logging.getLogger("powerflow.agent.nodes")


# ─────────────────────────────────────────────────────────────────────────────
#  1. UNDERSTAND REQUEST NODE
# ─────────────────────────────────────────────────────────────────────────────

async def understand_request_node(state: AgentState) -> dict[str, Any]:
    """
    Parse natural language query, extract intent and domain entities using LLM reasoning layer,
    applying multi-turn conversation memory for follow-up context.
    """
    query = state.get("user_query", "")
    trace = state.get("trace_history", []).copy()
    trace.append(f"[Understand] Processing user query: '{query}'")

    # Reconstruct conversation memory from bounded history in state
    history = state.get("conversation_history", []).copy()
    memory = ConversationMemory(max_turns=agent_settings.MAX_TOOL_CALLS_PER_RUN)
    for turn in history:
        if turn.get("role") == "user":
            memory.add_user_turn(turn.get("content", ""))
        else:
            memory.add_assistant_turn(turn.get("content", ""))

    parsed = await llm_reasoning_engine.understand_and_route(
        user_query=query,
        memory=memory,
        context_override={
            "meter_id": state.get("meter_id"),
            "feeder_id": state.get("feeder_id"),
            "user_id": state.get("user_id"),
            "order_side": state.get("order_side"),
            "quantity_kwh": state.get("quantity_kwh"),
            "target_price": state.get("target_price"),
            "trade_id": state.get("trade_id"),
        }
    )

    intent = parsed.get("intent") or "GENERAL"
    meter_id = parsed.get("meter_id")
    feeder_id = parsed.get("feeder_id")
    user_id = parsed.get("user_id") or meter_id
    order_side = parsed.get("order_side")
    qty = parsed.get("quantity_kwh")
    price = parsed.get("target_price")
    trade_id = parsed.get("trade_id")
    missing = parsed.get("missing_parameters", [])

    # Domain entity resolution: if meter_id is provided, resolve feeder_id
    if meter_id and meter_id in HOUSEHOLDS and not feeder_id:
        feeder_id = HOUSEHOLDS[meter_id]["feeder"]
    elif not meter_id and feeder_id:
        candidates = [m for m, d in HOUSEHOLDS.items() if d["feeder"] == feeder_id]
        if candidates:
            meter_id = candidates[0]

    # Fallback to sensible defaults
    if not meter_id:
        meter_id = agent_settings.DEFAULT_METER_ID
    if not feeder_id:
        feeder_id = HOUSEHOLDS.get(meter_id, {}).get("feeder", agent_settings.DEFAULT_FEEDER_ID)
    if not user_id:
        user_id = meter_id

    trace.append(f"[Understand] Extracted -> Intent: {intent}, Meter: {meter_id}, Feeder: {feeder_id}, Qty: {qty}, Price: {price}")

    # Append user turn to conversation history
    history.append({"role": "user", "content": query})

    return {
        "intent": intent,
        "meter_id": meter_id,
        "feeder_id": feeder_id,
        "user_id": user_id,
        "order_side": order_side,
        "quantity_kwh": qty,
        "target_price": price,
        "trade_id": trade_id,
        "missing_parameters": missing,
        "conversation_history": history,
        "trace_history": trace,
        "errors": state.get("errors", []).copy(),
        "tool_calls": state.get("tool_calls", []).copy(),
        "tool_results": state.get("tool_results", []).copy(),
        "tool_latencies": state.get("tool_latencies", {}).copy(),
    }


# ─────────────────────────────────────────────────────────────────────────────
#  2. ROUTE REQUEST NODE
# ─────────────────────────────────────────────────────────────────────────────

async def route_request_node(state: AgentState) -> dict[str, Any]:
    """
    Formulate the sequence of MCP tools required to answer the query.
    """
    intent = state.get("intent", "GENERAL")
    meter_id = state.get("meter_id", agent_settings.DEFAULT_METER_ID)
    feeder_id = state.get("feeder_id", agent_settings.DEFAULT_FEEDER_ID)
    trade_id = state.get("trade_id") or "TRD-2026-0001"
    trace = state.get("trace_history", []).copy()

    pending_tools = []

    if intent == "FORECAST":
        pending_tools.append({"tool": "get_demand_forecast", "args": {"meter_id": meter_id, "horizon_hours": 24}})
        if meter_id in HOUSEHOLDS and HOUSEHOLDS[meter_id]["type"] == "prosumer":
            pending_tools.append({"tool": "get_solar_forecast", "args": {"meter_id": meter_id, "horizon_hours": 24}})

    elif intent == "SURPLUS_QUERY":
        pending_tools.append({"tool": "get_available_surplus", "args": {"meter_id": meter_id}})
        pending_tools.append({"tool": "get_solar_forecast", "args": {"meter_id": meter_id, "horizon_hours": 24}})
        pending_tools.append({"tool": "get_grid_status", "args": {"feeder_id": feeder_id}})

    elif intent == "GRID_STATUS":
        pending_tools.append({"tool": "get_grid_status", "args": {"feeder_id": feeder_id}})

    elif intent == "MARKET_ANALYSIS":
        pending_tools.append({"tool": "get_market_price", "args": {"feeder_id": feeder_id}})
        pending_tools.append({"tool": "get_grid_status", "args": {"feeder_id": feeder_id}})
        pending_tools.append({"tool": "get_open_orders", "args": {"feeder_id": feeder_id}})
        pending_tools.append({"tool": "get_demand_forecast", "args": {"meter_id": meter_id, "horizon_hours": 24}})

    elif intent == "BUY_RECOMMENDATION":
        pending_tools.append({"tool": "get_demand_forecast", "args": {"meter_id": meter_id, "horizon_hours": 24}})
        pending_tools.append({"tool": "get_market_price", "args": {"feeder_id": feeder_id}})
        pending_tools.append({"tool": "get_open_orders", "args": {"feeder_id": feeder_id}})
        pending_tools.append({"tool": "get_grid_status", "args": {"feeder_id": feeder_id}})

    elif intent == "TRADE_ORDER":
        pending_tools.append({"tool": "get_grid_status", "args": {"feeder_id": feeder_id}})
        pending_tools.append({"tool": "get_market_price", "args": {"feeder_id": feeder_id}})
        pending_tools.append({"tool": "get_meter_reading", "args": {"meter_id": meter_id}})

    elif intent == "TRADE_STATUS":
        pending_tools.append({"tool": "get_trade_status", "args": {"trade_id": trade_id}})

    elif intent == "SETTLEMENT_STATUS":
        pending_tools.append({"tool": "get_settlement_status", "args": {"trade_id": trade_id}})

    else:
        # Default query: check meter reading & market price
        pending_tools.append({"tool": "get_meter_reading", "args": {"meter_id": meter_id}})
        pending_tools.append({"tool": "get_market_price", "args": {"feeder_id": feeder_id}})

    tool_names = [t["tool"] for t in pending_tools]
    trace.append(f"[Route] Scheduled tools for '{intent}': {tool_names}")

    return {
        "pending_tools": pending_tools,
        "trace_history": trace,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  3. CALL TOOL NODE
# ─────────────────────────────────────────────────────────────────────────────

async def call_tool_node(state: AgentState) -> dict[str, Any]:
    """
    Execute all scheduled MCP tools and store domain outputs with latency telemetry.
    """
    pending = state.get("pending_tools", [])
    tool_calls = state.get("tool_calls", []).copy()
    tool_results = state.get("tool_results", []).copy()
    latencies = state.get("tool_latencies", {}).copy()
    trace = state.get("trace_history", []).copy()

    updates: dict[str, Any] = {}

    for item in pending:
        t_name = item["tool"]
        args = item["args"]
        trace.append(f"[CallTool] Invoking {t_name}({args})")
        tool_calls.append({"tool": t_name, "args": args})

        t_start = time.perf_counter()
        res = await dispatch_tool(t_name, args)
        t_elapsed = round((time.perf_counter() - t_start) * 1000, 2)
        latencies[t_name] = t_elapsed
        observability_tracker.record_tool_call(t_name, args, t_start, res.get("status", "SUCCESS"))

        tool_results.append({"tool": t_name, "result": res})

        # Save into specialized state slots
        if t_name == "get_demand_forecast":
            updates["demand_forecast_data"] = res
        elif t_name == "get_solar_forecast":
            updates["solar_forecast_data"] = res
        elif t_name == "get_market_price":
            updates["market_data"] = res
        elif t_name == "get_grid_status":
            updates["grid_data"] = res
        elif t_name == "get_available_surplus":
            updates["surplus_data"] = res
        elif t_name == "get_meter_reading":
            updates["meter_reading_data"] = res
        elif t_name == "get_trade_status":
            updates["trade_status_data"] = res
        elif t_name == "get_settlement_status":
            updates["settlement_status_data"] = res

    updates["pending_tools"] = []
    updates["tool_calls"] = tool_calls
    updates["tool_results"] = tool_results
    updates["tool_latencies"] = latencies
    updates["trace_history"] = trace

    return updates


# ─────────────────────────────────────────────────────────────────────────────
#  4. VALIDATE RESULT NODE
# ─────────────────────────────────────────────────────────────────────────────

async def validate_result_node(state: AgentState) -> dict[str, Any]:
    """
    Inspect tool responses for errors, missing fields, or grid congestion flags.
    """
    results = state.get("tool_results", [])
    errors = state.get("errors", []).copy()
    trace = state.get("trace_history", []).copy()

    for item in results:
        res = item.get("result", {})
        if res.get("status") == "ERROR":
            err_msg = f"Tool '{item['tool']}' failed: {res.get('message')}"
            if err_msg not in errors:
                errors.append(err_msg)
                trace.append(f"[Validate] Found error: {err_msg}")

    # Check grid safety condition
    grid_data = state.get("grid_data")
    if grid_data and grid_data.get("trade_decision") == "TRADE_REJECTED":
        warn = f"Grid Warning: Feeder '{grid_data.get('feeder_id')}' is congested ({grid_data.get('utilization_pct')}%). Trades blocked."
        if warn not in errors:
            errors.append(warn)
            trace.append(f"[Validate] {warn}")

    trace.append(f"[Validate] Validation finished. Total errors: {len(errors)}")

    return {
        "errors": errors,
        "trace_history": trace,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  5. ANALYZE RESULT NODE
# ─────────────────────────────────────────────────────────────────────────────

async def analyze_result_node(state: AgentState) -> dict[str, Any]:
    """
    Synthesize multi-tool outputs into actionable recommendations using LLM reasoning rules.
    """
    intent = state.get("intent")
    feeder_id = state.get("feeder_id", "FEEDER-A")
    trace = state.get("trace_history", []).copy()

    demand = state.get("demand_forecast_data", {})
    market = state.get("market_data", {})
    grid = state.get("grid_data", {})

    reasoning_summary = ""

    if intent == "MARKET_ANALYSIS" and market:
        reasoning_summary = llm_reasoning_engine.explain_market_price(market, feeder_id)

    elif intent == "BUY_RECOMMENDATION":
        price = market.get("indicative_price_inr_per_kwh", 5.8)
        decision = grid.get("trade_decision", "TRADE_ALLOWED")
        qty = state.get("quantity_kwh") or 2.0
        reasoning_summary = (
            f"Advisory: Buy {qty} kWh at INR {price}/kWh is {decision}. "
            f"Feeder headroom: {grid.get('available_headroom_kw', 0)} kW."
        )

    trace.append(f"[Analyze] Synthesized analysis for {intent}")

    return {
        "reasoning_summary": reasoning_summary,
        "trace_history": trace,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  6. REQUEST CONFIRMATION NODE
# ─────────────────────────────────────────────────────────────────────────────

async def request_confirmation_node(state: AgentState) -> dict[str, Any]:
    """
    For state-changing trade operations, synthesize proposed order and require explicit confirmation.
    """
    trace = state.get("trace_history", []).copy()
    user_confirmed = state.get("user_confirmed", False)

    # If already confirmed by caller, proceed
    if user_confirmed:
        trace.append("[Confirmation] User confirmation already granted. Proceeding to execution.")
        return {
            "confirmation_required": False,
            "trace_history": trace,
        }

    # Prepare proposed action
    user_id = state.get("user_id", "H011")
    meter_id = state.get("meter_id", "H011")
    feeder_id = state.get("feeder_id", "FEEDER-A")
    side = state.get("order_side") or "BUY"
    qty = state.get("quantity_kwh") or 2.0
    price = state.get("target_price") or state.get("market_data", {}).get("indicative_price_inr_per_kwh", 6.0)

    total_cost = round(qty * price, 2)
    wheeling = round(qty * 0.25, 2)

    proposed = {
        "side": side,
        "user_id": user_id,
        "meter_id": meter_id,
        "feeder_id": feeder_id,
        "quantity_kwh": qty,
        "target_price_inr": price,
        "estimated_energy_cost_inr": total_cost,
        "estimated_discom_wheeling_fee_inr": wheeling,
        "total_estimated_inr": round(total_cost + wheeling, 2),
    }

    trace.append(f"[Confirmation] Prepared proposed action: {proposed}. Halting for explicit confirmation.")

    return {
        "proposed_action": proposed,
        "confirmation_required": True,
        "trace_history": trace,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  7. EXECUTE ORDER NODE
# ─────────────────────────────────────────────────────────────────────────────

async def execute_order_node(state: AgentState) -> dict[str, Any]:
    """
    Place the order into the POWERFLOW MCP marketplace ONLY after explicit confirmation.
    """
    trace = state.get("trace_history", []).copy()
    user_confirmed = state.get("user_confirmed", False)
    proposed = state.get("proposed_action")

    if not user_confirmed:
        trace.append("[Execute] ABORTED: Attempted execution without explicit user confirmation.")
        return {
            "errors": state.get("errors", []) + ["Execution blocked: User confirmation is strictly required."],
            "trace_history": trace,
        }

    side = proposed.get("side", "BUY")
    user_id = proposed.get("user_id", "H011")
    meter_id = proposed.get("meter_id", "H011")
    qty = proposed.get("quantity_kwh", 2.0)
    price = proposed.get("target_price_inr", 6.0)

    if side == "BUY":
        res = await dispatch_tool("create_buy_order", {
            "user_id": user_id,
            "quantity_kwh": qty,
            "max_price": price,
            "meter_id": meter_id
        })
    else:
        res = await dispatch_tool("create_sell_order", {
            "user_id": user_id,
            "quantity_kwh": qty,
            "min_price": price,
            "meter_id": meter_id
        })

    trace.append(f"[Execute] Order executed: {res}")

    return {
        "order_result": res,
        "confirmation_required": False,
        "trace_history": trace,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  8. FINAL RESPONSE NODE
# ─────────────────────────────────────────────────────────────────────────────

async def final_response_node(state: AgentState) -> dict[str, Any]:
    """
    Format a clean, structured, and factual final response for the user.
    """
    intent = state.get("intent", "GENERAL")
    errors = state.get("errors", [])
    confirmation_required = state.get("confirmation_required", False)
    proposed = state.get("proposed_action")
    order_result = state.get("order_result")
    trace = state.get("trace_history", []).copy()
    history = state.get("conversation_history", []).copy()

    # Case A: Execution stopped waiting for user confirmation
    if confirmation_required and proposed:
        side = proposed["side"]
        response = (
            f"[CONFIRMATION REQUIRED TO PLACE ORDER]\n\n"
            f"Before placing this {side} order on the POWERFLOW P2P marketplace, please confirm the details:\n"
            f"  * Side: {side}\n"
            f"  * User / Meter ID: {proposed['user_id']} ({proposed['meter_id']})\n"
            f"  * Feeder: {proposed['feeder_id']}\n"
            f"  * Quantity: {proposed['quantity_kwh']} kWh\n"
            f"  * Unit Bid Price: INR {proposed['target_price_inr']} / kWh\n"
            f"  * Estimated Energy Cost: INR {proposed['estimated_energy_cost_inr']}\n"
            f"  * DISCOM Wheeling Fee: INR {proposed['estimated_discom_wheeling_fee_inr']}\n"
            f"  * Total Payout / Escrow: INR {proposed['total_estimated_inr']}\n\n"
            f"*Please reply with 'Confirm' to execute this trade or specify new parameters.*"
        )

    # Case B: Order executed successfully
    elif order_result:
        if order_result.get("status") == "SUCCESS":
            response = (
                f"[ORDER SUCCESSFULLY PLACED ON POWERFLOW MARKETPLACE]\n\n"
                f"  * Order ID: {order_result.get('order_id')}\n"
                f"  * Status: {order_result.get('order_status')}\n"
                f"  * Feeder: {order_result.get('feeder_id')}\n"
                f"  * Quantity: {order_result.get('quantity_kwh')} kWh\n"
                f"  * Price: INR {order_result.get('price_inr')}/kWh\n"
                f"  * Grid Check: {order_result.get('grid_validation_status')}\n"
                f"  * Audit Signature Hash: {order_result.get('audit_hash')}"
            )
        else:
            response = f"[ORDER FAILED] {order_result.get('message')}"

    # Case C: Demand Forecast response
    elif intent == "FORECAST":
        demand = state.get("demand_forecast_data", {})
        solar = state.get("solar_forecast_data", {})
        if demand.get("status") == "SUCCESS":
            response = (
                f"[24-HOUR DEMAND FORECAST] Meter: {demand.get('meter_id')} ({demand.get('feeder_id')}):\n"
                f"  * Predicted Total Demand: {demand.get('predicted_demand_kwh')} kWh\n"
                f"  * 95% Confidence Interval: {demand.get('confidence_interval_lower_kwh')} - {demand.get('confidence_interval_upper_kwh')} kWh\n"
                f"  * Peak Consumption Hour: {demand.get('peak_expected_hour')}:00 hrs\n"
                f"  * ML Model Version: {demand.get('model_version')}\n"
                f"  * Features Used: {', '.join(demand.get('features_used', []))}"
            )
            if solar and solar.get("status") == "SUCCESS":
                response += (
                    f"\n\n[SOLAR PV PROJECTION]\n"
                    f"  * Panel Rating: {solar.get('panel_capacity_kw')} kW\n"
                    f"  * Expected Generation: {solar.get('predicted_solar_generation_kwh')} kWh\n"
                    f"  * Tradeable Surplus: {solar.get('expected_surplus_kwh')} kWh"
                )
        else:
            response = f"Could not retrieve demand forecast: {demand.get('message', 'Unknown error')}."

    # Case D: Solar Surplus response
    elif intent == "SURPLUS_QUERY":
        surplus = state.get("surplus_data", {})
        solar = state.get("solar_forecast_data", {})
        grid = state.get("grid_data", {})

        trade_elig = "YES" if surplus.get("eligible_for_p2p_trade") else "NO (" + str(surplus.get("restriction_reason")) + ")"
        response = (
            f"[LOCAL SOLAR SURPLUS STATUS] Meter: {surplus.get('meter_id')} / Feeder: {surplus.get('feeder_id')}\n"
            f"  * Current Solar Output: {surplus.get('solar_generation_kw')} kW\n"
            f"  * Current Household Load: {surplus.get('current_load_kw')} kW\n"
            f"  * Immediate Net Surplus: {surplus.get('net_exportable_surplus_kwh')} kWh\n"
            f"  * Eligible for P2P Trade: {trade_elig}\n"
        )
        if solar and solar.get("status") == "SUCCESS":
            response += f"  * 24-Hour Projected Surplus: {solar.get('expected_surplus_kwh')} kWh (Total Gen: {solar.get('predicted_solar_generation_kwh')} kWh)\n"
        if grid:
            response += f"  * Feeder Headroom: {grid.get('available_headroom_kw')} kW ({grid.get('congestion_level')} congestion)"

    # Case E: Market Price & Analysis response
    elif intent == "MARKET_ANALYSIS":
        market = state.get("market_data", {})
        grid = state.get("grid_data", {})
        demand = state.get("demand_forecast_data", {})

        ratio = market.get("demand_supply_ratio", 1.0)
        response = (
            f"[MARKET PRICING & CONGESTION ANALYSIS] Feeder: {market.get('feeder_id')}\n\n"
            f"  * Current Indicative Price: INR {market.get('indicative_price_inr_per_kwh')} / kWh\n"
            f"  * Regulatory Limits: Floor: INR {market.get('price_floor_inr_per_kwh')} | Cap: INR {market.get('price_cap_inr_per_kwh')}\n"
            f"  * DISCOM Wheeling Fee: INR {market.get('discom_wheeling_charge_inr')} / kWh\n"
            f"  * Demand / Supply Ratio: {ratio:.2f}\n\n"
            f"Why is the price at this level?\n"
            f"1. Supply & Demand: Local demand index is {min(ratio, 1.0):.2f}, driving pricing dynamic.\n"
            f"2. Grid Congestion: Feeder utilization is currently {grid.get('utilization_pct')}% ({grid.get('congestion_level')} congestion).\n"
            f"3. Forecasted Demand: Expected 24h demand is {demand.get('predicted_demand_kwh', 8.2)} kWh."
        )

    # Case F: Buy Recommendation response
    elif intent == "BUY_RECOMMENDATION":
        market = state.get("market_data", {})
        grid = state.get("grid_data", {})
        demand = state.get("demand_forecast_data", {})
        qty = state.get("quantity_kwh") or 2.0
        price = market.get("indicative_price_inr_per_kwh", 5.8)
        decision = grid.get("trade_decision", "TRADE_ALLOWED")

        rec_status = "[YES - RECOMMENDED TO BUY]" if (price <= 6.0 and decision == "TRADE_ALLOWED") else "[CONSIDER WAITING / LIMITED]"
        response = (
            f"[ENERGY PURCHASE RECOMMENDATION] Quantity: {qty} kWh\n\n"
            f"Recommendation: {rec_status}\n\n"
            f"Analysis:\n"
            f"  * Current P2P Price: INR {price} / kWh (Grid Base: INR {market.get('base_price_inr_per_kwh', 5.0)}/kWh)\n"
            f"  * Grid Decision: {decision} (Feeder Headroom: {grid.get('available_headroom_kw')} kW)\n"
            f"  * Estimated Cost: INR {round(qty * price, 2)} + INR {round(qty * 0.25, 2)} DISCOM fee = INR {round(qty * (price + 0.25), 2)}\n"
            f"  * Forecasted Peak: Peak demand occurs at {demand.get('peak_expected_hour', 19)}:00 hrs.\n\n"
            f"*To purchase this energy, simply request: 'Create a buy order for {qty} kWh at INR {price}/kWh.'*"
        )

    # Case G: Grid Status
    elif intent == "GRID_STATUS":
        grid = state.get("grid_data", {})
        response = (
            f"[FEEDER GRID TELEMETRY] Feeder: {grid.get('feeder_id')}\n"
            f"  * Total Capacity: {grid.get('capacity_kw')} kW\n"
            f"  * Current Load: {grid.get('current_load_kw')} kW\n"
            f"  * Available Headroom: {grid.get('available_headroom_kw')} kW\n"
            f"  * Utilization: {grid.get('utilization_pct')}%\n"
            f"  * Congestion Level: {grid.get('congestion_level')}\n"
            f"  * DISCOM Trade Permission: {grid.get('trade_decision')}"
        )

    # Case H: Trade Status
    elif intent == "TRADE_STATUS":
        trade = state.get("trade_status_data", {})
        if trade.get("status") == "SUCCESS":
            qty = trade.get("traded_quantity_kwh", trade.get("quantity_kwh"))
            price = trade.get("clearing_price_inr_per_kwh", trade.get("price_inr"))
            response = (
                f"[P2P TRADE STATUS] Trade ID: {trade.get('trade_id')}\n"
                f"  * Delivery Status: {trade.get('trade_status')}\n"
                f"  * Matched Quantity: {qty} kWh\n"
                f"  * Clearing Price: INR {price}/kWh\n"
                f"  * Buyer Meter: {trade.get('buyer_meter_id')}\n"
                f"  * Seller Meter: {trade.get('seller_meter_id')}\n"
                f"  * Feeder: {trade.get('feeder_id')}"
            )
        else:
            response = f"[TRADE STATUS QUERY] {trade.get('message', 'Trade record not found.')}"

    # Case I: Settlement Status
    elif intent == "SETTLEMENT_STATUS":
        settle = state.get("settlement_status_data", {})
        if settle.get("status") == "SUCCESS":
            status = settle.get("payment_status", settle.get("settlement_status"))
            gross = settle.get("energy_cost_inr", settle.get("gross_energy_amount_inr"))
            fee = settle.get("discom_grid_fee_inr", settle.get("discom_wheeling_fee_inr"))
            net = settle.get("total_settled_inr", settle.get("net_seller_payout_inr"))
            sig = settle.get("audit_signature", settle.get("settlement_hash"))
            response = (
                f"[SETTLEMENT & ESCROW RECONCILIATION] Trade ID: {settle.get('trade_id')}\n"
                f"  * Settlement Status: {status}\n"
                f"  * Gross Trade Amount: INR {gross}\n"
                f"  * DISCOM Wheeling Fee: INR {fee}\n"
                f"  * Net Seller Payout: INR {net}\n"
                f"  * Escrow Released: {settle.get('meter_verified', True)}\n"
                f"  * Settlement Hash: {sig}"
            )
        else:
            response = f"[SETTLEMENT STATUS QUERY] {settle.get('message', 'Settlement record not found.')}"

    else:
        meter = state.get("meter_reading_data") or {}
        market = state.get("market_data") or {}
        feeder = state.get("feeder_id") or "FEEDER-A"
        price = market.get("indicative_price_inr_per_kwh") or 5.0
        gen = meter.get("solar_generation_kw")
        load = meter.get("current_load_kw")
        meter_id = meter.get("meter_id") or state.get("meter_id") or "H011"

        meter_details = ""
        if gen is not None and load is not None:
            meter_details = f"  * Smart Meter {meter_id}: Generating {gen} kW | Load {load} kW\n"

        response = (
            f"[POWERFLOW MARKETPLACE READY]\n"
            f"  * Feeder: {feeder} | Current Indicative Price: INR {price:.2f}/kWh\n"
            f"{meter_details}"
            f"  * You can place a trade by saying: 'Buy 5 kWh' or 'Sell 3 kWh at ₹4.50'.\n"
            f"  * You can also ask: 'Check solar surplus', 'What is the demand forecast?', or 'Explain feeder headroom'."
        )

    # Append assistant response to conversation history
    history.append({"role": "assistant", "content": response})
    trace.append("[FinalResponse] Response constructed.")

    return {
        "final_response": response,
        "conversation_history": history,
        "trace_history": trace,
    }