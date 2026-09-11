"""
Interactive CLI for POWERFLOW LLM Reasoning Layer.
Demonstrates multi-turn natural language conversation with local Qwen 2.5 3B,
real MCP tool calls, latency telemetry, bounded context memory, and safety gates.
"""

import sys
from pathlib import Path

# Ensure project root is on sys.path for direct script execution
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import asyncio
import argparse
import logging
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt, Confirm

from powerflow_agent.graph import run_agent, visualize_graph
from powerflow_mcp.llm import (
    llm_config,
    local_llm_client,
    ConversationMemory,
    observability_tracker,
    sanitize_pii,
)

# Initialize console with legacy Windows safety
console = Console(legacy_windows=False)


DEMO_CONVERSATION_TURNS = [
    {
        "step": 1,
        "query": "What is the expected demand for meter H011?",
        "note": "Turn 1: Initial query establishing meter H011 on FEEDER-A.",
    },
    {
        "step": 2,
        "query": "Is there enough local solar surplus?",
        "note": "Turn 2: Follow-up query inheriting meter H011 and FEEDER-A from conversation memory.",
    },
    {
        "step": 3,
        "query": "Should I buy 2 kWh now?",
        "note": "Turn 3: Advisory query synthesizing forecast, market price, and feeder headroom.",
    },
    {
        "step": 4,
        "query": "What about 3 kWh instead?",
        "note": "Turn 4: Conversational follow-up updating quantity from 2 kWh to 3 kWh.",
    },
    {
        "step": 5,
        "query": "Create a buy order for 3 kWh at 6 INR/kWh",
        "note": "Turn 5: State-changing order request halting for explicit user confirmation.",
        "is_trade_step": True,
    },
    {
        "step": 6,
        "query": "Check trade status for TRD-2026-0001",
        "note": "Turn 6: Real-time trade status lookup via get_trade_status.",
    },
    {
        "step": 7,
        "query": "Check settlement status for TRD-2026-0001",
        "note": "Turn 7: Post-delivery settlement and DISCOM fee verification via get_settlement_status.",
    },
]


def print_banner(ollama_online: bool):
    """Print the POWERFLOW LLM agent banner."""
    ollama_status = "[bold green]ONLINE[/bold green]" if ollama_online else "[bold yellow]OFFLINE (Deterministic Fallback Active)[/bold yellow]"
    console.print(Panel.fit(
        "[bold cyan][POWERFLOW] LLM Reasoning Layer & Agent CLI[/bold cyan]\n"
        "[dim]Grid-aware P2P Renewable Energy Trading Marketplace[/dim]\n\n"
        f"Architecture: User -> LLM Reasoning -> LangGraph -> MCP Tools -> ML/Grid -> DB\n"
        f"LLM Provider: {llm_config.LLM_PROVIDER} ({llm_config.OLLAMA_MODEL})\n"
        f"Ollama Daemon: {ollama_status} ({llm_config.OLLAMA_BASE_URL})\n"
        f"Target Specs: 8 GB RAM Optimized | Anti-Hallucination Safe | PII Sanitized",
        border_style="cyan"
    ))


def display_turn_telemetry(result: dict):
    """Display latency, tool invocations, and state metrics for a single turn."""
    latencies = result.get("tool_latencies", {})
    tool_calls = result.get("tool_calls", [])

    if tool_calls:
        table = Table(title="MCP Tool Executions & Latency", show_header=True, header_style="bold magenta")
        table.add_column("Tool Name", style="cyan")
        table.add_column("Arguments", style="yellow")
        table.add_column("Latency (ms)", style="green")

        for call in tool_calls:
            t_name = call.get("tool", "unknown")
            args_str = ", ".join([f"{k}={v}" for k, v in sanitize_pii(call.get("args", {})).items()])
            lat = f"{latencies.get(t_name, 0.0):.1f} ms"
            table.add_row(t_name, args_str, lat)

        console.print(table)


async def run_multi_turn_demo():
    """Run predefined realistic multi-turn conversation showing context memory."""
    console.print("\n[bold]Running Multi-Turn Conversation Demo with Context Memory[/bold]\n")

    history = []
    pending_proposed = None

    for item in DEMO_CONVERSATION_TURNS:
        step = item["step"]
        query = item["query"]
        note = item["note"]

        console.print(f"\n------------------------------------------------------------")
        console.print(f"[bold cyan]Step {step}:[/bold cyan] {note}")
        console.print(f"[bold white]User Query:[/bold white] \"{query}\"")

        # Execute through LangGraph with full conversation history
        result = await run_agent(
            user_query=query,
            user_confirmed=False,
            proposed_action=pending_proposed,
            conversation_history=history,
        )

        # Update persistent history
        history = result.get("conversation_history", [])

        console.print(Panel(
            result.get("final_response", ""),
            title=f"[bold green]POWERFLOW Response (Turn {step})[/bold green]",
            border_style="green"
        ))

        display_turn_telemetry(result)

        # Handle two-step trade confirmation demonstration for Step 5
        if item.get("is_trade_step") and result.get("confirmation_required"):
            pending_proposed = result.get("proposed_action")
            console.print("\n[bold yellow]-- State-Changing Order Safety Gate Active --[/bold yellow]")
            console.print("[dim]The agent prepared a proposed action but halted without placing the trade.[/dim]")
            console.print("[bold green]Simulating explicit user confirmation: 'Yes, proceed with order'[/bold green]")

            confirmed_result = await run_agent(
                user_query="Yes, confirm order",
                user_confirmed=True,
                proposed_action=pending_proposed,
                conversation_history=history,
            )
            history = confirmed_result.get("conversation_history", [])
            pending_proposed = None

            console.print(Panel(
                confirmed_result.get("final_response", ""),
                title="[bold green]Execution Result After Explicit Confirmation[/bold green]",
                border_style="green"
            ))
            display_turn_telemetry(confirmed_result)


async def interactive_mode():
    """Run live multi-turn interactive session."""
    console.print("\n[bold green]Live Interactive Session Active[/bold green]")
    console.print("Type your questions naturally. Type 'exit' to quit, 'clear' to reset memory, 'demo' for scripted demo.\n")

    history = []
    pending_proposed = None

    while True:
        try:
            query = Prompt.ask("\n[bold cyan]You[/bold cyan]")
            if not query.strip():
                continue

            q_lower = query.lower().strip()
            if q_lower in ["exit", "quit", "q"]:
                console.print("[yellow]Session closed. Goodbye![/yellow]")
                break
            elif q_lower == "clear":
                history.clear()
                pending_proposed = None
                console.print("[green]Conversation memory cleared.[/green]")
                continue
            elif q_lower == "demo":
                await run_multi_turn_demo()
                continue
            elif q_lower == "graph":
                console.print(visualize_graph())
                continue

            # Check if user is confirming a pending trade
            user_confirmed = False
            if pending_proposed and q_lower in ["yes", "confirm", "ok", "proceed", "place order"]:
                user_confirmed = True

            result = await run_agent(
                user_query=query,
                user_confirmed=user_confirmed,
                proposed_action=pending_proposed,
                conversation_history=history,
            )

            history = result.get("conversation_history", [])

            console.print(Panel(
                result.get("final_response", ""),
                title="[bold green]POWERFLOW Agent[/bold green]",
                border_style="green"
            ))

            display_turn_telemetry(result)

            if result.get("confirmation_required"):
                pending_proposed = result.get("proposed_action")
                console.print("[yellow]Reply 'confirm' to execute this order, or ask a question to cancel.[/yellow]")
            else:
                pending_proposed = None

        except KeyboardInterrupt:
            console.print("\n[yellow]Interrupted. Goodbye![/yellow]")
            break
        except Exception as e:
            console.print(f"[red]Error: {e}[/red]")


async def main():
    parser = argparse.ArgumentParser(description="POWERFLOW LLM Reasoning Layer CLI")
    parser.add_argument("--demo", action="store_true", help="Run multi-turn context memory demo")
    parser.add_argument("-q", "--query", type=str, help="Single query to process")
    parser.add_argument("--check-ollama", action="store_true", help="Check local Ollama status")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose debug logging")
    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        logging.getLogger("httpx").setLevel(logging.WARNING)

    ollama_online = await local_llm_client.is_available()

    if args.check_ollama:
        console.print(f"Ollama URL: {llm_config.OLLAMA_BASE_URL}")
        console.print(f"Ollama Online: {ollama_online}")
        if ollama_online:
            models = await local_llm_client.list_models()
            console.print(f"Available Models: {models}")
        return

    print_banner(ollama_online)

    if args.demo:
        await run_multi_turn_demo()
        return

    if args.query:
        result = await run_agent(user_query=args.query)
        console.print(Panel(
            result.get("final_response", ""),
            title="POWERFLOW Agent Response",
            border_style="green"
        ))
        display_turn_telemetry(result)
        return

    # Default to interactive
    await interactive_mode()


if __name__ == "__main__":
    asyncio.run(main())
