"""Utilities to generate realistic household profiles for the simulation.

The generation is deterministic when a ``seed`` is provided.  It creates a list
of ``HouseholdState`` objects (with empty demand/solar values – they will be
filled later by the forecast services).
"""

import random
import string
from typing import List

from .state import HouseholdState


def _random_id(prefix: str, length: int = 4) -> str:
    """Return a short random identifier like ``HAB3F``.

    ``prefix`` is a short string (e.g. ``"H"`` for household).  The suffix is a
    combination of uppercase letters and digits.
    """
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=length))
    return f"{prefix}{suffix}"


def generate_households(
    num_households: int,
    solar_penetration: float,
    battery_penetration: float,
    seed: int | None = None,
) -> List[HouseholdState]:
    """Create a list of ``HouseholdState`` objects.

    * ``solar_penetration`` – fraction of households that have PV.
    * ``battery_penetration`` – fraction (of all households) that also have a
      battery.  If a household has a battery, ``battery_soc`` is initialised to
      a random value between 20 % and 80 % of a nominal 5 kWh capacity.
    """
    if seed is not None:
        random.seed(seed)

    households: List[HouseholdState] = []
    for _ in range(num_households):
        is_prosumer = random.random() < solar_penetration
        has_battery = random.random() < battery_penetration
        battery_soc = None
        if has_battery:
            # Assume a 5 kWh battery for simplicity.
            capacity = 5.0
            battery_soc = random.uniform(0.2, 0.8) * capacity
        hh = HouseholdState(
            household_id=_random_id("H"),
            is_prosumer=is_prosumer,
            demand_kwh=0.0,  # will be filled later
            solar_kwh=0.0,
            battery_soc=battery_soc,
        )
        households.append(hh)
    return households
