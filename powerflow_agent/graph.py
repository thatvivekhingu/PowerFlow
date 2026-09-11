"""
LangGraph StateGraph Definition for POWERFLOW Agent.
Builds and compiles the production state machine.
"""

from langgraph.graph import StateGraph, START, END
from powerflow_agent.state import AgentState
from powerflow_agent.nodes import (
    understand_request_node,
    route_request_node,
    call_tool_node,
    validate_result_node,
    analyze_result_node,
    request_confirmation_node,
    execute_order_node,
    final_response_node,
)
from powerflow_agent.router import route_after_validation, route_after_confirmation


def build_powerflow_graph():
    """
    Constructs the compiled LangGraph workflow:
    understand -> route -> call_tools -> validate -> (analyze / confirm / respond) -> (execute -> respond)
    """
    workflow = StateGraph(AgentState)

    # 1. Add All Nodes
    workflow.add_node("understand_request", understand_request_node)
    workflow.add_node("route_request", route_request_node)
    workflow.add_node("call_tool", call_tool_node)
    workflow.add_node("validate_result", validate_result_node)
    workflow.add_node("analyze_result", analyze_result_node)
    workflow.add_node("request_confirmation", request_confirmation_node)
    workflow.add_node("execute_order", execute_order_node)
    workflow.add_node("final_response", final_response_node)

    # 2. Add Fixed Directed Edges
    workflow.add_edge(START, "understand_request")
    workflow.add_edge("understand_request", "route_request")
    workflow.add_edge("route_request", "call_tool")
    workflow.add_edge("call_tool", "validate_result")

    # 3. Add Conditional Routing after Validation
    workflow.add_conditional_edges(
        "validate_result",
        route_after_validation,
        {
            "analyze_result": "analyze_result",
            "request_confirmation": "request_confirmation",
            "final_response": "final_response",
        }
    )

    # 4. Add Analysis to Final Response
    workflow.add_edge("analyze_result", "final_response")

    # 5. Add Conditional Routing after Confirmation
    workflow.add_conditional_edges(
        "request_confirmation",
        route_after_confirmation,
        {
            "execute_order": "execute_order",
            "final_response": "final_response",
        }
    )

    # 6. Add Execution to Final Response
    workflow.add_edge("execute_order", "final_response")
    workflow.add_edge("final_response", END)

    # Compile the graph
    app = workflow.compile()
    return app


# Pre-compiled application instance
powerflow_agent = build_powerflow_graph()


async def run_agent(
    user_query: str,
    user_id: str | None = None,
    meter_id: str | None = None,
    feeder_id: str | None = None,
    user_confirmed: bool = False,
    proposed_action: dict | None = None,
    conversation_history: list[dict[str, str]] | None = None,
    thread_id: str | None = None,
) -> dict:
    """
    Convenience runner executing the LangGraph agent for a single turn.
    """
    initial_state: AgentState = {
        "user_query": user_query,
        "user_id": user_id,
        "meter_id": meter_id,
        "feeder_id": feeder_id,
        "user_confirmed": user_confirmed,
        "confirmation_required": False,
        "proposed_action": proposed_action,
        "conversation_history": (conversation_history or []).copy(),
        "trace_history": [],
        "errors": [],
        "tool_calls": [],
        "tool_results": [],
        "tool_latencies": {},
    }
    return await powerflow_agent.ainvoke(initial_state)


def visualize_graph() -> str:
    """
    Return text or mermaid representation of the LangGraph workflow.
    """
    try:
        return powerflow_agent.get_graph().draw_ascii()
    except Exception:
        return (
            "POWERFLOW LangGraph Workflow:\n"
            "  START -> understand_request -> route_request -> call_tool -> validate_result\n"
            "  validate_result --(TRADE_ORDER)--> request_confirmation\n"
            "  validate_result --(MARKET/BUY)--> analyze_result -> final_response\n"
            "  validate_result --(FORECAST/INFO)--> final_response\n"
            "  request_confirmation --(confirmed)--> execute_order -> final_response\n"
            "  request_confirmation --(not confirmed)--> final_response\n"
            "  final_response -> END"
        )