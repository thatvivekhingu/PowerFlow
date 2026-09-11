"""
Unit and Integration Tests for POWERFLOW LangGraph AI Agent.
Tests state transitions, conditional routing, tool delegation, confirmation gates, and end-to-end flows.
"""

import pytest
from unittest.mock import patch, AsyncMock

from powerflow_agent.state import AgentState
from powerflow_agent.config import agent_settings
from powerflow_agent.router import route_after_validation, route_after_confirmation
from powerflow_agent.tools import dispatch_tool
from powerflow_agent.graph import powerflow_agent, run_agent
from powerflow_agent.nodes import understand_request_node, route_request_node


# ─────────────────────────────────────────────────────────────────────────────
# 1. State and Router Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_routing_after_validation():
    """Test conditional edge after tool validation."""
    # Trade order must route to confirmation node
    trade_state: AgentState = {"intent": "TRADE_ORDER"}
    assert route_after_validation(trade_state) == "request_confirmation"

    # Multi-tool analytics must route to analysis node
    analysis_state: AgentState = {"intent": "MARKET_ANALYSIS"}
    assert route_after_validation(analysis_state) == "analyze_result"

    recommendation_state: AgentState = {"intent": "BUY_RECOMMENDATION"}
    assert route_after_validation(recommendation_state) == "analyze_result"

    # Simple informational forecasts route directly to final response
    forecast_state: AgentState = {"intent": "FORECAST"}
    assert route_after_validation(forecast_state) == "final_response"


def test_routing_after_confirmation():
    """Test conditional edge after confirmation check."""
    # Unconfirmed order stops before execution
    unconfirmed_state: AgentState = {
        "confirmation_required": True,
        "user_confirmed": False,
    }
    assert route_after_confirmation(unconfirmed_state) == "final_response"

    # Confirmed order routes to execute_order
    confirmed_state: AgentState = {
        "confirmation_required": False,
        "user_confirmed": True,
    }
    assert route_after_confirmation(confirmed_state) == "execute_order"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Tool Dispatch Bridge Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tool_dispatch_success():
    """Verify tool dispatcher successfully routes to underlying MCP functions."""
    result = await dispatch_tool("get_meter_reading", {"meter_id": "H011"})
    assert result.get("status") == "SUCCESS"
    assert result.get("meter_id") == "H011"
    assert "current_load_kw" in result or "demand_kwh" in result


@pytest.mark.asyncio
async def test_tool_dispatch_unknown_tool():
    """Verify dispatcher safely handles unknown tool names without exceptions."""
    result = await dispatch_tool("non_existent_tool", {})
    assert result.get("status") == "ERROR"
    assert result.get("error_code") == "TOOL_NOT_FOUND"


@pytest.mark.asyncio
async def test_tool_dispatch_malformed_args():
    """Verify dispatcher safely handles invalid argument types."""
    result = await dispatch_tool("get_meter_reading", {"invalid_param": 123})
    assert result.get("status") == "ERROR"
    assert result.get("error_code") == "INVALID_TOOL_ARGUMENTS"


# ─────────────────────────────────────────────────────────────────────────────
# 3. Request Understanding Node Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_understand_request_entity_extraction():
    """Test entity extraction fallback and normalization."""
    state: AgentState = {
        "user_query": "What is the expected demand for meter H011?",
        "trace_history": [],
    }
    updated = await understand_request_node(state)
    assert updated["intent"] == "FORECAST"
    assert updated["meter_id"] == "H011"
    assert updated["feeder_id"] == "FEEDER-A"  # Resolved from household DB


@pytest.mark.asyncio
async def test_understand_trade_request_extraction():
    """Test order extraction for trade request."""
    state: AgentState = {
        "user_query": "Create a buy order for 2 kWh at 6 INR/kWh",
        "trace_history": [],
    }
    updated = await understand_request_node(state)
    assert updated["intent"] == "TRADE_ORDER"
    assert updated["order_side"] == "BUY"
    assert updated["quantity_kwh"] == 2.0
    assert updated["target_price"] == 6.0


# ─────────────────────────────────────────────────────────────────────────────
# 4. End-to-End LangGraph Flow Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_flow_demand_forecast():
    """Scenario 1: Forecast Request flow (Read-only, no confirmation)."""
    result = await run_agent(
        user_query="What is the expected demand for meter H011?",
        user_id="H011",
        meter_id="H011",
        feeder_id="FEEDER-A",
    )
    assert result["intent"] == "FORECAST"
    assert result["demand_forecast_data"] is not None
    assert result["demand_forecast_data"]["status"] == "SUCCESS"
    assert result.get("confirmation_required") is False
    assert "DEMAND FORECAST" in result["final_response"]
    assert len(result["tool_calls"]) >= 1


@pytest.mark.asyncio
async def test_flow_market_analysis():
    """Scenario 2: Market Analysis multi-tool flow."""
    result = await run_agent(
        user_query="Why is the current P2P price high on FEEDER-A?",
        user_id="H011",
        meter_id="H011",
        feeder_id="FEEDER-A",
    )
    assert result["intent"] == "MARKET_ANALYSIS"
    assert result["market_data"] is not None
    assert result["grid_data"] is not None
    assert result.get("confirmation_required") is False
    assert "CONGESTION ANALYSIS" in result["final_response"]
    assert "demand_supply_ratio" in result["market_data"]


@pytest.mark.asyncio
async def test_flow_buy_recommendation():
    """Scenario 3: Buy Recommendation advisory flow."""
    result = await run_agent(
        user_query="Should I buy 2 kWh now?",
        user_id="H011",
        meter_id="H011",
        feeder_id="FEEDER-A",
    )
    assert result["intent"] == "BUY_RECOMMENDATION"
    assert result["demand_forecast_data"] is not None
    assert result["market_data"] is not None
    assert result["grid_data"] is not None
    assert result.get("confirmation_required") is False
    assert "RECOMMENDATION" in result["final_response"]


@pytest.mark.asyncio
async def test_flow_trade_order_confirmation_gate():
    """
    Scenario 4: Trade Order safety gate.
    When user asks to place an order, the agent MUST halt, prepare a proposed order,
    and NOT execute until explicit confirmation is granted.
    """
    # Step 1: Initial trade request without confirmation
    result_step1 = await run_agent(
        user_query="Create a buy order for 2 kWh at 6 INR/kWh",
        user_id="H011",
        meter_id="H011",
        feeder_id="FEEDER-A",
        user_confirmed=False,
    )

    # Must require confirmation
    assert result_step1["intent"] == "TRADE_ORDER"
    assert result_step1["confirmation_required"] is True
    assert result_step1["proposed_action"] is not None
    assert result_step1["proposed_action"]["side"] == "BUY"
    assert result_step1["proposed_action"]["quantity_kwh"] == 2.0
    assert result_step1["proposed_action"]["target_price_inr"] == 6.0
    # Must NOT have executed the order yet
    assert result_step1.get("order_result") is None
    assert "[CONFIRMATION REQUIRED TO PLACE ORDER]" in result_step1["final_response"]

    # Step 2: Second invocation with user confirmation granted
    proposed = result_step1["proposed_action"]
    result_step2 = await run_agent(
        user_query="Confirm buy order",
        user_id="H011",
        meter_id="H011",
        feeder_id="FEEDER-A",
        user_confirmed=True,
        proposed_action=proposed,
    )

    assert result_step2["confirmation_required"] is False
    assert result_step2["order_result"] is not None
    assert result_step2["order_result"]["status"] == "SUCCESS"
    assert "order_id" in result_step2["order_result"]
    assert "[ORDER SUCCESSFULLY PLACED" in result_step2["final_response"]