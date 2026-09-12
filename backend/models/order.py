"""
Order model — buy and sell orders in the P2P marketplace.

States:
  OPEN       — submitted, awaiting match
  PARTIALLY_FILLED — partially matched (remaining quantity still open)
  MATCHED    — fully matched, pending grid validation
  SETTLED    — trade settled successfully
  CANCELLED  — cancelled by user or expired
  EXPIRED    — order past its interval with no match
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class OrderSide(str, enum.Enum):
    buy = "buy"
    sell = "sell"


class OrderStatus(str, enum.Enum):
    open = "OPEN"
    partially_filled = "PARTIALLY_FILLED"
    matched = "MATCHED"
    settled = "SETTLED"
    cancelled = "CANCELLED"
    expired = "EXPIRED"


class Order(Base):
    __tablename__ = "orders"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True
    )
    feeder_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    side: Mapped[OrderSide] = mapped_column(
        Enum(OrderSide, name="order_side"), nullable=False
    )
    quantity_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    filled_kwh: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # For sell orders: minimum acceptable price (₹/kWh)
    min_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    # For buy orders: maximum acceptable price (₹/kWh)
    max_price: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Trading interval (ISO 8601 string, e.g. "2024-01-15T12:00/2024-01-15T12:15")
    interval: Mapped[str] = mapped_column(String(64), nullable=False)

    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"),
        nullable=False,
        default=OrderStatus.open,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="orders")

    def __repr__(self) -> str:
        price_info = f"min={self.min_price}" if self.side == OrderSide.sell else f"max={self.max_price}"
        return (
            f"<Order {self.side.value.upper()} {self.quantity_kwh}kWh "
            f"{price_info} [{self.status.value}]>"
        )
