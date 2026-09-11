"""
Smart Meter Query Tools for POWERFLOW MCP.
Exposes read-only digital telemetry without physical hardware interaction.
"""

from typing import Any
from powerflow_mcp.schemas import MeterQuery, MeterReadingResponse, AvailableSurplusResponse
from powerflow_mcp.db.repository import db_repository
from powerflow_mcp.security import mask_sensitive_info
from powerflow_mcp.errors import PowerFlowMCPError


async def get_meter_reading(meter_id: str) -> dict[str, Any]:
    """
    Retrieve real-time electricity smart meter telemetry for a consumer or prosumer.

    Args:
        meter_id: Registered smart meter or household ID (e.g. 'H001', 'H011')

    Returns:
        Structured dictionary with current generation, load, net export/import, and feeder allocation.
    """
    try:
        query = MeterQuery(meter_id=meter_id)
        reading = await db_repository.get_latest_meter_reading(query.meter_id)
        response = MeterReadingResponse(**reading)
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "METER_QUERY_FAILED", "message": str(e)}


async def get_available_surplus(meter_id: str) -> dict[str, Any]:
    """
    Check the current net exportable solar surplus available for P2P marketplace trading.

    Args:
        meter_id: Smart meter ID of the prosumer (e.g. 'H001', 'H004')

    Returns:
        Structured breakdown of generation, self-consumption load, and trade-eligible surplus in kWh.
    """
    try:
        query = MeterQuery(meter_id=meter_id)
        reading = await db_repository.get_latest_meter_reading(query.meter_id)
        
        is_prosumer = reading["household_type"] == "prosumer"
        surplus = reading["surplus_kwh"] if is_prosumer else 0.0
        eligible = is_prosumer and surplus > 0.05 and reading["grid_decision"] != "TRADE_REJECTED"
        
        restriction = None
        if not is_prosumer:
            restriction = "Household is registered as consumer only (no solar panels)."
        elif surplus <= 0.05:
            restriction = "Current generation is consumed internally by local household appliances."
        elif reading["grid_decision"] == "TRADE_REJECTED":
            restriction = "Distribution feeder is congested; exports temporarily throttled."

        response = AvailableSurplusResponse(
            meter_id=query.meter_id,
            feeder_id=reading["feeder_id"],
            household_type=reading["household_type"],
            solar_generation_kw=reading["solar_generation_kw"],
            current_load_kw=reading["current_load_kw"],
            net_exportable_surplus_kwh=round(surplus, 4),
            eligible_for_p2p_trade=eligible,
            restriction_reason=restriction,
        )
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "SURPLUS_QUERY_FAILED", "message": str(e)}
