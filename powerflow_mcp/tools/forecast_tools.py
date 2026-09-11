"""
Forecasting Tools for POWERFLOW MCP Server.
Connects calibrated machine-learning models for demand and solar generation forecasts.
"""

from typing import Any
from powerflow_mcp.schemas import MeterQuery, DemandForecastResponse, SolarForecastResponse
from powerflow_mcp.db.repository import db_repository
from powerflow_mcp.models.forecasting import demand_forecaster, solar_forecaster
from powerflow_mcp.security import mask_sensitive_info
from powerflow_mcp.errors import PowerFlowMCPError


async def get_demand_forecast(meter_id: str, horizon_hours: int = 24) -> dict[str, Any]:
    """
    Generate an AI/ML demand forecast for a consumer or prosumer smart meter.

    Args:
        meter_id: Smart meter ID to forecast demand for (e.g., 'H011', 'H001')
        horizon_hours: Forecast time horizon in hours (default: 24, max: 72)

    Returns:
        Structured forecast with predicted kWh, confidence intervals, peak hour, model version, and timestamp.
    """
    try:
        query = MeterQuery(meter_id=meter_id)
        horizon = min(max(1, int(horizon_hours)), 72)
        
        hh = await db_repository.get_household(query.meter_id)
        
        forecast_data = demand_forecaster.predict(
            meter_id=query.meter_id,
            feeder_id=hh["feeder"],
            base_load_kw=hh["base_load_kw"],
            horizon_hours=horizon,
        )
        response = DemandForecastResponse(**forecast_data)
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "DEMAND_FORECAST_FAILED", "message": str(e)}


async def get_solar_forecast(meter_id: str, horizon_hours: int = 24) -> dict[str, Any]:
    """
    Generate a solar photovoltaic (PV) generation and surplus forecast for a prosumer meter.

    Args:
        meter_id: Smart meter ID of the solar prosumer (e.g., 'H001', 'H008')
        horizon_hours: Forecast time horizon in hours (default: 24, max: 72)

    Returns:
        Structured forecast containing expected solar generation (kWh), solar irradiance, and expected surplus.
    """
    try:
        query = MeterQuery(meter_id=meter_id)
        horizon = min(max(1, int(horizon_hours)), 72)
        
        hh = await db_repository.get_household(query.meter_id)
        
        forecast_data = solar_forecaster.predict(
            meter_id=query.meter_id,
            feeder_id=hh["feeder"],
            panel_kw=hh["panel_kw"],
            horizon_hours=horizon,
        )
        response = SolarForecastResponse(**forecast_data)
        return mask_sensitive_info(response.model_dump())
    except PowerFlowMCPError as e:
        return e.to_dict()
    except Exception as e:
        return {"status": "ERROR", "error_code": "SOLAR_FORECAST_FAILED", "message": str(e)}
