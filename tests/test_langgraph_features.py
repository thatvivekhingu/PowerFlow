"""
Unit Tests for LangGraph Integration in POWERFLOW:
  - Feature 1: Conversational Trading Copilot & HITL Confirmation Gate
  - Feature 4: DISCOM Automated Demand Response & Congestion Mitigator StateGraph
  - Feature 5: Smart Meter Oracle & Delivery Dispute Resolution StateGraph
"""

import pytest
import asyncio
from powerflow_agent.demand_response_graph import run_demand_response
from powerflow_agent.dispute_graph import run_dispute_resolution


@pytest.mark.asyncio
async def test_demand_response_graph_cooldown():
    """Verify LangGraph Demand Response cools feeder from 93% to target 80%."""
    res = await run_demand_response(
        feeder_id="FEEDER-A",
        current_load_kw=46.5,
        capacity_kw=50.0,
        target_utilization_pct=80.0,
    )

    assert res["status"] == "COOLED_SUCCESS"
    assert res["utilization_pct"] == 93.0
    assert res["post_dr_utilization_pct"] <= 80.0
    assert res["curtailed_kw_achieved"] >= 6.5
    assert res["incentive_rate_inr_per_kwh"] > 0
    assert len(res["flexible_loads"]) >= 2
    assert any(a["curtailed"] for a in res["flexible_loads"])
    assert len(res["trace"]) >= 5


@pytest.mark.asyncio
async def test_demand_response_normal_conditions():
    """Verify LangGraph Demand Response when feeder is already in safe zone."""
    res = await run_demand_response(
        feeder_id="FEEDER-A",
        current_load_kw=35.0,
        capacity_kw=50.0,
        target_utilization_pct=80.0,
    )

    assert res["utilization_pct"] == 70.0
    assert res["required_reduction_kw"] == 0.0
    assert res["curtailed_kw_achieved"] == 0.0


@pytest.mark.asyncio
async def test_dispute_resolution_graph_shortfall():
    """Verify LangGraph Smart Meter Oracle reconciles solar generation shortfall."""
    res = await run_dispute_resolution(
        trade_id="TR-TEST-99",
        contracted_kwh=10.0,
        price_per_kwh=5.00,
        actual_delivered_kwh=7.0,
    )

    assert res["status"] == "RECONCILED"
    assert res["shortfall_kwh"] == 3.0
    assert res["shortfall_pct"] == 30.0
    assert res["adjusted_seller_credit"] < res["original_seller_credit"]
    assert res["adjusted_buyer_refund"] > 0
    # DISCOM wheeling should be strictly 7.0 kWh * 0.25 = 1.75
    assert res["adjusted_discom_fee"] == 1.75
    assert len(res["audit_hash"]) == 64
    assert len(res["trace"]) >= 4


@pytest.mark.asyncio
async def test_dispute_resolution_graph_full_delivery():
    """Verify LangGraph Oracle when 100% of contracted energy is delivered."""
    res = await run_dispute_resolution(
        trade_id="TR-FULL-100",
        contracted_kwh=8.0,
        price_per_kwh=5.50,
        actual_delivered_kwh=8.0,
    )

    assert res["shortfall_kwh"] == 0.0
    assert res["shortfall_pct"] == 0.0
    assert res["adjusted_buyer_refund"] == 0.0
    assert len(res["audit_hash"]) == 64
