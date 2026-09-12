"""
Pydantic schemas for all API request/response contracts.
These are distinct from the SQLAlchemy ORM models in models/.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Re-export enums from models (so routers only import from schemas) ──────────
from models.user import UserRole
from models.order import OrderSide, OrderStatus
from models.trade import TradeStatus
from models.grid_state import CongestionLevel
from models.settlement import BillingStatus


# ── Auth ───────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: uuid.UUID
    feeder_id: str


class TokenData(BaseModel):
    user_id: uuid.UUID
    role: UserRole
    feeder_id: str
    meter_id: str


# ── User ───────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6)
    role: UserRole
    meter_id: str = Field(..., min_length=4, max_length=32)
    feeder_id: str = Field(..., min_length=2, max_length=32)


class UserResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    role: UserRole
    meter_id: str
    feeder_id: str
    wallet_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Meter Readings ─────────────────────────────────────────────────────────────
class MeterReadingCreate(BaseModel):
    meter_id: str
    feeder_id: str
    timestamp: datetime
    generation_kwh: float = Field(..., ge=0.0)
    consumption_kwh: float = Field(..., ge=0.0)
    export_kwh: float = Field(..., ge=0.0)

    @field_validator("generation_kwh")
    @classmethod
    def validate_generation(cls, v: float) -> float:
        if v > 20.0:
            raise ValueError("generation_kwh exceeds physical maximum of 20 kWh per 15-min interval")
        return round(v, 4)

    @field_validator("consumption_kwh")
    @classmethod
    def validate_consumption(cls, v: float) -> float:
        if v > 10.0:
            raise ValueError("consumption_kwh exceeds physical maximum of 10 kWh per 15-min interval")
        return round(v, 4)


class MeterReadingResponse(BaseModel):
    reading_id: uuid.UUID
    meter_id: str
    feeder_id: str
    timestamp: datetime
    generation_kwh: float
    consumption_kwh: float
    export_kwh: float
    surplus_kwh: float
    is_valid: bool
    validation_notes: Optional[str] = None
    ingested_at: datetime

    model_config = {"from_attributes": True}


# ── Market Price ───────────────────────────────────────────────────────────────
class MarketPriceResponse(BaseModel):
    feeder_id: str
    price: float  # ₹/kWh
    p_base: float
    demand_index: float
    supply_index: float
    c_congestion: float
    timestamp: datetime


# ── Orders ─────────────────────────────────────────────────────────────────────
class OrderCreate(BaseModel):
    side: OrderSide
    quantity_kwh: float = Field(..., gt=0.0, le=100.0)
    min_price: Optional[float] = Field(None, ge=0.0)  # required for sell
    max_price: Optional[float] = Field(None, ge=0.0)  # required for buy
    interval: str = Field(..., description="ISO 8601 interval, e.g. 2024-01-15T12:00/2024-01-15T12:15")

    @field_validator("min_price", "max_price", mode="before")
    @classmethod
    def round_price(cls, v):
        return round(v, 2) if v is not None else v


class OrderResponse(BaseModel):
    order_id: uuid.UUID
    user_id: uuid.UUID
    feeder_id: str
    side: OrderSide
    quantity_kwh: float
    filled_kwh: float
    min_price: Optional[float]
    max_price: Optional[float]
    interval: str
    status: OrderStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Trades ─────────────────────────────────────────────────────────────────────
class TradeResponse(BaseModel):
    trade_id: uuid.UUID
    buy_order_id: Optional[uuid.UUID]
    sell_order_id: uuid.UUID
    feeder_id: str
    quantity_kwh: float
    allowed_kwh: Optional[float]
    clearing_price: float
    status: TradeStatus
    grid_notes: Optional[str]
    timestamp: datetime
    settled_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Grid State ─────────────────────────────────────────────────────────────────
class GridStateResponse(BaseModel):
    feeder_id: str
    transformer_id: str
    load_kw: float
    capacity_kw: float
    headroom_kw: float
    congestion_level: float
    congestion_band: CongestionLevel
    recorded_at: datetime

    model_config = {"from_attributes": True}


# ── Settlement ─────────────────────────────────────────────────────────────────
class SettlementResponse(BaseModel):
    settlement_id: uuid.UUID
    trade_id: uuid.UUID
    seller_ref: str
    buyer_ref: str
    quantity_kwh: float
    clearing_price: float
    gross_value: float
    platform_fee: float
    seller_credit: float
    buyer_debit: float
    utility_reference: Optional[str]
    billing_status: BillingStatus
    audit_tx: Optional[str]
    settled_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard KPIs ─────────────────────────────────────────────────────────────
class DashboardSummary(BaseModel):
    """All 6 evaluation KPIs from section 12 of the spec."""

    # Prosumer revenue uplift = P2P revenue - baseline export value
    prosumer_revenue_uplift_inr: float
    # Consumer savings = baseline retail cost - P2P purchase cost
    consumer_savings_inr: float
    # Local matching rate = locally matched kWh / available surplus kWh
    local_matching_rate: float  # 0.0–1.0
    # Grid utilization = peak feeder/transformer utilization %
    grid_utilization_pct: float  # 0–100
    # Unmatched energy = unmatched surplus / total surplus
    unmatched_energy_rate: float  # 0.0–1.0
    # Settlement success rate = settled / finalized trades
    settlement_success_rate: float  # 0.0–1.0

    # Supporting counts
    total_trades: int
    settled_trades: int
    rejected_trades: int
    utility_export_trades: int
    total_surplus_kwh: float
    matched_kwh: float
    unmatched_kwh: float

    # Current market snapshot
    current_price_inr: dict[str, float]  # feeder_id -> current price
    active_orders: int

    as_of: datetime


# ── WebSocket event payloads ───────────────────────────────────────────────────
class WSEventType(str, enum.Enum):
    price_update = "price_update"
    order_matched = "order_matched"
    grid_alert = "grid_alert"
    settlement_complete = "settlement_complete"


class WSEvent(BaseModel):
    event: WSEventType
    data: dict
    timestamp: datetime
