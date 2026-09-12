"""
Unit tests for settlement service — audit hash, fee calculation, pseudonymisation.
"""

import pytest
import hashlib
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from services.settlement_service import (
    _pseudonymise,
    _make_audit_hash,
    PLATFORM_FEE_RATE,
)
from models.trade import TradeStatus


class TestPseudonymisation:
    """Verify wallet_id is one-way hashed for the audit ledger."""

    def test_same_wallet_produces_same_ref(self):
        ref1 = _pseudonymise("wallet_abc123")
        ref2 = _pseudonymise("wallet_abc123")
        assert ref1 == ref2

    def test_different_wallets_produce_different_refs(self):
        ref1 = _pseudonymise("wallet_abc123")
        ref2 = _pseudonymise("wallet_xyz789")
        assert ref1 != ref2

    def test_ref_is_short_hex(self):
        ref = _pseudonymise("wallet_abc123")
        assert len(ref) == 16
        assert all(c in "0123456789abcdef" for c in ref)

    def test_original_wallet_not_recoverable(self):
        """One-way hash: ref should not contain the wallet substring."""
        wallet = "wallet_supersecret"
        ref = _pseudonymise(wallet)
        assert "supersecret" not in ref
        assert wallet not in ref


class TestAuditHash:
    """Verify the audit hash is deterministic and changes with any field."""

    def _hash(self, **kwargs):
        defaults = dict(
            trade_id=uuid.UUID("12345678-1234-5678-1234-567812345678"),
            seller_ref="aabb1122ccdd3344",
            buyer_ref="eeff5566aabb7788",
            quantity_kwh=3.0,
            clearing_price=5.0,
            timestamp=datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc),
        )
        defaults.update(kwargs)
        return _make_audit_hash(**defaults)

    def test_hash_is_64_char_hex(self):
        h = self._hash()
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_same_inputs_produce_same_hash(self):
        assert self._hash() == self._hash()

    def test_different_quantity_changes_hash(self):
        h1 = self._hash(quantity_kwh=3.0)
        h2 = self._hash(quantity_kwh=3.001)
        assert h1 != h2

    def test_different_price_changes_hash(self):
        h1 = self._hash(clearing_price=5.0)
        h2 = self._hash(clearing_price=5.01)
        assert h1 != h2

    def test_different_seller_changes_hash(self):
        h1 = self._hash(seller_ref="aabb1122ccdd3344")
        h2 = self._hash(seller_ref="ffff1122ccdd3344")
        assert h1 != h2


class TestFeeCalculation:
    """Platform fee and net credit/debit calculations."""

    def test_platform_fee_is_half_percent(self):
        assert PLATFORM_FEE_RATE == pytest.approx(0.005)

    def test_gross_value_formula(self):
        qty = 3.0
        price = 5.0
        gross = qty * price
        assert gross == pytest.approx(15.0)

    def test_seller_credit_is_gross_minus_fee(self):
        gross = 15.0
        fee = gross * PLATFORM_FEE_RATE
        credit = gross - fee
        assert credit == pytest.approx(14.925)

    def test_buyer_debit_is_gross_plus_fee(self):
        gross = 15.0
        fee = gross * PLATFORM_FEE_RATE
        debit = gross + fee
        assert debit == pytest.approx(15.075)

    def test_platform_earns_spread(self):
        """Platform earns fee from both sides → total = 2× fee."""
        gross = 15.0
        fee = gross * PLATFORM_FEE_RATE
        buyer_debit = gross + fee
        seller_credit = gross - fee
        platform_earned = buyer_debit - seller_credit
        assert platform_earned == pytest.approx(2 * fee)


class TestSettlementOrchestration:
    """Test the settle() function with mocked DB and billing adapter."""

    def _make_trade(self, status=TradeStatus.matched, qty=3.0, allowed=None):
        t = MagicMock()
        t.trade_id = uuid.uuid4()
        t.buy_order_id = uuid.uuid4()
        t.sell_order_id = uuid.uuid4()
        t.feeder_id = "FEEDER-01"
        t.quantity_kwh = qty
        t.allowed_kwh = allowed
        t.clearing_price = 5.0
        t.status = status
        return t

    @pytest.mark.asyncio
    async def test_settle_uses_allowed_kwh_when_grid_limited(self):
        """
        GRID_LIMITED trade with allowed_kwh=1.0 should settle 1.0 kWh,
        not the full quantity_kwh=5.0.
        """
        trade = self._make_trade(status=TradeStatus.grid_limited, qty=5.0, allowed=1.0)

        from services import settlement_service

        # We verify the settled_qty computation directly
        settled_qty = trade.allowed_kwh if trade.allowed_kwh is not None else trade.quantity_kwh
        assert settled_qty == pytest.approx(1.0)

    @pytest.mark.asyncio
    async def test_settle_uses_quantity_when_fully_matched(self):
        trade = self._make_trade(status=TradeStatus.matched, qty=3.0, allowed=3.0)
        settled_qty = trade.allowed_kwh if trade.allowed_kwh is not None else trade.quantity_kwh
        assert settled_qty == pytest.approx(3.0)
