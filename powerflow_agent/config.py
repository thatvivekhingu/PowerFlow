"""
Configuration for POWERFLOW LangGraph AI Agent.
Loads settings from environment variables with sensible local defaults for an 8 GB RAM machine.
"""

from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AgentSettings(BaseSettings):
    """Configuration for local LLM and agent orchestration."""

    # LLM Settings (Optimized for 8GB RAM with Qwen 2.5 3B)
    LLM_PROVIDER: str = Field(default="ollama", description="'ollama', 'openai_compatible', or 'rule_guided'")
    OLLAMA_BASE_URL: str = Field(default="http://localhost:11434", description="Ollama local daemon URL")
    OLLAMA_MODEL: str = Field(default="qwen2.5:3b", description="Default local LLM model name")
    TEMPERATURE: float = Field(default=0.1, description="Low temperature for deterministic tool routing")
    MAX_TOKENS: int = Field(default=1024, description="Maximum tokens for agent response generation")
    LLM_TIMEOUT_SECONDS: float = Field(default=12.0, description="Ollama API request timeout")

    # Domain Defaults
    DEFAULT_FEEDER_ID: str = "FEEDER-A"
    DEFAULT_METER_ID: str = "H011"
    DEFAULT_USER_ID: str = "H011"

    # Execution Guardrails
    MAX_TOOL_CALLS_PER_RUN: int = 6
    REQUIRE_TRADE_CONFIRMATION: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


agent_settings = AgentSettings()