"""
Comprehensive Test Suite for POWERFLOW LLM Reasoning Layer.
Tests intent recognition, tool selection, multi-tool reasoning, conversation memory,
anti-hallucination guardrails, grid-rejection handling, confirmation gates, and PII sanitization.
"""

import pytest
from powerflow_mcp.llm import (
    llm_reasoning_engine,
    ConversationMemory,
    observability_tracker,
    sanitize_pii,
)
from powerflow_agent.graph import run_agent
from powerflow_agent.tools import dispatch_tool


# ─────────────────────────────────────────────────────────────────────────────
# 1. Intent Recognition & Entity Extraction
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_intent_recognition_forecast():
    """Verify forecast queries extract intent, meter, and feeder."""
    parsed = await llm_reasoning_engine.understand_and_route("What is the expected demand for meter H011?")
    assert parsed["intent"] == "FORECAST"
    assert parsed["meter_id"] == "H011"
    assert parsed["feeder_id"] == "FEEDER-A"
    assert "get_demand_forecast" in parsed["candidate_tools"]


@pytest.mark.asyncio
async def test_intent_recognition_surplus():
    """Verify surplus queries extract surplus intent and feeder."""
    parsed = await llm_reasoning_engine.understand_and_route("Is there enough local solar surplus in FEEDER-A?")
    assert parsed["intent"] == "SURPLUS_QUERY"
    assert parsed["feeder_id"] == "FEEDER-A"
    assert "get_available_surplus" in parsed["candidate_tools"]


@pytest.mark.asyncio
async def test_intent_recognition_market():
    """Verify market pricing queries extract market analysis intent."""
    parsed = await llm_reasoning_engine.understand_and_route("Why is the current P2P price high on FEEDER-A?")
    assert parsed["intent"] == "MARKET_ANALYSIS"
    assert parsed["feeder_id"] == "FEEDER-A"
    assert "get_market_price" in parsed["candidate_tools"]


@pytest.mark.asyncio
async def test_intent_recognition_buy_recommendation():
    """Verify purchase advice queries extract buy recommendation intent."""
    parsed = await llm_reasoning_engine.understand_and_route("Should I buy 2 kWh now?")
    assert parsed["intent"] == "BUY_RECOMMENDATION"
    assert parsed["quantity_kwh"] == 2.0
    assert parsed["order_side"] == "BUY"


@pytest.mark.asyncio
async def test_intent_recognition_trade_order():
    """Verify explicit order placement extracts trade order intent, quantity, and price."""
    parsed = await llm_reasoning_engine.understand_and_route("Create a buy order for 3.5 kWh at 6.5 INR/kWh")
    assert parsed["intent"] == "TRADE_ORDER"
    assert parsed["order_side"] == "BUY"
    assert parsed["quantity_kwh"] == 3.5
    assert parsed["target_price"] == 6.5


@pytest.mark.asyncio
async def test_intent_recognition_trade_status():
    """Verify trade tracking queries extract trade status intent and trade ID."""
    parsed = await llm_reasoning_engine.understand_and_route("Check trade status for TRD-2026-0001")
    assert parsed["intent"] == "TRADE_STATUS"
    assert parsed["trade_id"] == "TRD-2026-0001"
    assert "get_trade_status" in parsed["candidate_tools"]


@pytest.mark.asyncio
async def test_intent_recognition_settlement_status():
    """Verify settlement queries extract settlement status intent."""
    parsed = await llm_reasoning_engine.understand_and_route("Check escrow and settlement status for TRD-2026-0001")
    assert parsed["intent"] == "SETTLEMENT_STATUS"
    assert parsed["trade_id"] == "TRD-2026-0001"
    assert "get_settlement_status" in parsed["candidate_tools"]


# ─────────────────────────────────────────────────────────────────────────────
# 2. Multi-Turn Context Memory & Follow-Ups
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_conversation_memory_followup():
    """
    Test contextual entity inheritance:
    Turn 1 sets meter H011.
    Turn 2 'What about 3 kWh instead?' inherits meter H011 and updates quantity to 3.0.
    """
    memory = ConversationMemory()
    
    # Turn 1
    t1 = await llm_reasoning_engine.understand_and_route("What is the expected demand for meter H011?", memory)
    memory.add_user_turn("What is the expected demand for meter H011?")
    memory.add_assistant_turn("Demand is 8.2 kWh", intent=t1["intent"], entities=t1)

    assert memory.active_meter_id == "H011"
    assert memory.active_feeder_id == "FEEDER-A"

    # Turn 2: Follow-up without mentioning meter
    t2 = await llm_reasoning_engine.understand_and_route("What about 3 kWh instead?", memory)
    assert t2["meter_id"] == "H011"
    assert t2["feeder_id"] == "FEEDER-A"
    assert t2["quantity_kwh"] == 3.0


def test_conversation_memory_pruning():
    """Verify sliding window bounds prevent unbounded memory growth."""
    memory = ConversationMemory(max_turns=3)
    for i in range(10):
        memory.add_user_turn(f"Query {i}")
        memory.add_assistant_turn(f"Response {i}")

    # Maximum 3 turns * 2 (user + assistant) = 6 turns
    assert len(memory.turns) <= 6


# ─────────────────────────────────────────────────────────────────────────────
# 3. Missing Parameter Detection
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_missing_parameter_detection():
    """Verify missing parameter flag when order quantity is omitted."""
    parsed = await llm_reasoning_engine.understand_and_route("Create a buy order on FEEDER-A")
    assert parsed["intent"] == "TRADE_ORDER"
    assert "quantity_kwh" in parsed["missing_parameters"]


# ─────────────────────────────────────────────────────────────────────────────
# 4. Anti-Hallucination & Grounded Explanations
# ─────────────────────────────────────────────────────────────────────────────

def test_explain_grid_congestion_rejection():
    """Verify grounded explanation when feeder is congested."""
    congested_grid = {
        "feeder_id": "FEEDER-A",
        "utilization_pct": 96.5,
        "congestion_level": "CRITICAL",
        "available_headroom_kw": 3.5,
        "trade_decision": "TRADE_REJECTED",
    }
    explanation = llm_reasoning_engine.explain_grid_congestion(congested_grid, "FEEDER-A")
    assert "TRADE_REJECTED" in explanation
    assert "96.5%" in explanation
    assert "thermal rating" in explanation.lower() or "halt" in explanation.lower()


def test_explain_market_pricing_mechanics():
    """Verify dynamic pricing explanation grounds base price, floor, cap, and wheeling fee."""
    market_data = {
        "feeder_id": "FEEDER-A",
        "indicative_price_inr_per_kwh": 5.81,
        "base_price_inr_per_kwh": 5.0,
        "price_floor_inr_per_kwh": 3.0,
        "price_cap_inr_per_kwh": 8.0,
        "discom_wheeling_charge_inr": 0.25,
        "demand_supply_ratio": 1.43,
    }
    explanation = llm_reasoning_engine.explain_market_price(market_data, "FEEDER-A")
    assert "5.81" in explanation
    assert "1.43" in explanation
    assert "0.25" in explanation
    assert "3.0" in explanation and "8.0" in explanation


# ─────────────────────────────────────────────────────────────────────────────
# 5. State-Changing Trade Confirmation Gate
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_confirmation_gate_stops_unapproved_trades():
    """
    Verify safety gate: the agent must NEVER execute a trade upon initial request;
    it must synthesize a proposed action and halt.
    """
    result = await run_agent(
        user_query="Create a buy order for 2 kWh at 6 INR/kWh",
        user_id="H011",
        meter_id="H011",
        feeder_id="FEEDER-A",
        user_confirmed=False,
    )
    assert result["intent"] == "TRADE_ORDER"
    assert result["confirmation_required"] is True
    assert result["proposed_action"] is not None
    assert result.get("order_result") is None
    assert "[CONFIRMATION REQUIRED TO PLACE ORDER]" in result["final_response"]


# ─────────────────────────────────────────────────────────────────────────────
# 6. Observability & PII Sanitization
# ─────────────────────────────────────────────────────────────────────────────

def test_pii_sanitization():
    """Verify sensitive customer and billing information is masked before logging."""
    raw_text = "Customer Rajesh Sharma with phone +919876543210 and Aadhaar 1234 5678 9012 placed order"
    sanitized = sanitize_pii(raw_text)
    assert "+919876543210" not in sanitized
    assert "1234 5678 9012" not in sanitized
    assert "[PHONE_MASKED]" in sanitized
    assert "[AADHAAR_MASKED]" in sanitized

    raw_dict = {
        "customer_name": "Rajesh Sharma",
        "phone": "9876543210",
        "meter_id": "H011",
        "quantity_kwh": 2.5,
    }
    cleaned_dict = sanitize_pii(raw_dict)
    assert cleaned_dict["customer_name"] == "[NAME_MASKED]"
    assert cleaned_dict["phone"] == "[PHONE_MASKED]"
    assert cleaned_dict["meter_id"] == "H011"
    assert cleaned_dict["quantity_kwh"] == 2.5


# ─────────────────────────────────────────────────────────────────────────────
# 7. Malformed and Unavailable MCP Services
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_malformed_and_unknown_tool_handling():
    """Ensure tool dispatcher returns structured error instead of unhandled crash."""
    res = await dispatch_tool("invalid_mcp_service", {})
    assert res["status"] == "ERROR"
    assert res["error_code"] == "TOOL_NOT_FOUND"

    res_args = await dispatch_tool("get_meter_reading", {"unrecognized_arg": 999})
    assert res_args["status"] == "ERROR"
    assert res_args["error_code"] == "INVALID_TOOL_ARGUMENTS"
