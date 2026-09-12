"""
User model.
Roles:
  prosumer         — household with rooftop solar; can post sell orders
  consumer         — household without solar; can post buy orders
  discom_operator  — grid operator; can view all trades, trigger settlement
  regulator        — read-only audit access to all data
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

import enum


class UserRole(str, enum.Enum):
    prosumer = "prosumer"
    consumer = "consumer"
    discom_operator = "discom_operator"
    regulator = "regulator"


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False
    )
    # Physical identifiers
    meter_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    feeder_id: Mapped[str] = mapped_column(String(32), nullable=False)
    # Mock wallet — no real payment integration
    wallet_id: Mapped[str] = mapped_column(String(64), nullable=False, default=lambda: f"wallet_{uuid.uuid4().hex[:12]}")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="user")

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.role.value}) meter={self.meter_id}>"
