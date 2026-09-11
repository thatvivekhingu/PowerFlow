"""
Settlement & Reconciliation Tools for POWERFLOW MCP Server.
"""

from typing import Any
from powerflow_mcp.schemas import TradeQuery, SettlementStatusResponse
from powerflow_mcp.services.settlement_service import settlement_service
from powerflow_mcp.security import mask_sensitive_info
from powerflow_mcp.errors import PowerFlowMCPError


async def get_settlement_status(trade_id: str) -> dict[str, Any]:
    """
    Retrieve post-delivery financial settlement and DISCOM grid fee status for a trade.

    Args:
        trade_id: Unique trade identifier (e.g. 'TRD-2026-0001')

    Returns:
        Structured settlement report detailing energy cost, DISCOM grid fee, payment disbursement,
        smart-meter delivery verification, and cryptographic audit signature.
    """
    try:
        query = TradeQuery(trade_id=trade_id)
        settlement_data = await settlement_service.get_settlement_status(query.trade_id)
        response = SettlementStatusResponse(**settlement_data)
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "SETTLEMENT_STATUS_FAILED", "message": str(e)}
