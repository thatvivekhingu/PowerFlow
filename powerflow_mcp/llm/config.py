"""
Configuration for POWERFLOW LLM Reasoning Layer.
Loads settings from environment variables with sensible defaults for local Ollama on an 8 GB RAM machine.
"""

from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class LLMConfig(BaseSettings):
    """Configuration parameters for Ollama LLM reasoning engine."""

    # Provider & Model Settings
    LLM_PROVIDER: Literal["groq", "ollama", "openai_compatible", "rule_guided"] = Field(
        default="groq",
        description="LLM provider backend (groq, ollama, openai_compatible, rule_guided)"
    )
    GROQ_API_KEY: str = Field(
        default="",
        description="Groq Cloud API Key (set via GROQ_API_KEY env or .env file)"
    )
    GROQ_BASE_URL: str = Field(
        default="https://api.groq.com/openai/v1",
        description="Groq API base URL"
    )
    GROQ_MODEL: str = Field(
        default="groq/compound-mini",
        description="Fast free Groq model (e.g. groq/compound-mini, openai/gpt-oss-20b)"
    )
    OLLAMA_BASE_URL: str = Field(
        default="http://localhost:11434",
        description="Ollama daemon URL"
    )
    OLLAMA_MODEL: str = Field(
        default="qwen2.5:3b",
        description="Local Ollama model tag (Qwen 2.5 3B Instruct recommended for 8GB RAM)"
    )
    TEMPERATURE: float = Field(
        default=0.1,
        description="Low temperature for deterministic, factual extraction and routing"
    )
    MAX_TOKENS: int = Field(
        default=1024,
        description="Max generation tokens for explanations"
    )
    LLM_TIMEOUT_SECONDS: float = Field(
        default=12.0,
        description="HTTP request timeout to Ollama daemon"
    )

    # Conversation Context & Memory Bounds
    MAX_CONVERSATION_TURNS: int = Field(
        default=10,
        description="Sliding window limit to prevent unbounded context growth on 8GB RAM"
    )
    MAX_CONTEXT_TOKENS: int = Field(
        default=4096,
        description="Estimated token ceiling for prompt history"
    )

    # Observability & Safety
    ENABLE_OBSERVABILITY_LOGS: bool = Field(
        default=True,
        description="Enable structured tracing of requests, tool calls, and latencies"
    )
    MASK_PII_IN_LOGS: bool = Field(
        default=True,
        description="Sanitize user personal identifiable information before logging"
    )
    REQUIRE_TRADE_CONFIRMATION: bool = Field(
        default=True,
        description="Strict safety gate requiring explicit confirmation before state-changing orders"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


llm_config = LLMConfig()
