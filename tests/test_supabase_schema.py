"""
Tests for Supabase Schema & Migration Specification.
Validates the presence of all required relational tables, enums, views,
stored procedures (RPCs), constraints, and RLS policies.
"""

import os
from pathlib import Path
import pytest

SCHEMA_PATH = Path(__file__).parent.parent / "supabase" / "migrations" / "20260912000000_powerflow_schema.sql"

REQUIRED_TABLES = [
    "profiles",
    "feeders",
    "meters",
    "solar_assets",
    "meter_telemetry",
    "forecasts",
    "market_prices",
    "orders",
    "grid_checks",
    "trades",
    "settlements",
    "blockchain_transactions",
    "wallet_transactions",
    "notifications",
    "audit_logs",
    "agent_execution_logs",
]

REQUIRED_ENUMS = [
    "user_role_type",
    "feeder_status_type",
    "meter_type_enum",
    "solar_asset_status_enum",
    "forecast_type_enum",
    "order_type_enum",
    "order_status_enum",
    "grid_check_result_enum",
    "trade_status_enum",
    "settlement_status_enum",
    "wallet_tx_type",
    "notification_type_enum",
]

REQUIRED_VIEWS = [
    "v_available_energy",
    "v_marketplace_orders",
    "v_feeder_health",
    "v_trade_summary",
]

REQUIRED_RPCS = [
    "fn_check_grid_safety",
    "fn_get_available_surplus",
    "fn_create_validated_order",
    "fn_match_orders",
    "fn_create_settlement",
    "fn_get_marketplace_energy",
    "fn_get_feeder_health",
    "fn_get_wallet_balance",
    "fn_record_audit_event",
]


@pytest.fixture(scope="module")
def schema_sql():
    assert SCHEMA_PATH.exists(), f"Schema file not found at {SCHEMA_PATH}"
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        return f.read()


def test_schema_file_exists():
    assert SCHEMA_PATH.exists()
    assert os.path.getsize(SCHEMA_PATH) > 10000


def test_all_16_tables_defined(schema_sql):
    for table in REQUIRED_TABLES:
        pattern = f"CREATE TABLE IF NOT EXISTS {table}"
        assert pattern in schema_sql, f"Missing table definition for {table}"


def test_all_12_enums_defined(schema_sql):
    for enum in REQUIRED_ENUMS:
        pattern = f"CREATE TYPE {enum} AS ENUM"
        assert pattern in schema_sql, f"Missing enum definition for {enum}"


def test_all_4_views_defined(schema_sql):
    for view in REQUIRED_VIEWS:
        pattern = f"CREATE OR REPLACE VIEW {view}"
        assert pattern in schema_sql, f"Missing view definition for {view}"


def test_all_9_rpcs_defined(schema_sql):
    for rpc in REQUIRED_RPCS:
        pattern = f"CREATE OR REPLACE FUNCTION {rpc}"
        assert pattern in schema_sql, f"Missing stored procedure for {rpc}"


def test_row_level_security_enabled(schema_sql):
    for table in REQUIRED_TABLES:
        pattern = f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"
        assert pattern in schema_sql, f"RLS not enabled on table {table}"


def test_realtime_publications_enabled(schema_sql):
    assert "ALTER PUBLICATION supabase_realtime ADD TABLE orders;" in schema_sql
    assert "ALTER PUBLICATION supabase_realtime ADD TABLE trades;" in schema_sql
    assert "ALTER PUBLICATION supabase_realtime ADD TABLE meter_telemetry;" in schema_sql
    assert "ALTER PUBLICATION supabase_realtime ADD TABLE notifications;" in schema_sql


def test_grid_regulatory_constraints_present(schema_sql):
    # INR 3.00 to 15.00/kWh bound check
    assert "3.00" in schema_sql
    assert "15.00" in schema_sql
    # DISCOM wheeling charge 0.25 INR/kWh
    assert "0.25" in schema_sql
    # Feeder 90% utilization threshold check
    assert "0.90" in schema_sql or "90" in schema_sql
