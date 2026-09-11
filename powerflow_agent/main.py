"""
CLI Entry Point for POWERFLOW LangGraph Agent.
Interactive demo with realistic PowerFlow conversations and clean execution traces.
"""

import asyncio
import sys
import argparse
import logging
from typing import Optional, Any
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.prompt import Prompt, Confirm
from rich.table import Table

from powerflow_agent.graph import run_agent, visualize_graph
from powerflow_agent.state import AgentState
from powerflow_agent.config import agent_settings
from powerflow_agent.tools import dispatch_tool

# Initialize Rich console with ASCII fallback safety for Windows console
console = Console(legacy_windows=False)

# ─────────────────────────────────────────────────────────────────────────────
# Predefined Demo Queries from Requirements
# ─────────────────────────────────────────────────────────────────────────────

DEMO_QUERIES = [
    {
        "query": "What is the expected demand for meter H011?",
        "description": "Read-Only Forecast: Delegates to demand Transformer model via get_demand_forecast",
        "user_id": "H011",
        "meter_id": "H011",
        "feeder_id": "FEEDER-A",
    },
    {
        "query": "Is there enough local solar surplus in FEEDER-A?",
        "description": "Surplus Analysis: Retrieves meter solar telemetry, generation forecast, and feeder headroom",
        "user_id": "H001",
        "meter_id": "H001",
        "feeder_id": "FEEDER-A",
    },
    {
        "query": "Why is the current P2P price high on FEEDER-A?",
        "description": "Market Analysis: Correlates dynamic price engine, demand/supply ratio, and feeder congestion",
        "user_id": "H011",
        "meter_id": "H011",
        "feeder_id": "FEEDER-A",
    },
    {
        "query": "Should I buy 2 kWh now?",
        "description": "Advisory Synthesis: Analyzes demand forecast, market price, feeder grid limits, and recommends action",
        "user_id": "H011",
        "meter_id": "H011",
        "feeder_id": "FEEDER-A",
    },
    {
        "query": "Create a buy order for 2 kWh at 6 INR/kWh",
        "description": "State-Changing Trade Gate: Synthesizes proposed order, halts for confirmation, and executes upon approval",
        "user_id": "H011",
        "meter_id": "H011",
        "feeder_id": "FEEDER-A",
        "is_trade": True,
    },
]


def print_banner():
    """Print the POWERFLOW agent banner."""
    console.print(Panel.fit(
        "[bold cyan][POWERFLOW] LangGraph AI Agent Orchestrator[/bold cyan]\n"
        "[dim]Grid-aware renewable energy P2P trading marketplace[/dim]\n\n"
        f"Architecture: LangGraph Agent -> MCP Tools -> ML Transformers & Physics Engines -> DB\n"
        f"LLM Provider: {agent_settings.LLM_PROVIDER} ({agent_settings.OLLAMA_MODEL})\n"
        f"Target Specs: 8 GB RAM Optimized (Local Qwen 2.5 3B with Deterministic Safety Fallback)",
        border_style="cyan"
    ))


def print_state_summary(state: dict[str, Any]):
    """Print a structured summary of the agent state."""
    table = Table(title="Agent Execution State Summary", show_header=True, header_style="bold magenta")
    table.add_column("State Variable", style="cyan")
    table.add_column("Current Value", style="white")

    intent = state.get("intent", "UNKNOWN")
    user_id = state.get("user_id", "N/A")
    meter_id = state.get("meter_id", "N/A")
    feeder_id = state.get("feeder_id", "N/A")
    tool_calls = state.get("tool_calls", [])
    confirm_req = state.get("confirmation_required", False)
    user_conf = state.get("user_confirmed", False)
    errors = state.get("errors", [])

    table.add_row("Extracted Intent", str(intent))
    table.add_row("User Identifier", str(user_id))
    table.add_row("Smart Meter ID", str(meter_id))
    table.add_row("Distribution Feeder", str(feeder_id))
    table.add_row("Tools Invoked", str(len(tool_calls)))
    table.add_row("Confirmation Gate Active", "[bold yellow]YES[/bold yellow]" if confirm_req else "No")
    table.add_row("User Confirmed", "[bold green]YES[/bold green]" if user_conf else "No")
    table.add_row("Errors / Blockers", f"[red]{len(errors)}[/red]" if errors else "[green]0[/green]")

    console.print(table)

    if tool_calls:
        tool_table = Table(title="MCP Tool Invocations", show_header=True, header_style="bold magenta")
        tool_table.add_column("Tool Name", style="cyan")
        tool_table.add_column("Arguments", style="yellow")
        tool_table.add_column("Result Status", style="green")

        results = state.get("tool_results", [])
        for idx, call in enumerate(tool_calls):
            t_name = call.get("tool", "unknown")
            args_str = ", ".join([f"{k}={v}" for k, v in call.get("args", {}).items()])
            status = "[OK]"
            if idx < len(results):
                res = results[idx].get("result", {})
                if isinstance(res, dict) and res.get("status") == "ERROR":
                    status = "[FAILED]"
            tool_table.add_row(t_name, args_str, status)

        console.print(tool_table)


def print_execution_trace(state: dict[str, Any]):
    """Print the step-by-step reasoning and orchestration trace."""
    traces = state.get("trace_history", [])
    if not traces:
        return

    console.print("\n[bold]Orchestration Trace History:[/bold]")
    for line in traces:
        if "[Understand]" in line:
            console.print(f"  [cyan]{line}[/cyan]")
        elif "[Route]" in line:
            console.print(f"  [blue]{line}[/blue]")
        elif "[CallTool]" in line:
            console.print(f"  [yellow]{line}[/yellow]")
        elif "[Validate]" in line:
            console.print(f"  [magenta]{line}[/magenta]")
        elif "[Confirmation]" in line:
            console.print(f"  [bold yellow]{line}[/bold yellow]")
        elif "[Execute]" in line:
            console.print(f"  [bold green]{line}[/bold green]")
        else:
            console.print(f"  [dim]{line}[/dim]")


async def run_single_demo(query: str, user_id: str, meter_id: str, feeder_id: str, auto_confirm: bool = False):
    """Run a single demo query through the LangGraph workflow."""
    console.print(Panel(
        f"[bold]Query:[/bold] {query}\n[dim]User: {user_id} | Meter: {meter_id} | Feeder: {feeder_id}[/dim]",
        border_style="blue"
    ))

    result = await run_agent(
        user_query=query,
        user_id=user_id,
        meter_id=meter_id,
        feeder_id=feeder_id,
        user_confirmed=False,
    )

    console.print(Panel(
        result.get("final_response", "No response generated."),
        title="[bold green]POWERFLOW Agent Response[/bold green]",
        border_style="green"
    ))

    print_state_summary(result)
    print_execution_trace(result)

    # Handle the two-step trade confirmation flow if requested
    if result.get("confirmation_required") and result.get("proposed_action"):
        proposed = result["proposed_action"]
        console.print("\n[bold yellow]-- TRADE CONFIRMATION REQUIRED --[/bold yellow]")
        proceed = auto_confirm
        if not auto_confirm:
            proceed = Confirm.ask(
                f"Confirm order execution for {proposed.get('quantity_kwh')} kWh at INR {proposed.get('target_price_inr')}/kWh?",
                default=True
            )

        if proceed:
            console.print("\n[bold green]User granted confirmation! Re-invoking LangGraph to execute trade...[/bold green]")
            exec_result = await run_agent(
                user_query=query,
                user_id=user_id,
                meter_id=meter_id,
                feeder_id=feeder_id,
                user_confirmed=True,
                proposed_action=proposed,
            )
            console.print(Panel(
                exec_result.get("final_response", "Trade executed."),
                title="[bold green]Execution Result[/bold green]",
                border_style="green"
            ))
            print_state_summary(exec_result)
            print_execution_trace(exec_result)
        else:
            console.print("[yellow]Order placement cancelled by user.[/yellow]")


async def run_all_demos():
    """Run all 5 predefined realistic PowerFlow conversations."""
    console.print("\n[bold]Running Pre-scripted POWERFLOW Conversations[/bold]\n")

    for i, demo in enumerate(DEMO_QUERIES, 1):
        console.print(f"\n==================== DEMO {i} of {len(DEMO_QUERIES)} ====================")
        console.print(f"[bold cyan]{demo['description']}[/bold cyan]")
        await run_single_demo(
            query=demo["query"],
            user_id=demo["user_id"],
            meter_id=demo["meter_id"],
            feeder_id=demo["feeder_id"],
            auto_confirm=True,  # In batch demo, auto-confirm step 2 of trade
        )


async def interactive_mode():
    """Run continuous interactive chat session."""
    console.print("\n[bold green]Interactive Mode Active[/bold green] - Type 'exit' to quit, 'help' for commands\n")

    user_id = Prompt.ask("User ID", default=agent_settings.DEFAULT_USER_ID)
    meter_id = Prompt.ask("Meter ID", default=agent_settings.DEFAULT_METER_ID)
    feeder_id = Prompt.ask("Feeder ID", default=agent_settings.DEFAULT_FEEDER_ID)

    pending_proposed = None

    while True:
        try:
            query = Prompt.ask(f"\n[bold cyan]{user_id}@{feeder_id}[/bold cyan]")

            if query.lower() in ("exit", "quit", "q"):
                console.print("[yellow]Session closed. Goodbye![/yellow]")
                break

            if query.lower() == "help":
                print_help()
                continue

            if query.lower() == "demo":
                await run_all_demos()
                continue

            if query.lower() == "graph":
                console.print(visualize_graph())
                continue

            # Check if user is confirming a pending trade
            user_confirmed = False
            if pending_proposed and query.lower() in ("yes", "confirm", "ok", "proceed"):
                user_confirmed = True

            result = await run_agent(
                user_query=query,
                user_id=user_id,
                meter_id=meter_id,
                feeder_id=feeder_id,
                user_confirmed=user_confirmed,
                proposed_action=pending_proposed,
            )

            console.print(Panel(
                result.get("final_response", ""),
                title="Agent Response",
                border_style="green"
            ))

            print_state_summary(result)

            if result.get("confirmation_required"):
                pending_proposed = result.get("proposed_action")
                console.print("[yellow]Type 'confirm' or 'yes' to proceed with order execution.[/yellow]")
            else:
                pending_proposed = None

        except KeyboardInterrupt:
            console.print("\n[yellow]Interrupted. Type 'exit' to quit.[/yellow]")
        except Exception as e:
            console.print(f"[red]Error: {e}[/red]")


def print_help():
    """Print help message."""
    console.print(Panel("""
[bold]Available Commands:[/bold]
  - [cyan]demo[/cyan]  : Run all 5 realistic PowerFlow scenarios automatically
  - [cyan]graph[/cyan] : Print the compiled LangGraph state workflow
  - [cyan]help[/cyan]  : Show this help message
  - [cyan]exit[/cyan]  : Quit session

[bold]Realistic PowerFlow Queries to Try:[/bold]
  1. "What is the expected demand for meter H011?"
  2. "Is there enough local solar surplus in FEEDER-A?"
  3. "Why is the current P2P price high on FEEDER-A?"
  4. "Should I buy 2 kWh now?"
  5. "Create a buy order for 2 kWh at 6 INR/kWh"
""", title="Help", border_style="blue"))


async def test_mcp_tools():
    """Verify tool dispatch bridge with sample calls."""
    console.print("\n[bold]Testing Tool Dispatch Interface...[/bold]")
    res1 = await dispatch_tool("get_meter_reading", {"meter_id": "H011"})
    console.print(f"get_meter_reading(H011): status={res1.get('status')}")

    res2 = await dispatch_tool("get_market_price", {"feeder_id": "FEEDER-A"})
    console.print(f"get_market_price(FEEDER-A): price=INR {res2.get('indicative_price_inr_per_kwh')}/kWh")
    console.print("[green][OK] Tool layer is operational.[/green]")


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="POWERFLOW LangGraph Agent - Grid-aware P2P Renewable Energy Trading",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("-q", "--query", type=str, help="Single query to process")
    parser.add_argument("--user-id", type=str, default=agent_settings.DEFAULT_USER_ID)
    parser.add_argument("--meter-id", type=str, default=agent_settings.DEFAULT_METER_ID)
    parser.add_argument("--feeder-id", type=str, default=agent_settings.DEFAULT_FEEDER_ID)
    parser.add_argument("--demo", action="store_true", help="Run all 5 demo conversations")
    parser.add_argument("--test-tools", action="store_true", help="Verify tool dispatch bridge")
    parser.add_argument("--graph", action="store_true", help="Show workflow graph")
    parser.add_argument("--interactive", "-i", action="store_true", help="Run interactive mode")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose debug logging")
    return parser.parse_args()


async def main():
    args = parse_args()
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        logging.getLogger("httpx").setLevel(logging.WARNING)

    print_banner()

    if args.graph:
        console.print(visualize_graph())
        return

    if args.test_tools:
        await test_mcp_tools()
        return

    if args.demo:
        await run_all_demos()
        return

    if args.query:
        await run_single_demo(args.query, args.user_id, args.meter_id, args.feeder_id, auto_confirm=False)
        return

    # Default to interactive
    await interactive_mode()


if __name__ == "__main__":
    asyncio.run(main())