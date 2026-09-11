"""
State Definition for POWERFLOW LangGraph Agent.
Defines strongly typed data structures tracking conversation context, intent, tool executions, and decisions.
"""

from typing import TypedDict, Optional, Any, Literal


class AgentState(TypedDict, total=False):
    """
    Complete state representation passed across all LangGraph nodes.
    Maintains clean separation between user input, extracted entities,
    conversation context, service data, confirmation gates, and final responses.
    """
    # User Input & Intent
    user_query: str
    intent: str  # FORECAST, MARKET_ANALYSIS, BUY_RECOMMENDATION, TRADE_ORDER, SURPLUS_QUERY, GRID_STATUS, TRADE_STATUS, SETTLEMENT_STATUS, GENERAL
    
    # Extracted Domain Entities
    user_id: Optional[str]
    meter_id: Optional[str]
    feeder_id: Optional[str]
    order_side: Optional[Literal["BUY", "SELL"]]
    quantity_kwh: Optional[float]
    target_price: Optional[float]
    trade_id: Optional[str]
    missing_parameters: list[str]

    # Bounded Multi-Turn Conversation Context
    conversation_history: list[dict[str, str]]

    # Execution Tracking
    pending_tools: list[dict[str, Any]]      # Tools scheduled to be called: [{"tool": "...", "args": {...}}]
    tool_calls: list[dict[str, Any]]         # History of tool calls executed
    tool_results: list[dict[str, Any]]       # Raw results returned by tools
    tool_latencies: dict[str, float]         # Execution time per tool in milliseconds

    # Specialized Domain Payloads
    demand_forecast_data: Optional[dict[str, Any]]
    solar_forecast_data: Optional[dict[str, Any]]
    market_data: Optional[dict[str, Any]]
    grid_data: Optional[dict[str, Any]]
    surplus_data: Optional[dict[str, Any]]
    meter_reading_data: Optional[dict[str, Any]]
    trade_status_data: Optional[dict[str, Any]]
    settlement_status_data: Optional[dict[str, Any]]

    # State-Changing Gates
    proposed_action: Optional[dict[str, Any]]  # Synthesized proposed order waiting for confirmation
    confirmation_required: bool                # True if action cannot proceed without user OK
    user_confirmed: bool                       # True if user explicitly granted permission
    order_result: Optional[dict[str, Any]]     # Result of executed order

    # Safety, Observability & Output
    errors: list[str]                          # Any errors encountered along the graph
    trace_history: list[str]                   # Step-by-step reasoning & execution trace
    reasoning_summary: Optional[str]           # Intermediate synthesis summary
    final_response: Optional[str]              # Final natural language output for the user