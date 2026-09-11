"""
Settlement & DISCOM Wheeling Engine Service.
Manages P2P trade settlement status, DISCOM wheeling charge calculations, and escrow payouts.
"""

import logging
from typing import Any
from powerflow_mcp.db.repository import db_repository

logger = logging.getLogger("powerflow.mcp.settlement")


class SettlementService:
    """Service tracking matched trade execution and financial/energy settlement."""

    async def get_trade_status(self, trade_id: str) -> dict[str, Any]:
        """Fetch trade execution status by trade ID."""
        trade = await db_repository.get_trade(trade_id)
        return {
            "status": "SUCCESS",
            "trade_id": trade["trade_id"],
            "seller_meter_id": trade["seller_meter_id"],
            "buyer_meter_id": trade["buyer_meter_id"],
            "feeder_id": trade["feeder_id"],
            "traded_quantity_kwh": trade["traded_quantity_kwh"],
            "clearing_price_inr_per_kwh": trade["clearing_price_inr_per_kwh"],
            "gross_amount_inr": trade["gross_amount_inr"],
            "discom_wheeling_charge_inr": trade["discom_wheeling_charge_inr"],
            "net_seller_payout_inr": trade["net_seller_payout_inr"],
            "trade_timestamp": trade["trade_timestamp"],
            "trade_status": trade["status"],
        }

    async def get_settlement_status(self, trade_id: str) -> dict[str, Any]:
        """Fetch post-delivery financial settlement and DISCOM fee reconciliation."""
        settlement = await db_repository.get_settlement(trade_id)
        return {
            "status": "SUCCESS",
            "trade_id": settlement["trade_id"],
            "settlement_id": settlement["settlement_id"],
            "buyer_id": settlement["buyer_id"],
            "seller_id": settlement["seller_id"],
            "feeder_id": settlement["feeder_id"],
            "quantity_kwh": settlement["quantity_kwh"],
            "energy_cost_inr": settlement["energy_cost_inr"],
            "discom_grid_fee_inr": settlement["discom_grid_fee_inr"],
            "total_settled_inr": settlement["total_settled_inr"],
            "payment_status": settlement["payment_status"],
            "meter_verified": settlement["meter_verified"],
            "audit_signature": settlement["audit_signature"],
            "settlement_completed_at": settlement["settlement_completed_at"],
        }


settlement_service = SettlementService()
