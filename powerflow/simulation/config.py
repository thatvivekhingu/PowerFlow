# Simulation configuration models

from pydantic import BaseModel, Field, validator
from typing import Optional

class SimulationConfig(BaseModel):
    """Configuration for the 24‑hour digital twin simulation.

    All defaults are chosen to run a quick yet realistic demo. Adjust as needed
    via a YAML/JSON config file passed to the CLI.
    """

    num_households: int = Field(30, ge=1, description="Total households (prosumers + consumers)")
    num_feeders: int = Field(3, ge=1, description="Number of distribution feeders")
    interval_minutes: int = Field(15, ge=5, description="Length of each simulation step")
    seed: Optional[int] = Field(None, description="Random seed for reproducibility")
    solar_penetration: float = Field(0.7, ge=0.0, le=1.0, description="Fraction of households with PV")
    battery_penetration: float = Field(0.2, ge=0.0, le=1.0, description="Fraction with storage")
    price_bounds: tuple[float, float] = Field((3.0, 15.0), description="Min and max INR/kWh price")
    wheeling_charge: float = Field(0.25, ge=0.0, description="Wheeling charge INR/kWh")
    feeder_capacity_factor: float = Field(1.0, ge=0.0, le=2.0, description="Multiplier for baseline feeder capacity")
    demand_scale: float = Field(1.0, ge=0.0, description="Scale factor for demand forecasts")
    solar_scale: float = Field(1.0, ge=0.0, description="Scale factor for solar forecasts")
    enable_batteries: bool = Field(True, description="Whether to simulate battery behavior")

    @validator("price_bounds")
    def _check_price_bounds(cls, v):
        low, high = v
        if low >= high:
            raise ValueError("price_bounds low must be < high")
        return v

    class Config:
        extra = "forbid"
        schema_extra = {
            "example": {
                "num_households": 30,
                "num_feeders": 3,
                "interval_minutes": 15,
                "seed": 42,
                "solar_penetration": 0.7,
                "battery_penetration": 0.2,
                "price_bounds": [3.0, 15.0],
                "wheeling_charge": 0.25,
                "feeder_capacity_factor": 1.0,
                "demand_scale": 1.0,
                "solar_scale": 1.0,
                "enable_batteries": True,
            }
        }
}
