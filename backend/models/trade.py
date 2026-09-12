"""
Trade model — a matched buy+sell order pair, pending grid approval and settlement.

State machine:
  OPEN         → initial state after matching (awaiting grid check)
  MATCHED      → grid approved, ready for settlement
  GRID_LIMITED → grid approved partial quantity only
  SETTLED      → settlement complete, billing dispatched
  REJECTED     → grid rejected the trade entirely

Unmatched/fallback surplus that goes to utility export is tracked via
a special trade with status UTILITY_EXPORT (no buy_order_id).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class TradeStatus(str, enum.Enum):
    open = "OPEN"
    matched = "MATCHED"
    grid_limited = "GRID_LIMITED"
    settled = "SETTLED"
    rejected = "REJECTED"
    utility_export = "UTILITY_EXPORT"  # fallback terminal state


class Trade(Base):
    __tablename__ = "trades"

    trade_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # References to the paired orders
    buy_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.order_id"), nullable=True, index=True
    )
    sell_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.order_id"), nullable=False, index=True
    )

    feeder_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    quantity_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    # Quantity actually allowed by grid (may be < quantity_kwh when GRID_LIMITED)
    allowed_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    clearing_price: Mapped[float] = mapped_column(Float, nullable=False)

    status: Mapped[TradeStatus] = mapped_column(
        Enum(TradeStatus, name="trade_status"),
        nullable=False,
        default=TradeStatus.open,
        index=True,
    )

    # Notes from grid engine (e.g., "headroom=2.5kW, limited from 5kWh to 2.5kWh")
    grid_notes: Mapped[str | None] = mapped_column(String(256), nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    settled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    settlement: Mapped["Settlement | None"] = relationship(
        "Settlement", back_populates="trade", uselist=False
    )

    def __repr__(self) -> str:
        return (
            f"<Trade {self.trade_id} {self.quantity_kwh}kWh "
            f"@₹{self.clearing_price} [{self.status.value}]>"
        )
