"""
Distribution Feeder Power Flow & Grid Physics Model.
Inspired by IEEE SmartGridComm 2024 (d-vf/P2PEnergyTrading).
Models voltage profiles, line thermal loading, and reverse power flow on radial distribution feeders.
"""

import math
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Bus:
    bus_id: str
    base_kv: float = 0.415  # 415V three-phase / 240V line-to-neutral
    voltage_pu: float = 1.0
    active_load_kw: float = 0.0
    solar_gen_kw: float = 0.0
    net_injection_kw: float = 0.0


@dataclass
class Branch:
    from_bus: str
    to_bus: str
    r_ohms: float = 0.05
    x_ohms: float = 0.02
    max_amp_rating: float = 150.0  # Max line current capacity
    current_amps: float = 0.0
    loading_pct: float = 0.0


class FeederGridModel:
    """
    Solves radial distribution power flow and evaluates physical grid safety constraints.
    Enforces IEEE 1547 voltage limits (0.95 - 1.05 p.u.) and branch loading limits.
    """

    def __init__(self, feeder_id: str, substation_mva: float = 1.0):
        self.feeder_id = feeder_id
        self.substation_mva = substation_mva
        self.buses: dict[str, Bus] = {}
        self.branches: list[Branch] = []
        self._build_default_feeder()

    def _build_default_feeder(self):
        """Construct a representative radial distribution feeder topology."""
        # Substation slack bus
        self.buses["SUB_BUS"] = Bus(bus_id="SUB_BUS", voltage_pu=1.02)
        
        # Intermediate and consumer/prosumer load buses
        bus_names = [f"{self.feeder_id}_B{i:02d}" for i in range(1, 11)]
        prev_bus = "SUB_BUS"

        for b_name in bus_names:
            self.buses[b_name] = Bus(bus_id=b_name, voltage_pu=1.0)
            self.branches.append(Branch(from_bus=prev_bus, to_bus=b_name))
            prev_bus = b_name

    def update_meter_power(self, bus_id: str, load_kw: float, solar_kw: float):
        """Update active load and solar generation at a given bus."""
        if bus_id in self.buses:
            b = self.buses[bus_id]
            b.active_load_kw = load_kw
            b.solar_gen_kw = solar_kw
            b.net_injection_kw = solar_kw - load_kw

    def solve_power_flow(self) -> dict:
        """
        Backward-Forward Sweep power flow algorithm for radial distribution feeder.
        Calculates branch currents, voltage drops, and reverse power flow.
        """
        # 1. Backward Sweep: Aggregate downstream branch currents
        current_sum = 0.0
        for branch in reversed(self.branches):
            downstream_bus = self.buses[branch.to_bus]
            net_kw = downstream_bus.net_injection_kw
            # I ~ (P / (sqrt(3) * V))
            i_net = net_kw / (math.sqrt(3) * 0.415 * downstream_bus.voltage_pu)
            current_sum += abs(i_net)
            branch.current_amps = current_sum
            branch.loading_pct = min(100.0, (current_sum / branch.max_amp_rating) * 100)

        # 2. Forward Sweep: Update bus voltages starting from Substation slack bus
        for branch in self.branches:
            v_from = self.buses[branch.from_bus].voltage_pu
            # Voltage drop delta_V ~ I * R
            v_drop_pu = (branch.current_amps * branch.r_ohms) / (415.0 / math.sqrt(3))
            
            # If net generation > load, voltage rises (reverse power flow)
            net_feeder = self.buses[branch.to_bus].net_injection_kw
            if net_feeder > 0:
                v_to = min(1.06, v_from + (v_drop_pu * 0.5))  # Voltage rise
            else:
                v_to = max(0.90, v_from - v_drop_pu)          # Voltage drop

            self.buses[branch.to_bus].voltage_pu = round(v_to, 4)

        # 3. Check Safety Constraints
        voltages = [b.voltage_pu for b in self.buses.values()]
        min_v = min(voltages)
        max_v = max(voltages)
        max_loading = max(b.loading_pct for b in self.branches)
        total_gen = sum(b.solar_gen_kw for b in self.buses.values())
        total_load = sum(b.active_load_kw for b in self.buses.values())
        reverse_flow = total_gen > total_load

        is_voltage_violated = min_v < 0.95 or max_v > 1.05
        is_thermal_overloaded = max_loading > 90.0

        decision = "TRADE_ALLOWED"
        if is_thermal_overloaded or is_voltage_violated:
            decision = "TRADE_REJECTED"
        elif max_loading > 75.0 or max_v > 1.04:
            decision = "TRADE_LIMITED"

        return {
            "feeder_id": self.feeder_id,
            "min_voltage_pu": round(min_v, 4),
            "max_voltage_pu": round(max_v, 4),
            "max_branch_loading_pct": round(max_loading, 1),
            "total_solar_gen_kw": round(total_gen, 2),
            "total_load_kw": round(total_load, 2),
            "reverse_power_flow_active": reverse_flow,
            "voltage_violation": is_voltage_violated,
            "thermal_overload": is_thermal_overloaded,
            "grid_trade_decision": decision,
        }
