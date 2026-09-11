# POWERFLOW MCP — Example AI Agent Conversations

This document demonstrates real interactions between an end-user and an AI Assistant equipped with the **POWERFLOW Model Context Protocol (MCP) Server**.

---

## Conversation 1: Feeder Demand Inquiry

**User:**
> "What is the expected demand in feeder FEEDER-A?"

**AI Agent Internal Reasoning:**
1. The user is asking about electrical demand and status on feeder `FEEDER-A`.
2. This is a read-only query.
3. I should first verify the real-time electrical grid status of `FEEDER-A` using `get_grid_status` to determine capacity and active load.
4. I will then call `get_demand_forecast` for a representative smart meter on `FEEDER-A` (e.g. `H011`) over a 24-hour horizon.

**Tool Calls Executed by AI:**
```json
// Tool Call 1
{
  "name": "get_grid_status",
  "arguments": {
    "feeder_id": "FEEDER-A"
  }
}
```
*Tool Response:*
```json
{
  "status": "SUCCESS",
  "feeder_id": "FEEDER-A",
  "capacity_kw": 100.0,
  "current_load_kw": 2.72,
  "available_headroom_kw": 97.28,
  "utilization_pct": 2.7,
  "congestion_level": "LOW",
  "trade_decision": "TRADE_ALLOWED",
  "discom_safety_rule": "Enforcing IEEE 1547 / CEA Technical Standards for Grid Connectivity",
  "substation_status": "NORMAL_OPERATION"
}
```

```json
// Tool Call 2
{
  "name": "get_demand_forecast",
  "arguments": {
    "meter_id": "H011",
    "horizon_hours": 24
  }
}
```
*Tool Response:*
```json
{
  "status": "SUCCESS",
  "meter_id": "H011",
  "feeder_id": "FEEDER-A",
  "forecast_horizon_hours": 24,
  "predicted_demand_kwh": 8.228,
  "confidence_interval_lower_kwh": 7.57,
  "confidence_interval_upper_kwh": 8.887,
  "peak_expected_hour": 19,
  "model_version": "demand-opsd-xgb-v1.2",
  "features_used": ["hour_of_day", "ambient_temperature_c", "is_weekend", "household_base_kw"],
  "forecast_generated_at": "2026-09-12T02:59:03.552101+00:00"
}
```

**AI Assistant Final Response:**
> **Feeder FEEDER-A Demand & Grid Status:**
> - **Feeder Capacity:** 100.0 kW (Active Load: 2.72 kW, Available Headroom: 97.28 kW)
> - **Grid Utilization:** 2.7% (**LOW** congestion, P2P trades permitted)
> - **24-Hour Predicted Demand:** ~8.23 kWh for residential loads (95% CI: 7.57 – 8.89 kWh)
> - **Peak Consumption Period:** Expected at **19:00 hrs (7:00 PM)**
> - **Forecasting Model:** `demand-opsd-xgb-v1.2`

---

## Conversation 2: Solar Surplus Inquiry

**User:**
> "How much solar surplus is expected for prosumer H001?"

**AI Agent Internal Reasoning:**
1. The user wants to know both the immediate surplus available right now and the expected generation over the next 24 hours.
2. I should call `get_available_surplus(meter_id="H001")` to inspect current generation vs load.
3. I should also invoke `get_solar_forecast(meter_id="H001", horizon_hours=24)` to calculate forecast generation and exportable kWh.

**Tool Calls Executed by AI:**
```json
// Tool Call 1
{
  "name": "get_available_surplus",
  "arguments": {
    "meter_id": "H001"
  }
}
```
*Tool Response:*
```json
{
  "status": "SUCCESS",
  "meter_id": "H001",
  "feeder_id": "FEEDER-A",
  "household_type": "prosumer",
  "solar_generation_kw": 1.45,
  "current_load_kw": 0.45,
  "net_exportable_surplus_kwh": 0.25,
  "eligible_for_p2p_trade": true,
  "restriction_reason": null
}
```

```json
// Tool Call 2
{
  "name": "get_solar_forecast",
  "arguments": {
    "meter_id": "H001",
    "horizon_hours": 24
  }
}
```
*Tool Response:*
```json
{
  "status": "SUCCESS",
  "meter_id": "H001",
  "feeder_id": "FEEDER-A",
  "panel_capacity_kw": 3.5,
  "forecast_horizon_hours": 24,
  "expected_irradiance_wm2": 520.0,
  "expected_temperature_c": 38.0,
  "predicted_solar_generation_kwh": 11.215,
  "expected_surplus_kwh": 6.729,
  "model_version": "solar-physical-derated-v2.0",
  "forecast_generated_at": "2026-09-12T02:59:03.552933+00:00"
}
```

**AI Assistant Final Response:**
> **Prosumer H001 Solar Generation & Surplus Forecast:**
> - **Current Status:** Generating 1.45 kW solar output with 0.45 kW household consumption. **0.25 kWh** is currently ready for export into the P2P marketplace.
> - **24-Hour Generation Forecast:** **11.22 kWh** total production based on 3.5 kWp system rating and 520 W/m² irradiance.
> - **Expected 24-Hour Tradeable Surplus:** **~6.73 kWh** after factoring in household baseline consumption and thermal derating.
> - **Market Eligibility:** **Approved** (FEEDER-A has sufficient headroom to absorb reverse power flow).

---

## Conversation 3: Local Energy Price Inquiry

**User:**
> "What is the current local energy price in FEEDER-A?"

**AI Agent Internal Reasoning:**
1. The user needs the current clearing / indicative price for feeder `FEEDER-A`.
2. I will execute the read-only tool `get_market_price(feeder_id="FEEDER-A")`.

**Tool Call Executed by AI:**
```json
{
  "name": "get_market_price",
  "arguments": {
    "feeder_id": "FEEDER-A"
  }
}
```
*Tool Response:*
```json
{
  "status": "SUCCESS",
  "feeder_id": "FEEDER-A",
  "indicative_price_inr_per_kwh": 5.81,
  "base_price_inr_per_kwh": 5.0,
  "price_floor_inr_per_kwh": 3.0,
  "price_cap_inr_per_kwh": 8.0,
  "demand_supply_ratio": 1.43,
  "discom_wheeling_charge_inr": 0.25,
  "market_interval": "15_MIN_ROLLING_AUCTION",
  "pricing_model": "BOUNDED_DYNAMIC_SENSITIVITY"
}
```

**AI Assistant Final Response:**
> **Local P2P Energy Price (FEEDER-A):**
> - **Indicative Clearing Price:** **₹5.81 / kWh**
> - **Base Tariff:** ₹5.00 / kWh
> - **Regulatory Bounds:** Floor = ₹3.00 / kWh, Cap = ₹8.00 / kWh
> - **Demand / Supply Ratio:** 1.43 (moderately high local demand relative to solar supply)
> - **DISCOM Wheeling Charge:** ₹0.25 / kWh (applied on gross energy traded)
> - **Settlement Interval:** 15-minute rolling double auction

---

## Conversation 4: Buy Order Creation (State-Changing Operation)

**User:**
> "Create a buy order for 2 kWh up to ₹6/kWh for user H011"

**AI Agent Internal Reasoning:**
1. The user explicitly stated intent to purchase energy ("Create a buy order").
2. This is a **STATE-CHANGING** tool invocation.
3. Parameters:
   - `user_id`: "H011"
   - `quantity_kwh`: 2.0
   - `max_price`: 6.00
4. Safety & Validation:
   - Quantity 2.0 kWh is within allowed limits (0.1 to 50 kWh).
   - Price ₹6.00 is within regulatory bounds (₹3.00 to ₹15.00).
   - The MCP server will automatically verify feeder headroom on `FEEDER-A` before placing the order.
   - An immutable audit log entry will be created.

**Tool Call Executed by AI:**
```json
{
  "name": "create_buy_order",
  "arguments": {
    "user_id": "H011",
    "quantity_kwh": 2.0,
    "max_price": 6.00
  }
}
```
*Tool Response:*
```json
{
  "status": "SUCCESS",
  "order_id": "BUY-H011-1789181943",
  "user_id": "H011",
  "meter_id": "H011",
  "feeder_id": "FEEDER-A",
  "side": "BUY",
  "quantity_kwh": 2.0,
  "price_inr": 6.0,
  "market_interval": "15-MIN-P2P",
  "grid_validation_status": "PASSED_GRID_HEADROOM_CHECK",
  "order_status": "OPEN",
  "audit_hash": "021976c1558e62ba",
  "message": "Buy order BUY-H011-1789181943 successfully validated and registered on FEEDER-A."
}
```

**AI Assistant Final Response:**
> ✅ **Your buy order has been successfully placed on the POWERFLOW P2P Marketplace!**
> 
> - **Order ID:** `BUY-H011-1789181943`
> - **Feeder:** FEEDER-A
> - **Energy Quantity:** 2.00 kWh
> - **Maximum Bid Price:** ₹6.00 / kWh
> - **Grid Safety Check:** **PASSED** (Feeder capacity verified by DISCOM rule engine)
> - **Orderbook Status:** `OPEN` (Awaiting matching with local prosumers)
> - **Audit Record Hash:** `021976c1558e62ba`
