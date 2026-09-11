"""
Conversation Context and Bounded Memory for POWERFLOW LLM.
Retains multi-turn conversation state, extracted entities, and contextual references
while preventing unbounded memory growth on 8 GB RAM systems.
"""

from typing import Any, Optional
from pydantic import BaseModel, Field

from powerflow_mcp.llm.config import llm_config


class ConversationTurn(BaseModel):
    """Single turn in a conversation."""
    role: str  # "user" or "assistant"
    content: str
    intent: Optional[str] = None
    entities: dict[str, Any] = Field(default_factory=dict)


class ConversationMemory:
    """
    Manages bounded multi-turn conversation history and persistent contextual entities.
    Enables follow-ups such as 'What about 2 kWh instead?' or 'Confirm the trade'.
    """

    def __init__(self, max_turns: int = 10):
        self.max_turns = max_turns or llm_config.MAX_CONVERSATION_TURNS
        self.turns: list[ConversationTurn] = []
        
        # Persistent session entities
        self.active_user_id: Optional[str] = None
        self.active_meter_id: Optional[str] = None
        self.active_feeder_id: Optional[str] = None
        self.last_order_side: Optional[str] = None
        self.last_quantity_kwh: Optional[float] = None
        self.last_target_price: Optional[float] = None
        self.last_proposed_action: Optional[dict[str, Any]] = None

    def add_user_turn(self, query: str):
        """Record user input."""
        self.turns.append(ConversationTurn(role="user", content=query))
        self._prune()

    def add_assistant_turn(self, response: str, intent: Optional[str] = None, entities: Optional[dict[str, Any]] = None):
        """Record assistant response and update session entities."""
        ent = entities or {}
        self.turns.append(ConversationTurn(
            role="assistant",
            content=response,
            intent=intent,
            entities=ent
        ))

        # Update persistent entities if extracted
        if ent.get("meter_id"):
            self.active_meter_id = ent["meter_id"]
        if ent.get("user_id"):
            self.active_user_id = ent["user_id"]
        if ent.get("feeder_id"):
            self.active_feeder_id = ent["feeder_id"]
        if ent.get("order_side"):
            self.last_order_side = ent["order_side"]
        if ent.get("quantity_kwh"):
            self.last_quantity_kwh = ent["quantity_kwh"]
        if ent.get("target_price"):
            self.last_target_price = ent["target_price"]

        self._prune()

    def get_messages_for_llm(self) -> list[dict[str, str]]:
        """Return formatted message history for LLM chat API."""
        return [{"role": t.role, "content": t.content} for t in self.turns]

    def resolve_contextual_entities(self, extracted: dict[str, Any]) -> dict[str, Any]:
        """
        Merge extracted entities with persistent session context to support follow-ups.
        For example, if query is 'What about 3 kWh?', inherit the existing meter_id and feeder_id.
        """
        resolved = extracted.copy()

        if not resolved.get("meter_id") and self.active_meter_id:
            resolved["meter_id"] = self.active_meter_id
        if not resolved.get("user_id") and self.active_user_id:
            resolved["user_id"] = self.active_user_id
        if not resolved.get("feeder_id") and self.active_feeder_id:
            resolved["feeder_id"] = self.active_feeder_id

        # Update active state if new entities are present
        if resolved.get("meter_id"):
            self.active_meter_id = resolved["meter_id"]
        if resolved.get("feeder_id"):
            self.active_feeder_id = resolved["feeder_id"]
        if resolved.get("user_id"):
            self.active_user_id = resolved["user_id"]
        if resolved.get("quantity_kwh"):
            self.last_quantity_kwh = resolved["quantity_kwh"]
        if resolved.get("target_price"):
            self.last_target_price = resolved["target_price"]

        return resolved

    def _prune(self):
        """Keep only the most recent N turns to prevent unbounded memory growth."""
        if len(self.turns) > self.max_turns * 2:
            self.turns = self.turns[-self.max_turns * 2:]

    def clear(self):
        """Reset conversation memory."""
        self.turns.clear()
        self.active_user_id = None
        self.active_meter_id = None
        self.active_feeder_id = None
        self.last_order_side = None
        self.last_quantity_kwh = None
        self.last_target_price = None
        self.last_proposed_action = None
