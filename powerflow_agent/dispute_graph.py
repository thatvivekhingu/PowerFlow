"""
LangGraph StateGraph: Smart Meter Oracle & Delivery Dispute Resolution.
Reconciles contracted P2P trades against actual smart meter telemetry (e.g. solar drop due to cloud cover),
calculates prorated settlement adjustments, updates DISCOM wheeling fees, and generates cryptographic audit proofs.
"""

import hashlib
import json
from typing import TypedDict, Any, Optional
from langgraph.graph import StateGraph, START, END


class DisputeState(TypedDict, total=False):
    trade_id: str
    feeder_id: str
    seller_meter_id: str
    buyer_meter_id: str
    contracted_kwh: float
    price_per_kwh: float
    actual_delivered_kwh: float
    shortfall_kwh: float
    shortfall_pct: float
    original_seller_credit: float
    original_buyer_debit: float
    original_discom_fee: float
    adjusted_seller_credit: float
    adjusted_buyer_refund: float
    adjusted_discom_fee: float
    net_buyer_paid: float
    audit_hash: str
    status: str  # "SHORTFALL_DETECTED", "BALANCED_VERIFIED", "RECONCILED", "DISPUTE_REJECTED"
    trace: list[str]
    resolution_summary: str


# ── Node 1: Ingest Smart Meter Oracle Telemetry ──────────────────────────────
async def ingest_oracle_telemetry_node(state: DisputeState) -> dict[str, Any]:
    trace = state.get("trace", []).copy()
    trade_id = state.get("trade_id", "TR-DEMO-001")
    contracted = state.get("contracted_kwh") or 10.0
    price = state.get("price_per_kwh") or 5.40
    delivered = state.get("actual_delivered_kwh")
    if delivered is None:
        # Default scenario: 75% delivered (e.g. cloud transient curtailment)
        delivered = round(contracted * 0.75, 2)

    trace.append(f"[Oracle Ingest] Trade {trade_id}: Contracted {contracted} kWh @ ₹{price}/kWh.")
    trace.append(f"[Oracle Ingest] Smart Meter Reading: Actual delivered across interval = {delivered} kWh.")

    return {
        "trade_id": trade_id,
        "contracted_kwh": contracted,
        "price_per_kwh": price,
        "actual_delivered_kwh": delivered,
        "trace": trace,
    }


# ── Node 2: Detect Delivery Discrepancy ───────────────────────────────────────
async def detect_discrepancy_node(state: DisputeState) -> dict[str, Any]:
    trace = state.get("trace", []).copy()
    contracted = state.get("contracted_kwh", 10.0)
    delivered = state.get("actual_delivered_kwh", 10.0)

    shortfall = max(0.0, round(contracted - delivered, 2))
    shortfall_pct = round((shortfall / contracted) * 100, 1) if contracted > 0 else 0.0

    if shortfall > 0:
        status = "SHORTFALL_DETECTED"
        trace.append(f"[Discrepancy] SHORTFALL DETECTED: {shortfall} kWh ({shortfall_pct}%) undelivered. Initiating automated prorated reconciliation.")
    else:
        status = "BALANCED_VERIFIED"
        trace.append(f"[Discrepancy] VERIFIED: Delivered {delivered} kWh satisfies 100% of contracted {contracted} kWh.")

    return {
        "shortfall_kwh": shortfall,
        "shortfall_pct": shortfall_pct,
        "status": status,
        "trace": trace,
    }


# ── Node 3: Prorate Settlement & DISCOM Wheeling ─────────────────────────────
async def prorate_settlement_node(state: DisputeState) -> dict[str, Any]:
    trace = state.get("trace", []).copy()
    contracted = state.get("contracted_kwh", 10.0)
    delivered = state.get("actual_delivered_kwh", 10.0)
    price = state.get("price_per_kwh", 5.40)
    wheeling_rate = 0.25  # Regulated DISCOM rate per kWh

    # Original amounts if fully delivered
    orig_gross = contracted * price
    orig_discom = round(contracted * wheeling_rate, 2)
    orig_seller_credit = round(orig_gross - (orig_gross * 0.005), 2)
    orig_buyer_debit = round(orig_gross + orig_discom + (orig_gross * 0.005), 2)

    # Prorated amounts for delivered quantity
    adj_gross = delivered * price
    adj_discom = round(delivered * wheeling_rate, 2)
    adj_seller_credit = round(adj_gross - (adj_gross * 0.005), 2)
    
    # Refund for undelivered energy + undelivered wheeling charges
    undelivered_kwh = max(0.0, contracted - delivered)
    buyer_refund = round((undelivered_kwh * price) + (undelivered_kwh * wheeling_rate) + (undelivered_kwh * price * 0.005), 2)
    net_buyer_paid = round(orig_buyer_debit - buyer_refund, 2)

    trace.append(
        f"[Prorate] Settlement Adjusted: Seller credit ₹{adj_seller_credit} (was ₹{orig_seller_credit}). "
        f"Buyer refund issued ₹{buyer_refund}. DISCOM wheeling fee adjusted to ₹{adj_discom} (was ₹{orig_discom})."
    )

    return {
        "original_seller_credit": orig_seller_credit,
        "original_buyer_debit": orig_buyer_debit,
        "original_discom_fee": orig_discom,
        "adjusted_seller_credit": adj_seller_credit,
        "adjusted_buyer_refund": buyer_refund,
        "adjusted_discom_fee": adj_discom,
        "net_buyer_paid": net_buyer_paid,
        "trace": trace,
    }


# ── Node 4: Generate Cryptographic Audit Proof ───────────────────────────────
async def generate_audit_proof_node(state: DisputeState) -> dict[str, Any]:
    trace = state.get("trace", []).copy()
    payload = {
        "trade_id": state.get("trade_id"),
        "contracted_kwh": state.get("contracted_kwh"),
        "delivered_kwh": state.get("actual_delivered_kwh"),
        "shortfall_kwh": state.get("shortfall_kwh"),
        "adjusted_seller_credit": state.get("adjusted_seller_credit"),
        "adjusted_buyer_refund": state.get("adjusted_buyer_refund"),
        "adjusted_discom_fee": state.get("adjusted_discom_fee"),
    }
    raw_str = json.dumps(payload, sort_keys=True)
    audit_hash = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    trace.append(f"[Audit Proof] Generated SHA-256 tamper-evident reconciliation receipt: {audit_hash[:16]}...")

    summary = (
        f"Smart Meter Oracle resolved Trade {state.get('trade_id')}. "
        f"Actual delivery of {state.get('actual_delivered_kwh')} kWh resulted in a ₹{state.get('adjusted_buyer_refund')} refund to the buyer. "
        f"Seller paid ₹{state.get('adjusted_seller_credit')}. DISCOM wheeling charge updated to ₹{state.get('adjusted_discom_fee')}. "
        f"Audit Hash: {audit_hash[:12]}..."
    )

    return {
        "audit_hash": audit_hash,
        "status": "RECONCILED",
        "resolution_summary": summary,
        "trace": trace,
    }


# ── StateGraph Construction ──────────────────────────────────────────────────
def build_dispute_graph():
    workflow = StateGraph(DisputeState)

    workflow.add_node("ingest_oracle_telemetry", ingest_oracle_telemetry_node)
    workflow.add_node("detect_discrepancy", detect_discrepancy_node)
    workflow.add_node("prorate_settlement", prorate_settlement_node)
    workflow.add_node("generate_audit_proof", generate_audit_proof_node)

    workflow.add_edge(START, "ingest_oracle_telemetry")
    workflow.add_edge("ingest_oracle_telemetry", "detect_discrepancy")
    workflow.add_edge("detect_discrepancy", "prorate_settlement")
    workflow.add_edge("prorate_settlement", "generate_audit_proof")
    workflow.add_edge("generate_audit_proof", END)

    return workflow.compile()


# Lazy-compiled helper
_dispute_agent = None

def get_dispute_agent():
    global _dispute_agent
    if _dispute_agent is None:
        _dispute_agent = build_dispute_graph()
    return _dispute_agent


async def run_dispute_resolution(
    trade_id: str = "TR-DEMO-001",
    contracted_kwh: float = 10.0,
    price_per_kwh: float = 5.40,
    actual_delivered_kwh: Optional[float] = None,
) -> DisputeState:
    """Convenience runner executing the Dispute Resolution StateGraph."""
    initial_state: DisputeState = {
        "trade_id": trade_id,
        "contracted_kwh": contracted_kwh,
        "price_per_kwh": price_per_kwh,
        "actual_delivered_kwh": actual_delivered_kwh,
        "trace": [],
    }
    agent = get_dispute_agent()
    return await agent.ainvoke(initial_state)
