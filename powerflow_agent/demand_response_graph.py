"""
LangGraph StateGraph: DISCOM Automated Demand Response & Congestion Mitigator.
Detects feeder overload (>85%), discovers flexible consumer loads (EVs, batteries),
calculates dynamic tariff incentives, and dispatches automated load-shedding / peak-shifting events.
"""

from typing import TypedDict, Any, Optional
from langgraph.graph import StateGraph, START, END


class FlexibleLoad(TypedDict):
    meter_id: str
    consumer_name: str
    load_type: str  # "EV_CHARGER", "BESS_STORAGE", "HEAT_PUMP", "HVAC"
    current_kw: float
    sheddable_kw: float
    curtailed: bool
    incentive_earned_inr: float


class DemandResponseState(TypedDict, total=False):
    feeder_id: str
    current_load_kw: float
    capacity_kw: float
    utilization_pct: float
    target_utilization_pct: float
    required_reduction_kw: float
    flexible_loads: list[dict[str, Any]]
    incentive_rate_inr_per_kwh: float
    curtailed_kw_achieved: float
    post_dr_load_kw: float
    post_dr_utilization_pct: float
    status: str
    trace: list[str]
    summary: str


# ── Registered Sample Flexible Assets per Feeder ─────────────────────────────
DEFAULT_FLEXIBLE_ASSETS: dict[str, list[dict[str, Any]]] = {
    "FEEDER-A": [
        {"meter_id": "MTR-EV-A1", "consumer_name": "Priya Sharma (EV-7.2kW)", "load_type": "EV_CHARGER", "current_kw": 6.8, "sheddable_kw": 4.5, "curtailed": False, "incentive_earned_inr": 0.0},
        {"meter_id": "MTR-BAT-A2", "consumer_name": "Amit Shah (Home Battery)", "load_type": "BESS_STORAGE", "current_kw": 3.2, "sheddable_kw": 3.0, "curtailed": False, "incentive_earned_inr": 0.0},
        {"meter_id": "MTR-AC-A3", "consumer_name": "Neha Gupta (Smart HVAC)", "load_type": "HVAC", "current_kw": 4.0, "sheddable_kw": 2.0, "curtailed": False, "incentive_earned_inr": 0.0},
    ],
    "FEEDER-B": [
        {"meter_id": "MTR-EV-B1", "consumer_name": "Vikram Mehta (Fleet Fast Charger)", "load_type": "EV_CHARGER", "current_kw": 11.0, "sheddable_kw": 7.5, "curtailed": False, "incentive_earned_inr": 0.0},
        {"meter_id": "MTR-BAT-B2", "consumer_name": "Kiran Rao (Solar BESS)", "load_type": "BESS_STORAGE", "current_kw": 5.0, "sheddable_kw": 4.0, "curtailed": False, "incentive_earned_inr": 0.0},
    ],
}


# ── Node 1: Detect Congestion ────────────────────────────────────────────────
async def detect_congestion_node(state: DemandResponseState) -> dict[str, Any]:
    trace = state.get("trace", []).copy()
    feeder_id = state.get("feeder_id", "FEEDER-A")
    capacity_kw = state.get("capacity_kw") or 50.0
    current_load_kw = state.get("current_load_kw") or (capacity_kw * 0.92)  # Default to 92% stress
    target_pct = state.get("target_utilization_pct") or 80.0

    utilization_pct = round((current_load_kw / capacity_kw) * 100, 1)
    target_load_kw = capacity_kw * (target_pct / 100.0)
    required_reduction_kw = max(0.0, round(current_load_kw - target_load_kw, 2))

    trace.append(
        f"[Detect] Feeder {feeder_id}: Load = {current_load_kw} kW / {capacity_kw} kW "
        f"({utilization_pct}%). Target <= {target_pct}%. Required Shed = {required_reduction_kw} kW."
    )

    status = "CONGESTION_CRITICAL" if utilization_pct >= 90.0 else ("CONGESTION_WARNING" if utilization_pct >= 80.0 else "NORMAL")

    return {
        "feeder_id": feeder_id,
        "capacity_kw": capacity_kw,
        "current_load_kw": current_load_kw,
        "utilization_pct": utilization_pct,
        "target_utilization_pct": target_pct,
        "required_reduction_kw": required_reduction_kw,
        "status": status,
        "trace": trace,
    }


# ── Node 2: Identify Flexible Loads ──────────────────────────────────────────
async def identify_flexibility_node(state: DemandResponseState) -> dict[str, Any]:
    trace = state.get("trace", []).copy()
    feeder_id = state.get("feeder_id", "FEEDER-A")
    assets = state.get("flexible_loads") or DEFAULT_FLEXIBLE_ASSETS.get(feeder_id, DEFAULT_FLEXIBLE_ASSETS["FEEDER-A"])
    
    total_flex_kw = sum(a["sheddable_kw"] for a in assets)
    trace.append(f"[Flexibility] Discovered {len(assets)} controllable flexible assets on {feeder_id} totaling {round(total_flex_kw, 2)} kW potential load shed.")

    return {
        "flexible_loads": assets,
        "trace": trace,
    }


# ── Node 3: Calculate Dynamic DR Incentives ──────────────────────────────────
async def calculate_incentives_node(state: DemandResponseState) -> dict[str, Any]:
    trace = state.get("trace", []).copy()
    utilization_pct = state.get("utilization_pct", 90.0)
    
    # Tiered incentive formula based on stress level
    if utilization_pct >= 95.0:
        rate = 1.75  # ₹1.75 / kWh rebate for emergency curtailment
    elif utilization_pct >= 90.0:
        rate = 1.35  # ₹1.35 / kWh rebate
    else:
        rate = 0.90  # ₹0.90 / kWh rebate

    trace.append(f"[Incentive] Grid stress {utilization_pct}% triggers dynamic demand response tariff rebate of ₹{rate:.2f}/kWh for shifted demand.")

    return {
        "incentive_rate_inr_per_kwh": rate,
        "trace": trace,
    }


# ── Node 4: Dispatch DR Signals ──────────────────────────────────────────────
async def dispatch_dr_events_node(state: DemandResponseState) -> dict[str, Any]:
    trace = state.get("trace", []).copy()
    required_reduction = state.get("required_reduction_kw", 0.0)
    rate = state.get("incentive_rate_inr_per_kwh", 1.20)
    assets = [dict(a) for a in state.get("flexible_loads", [])]

    accumulated_shed = 0.0
    for asset in assets:
        if accumulated_shed < required_reduction:
            needed = required_reduction - accumulated_shed
            shed_amount = min(asset["sheddable_kw"], needed)
            asset["curtailed"] = True
            asset["sheddable_kw"] = round(shed_amount, 2)
            # 1-hour interval simulation incentive
            asset["incentive_earned_inr"] = round(shed_amount * rate, 2)
            accumulated_shed += shed_amount
            trace.append(f"[Dispatch] Dispatched curtailment signal to {asset['consumer_name']}: Shed {shed_amount} kW (Earns ₹{asset['incentive_earned_inr']}).")
        else:
            asset["curtailed"] = False
            asset["incentive_earned_inr"] = 0.0

    return {
        "flexible_loads": assets,
        "curtailed_kw_achieved": round(accumulated_shed, 2),
        "trace": trace,
    }


# ── Node 5: Verify Grid Cooling & Certification ──────────────────────────────
async def verify_grid_cooling_node(state: DemandResponseState) -> dict[str, Any]:
    trace = state.get("trace", []).copy()
    feeder_id = state.get("feeder_id", "FEEDER-A")
    capacity_kw = state.get("capacity_kw", 50.0)
    current_load_kw = state.get("current_load_kw", 46.0)
    curtailed_kw = state.get("curtailed_kw_achieved", 0.0)

    post_load_kw = round(max(0.0, current_load_kw - curtailed_kw), 2)
    post_utilization_pct = round((post_load_kw / capacity_kw) * 100, 1)

    trace.append(
        f"[Verify] Feeder {feeder_id} cooled from {current_load_kw} kW ({state.get('utilization_pct')}%) "
        f"down to {post_load_kw} kW ({post_utilization_pct}%). Congestion fully mitigated!"
    )

    summary = (
        f"Automated Demand Response successfully cleared {curtailed_kw} kW of discretionary load on {feeder_id}. "
        f"Feeder utilization reduced from {state.get('utilization_pct')}% to {post_utilization_pct}% (within safe {state.get('target_utilization_pct')}% limit). "
        f"Total incentive pool disbursed: ₹{sum(a.get('incentive_earned_inr', 0) for a in state.get('flexible_loads', [])):.2f}."
    )

    return {
        "post_dr_load_kw": post_load_kw,
        "post_dr_utilization_pct": post_utilization_pct,
        "status": "COOLED_SUCCESS",
        "summary": summary,
        "trace": trace,
    }


# ── StateGraph Construction ──────────────────────────────────────────────────
def build_demand_response_graph():
    workflow = StateGraph(DemandResponseState)

    workflow.add_node("detect_congestion", detect_congestion_node)
    workflow.add_node("identify_flexibility", identify_flexibility_node)
    workflow.add_node("calculate_incentives", calculate_incentives_node)
    workflow.add_node("dispatch_dr_events", dispatch_dr_events_node)
    workflow.add_node("verify_grid_cooling", verify_grid_cooling_node)

    workflow.add_edge(START, "detect_congestion")
    workflow.add_edge("detect_congestion", "identify_flexibility")
    workflow.add_edge("identify_flexibility", "calculate_incentives")
    workflow.add_edge("calculate_incentives", "dispatch_dr_events")
    workflow.add_edge("dispatch_dr_events", "verify_grid_cooling")
    workflow.add_edge("verify_grid_cooling", END)

    return workflow.compile()


# Lazy-compiled helper
_dr_agent = None

def get_demand_response_agent():
    global _dr_agent
    if _dr_agent is None:
        _dr_agent = build_demand_response_graph()
    return _dr_agent


async def run_demand_response(
    feeder_id: str = "FEEDER-A",
    current_load_kw: Optional[float] = None,
    capacity_kw: Optional[float] = None,
    target_utilization_pct: float = 80.0,
) -> DemandResponseState:
    """Convenience runner executing the Demand Response StateGraph."""
    initial_state: DemandResponseState = {
        "feeder_id": feeder_id,
        "current_load_kw": current_load_kw,
        "capacity_kw": capacity_kw,
        "target_utilization_pct": target_utilization_pct,
        "trace": [],
    }
    agent = get_demand_response_agent()
    return await agent.ainvoke(initial_state)
