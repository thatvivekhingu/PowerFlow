"""
GridState model — snapshot of feeder/transformer load per interval.
Updated by the simulator and the grid constraint engine.

congestion_level: 0.0–1.0 normalized load factor
  < 0.7  → GREEN  (no congestion surcharge)
  0.7–0.9 → AMBER (partial congestion surcharge)
  > 0.9  → RED    (maximum congestion surcharge, trades may be rejected)
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class CongestionLevel(str, enum.Enum):
    green = "GREEN"
    amber = "AMBER"
    red = "RED"


class GridState(Base):
    __tablename__ = "grid_states"

    state_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    feeder_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    transformer_id: Mapped[str] = mapped_column(String(32), nullable=False)

    # Current aggregate load on this feeder (kW)
    load_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Transformer nameplate capacity (kW)
    capacity_kw: Mapped[float] = mapped_column(Float, nullable=False)
    # Headroom = capacity_kw - load_kw
    headroom_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Normalized 0–1 load factor (load_kw / capacity_kw)
    congestion_level: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Human-readable congestion band
    congestion_band: Mapped[CongestionLevel] = mapped_column(
        Enum(CongestionLevel, name="congestion_level_enum"),
        nullable=False,
        default=CongestionLevel.green,
    )

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    def __repr__(self) -> str:
        return (
            f"<GridState feeder={self.feeder_id} "
            f"load={self.load_kw:.1f}/{self.capacity_kw:.1f}kW "
            f"headroom={self.headroom_kw:.1f}kW [{self.congestion_band.value}]>"
        )
