"""
GRIDMIND — Central configuration.

All tunable constants live here. Override any value via environment variable.
Production deployments should inject secrets via env, not this file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,
    )

    # ── Application ───────────────────────────────────────────────────────────
    app_name: str = "GRIDMIND"
    environment: str = Field("development", alias="ENVIRONMENT")
    debug: bool = True

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = Field(
        "postgresql+asyncpg://gridmind:gridmind_secret@localhost:5432/gridmind",
        alias="DATABASE_URL",
    )
    # Sync URL for Alembic migrations (uses psycopg2)
    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = Field("redis://localhost:6379/0", alias="REDIS_URL")

    # ── Auth ──────────────────────────────────────────────────────────────────
    secret_key: str = Field("gridmind_jwt_secret_change_in_prod", alias="SECRET_KEY")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours for demo

    # ── Pricing Engine Constants ───────────────────────────────────────────────
    # Base price in ₹/kWh
    p_base: float = Field(4.0, alias="P_BASE")
    # Floor price — no trade below this
    p_min: float = Field(2.0, alias="P_MIN")
    # Ceiling price — no trade above this (protects consumers; set by regulator)
    p_max: float = Field(8.0, alias="P_MAX")
    # Demand weight: higher α amplifies demand-driven price rises
    alpha: float = Field(1.5, alias="ALPHA")
    # Supply weight: higher β means abundant supply depresses price more
    beta: float = Field(1.2, alias="BETA")
    # Maximum congestion surcharge (₹/kWh added when feeder fully loaded)
    c_congestion_max: float = Field(1.0, alias="C_CONGESTION_MAX")
    # Retail tariff baseline for consumer savings calculation (₹/kWh)
    retail_baseline: float = Field(9.0, alias="RETAIL_BASELINE")
    # Utility export rate for prosumer uplift calculation (₹/kWh)
    utility_export_rate: float = Field(2.5, alias="UTILITY_EXPORT_RATE")

    # ── Grid Constants ────────────────────────────────────────────────────────
    # Default transformer capacity in kW (can be overridden per feeder in DB)
    default_transformer_capacity_kw: float = Field(100.0, alias="TRANSFORMER_CAPACITY_KW")
    # Congestion threshold (fraction of capacity) above which C_congestion > 0
    congestion_threshold: float = Field(0.7, alias="CONGESTION_THRESHOLD")

    # ── Simulator ─────────────────────────────────────────────────────────────
    simulator_households: int = Field(20, alias="SIMULATOR_HOUSEHOLDS")
    simulator_feeders: int = Field(2, alias="SIMULATOR_FEEDERS")
    # Speed multiplier: 60 means 15 real-min interval fires every 15 seconds
    simulator_speed_multiplier: int = Field(60, alias="SIMULATOR_SPEED_MULTIPLIER")
    backend_url: str = Field("http://backend:8000", alias="BACKEND_URL")


# Singleton — import and use `settings` everywhere
settings = Settings()
