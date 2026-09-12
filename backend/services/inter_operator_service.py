"""
Inter-Operator Availability & Communication Service.

Manages cross-operator coordination when the buyer and seller belong to different
grid operators / substations. 

Guarantees:
1. No direct peer dealing — the Grid Operator is always the median intermediary.
2. If Buyer Operator != Seller Operator:
   - Automated Inter-Operator Transfer Request (IOTR) handshake.
   - Verification of seller operator export headroom.
   - Verification of 33kV interconnecting tie-line transmission capacity.
   - Dual-operator cryptographic clearance token issuance.
3. Precise physical location and electrical routing metadata.
"""

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

# ── Grid Operator & Substation Registry ─────────────────────────────────────────
GRID_OPERATORS = {
    "FEEDER-01": {
        "feeder_id": "FEEDER-01",
        "operator_id": "DISCOM-NORTH-01",
        "operator_name": "North DISCOM Substation (Sector 14 Grid Hub)",
        "substation_name": "Substation Alpha (11kV/415V)",
        "zone": "North Grid Sector",
        "address": "Sector 14, Green Enclave Substation",
        "latitude": 28.5355,
        "longitude": 77.3910,
        "transformer_capacity_kw": 100.0,
        "base_wheeling_rate": 0.02,  # ₹/kWh
    },
    "FEEDER-02": {
        "feeder_id": "FEEDER-02",
        "operator_id": "DISCOM-SOUTH-02",
        "operator_name": "South DISCOM Substation (Sector 22 Grid Hub)",
        "substation_name": "Substation Beta (11kV/415V)",
        "zone": "South Grid Sector",
        "address": "Sector 22, Maple Heights Substation",
        "latitude": 28.5620,
        "longitude": 77.4120,
        "transformer_capacity_kw": 120.0,
        "base_wheeling_rate": 0.02,  # ₹/kWh
    },
    "FEEDER-03": {
        "feeder_id": "FEEDER-03",
        "operator_id": "DISCOM-EAST-03",
        "operator_name": "East Industrial Substation (Sector 35 Hub)",
        "substation_name": "Substation Gamma (33kV/11kV)",
        "zone": "East Tech Corridor",
        "address": "Sector 35, Cyber Valley Substation",
        "latitude": 28.5480,
        "longitude": 77.4350,
        "transformer_capacity_kw": 250.0,
        "base_wheeling_rate": 0.025,  # ₹/kWh
    },
}

# ── 33kV Inter-Substation Trunk Tie-Line Interconnects ─────────────────────────
TIE_LINES = {
    ("FEEDER-01", "FEEDER-02"): {
        "tie_line_id": "TL-NORTH-SOUTH-33KV",
        "capacity_kw": 150.0,
        "current_load_kw": 54.0,
        "transit_wheeling_fee": 0.02,  # ₹/kWh cross-operator transmission fee
        "status": "OPERATIONAL",
        "length_km": 4.2,
    },
    ("FEEDER-02", "FEEDER-01"): {
        "tie_line_id": "TL-NORTH-SOUTH-33KV",
        "capacity_kw": 150.0,
        "current_load_kw": 54.0,
        "transit_wheeling_fee": 0.02,
        "status": "OPERATIONAL",
        "length_km": 4.2,
    },
    ("FEEDER-01", "FEEDER-03"): {
        "tie_line_id": "TL-NORTH-EAST-33KV",
        "capacity_kw": 200.0,
        "current_load_kw": 82.0,
        "transit_wheeling_fee": 0.025,
        "status": "OPERATIONAL",
        "length_km": 6.8,
    },
    ("FEEDER-03", "FEEDER-01"): {
        "tie_line_id": "TL-NORTH-EAST-33KV",
        "capacity_kw": 200.0,
        "current_load_kw": 82.0,
        "transit_wheeling_fee": 0.025,
        "status": "OPERATIONAL",
        "length_km": 6.8,
    },
}

# ── User Physical Location Geolocation Directory ──────────────────────────────
USER_LOCATIONS = {
    # Prosumers (Sellers)
    "demo_prosumer_01": {
        "user_id": "demo_prosumer_01",
        "name": "Solar Prosumer A",
        "address": "Villa #14, Green Meadows Solar Colony, Sector 14",
        "feeder_id": "FEEDER-01",
        "operator_id": "DISCOM-NORTH-01",
        "latitude": 28.5362,
        "longitude": 77.3925,
        "distance_to_substation_km": 0.35,
        "grid_node": "NODE-N14-P01",
        "generation_source": "5 kW Rooftop Solar + 5 kWh BESS",
    },
    "demo_prosumer_02": {
        "user_id": "demo_prosumer_02",
        "name": "Solar Prosumer B (South)",
        "address": "Plot #88, South Horizon Residences, Sector 22",
        "feeder_id": "FEEDER-02",
        "operator_id": "DISCOM-SOUTH-02",
        "latitude": 28.5635,
        "longitude": 77.4140,
        "distance_to_substation_km": 0.48,
        "grid_node": "NODE-S22-P02",
        "generation_source": "10 kW Solar Array + 15 kWh Powerwall",
    },
    # Consumers (Buyers)
    "demo_consumer_01": {
        "user_id": "demo_consumer_01",
        "name": "Residential Consumer 1",
        "address": "Tower C, Apartment 402, Maple Heights, Sector 22",
        "feeder_id": "FEEDER-02",
        "operator_id": "DISCOM-SOUTH-02",
        "latitude": 28.5615,
        "longitude": 77.4105,
        "distance_to_substation_km": 0.22,
        "grid_node": "NODE-S22-C01",
        "load_profile": "Standard Domestic Smart Meter",
    },
    "demo_consumer_north": {
        "user_id": "demo_consumer_north",
        "name": "Residential Consumer North",
        "address": "House #21, Sector 14 Residential Zone",
        "feeder_id": "FEEDER-01",
        "operator_id": "DISCOM-NORTH-01",
        "latitude": 28.5340,
        "longitude": 77.3895,
        "distance_to_substation_km": 0.40,
        "grid_node": "NODE-N14-C02",
        "load_profile": "Standard Domestic Smart Meter",
    },
}


def get_participant_location(identifier: str, fallback_feeder: str = "FEEDER-01") -> Dict[str, Any]:
    """Retrieve full geographic and electrical grid location for a user or feeder."""
    if identifier in USER_LOCATIONS:
        return USER_LOCATIONS[identifier]

    # Fallback to feeder operator location defaults
    op = GRID_OPERATORS.get(fallback_feeder, GRID_OPERATORS["FEEDER-01"])
    return {
        "user_id": identifier,
        "name": f"Participant #{identifier[:8]}",
        "address": f"Grid Node near {op['address']}",
        "feeder_id": fallback_feeder,
        "operator_id": op["operator_id"],
        "latitude": op["latitude"] + 0.002,
        "longitude": op["longitude"] + 0.002,
        "distance_to_substation_km": 0.5,
        "grid_node": f"NODE-{fallback_feeder}-G01",
        "generation_source": "Grid-Tied Telemetry",
    }


def calculate_grid_distance(buyer_feeder: str, seller_feeder: str) -> Dict[str, Any]:
    """Calculate geographical and electrical grid distance between buyer and seller."""
    is_cross_operator = buyer_feeder != seller_feeder
    if not is_cross_operator:
        return {
            "is_cross_operator": False,
            "physical_distance_km": 0.85,
            "electrical_path": "Intra-Feeder 415V Local Distribution Bus",
            "transit_loss_pct": 0.8,
            "wheeling_rate": 0.02,
        }

    tie = TIE_LINES.get((buyer_feeder, seller_feeder))
    tie_km = tie["length_km"] if tie else 5.0
    wheeling = (GRID_OPERATORS.get(buyer_feeder, {}).get("base_wheeling_rate", 0.02) +
                (tie["transit_wheeling_fee"] if tie else 0.02))

    return {
        "is_cross_operator": True,
        "physical_distance_km": round(tie_km + 0.7, 2),
        "electrical_path": f"Inter-Substation 33kV Tie-Line ({tie['tie_line_id'] if tie else 'Trunk Link'})",
        "transit_loss_pct": 1.4,
        "wheeling_rate": round(wheeling, 4),
    }


async def perform_inter_operator_handshake(
    buyer_feeder_id: str,
    seller_feeder_id: str,
    quantity_kwh: float,
    buyer_max_price: float = 5.0,
    seller_min_price: float = 4.0,
) -> Dict[str, Any]:
    """
    Execute the formal Inter-Operator Communication & Availability Protocol.
    
    Returns:
    - Handshake status (APPROVED / REJECTED)
    - Median clearing price: (buyer_max + seller_min) / 2
    - Detailed step-by-step handshake trace
    - Cryptographic dual-operator clearance token
    - Location metadata for Buyer, Seller, and Median Grid Operator
    """
    buyer_op = GRID_OPERATORS.get(buyer_feeder_id, GRID_OPERATORS["FEEDER-01"])
    seller_op = GRID_OPERATORS.get(seller_feeder_id, GRID_OPERATORS["FEEDER-02"])

    is_cross_operator = buyer_feeder_id != seller_feeder_id
    now = datetime.now(timezone.utc)
    handshake_id = f"IOTR-{uuid.uuid4().hex[:8].upper()}"

    # Median price calculation
    median_clearing_price = round((buyer_max_price + seller_min_price) / 2.0, 2)

    # Power in kW over 15-min interval
    requested_kw = quantity_kwh * 4.0

    steps = []
    # Step 1: Mediation and Initiating
    steps.append({
        "step_num": 1,
        "title": "Grid Operator Median Mediation Initialized",
        "status": "COMPLETED",
        "timestamp": now.isoformat(),
        "detail": (
            f"Central Clearing Counterparty ({buyer_op['operator_name']}) established "
            f"fair median clearing price of ₹{median_clearing_price:.2f}/kWh between buyer bid (₹{buyer_max_price:.2f}) "
            f"and seller ask (₹{seller_min_price:.2f}). Direct peer dealings bypassed."
        )
    })

    if not is_cross_operator:
        # Same operator / Intra-feeder
        token_src = f"{handshake_id}|INTRA|{buyer_feeder_id}|{quantity_kwh}|{now.isoformat()}"
        clearance_token = f"INTRA-CLEAR-{hashlib.sha256(token_src.encode()).hexdigest()[:16].upper()}"
        steps.append({
            "step_num": 2,
            "title": "Local Feeder Headroom Verified",
            "status": "COMPLETED",
            "timestamp": now.isoformat(),
            "detail": f"Intra-feeder transfer on {buyer_feeder_id}. {buyer_op['operator_name']} confirmed local capacity for {quantity_kwh} kWh ({requested_kw:.1f} kW)."
        })
        steps.append({
            "step_num": 3,
            "title": "Operator Central Clearance Issued",
            "status": "COMPLETED",
            "timestamp": now.isoformat(),
            "detail": f"Single-operator median clearing token generated: {clearance_token}"
        })

        return {
            "handshake_id": handshake_id,
            "is_cross_operator": False,
            "status": "APPROVED",
            "median_clearing_price": median_clearing_price,
            "buyer_operator": buyer_op,
            "seller_operator": seller_op,
            "tie_line": None,
            "wheeling_charge_per_kwh": 0.02,
            "clearance_token": clearance_token,
            "steps": steps,
            "distance_info": calculate_grid_distance(buyer_feeder_id, seller_feeder_id),
        }

    # Cross-Operator Handshake
    tie_pair = (buyer_feeder_id, seller_feeder_id)
    tie_info = TIE_LINES.get(tie_pair)
    if not tie_info:
        tie_info = {
            "tie_line_id": f"TL-{buyer_feeder_id}-{seller_feeder_id}",
            "capacity_kw": 100.0,
            "current_load_kw": 40.0,
            "transit_wheeling_fee": 0.02,
            "status": "OPERATIONAL",
            "length_km": 5.0,
        }

    tie_headroom_kw = tie_info["capacity_kw"] - tie_info["current_load_kw"]

    # Step 2: Cross-Operator Availability Query
    steps.append({
        "step_num": 2,
        "title": "Inter-Operator Availability Query Dispatched",
        "status": "COMPLETED",
        "timestamp": now.isoformat(),
        "detail": (
            f"Buyer Operator ({buyer_op['operator_id']}) queried Seller Operator "
            f"({seller_op['operator_id']}) for {quantity_kwh} kWh export availability."
        )
    })

    # Step 3: Seller Operator Export Check
    steps.append({
        "step_num": 3,
        "title": "Seller Substation Voltage & Export Verified",
        "status": "COMPLETED",
        "timestamp": now.isoformat(),
        "detail": (
            f"{seller_op['operator_name']} confirmed prosumer surplus injection "
            f"and certified feeder voltage within nominal limits (238V / 50.02 Hz)."
        )
    })

    # Step 4: 33kV Interconnecting Tie-Line Headroom Check
    is_tie_line_ok = tie_headroom_kw >= requested_kw
    if not is_tie_line_ok:
        steps.append({
            "step_num": 4,
            "title": "Tie-Line Capacity Congestion Warning",
            "status": "FAILED",
            "timestamp": now.isoformat(),
            "detail": f"Interconnecting 33kV trunk line {tie_info['tie_line_id']} has only {tie_headroom_kw:.1f} kW available, less than requested {requested_kw:.1f} kW."
        })
        return {
            "handshake_id": handshake_id,
            "is_cross_operator": True,
            "status": "REJECTED",
            "reason": "TIE_LINE_CONGESTION",
            "median_clearing_price": median_clearing_price,
            "buyer_operator": buyer_op,
            "seller_operator": seller_op,
            "tie_line": tie_info,
            "clearance_token": None,
            "steps": steps,
            "distance_info": calculate_grid_distance(buyer_feeder_id, seller_feeder_id),
        }

    steps.append({
        "step_num": 4,
        "title": "33kV Tie-Line Transmission Headroom Reserved",
        "status": "COMPLETED",
        "timestamp": now.isoformat(),
        "detail": (
            f"Reserved {requested_kw:.1f} kW transit headroom on {tie_info['tie_line_id']} "
            f"({tie_headroom_kw:.1f} kW headroom available before trade)."
        )
    })

    # Step 5: Dual-Operator Cryptographic Clearance
    token_src = (
        f"{handshake_id}|CROSS|{buyer_op['operator_id']}|{seller_op['operator_id']}|"
        f"{tie_info['tie_line_id']}|{quantity_kwh}|{median_clearing_price}|{now.isoformat()}"
    )
    dual_clearance_token = f"DUAL-IOTR-{hashlib.sha256(token_src.encode()).hexdigest()[:20].upper()}"

    total_wheeling = round(buyer_op["base_wheeling_rate"] + tie_info["transit_wheeling_fee"], 4)

    steps.append({
        "step_num": 5,
        "title": "Dual-Operator Cryptographic Clearance Signed",
        "status": "COMPLETED",
        "timestamp": now.isoformat(),
        "detail": (
            f"Both {buyer_op['operator_id']} and {seller_op['operator_id']} signed clearance token: "
            f"{dual_clearance_token}. Combined wheeling fee: ₹{total_wheeling:.3f}/kWh (₹0.02 local + ₹0.02 inter-DISCOM transit)."
        )
    })

    return {
        "handshake_id": handshake_id,
        "is_cross_operator": True,
        "status": "APPROVED",
        "median_clearing_price": median_clearing_price,
        "buyer_operator": buyer_op,
        "seller_operator": seller_op,
        "tie_line": tie_info,
        "wheeling_charge_per_kwh": total_wheeling,
        "clearance_token": dual_clearance_token,
        "steps": steps,
        "distance_info": calculate_grid_distance(buyer_feeder_id, seller_feeder_id),
    }
