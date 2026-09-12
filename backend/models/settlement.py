"""
Settlement model — append-only audit ledger for finalized trades.

IMPORTANT: Only pseudonymous trade metadata goes here:
  trade_id, pseudonymous participant IDs (not user_id), quantity, price,
  timestamp, billing_status, audit_tx (hash).

Raw meter readings, real user identities, live order book state, and
pricing calculations are deliberately excluded per data-handling policy.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class BillingStatus(str, enum.Enum):
    pending = "PENDING"
    dispatched = "DISPATCHED"   # sent to mocked DISCOM billing adapter
    confirmed = "CONFIRMED"     # mocked DISCOM acknowledged
    failed = "FAILED"


class Settlement(Base):
    __tablename__ = "settlements"

    settlement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trade_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trades.trade_id"), nullable=False, unique=True, index=True
    )

    # Pseudonymous participant references (hashed wallet IDs, not user PKs)
    seller_ref: Mapped[str] = mapped_column(String(64), nullable=False)
    buyer_ref: Mapped[str] = mapped_column(String(64), nullable=False)

    quantity_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    clearing_price: Mapped[float] = mapped_column(Float, nullable=False)
    gross_value: Mapped[float] = mapped_column(Float, nullable=False)  # qty * price

    # DISCOM platform fee (e.g., 0.5% of gross_value)
    platform_fee: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Net amount credited to seller's wallet
    seller_credit: Mapped[float] = mapped_column(Float, nullable=False)
    # Net amount debited from buyer's wallet
    buyer_debit: Mapped[float] = mapped_column(Float, nullable=False)

    # Reference ID from the mocked DISCOM billing system
    utility_reference: Mapped[str | None] = mapped_column(String(64), nullable=True)

    billing_status: Mapped[BillingStatus] = mapped_column(
        Enum(BillingStatus, name="billing_status"),
        nullable=False,
        default=BillingStatus.pending,
        index=True,
    )

    # Audit hash — SHA-256 of (trade_id + seller_ref + buyer_ref + qty + price + timestamp)
    # In the Hardhat stretch goal, this hash is the on-chain transaction ID
    audit_tx: Mapped[str | None] = mapped_column(String(128), nullable=True)

    settled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    trade: Mapped["Trade"] = relationship("Trade", back_populates="settlement")

    def __repr__(self) -> str:
        return (
            f"<Settlement trade={self.trade_id} "
            f"{self.quantity_kwh}kWh @₹{self.clearing_price} "
            f"[{self.billing_status.value}]>"
        )
