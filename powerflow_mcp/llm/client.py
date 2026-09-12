"""
Local LLM Client for POWERFLOW Platform.
Asynchronous client interfacing with local Ollama daemon (Qwen 2.5 3B Instruct)
with built-in model verification, latency instrumentation, and fallback reasoning engine.
"""

import json
import logging
from typing import Any, Optional
import httpx

from powerflow_mcp.llm.config import llm_config
from powerflow_mcp.llm.observability import observability_tracker

logger = logging.getLogger("powerflow.llm.client")


class LocalLLMClient:
    """
    Async client for local Ollama LLM execution.
    Targeted for Qwen 2.5 3B Instruct on an 8 GB RAM machine without paid APIs.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        temperature: Optional[float] = None,
    ):
        self.base_url = (base_url or llm_config.OLLAMA_BASE_URL).rstrip("/")
        self.model = model or llm_config.OLLAMA_MODEL
        self.timeout = timeout or llm_config.LLM_TIMEOUT_SECONDS
        self.temperature = temperature if temperature is not None else llm_config.TEMPERATURE

    async def is_available(self) -> bool:
        """Check if local Ollama daemon is reachable and responding."""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[str]:
        """List all models currently installed in local Ollama."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code == 200:
                    models = resp.json().get("models", [])
                    return [m.get("name") for m in models if m.get("name")]
        except Exception as e:
            logger.debug(f"Failed to fetch model list from Ollama: {e}")
        return []

    async def chat(
        self,
        messages: list[dict[str, str]],
        json_mode: bool = False,
        temperature: Optional[float] = None,
    ) -> str:
        """
        Send chat prompt to Ollama with latency tracking and fallback support.
        """
        temp = temperature if temperature is not None else self.temperature
        endpoint = f"{self.base_url}/api/chat"
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temp,
                "num_predict": llm_config.MAX_TOKENS,
            }
        }
        if json_mode:
            payload["format"] = "json"

        last_prompt_snippet = messages[-1].get("content", "") if messages else ""
        start_t = observability_tracker.record_llm_request(self.model, last_prompt_snippet)

        try:
            # Quick 2.0s connect timeout so fallback is near-instant if Ollama is not running locally
            client_timeout = httpx.Timeout(self.timeout, connect=2.0)
            async with httpx.AsyncClient(timeout=client_timeout) as client:
                resp = await client.post(endpoint, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("message", {}).get("content", "").strip()
                    observability_tracker.record_llm_response(self.model, start_t, content, success=True)
                    return content
                else:
                    logger.warning(f"Ollama returned HTTP {resp.status_code}. Activating fallback.")
        except Exception as e:
            logger.info(f"Ollama daemon not reachable at {endpoint} ({e}). Using deterministic reasoning fallback.")

        # If Ollama is offline or timed out, use fallback
        observability_tracker.record_llm_response(self.model, start_t, "[FALLBACK_PARSER_ACTIVATED]", success=False)
        return ""


local_llm_client = LocalLLMClient()
