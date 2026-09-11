"""
Error definitions for POWERFLOW MCP Server.
Provides structured, machine-readable exceptions with domain-specific error codes.
"""

from typing import Any, Optional


class PowerFlowMCPError(Exception):
    """Base exception for all POWERFLOW MCP Server operations."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR", details: Optional[dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": "ERROR",
            "error_code": self.code,
            "message": self.message,
            "details": self.details,
        }


class GridCongestionError(PowerFlowMCPError):
    """Raised when feeder capacity is overloaded or trade is rejected by DISCOM grid safety rules."""

    def __init__(self, feeder_id: str, utilization_pct: float, message: Optional[str] = None):
        msg = message or f"Grid congested on feeder '{feeder_id}' (utilization: {utilization_pct:.1f}%). P2P trades temporarily restricted by DISCOM."
        super().__init__(
            message=msg,
            code="GRID_CONGESTION_REJECTION",
            details={"feeder_id": feeder_id, "utilization_pct": utilization_pct, "safety_decision": "TRADE_REJECTED"}
        )


class InvalidOrderError(PowerFlowMCPError):
    """Raised when order parameters violate market business rules or price limits."""

    def __init__(self, message: str, details: Optional[dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="INVALID_ORDER_PARAMETERS",
            details=details or {}
        )


class MeterNotFoundError(PowerFlowMCPError):
    """Raised when the specified meter ID is not found in the grid registry."""

    def __init__(self, meter_id: str):
        super().__init__(
            message=f"Meter ID '{meter_id}' not found in POWERFLOW meter registry.",
            code="METER_NOT_FOUND",
            details={"meter_id": meter_id}
        )


class FeederNotFoundError(PowerFlowMCPError):
    """Raised when the specified feeder ID does not exist."""

    def __init__(self, feeder_id: str):
        super().__init__(
            message=f"Feeder ID '{feeder_id}' not found in grid topology.",
            code="FEEDER_NOT_FOUND",
            details={"feeder_id": feeder_id}
        )


class TradeNotFoundError(PowerFlowMCPError):
    """Raised when a trade or settlement record cannot be located."""

    def __init__(self, trade_id: str):
        super().__init__(
            message=f"Trade record '{trade_id}' not found in marketplace settlement ledger.",
            code="TRADE_NOT_FOUND",
            details={"trade_id": trade_id}
        )


class MarketClosedError(PowerFlowMCPError):
    """Raised when trading operations are attempted outside active market clearing windows."""

    def __init__(self, reason: str = "Market interval currently closed"):
        super().__init__(
            message=f"Trading unavailable: {reason}.",
            code="MARKET_CLOSED",
            details={"market_status": "CLOSED"}
        )


class UnauthorizedError(PowerFlowMCPError):
    """Raised when authentication or role validation fails."""

    def __init__(self, message: str = "Unauthorized MCP tool access"):
        super().__init__(
            message=message,
            code="UNAUTHORIZED_ACCESS",
            details={}
        )
