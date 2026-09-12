"""
Forecast Router — endpoints for Solar & Demand forecasting, confidence intervals, and ML model version tracking.
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel

from services.forecasting_service import (
    generate_forecast_horizon,
    MODEL_REGISTRY,
    get_active_model,
    set_active_model,
)

router = APIRouter(prefix="/api/forecast", tags=["Forecasting"])


class ModelSelectionRequest(BaseModel):
    model_type: str  # "solar" or "demand"
    version: str


@router.get("/combined")
async def get_combined_forecast(
    feeder_id: str = Query("FEEDER-01", description="Feeder ID to forecast for"),
    horizon_hours: int = Query(24, ge=6, le=72, description="Forecast horizon in hours (6 to 72)"),
    solar_capacity_kw: float = Query(5.0, gt=0.0, description="Connected PV peak capacity"),
    demand_peak_kw: float = Query(3.5, gt=0.0, description="Base demand peak"),
):
    """
    Get synchronized Solar and Demand probabilistic forecast with P10/P50/P90 confidence intervals.
    """
    return generate_forecast_horizon(
        feeder_id=feeder_id,
        horizon_hours=horizon_hours,
        solar_capacity_kw=solar_capacity_kw,
        demand_peak_kw=demand_peak_kw,
    )


@router.get("/solar")
async def get_solar_forecast(
    feeder_id: str = Query("FEEDER-01"),
    horizon_hours: int = Query(24, ge=6, le=72),
    solar_capacity_kw: float = Query(5.0, gt=0.0),
):
    """Get focused solar generation forecast with irradiance and confidence bounds."""
    full = generate_forecast_horizon(
        feeder_id=feeder_id,
        horizon_hours=horizon_hours,
        solar_capacity_kw=solar_capacity_kw,
    )
    return {
        "feeder_id": full["feeder_id"],
        "horizon_hours": full["horizon_hours"],
        "model": full["models"]["solar"],
        "points": [
            {
                "timestamp": p["timestamp"],
                "hour_label": p["hour_label"],
                "p10_kw": p["solar_p10_kw"],
                "p50_kw": p["solar_p50_kw"],
                "p90_kw": p["solar_p90_kw"],
                "irradiance_w_m2": p["irradiance_w_m2"],
                "cloud_cover_pct": p["cloud_cover_pct"],
            }
            for p in full["forecast_points"]
        ],
    }


@router.get("/demand")
async def get_demand_forecast(
    feeder_id: str = Query("FEEDER-01"),
    horizon_hours: int = Query(24, ge=6, le=72),
    demand_peak_kw: float = Query(3.5, gt=0.0),
):
    """Get focused demand load forecast with peak surges and confidence bounds."""
    full = generate_forecast_horizon(
        feeder_id=feeder_id,
        horizon_hours=horizon_hours,
        demand_peak_kw=demand_peak_kw,
    )
    return {
        "feeder_id": full["feeder_id"],
        "horizon_hours": full["horizon_hours"],
        "model": full["models"]["demand"],
        "points": [
            {
                "timestamp": p["timestamp"],
                "hour_label": p["hour_label"],
                "p10_kw": p["demand_p10_kw"],
                "p50_kw": p["demand_p50_kw"],
                "p90_kw": p["demand_p90_kw"],
            }
            for p in full["forecast_points"]
        ],
    }


@router.get("/models")
async def list_forecast_models():
    """
    Get the ML model registry with version tracking, accuracy metrics (MAPE, RMSE, R²),
    and architecture specifications.
    """
    return {
        "registry": MODEL_REGISTRY,
        "active_models": {
            "solar": get_active_model("solar"),
            "demand": get_active_model("demand"),
        },
    }


@router.post("/models/select")
async def select_forecast_model(req: ModelSelectionRequest):
    """
    Switch the active production ML model version for solar or demand forecasting.
    """
    if req.model_type not in ("solar", "demand"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_type must be 'solar' or 'demand'",
        )

    updated = set_active_model(req.model_type, req.version)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version '{req.version}' not found for model_type '{req.model_type}'",
        )

    return {
        "message": f"Successfully activated version {req.version} for {req.model_type}",
        "active_model": updated,
    }
