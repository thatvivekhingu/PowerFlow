"""
POWERFLOW LLM Reasoning Layer.
Modular intelligence package interfacing local Ollama (Qwen 2.5 3B Instruct)
with the POWERFLOW LangGraph Agent and MCP Tool Server.
"""

from powerflow_mcp.llm.config import LLMConfig, llm_config
from powerflow_mcp.llm.client import LocalLLMClient, local_llm_client
from powerflow_mcp.llm.memory import ConversationMemory, ConversationTurn
from powerflow_mcp.llm.observability import ObservabilityTracker, observability_tracker, sanitize_pii
from powerflow_mcp.llm.reasoning import LLMReasoningEngine, llm_reasoning_engine
from powerflow_mcp.llm.prompts import (
    POWERFLOW_SYSTEM_PROMPT,
    INTENT_EXTRACTION_PROMPT,
    EXPLANATION_SYNTHESIS_PROMPT,
)

__all__ = [
    "LLMConfig",
    "llm_config",
    "LocalLLMClient",
    "local_llm_client",
    "ConversationMemory",
    "ConversationTurn",
    "ObservabilityTracker",
    "observability_tracker",
    "sanitize_pii",
    "LLMReasoningEngine",
    "llm_reasoning_engine",
    "POWERFLOW_SYSTEM_PROMPT",
    "INTENT_EXTRACTION_PROMPT",
    "EXPLANATION_SYNTHESIS_PROMPT",
]
