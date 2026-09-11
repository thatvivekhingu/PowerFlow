"""
╔══════════════════════════════════════════════════════════════════╗
║      POWERFLOW — 2026 Synthetic Telemetry Generator             ║
║      Real Open-Meteo 2026 Weather → Realistic P2P Dataset       ║
╚══════════════════════════════════════════════════════════════════╝

Combines:
  • Real Open-Meteo 2026 solar radiation + weather (already downloaded)
  • OPSD-calibrated solar & load patterns
  • 25 household profiles (prosumers + consumers)
  • 15-minute interval resolution

Outputs:
  • data/powerflow_2026_telemetry.csv   → backtesting
  • data/powerflow_2026_mock_db.json    → DB seeding

Usage:
  python scripts/gen_2026_dataset.py
"""

import json
import math
import random
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import pandas as pd
    import numpy as np
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pandas", "numpy", "-q"])
    import pandas as pd
    import numpy as np

# ───────────────────────────────────────────────────────────────
#  CONFIG
# ───────────────────────────────────────────────────────────────

DATA_DIR    = Path("data")
WEATHER_FILE = DATA_DIR / "open_meteo_forecast.json"
OUT_CSV     = DATA_DIR / "powerflow_2026_telemetry.csv"
OUT_JSON    = DATA_DIR / "powerflow_2026_mock_db.json"

INTERVAL_MINUTES = 15
PANEL_EFFICIENCY = 0.18        # 18% panel efficiency
PANEL_AREA_M2    = 20          # ~3 kWp system per prosumer

# Bounded dynamic pricing params (INR/kWh)
P_BASE, P_MIN, P_MAX = 5.0, 3.0, 8.0
ALPHA, BETA          = 1.5, 1.0  # demand / supply sensitivity

SEED = 2026
rng  = np.random.default_rng(SEED)

logging.basicConfig(level=logging.INFO, format="  %(levelname)-8s %(message)s")
log = logging.getLogger("powerflow.gen2026")

# ───────────────────────────────────────────────────────────────
#  HOUSEHOLD PROFILES (calibrated to OPSD DE_KN households)
# ───────────────────────────────────────────────────────────────

HOUSEHOLD_PROFILES = [
    # id,    type,         solar_kw, base_load_kw, peak_mult, feeder
    ("H001", "prosumer",   3.5,      0.15,          2.2,      "FEEDER-A"),
    ("H002", "prosumer",   4.0,      0.18,          2.5,      "FEEDER-A"),
    ("H003", "prosumer",   2.8,      0.12,          1.8,      "FEEDER-A"),
    ("H004", "prosumer",   5.0,      0.22,          3.0,      "FEEDER-A"),
    ("H005", "prosumer",   3.2,      0.14,          2.0,      "FEEDER-A"),
    ("H006", "prosumer",   4.5,      0.20,          2.8,      "FEEDER-B"),
    ("H007", "prosumer",   3.0,      0.16,          2.1,      "FEEDER-B"),
    ("H008", "prosumer",   6.0,      0.25,          3.5,      "FEEDER-B"),
    ("H009", "prosumer",   2.5,      0.13,          1.7,      "FEEDER-B"),
    ("H010", "prosumer",   3.8,      0.17,          2.3,      "FEEDER-B"),
    ("H011", "consumer",   0.0,      0.20,          2.8,      "FEEDER-A"),
    ("H012", "consumer",   0.0,      0.25,          3.2,      "FEEDER-A"),
    ("H013", "consumer",   0.0,      0.18,          2.5,      "FEEDER-A"),
    ("H014", "consumer",   0.0,      0.30,          4.0,      "FEEDER-A"),
    ("H015", "consumer",   0.0,      0.22,          2.9,      "FEEDER-B"),
    ("H016", "consumer",   0.0,      0.19,          2.6,      "FEEDER-B"),
    ("H017", "consumer",   0.0,      0.28,          3.8,      "FEEDER-B"),
    ("H018", "consumer",   0.0,      0.24,          3.1,      "FEEDER-B"),
    ("H019", "prosumer",   4.2,      0.19,          2.6,      "FEEDER-C"),
    ("H020", "prosumer",   3.6,      0.16,          2.2,      "FEEDER-C"),
    ("H021", "consumer",   0.0,      0.21,          2.9,      "FEEDER-C"),
    ("H022", "consumer",   0.0,      0.26,          3.5,      "FEEDER-C"),
    ("H023", "prosumer",   5.5,      0.23,          3.2,      "FEEDER-C"),
    ("H024", "consumer",   0.0,      0.17,          2.3,      "FEEDER-C"),
    ("H025", "prosumer",   3.0,      0.14,          1.9,      "FEEDER-C"),
]

FEEDER_CAPACITY = {"FEEDER-A": 100.0, "FEEDER-B": 80.0, "FEEDER-C": 60.0}

# ───────────────────────────────────────────────────────────────
#  LOAD WEATHER DATA
# ───────────────────────────────────────────────────────────────

def load_weather() -> dict:
    if not WEATHER_FILE.exists():
        log.warning("Weather file not found: %s — using clear-sky defaults", WEATHER_FILE)
        return {}
    with open(WEATHER_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    log.info("Loaded Open-Meteo 2026 weather: %d hourly records", len(data.get("hourly", {}).get("time", [])))
    return data


def get_hourly_arrays(weather: dict) -> tuple:
    """
    Extract parallel arrays: (timestamps, shortwave_radiation, temperature, cloud_cover)
    All indexed by hour.
    """
    if not weather:
        return [], [], [], []
    h = weather.get("hourly", {})
    times     = h.get("time", [])
    radiation = h.get("shortwave_radiation", [0] * len(times))
    temps     = h.get("temperature_2m",     [30] * len(times))
    clouds    = h.get("cloud_cover",         [50] * len(times))
    return times, radiation, temps, clouds


# ───────────────────────────────────────────────────────────────
#  SOLAR GENERATION MODEL
# ───────────────────────────────────────────────────────────────

def solar_gen_kwh(panel_kw: float, radiation_wm2: float, temp_c: float) -> float:
    """
    Estimate 15-min solar generation (kWh) from panel rating + irradiance.
    Temperature derating: panels lose ~0.4% efficiency per °C above 25°C.
    """
    if panel_kw <= 0 or radiation_wm2 <= 0:
        return 0.0
    temp_derating = max(0.0, 1.0 - 0.004 * max(0, temp_c - 25))
    # kWh = (W/m²) / 1000 * panel_kw * efficiency_factor * (15/60 h)
    gen = (radiation_wm2 / 1000.0) * panel_kw * temp_derating * (INTERVAL_MINUTES / 60.0)
    # Add ±5% measurement noise
    noise = rng.normal(1.0, 0.05)
    return max(0.0, round(gen * noise, 4))


# ───────────────────────────────────────────────────────────────
#  LOAD MODEL  (time-of-day curve calibrated to OPSD)
# ───────────────────────────────────────────────────────────────

# 24-hour base load multiplier (index = hour)
HOURLY_LOAD_CURVE = np.array([
    0.35, 0.30, 0.28, 0.27, 0.28, 0.38,   # 00–05  night / early
    0.65, 0.90, 1.00, 0.85, 0.70, 0.72,   # 06–11  morning rise
    0.75, 0.70, 0.65, 0.68, 0.80, 0.95,   # 12–17  midday / afternoon
    1.20, 1.40, 1.35, 1.10, 0.80, 0.55,   # 18–23  evening peak
])


def load_kwh(base_kw: float, peak_mult: float, hour: int,
             temp_c: float, is_weekend: bool) -> float:
    """
    Estimate 15-min household load (kWh) from profile + time + weather.
    AC boost applied when temp > 28°C.
    """
    curve_val = HOURLY_LOAD_CURVE[hour]
    wknd_adj  = 1.15 if is_weekend and 10 <= hour <= 20 else 1.0
    ac_boost  = max(0.0, (temp_c - 28) * 0.04) if temp_c > 28 else 0.0
    effective_kw = base_kw * curve_val * peak_mult * wknd_adj + ac_boost * base_kw
    # 15-min kWh + ±8% noise
    noise = rng.normal(1.0, 0.08)
    return max(0.0, round(effective_kw * noise * (INTERVAL_MINUTES / 60.0), 4))


# ───────────────────────────────────────────────────────────────
#  DYNAMIC PRICING ENGINE
# ───────────────────────────────────────────────────────────────

def compute_price(surplus_total: float, demand_total: float,
                  feeder_headroom_pct: float) -> float:
    """
    Bounded dynamic pricing:
      P = P_base + alpha*DemandIdx - beta*SupplyIdx + congestion_term
      P_final = clip(P, P_MIN, P_MAX)
    """
    supply_idx  = min(surplus_total / max(demand_total, 0.001), 1.0)
    demand_idx  = min(demand_total  / max(surplus_total, 0.001), 1.0)
    congestion  = 0.5 * (1 - feeder_headroom_pct)   # 0 = free, 0.5 = full
    raw = P_BASE + ALPHA * demand_idx - BETA * supply_idx + congestion
    return round(float(np.clip(raw, P_MIN, P_MAX)), 2)


# ───────────────────────────────────────────────────────────────
#  GRID STATE ENGINE
# ───────────────────────────────────────────────────────────────

def grid_state(feeder: str, load_kw: float) -> dict:
    capacity = FEEDER_CAPACITY[feeder]
    headroom = max(0.0, capacity - load_kw)
    util_pct = min(load_kw / capacity, 1.0)
    return {
        "feeder_id":        feeder,
        "capacity_kw":      capacity,
        "load_kw":          round(load_kw, 2),
        "headroom_kw":      round(headroom, 2),
        "utilization_pct":  round(util_pct * 100, 1),
        "congestion_level": "HIGH" if util_pct > 0.9 else "MEDIUM" if util_pct > 0.7 else "LOW",
        "trade_decision":   "TRADE_REJECTED" if util_pct > 0.95
                            else "TRADE_LIMITED" if util_pct > 0.8
                            else "TRADE_ALLOWED",
    }


# ───────────────────────────────────────────────────────────────
#  ORDER GENERATION
# ───────────────────────────────────────────────────────────────

def make_sell_order(hid: str, feeder: str, ts: str, qty: float,
                    price: float, interval_id: int) -> dict | None:
    if qty < 0.001:
        return None
    min_price = round(price * rng.uniform(0.80, 0.95), 2)
    return {
        "order_id":     f"SELL-{hid}-{interval_id:06d}",
        "household_id": hid,
        "feeder_id":    feeder,
        "side":         "SELL",
        "timestamp":    ts,
        "quantity_kwh": round(qty, 4),
        "min_price_inr": min_price,
        "status":       "OPEN",
    }


def make_buy_order(hid: str, feeder: str, ts: str, qty: float,
                   price: float, interval_id: int) -> dict | None:
    if qty < 0.001:
        return None
    max_price = round(price * rng.uniform(1.05, 1.20), 2)
    return {
        "order_id":     f"BUY-{hid}-{interval_id:06d}",
        "household_id": hid,
        "feeder_id":    feeder,
        "side":         "BUY",
        "timestamp":    ts,
        "quantity_kwh": round(qty, 4),
        "max_price_inr": max_price,
        "status":       "OPEN",
    }


# ───────────────────────────────────────────────────────────────
#  MAIN GENERATOR
# ───────────────────────────────────────────────────────────────

def generate(weather: dict) -> tuple[pd.DataFrame, dict]:
    times, radiation_arr, temp_arr, cloud_arr = get_hourly_arrays(weather)

    # Build timestamp range from weather data (or fallback)
    if times:
        start_dt = datetime.fromisoformat(times[0])
        end_dt   = datetime.fromisoformat(times[-1])
    else:
        start_dt = datetime(2026, 9, 12, 0, 0)
        end_dt   = datetime(2026, 9, 18, 23, 59)

    # 15-min timestamps
    ts_list = []
    cur = start_dt
    while cur <= end_dt:
        ts_list.append(cur)
        cur += timedelta(minutes=INTERVAL_MINUTES)

    log.info("Generating %d intervals × %d households = %d readings…",
             len(ts_list), len(HOUSEHOLD_PROFILES),
             len(ts_list) * len(HOUSEHOLD_PROFILES))

    all_rows      = []
    sell_orders   = []
    buy_orders    = []
    grid_states   = []
    interval_id   = 1

    for ts in ts_list:
        hour       = ts.hour
        is_weekend = ts.weekday() >= 5
        ts_str     = ts.strftime("%Y-%m-%dT%H:%M:00")
        date_str   = ts.strftime("%Y-%m-%d")
        time_str   = ts.strftime("%H:%M")

        # Get weather for this hour
        hour_idx = min(
            (ts - start_dt).seconds // 3600 + (ts - start_dt).days * 24,
            len(radiation_arr) - 1
        ) if radiation_arr else 0

        radiation = float(radiation_arr[hour_idx]) if radiation_arr else max(0, 600 * math.sin(math.pi * max(0, hour - 6) / 12))
        temp      = float(temp_arr[hour_idx])     if temp_arr     else 30.0
        cloud_pct = float(cloud_arr[hour_idx])    if cloud_arr    else 40.0

        # Cloud-adjusted radiation (already factored in Open-Meteo GHI, but make explicit)
        eff_radiation = radiation * (1 - cloud_pct / 200)  # mild additional cloud factor

        # Per-feeder aggregates for grid state
        feeder_load = {f: 0.0 for f in FEEDER_CAPACITY}
        feeder_surplus = {f: 0.0 for f in FEEDER_CAPACITY}
        feeder_demand  = {f: 0.0 for f in FEEDER_CAPACITY}

        # Generate per-household readings
        interval_rows = []
        for hid, htype, panel_kw, base_load_kw, peak_mult, feeder in HOUSEHOLD_PROFILES:
            gen  = solar_gen_kwh(panel_kw, eff_radiation, temp)
            load = load_kwh(base_load_kw, peak_mult, hour, temp, is_weekend)
            net  = gen - load
            surplus = max(0.0, net)
            demand  = max(0.0, -net)

            feeder_load[feeder]    += load * 4   # kWh → avg kW
            feeder_surplus[feeder] += surplus
            feeder_demand[feeder]  += demand

            interval_rows.append({
                "interval_id":   interval_id,
                "timestamp":     ts_str,
                "date":          date_str,
                "time":          time_str,
                "hour":          hour,
                "is_weekend":    is_weekend,
                "is_peak":       18 <= hour <= 21,
                "household_id":  hid,
                "household_type": htype,
                "feeder_id":     feeder,
                "panel_kw":      panel_kw,
                "solar_gen_kwh": round(gen, 4),
                "load_kwh":      round(load, 4),
                "net_kwh":       round(net, 4),
                "surplus_kwh":   round(surplus, 4),
                "demand_kwh":    round(demand, 4),
                "temperature_c": round(temp, 1),
                "radiation_wm2": round(eff_radiation, 1),
                "cloud_cover_pct": round(cloud_pct, 1),
            })

        # Compute per-feeder price + grid state
        feeder_prices = {}
        feeder_grid   = {}
        for feeder in FEEDER_CAPACITY:
            headroom_pct = max(0, FEEDER_CAPACITY[feeder] - feeder_load[feeder]) / FEEDER_CAPACITY[feeder]
            price = compute_price(feeder_surplus[feeder], feeder_demand[feeder], headroom_pct)
            feeder_prices[feeder] = price
            gs = grid_state(feeder, feeder_load[feeder])
            gs["timestamp"] = ts_str
            gs["interval_id"] = interval_id
            feeder_grid[feeder] = gs
            grid_states.append(gs)

        # Assign price to rows + create orders
        for row in interval_rows:
            feeder = row["feeder_id"]
            price  = feeder_prices[feeder]
            row["indicative_price_inr"] = price
            row["grid_decision"] = feeder_grid[feeder]["trade_decision"]
            all_rows.append(row)

            # Orders
            if row["surplus_kwh"] > 0.001:
                o = make_sell_order(row["household_id"], feeder, ts_str,
                                    row["surplus_kwh"], price, interval_id)
                if o:
                    sell_orders.append(o)
            if row["demand_kwh"] > 0.001:
                o = make_buy_order(row["household_id"], feeder, ts_str,
                                   row["demand_kwh"], price, interval_id)
                if o:
                    buy_orders.append(o)

        interval_id += 1

    df = pd.DataFrame(all_rows)

    mock_db = {
        "metadata": {
            "generated_at":   datetime.now(timezone.utc).isoformat(),
            "year":           2026,
            "source":         "Open-Meteo 2026 Real Weather + POWERFLOW Simulator",
            "households":     len(HOUSEHOLD_PROFILES),
            "intervals":      interval_id - 1,
            "total_readings": len(all_rows),
            "sell_orders":    len(sell_orders),
            "buy_orders":     len(buy_orders),
            "grid_states":    len(grid_states),
            "feeders":        list(FEEDER_CAPACITY.keys()),
        },
        "meter_readings": all_rows[:5000],   # DB seed sample
        "sell_orders":    sell_orders,
        "buy_orders":     buy_orders,
        "grid_states":    grid_states[:5000],
    }

    return df, mock_db


# ───────────────────────────────────────────────────────────────
#  REPORT
# ───────────────────────────────────────────────────────────────

def print_report(df: pd.DataFrame) -> None:
    total_solar   = df["solar_gen_kwh"].sum()
    total_load    = df["load_kwh"].sum()
    total_surplus = df["surplus_kwh"].sum()
    total_demand  = df["demand_kwh"].sum()
    matched       = min(total_surplus, total_demand)
    match_rate    = matched / max(total_demand, 1) * 100
    prosumers     = df[df["household_type"] == "prosumer"]["household_id"].nunique()
    consumers     = df[df["household_type"] == "consumer"]["household_id"].nunique()

    print()
    print("  +==================================================+")
    print("  |    POWERFLOW 2026 Dataset Report                 |")
    print("  +==================================================+")
    print(f"  |  Date range   : {df['date'].iloc[0]} to {df['date'].iloc[-1]}    |")
    print(f"  |  Households   : {prosumers} prosumers + {consumers} consumers              |")
    print(f"  |  Total rows   : {len(df):>10,}                        |")
    print(f"  |  Solar gen    : {total_solar:>10.1f} kWh                   |")
    print(f"  |  Total load   : {total_load:>10.1f} kWh                   |")
    print(f"  |  P2P surplus  : {total_surplus:>10.1f} kWh  (tradeable)        |")
    print(f"  |  P2P demand   : {total_demand:>10.1f} kWh                   |")
    print(f"  |  Match rate   : {match_rate:>9.1f}%                        |")
    print(f"  |  Avg price    : {df['indicative_price_inr'].mean():>9.2f} INR/kWh             |")
    print("  +==================================================+")
    print()

    # Feeder summary
    print("  Feeder Summary:")
    print("  -----------------------------------------")
    for feeder in df["feeder_id"].unique():
        fdf = df[df["feeder_id"] == feeder]
        print(f"  {feeder}  surplus={fdf['surplus_kwh'].sum():.1f} kWh  "
              f"demand={fdf['demand_kwh'].sum():.1f} kWh  "
              f"avg_price=₹{fdf['indicative_price_inr'].mean():.2f}")

    print()
    print("  Sample (surplus intervals):")
    cols = ["timestamp", "household_id", "solar_gen_kwh", "load_kwh",
            "surplus_kwh", "indicative_price_inr", "grid_decision"]
    sample = df[df["surplus_kwh"] > 0][cols].head(5)
    print(sample.to_string(index=False))
    print()


# ───────────────────────────────────────────────────────────────
#  ENTRY POINT
# ───────────────────────────────────────────────────────────────

def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print()
    print("  POWERFLOW — 2026 Synthetic Dataset Generator")
    print("  =============================================")
    print(f"  Weather source : {WEATHER_FILE}")
    print(f"  Households     : {len(HOUSEHOLD_PROFILES)}")
    print()

    weather = load_weather()
    df, mock_db = generate(weather)

    # Save CSV
    df.to_csv(OUT_CSV, index=False)
    log.info("Telemetry CSV  -> %s  (%.2f MB, %d rows)", OUT_CSV.name, OUT_CSV.stat().st_size / 1e6, len(df))

    # Save JSON
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(mock_db, f, indent=2, default=str)
    log.info("Mock DB JSON   -> %s  (%.2f MB)", OUT_JSON.name, OUT_JSON.stat().st_size / 1e6)

    print_report(df)
    print("  Done!")
    print(f"  CSV  : {OUT_CSV.resolve()}")
    print(f"  JSON : {OUT_JSON.resolve()}")
    print()


if __name__ == "__main__":
    main()
