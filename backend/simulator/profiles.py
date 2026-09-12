"""
Household energy profiles for the GRIDMIND simulator.

Profiles use realistic normalized curves (0–1) that are then scaled
by per-household capacity parameters.

Solar generation: Gaussian bell curve peaking at solar noon (~13:00 IST).
Load curves: morning peak (7–9am) + evening peak (6–9pm) + base load.
"""

import numpy as np
from typing import NamedTuple


class HouseholdProfile(NamedTuple):
    household_id: str
    meter_id: str
    feeder_id: str
    # Solar panel peak capacity in kW (prosumers have this, consumers = 0)
    solar_capacity_kw: float
    # Average base load in kW
    base_load_kw: float
    # Random seed for reproducible variation
    seed: int
    role: str  # "prosumer" | "consumer"


def solar_generation_curve(hour_of_day: float, capacity_kw: float, cloud_factor: float = 1.0) -> float:
    """
    Gaussian solar generation curve.
    Peak at 13:00 (1pm IST), σ = 3 hours.
    Returns kWh for a 15-minute interval.
    """
    if capacity_kw <= 0:
        return 0.0
    peak_hour = 13.0
    sigma = 3.0
    normalized = np.exp(-0.5 * ((hour_of_day - peak_hour) / sigma) ** 2)
    kw = capacity_kw * normalized * cloud_factor
    kwh_per_15min = kw * 0.25  # 15 min = 0.25 hours
    return max(0.0, round(kwh_per_15min, 4))


def load_consumption_curve(
    hour_of_day: float,
    base_load_kw: float,
    day_type: str = "weekday",
    noise_seed: int = 0,
) -> float:
    """
    Residential load curve with morning and evening peaks.
    Returns kWh for a 15-minute interval.
    """
    rng = np.random.default_rng(noise_seed + int(hour_of_day * 4))

    # Morning peak: 7–9am Gaussian
    morning = 0.8 * np.exp(-0.5 * ((hour_of_day - 8.0) / 0.8) ** 2)
    # Evening peak: 6–9pm Gaussian
    evening = 1.2 * np.exp(-0.5 * ((hour_of_day - 19.5) / 1.5) ** 2)
    # Base load (always on: fridges, standby etc.)
    base = 0.3

    load_factor = base + morning + evening

    # Weekend adjustment
    if day_type == "weekend":
        # Slightly flatter curve, higher midday load
        midday = 0.4 * np.exp(-0.5 * ((hour_of_day - 13.0) / 2.0) ** 2)
        load_factor = base + morning * 0.7 + midday + evening * 0.9

    # Add ±15% random noise
    noise = rng.uniform(0.85, 1.15)
    kw = base_load_kw * load_factor * noise
    kwh_per_15min = kw * 0.25
    return max(0.0, round(kwh_per_15min, 4))


def feeder_aggregate_load_kw(
    households: list[HouseholdProfile],
    hour_of_day: float,
    day_type: str = "weekday",
) -> float:
    """Aggregate load across all households on a feeder at a given time."""
    total = 0.0
    for h in households:
        load = load_consumption_curve(hour_of_day, h.base_load_kw, day_type, h.seed)
        # Convert 15-min kWh back to kW (×4)
        total += load * 4.0
    return round(total, 2)


def generate_household_profiles(
    n_households: int = 20,
    n_feeders: int = 2,
    prosumer_fraction: float = 0.6,
) -> list[HouseholdProfile]:
    """
    Generate n_households simulated households across n_feeders.
    prosumer_fraction of them have solar panels.
    """
    rng = np.random.default_rng(42)
    profiles = []

    for i in range(n_households):
        feeder_idx = i % n_feeders
        feeder_id = f"FEEDER-{feeder_idx + 1:02d}"
        meter_id = f"METER-{i + 1:04d}"
        is_prosumer = i < int(n_households * prosumer_fraction)

        solar_capacity = float(rng.uniform(3.0, 8.0)) if is_prosumer else 0.0
        base_load = float(rng.uniform(0.8, 2.5))

        profiles.append(HouseholdProfile(
            household_id=f"HH-{i + 1:04d}",
            meter_id=meter_id,
            feeder_id=feeder_id,
            solar_capacity_kw=round(solar_capacity, 2),
            base_load_kw=round(base_load, 2),
            seed=i * 137,
            role="prosumer" if is_prosumer else "consumer",
        ))

    return profiles


# Feeder transformer capacities (kW)
FEEDER_TRANSFORMER_CONFIG = {
    "FEEDER-01": {"transformer_id": "TX-01", "capacity_kw": 100.0},
    "FEEDER-02": {"transformer_id": "TX-02", "capacity_kw": 80.0},
    "FEEDER-03": {"transformer_id": "TX-03", "capacity_kw": 60.0},
}
