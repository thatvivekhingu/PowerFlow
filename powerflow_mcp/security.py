"""
Security & Privacy Module for POWERFLOW MCP Server.
Ensures zero exposure of PII/KYC data to AI agents and enforces role-based constraints.
"""

import re
from typing import Any, Optional
from powerflow_mcp.config import settings
from powerflow_mcp.errors import UnauthorizedError


def verify_auth_token(token: Optional[str] = None) -> bool:
    """Validate request authentication token if auth is enabled."""
    if not settings.REQUIRE_AUTH:
        return True
    if not token or token != settings.API_AUTH_TOKEN:
        raise UnauthorizedError("Invalid or missing POWERFLOW MCP authentication token.")
    return True


def mask_sensitive_info(data: dict[str, Any]) -> dict[str, Any]:
    """
    Sanitize dictionary to strip or mask any potential PII, KYC, or private banking details.
    Keeps telemetry and digital marketplace identifiers operational while protecting privacy.
    """
    masked = {}
    sensitive_keys = {
        "aadhaar", "ssn", "pan_number", "bank_account", "phone",
        "email", "customer_name", "home_address", "kyc_status", "private_key"
    }

    for key, value in data.items():
        lower_key = key.lower()
        if lower_key in sensitive_keys:
            continue  # Exclude completely from MCP AI agent context
        elif isinstance(value, dict):
            masked[key] = mask_sensitive_info(value)
        elif isinstance(value, list):
            masked[key] = [
                mask_sensitive_info(item) if isinstance(item, dict) else item
                for item in value
            ]
        elif isinstance(value, str) and "@" in value and "." in value:
            # Mask potential email pattern
            masked[key] = re.sub(r"(?<=.{2}).(?=.*@)", "*", value)
        else:
            masked[key] = value

    return masked


def sanitize_identifier(ident: str) -> str:
    """Normalize and validate safe alphanumeric identifiers (meters, feeders, trades)."""
    clean = re.sub(r"[^A-Za-z0-9_-]", "", ident).strip().upper()
    if not clean:
        raise ValueError("Identifier must contain valid alphanumeric characters.")
    return clean
