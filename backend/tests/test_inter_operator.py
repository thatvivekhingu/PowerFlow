"""
Tests for Inter-Operator Communication & Availability Protocol.
"""

import pytest
from services.inter_operator_service import (
    perform_inter_operator_handshake,
    get_participant_location,
    calculate_grid_distance,
    GRID_OPERATORS,
    TIE_LINES,
)


@pytest.mark.asyncio
async def test_intra_feeder_handshake():
    """Intra-feeder trades should clear locally via median pricing without tie-line transit."""
    res = await perform_inter_operator_handshake(
        buyer_feeder_id="FEEDER-01",
        seller_feeder_id="FEEDER-01",
        quantity_kwh=5.0,
        buyer_max_price=5.20,
        seller_min_price=4.00,
    )
    assert res["status"] == "APPROVED"
    assert res["is_cross_operator"] is False
    assert res["median_clearing_price"] == 4.60  # (5.20 + 4.00) / 2
    assert "INTRA-CLEAR-" in res["clearance_token"]
    assert res["wheeling_charge_per_kwh"] == 0.02


@pytest.mark.asyncio
async def test_inter_operator_cross_feeder_handshake():
    """Inter-operator trades should query the foreign operator, reserve tie-line capacity, and sign dual token."""
    res = await perform_inter_operator_handshake(
        buyer_feeder_id="FEEDER-02",
        seller_feeder_id="FEEDER-01",
        quantity_kwh=10.0,
        buyer_max_price=4.80,
        seller_min_price=4.20,
    )
    assert res["status"] == "APPROVED"
    assert res["is_cross_operator"] is True
    assert res["median_clearing_price"] == 4.50  # (4.80 + 4.20) / 2
    assert "DUAL-IOTR-" in res["clearance_token"]
    assert res["tie_line"] is not None
    assert res["tie_line"]["tie_line_id"] == "TL-NORTH-SOUTH-33KV"
    # Combined wheeling includes local distribution + tie-line transit
    assert res["wheeling_charge_per_kwh"] == 0.04
    assert len(res["steps"]) == 5


def test_participant_location_and_distance():
    """Verify physical location resolution and electrical transit distance."""
    buyer_loc = get_participant_location("demo_consumer_01", "FEEDER-02")
    seller_loc = get_participant_location("demo_prosumer_01", "FEEDER-01")

    assert "Sector 22" in buyer_loc["address"]
    assert "Sector 14" in seller_loc["address"]
    assert buyer_loc["latitude"] > 0
    assert seller_loc["longitude"] > 0

    dist = calculate_grid_distance("FEEDER-02", "FEEDER-01")
    assert dist["is_cross_operator"] is True
    assert dist["physical_distance_km"] > 4.0
    assert "33kV" in dist["electrical_path"]
