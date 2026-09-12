"""Initial schema — all 6 GRIDMIND tables

Revision ID: 0001_initial
Revises: 
Create Date: 2026-09-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enums ──────────────────────────────────────────────────────────────────
    user_role = postgresql.ENUM(
        "prosumer", "consumer", "discom_operator", "regulator",
        name="user_role"
    )
    order_side = postgresql.ENUM("buy", "sell", name="order_side")
    order_status = postgresql.ENUM(
        "OPEN", "PARTIALLY_FILLED", "MATCHED", "SETTLED", "CANCELLED", "EXPIRED",
        name="order_status"
    )
    trade_status = postgresql.ENUM(
        "OPEN", "MATCHED", "GRID_LIMITED", "SETTLED", "REJECTED", "UTILITY_EXPORT",
        name="trade_status"
    )
    congestion_level_enum = postgresql.ENUM("GREEN", "AMBER", "RED", name="congestion_level_enum")
    billing_status = postgresql.ENUM(
        "PENDING", "DISPATCHED", "CONFIRMED", "FAILED",
        name="billing_status"
    )

    for e in [user_role, order_side, order_status, trade_status, congestion_level_enum, billing_status]:
        e.create(op.get_bind(), checkfirst=True)

    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("hashed_password", sa.String(128), nullable=False),
        sa.Column("role", sa.Enum("prosumer", "consumer", "discom_operator", "regulator", name="user_role"), nullable=False),
        sa.Column("meter_id", sa.String(32), nullable=False),
        sa.Column("feeder_id", sa.String(32), nullable=False),
        sa.Column("wallet_id", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("meter_id"),
    )

    # ── meter_readings ─────────────────────────────────────────────────────────
    op.create_table(
        "meter_readings",
        sa.Column("reading_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("meter_id", sa.String(32), nullable=False),
        sa.Column("feeder_id", sa.String(32), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("generation_kwh", sa.Float(), nullable=False, server_default="0"),
        sa.Column("consumption_kwh", sa.Float(), nullable=False, server_default="0"),
        sa.Column("export_kwh", sa.Float(), nullable=False, server_default="0"),
        sa.Column("surplus_kwh", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("validation_notes", sa.String(256), nullable=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("reading_id"),
    )
    op.create_index("ix_meter_readings_meter_id", "meter_readings", ["meter_id"])
    op.create_index("ix_meter_readings_feeder_id", "meter_readings", ["feeder_id"])
    op.create_index("ix_meter_readings_timestamp", "meter_readings", ["timestamp"])

    # ── orders ─────────────────────────────────────────────────────────────────
    op.create_table(
        "orders",
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feeder_id", sa.String(32), nullable=False),
        sa.Column("side", sa.Enum("buy", "sell", name="order_side"), nullable=False),
        sa.Column("quantity_kwh", sa.Float(), nullable=False),
        sa.Column("filled_kwh", sa.Float(), nullable=False, server_default="0"),
        sa.Column("min_price", sa.Float(), nullable=True),
        sa.Column("max_price", sa.Float(), nullable=True),
        sa.Column("interval", sa.String(64), nullable=False),
        sa.Column("status", sa.Enum("OPEN", "PARTIALLY_FILLED", "MATCHED", "SETTLED", "CANCELLED", "EXPIRED", name="order_status"), nullable=False, server_default="OPEN"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("order_id"),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"])
    op.create_index("ix_orders_feeder_id", "orders", ["feeder_id"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_created_at", "orders", ["created_at"])

    # ── trades ─────────────────────────────────────────────────────────────────
    op.create_table(
        "trades",
        sa.Column("trade_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("buy_order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("sell_order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feeder_id", sa.String(32), nullable=False),
        sa.Column("quantity_kwh", sa.Float(), nullable=False),
        sa.Column("allowed_kwh", sa.Float(), nullable=True),
        sa.Column("clearing_price", sa.Float(), nullable=False),
        sa.Column("status", sa.Enum("OPEN", "MATCHED", "GRID_LIMITED", "SETTLED", "REJECTED", "UTILITY_EXPORT", name="trade_status"), nullable=False, server_default="OPEN"),
        sa.Column("grid_notes", sa.String(256), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["buy_order_id"], ["orders.order_id"]),
        sa.ForeignKeyConstraint(["sell_order_id"], ["orders.order_id"]),
        sa.PrimaryKeyConstraint("trade_id"),
    )
    op.create_index("ix_trades_buy_order_id", "trades", ["buy_order_id"])
    op.create_index("ix_trades_sell_order_id", "trades", ["sell_order_id"])
    op.create_index("ix_trades_feeder_id", "trades", ["feeder_id"])
    op.create_index("ix_trades_status", "trades", ["status"])
    op.create_index("ix_trades_timestamp", "trades", ["timestamp"])

    # ── grid_states ────────────────────────────────────────────────────────────
    op.create_table(
        "grid_states",
        sa.Column("state_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feeder_id", sa.String(32), nullable=False),
        sa.Column("transformer_id", sa.String(32), nullable=False),
        sa.Column("load_kw", sa.Float(), nullable=False, server_default="0"),
        sa.Column("capacity_kw", sa.Float(), nullable=False),
        sa.Column("headroom_kw", sa.Float(), nullable=False, server_default="0"),
        sa.Column("congestion_level", sa.Float(), nullable=False, server_default="0"),
        sa.Column("congestion_band", sa.Enum("GREEN", "AMBER", "RED", name="congestion_level_enum"), nullable=False, server_default="GREEN"),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("state_id"),
    )
    op.create_index("ix_grid_states_feeder_id", "grid_states", ["feeder_id"])
    op.create_index("ix_grid_states_recorded_at", "grid_states", ["recorded_at"])

    # ── settlements ────────────────────────────────────────────────────────────
    op.create_table(
        "settlements",
        sa.Column("settlement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("trade_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("seller_ref", sa.String(64), nullable=False),
        sa.Column("buyer_ref", sa.String(64), nullable=False),
        sa.Column("quantity_kwh", sa.Float(), nullable=False),
        sa.Column("clearing_price", sa.Float(), nullable=False),
        sa.Column("gross_value", sa.Float(), nullable=False),
        sa.Column("platform_fee", sa.Float(), nullable=False, server_default="0"),
        sa.Column("seller_credit", sa.Float(), nullable=False),
        sa.Column("buyer_debit", sa.Float(), nullable=False),
        sa.Column("utility_reference", sa.String(64), nullable=True),
        sa.Column("billing_status", sa.Enum("PENDING", "DISPATCHED", "CONFIRMED", "FAILED", name="billing_status"), nullable=False, server_default="PENDING"),
        sa.Column("audit_tx", sa.String(128), nullable=True),
        sa.Column("settled_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.trade_id"]),
        sa.PrimaryKeyConstraint("settlement_id"),
        sa.UniqueConstraint("trade_id"),
    )
    op.create_index("ix_settlements_trade_id", "settlements", ["trade_id"])
    op.create_index("ix_settlements_billing_status", "settlements", ["billing_status"])


def downgrade() -> None:
    op.drop_table("settlements")
    op.drop_table("grid_states")
    op.drop_table("trades")
    op.drop_table("orders")
    op.drop_table("meter_readings")
    op.drop_table("users")

    for name in ["billing_status", "congestion_level_enum", "trade_status", "order_status", "order_side", "user_role"]:
        postgresql.ENUM(name=name).drop(op.get_bind(), checkfirst=True)
