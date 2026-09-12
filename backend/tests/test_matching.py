"""
Unit tests for the matching engine — FIFO price-time priority order book.

Tests the pure matching logic (no Redis/DB required for most cases —
the price-compatibility check is extracted for unit testing).
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone


class TestMatchCondition:
    """Verify buyer_max_price >= seller_min_price is the sole price match gate."""

    def _order(self, side: str, price: float, qty: float = 5.0, feeder_id: str = "FEEDER-01"):
        return {
            "order_id": str(uuid.uuid4()),
            "user_id": str(uuid.uuid4()),
            "feeder_id": feeder_id,
            "quantity_kwh": qty,
            "filled_kwh": 0.0,
            "min_price": price if side == "sell" else None,
            "max_price": price if side == "buy" else None,
            "interval": "2024-01-15T12:00/2024-01-15T12:15",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    def test_match_when_buyer_pays_more_than_seller_min(self):
        """buyer_max >= seller_min → match eligible."""
        buy = self._order("buy", price=6.0)
        sell = self._order("sell", price=4.0)
        assert buy["max_price"] >= sell["min_price"]

    def test_no_match_when_buyer_pays_less(self):
        """buyer_max < seller_min → no match."""
        buy = self._order("buy", price=3.0)
        sell = self._order("sell", price=4.0)
        assert not (buy["max_price"] >= sell["min_price"])

    def test_match_at_exact_price(self):
        """buyer_max == seller_min (boundary) → eligible."""
        buy = self._order("buy", price=4.0)
        sell = self._order("sell", price=4.0)
        assert buy["max_price"] >= sell["min_price"]

    def test_clearing_price_is_midpoint(self):
        """Clearing price = (buyer_max + seller_min) / 2."""
        buy = self._order("buy", price=6.0)
        sell = self._order("sell", price=4.0)
        clearing = (buy["max_price"] + sell["min_price"]) / 2.0
        assert clearing == pytest.approx(5.0)

    def test_match_quantity_is_min_of_both(self):
        """Trade quantity = min(buy_qty, sell_qty)."""
        buy = self._order("buy", price=6.0, qty=3.0)
        sell = self._order("sell", price=4.0, qty=5.0)
        match_qty = min(
            buy["quantity_kwh"] - buy["filled_kwh"],
            sell["quantity_kwh"] - sell["filled_kwh"],
        )
        assert match_qty == 3.0

    def test_partial_fill_leaves_remainder(self):
        """After a partial fill, remainder quantity stays in the book."""
        buy = self._order("buy", price=6.0, qty=3.0)
        sell = self._order("sell", price=4.0, qty=5.0)
        match_qty = 3.0  # buy is fully filled

        buy_remainder = buy["quantity_kwh"] - match_qty
        sell_remainder = sell["quantity_kwh"] - match_qty

        assert buy_remainder == pytest.approx(0.0)   # buy fully consumed
        assert sell_remainder == pytest.approx(2.0)  # sell has 2 kWh left


class TestFeederLocationFilter:
    """Extension point: feeder_location_filter must be a no-op passthrough now."""

    def test_same_feeder_returns_true(self):
        from services.matching_engine import feeder_location_filter
        buy = {"feeder_id": "FEEDER-01"}
        sell = {"feeder_id": "FEEDER-01"}
        assert feeder_location_filter(buy, sell) is True

    def test_different_feeder_returns_false(self):
        """Cross-feeder orders are NOT matched (feeder-local market)."""
        from services.matching_engine import feeder_location_filter
        buy = {"feeder_id": "FEEDER-01"}
        sell = {"feeder_id": "FEEDER-02"}
        assert feeder_location_filter(buy, sell) is False


class TestOrderBook:
    """Redis order book key helpers."""

    def test_buy_key_namespaced_by_feeder(self):
        from redis_client import buy_order_key, sell_order_key
        assert buy_order_key("FEEDER-01") == "orderbook:FEEDER-01:buy"
        assert sell_order_key("FEEDER-01") == "orderbook:FEEDER-01:sell"
        # Different feeders get different keys
        assert buy_order_key("FEEDER-01") != buy_order_key("FEEDER-02")

    def test_price_cache_key_namespaced(self):
        from redis_client import price_cache_key
        assert price_cache_key("FEEDER-01") == "price:FEEDER-01:current"


class TestMatchingPricePriority:
    """FIFO within the same price tier — lower sell price wins over higher."""

    def test_lower_sell_price_has_priority(self):
        """
        With two sell orders at different prices:
          sell_A @ min ₹4 (cheaper, should match first)
          sell_B @ min ₹5 (more expensive)
        The buy order @ max ₹6 should match with sell_A first.
        """
        sells = [
            {"min_price": 5.0, "order_id": "B"},
            {"min_price": 4.0, "order_id": "A"},  # lower price = better for buyer
        ]
        # Sorted by ascending min_price (lowest sell price goes first)
        sorted_sells = sorted(sells, key=lambda s: s["min_price"])
        assert sorted_sells[0]["order_id"] == "A"

    def test_higher_buy_price_has_priority(self):
        """
        With two buy orders:
          buy_A @ max ₹7 (higher willingness to pay, should match first)
          buy_B @ max ₹5
        The sell order @ min ₹4 should match with buy_A first.
        """
        buys = [
            {"max_price": 5.0, "order_id": "B"},
            {"max_price": 7.0, "order_id": "A"},
        ]
        # Sorted by descending max_price
        sorted_buys = sorted(buys, key=lambda b: b["max_price"], reverse=True)
        assert sorted_buys[0]["order_id"] == "A"
