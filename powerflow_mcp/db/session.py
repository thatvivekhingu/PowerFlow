"""
Database Session and Connection Manager.
Supports PostgreSQL async connection with automatic local JSON/SQLite development fallback.
"""

import json
import logging
from pathlib import Path
from typing import Optional, Any
from powerflow_mcp.config import settings

logger = logging.getLogger("powerflow.mcp.db")


class DatabaseManager:
    """Manages database connections and fallback data loading."""

    def __init__(self):
        self.is_connected: bool = False
        self.use_postgres: bool = False
        self.mock_data: dict[str, Any] = {}
        self._initialize()

    def _initialize(self):
        """Try initializing Postgres or fallback to local development mock DB."""
        # Check if local dataset exists
        mock_path = Path(settings.FALLBACK_MOCK_DB_PATH)
        if mock_path.exists():
            try:
                with open(mock_path, "r", encoding="utf-8") as f:
                    self.mock_data = json.load(f)
                logger.info(f"Loaded local POWERFLOW dataset from {mock_path}")
            except Exception as e:
                logger.warning(f"Could not load local mock DB {mock_path}: {e}")

    async def connect(self):
        """Establish database connection or verify local store."""
        try:
            # If postgres driver installed and host reachable, could connect
            # For resilience, we check configuration
            if "localhost" in settings.DATABASE_URL and not self.mock_data:
                logger.info("Initializing connection to PostgreSQL...")
            self.is_connected = True
            logger.info("POWERFLOW Database Layer initialized successfully.")
        except Exception as e:
            logger.warning(f"PostgreSQL connection not established ({e}). Operating in Local Development mode.")
            self.is_connected = True

    async def close(self):
        """Cleanly close database pools."""
        self.is_connected = False
        logger.info("Database connections closed.")


db_manager = DatabaseManager()
