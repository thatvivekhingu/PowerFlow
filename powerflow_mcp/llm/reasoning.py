"""
LLM Reasoning Engine for POWERFLOW.
Coordinates intent classification, entity extraction, multi-tool candidate selection,
grounded explanatory synthesis, grid safety explanations, and confirmation gates.
"""

import re
import json
import logging
from typing import Any, Optional

from powerflow_mcp.llm.client import local_llm_client, LocalLLMClient
from powerflow_mcp.llm.prompts import (
    POWERFLOW_SYSTEM_PROMPT,
    INTENT_EXTRACTION_PROMPT,
    EXPLANATION_SYNTHESIS_PROMPT,
)
from powerflow_mcp.llm.memory import ConversationMemory
from powerflow_mcp.llm.observability import observability_tracker
from powerflow_mcp.db.repository import HOUSEHOLDS

logger = logging.getLogger("powerflow.llm.reasoning")


class LLMReasoningEngine:
    """
    Intelligent reasoning layer operating between the user and the LangGraph/MCP tool layer.
    Extracts intent, reasons over multi-tool telemetry, synthesizes explanations,
    and enforces strict safety and anti-hallucination boundaries.
    """

    def __init__(self, client: Optional[LocalLLMClient] = None):
        self.client = client or local_llm_client

    async def understand_and_route(
        self,
        user_query: str,
        memory: Optional[ConversationMemory] = None,
        context_override: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Analyze user query, identify intent, extract entities, check for missing parameters,
        and select required MCP candidate tools.
        """
        messages = [
            {"role": "system", "content": INTENT_EXTRACTION_PROMPT},
        ]
        if memory and memory.turns:
            messages.extend(memory.get_messages_for_llm()[-4:])
        messages.append({"role": "user", "content": user_query})

        llm_raw = await self.client.chat(messages, json_mode=True)
        parsed = {}
        if llm_raw:
            try:
                parsed = json.loads(llm_raw)
            except Exception:
                parsed = {}

        # Fallback to deterministic regex & keyword extraction if Ollama output was empty or invalid
        if not parsed.get("intent"):
            parsed = self._deterministic_extract(user_query, memory)

        # Merge with context overrides if provided
        if context_override:
            for k, v in context_override.items():
                if v is not None:
                    parsed[k] = v

        # Apply conversational entity inheritance from memory
        if memory:
            parsed = memory.resolve_contextual_entities(parsed)

        # Domain normalization: resolve feeder from meter if meter is known
        meter_id = parsed.get("meter_id")
        feeder_id = parsed.get("feeder_id")
        if meter_id and meter_id in HOUSEHOLDS and not feeder_id:
            parsed["feeder_id"] = HOUSEHOLDS[meter_id]["feeder"]
        elif not meter_id and feeder_id:
            candidates = [m for m, d in HOUSEHOLDS.items() if d["feeder"] == feeder_id]
            if candidates:
                parsed["meter_id"] = candidates[0]

        # Determine candidate tools and check for missing parameters
        parsed["candidate_tools"] = self._select_candidate_tools(parsed)
        parsed["missing_parameters"] = self._check_missing_parameters(parsed)

        observability_tracker.record_decision(
            intent=parsed.get("intent", "GENERAL"),
            decision=f"Selected {len(parsed['candidate_tools'])} tools: {parsed['candidate_tools']}",
            notes=f"Missing: {parsed['missing_parameters']}"
        )

        return parsed

    def _select_candidate_tools(self, parsed: dict[str, Any]) -> list[str]:
        """Map extracted intent to minimal necessary MCP tool set."""
        intent = parsed.get("intent", "GENERAL")
        meter_id = parsed.get("meter_id")
        is_prosumer = meter_id in HOUSEHOLDS and HOUSEHOLDS[meter_id].get("type") == "prosumer"

        if intent == "FORECAST":
            tools = ["get_demand_forecast"]
            if is_prosumer:
                tools.append("get_solar_forecast")
            return tools

        elif intent == "SURPLUS_QUERY":
            return ["get_available_surplus", "get_solar_forecast", "get_grid_status"]

        elif intent == "MARKET_ANALYSIS":
            return ["get_market_price", "get_grid_status", "get_open_orders", "get_demand_forecast"]

        elif intent == "BUY_RECOMMENDATION":
            return ["get_demand_forecast", "get_market_price", "get_open_orders", "get_grid_status"]

        elif intent == "GRID_STATUS":
            return ["get_grid_status"]

        elif intent == "TRADE_ORDER":
            # For preparing proposed order, retrieve grid, market, and meter status
            return ["get_grid_status", "get_market_price", "get_meter_reading"]

        elif intent == "TRADE_STATUS":
            return ["get_trade_status"]

        elif intent == "SETTLEMENT_STATUS":
            return ["get_settlement_status"]

        else:
            return ["get_meter_reading", "get_market_price"]

    def _check_missing_parameters(self, parsed: dict[str, Any]) -> list[str]:
        """Identify if critical required parameters are missing for the intent."""
        intent = parsed.get("intent")
        missing = []

        if intent in ["FORECAST", "SURPLUS_QUERY"]:
            if not parsed.get("meter_id"):
                missing.append("meter_id")

        elif intent == "TRADE_ORDER":
            if not parsed.get("quantity_kwh"):
                missing.append("quantity_kwh")
            if not parsed.get("order_side"):
                missing.append("order_side")

        elif intent in ["TRADE_STATUS", "SETTLEMENT_STATUS"]:
            if not parsed.get("trade_id"):
                missing.append("trade_id")

        return missing

    def _deterministic_extract(self, query: str, memory: Optional[ConversationMemory] = None) -> dict[str, Any]:
        """Robust grounded fallback entity and intent parser."""
        q = query.lower()

        # Extract meter ID
        meter_match = re.search(r"\b([hm]\d{2,4})\b", q, re.IGNORECASE)
        meter_id = meter_match.group(1).upper() if meter_match else None
        if meter_id == "M101":
            meter_id = "H011"

        # Extract feeder ID
        feeder_match = re.search(r"\b(feeder-[abc]|feeder\s+[abc])\b", q, re.IGNORECASE)
        feeder_id = None
        if feeder_match:
            raw = feeder_match.group(1).upper().replace(" ", "-")
            feeder_id = raw if "FEEDER-" in raw else f"FEEDER-{raw[-1]}"

        # Extract trade ID
        trade_match = re.search(r"\b(trd-\d{4}-\d{4})\b", q, re.IGNORECASE)
        trade_id = trade_match.group(1).upper() if trade_match else None

        # Extract quantity
        qty_match = re.search(r"(\d+(\.\d+)?)\s*kwh", q, re.IGNORECASE)
        qty = float(qty_match.group(1)) if qty_match else None

        # Extract price
        price_match = re.search(r"(?:₹|inr|rs\.?|at)\s*(\d+(\.\d+)?)", q, re.IGNORECASE)
        price = float(price_match.group(1)) if price_match else None

        # Handle follow-up quantities like "what about 3 kwh?" or "what about 2 kwh instead?"
        if not qty:
            followup_match = re.search(r"(?:what about|how about|instead|change to)\s*(\d+(\.\d+)?)", q, re.IGNORECASE)
            if followup_match:
                qty = float(followup_match.group(1))

        # Classify intent
        intent = "GENERAL"
        order_side = None

        if any(w in q for w in ["settlement", "payout", "escrow", "wheeling fee"]):
            intent = "SETTLEMENT_STATUS"
        elif any(w in q for w in ["trade status", "order status", "delivery status", "trd-"]):
            intent = "TRADE_STATUS"
        elif any(w in q for w in ["create", "place", "order", "sell order", "buy order"]):
            intent = "TRADE_ORDER"
            order_side = "SELL" if "sell" in q else "BUY"
        elif any(w in q for w in ["should i buy", "recommend", "buy energy now", "advice"]):
            intent = "BUY_RECOMMENDATION"
            order_side = "BUY"
        elif any(w in q for w in ["why is the", "price high", "market price", "local price", "tariff", "pricing", "market analysis"]):
            intent = "MARKET_ANALYSIS"
        elif any(w in q for w in ["surplus", "excess solar", "solar availability", "solar generation", "pv generation"]):
            intent = "SURPLUS_QUERY"
        elif any(w in q for w in ["demand", "forecast", "load", "consumption", "expected"]):
            intent = "FORECAST"
        elif any(w in q for w in ["grid", "headroom", "capacity", "congestion", "transformer"]):
            intent = "GRID_STATUS"

        # Check if query is a follow-up adjusting an earlier recommendation or trade
        if memory and memory.last_order_side and not order_side and ("kwh" in q or "instead" in q):
            intent = "BUY_RECOMMENDATION" if memory.last_order_side == "BUY" else "TRADE_ORDER"
            order_side = memory.last_order_side

        return {
            "intent": intent,
            "meter_id": meter_id,
            "feeder_id": feeder_id,
            "user_id": meter_id or "H011",
            "order_side": order_side,
            "quantity_kwh": qty,
            "target_price": price,
            "trade_id": trade_id,
            "missing_parameters": [],
            "candidate_tools": [],
        }

    def explain_grid_congestion(self, grid_data: dict[str, Any], feeder_id: str) -> str:
        """Provide detailed, domain-grounded explanation of grid conditions and DISCOM safety rules."""
        util = grid_data.get("utilization_pct", 0.0)
        level = grid_data.get("congestion_level", "UNKNOWN")
        headroom = grid_data.get("available_headroom_kw", 0.0)
        decision = grid_data.get("trade_decision", "TRADE_ALLOWED")

        explanation = (
            f"[GRID SAFETY ANALYSIS] Feeder '{feeder_id}':\n"
            f"  * Headroom: {headroom} kW available\n"
            f"  * Feeder Utilization: {util}% ({level})\n"
            f"  * DISCOM Trade Decision: {decision}\n\n"
        )
        if decision == "TRADE_REJECTED" or util > 90.0:
            explanation += (
                "Explanation: The distribution feeder is operating near its thermal rating. "
                "DISCOM safety protocols strictly halt new P2P trade registrations to prevent transformer damage and voltage sags."
            )
        else:
            explanation += (
                "Explanation: Feeder electrical parameters are within safe IEEE 1547 and CEA operating limits. "
                "P2P trades are actively approved."
            )
        return explanation

    def explain_market_price(self, market_data: dict[str, Any], feeder_id: str) -> str:
        """Explain the dynamic pricing factors behind the current P2P price."""
        price = market_data.get("indicative_price_inr_per_kwh", 5.0)
        base = market_data.get("base_price_inr_per_kwh", 5.0)
        floor = market_data.get("price_floor_inr_per_kwh", 3.0)
        cap = market_data.get("price_cap_inr_per_kwh", 8.0)
        wheeling = market_data.get("discom_wheeling_charge_inr", 0.25)
        ratio = market_data.get("demand_supply_ratio", 1.0)

        return (
            f"[MARKET PRICING EXPLANATION] Feeder '{feeder_id}':\n"
            f"  * Current P2P Clearing Price: INR {price} / kWh\n"
            f"  * Base Tariff: INR {base} / kWh\n"
            f"  * Regulatory Bounds: Floor: INR {floor} | Cap: INR {cap}\n"
            f"  * DISCOM Wheeling Surcharge: INR {wheeling} / kWh\n"
            f"  * Local Demand/Supply Ratio: {ratio:.2f}\n\n"
            f"Pricing Mechanics:\n"
            f"1. Demand Pressure: Ratio is {ratio:.2f}. Higher local demand pulls price toward the cap.\n"
            f"2. Regulatory Guardrail: Price is strictly clamped between INR {floor} and INR {cap}/kWh.\n"
            f"3. DISCOM Delivery Fee: An automated INR {wheeling}/kWh fee is added for distribution network utilization."
        )


llm_reasoning_engine = LLMReasoningEngine()
