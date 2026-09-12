"""
MeterReading model.
15-minute interval readings from the smart meter simulator.
Raw readings are kept off the audit ledger — only settlement summaries
(pseudonymised) are in the Settlement table.

Validation rules (enforced at ingestion):
  - generation_kwh, consumption_kwh, export_kwh ≥ 0
  - generation_kwh ≤ 20 kWh per 15-min interval (physical max ~80 kW panel)
  - consumption_kwh ≤ 10 kWh per 15-min interval
  - export_kwh ≤ generation_kwh
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class MeterReading(Base):
    __tablename__ = "meter_readings"

    reading_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    meter_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    feeder_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    generation_kwh: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    consumption_kwh: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    export_kwh: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Net surplus available for P2P trading in this interval
    # surplus = generation - consumption (positive = prosumer has energy to sell)
    surplus_kwh: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Flag set to False if reading failed sanity checks (still persisted for audit)
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    validation_notes: Mapped[str | None] = mapped_column(String(256), nullable=True)

    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<MeterReading meter={self.meter_id} @{self.timestamp} "
            f"gen={self.generation_kwh:.2f} con={self.consumption_kwh:.2f} "
            f"surplus={self.surplus_kwh:.2f}>"
        )
