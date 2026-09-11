"""
Configuration Module for POWERFLOW MCP Server.
Loads settings from environment variables or .env file.
"""

from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """POWERFLOW MCP Server Configuration."""

    # Server Info
    SERVER_NAME: str = "powerflow-mcp"
    SERVER_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Database Configuration
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/powerflow",
        description="PostgreSQL async connection URL. If unavailable, falls back to local JSON/SQLite store."
    )
    FALLBACK_MOCK_DB_PATH: Path = Field(
        default=Path("data/powerflow_2026_mock_db.json"),
        description="Path to mock DB JSON for local development mode."
    )
    FALLBACK_TELEMETRY_CSV: Path = Field(
        default=Path("data/powerflow_2026_telemetry.csv"),
        description="Path to 2026 synthetic telemetry CSV."
    )

    # DISCOM & Grid Safety Constraints
    DISCOM_NAME: str = "PowerFlow Regional DISCOM"
    DISCOM_WHEELING_RATE_INR_PER_KWH: float = 0.25  # Standard DISCOM grid wheeling charge
    MAX_UTILIZATION_BEFORE_CONGESTION_PCT: float = 85.0
    CRITICAL_UTILIZATION_LIMIT_PCT: float = 95.0

    # Trading & Market Pricing Parameters (INR/kWh)
    P_BASE_INR: float = 5.0
    P_MIN_INR: float = 3.0
    P_MAX_INR: float = 8.0
    PRICE_ALPHA: float = 1.5  # Demand sensitivity coefficient
    PRICE_BETA: float = 1.0   # Supply sensitivity coefficient

    # Order Limits
    MIN_ORDER_KWH: float = 0.1
    MAX_ORDER_KWH: float = 50.0

    # Security & Audit
    API_AUTH_TOKEN: str = "pf-mcp-sec-token-2026"
    REQUIRE_AUTH: bool = False
    ENABLE_AUDIT_LOG: bool = True
    AUDIT_LOG_FILE: Path = Path("powerflow_mcp_audit.log")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
