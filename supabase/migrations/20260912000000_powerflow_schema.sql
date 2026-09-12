-- ============================================================================
-- POWERFLOW: Grid-Aware P2P Renewable Energy Marketplace
-- Complete PostgreSQL / Supabase Database Schema Migration
-- ============================================================================
-- Architecture: Supabase RLS, ENUMs, Indexes, Triggers, RPCs, Views, Sample Data
-- Target DB: PostgreSQL 14+ / Supabase
-- ============================================================================

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUM DEFINITIONS
-- ============================================================================

CREATE TYPE user_role AS ENUM (
    'consumer',
    'prosumer',
    'admin'
);

CREATE TYPE meter_type_enum AS ENUM (
    'CONSUMER',
    'PROSUMER'
);

CREATE TYPE meter_status_enum AS ENUM (
    'ONLINE',
    'OFFLINE',
    'MAINTENANCE'
);

CREATE TYPE congestion_status_enum AS ENUM (
    'NORMAL',
    'WARNING',
    'CONGESTED',
    'TRADE_REJECTED'
);

CREATE TYPE forecast_type_enum AS ENUM (
    'demand',
    'solar'
);

CREATE TYPE order_type_enum AS ENUM (
    'BUY',
    'SELL'
);

CREATE TYPE order_status_enum AS ENUM (
    'OPEN',
    'PARTIALLY_FILLED',
    'FILLED',
    'CANCELLED',
    'REJECTED'
);

CREATE TYPE grid_check_status_enum AS ENUM (
    'PENDING',
    'PASSED',
    'FAILED'
);

CREATE TYPE execution_status_enum AS ENUM (
    'MATCHED',
    'PENDING',
    'EXECUTED',
    'FAILED',
    'CANCELLED'
);

CREATE TYPE delivery_status_enum AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'DELIVERED',
    'FAILED'
);

CREATE TYPE settlement_status_enum AS ENUM (
    'PENDING',
    'PROCESSING',
    'SETTLED',
    'FAILED'
);


-- ============================================================================
-- 2. CREATE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FEEDERS TABLE
-- Represents local distribution grid feeder lines and transformer nodes
-- ----------------------------------------------------------------------------
CREATE TABLE feeders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feeder_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    capacity_kw NUMERIC(10, 2) NOT NULL CONSTRAINT check_feeder_capacity CHECK (capacity_kw > 0),
    active_load_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_active_load CHECK (active_load_kw >= 0),
    active_generation_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_active_gen CHECK (active_generation_kw >= 0),
    headroom_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    utilization_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_feeder_utilization CHECK (utilization_percent >= 0.00 AND utilization_percent <= 100.00),
    reverse_power_flow_limit_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_reverse_flow_limit CHECK (reverse_power_flow_limit_kw >= 0),
    congestion_status congestion_status_enum NOT NULL DEFAULT 'NORMAL',
    trade_allowed BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- USERS TABLE
-- Core platform users (consumers, prosumers, admins). Sensitive KYC excluded.
-- Note: meter_id foreign key added after meters table creation.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'consumer',
    wallet_address TEXT UNIQUE,
    meter_id UUID, -- Foreign Key to meters(id) added below
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- METERS TABLE
-- Smart meters attached to prosumer solar/battery setups or consumer premises
-- ----------------------------------------------------------------------------
CREATE TABLE meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_code TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE RESTRICT,
    meter_type meter_type_enum NOT NULL DEFAULT 'CONSUMER',
    rated_capacity_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_rated_capacity CHECK (rated_capacity_kw >= 0),
    current_generation_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_current_gen CHECK (current_generation_kw >= 0),
    current_load_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_current_load CHECK (current_load_kw >= 0),
    net_power_kw NUMERIC(10, 2) GENERATED ALWAYS AS (current_generation_kw - current_load_kw) STORED,
    available_surplus_kwh NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_available_surplus CHECK (available_surplus_kwh >= 0),
    status meter_status_enum NOT NULL DEFAULT 'ONLINE',
    last_reading_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add deferrable foreign key from users.meter_id to meters.id
ALTER TABLE users 
    ADD CONSTRAINT fk_users_meter 
    FOREIGN KEY (meter_id) 
    REFERENCES meters(id) 
    ON DELETE SET NULL 
    DEFERRABLE INITIALLY DEFERRED;

-- ----------------------------------------------------------------------------
-- METER TELEMETRY TABLE
-- High-frequency or simulated telemetry readings from smart meters
-- ----------------------------------------------------------------------------
CREATE TABLE meter_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generation_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_telem_gen CHECK (generation_kw >= 0),
    load_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT check_telem_load CHECK (load_kw >= 0),
    net_power_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    voltage_v NUMERIC(6, 2) DEFAULT 230.00 CHECK (voltage_v >= 0),
    current_a NUMERIC(6, 2) DEFAULT 0.00 CHECK (current_a >= 0),
    frequency_hz NUMERIC(5, 2) DEFAULT 50.00 CHECK (frequency_hz >= 0),
    energy_import_kwh NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (energy_import_kwh >= 0),
    energy_export_kwh NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (energy_export_kwh >= 0)
);

-- ----------------------------------------------------------------------------
-- FORECASTS TABLE
-- ML model output predictions for solar generation and power demand
-- ----------------------------------------------------------------------------
CREATE TABLE forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
    forecast_type forecast_type_enum NOT NULL,
    forecast_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    target_timestamp TIMESTAMPTZ NOT NULL,
    predicted_value NUMERIC(10, 2) NOT NULL CHECK (predicted_value >= 0),
    lower_bound NUMERIC(10, 2) CHECK (lower_bound >= 0),
    upper_bound NUMERIC(10, 2) CHECK (upper_bound >= lower_bound),
    irradiance_w_m2 NUMERIC(8, 2) CHECK (irradiance_w_m2 >= 0),
    temperature_c NUMERIC(5, 2),
    surplus_kwh NUMERIC(10, 2) DEFAULT 0.00 CHECK (surplus_kwh >= 0),
    peak_hour BOOLEAN DEFAULT false,
    model_name TEXT NOT NULL DEFAULT 'solar_forecaster_v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- MARKET PRICES TABLE
-- Dynamic clearing prices per feeder node enforcing regulatory bounds [₹3, ₹15]
-- ----------------------------------------------------------------------------
CREATE TABLE market_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    base_tariff_inr_per_kwh NUMERIC(6, 2) NOT NULL DEFAULT 6.50 CHECK (base_tariff_inr_per_kwh >= 0),
    clearing_price_inr_per_kwh NUMERIC(6, 2) NOT NULL CONSTRAINT check_clearing_price_range CHECK (clearing_price_inr_per_kwh >= 3.00 AND clearing_price_inr_per_kwh <= 15.00),
    min_price_inr_per_kwh NUMERIC(6, 2) NOT NULL DEFAULT 3.00 CONSTRAINT check_min_price_range CHECK (min_price_inr_per_kwh >= 3.00 AND min_price_inr_per_kwh <= 15.00),
    max_price_inr_per_kwh NUMERIC(6, 2) NOT NULL DEFAULT 15.00 CONSTRAINT check_max_price_range CHECK (max_price_inr_per_kwh >= 3.00 AND max_price_inr_per_kwh <= 15.00),
    discom_fee_inr_per_kwh NUMERIC(6, 2) NOT NULL DEFAULT 0.25 CHECK (discom_fee_inr_per_kwh >= 0)
);

-- ----------------------------------------------------------------------------
-- ORDERS TABLE
-- P2P marketplace buy/sell orders with grid check validation
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE RESTRICT,
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE RESTRICT,
    order_type order_type_enum NOT NULL,
    quantity_kwh NUMERIC(10, 2) NOT NULL CONSTRAINT check_order_quantity CHECK (quantity_kwh > 0),
    remaining_quantity_kwh NUMERIC(10, 2) NOT NULL CONSTRAINT check_order_remaining CHECK (remaining_quantity_kwh >= 0 AND remaining_quantity_kwh <= quantity_kwh),
    price_inr_per_kwh NUMERIC(6, 2) NOT NULL CONSTRAINT check_order_price CHECK (price_inr_per_kwh >= 3.00 AND price_inr_per_kwh <= 15.00),
    status order_status_enum NOT NULL DEFAULT 'OPEN',
    max_price_inr_per_kwh NUMERIC(6, 2) CONSTRAINT check_order_max_price CHECK (max_price_inr_per_kwh >= 3.00 AND max_price_inr_per_kwh <= 15.00),
    min_price_inr_per_kwh NUMERIC(6, 2) CONSTRAINT check_order_min_price CHECK (min_price_inr_per_kwh >= 3.00 AND min_price_inr_per_kwh <= 15.00),
    grid_check_status grid_check_status_enum NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- TRADES TABLE
-- Matched P2P energy trades between buyers and sellers
-- ----------------------------------------------------------------------------
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_code TEXT UNIQUE NOT NULL,
    buy_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    sell_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE RESTRICT,
    quantity_kwh NUMERIC(10, 2) NOT NULL CONSTRAINT check_trade_quantity CHECK (quantity_kwh > 0),
    price_inr_per_kwh NUMERIC(6, 2) NOT NULL CONSTRAINT check_trade_price CHECK (price_inr_per_kwh >= 3.00 AND price_inr_per_kwh <= 15.00),
    gross_amount_inr NUMERIC(12, 2) NOT NULL CHECK (gross_amount_inr >= 0),
    discom_fee_inr NUMERIC(12, 2) NOT NULL CHECK (discom_fee_inr >= 0),
    net_amount_inr NUMERIC(12, 2) NOT NULL CHECK (net_amount_inr >= 0),
    delivery_status delivery_status_enum NOT NULL DEFAULT 'PENDING',
    execution_status execution_status_enum NOT NULL DEFAULT 'MATCHED',
    matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- SETTLEMENTS TABLE
-- Financial & smart contract settlement records for completed trades
-- ----------------------------------------------------------------------------
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID UNIQUE NOT NULL REFERENCES trades(id) ON DELETE RESTRICT,
    gross_amount_inr NUMERIC(12, 2) NOT NULL CHECK (gross_amount_inr >= 0),
    discom_wheeling_fee_inr NUMERIC(12, 2) NOT NULL CHECK (discom_wheeling_fee_inr >= 0),
    net_amount_inr NUMERIC(12, 2) NOT NULL CHECK (net_amount_inr >= 0),
    settlement_status settlement_status_enum NOT NULL DEFAULT 'PENDING',
    transaction_reference TEXT,
    blockchain_tx_hash TEXT,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- GRID CHECKS TABLE
-- Automated safety & headroom evaluation logs for marketplace orders
-- ----------------------------------------------------------------------------
CREATE TABLE grid_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    feeder_id UUID NOT NULL REFERENCES feeders(id) ON DELETE RESTRICT,
    utilization_percent NUMERIC(5, 2) NOT NULL CHECK (utilization_percent >= 0 AND utilization_percent <= 100),
    available_headroom_kw NUMERIC(10, 2) NOT NULL,
    reverse_power_flow_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    trade_allowed BOOLEAN NOT NULL,
    decision TEXT NOT NULL,
    rejection_code TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- AUDIT LOGS TABLE
-- Cryptographically hashed audit records for administrative & security actions
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    request_data JSONB,
    response_data JSONB,
    decision TEXT,
    tool_name TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    audit_hash TEXT
);

-- ----------------------------------------------------------------------------
-- AGENT EXECUTION LOGS TABLE
-- Operational traceability for LangGraph AI agent & MCP tool invocations
-- ----------------------------------------------------------------------------
CREATE TABLE agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_query TEXT NOT NULL,
    selected_tool TEXT,
    tool_arguments JSONB,
    tool_result JSONB,
    decision TEXT,
    execution_time_ms INTEGER CHECK (execution_time_ms >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- Telemetry indexing for high-performance time-series queries
CREATE INDEX idx_telemetry_meter_time ON meter_telemetry (meter_id, timestamp DESC);
CREATE INDEX idx_telemetry_feeder_time ON meter_telemetry (feeder_id, timestamp DESC);

-- Users & Meters indexing
CREATE INDEX idx_users_feeder ON users (feeder_id);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_meters_user ON meters (user_id);
CREATE INDEX idx_meters_feeder ON meters (feeder_id);
CREATE INDEX idx_meters_surplus ON meters (available_surplus_kwh) WHERE available_surplus_kwh > 0;

-- Forecasts indexing
CREATE INDEX idx_forecasts_meter_target ON forecasts (meter_id, target_timestamp DESC);
CREATE INDEX idx_forecasts_type_time ON forecasts (forecast_type, target_timestamp DESC);

-- Market prices indexing
CREATE INDEX idx_market_prices_feeder_time ON market_prices (feeder_id, timestamp DESC);

-- Orders indexing
CREATE INDEX idx_orders_status_type ON orders (status, order_type) WHERE status IN ('OPEN', 'PARTIALLY_FILLED');
CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_orders_feeder ON orders (feeder_id);
CREATE INDEX idx_orders_price ON orders (price_inr_per_kwh);

-- Trades & Settlements indexing
CREATE INDEX idx_trades_buyer ON trades (buyer_id);
CREATE INDEX idx_trades_seller ON trades (seller_id);
CREATE INDEX idx_trades_feeder ON trades (feeder_id);
CREATE INDEX idx_trades_status ON trades (execution_status);
CREATE INDEX idx_settlements_trade ON settlements (trade_id);
CREATE INDEX idx_settlements_status ON settlements (settlement_status);

-- Grid checks & Logs indexing
CREATE INDEX idx_grid_checks_order ON grid_checks (order_id);
CREATE INDEX idx_audit_user ON audit_logs (user_id);
CREATE INDEX idx_audit_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX idx_agent_logs_session ON agent_execution_logs (session_id);


-- ============================================================================
-- 4. DATABASE FUNCTIONS & TRIGGERS
-- ============================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feeders_updated_at
BEFORE UPDATE ON feeders
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Order validation logic trigger (Enforces pure consumers cannot sell & surplus rules)
CREATE OR REPLACE FUNCTION fn_validate_order_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_user_role user_role;
    v_surplus NUMERIC;
    v_trade_allowed BOOLEAN;
    v_congestion congestion_status_enum;
BEGIN
    -- 1. Check user role
    SELECT role INTO v_user_role FROM users WHERE id = NEW.user_id;
    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'User ID % not found.', NEW.user_id;
    END IF;

    -- 2. Pure consumers cannot create SELL orders
    IF NEW.order_type = 'SELL' AND v_user_role = 'consumer' THEN
        RAISE EXCEPTION 'Pure consumer accounts (User: %) are not allowed to create SELL orders.', NEW.user_id;
    END IF;

    -- 3. SELL orders require available solar surplus
    IF NEW.order_type = 'SELL' THEN
        SELECT available_surplus_kwh INTO v_surplus FROM meters WHERE id = NEW.meter_id;
        IF COALESCE(v_surplus, 0) < NEW.quantity_kwh THEN
            RAISE EXCEPTION 'Insufficient solar surplus. Available: % kWh, Requested: % kWh', COALESCE(v_surplus, 0), NEW.quantity_kwh;
        END IF;
    END IF;

    -- 4. Check feeder congestion & trade allowed status
    SELECT trade_allowed, congestion_status INTO v_trade_allowed, v_congestion FROM feeders WHERE id = NEW.feeder_id;
    IF v_trade_allowed = false OR v_congestion = 'TRADE_REJECTED' THEN
        NEW.status := 'REJECTED';
        NEW.grid_check_status := 'FAILED';
        NEW.rejection_reason := 'GRID_CONGESTION_REJECTION: Trading restricted on feeder.';
    END IF;

    -- 5. Auto-populate min/max boundary constraints if omitted
    IF NEW.order_type = 'BUY' AND NEW.max_price_inr_per_kwh IS NULL THEN
        NEW.max_price_inr_per_kwh := NEW.price_inr_per_kwh;
    ELSIF NEW.order_type = 'SELL' AND NEW.min_price_inr_per_kwh IS NULL THEN
        NEW.min_price_inr_per_kwh := NEW.price_inr_per_kwh;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_order_before_insert
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION fn_validate_order_before_insert();


-- ============================================================================
-- 5. STORED PROCEDURES / RPCs FOR BACKEND & MCP TOOLS
-- ============================================================================

-- RPC: Check feeder headroom and grid congestion
CREATE OR REPLACE FUNCTION check_feeder_headroom(p_feeder_id UUID)
RETURNS TABLE (
    feeder_code TEXT,
    capacity_kw NUMERIC,
    active_load_kw NUMERIC,
    active_generation_kw NUMERIC,
    available_headroom_kw NUMERIC,
    utilization_percent NUMERIC,
    congestion_status congestion_status_enum,
    trade_allowed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.feeder_code,
        f.capacity_kw,
        f.active_load_kw,
        f.active_generation_kw,
        f.headroom_kw,
        f.utilization_percent,
        f.congestion_status,
        f.trade_allowed
    FROM feeders f
    WHERE f.id = p_feeder_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC: Check if user is eligible to sell energy
CREATE OR REPLACE FUNCTION check_user_can_sell(
    p_user_id UUID,
    p_quantity_kwh NUMERIC
)
RETURNS TABLE (
    can_sell BOOLEAN,
    reason TEXT,
    available_surplus_kwh NUMERIC
) AS $$
DECLARE
    v_role user_role;
    v_surplus NUMERIC := 0.00;
BEGIN
    SELECT u.role, COALESCE(m.available_surplus_kwh, 0.00)
    INTO v_role, v_surplus
    FROM users u
    LEFT JOIN meters m ON m.id = u.meter_id
    WHERE u.id = p_user_id;

    IF v_role IS NULL THEN
        RETURN QUERY SELECT false, 'User does not exist'::TEXT, 0.00::NUMERIC;
    ELSIF v_role = 'consumer' THEN
        RETURN QUERY SELECT false, 'Consumer account cannot sell energy'::TEXT, 0.00::NUMERIC;
    ELSIF v_surplus < p_quantity_kwh THEN
        RETURN QUERY SELECT false, 'Insufficient available surplus'::TEXT, v_surplus;
    ELSE
        RETURN QUERY SELECT true, 'Eligible to sell'::TEXT, v_surplus;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC: Calculate available solar surplus for a meter
CREATE OR REPLACE FUNCTION calculate_available_surplus(p_meter_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_surplus NUMERIC;
BEGIN
    SELECT available_surplus_kwh INTO v_surplus
    FROM meters
    WHERE id = p_meter_id;
    RETURN COALESCE(v_surplus, 0.00);
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC: Calculate DISCOM fee and settlement split
CREATE OR REPLACE FUNCTION calculate_discom_fee(
    p_quantity_kwh NUMERIC,
    p_rate_per_kwh NUMERIC DEFAULT 0.25
)
RETURNS TABLE (
    gross_amount NUMERIC,
    discom_fee NUMERIC,
    net_amount NUMERIC
) AS $$
DECLARE
    v_gross NUMERIC;
    v_fee NUMERIC;
    v_net NUMERIC;
BEGIN
    v_gross := ROUND(p_quantity_kwh * 6.50, 2); -- Standard base reference
    v_fee := ROUND(p_quantity_kwh * p_rate_per_kwh, 2);
    v_net := v_gross - v_fee;
    RETURN QUERY SELECT v_gross, v_fee, v_net;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================================
-- 6. VIEWS FOR REPORTING & REAL-TIME DASHBOARDS
-- ============================================================================

-- View 1: Current Feeder Status
CREATE OR REPLACE VIEW v_current_feeder_status AS
SELECT 
    f.id AS feeder_id,
    f.feeder_code,
    f.name AS feeder_name,
    f.capacity_kw,
    f.active_load_kw,
    f.active_generation_kw,
    f.headroom_kw,
    f.utilization_percent,
    f.congestion_status,
    f.trade_allowed,
    f.updated_at
FROM feeders f;

-- View 2: Current Market Price per Feeder
CREATE OR REPLACE VIEW v_current_market_price AS
SELECT DISTINCT ON (mp.feeder_id)
    mp.id AS market_price_id,
    mp.feeder_id,
    f.feeder_code,
    mp.base_tariff_inr_per_kwh,
    mp.clearing_price_inr_per_kwh,
    mp.min_price_inr_per_kwh,
    mp.max_price_inr_per_kwh,
    mp.discom_fee_inr_per_kwh,
    mp.timestamp
FROM market_prices mp
JOIN feeders f ON f.id = mp.feeder_id
ORDER BY mp.feeder_id, mp.timestamp DESC;

-- View 3: Active Open Marketplace Orders
CREATE OR REPLACE VIEW v_open_orders AS
SELECT 
    o.id AS order_id,
    o.order_code,
    u.user_code,
    u.name AS user_name,
    m.meter_code,
    f.feeder_code,
    o.order_type,
    o.quantity_kwh,
    o.remaining_quantity_kwh,
    o.price_inr_per_kwh,
    o.max_price_inr_per_kwh,
    o.min_price_inr_per_kwh,
    o.status,
    o.created_at,
    o.expires_at
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN meters m ON m.id = o.meter_id
JOIN feeders f ON f.id = o.feeder_id
WHERE o.status IN ('OPEN', 'PARTIALLY_FILLED')
ORDER BY o.created_at DESC;

-- View 4: Available Solar Surplus across Prosumers
CREATE OR REPLACE VIEW v_available_solar_surplus AS
SELECT 
    m.id AS meter_id,
    m.meter_code,
    u.user_code,
    u.name AS prosumer_name,
    f.feeder_code,
    m.rated_capacity_kw,
    m.current_generation_kw,
    m.current_load_kw,
    m.net_power_kw,
    m.available_surplus_kwh,
    m.last_reading_at
FROM meters m
JOIN users u ON u.id = m.user_id
JOIN feeders f ON f.id = m.feeder_id
WHERE m.meter_type = 'PROSUMER' AND m.available_surplus_kwh > 0;

-- View 5: P2P Energy Trade Executions & Status
CREATE OR REPLACE VIEW v_trade_status AS
SELECT 
    t.id AS trade_id,
    t.trade_code,
    b.user_code AS buyer_code,
    s.user_code AS seller_code,
    f.feeder_code,
    t.quantity_kwh,
    t.price_inr_per_kwh,
    t.gross_amount_inr,
    t.discom_fee_inr,
    t.net_amount_inr,
    t.execution_status,
    t.delivery_status,
    t.matched_at,
    t.delivered_at
FROM trades t
JOIN users b ON b.id = t.buyer_id
JOIN users s ON s.id = t.seller_id
JOIN feeders f ON f.id = t.feeder_id;

-- View 6: Settlement Audit & Financial Tracking
CREATE OR REPLACE VIEW v_settlement_status AS
SELECT 
    st.id AS settlement_id,
    t.trade_code,
    st.trade_id,
    st.gross_amount_inr,
    st.discom_wheeling_fee_inr,
    st.net_amount_inr,
    st.settlement_status,
    st.transaction_reference,
    st.blockchain_tx_hash,
    st.settled_at,
    st.created_at
FROM settlements st
JOIN trades t ON t.id = st.trade_id;


-- ============================================================================
-- 7. SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeders ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_execution_logs ENABLE ROW LEVEL SECURITY;

-- Helper condition: Is admin or service role
-- (auth.role() = 'service_role' OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin'))

-- USERS POLICIES
CREATE POLICY p_users_select ON users FOR SELECT USING (
    auth.uid() = id OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY p_users_all_admin ON users FOR ALL USING (
    auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- METERS POLICIES
CREATE POLICY p_meters_select ON meters FOR SELECT USING (
    auth.uid() = user_id OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY p_meters_all_admin ON meters FOR ALL USING (
    auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- TELEMETRY POLICIES
CREATE POLICY p_telemetry_select ON meter_telemetry FOR SELECT USING (
    EXISTS (SELECT 1 FROM meters WHERE meters.id = meter_telemetry.meter_id AND meters.user_id = auth.uid())
    OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY p_telemetry_all_admin ON meter_telemetry FOR ALL USING (
    auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- FEEDERS & MARKET PRICES & FORECASTS (Publicly viewable by authenticated users)
CREATE POLICY p_feeders_read ON feeders FOR SELECT USING (true);
CREATE POLICY p_market_prices_read ON market_prices FOR SELECT USING (true);
CREATE POLICY p_forecasts_read ON forecasts FOR SELECT USING (true);

-- ORDERS POLICIES
CREATE POLICY p_orders_select ON orders FOR SELECT USING (
    auth.uid() = user_id OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY p_orders_insert ON orders FOR INSERT WITH CHECK (
    auth.uid() = user_id OR auth.role() = 'service_role'
);
CREATE POLICY p_orders_update_own ON orders FOR UPDATE USING (
    auth.uid() = user_id OR auth.role() = 'service_role'
);

-- TRADES POLICIES (Immutable trade logs)
CREATE POLICY p_trades_select ON trades FOR SELECT USING (
    auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- SETTLEMENTS POLICIES
CREATE POLICY p_settlements_select ON settlements FOR SELECT USING (
    EXISTS (SELECT 1 FROM trades WHERE trades.id = settlements.trade_id AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid()))
    OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- GRID CHECKS & LOGS POLICIES
CREATE POLICY p_grid_checks_read ON grid_checks FOR SELECT USING (true);
CREATE POLICY p_audit_logs_select ON audit_logs FOR SELECT USING (
    auth.uid() = user_id OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY p_agent_logs_select ON agent_execution_logs FOR SELECT USING (
    auth.uid() = user_id OR auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);


-- ============================================================================
-- 8. SAMPLE / MOCK DATA INSERTION
-- Indian grid context, 3 feeders, 10 users, 10 meters, 100+ telemetry,
-- forecasts, dynamic prices, orders, trades, settlements, and audit logs.
-- ============================================================================

-- A. FEEDERS DATA (3 Distribution Substation Feeders)
INSERT INTO feeders (id, feeder_code, name, capacity_kw, active_load_kw, active_generation_kw, headroom_kw, utilization_percent, reverse_power_flow_limit_kw, congestion_status, trade_allowed) VALUES
('f1000000-0000-0000-0000-000000000001', 'FEEDER-A', 'Solar Dense Substation 1 (Sector 62 Noida)', 500.00, 180.00, 220.00, 100.00, 44.00, 150.00, 'NORMAL', true),
('f2000000-0000-0000-0000-000000000002', 'FEEDER-B', 'Industrial Hub Substation 2 (Okhla Phase III)', 1000.00, 750.00, 120.00, 130.00, 87.00, 200.00, 'WARNING', true),
('f3000000-0000-0000-0000-000000000003', 'FEEDER-C', 'Residential Substation 3 (Indirapuram Ghaziabad)', 350.00, 310.00, 30.00, 10.00, 97.14, 50.00, 'CONGESTED', false);

-- B. USERS DATA (10 Users: 6 Prosumers, 3 Consumers, 1 Admin)
INSERT INTO USERS (id, user_code, name, role, wallet_address, feeder_id, is_active) VALUES
('u0000000-0000-0000-0000-000000000001', 'H001', 'Aarav Sharma (Rooftop Solar 10kW)', 'prosumer', '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 'f1000000-0000-0000-0000-000000000001', true),
('u0000000-0000-0000-0000-000000000002', 'H002', 'Priya Patel (Rooftop Solar 15kW)', 'prosumer', '0x3C44CdD05aB5191817048639800B69571C5062a6', 'f1000000-0000-0000-0000-000000000001', true),
('u0000000-0000-0000-0000-000000000003', 'H003', 'Rajesh Gupta (Commercial Solar 25kW)', 'prosumer', '0x90F79bf6EB2c4f8080653A214d57053528b76c8D', 'f1000000-0000-0000-0000-000000000001', true),
('u0000000-0000-0000-0000-000000000004', 'H004', 'Vikram Singh (Rooftop Solar 8kW)', 'prosumer', '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', 'f2000000-0000-0000-0000-000000000002', true),
('u0000000-0000-0000-0000-000000000005', 'H005', 'Ananya Verma (Rooftop Solar 12kW)', 'prosumer', '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', 'f2000000-0000-0000-0000-000000000002', true),
('u0000000-0000-0000-0000-000000000006', 'H006', 'Suresh Kumar (Rooftop Solar 5kW)', 'prosumer', '0x976EA74026E726554dB657fA54763abd0C3a0aa9', 'f3000000-0000-0000-0000-000000000003', true),
('u0000000-0000-0000-0000-000000000007', 'H007', 'Kavita Reddy (Residential Consumer)', 'consumer', '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', 'f1000000-0000-0000-0000-000000000001', true),
('u0000000-0000-0000-0000-000000000008', 'H008', 'Siddharth Jain (Commercial Buyer)', 'consumer', '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', 'f2000000-0000-0000-0000-000000000002', true),
('u0000000-0000-0000-0000-000000000009', 'H009', 'Rohan Mehta (EV Charging Station)', 'consumer', '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', 'f3000000-0000-0000-0000-000000000003', true),
('u0000000-0000-0000-0000-00000000000a', 'ADMIN01', 'PowerFlow Grid Admin', 'admin', '0xBcd4042DE499D14e55001CAbB24a55dCA3748846', 'f1000000-0000-0000-0000-000000000001', true);

-- C. METERS DATA (10 Smart Meters)
INSERT INTO meters (id, meter_code, user_id, feeder_id, meter_type, rated_capacity_kw, current_generation_kw, current_load_kw, available_surplus_kwh, status) VALUES
('m0000000-0000-0000-0000-000000000001', 'MTR-H001-01', 'u0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'PROSUMER', 10.00, 8.50, 2.10, 6.40, 'ONLINE'),
('m0000000-0000-0000-0000-000000000002', 'MTR-H002-01', 'u0000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'PROSUMER', 15.00, 13.20, 3.50, 9.70, 'ONLINE'),
('m0000000-0000-0000-0000-000000000003', 'MTR-H003-01', 'u0000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001', 'PROSUMER', 25.00, 21.00, 6.00, 15.00, 'ONLINE'),
('m0000000-0000-0000-0000-000000000004', 'MTR-H004-01', 'u0000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000002', 'PROSUMER', 8.00, 6.80, 2.20, 4.60, 'ONLINE'),
('m0000000-0000-0000-0000-000000000005', 'MTR-H005-01', 'u0000000-0000-0000-0000-000000000005', 'f2000000-0000-0000-0000-000000000002', 'PROSUMER', 12.00, 10.10, 4.00, 6.10, 'ONLINE'),
('m0000000-0000-0000-0000-000000000006', 'MTR-H006-01', 'u0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-000000000003', 'PROSUMER', 5.00, 4.00, 1.80, 2.20, 'ONLINE'),
('m0000000-0000-0000-0000-000000000007', 'MTR-H007-01', 'u0000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000001', 'CONSUMER', 0.00, 0.00, 4.20, 0.00, 'ONLINE'),
('m0000000-0000-0000-0000-000000000008', 'MTR-H008-01', 'u0000000-0000-0000-0000-000000000008', 'f2000000-0000-0000-0000-000000000002', 'CONSUMER', 0.00, 0.00, 12.50, 0.00, 'ONLINE'),
('m0000000-0000-0000-0000-000000000009', 'MTR-H009-01', 'u0000000-0000-0000-0000-000000000009', 'f3000000-0000-0000-0000-000000000003', 'CONSUMER', 0.00, 0.00, 18.00, 0.00, 'ONLINE'),
('m0000000-0000-0000-0000-00000000000a', 'MTR-ADM-01', 'u0000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-000000000001', 'CONSUMER', 0.00, 0.00, 0.50, 0.00, 'ONLINE');

-- Link users to their primary meters
UPDATE users SET meter_id = 'm0000000-0000-0000-0000-000000000001' WHERE id = 'u0000000-0000-0000-0000-000000000001';
UPDATE users SET meter_id = 'm0000000-0000-0000-0000-000000000002' WHERE id = 'u0000000-0000-0000-0000-000000000002';
UPDATE users SET meter_id = 'm0000000-0000-0000-0000-000000000003' WHERE id = 'u0000000-0000-0000-0000-000000000003';
UPDATE users SET meter_id = 'm0000000-0000-0000-0000-000000000004' WHERE id = 'u0000000-0000-0000-0000-000000000004';
UPDATE users SET meter_id = 'm0000000-0000-0000-0000-000000000005' WHERE id = 'u0000000-0000-0000-0000-000000000005';
UPDATE users SET meter_id = 'm0000000-0000-0000-0000-000000000006' WHERE id = 'u0000000-0000-0000-0000-000000000006';
UPDATE users SET meter_id = 'm0000000-0000-0000-0000-000000000007' WHERE id = 'u0000000-0000-0000-0000-000000000007';
UPDATE users SET meter_id = 'm0000000-0000-0000-0000-000000000008' WHERE id = 'u0000000-0000-0000-0000-000000000008';
UPDATE users SET meter_id = 'm0000000-0000-0000-0000-000000000009' WHERE id = 'u0000000-0000-0000-0000-000000000009';
UPDATE users SET meter_id = 'm0000000-0000-0000-0000-00000000000a' WHERE id = 'u0000000-0000-0000-0000-00000000000a';

-- D. METER TELEMETRY DATA (100+ Historical Readings across past 12 hours)
INSERT INTO meter_telemetry (meter_id, feeder_id, timestamp, generation_kw, load_kw, net_power_kw, voltage_v, current_a, frequency_hz, energy_import_kwh, energy_export_kwh)
SELECT 
    m.id AS meter_id,
    m.feeder_id AS feeder_id,
    NOW() - (interval '1 hour' * s.i) AS timestamp,
    CASE WHEN m.meter_type = 'PROSUMER' THEN ROUND((8.0 + (s.i % 4) - (s.i % 3))::numeric, 2) ELSE 0.00 END AS generation_kw,
    ROUND((1.5 + (s.i % 3) + (CASE WHEN m.meter_type = 'CONSUMER' THEN 5.0 ELSE 0.0 END))::numeric, 2) AS load_kw,
    CASE WHEN m.meter_type = 'PROSUMER' THEN ROUND((6.5 - (s.i % 2))::numeric, 2) ELSE ROUND((-1.5 - (s.i % 3))::numeric, 2) END AS net_power_kw,
    ROUND((228.0 + (s.i % 5))::numeric, 2) AS voltage_v,
    ROUND((10.0 + (s.i % 8))::numeric, 2) AS current_a,
    ROUND((49.95 + (s.i % 3) * 0.03)::numeric, 2) AS frequency_hz,
    ROUND((100.0 + s.i * 2.5)::numeric, 4) AS energy_import_kwh,
    CASE WHEN m.meter_type = 'PROSUMER' THEN ROUND((250.0 + s.i * 6.2)::numeric, 4) ELSE 0.0000 END AS energy_export_kwh
FROM meters m
CROSS JOIN generate_series(0, 11) AS s(i);

-- E. FORECASTS DATA (Demand & Solar ML forecasts for meters)
INSERT INTO forecasts (meter_id, forecast_type, forecast_timestamp, target_timestamp, predicted_value, lower_bound, upper_bound, irradiance_w_m2, temperature_c, surplus_kwh, peak_hour, model_name) VALUES
('m0000000-0000-0000-0000-000000000001', 'solar', NOW(), NOW() + interval '2 hours', 9.20, 8.50, 9.80, 850.00, 32.50, 7.10, true, 'solar_forecaster_xgb_v1'),
('m0000000-0000-0000-0000-000000000001', 'demand', NOW(), NOW() + interval '2 hours', 2.10, 1.80, 2.40, NULL, 32.50, 0.00, false, 'demand_forecaster_lstm_v1'),
('m0000000-0000-0000-0000-000000000002', 'solar', NOW(), NOW() + interval '2 hours', 14.10, 13.00, 15.20, 860.00, 33.00, 10.60, true, 'solar_forecaster_xgb_v1'),
('m0000000-0000-0000-0000-000000000003', 'solar', NOW(), NOW() + interval '2 hours', 23.50, 21.00, 25.00, 855.00, 32.80, 17.50, true, 'solar_forecaster_xgb_v1'),
('m0000000-0000-0000-0000-000000000007', 'demand', NOW(), NOW() + interval '2 hours', 4.50, 3.80, 5.10, NULL, 32.50, 0.00, true, 'demand_forecaster_lstm_v1'),
('m0000000-0000-0000-0000-000000000008', 'demand', NOW(), NOW() + interval '2 hours', 14.00, 12.50, 15.50, NULL, 33.00, 0.00, true, 'demand_forecaster_lstm_v1');

-- F. MARKET PRICES DATA (Dynamic Tariff records per feeder)
INSERT INTO market_prices (feeder_id, timestamp, base_tariff_inr_per_kwh, clearing_price_inr_per_kwh, min_price_inr_per_kwh, max_price_inr_per_kwh, discom_fee_inr_per_kwh) VALUES
('f1000000-0000-0000-0000-000000000001', NOW(), 6.50, 4.80, 3.00, 15.00, 0.25),
('f2000000-0000-0000-0000-000000000002', NOW(), 6.50, 6.20, 3.00, 15.00, 0.25),
('f3000000-0000-0000-0000-000000000003', NOW(), 6.50, 8.50, 3.00, 15.00, 0.25);

-- G. ORDERS DATA (10 Marketplace Orders)
INSERT INTO orders (id, order_code, user_id, meter_id, feeder_id, order_type, quantity_kwh, remaining_quantity_kwh, price_inr_per_kwh, max_price_inr_per_kwh, min_price_inr_per_kwh, status, grid_check_status) VALUES
('o0000000-0000-0000-0000-000000000001', 'ORD-20260912-001', 'u0000000-0000-0000-0000-000000000001', 'm0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'SELL', 5.00, 0.00, 4.50, NULL, 4.50, 'FILLED', 'PASSED'),
('o0000000-0000-0000-0000-000000000002', 'ORD-20260912-002', 'u0000000-0000-0000-0000-000000000007', 'm0000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000001', 'BUY', 5.00, 0.00, 4.50, 5.00, NULL, 'FILLED', 'PASSED'),
('o0000000-0000-0000-0000-000000000003', 'ORD-20260912-003', 'u0000000-0000-0000-0000-000000000002', 'm0000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'SELL', 8.00, 3.00, 4.60, NULL, 4.60, 'PARTIALLY_FILLED', 'PASSED'),
('o0000000-0000-0000-0000-000000000004', 'ORD-20260912-004', 'u0000000-0000-0000-0000-000000000007', 'm0000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000001', 'BUY', 5.00, 0.00, 4.60, 4.80, NULL, 'FILLED', 'PASSED'),
('o0000000-0000-0000-0000-000000000005', 'ORD-20260912-005', 'u0000000-0000-0000-0000-000000000003', 'm0000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001', 'SELL', 10.00, 10.00, 4.75, NULL, 4.75, 'OPEN', 'PASSED'),
('o0000000-0000-0000-0000-000000000006', 'ORD-20260912-006', 'u0000000-0000-0000-0000-000000000004', 'm0000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000002', 'SELL', 4.00, 4.00, 6.00, NULL, 6.00, 'OPEN', 'PASSED'),
('o0000000-0000-0000-0000-000000000007', 'ORD-20260912-007', 'u0000000-0000-0000-0000-000000000008', 'm0000000-0000-0000-0000-000000000008', 'f2000000-0000-0000-0000-000000000002', 'BUY', 10.00, 10.00, 6.20, 6.50, NULL, 'OPEN', 'PASSED'),
('o0000000-0000-0000-0000-000000000008', 'ORD-20260912-008', 'u0000000-0000-0000-0000-000000000005', 'm0000000-0000-0000-0000-000000000005', 'f2000000-0000-0000-0000-000000000002', 'SELL', 5.00, 5.00, 6.10, NULL, 6.10, 'OPEN', 'PASSED'),
('o0000000-0000-0000-0000-000000000009', 'ORD-20260912-009', 'u0000000-0000-0000-0000-000000000006', 'm0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-000000000003', 'SELL', 2.00, 2.00, 7.50, NULL, 7.50, 'REJECTED', 'FAILED'),
('o0000000-0000-0000-0000-00000000000a', 'ORD-20260912-010', 'u0000000-0000-0000-0000-000000000009', 'm0000000-0000-0000-0000-000000000009', 'f3000000-0000-0000-0000-000000000003', 'BUY', 15.00, 15.00, 8.00, 8.50, NULL, 'REJECTED', 'FAILED');

-- H. TRADES DATA (Matched Trades)
INSERT INTO trades (id, trade_code, buy_order_id, sell_order_id, buyer_id, seller_id, feeder_id, quantity_kwh, price_inr_per_kwh, gross_amount_inr, discom_fee_inr, net_amount_inr, delivery_status, execution_status, matched_at, delivered_at) VALUES
('t0000000-0000-0000-0000-000000000001', 'TRD-20260912-001', 'o0000000-0000-0000-0000-000000000002', 'o0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000007', 'u0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 5.00, 4.50, 22.50, 1.25, 21.25, 'DELIVERED', 'EXECUTED', NOW() - interval '1 hour', NOW() - interval '50 minutes'),
('t0000000-0000-0000-0000-000000000002', 'TRD-20260912-002', 'o0000000-0000-0000-0000-000000000004', 'o0000000-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000007', 'u0000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 5.00, 4.60, 23.00, 1.25, 21.75, 'DELIVERED', 'EXECUTED', NOW() - interval '30 minutes', NOW() - interval '20 minutes');

-- I. SETTLEMENTS DATA (Financial & On-Chain Settlement)
INSERT INTO settlements (id, trade_id, gross_amount_inr, discom_wheeling_fee_inr, net_amount_inr, settlement_status, transaction_reference, blockchain_tx_hash, settled_at) VALUES
('s0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', 22.50, 1.25, 21.25, 'SETTLED', 'TXN-P2P-889102', '0x8f3b211a5c667d4e9281a17726a88b14e9129031c599182390a12e5571120abc', NOW() - interval '45 minutes'),
('s0000000-0000-0000-0000-000000000002', 't0000000-0000-0000-0000-000000000002', 23.00, 1.25, 21.75, 'SETTLED', 'TXN-P2P-889103', '0x1c4a99182390a12e5571120abc8f3b211a5c667d4e9281a17726a88b14e91290', NOW() - interval '15 minutes');

-- J. GRID CHECKS DATA
INSERT INTO grid_checks (id, order_id, feeder_id, utilization_percent, available_headroom_kw, reverse_power_flow_kw, trade_allowed, decision, rejection_code, checked_at) VALUES
('g0000000-0000-0000-0000-000000000001', 'o0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 44.00, 100.00, 20.00, true, 'APPROVED', NULL, NOW() - interval '1 hour'),
('g0000000-0000-0000-0000-000000000002', 'o0000000-0000-0000-0000-000000000009', 'f3000000-0000-0000-0000-000000000003', 97.14, 10.00, 5.00, false, 'REJECTED', 'GRID_CONGESTION_REJECTION', NOW() - interval '10 minutes');

-- K. AUDIT LOGS DATA
INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, request_data, response_data, decision, tool_name, audit_hash) VALUES
('a0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', 'CREATE_SELL_ORDER', 'orders', 'o0000000-0000-0000-0000-000000000001', '{"quantity_kwh": 5.0, "price_inr": 4.5}', '{"status": "OPEN", "order_code": "ORD-20260912-001"}', 'APPROVED', 'create_sell_order', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
('a0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000006', 'CREATE_SELL_ORDER', 'orders', 'o0000000-0000-0000-0000-000000000009', '{"quantity_kwh": 2.0, "price_inr": 7.5}', '{"status": "REJECTED", "reason": "Feeder FEEDER-C congested"}', 'REJECTED', 'create_sell_order', 'f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afb');

-- L. AGENT EXECUTION LOGS DATA
INSERT INTO agent_execution_logs (id, session_id, user_id, user_query, selected_tool, tool_arguments, tool_result, decision, execution_time_ms) VALUES
('e0000000-0000-0000-0000-000000000001', 'sess_991823001', 'u0000000-0000-0000-0000-000000000001', 'Check solar forecast and available surplus for H001', 'get_solar_forecast', '{"meter_id": "m0000000-0000-0000-0000-000000000001"}', '{"predicted_solar_kw": 9.2, "available_surplus_kwh": 6.4}', 'EXECUTE_ORDER_RECOMMENDATION', 142),
('e0000000-0000-0000-0000-000000000002', 'sess_991823002', 'u0000000-0000-0000-0000-000000000007', 'Find open buy orders near FEEDER-A below 5 INR/kWh', 'get_open_orders', '{"feeder_id": "f1000000-0000-0000-0000-000000000001"}', '{"count": 3, "orders": [{"code": "ORD-20260912-001", "price": 4.5}]}', 'MATCH_FOUND', 98);

COMMIT;
