"""
Audit Logging Module for POWERFLOW MCP Server.
Logs structured immutable audit trails for all state-changing operations (orders, settlements).
"""

import json
import logging
import hashlib
from datetime import datetime, timezone
from typing import Any
from powerflow_mcp.config import settings

logger = logging.getLogger("powerflow.mcp.audit")


def log_audit_event(
    action: str,
    actor_id: str,
    tool_name: str,
    payload: dict[str, Any],
    status: str = "SUCCESS",
    notes: str = ""
) -> dict[str, Any]:
    """
    Log a structured audit record for regulatory DISCOM and security compliance.
    Calculates a hash for tamper-evident tracking.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    raw_payload_str = json.dumps(payload, sort_keys=True, default=str)
    
    # Generate tamper-evident audit record hash
    hash_input = f"{now_iso}|{action}|{actor_id}|{tool_name}|{raw_payload_str}|{status}"
    record_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()[:16]

    record = {
        "timestamp": now_iso,
        "action": action,
        "actor_id": actor_id,
        "tool_name": tool_name,
        "payload": payload,
        "status": status,
        "record_hash": record_hash,
        "notes": notes,
    }

    if settings.ENABLE_AUDIT_LOG:
        log_line = json.dumps(record, default=str)
        logger.info(f"AUDIT_RECORD: {log_line}")
        try:
            with open(settings.AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(log_line + "\n")
        except Exception as e:
            logger.error(f"Failed to append to audit log file: {e}")

    return record
