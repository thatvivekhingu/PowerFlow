-- ============================================================================
-- POWERFLOW: Grid-Aware P2P Renewable Energy Marketplace
-- Production Supabase PostgreSQL Schema & High-Fidelity Dataset
-- ============================================================================
-- Architecture: Supabase RLS, Realtime, PostgreSQL 15+, EVM & LangGraph MCP
-- Standard: Indian Electricity Grid Regulations (CERC / DERC), INR Currency
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS & SUPABASE AUTH SCHEMA PREPARATION
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure auth schema exists for local/standalone migrations
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 1. ENUM DEFINITIONS
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('consumer', 'prosumer', 'admin', 'discom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE feeder_status_type AS ENUM ('NORMAL', 'WARNING', 'CONGESTED', 'OFFLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE meter_type_enum AS ENUM ('CONSUMER', 'PROSUMER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE solar_asset_status_enum AS ENUM ('ACTIVE', 'MAINTENANCE', 'OFFLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE forecast_type_enum AS ENUM ('DEMAND', 'SOLAR_GENERATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_type_enum AS ENUM ('BUY', 'SELL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM (
        'PENDING', 'GRID_CHECK', 'APPROVED', 'REJECTED', 
        'MATCHED', 'COMPLETED', 'CANCELLED', 'EXPIRED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE grid_check_result_enum AS ENUM ('APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE trade_status_enum AS ENUM (
        'MATCHED', 'SETTLEMENT_PENDING', 'SETTLED', 'FAILED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE settlement_status_enum AS ENUM (
        'PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE wallet_tx_type AS ENUM (
        'CREDIT', 'DEBIT', 'REFUND', 'ESCROW', 'WHEELING_CHARGE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_type_enum AS ENUM (
        'ORDER_APPROVED', 'ORDER_REJECTED', 'TRADE_MATCHED', 
        'PAYMENT_COMPLETED', 'GRID_CONGESTION', 'FORECAST_UPDATE', 'SYSTEM_ALERT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- 2. TABLE DEFINITIONS (16 CORE RELATIONAL ENTITIES)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES (Linked to Supabase auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role user_role_type NOT NULL DEFAULT 'consumer',
    address TEXT,
    city TEXT NOT NULL DEFAULT 'Delhi NCR',
    state TEXT NOT NULL DEFAULT 'Delhi',
    pincode TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. FEEDERS (Distribution Grid Transformer & Feeder Lines)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feeders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feeder_code TEXT UNIQUE NOT NULL,
    feeder_name TEXT NOT NULL,
    substation_name TEXT NOT NULL,
    area TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    capacity_kw NUMERIC(10, 2) NOT NULL CONSTRAINT check_feeder_capacity CHECK (capacity_kw > 0),
    current_load_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_feeder_load CHECK (current_load_kw >= 0),
    utilization_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_feeder_util CHECK (utilization_percent >= 0.00 AND utilization_percent <= 100.00),
    voltage NUMERIC(6, 2) NOT NULL DEFAULT 230.00 CONSTRAINT check_feeder_voltage CHECK (voltage >= 0),
    frequency NUMERIC(5, 2) NOT NULL DEFAULT 50.00 CONSTRAINT check_feeder_freq CHECK (frequency >= 45.00 AND frequency <= 55.00),
    status feeder_status_type NOT NULL DEFAULT 'NORMAL',
    max_safe_utilization_percent NUMERIC(5, 2) NOT NULL DEFAULT 90.00 CHECK (max_safe_utilization_percent <= 100.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. METERS (Smart Bidirectional Electric Meters)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_number TEXT UNIQUE NOT NULL,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE RESTRICT,
    meter_type meter_type_enum NOT NULL DEFAULT 'CONSUMER',
    connection_status TEXT NOT NULL DEFAULT 'CONNECTED',
    installed_capacity_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_meter_cap CHECK (installed_capacity_kw >= 0),
    current_power_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cumulative_energy_kwh NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_cum_energy CHECK (cumulative_energy_kwh >= 0),
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. SOLAR ASSETS (Rooftop PV & Inverter Assets for Prosumers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solar_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
    capacity_kw NUMERIC(10, 2) NOT NULL CONSTRAINT check_solar_cap CHECK (capacity_kw > 0),
    panel_type TEXT NOT NULL DEFAULT 'Monocrystalline Perc',
    installation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    efficiency_percent NUMERIC(5, 2) NOT NULL DEFAULT 20.50 CONSTRAINT check_solar_eff CHECK (efficiency_percent > 0 AND efficiency_percent <= 100),
    status solar_asset_status_enum NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. METER TELEMETRY (High-Resolution Time Series)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meter_telemetry (
    id BIGSERIAL PRIMARY KEY,
    meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumption_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_telem_cons CHECK (consumption_kw >= 0),
    generation_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_telem_gen CHECK (generation_kw >= 0),
    voltage NUMERIC(6, 2) NOT NULL DEFAULT 230.00 CONSTRAINT check_telem_volt CHECK (voltage >= 0),
    frequency NUMERIC(5, 2) NOT NULL DEFAULT 50.00 CONSTRAINT check_telem_freq CHECK (frequency >= 45.00 AND frequency <= 55.00),
    energy_import_kwh NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CONSTRAINT check_telem_import CHECK (energy_import_kwh >= 0),
    energy_export_kwh NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CONSTRAINT check_telem_export CHECK (energy_export_kwh >= 0),
    battery_soc_percent NUMERIC(5, 2) CONSTRAINT check_telem_soc CHECK (battery_soc_percent >= 0 AND battery_soc_percent <= 100),
    temperature NUMERIC(5, 2),
    data_quality TEXT NOT NULL DEFAULT 'GOOD'
);

-- ----------------------------------------------------------------------------
-- 6. FORECASTS (ML Demand & Solar XGBoost Inference with Explainability)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
    forecast_type forecast_type_enum NOT NULL,
    forecast_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    predicted_value NUMERIC(10, 2) NOT NULL CONSTRAINT check_pred_val CHECK (predicted_value >= 0),
    lower_bound NUMERIC(10, 2) CONSTRAINT check_lower_bound CHECK (lower_bound >= 0),
    upper_bound NUMERIC(10, 2) CONSTRAINT check_upper_bound CHECK (upper_bound >= lower_bound),
    confidence NUMERIC(5, 4) NOT NULL DEFAULT 0.9500 CONSTRAINT check_conf CHECK (confidence >= 0 AND confidence <= 1),
    model_name TEXT NOT NULL DEFAULT 'xgboost_energy_v2',
    model_version TEXT NOT NULL DEFAULT '2.4.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. MARKET PRICES (Feeder Dynamic Tariff Enforcing [₹3, ₹15] Regulatory Band)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    base_tariff NUMERIC(6, 2) NOT NULL DEFAULT 6.50 CONSTRAINT check_base_tariff CHECK (base_tariff >= 0),
    demand_factor NUMERIC(6, 4) NOT NULL DEFAULT 1.0000,
    solar_supply_factor NUMERIC(6, 4) NOT NULL DEFAULT 1.0000,
    congestion_factor NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    final_price_per_kwh NUMERIC(6, 2) NOT NULL CONSTRAINT check_price_range CHECK (final_price_per_kwh >= 3.00 AND final_price_per_kwh <= 15.00),
    min_price NUMERIC(6, 2) NOT NULL DEFAULT 3.00 CONSTRAINT check_min_p CHECK (min_price >= 3.00),
    max_price NUMERIC(6, 2) NOT NULL DEFAULT 15.00 CONSTRAINT check_max_p CHECK (max_price <= 15.00),
    market_status TEXT NOT NULL DEFAULT 'CLEARING_OPEN'
);

-- ----------------------------------------------------------------------------
-- 8. ORDERS (P2P Energy Marketplace Bids & Asks with Feeder Snapshots)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE RESTRICT,
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE RESTRICT,
    order_type order_type_enum NOT NULL,
    quantity_kwh NUMERIC(10, 2) NOT NULL CONSTRAINT check_order_qty CHECK (quantity_kwh > 0),
    price_per_kwh NUMERIC(6, 2) NOT NULL CONSTRAINT check_order_price CHECK (price_per_kwh >= 3.00 AND price_per_kwh <= 15.00),
    total_amount NUMERIC(12, 2) GENERATED ALWAYS AS (ROUND(quantity_kwh * price_per_kwh, 2)) STORED,
    status order_status_enum NOT NULL DEFAULT 'PENDING',
    grid_check_status TEXT NOT NULL DEFAULT 'PENDING',
    grid_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '4 hours'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. GRID CHECKS (Deterministic Physics & Thermal Safety Audits)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grid_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE RESTRICT,
    requested_power_kw NUMERIC(10, 2) NOT NULL,
    feeder_capacity_kw NUMERIC(10, 2) NOT NULL,
    feeder_load_kw NUMERIC(10, 2) NOT NULL,
    utilization_before NUMERIC(5, 2) NOT NULL,
    utilization_after NUMERIC(5, 2) NOT NULL,
    voltage NUMERIC(6, 2) NOT NULL DEFAULT 230.00,
    frequency NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    safety_limit NUMERIC(5, 2) NOT NULL DEFAULT 90.00,
    result grid_check_result_enum NOT NULL,
    rejection_reason TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. TRADES (Matched Bilateral P2P Contracts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buy_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    sell_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE RESTRICT,
    quantity_kwh NUMERIC(10, 2) NOT NULL CONSTRAINT check_trade_qty CHECK (quantity_kwh > 0),
    price_per_kwh NUMERIC(6, 2) NOT NULL CONSTRAINT check_trade_p CHECK (price_per_kwh >= 3.00 AND price_per_kwh <= 15.00),
    total_amount NUMERIC(12, 2) NOT NULL CONSTRAINT check_trade_amt CHECK (total_amount >= 0),
    status trade_status_enum NOT NULL DEFAULT 'MATCHED',
    matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 11. SETTLEMENTS (Financial Ledger with DISCOM Wheeling & Platform Fees)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID UNIQUE NOT NULL REFERENCES trades(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    energy_amount_kwh NUMERIC(10, 2) NOT NULL CONSTRAINT check_settle_kwh CHECK (energy_amount_kwh > 0),
    energy_payment NUMERIC(12, 2) NOT NULL CONSTRAINT check_energy_pay CHECK (energy_payment >= 0),
    wheeling_charge NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_wheel_chg CHECK (wheeling_charge >= 0),
    platform_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_plat_fee CHECK (platform_fee >= 0),
    total_buyer_payment NUMERIC(12, 2) NOT NULL CONSTRAINT check_buyer_tot CHECK (total_buyer_payment >= 0),
    seller_receivable NUMERIC(12, 2) NOT NULL CONSTRAINT check_seller_rec CHECK (seller_receivable >= 0),
    settlement_status settlement_status_enum NOT NULL DEFAULT 'PENDING',
    settlement_reference TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 12. BLOCKCHAIN TRANSACTIONS (EVM On-Chain Settlement Hashes & Proofs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blockchain_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE RESTRICT,
    settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE RESTRICT,
    network TEXT NOT NULL DEFAULT 'Hardhat EVM Local / Polygon Mumbai',
    chain_id INTEGER NOT NULL DEFAULT 31337,
    contract_address TEXT NOT NULL,
    transaction_hash TEXT UNIQUE NOT NULL,
    block_number BIGINT NOT NULL,
    gas_used BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    event_name TEXT NOT NULL DEFAULT 'TradeSettled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 13. WALLET TRANSACTIONS (Internal Balance & Escrow Movement)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    transaction_type wallet_tx_type NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CONSTRAINT check_wallet_amt CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    reference TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 14. NOTIFICATIONS (Event-Driven User Alerts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notification_type notification_type_enum NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO',
    related_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    related_trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 15. AUDIT LOGS (Immutable System State Changes & Security Events)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 16. AI AGENT EXECUTION LOGS (Traceability for LangGraph & MCP Qwen Reasoning)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL,
    user_query TEXT NOT NULL,
    detected_intent TEXT NOT NULL,
    tool_name TEXT,
    tool_input JSONB,
    tool_output JSONB,
    proposed_action TEXT,
    confirmation_required BOOLEAN NOT NULL DEFAULT true,
    user_confirmed BOOLEAN NOT NULL DEFAULT false,
    final_action TEXT,
    model_name TEXT NOT NULL DEFAULT 'Qwen 2.5 3B (Ollama)',
    model_version TEXT NOT NULL DEFAULT '2.5',
    execution_status TEXT NOT NULL DEFAULT 'COMPLETED',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE & TIME-SERIES SCALING
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_telem_meter ON meter_telemetry (meter_id);
CREATE INDEX IF NOT EXISTS idx_telem_time ON meter_telemetry (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telem_meter_time ON meter_telemetry (meter_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_forecasts_meter_time ON forecasts (meter_id, forecast_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_type ON forecasts (forecast_type, forecast_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_feeder ON orders (feeder_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id);

CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades (buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades (seller_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades (status);

CREATE INDEX IF NOT EXISTS idx_settle_status ON settlements (settlement_status);
CREATE INDEX IF NOT EXISTS idx_blockchain_hash ON blockchain_transactions (transaction_hash);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_audit_entity_time ON audit_logs (entity_type, created_at DESC);


-- ============================================================================
-- 4. DATABASE VIEWS
-- ============================================================================

-- View 1: available_energy (Current prosumer surplus & feeder health)
CREATE OR REPLACE VIEW v_available_energy AS
SELECT 
    p.id AS prosumer_id,
    p.full_name AS prosumer_name,
    m.id AS meter_id,
    m.meter_number,
    COALESCE(sa.capacity_kw, m.installed_capacity_kw) AS solar_capacity_kw,
    ROUND(GREATEST(0, m.current_power_kw), 2) AS current_generation_kw,
    ROUND(GREATEST(0, -m.current_power_kw), 2) AS current_consumption_kw,
    ROUND(GREATEST(0, m.current_power_kw), 2) AS available_surplus_kw,
    f.id AS feeder_id,
    f.feeder_code,
    f.utilization_percent AS feeder_utilization_percent,
    f.status AS feeder_status
FROM profiles p
JOIN meters m ON m.profile_id = p.id
JOIN feeders f ON f.id = m.feeder_id
LEFT JOIN solar_assets sa ON sa.meter_id = m.id
WHERE p.role = 'prosumer' AND m.connection_status = 'CONNECTED';

-- View 2: marketplace_orders (Consolidated active orderbook)
CREATE OR REPLACE VIEW v_marketplace_orders AS
SELECT 
    o.id AS order_id,
    o.order_type,
    o.quantity_kwh,
    o.price_per_kwh,
    o.total_amount,
    o.status AS order_status,
    p.id AS user_id,
    p.full_name AS user_name,
    p.role AS user_role,
    m.meter_number,
    f.feeder_code,
    f.substation_name,
    o.created_at,
    o.expires_at
FROM orders o
JOIN profiles p ON p.id = o.user_id
JOIN meters m ON m.id = o.meter_id
JOIN feeders f ON f.id = o.feeder_id
ORDER BY o.created_at DESC;

-- View 3: feeder_health (Real-time telemetry & safety headroom)
CREATE OR REPLACE VIEW v_feeder_health AS
SELECT 
    f.id AS feeder_id,
    f.feeder_code,
    f.feeder_name,
    f.substation_name,
    f.area,
    f.capacity_kw,
    f.current_load_kw,
    ROUND(f.capacity_kw - f.current_load_kw, 2) AS available_headroom_kw,
    f.utilization_percent,
    f.max_safe_utilization_percent,
    f.voltage,
    f.frequency,
    f.status,
    CASE 
        WHEN f.utilization_percent >= f.max_safe_utilization_percent THEN false 
        WHEN f.status IN ('CONGESTED', 'OFFLINE') THEN false 
        ELSE true 
    END AS trade_allowed,
    f.updated_at
FROM feeders f;

-- View 4: trade_summary (Matched trades, payments & on-chain verification)
CREATE OR REPLACE VIEW v_trade_summary AS
SELECT 
    t.id AS trade_id,
    b.full_name AS buyer_name,
    s.full_name AS seller_name,
    f.feeder_code,
    t.quantity_kwh,
    t.price_per_kwh,
    t.total_amount,
    st.wheeling_charge,
    st.platform_fee,
    st.total_buyer_payment,
    st.seller_receivable,
    t.status AS trade_status,
    st.settlement_status,
    bt.transaction_hash AS blockchain_tx_hash,
    bt.network AS blockchain_network,
    t.matched_at,
    st.completed_at
FROM trades t
JOIN profiles b ON b.id = t.buyer_id
JOIN profiles s ON s.id = t.seller_id
JOIN feeders f ON f.id = t.feeder_id
LEFT JOIN settlements st ON st.trade_id = t.id
LEFT JOIN blockchain_transactions bt ON bt.trade_id = t.id;


-- ============================================================================
-- 5. BUSINESS LOGIC STORED PROCEDURES & RPCs
-- ============================================================================

-- 1. Checking grid safety before an order
CREATE OR REPLACE FUNCTION fn_check_grid_safety(
    p_feeder_id UUID,
    p_power_kw NUMERIC
)
RETURNS TABLE (
    allowed BOOLEAN,
    rejection_reason TEXT,
    utilization_before NUMERIC,
    utilization_after NUMERIC
) AS $$
DECLARE
    v_cap NUMERIC;
    v_load NUMERIC;
    v_util_before NUMERIC;
    v_util_after NUMERIC;
    v_status feeder_status_type;
BEGIN
    SELECT capacity_kw, current_load_kw, utilization_percent, status
    INTO v_cap, v_load, v_util_before, v_status
    FROM feeders WHERE id = p_feeder_id;

    IF v_cap IS NULL THEN
        RETURN QUERY SELECT false, 'Feeder not found'::TEXT, 0.00::NUMERIC, 0.00::NUMERIC;
        RETURN;
    END IF;

    IF v_status = 'OFFLINE' THEN
        RETURN QUERY SELECT false, 'GRID_OFFLINE_REJECTION'::TEXT, v_util_before, v_util_before;
        RETURN;
    END IF;

    v_util_after := ROUND(((v_load + p_power_kw) / v_cap) * 100.0, 2);

    IF v_util_after > 90.00 OR v_status = 'CONGESTED' THEN
        RETURN QUERY SELECT false, 'GRID_CONGESTION_REJECTION'::TEXT, v_util_before, v_util_after;
    ELSE
        RETURN QUERY SELECT true, NULL::TEXT, v_util_before, v_util_after;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Checking available solar surplus for a prosumer meter
CREATE OR REPLACE FUNCTION fn_get_available_surplus(p_meter_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_gen NUMERIC := 0.00;
    v_cons NUMERIC := 0.00;
    v_surplus NUMERIC := 0.00;
BEGIN
    SELECT 
        COALESCE(generation_kw, 0.00), 
        COALESCE(consumption_kw, 0.00)
    INTO v_gen, v_cons
    FROM meter_telemetry
    WHERE meter_id = p_meter_id
    ORDER BY timestamp DESC
    LIMIT 1;

    v_surplus := GREATEST(0.00, v_gen - v_cons);
    RETURN v_surplus;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Creating a validated order with strict grid checks & role rules
CREATE OR REPLACE FUNCTION fn_create_validated_order(
    p_user_id UUID,
    p_meter_id UUID,
    p_feeder_id UUID,
    p_order_type order_type_enum,
    p_quantity_kwh NUMERIC,
    p_price_per_kwh NUMERIC
)
RETURNS UUID AS $$
DECLARE
    v_user_role user_role_type;
    v_surplus NUMERIC;
    v_grid_allowed BOOLEAN;
    v_grid_reason TEXT;
    v_util_before NUMERIC;
    v_util_after NUMERIC;
    v_order_id UUID := gen_random_uuid();
    v_order_status order_status_enum := 'APPROVED';
    v_grid_status TEXT := 'PASSED';
    v_feeder_snap JSONB;
BEGIN
    -- Regulatory price enforcement
    IF p_price_per_kwh < 3.00 OR p_price_per_kwh > 15.00 THEN
        RAISE EXCEPTION 'Price must be between INR 3.00 and 15.00 per kWh';
    END IF;

    -- User role check
    SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
    IF v_user_role = 'consumer' AND p_order_type = 'SELL' THEN
        RAISE EXCEPTION 'Consumers are strictly prohibited from creating SELL orders.';
    END IF;

    -- Surplus check for SELL orders
    IF p_order_type = 'SELL' THEN
        v_surplus := fn_get_available_surplus(p_meter_id);
        IF v_surplus < p_quantity_kwh THEN
            RAISE EXCEPTION 'Insufficient solar surplus. Available: % kWh, Requested: % kWh', v_surplus, p_quantity_kwh;
        END IF;
    END IF;

    -- Grid check
    SELECT allowed, rejection_reason, utilization_before, utilization_after
    INTO v_grid_allowed, v_grid_reason, v_util_before, v_util_after
    FROM fn_check_grid_safety(p_feeder_id, p_quantity_kwh * 0.5);

    -- Capture snapshot
    SELECT to_jsonb(f) INTO v_feeder_snap FROM feeders f WHERE id = p_feeder_id;

    IF NOT v_grid_allowed THEN
        v_order_status := 'REJECTED';
        v_grid_status := 'FAILED';
    END IF;

    -- Insert Order
    INSERT INTO orders (
        id, user_id, meter_id, feeder_id, order_type,
        quantity_kwh, price_per_kwh, status, grid_check_status, grid_snapshot
    ) VALUES (
        v_order_id, p_user_id, p_meter_id, p_feeder_id, p_order_type,
        p_quantity_kwh, p_price_per_kwh, v_order_status, v_grid_status, v_feeder_snap
    );

    -- Log Grid Check
    INSERT INTO grid_checks (
        order_id, feeder_id, requested_power_kw, feeder_capacity_kw, feeder_load_kw,
        utilization_before, utilization_after, safety_limit, result, rejection_reason
    )
    SELECT 
        v_order_id, p_feeder_id, p_quantity_kwh * 0.5, f.capacity_kw, f.current_load_kw,
        v_util_before, v_util_after, f.max_safe_utilization_percent,
        CASE WHEN v_grid_allowed THEN 'APPROVED'::grid_check_result_enum ELSE 'REJECTED'::grid_check_result_enum END,
        v_grid_reason
    FROM feeders f WHERE f.id = p_feeder_id;

    IF NOT v_grid_allowed THEN
        RAISE EXCEPTION 'Order rejected by grid safety policy: %', v_grid_reason;
    END IF;

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Matching BUY and SELL orders within clearing band
CREATE OR REPLACE FUNCTION fn_match_orders(
    p_buy_order_id UUID,
    p_sell_order_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_buy orders%ROWTYPE;
    v_sell orders%ROWTYPE;
    v_match_qty NUMERIC;
    v_match_price NUMERIC;
    v_tot_amt NUMERIC;
    v_trade_id UUID := gen_random_uuid();
BEGIN
    SELECT * INTO v_buy FROM orders WHERE id = p_buy_order_id FOR UPDATE;
    SELECT * INTO v_sell FROM orders WHERE id = p_sell_order_id FOR UPDATE;

    IF v_buy.status != 'APPROVED' OR v_sell.status != 'APPROVED' THEN
        RAISE EXCEPTION 'Both orders must be in APPROVED status to match';
    END IF;

    IF v_buy.feeder_id != v_sell.feeder_id THEN
        RAISE EXCEPTION 'Feeder-local market only: orders must originate from identical feeder';
    END IF;

    IF v_buy.price_per_kwh < v_sell.price_per_kwh THEN
        RAISE EXCEPTION 'Buyer bid price lower than seller ask price';
    END IF;

    v_match_qty := LEAST(v_buy.quantity_kwh, v_sell.quantity_kwh);
    v_match_price := ROUND((v_buy.price_per_kwh + v_sell.price_per_kwh) / 2.0, 2);
    v_tot_amt := ROUND(v_match_qty * v_match_price, 2);

    -- Insert Trade
    INSERT INTO trades (
        id, buy_order_id, sell_order_id, buyer_id, seller_id,
        feeder_id, quantity_kwh, price_per_kwh, total_amount, status
    ) VALUES (
        v_trade_id, v_buy.id, v_sell.id, v_buy.user_id, v_sell.user_id,
        v_buy.feeder_id, v_match_qty, v_match_price, v_tot_amt, 'MATCHED'
    );

    -- Update Orders
    UPDATE orders SET status = 'MATCHED' WHERE id IN (v_buy.id, v_sell.id);

    RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Creating a settlement record with DISCOM wheeling & platform fee
CREATE OR REPLACE FUNCTION fn_create_settlement(p_trade_id UUID)
RETURNS UUID AS $$
DECLARE
    v_trd trades%ROWTYPE;
    v_settle_id UUID := gen_random_uuid();
    v_wheeling_rate NUMERIC := 0.25; -- Standard INR 0.25 / kWh
    v_wheeling_amt NUMERIC;
    v_platform_fee NUMERIC := 1.50;  -- Fixed platform facilitation fee INR 1.50
    v_energy_pay NUMERIC;
    v_buyer_tot NUMERIC;
    v_seller_rec NUMERIC;
    v_ref TEXT;
BEGIN
    SELECT * INTO v_trd FROM trades WHERE id = p_trade_id FOR UPDATE;

    v_energy_pay := v_trd.total_amount;
    v_wheeling_amt := ROUND(v_trd.quantity_kwh * v_wheeling_rate, 2);
    v_buyer_tot := v_energy_pay + v_wheeling_amt + v_platform_fee;
    v_seller_rec := v_energy_pay;
    v_ref := 'SETTLE-' || UPPER(SUBSTRING(p_trade_id::text FROM 1 FOR 8)) || '-' || TO_CHAR(NOW(), 'YYYYMMDD');

    INSERT INTO settlements (
        id, trade_id, buyer_id, seller_id, energy_amount_kwh, energy_payment,
        wheeling_charge, platform_fee, total_buyer_payment, seller_receivable,
        settlement_status, settlement_reference, completed_at
    ) VALUES (
        v_settle_id, v_trd.id, v_trd.buyer_id, v_trd.seller_id, v_trd.quantity_kwh, v_energy_pay,
        v_wheeling_amt, v_platform_fee, v_buyer_tot, v_seller_rec,
        'CONFIRMED', v_ref, NOW()
    );

    UPDATE trades SET status = 'SETTLED', completed_at = NOW() WHERE id = v_trd.id;

    RETURN v_settle_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Getting marketplace energy availability
CREATE OR REPLACE FUNCTION fn_get_marketplace_energy()
RETURNS SETOF v_available_energy AS $$
    SELECT * FROM v_available_energy WHERE available_surplus_kw > 0;
$$ LANGUAGE sql STABLE;

-- 7. Getting feeder health
CREATE OR REPLACE FUNCTION fn_get_feeder_health(p_feeder_id UUID DEFAULT NULL)
RETURNS SETOF v_feeder_health AS $$
    SELECT * FROM v_feeder_health 
    WHERE (p_feeder_id IS NULL OR feeder_id = p_feeder_id);
$$ LANGUAGE sql STABLE;

-- 8. Getting user's wallet balance
CREATE OR REPLACE FUNCTION fn_get_wallet_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_credits NUMERIC := 0.00;
    v_debits NUMERIC := 0.00;
BEGIN
    SELECT COALESCE(SUM(amount), 0.00) INTO v_credits
    FROM wallet_transactions 
    WHERE user_id = p_user_id AND transaction_type IN ('CREDIT', 'REFUND') AND status = 'SUCCESS';

    SELECT COALESCE(SUM(amount), 0.00) INTO v_debits
    FROM wallet_transactions 
    WHERE user_id = p_user_id AND transaction_type IN ('DEBIT', 'ESCROW', 'WHEELING_CHARGE') AND status = 'SUCCESS';

    RETURN (v_credits - v_debits);
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Recording audit events securely
CREATE OR REPLACE FUNCTION fn_record_audit_event(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_log_id BIGINT;
BEGIN
    INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, old_data, new_data
    ) VALUES (
        p_user_id, p_action, p_entity_type, p_entity_id, p_old_data, p_new_data
    ) RETURNING id INTO v_log_id;
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeders ENABLE ROW LEVEL SECURITY;
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE solar_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_execution_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: read own profile or admin
CREATE POLICY rls_profiles_select ON profiles FOR SELECT USING (
    auth.uid() = id OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY rls_profiles_update ON profiles FOR UPDATE USING (
    auth.uid() = id OR auth.role() = 'service_role'
);

-- Meters: read own meters
CREATE POLICY rls_meters_select ON meters FOR SELECT USING (
    profile_id = auth.uid() OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Telemetry & Forecasts: read own meter telemetry
CREATE POLICY rls_telemetry_select ON meter_telemetry FOR SELECT USING (
    EXISTS (SELECT 1 FROM meters WHERE meters.id = meter_telemetry.meter_id AND meters.profile_id = auth.uid())
    OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY rls_forecasts_select ON forecasts FOR SELECT USING (
    EXISTS (SELECT 1 FROM meters WHERE meters.id = forecasts.meter_id AND meters.profile_id = auth.uid())
    OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Public Discovery: Feeders and Market Prices viewable by all authenticated users
CREATE POLICY rls_feeders_select ON feeders FOR SELECT USING (true);
CREATE POLICY rls_market_prices_select ON market_prices FOR SELECT USING (true);

-- Orders: users manage own orders
CREATE POLICY rls_orders_select ON orders FOR SELECT USING (
    user_id = auth.uid() OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY rls_orders_insert ON orders FOR INSERT WITH CHECK (
    user_id = auth.uid() OR auth.role() = 'service_role'
);

-- Trades & Settlements: Buyer and Seller read-only
CREATE POLICY rls_trades_select ON trades FOR SELECT USING (
    buyer_id = auth.uid() OR seller_id = auth.uid() OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY rls_settlements_select ON settlements FOR SELECT USING (
    buyer_id = auth.uid() OR seller_id = auth.uid() OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY rls_blockchain_select ON blockchain_transactions FOR SELECT USING (true);

-- Notifications & Wallets: User private access
CREATE POLICY rls_notifications_select ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY rls_notifications_update ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY rls_wallet_select ON wallet_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY rls_agent_logs_select ON agent_execution_logs FOR SELECT USING (user_id = auth.uid() OR auth.role() = 'service_role');


-- ============================================================================
-- 7. REALTIME PUBLICATION SETUP
-- ============================================================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    ALTER PUBLICATION supabase_realtime ADD TABLE trades;
    ALTER PUBLICATION supabase_realtime ADD TABLE market_prices;
    ALTER PUBLICATION supabase_realtime ADD TABLE feeders;
    ALTER PUBLICATION supabase_realtime ADD TABLE meter_telemetry;
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ============================================================================
-- 8. HIGH-FIDELITY SYNTHETIC DEMO DATASET GENERATION
-- 50 Users, 40 Meters, 10 Feeders, 20 Solar Assets, 5,000+ Telemetry Readings,
-- 2,000+ Forecasts, 500+ Market Prices, 300+ Grid Checks, 250+ Orders,
-- 100+ Trades, 100+ Settlements, 100+ Blockchain Tx, 500+ Audit, 200+ Agent Logs
-- ============================================================================

-- 1. Insert 10 Electricity Feeders (Indian Grid Hubs)
INSERT INTO feeders (id, feeder_code, feeder_name, substation_name, area, city, state, capacity_kw, current_load_kw, utilization_percent, voltage, frequency, status, max_safe_utilization_percent)
SELECT 
    ('f0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid,
    'FDR-IND-' || LPAD(i::text, 3, '0'),
    'Feeder ' || i || ' (' || (ARRAY['Sector 62 Substation', 'Okhla Industrial 66kV', 'Indirapuram Hub', 'Whitefield Tech 33kV', 'Hitec City 11kV', 'Cyber City Gurugram', 'Mansarovar Jaipur', 'Salt Lake Sec V', 'Koramangala 11kV', 'Powai Central 33kV'])[i] || ')',
    (ARRAY['Noida 220kV Grid Substation', 'Okhla Primary Substation', 'Indirapuram Substation', 'Hoodi 220kV Substation', 'Madhapur 132kV Substation', 'Gurugram Sector 29 Substation', 'Jaipur South Grid', 'Kolkata East Substation', 'Bengaluru South 66kV', 'Mumbai North 110kV'])[i],
    (ARRAY['Sector 62', 'Okhla Phase III', 'Indirapuram', 'Whitefield', 'Hitec City', 'Cyber City', 'Mansarovar', 'Salt Lake', 'Koramangala', 'Powai'])[i],
    (ARRAY['Noida', 'New Delhi', 'Ghaziabad', 'Bengaluru', 'Hyderabad', 'Gurugram', 'Jaipur', 'Kolkata', 'Bengaluru', 'Mumbai'])[i],
    (ARRAY['Uttar Pradesh', 'Delhi', 'Uttar Pradesh', 'Karnataka', 'Telangana', 'Haryana', 'Rajasthan', 'West Bengal', 'Karnataka', 'Maharashtra'])[i],
    (ARRAY[600.00, 1200.00, 450.00, 1500.00, 1800.00, 1400.00, 500.00, 800.00, 750.00, 1100.00])[i],
    (ARRAY[260.00, 840.00, 410.00, 780.00, 920.00, 1050.00, 180.00, 390.00, 410.00, 550.00])[i],
    ROUND(((ARRAY[260.00, 840.00, 410.00, 780.00, 920.00, 1050.00, 180.00, 390.00, 410.00, 550.00])[i] / (ARRAY[600.00, 1200.00, 450.00, 1500.00, 1800.00, 1400.00, 500.00, 800.00, 750.00, 1100.00])[i]) * 100.0, 2),
    ROUND((229.00 + (i % 3) * 1.2)::numeric, 2),
    ROUND((49.96 + (i % 4) * 0.02)::numeric, 2),
    (ARRAY['NORMAL', 'WARNING', 'CONGESTED', 'NORMAL', 'NORMAL', 'WARNING', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL'])[i]::feeder_status_type,
    90.00
FROM generate_series(1, 10) AS i
ON CONFLICT (feeder_code) DO NOTHING;

-- 2. Insert 50 Users (auth.users and profiles)
DO $$
DECLARE
    v_uid UUID;
    v_firsts TEXT[] := ARRAY['Aarav', 'Priya', 'Rajesh', 'Vikram', 'Ananya', 'Suresh', 'Kavita', 'Siddharth', 'Rohan', 'Sneha', 'Aditya', 'Meera', 'Arjun', 'Divya', 'Nikhil'];
    v_lasts TEXT[] := ARRAY['Sharma', 'Patel', 'Gupta', 'Singh', 'Verma', 'Kumar', 'Reddy', 'Jain', 'Mehta', 'Iyer', 'Nair', 'Chopra', 'Bose', 'Das', 'Pandey'];
    v_role user_role_type;
    v_city TEXT;
BEGIN
    FOR i IN 1..50 LOOP
        v_uid := ('u0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid;
        v_role := CASE 
            WHEN i = 1 THEN 'admin'::user_role_type
            WHEN i = 2 THEN 'discom'::user_role_type
            WHEN i <= 24 THEN 'prosumer'::user_role_type
            ELSE 'consumer'::user_role_type
        END;
        v_city := (ARRAY['Noida', 'New Delhi', 'Ghaziabad', 'Bengaluru', 'Gurugram', 'Jaipur'])[1 + (i % 6)];

        INSERT INTO auth.users (id, email)
        VALUES (v_uid, 'user' || i || '@powerflow.energy')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO profiles (id, full_name, email, phone, role, address, city, state, pincode)
        VALUES (
            v_uid,
            v_firsts[1 + (i % array_length(v_firsts, 1))] || ' ' || v_lasts[1 + ((i * 3) % array_length(v_lasts, 1))],
            'user' || i || '@powerflow.energy',
            '+91 98' || LPAD((76543200 + i)::text, 8, '0'),
            v_role,
            'House #' || (100 + i) || ', Sector ' || (10 + (i % 40)),
            v_city,
            'Delhi NCR',
            (110001 + (i % 80))::text
        ) ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;

-- 3. Insert 40 Meters (22 Prosumers, 18 Consumers)
INSERT INTO meters (id, meter_number, profile_id, feeder_id, meter_type, connection_status, installed_capacity_kw, current_power_kw, cumulative_energy_kwh, latitude, longitude)
SELECT 
    ('m0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid,
    'MTR-IN-' || LPAD(i::text, 5, '0'),
    ('u0000000-0000-0000-0000-' || LPAD((i + 2)::text, 12, '0'))::uuid,
    ('f0000000-0000-0000-0000-' || LPAD((1 + (i % 10))::text, 12, '0'))::uuid,
    CASE WHEN i <= 22 THEN 'PROSUMER'::meter_type_enum ELSE 'CONSUMER'::meter_type_enum END,
    'CONNECTED',
    CASE WHEN i <= 22 THEN ROUND((5.0 + (i % 5) * 2.5)::numeric, 2) ELSE 0.00 END,
    CASE WHEN i <= 22 THEN ROUND((4.2 + (i % 3) * 1.5)::numeric, 2) ELSE ROUND((-1.8 - (i % 4) * 0.8)::numeric, 2) END,
    ROUND((1200.0 + i * 145.5)::numeric, 2),
    ROUND((28.5355 + (i % 20) * 0.015)::numeric, 6),
    ROUND((77.3910 + (i % 20) * 0.012)::numeric, 6)
FROM generate_series(1, 40) AS i
ON CONFLICT (meter_number) DO NOTHING;

-- 4. Insert 20 Solar Assets for Prosumers
INSERT INTO solar_assets (id, meter_id, capacity_kw, panel_type, installation_date, efficiency_percent, status)
SELECT 
    ('s0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid,
    ('m0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid,
    ROUND((5.0 + (i % 5) * 2.5)::numeric, 2),
    (ARRAY['Monocrystalline Perc 540W', 'Bifacial Dual-Glass 550W', 'TopCon High Efficiency 580W', 'Polycrystalline Tier-1'])[1 + (i % 4)],
    CURRENT_DATE - (interval '30 days' * i)::interval,
    ROUND((20.0 + (i % 3) * 0.8)::numeric, 2),
    'ACTIVE'::solar_asset_status_enum
FROM generate_series(1, 20) AS i
ON CONFLICT (id) DO NOTHING;

-- 5. Insert 5,000+ Time-Series Meter Telemetry Readings (40 meters x 130 timesteps)
INSERT INTO meter_telemetry (meter_id, timestamp, consumption_kw, generation_kw, voltage, frequency, energy_import_kwh, energy_export_kwh, battery_soc_percent, temperature, data_quality)
SELECT 
    m.id AS meter_id,
    NOW() - (interval '15 minutes' * s.step) AS timestamp,
    -- Consumption profile with evening/morning peaks
    ROUND((1.2 + 0.8 * SIN(PI() * ((130 - s.step) % 96) / 48) + CASE WHEN m.meter_type = 'CONSUMER' THEN 2.2 ELSE 0.4 END)::numeric, 2) AS consumption_kw,
    -- Solar generation curve with daytime bell-curve peaking around noon (step % 96 represents 15-min daily intervals)
    CASE 
        WHEN m.meter_type = 'PROSUMER' AND ((130 - s.step) % 96) BETWEEN 24 AND 72 THEN
            ROUND(GREATEST(0.00, m.installed_capacity_kw * SIN(PI() * (((130 - s.step) % 96) - 24) / 48.0) * (0.85 + 0.15 * ((s.step % 5) / 5.0)))::numeric, 2)
        ELSE 0.00 
    END AS generation_kw,
    ROUND((228.5 + ((s.step + 3) % 7) * 0.8)::numeric, 2) AS voltage,
    ROUND((49.95 + (s.step % 5) * 0.02)::numeric, 2) AS frequency,
    ROUND((500.0 + s.step * 0.35)::numeric, 4) AS energy_import_kwh,
    CASE WHEN m.meter_type = 'PROSUMER' THEN ROUND((850.0 + s.step * 0.95)::numeric, 4) ELSE 0.0000 END AS energy_export_kwh,
    CASE WHEN m.meter_type = 'PROSUMER' THEN ROUND((65.0 + 20.0 * SIN(PI() * (s.step % 96) / 48))::numeric, 2) ELSE NULL END AS battery_soc_percent,
    ROUND((28.0 + 6.0 * SIN(PI() * (s.step % 96) / 48))::numeric, 2) AS temperature,
    'GOOD'
FROM meters m
CROSS JOIN generate_series(0, 129) AS s(step);

-- 6. Insert 2,000+ ML Forecasts (40 meters x 50 intervals)
INSERT INTO forecasts (id, meter_id, forecast_type, forecast_timestamp, predicted_value, lower_bound, upper_bound, confidence, model_name, model_version)
SELECT 
    gen_random_uuid(),
    m.id,
    f_type.val,
    NOW() + (interval '1 hour' * s.step),
    CASE 
        WHEN f_type.val = 'SOLAR_GENERATION' THEN
            CASE 
                WHEN m.meter_type = 'PROSUMER' AND (s.step % 24) BETWEEN 6 AND 18 THEN 
                    ROUND((m.installed_capacity_kw * SIN(PI() * ((s.step % 24) - 6) / 12.0))::numeric, 2)
                ELSE 0.00 
            END
        ELSE 
            ROUND((2.0 + 1.2 * SIN(PI() * (s.step % 24) / 12.0) + CASE WHEN m.meter_type = 'CONSUMER' THEN 2.5 ELSE 0.5 END)::numeric, 2)
    END AS predicted_value,
    0.85 * (CASE WHEN f_type.val = 'SOLAR_GENERATION' THEN 4.0 ELSE 2.0 END),
    1.15 * (CASE WHEN f_type.val = 'SOLAR_GENERATION' THEN 4.0 ELSE 2.0 END),
    ROUND((0.92 + (s.step % 6) * 0.01)::numeric, 4),
    'xgboost_powerflow_v2.4',
    '2.4.1'
FROM meters m
CROSS JOIN (VALUES ('DEMAND'::forecast_type_enum), ('SOLAR_GENERATION'::forecast_type_enum)) AS f_type(val)
CROSS JOIN generate_series(1, 26) AS s(step);

-- 7. Insert 500+ Market Price Records (10 Feeders x 52 Historical & Rolling Hours)
INSERT INTO market_prices (id, timestamp, base_tariff, demand_factor, solar_supply_factor, congestion_factor, final_price_per_kwh, min_price, max_price, market_status)
SELECT 
    gen_random_uuid(),
    NOW() - (interval '1 hour' * s.step),
    6.50,
    ROUND((0.85 + ((s.step % 24) / 48.0))::numeric, 4),
    ROUND((0.75 + (((s.step + 6) % 24) / 48.0))::numeric, 4),
    ROUND((((s.step % 10) / 50.0))::numeric, 4),
    -- Regulated bound between ₹3 and ₹15
    ROUND((LEAST(15.00, GREATEST(3.00, 6.50 + 1.8 * SIN(PI() * (s.step % 24) / 12.0) - 1.2 * COS(PI() * (s.step % 24) / 12.0))))::numeric, 2),
    3.00,
    15.00,
    'CLEARING_CLOSED'
FROM generate_series(0, 51) AS s(step)
CROSS JOIN generate_series(1, 10);

-- 8. Insert 250+ Orders across Consumers and Prosumers
DO $$
DECLARE
    v_order_id UUID;
    v_user_id UUID;
    v_meter_id UUID;
    v_feeder_id UUID;
    v_type order_type_enum;
    v_qty NUMERIC;
    v_price NUMERIC;
    v_status order_status_enum;
    v_grid_status TEXT;
BEGIN
    FOR i IN 1..260 LOOP
        v_order_id := ('o0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid;
        -- If even, SELL order from prosumer (meters 1..20), else BUY order from consumer (meters 21..40)
        IF i % 2 = 0 THEN
            v_type := 'SELL';
            v_meter_id := ('m0000000-0000-0000-0000-' || LPAD((1 + (i % 20))::text, 12, '0'))::uuid;
            v_status := CASE WHEN i <= 160 THEN 'MATCHED' WHEN i <= 220 THEN 'APPROVED' ELSE 'REJECTED' END;
            v_grid_status := CASE WHEN v_status = 'REJECTED' THEN 'FAILED' ELSE 'PASSED' END;
            v_price := ROUND((4.20 + (i % 15) * 0.15)::numeric, 2);
        ELSE
            v_type := 'BUY';
            v_meter_id := ('m0000000-0000-0000-0000-' || LPAD((21 + (i % 19))::text, 12, '0'))::uuid;
            v_status := CASE WHEN i <= 160 THEN 'MATCHED' WHEN i <= 220 THEN 'APPROVED' ELSE 'REJECTED' END;
            v_grid_status := CASE WHEN v_status = 'REJECTED' THEN 'FAILED' ELSE 'PASSED' END;
            v_price := ROUND((5.00 + (i % 15) * 0.18)::numeric, 2);
        END IF;

        SELECT profile_id, feeder_id INTO v_user_id, v_feeder_id FROM meters WHERE id = v_meter_id;
        v_qty := ROUND((4.0 + (i % 8) * 1.5)::numeric, 2);

        INSERT INTO orders (
            id, user_id, meter_id, feeder_id, order_type, quantity_kwh, price_per_kwh,
            status, grid_check_status, grid_snapshot, created_at
        ) VALUES (
            v_order_id, v_user_id, v_meter_id, v_feeder_id, v_type, v_qty, v_price,
            v_status, v_grid_status, '{"feeder_utilization": 54.2, "headroom_kw": 280.0}'::jsonb,
            NOW() - (interval '20 minutes' * i)
        ) ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;

-- 9. Insert 300+ Grid Checks for Orders
INSERT INTO grid_checks (id, order_id, feeder_id, requested_power_kw, feeder_capacity_kw, feeder_load_kw, utilization_before, utilization_after, voltage, frequency, safety_limit, result, rejection_reason, checked_at)
SELECT 
    gen_random_uuid(),
    o.id,
    o.feeder_id,
    ROUND((o.quantity_kwh * 0.4)::numeric, 2),
    f.capacity_kw,
    f.current_load_kw,
    f.utilization_percent,
    CASE WHEN o.status = 'REJECTED' THEN 94.50 ELSE ROUND((f.utilization_percent + 2.5)::numeric, 2) END,
    230.50,
    50.01,
    90.00,
    CASE WHEN o.status = 'REJECTED' THEN 'REJECTED'::grid_check_result_enum ELSE 'APPROVED'::grid_check_result_enum END,
    CASE WHEN o.status = 'REJECTED' THEN 'GRID_CONGESTION_REJECTION' ELSE NULL END,
    o.created_at
FROM orders o
JOIN feeders f ON f.id = o.feeder_id;

-- 10. Insert 110 Matched Trades, Settlements, & Blockchain Transactions
DO $$
DECLARE
    v_trd_id UUID;
    v_settle_id UUID;
    v_buy orders%ROWTYPE;
    v_sell orders%ROWTYPE;
    v_match_qty NUMERIC;
    v_price NUMERIC;
    v_tot NUMERIC;
    v_wheel NUMERIC;
    v_plat NUMERIC := 1.50;
    v_buyer_tot NUMERIC;
    v_seller_rec NUMERIC;
    v_tx_hash TEXT;
BEGIN
    FOR i IN 1..110 LOOP
        v_trd_id := ('t0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid;
        v_settle_id := ('e0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid;
        
        -- Pair order 2*i-1 (BUY) with order 2*i (SELL)
        SELECT * INTO v_buy FROM orders WHERE id = ('o0000000-0000-0000-0000-' || LPAD(((i * 2) - 1)::text, 12, '0'))::uuid;
        SELECT * INTO v_sell FROM orders WHERE id = ('o0000000-0000-0000-0000-' || LPAD((i * 2)::text, 12, '0'))::uuid;

        IF v_buy.id IS NOT NULL AND v_sell.id IS NOT NULL THEN
            v_match_qty := LEAST(v_buy.quantity_kwh, v_sell.quantity_kwh);
            v_price := ROUND((v_buy.price_per_kwh + v_sell.price_per_kwh) / 2.0, 2);
            v_tot := ROUND(v_match_qty * v_price, 2);
            v_wheel := ROUND(v_match_qty * 0.25, 2);
            v_buyer_tot := v_tot + v_wheel + v_plat;
            v_seller_rec := v_tot;
            v_tx_hash := '0x' || MD5('trd_' || i || '_salt_powerflow') || MD5('blk_' || i || '_evm');

            -- Trade Record
            INSERT INTO trades (
                id, buy_order_id, sell_order_id, buyer_id, seller_id, feeder_id,
                quantity_kwh, price_per_kwh, total_amount, status, matched_at, completed_at
            ) VALUES (
                v_trd_id, v_buy.id, v_sell.id, v_buy.user_id, v_sell.user_id, v_buy.feeder_id,
                v_match_qty, v_price, v_tot, 'SETTLED', v_buy.created_at + interval '2 minutes', v_buy.created_at + interval '15 minutes'
            ) ON CONFLICT (id) DO NOTHING;

            -- Settlement Record
            INSERT INTO settlements (
                id, trade_id, buyer_id, seller_id, energy_amount_kwh, energy_payment,
                wheeling_charge, platform_fee, total_buyer_payment, seller_receivable,
                settlement_status, settlement_reference, created_at, completed_at
            ) VALUES (
                v_settle_id, v_trd_id, v_buy.user_id, v_sell.user_id, v_match_qty, v_tot,
                v_wheel, v_plat, v_buyer_tot, v_seller_rec,
                'CONFIRMED', 'SETTLE-TRD-' || LPAD(i::text, 6, '0'), v_buy.created_at + interval '10 minutes', v_buy.created_at + interval '15 minutes'
            ) ON CONFLICT (id) DO NOTHING;

            -- Blockchain EVM Proof
            INSERT INTO blockchain_transactions (
                trade_id, settlement_id, network, chain_id, contract_address,
                transaction_hash, block_number, gas_used, status, event_name, confirmed_at
            ) VALUES (
                v_trd_id, v_settle_id, 'Hardhat EVM Local (Chain 31337)', 31337,
                '0x5FbDB2315678afecb367f032d93F642f64180aa3', v_tx_hash,
                18420000 + i, 84210 + (i * 35), 'CONFIRMED', 'TradeSettled',
                v_buy.created_at + interval '15 minutes'
            ) ON CONFLICT (transaction_hash) DO NOTHING;

            -- Wallet Movement
            INSERT INTO wallet_transactions (
                user_id, trade_id, transaction_type, amount, reference, status, created_at
            ) VALUES 
            (v_buy.user_id, v_trd_id, 'DEBIT', v_buyer_tot, 'WLT-DEB-' || i, 'SUCCESS', v_buy.created_at + interval '15 minutes'),
            (v_sell.user_id, v_trd_id, 'CREDIT', v_seller_rec, 'WLT-CRE-' || i, 'SUCCESS', v_buy.created_at + interval '15 minutes');
        END IF;
    END LOOP;
END $$;

-- 11. Insert 500+ Audit Logs
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_hash, user_agent, created_at)
SELECT 
    o.user_id,
    CASE WHEN o.order_type = 'BUY' THEN 'CREATE_BUY_ORDER' ELSE 'CREATE_SELL_ORDER' END,
    'orders',
    o.id,
    NULL,
    jsonb_build_object('order_id', o.id, 'qty', o.quantity_kwh, 'price', o.price_per_kwh, 'status', o.status),
    MD5('ip_node_' || (s.i % 25)),
    'PowerFlow-MCP-Agent/2.4 (FastAPI/LangGraph)',
    o.created_at
FROM orders o
CROSS JOIN generate_series(1, 2) AS s(i)
LIMIT 550;

-- 12. Insert 200+ Notifications
INSERT INTO notifications (user_id, notification_type, title, message, severity, related_order_id, is_read, created_at)
SELECT 
    o.user_id,
    CASE 
        WHEN o.status = 'APPROVED' THEN 'ORDER_APPROVED'::notification_type_enum
        WHEN o.status = 'REJECTED' THEN 'GRID_CONGESTION'::notification_type_enum
        ELSE 'TRADE_MATCHED'::notification_type_enum
    END,
    CASE 
        WHEN o.status = 'APPROVED' THEN 'Order Approved by Grid'
        WHEN o.status = 'REJECTED' THEN 'Order Congestion Alert'
        ELSE 'Energy Trade Matched!'
    END,
    'Marketplace processed order for ' || o.quantity_kwh || ' kWh at Rs ' || o.price_per_kwh || '/kWh.',
    CASE WHEN o.status = 'REJECTED' THEN 'WARNING' ELSE 'INFO' END,
    o.id,
    (s.i % 2 = 0),
    o.created_at + interval '30 seconds'
FROM orders o
CROSS JOIN generate_series(1, 1) AS s(i)
LIMIT 220;

-- 13. Insert 200+ AI Agent Execution Logs (LangGraph + MCP Tool Executions)
INSERT INTO agent_execution_logs (
    user_id, session_id, user_query, detected_intent, tool_name,
    tool_input, tool_output, proposed_action, confirmation_required,
    user_confirmed, final_action, model_name, model_version, execution_status
)
SELECT 
    p.id,
    'sess_' || MD5('langgraph_session_' || s.i),
    (ARRAY[
        'Can I sell 6 kWh of excess solar right now?',
        'Find me cheapest clean energy on Feeder FDR-IND-001',
        'What is my predicted solar yield for tomorrow morning?',
        'Is Feeder 2 safe to trade or congested?',
        'Execute purchase of 10 kWh below Rs 6.00/kWh'
    ])[1 + (s.i % 5)],
    (ARRAY['SELL_DISCOVERY', 'BUY_DISCOVERY', 'FORECAST_QUERY', 'GRID_STATUS', 'ORDER_EXECUTION'])[1 + (s.i % 5)],
    (ARRAY['get_available_surplus', 'get_market_price', 'get_solar_forecast', 'check_feeder_headroom', 'create_buy_order'])[1 + (s.i % 5)],
    jsonb_build_object('user_id', p.id, 'meter_id', 'MTR-IN-' || LPAD((s.i % 40 + 1)::text, 5, '0')),
    jsonb_build_object('status', 'SUCCESS', 'result_code', 'PASSED_GRID_HEADROOM_CHECK'),
    'PROPOSE_P2P_ORDER_EXECUTION',
    true,
    (s.i % 3 != 0),
    CASE WHEN (s.i % 3 != 0) THEN 'EXECUTE_ORDER' ELSE 'ABORT_USER_CANCEL' END,
    'Qwen 2.5 3B (Ollama)',
    '2.5-Instruct',
    'COMPLETED'
FROM profiles p
CROSS JOIN generate_series(1, 5) AS s(i)
LIMIT 220;

COMMIT;
