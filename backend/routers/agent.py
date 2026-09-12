"""
FastAPI Router for LangGraph AI Agent & Grid Optimization Services.
Exposes:
  - POST /api/agent/chat: Conversational trading copilot with intent parsing & tool dispatch.
  - POST /api/agent/confirm: Human-in-the-loop trade execution gateway.
  - POST /api/agent/demand-response/trigger: LangGraph DISCOM Feeder Congestion Mitigator.
  - POST /api/agent/dispute/resolve: LangGraph Smart Meter Oracle & Delivery Dispute Resolution.
"""

import sys
import uuid
import logging
from pathlib import Path
from typing import Optional, Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

# Ensure powerflow root is in sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from database import get_db
from models.user import User, UserRole
from models.order import Order, OrderSide, OrderStatus
from auth import get_current_user
from powerflow_agent.graph import run_agent
from powerflow_agent.demand_response_graph import run_demand_response
from powerflow_agent.dispute_graph import run_dispute_resolution

logger = logging.getLogger("powerflow.agent.router")
router = APIRouter(prefix="/api/agent", tags=["AI Agent & Grid Copilot"])


# ── Pydantic Request & Response Schemas ───────────────────────────────────────

class ChatRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    meter_id: Optional[str] = None
    feeder_id: Optional[str] = "FEEDER-A"
    conversation_history: Optional[List[Dict[str, str]]] = []


class ChatResponse(BaseModel):
    response: str
    intent: str
    feeder_id: Optional[str] = "FEEDER-A"
    confirmation_required: bool = False
    proposed_action: Optional[Dict[str, Any]] = None
    trace: List[str] = []
    tools_called: List[str] = []


class ConfirmActionRequest(BaseModel):
    action_id: Optional[str] = None
    approved: bool
    proposed_action: Dict[str, Any]


class ConfirmActionResponse(BaseModel):
    status: str
    message: str
    order_id: Optional[str] = None
    trade_details: Optional[Dict[str, Any]] = None


class DemandResponseRequest(BaseModel):
    feeder_id: str = "FEEDER-A"
    current_load_kw: Optional[float] = None
    capacity_kw: Optional[float] = None
    target_utilization_pct: float = 80.0


class DisputeResolutionRequest(BaseModel):
    trade_id: str = "TR-DEMO-001"
    contracted_kwh: float = 10.0
    price_per_kwh: float = 5.40
    actual_delivered_kwh: Optional[float] = None


# ── Feature 1: Conversational Trading Copilot Endpoint ─────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(req: ChatRequest):
    """
    Query the PowerFlow LangGraph agent in natural language.
    Executes intent routing, MCP queries, feeder headroom checks, and synthesizes responses.
    If a trade action is recommended, sets confirmation_required=True and includes proposed_action.
    """
    try:
        result = await run_agent(
            user_query=req.query,
            user_id=req.user_id or "H011",
            meter_id=req.meter_id or "MTR-H011",
            feeder_id=req.feeder_id or "FEEDER-A",
            conversation_history=req.conversation_history or [],
        )

        response_text = result.get("final_response") or "I processed your request, but no response was generated."
        proposed_action = result.get("proposed_action")
        confirmation_required = bool(result.get("confirmation_required", False) and proposed_action)

        tools_called = [tc.get("tool") for tc in result.get("tool_calls", []) if tc.get("tool")]

        return ChatResponse(
            response=response_text,
            intent=result.get("intent", "GENERAL"),
            feeder_id=result.get("feeder_id") or req.feeder_id,
            confirmation_required=confirmation_required,
            proposed_action=proposed_action,
            trace=result.get("trace_history", []),
            tools_called=tools_called,
        )
    except Exception as e:
        logger.error(f"Error executing LangGraph agent: {e}", exc_info=True)
        return ChatResponse(
            response=f"I encountered a temporary issue processing your request: {str(e)}",
            intent="ERROR",
            feeder_id=req.feeder_id,
            confirmation_required=False,
            trace=[f"[Error] {str(e)}"],
        )


# ── Feature 1 (HITL): Human-in-the-Loop Confirmation Gateway ──────────────────

@router.post("/confirm", response_model=ConfirmActionResponse)
async def confirm_agent_action(
    req: ConfirmActionRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Human-in-the-loop trade confirmation endpoint.
    When the user approves a proposed trade from the Copilot, places the order
    and returns immediate execution verification.
    """
    if not req.approved:
        return ConfirmActionResponse(
            status="CANCELLED",
            message="Trade proposal cancelled by user.",
        )

    action = req.proposed_action
    side_str = (action.get("side") or "buy").lower()
    side = OrderSide.buy if side_str == "buy" else OrderSide.sell
    qty = float(action.get("quantity_kwh") or 2.0)
    target_price = float(action.get("target_price") or action.get("price_per_kwh") or 5.50)
    feeder_id = action.get("feeder_id") or "FEEDER-A"

    order = Order(
        user_id=uuid.uuid4(),
        feeder_id=feeder_id,
        side=side,
        quantity_kwh=qty,
        min_price=target_price if side == OrderSide.sell else None,
        max_price=target_price if side == OrderSide.buy else None,
        status=OrderStatus.open,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)

    # Queue in matching engine
    try:
        from services.matching_engine import enqueue_order
        await enqueue_order(order)
    except Exception as e:
        logger.warning(f"Could not enqueue order directly: {e}")

    return ConfirmActionResponse(
        status="CONFIRMED",
        message=f"Order #{str(order.order_id)[:8]} created for {qty} kWh @ ₹{target_price:.2f}/kWh on {feeder_id}!",
        order_id=str(order.order_id),
        trade_details={
            "side": side_str.upper(),
            "quantity_kwh": qty,
            "target_price": target_price,
            "feeder_id": feeder_id,
            "estimated_discom_fee": round(qty * 0.25, 2),
            "estimated_total_inr": round(qty * target_price + (qty * 0.25), 2),
        },
    )


# ── Feature 4: DISCOM Automated Demand Response Graph Endpoint ────────────────

@router.post("/demand-response/trigger")
async def trigger_demand_response(req: DemandResponseRequest):
    """
    Executes the LangGraph Demand Response & Congestion Mitigator StateGraph:
    detects overload, discovers flexible EV/BESS loads, calculates dynamic tariff rebates,
    and dispatches load-shedding signals to cool the feeder.
    """
    try:
        result = await run_demand_response(
            feeder_id=req.feeder_id,
            current_load_kw=req.current_load_kw,
            capacity_kw=req.capacity_kw,
            target_utilization_pct=req.target_utilization_pct,
        )
        return result
    except Exception as e:
        logger.error(f"Error in Demand Response Graph: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Demand Response agent error: {str(e)}",
        )


# ── Feature 5: Smart Meter Oracle & Dispute Resolution Graph Endpoint ─────────

@router.post("/dispute/resolve")
async def resolve_meter_dispute(req: DisputeResolutionRequest):
    """
    Executes the LangGraph Smart Meter Oracle & Delivery Dispute Resolution StateGraph:
    compares contracted vs actual smart meter delivery, prorates buyer refunds and seller credits,
    adjusts DISCOM wheeling charges, and computes a cryptographic SHA-256 audit hash.
    """
    try:
        result = await run_dispute_resolution(
            trade_id=req.trade_id,
            contracted_kwh=req.contracted_kwh,
            price_per_kwh=req.price_per_kwh,
            actual_delivered_kwh=req.actual_delivered_kwh,
        )
        return result
    except Exception as e:
        logger.error(f"Error in Dispute Resolution Graph: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dispute agent error: {str(e)}",
        )
