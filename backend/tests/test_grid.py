"""
Unit tests for grid constraint engine — headroom decision logic.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
import uuid
from datetime import datetime, timezone

from models.trade import Trade, TradeStatus
from models.grid_state import GridState, CongestionLevel
from services.grid_engine import (
    validate_trade,
    update_grid_state,
    _compute_congestion_band,
    get_feeder_headroom,
)
from config import settings


class TestCongestionBand:
    def test_green_below_threshold(self):
        assert _compute_congestion_band(0.5) == CongestionLevel.green

    def test_amber_between_threshold_and_90(self):
        assert _compute_congestion_band(0.75) == CongestionLevel.amber
        assert _compute_congestion_band(0.7) == CongestionLevel.amber

    def test_red_above_90(self):
        assert _compute_congestion_band(0.91) == CongestionLevel.red
        assert _compute_congestion_band(1.0) == CongestionLevel.red


class TestGridDecisionLogic:
    """
    Tests the three headroom decision paths from section 6 of spec.
    """

    def _make_trade(self, quantity_kwh: float, feeder_id: str = "FEEDER-01") -> Trade:
        return Trade(
            trade_id=uuid.uuid4(),
            buy_order_id=uuid.uuid4(),
            sell_order_id=uuid.uuid4(),
            feeder_id=feeder_id,
            quantity_kwh=quantity_kwh,
            clearing_price=5.0,
            status=TradeStatus.open,
        )

    def _make_grid_state(self, load_kw: float, capacity_kw: float = 100.0) -> GridState:
        load_factor = load_kw / capacity_kw
        return GridState(
            state_id=uuid.uuid4(),
            feeder_id="FEEDER-01",
            transformer_id="TX-01",
            load_kw=load_kw,
            capacity_kw=capacity_kw,
            headroom_kw=capacity_kw - load_kw,
            congestion_level=load_factor,
            congestion_band=_compute_congestion_band(load_factor),
            recorded_at=datetime.now(timezone.utc),
        )

    @pytest.mark.asyncio
    async def test_trade_allowed_within_headroom(self):
        """requested_kw ≤ headroom → TRADE_ALLOWED (MATCHED status)"""
        # 1 kWh × 4 = 4 kW requested; headroom = 100 - 30 = 70 kW
        trade = self._make_trade(quantity_kwh=1.0)
        grid_state = self._make_grid_state(load_kw=30.0)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(
            scalar_one_or_none=MagicMock(return_value=grid_state)
        ))
        db.add = MagicMock()

        result = await validate_trade(trade, db)

        assert result.status == TradeStatus.matched
        assert result.allowed_kwh == 1.0
        assert "TRADE_ALLOWED" in result.grid_notes

    @pytest.mark.asyncio
    async def test_trade_limited_partial_headroom(self):
        """0 < headroom < requested → TRADE_LIMITED (partial fill)"""
        # 5 kWh × 4 = 20 kW requested; headroom = 100 - 96 = 4 kW → allows 1 kWh
        trade = self._make_trade(quantity_kwh=5.0)
        grid_state = self._make_grid_state(load_kw=96.0)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(
            scalar_one_or_none=MagicMock(return_value=grid_state)
        ))
        db.add = MagicMock()

        result = await validate_trade(trade, db)

        assert result.status == TradeStatus.grid_limited
        assert result.allowed_kwh is not None
        assert result.allowed_kwh < trade.quantity_kwh
        assert result.allowed_kwh == pytest.approx(1.0, abs=0.01)  # 4kW / 4 = 1kWh
        assert "TRADE_LIMITED" in result.grid_notes

    @pytest.mark.asyncio
    async def test_trade_rejected_no_headroom(self):
        """headroom ≤ 0 → TRADE_REJECTED"""
        trade = self._make_trade(quantity_kwh=2.0)
        grid_state = self._make_grid_state(load_kw=100.0)  # fully loaded

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(
            scalar_one_or_none=MagicMock(return_value=grid_state)
        ))
        db.add = MagicMock()

        result = await validate_trade(trade, db)

        assert result.status == TradeStatus.rejected
        assert "TRADE_REJECTED" in result.grid_notes

    @pytest.mark.asyncio
    async def test_utility_export_created_on_rejection(self):
        """Rejected trade must trigger UTILITY_EXPORT fallback creation."""
        trade = self._make_trade(quantity_kwh=3.0)
        grid_state = self._make_grid_state(load_kw=102.0)  # over capacity

        added_objects = []
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(
            scalar_one_or_none=MagicMock(return_value=grid_state)
        ))
        db.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))

        await validate_trade(trade, db)

        # A UTILITY_EXPORT Trade should have been added
        fallback_trades = [o for o in added_objects if isinstance(o, Trade)]
        assert len(fallback_trades) == 1
        assert fallback_trades[0].status == TradeStatus.utility_export
        assert fallback_trades[0].buy_order_id is None

    @pytest.mark.asyncio
    async def test_utility_export_created_for_limited_remainder(self):
        """GRID_LIMITED: remainder quantity goes to UTILITY_EXPORT."""
        trade = self._make_trade(quantity_kwh=5.0)
        grid_state = self._make_grid_state(load_kw=96.0)  # headroom = 4kW → 1kWh allowed

        added_objects = []
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(
            scalar_one_or_none=MagicMock(return_value=grid_state)
        ))
        db.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))

        await validate_trade(trade, db)

        fallback_trades = [o for o in added_objects if isinstance(o, Trade)]
        assert len(fallback_trades) == 1
        fallback = fallback_trades[0]
        assert fallback.status == TradeStatus.utility_export
        # Remainder = 5 - 1 = 4 kWh
        assert fallback.quantity_kwh == pytest.approx(4.0, abs=0.01)
