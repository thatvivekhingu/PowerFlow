"""
Observability and Logging Layer for POWERFLOW LLM.
Provides structured tracing for model queries, selected tools, latencies, decisions,
and automatically sanitizes PII and sensitive energy data.
"""

import re
import time
import logging
from typing import Any, Optional
from datetime import datetime, timezone

from powerflow_mcp.llm.config import llm_config

logger = logging.getLogger("powerflow.llm.observability")

# Regex patterns for sensitive data sanitization
PHONE_PATTERN = re.compile(r"\b(?:\+91|91|0)?[6-9]\d{9}\b")
AADHAAR_PATTERN = re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")
PAN_PATTERN = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b")
BANK_ACCOUNT_PATTERN = re.compile(r"\b\d{9,18}\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")


def sanitize_pii(text: Any) -> Any:
    """
    Recursively mask PII (names, phone numbers, Aadhaar, PAN, bank accounts, emails)
    from strings, dictionaries, or lists before logging or display.
    """
    if not llm_config.MASK_PII_IN_LOGS:
        return text

    if isinstance(text, str):
        sanitized = PHONE_PATTERN.sub("[PHONE_MASKED]", text)
        sanitized = AADHAAR_PATTERN.sub("[AADHAAR_MASKED]", sanitized)
        sanitized = PAN_PATTERN.sub("[PAN_MASKED]", sanitized)
        sanitized = EMAIL_PATTERN.sub("[EMAIL_MASKED]", sanitized)
        # Mask sensitive keywords
        sanitized = re.sub(r"(?i)(password|secret|token|api[_-]?key)\s*[:=]\s*\S+", r"\1=[REDACTED]", sanitized)
        return sanitized
    elif isinstance(text, dict):
        cleaned = {}
        for k, v in text.items():
            if any(term in k.lower() for term in ["name", "owner", "customer_name", "full_name"]):
                cleaned[k] = "[NAME_MASKED]"
            elif any(term in k.lower() for term in ["phone", "mobile", "contact"]):
                cleaned[k] = "[PHONE_MASKED]"
            elif any(term in k.lower() for term in ["aadhaar", "pan", "kyc", "bank_account"]):
                cleaned[k] = "[SENSITIVE_ID_MASKED]"
            else:
                cleaned[k] = sanitize_pii(v)
        return cleaned
    elif isinstance(text, list):
        return [sanitize_pii(item) for item in text]
    return text


class ObservabilityTracker:
    """Tracks latency, tool selections, failures, and model reasoning steps."""

    def __init__(self):
        self.enabled = llm_config.ENABLE_OBSERVABILITY_LOGS
        self.events: list[dict[str, Any]] = []

    def record_llm_request(self, model: str, prompt_preview: str) -> float:
        """Record the start of an LLM call and return start timestamp."""
        start_t = time.perf_counter()
        if self.enabled:
            safe_preview = sanitize_pii(prompt_preview)[:200]
            logger.info(f"[LLM_REQUEST] model={model} prompt_preview='{safe_preview}...'")
        return start_t

    def record_llm_response(self, model: str, start_time: float, output_preview: str, success: bool = True):
        """Record the completion of an LLM call with measured latency."""
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        if self.enabled:
            safe_output = sanitize_pii(output_preview)[:200]
            status = "SUCCESS" if success else "FALLBACK/ERROR"
            logger.info(f"[LLM_RESPONSE] model={model} latency={latency_ms}ms status={status} preview='{safe_output}...'")

        self.events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": "LLM_CALL",
            "model": model,
            "latency_ms": latency_ms,
            "success": success,
        })
        return latency_ms

    def record_tool_call(self, tool_name: str, args: dict[str, Any], start_time: float, result_status: str):
        """Record an MCP tool execution and latency."""
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        safe_args = sanitize_pii(args)
        if self.enabled:
            logger.info(f"[TOOL_CALL] tool={tool_name} latency={latency_ms}ms status={result_status} args={safe_args}")

        self.events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": "TOOL_EXECUTION",
            "tool": tool_name,
            "latency_ms": latency_ms,
            "status": result_status,
        })
        return latency_ms

    def record_decision(self, intent: str, decision: str, notes: str = ""):
        """Record high-level agent decisions or safety gates."""
        if self.enabled:
            logger.info(f"[AGENT_DECISION] intent={intent} decision='{decision}' notes='{notes}'")

        self.events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": "DECISION",
            "intent": intent,
            "decision": decision,
            "notes": notes,
        })


observability_tracker = ObservabilityTracker()
