"""
Pydantic Schemas for POWERFLOW MCP Server.
Provides strict validation for inputs and standardized, machine-readable responses.
"""

from datetime import datetime, timezone
from typing import Any, Optional, Literal
from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
#  REQUEST SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class MeterQuery(BaseModel):
    meter_id: str = Field(..., description="Unique smart meter or household ID, e.g., 'H001', 'H012'")

    @field_validator("meter_id")
    @classmethod
    def validate_meter(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("meter_id cannot be empty")
        return v


class FeederQuery(BaseModel):
    feeder_id: str = Field(..., description="Electrical distribution feeder ID, e.g., 'FEEDER-A', 'FEEDER-B'")

    @field_validator("feeder_id")
    @classmethod
    def validate_feeder(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("feeder_id cannot be empty")
        return v


class TradeQuery(BaseModel):
    trade_id: str = Field(..., description="Unique trade or settlement ID, e.g., 'TRD-2026-0001'")

    @field_validator("trade_id")
    @classmethod
    def validate_trade(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("trade_id cannot be empty")
        return v


class CreateBuyOrderRequest(BaseModel):
    user_id: str = Field(..., description="Registered household/consumer ID placing the buy order, e.g. 'H011'")
    quantity_kwh: float = Field(..., gt=0.0, le=100.0, description="Energy quantity requested to purchase in kWh (e.g., 2.5)")
    max_price: float = Field(..., gt=0.0, description="Maximum bid price willing to pay in INR/kWh (e.g., 6.00)")
    meter_id: Optional[str] = Field(None, description="Optional associated smart meter ID. Defaults to user_id if not specified.")

    @field_validator("quantity_kwh")
    @classmethod
    def validate_qty(cls, v: float) -> float:
        if v < 0.1:
            raise ValueError("Minimum order quantity is 0.1 kWh")
        return round(v, 4)

    @field_validator("max_price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v < 3.0 or v > 15.0:
            raise ValueError("Order price must be within regulatory limits (₹3.00 to ₹15.00 / kWh)")
        return round(v, 2)


class CreateSellOrderRequest(BaseModel):
    user_id: str = Field(..., description="Registered prosumer ID offering surplus solar energy, e.g. 'H001'")
    quantity_kwh: float = Field(..., gt=0.0, le=100.0, description="Surplus renewable energy quantity in kWh (e.g., 3.0)")
    min_price: float = Field(..., gt=0.0, description="Minimum ask price willing to accept in INR/kWh (e.g., 4.50)")
    meter_id: Optional[str] = Field(None, description="Optional associated smart meter ID. Defaults to user_id if not specified.")

    @field_validator("quantity_kwh")
    @classmethod
    def validate_qty(cls, v: float) -> float:
        if v < 0.1:
            raise ValueError("Minimum order quantity is 0.1 kWh")
        return round(v, 4)

    @field_validator("min_price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v < 3.0 or v > 15.0:
            raise ValueError("Order price must be within regulatory limits (₹3.00 to ₹15.00 / kWh)")
        return round(v, 2)


# ─────────────────────────────────────────────────────────────────────────────
#  STRUCTURED RESPONSE SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class BaseResponse(BaseModel):
    status: Literal["SUCCESS", "ERROR", "WARNING"] = "SUCCESS"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MeterReadingResponse(BaseResponse):
    meter_id: str
    feeder_id: str
    household_type: Literal["prosumer", "consumer"]
    solar_generation_kw: float
    current_load_kw: float
    net_power_kw: float
    surplus_kwh: float
    demand_kwh: float
    panel_capacity_kw: float
    reading_timestamp: str
    grid_decision: str


class DemandForecastResponse(BaseResponse):
    meter_id: str
    feeder_id: str
    forecast_horizon_hours: int
    predicted_demand_kwh: float
    confidence_interval_lower_kwh: float
    confidence_interval_upper_kwh: float
    peak_expected_hour: int
    model_version: str
    features_used: list[str]
    forecast_generated_at: str


class SolarForecastResponse(BaseResponse):
    meter_id: str
    feeder_id: str
    panel_capacity_kw: float
    forecast_horizon_hours: int
    expected_irradiance_wm2: float
    expected_temperature_c: float
    predicted_solar_generation_kwh: float
    expected_surplus_kwh: float
    model_version: str
    forecast_generated_at: str


class GridStatusResponse(BaseResponse):
    feeder_id: str
    capacity_kw: float
    current_load_kw: float
    available_headroom_kw: float
    utilization_pct: float
    congestion_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    trade_decision: Literal["TRADE_ALLOWED", "TRADE_LIMITED", "TRADE_REJECTED"]
    discom_safety_rule: str
    substation_status: str


class MarketPriceResponse(BaseResponse):
    feeder_id: str
    indicative_price_inr_per_kwh: float
    base_price_inr_per_kwh: float
    price_floor_inr_per_kwh: float
    price_cap_inr_per_kwh: float
    demand_supply_ratio: float
    discom_wheeling_charge_inr: float
    market_interval: str
    pricing_model: str


class AvailableSurplusResponse(BaseResponse):
    meter_id: str
    feeder_id: str
    household_type: str
    solar_generation_kw: float
    current_load_kw: float
    net_exportable_surplus_kwh: float
    eligible_for_p2p_trade: bool
    restriction_reason: Optional[str] = None


class OpenOrderItem(BaseModel):
    order_id: str
    user_id: str
    feeder_id: str
    side: Literal["BUY", "SELL"]
    quantity_kwh: float
    price_inr: float
    created_at: str
    status: str


class OpenOrdersResponse(BaseResponse):
    feeder_id: Optional[str]
    total_open_orders: int
    total_buy_kwh: float
    total_sell_kwh: float
    orders: list[OpenOrderItem]


class OrderCreatedResponse(BaseResponse):
    order_id: str
    user_id: str
    meter_id: str
    feeder_id: str
    side: Literal["BUY", "SELL"]
    quantity_kwh: float
    price_inr: float
    market_interval: str
    grid_validation_status: str
    order_status: Literal["OPEN", "QUEUED", "REJECTED"] = "OPEN"
    audit_hash: str
    message: str


class TradeStatusResponse(BaseResponse):
    trade_id: str
    seller_meter_id: str
    buyer_meter_id: str
    feeder_id: str
    traded_quantity_kwh: float
    clearing_price_inr_per_kwh: float
    gross_amount_inr: float
    discom_wheeling_charge_inr: float
    net_seller_payout_inr: float
    trade_timestamp: str
    trade_status: Literal["MATCHED", "IN_DELIVERY", "COMPLETED", "FAILED"]


class SettlementStatusResponse(BaseResponse):
    trade_id: str
    settlement_id: str
    buyer_id: str
    seller_id: str
    feeder_id: str
    quantity_kwh: float
    energy_cost_inr: float
    discom_grid_fee_inr: float
    total_settled_inr: float
    payment_status: Literal["ESCROWED", "DISBURSED", "PENDING_VERIFICATION", "REFUNDED"]
    meter_verified: bool
    audit_signature: str
    settlement_completed_at: str
