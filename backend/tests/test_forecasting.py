"""
Tests for Solar & Demand Forecasting Service and Confidence Intervals.
"""

import pytest
from services.forecasting_service import (
    calculate_solar_generation_kw,
    calculate_demand_load_kw,
    generate_forecast_horizon,
    MODEL_REGISTRY,
    get_active_model,
    set_active_model,
)


def test_solar_generation_curve_and_quantiles():
    """Verify night generation is 0 and day generation follows clear-sky curve with P10 <= P50 <= P90."""
    night = calculate_solar_generation_kw(2.0, capacity_kw=5.0)
    assert night["p10_kw"] == 0.0
    assert night["p50_kw"] == 0.0
    assert night["p90_kw"] == 0.0

    noon = calculate_solar_generation_kw(12.5, capacity_kw=5.0, cloud_cover_pct=10.0)
    assert noon["p50_kw"] > 3.0  # Significant solar output near noon
    assert noon["p10_kw"] <= noon["p50_kw"]
    assert noon["p50_kw"] <= noon["p90_kw"]
    assert noon["irradiance_w_m2"] > 700.0


def test_demand_load_curve_and_peaks():
    """Verify morning and evening peaks with valid quantiles."""
    morning = calculate_demand_load_kw(8.5, base_capacity_kw=3.5)
    evening = calculate_demand_load_kw(20.0, base_capacity_kw=3.5)
    night = calculate_demand_load_kw(3.0, base_capacity_kw=3.5)

    # Evening peak should be higher than night baseload
    assert evening["p50_kw"] > night["p50_kw"]
    assert morning["p50_kw"] > night["p50_kw"]

    # Quantile ordering
    assert evening["p10_kw"] <= evening["p50_kw"] <= evening["p90_kw"]


def test_generate_forecast_horizon():
    """Verify full 24h horizon generation."""
    res = generate_forecast_horizon(feeder_id="FEEDER-01", horizon_hours=24)
    assert res["horizon_hours"] == 24
    assert len(res["forecast_points"]) == 24
    assert res["summary"]["total_solar_p50_kwh"] > 0.0
    assert res["summary"]["total_demand_p50_kwh"] > 0.0
    assert res["models"]["solar"]["is_active"] is True
    assert res["models"]["demand"]["is_active"] is True

    # All points must satisfy confidence quantile ordering
    for p in res["forecast_points"]:
        assert p["solar_p10_kw"] <= p["solar_p50_kw"] <= p["solar_p90_kw"]
        assert p["demand_p10_kw"] <= p["demand_p50_kw"] <= p["demand_p90_kw"]


def test_model_version_tracking_and_switching():
    """Verify model registry metadata, metrics, and switching active version."""
    active_solar = get_active_model("solar")
    assert "v2.4" in active_solar["version"]
    assert active_solar["mape"] < 5.0
    assert active_solar["r2_score"] > 0.90

    # Switch to staging version
    updated = set_active_model("solar", "v2.3-Ridge-Spline")
    assert updated["version"] == "v2.3-Ridge-Spline"
    assert updated["is_active"] is True

    # Check that previous active is no longer active
    assert get_active_model("solar")["version"] == "v2.3-Ridge-Spline"

    # Reset back to production
    set_active_model("solar", "v2.4-LightGBM")
    assert get_active_model("solar")["version"] == "v2.4-LightGBM"
