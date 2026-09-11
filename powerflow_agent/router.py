"""
Conditional Routing Logic for POWERFLOW LangGraph Agent.
Governs state transitions between read-only paths, multi-tool analytical paths, and confirmed trade executions.
"""

from typing import Literal
from powerflow_agent.state import AgentState


def route_after_validation(state: AgentState) -> Literal["analyze_result", "request_confirmation", "final_response"]:
    """
    Branch after tool results have been validated:
    - TRADE_ORDER requires confirmation gate.
    - MARKET_ANALYSIS / BUY_RECOMMENDATION require multi-tool synthesis.
    - Simple read-only queries proceed directly to final_response.
    """
    intent = state.get("intent")

    if intent == "TRADE_ORDER":
        return "request_confirmation"
    elif intent in ["MARKET_ANALYSIS", "BUY_RECOMMENDATION"]:
        return "analyze_result"
    else:
        return "final_response"


def route_after_confirmation(state: AgentState) -> Literal["execute_order", "final_response"]:
    """
    Branch after confirmation check:
    - If user explicitly confirmed, proceed to execute_order.
    - If confirmation still required, proceed to final_response to ask user for confirmation.
    """
    user_confirmed = state.get("user_confirmed", False)
    confirmation_required = state.get("confirmation_required", False)

    if user_confirmed and not confirmation_required:
        return "execute_order"
    return "final_response"