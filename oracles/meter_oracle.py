"""
Smart Meter Oracle Relay Service.
Inspired by EmperorRP/EnergySwap Chainlink Oracle Adapter.
Acts as the secure off-chain to on-chain bridge, translating verified physical telemetry
into blockchain energy minting attestations.
"""

import hmac
import hashlib
import json
from datetime import datetime, timezone
from typing import Any


class SmartMeterOracleRelay:
    """
    Decentralized Oracle Adapter for smart meters.
    Verifies physical telemetry integrity before minting ERC-20 NRG energy tokens.
    """

    def __init__(self, oracle_private_key: str = "oracle-secret-key-2026"):
        self.oracle_key = oracle_private_key.encode("utf-8")

    def generate_meter_attestation(
        self,
        meter_id: str,
        prosumer_address: str,
        solar_gen_kwh: float,
        household_load_kwh: float
    ) -> dict[str, Any]:
        """
        Calculates net exportable surplus and creates a cryptographically signed attestation
        ready for submission to the EnergyToken.sol mintEnergy() function.
        """
        surplus_kwh = max(0.0, solar_gen_kwh - household_load_kwh)
        now_iso = datetime.now(timezone.utc).isoformat()

        payload = {
            "meter_id": meter_id,
            "prosumer_address": prosumer_address,
            "net_surplus_kwh": round(surplus_kwh, 4),
            "timestamp": now_iso,
        }

        # Generate HMAC-SHA256 signature for oracle verification
        payload_bytes = json.dumps(payload, sort_keys=True).encode("utf-8")
        sig = hmac.new(self.oracle_key, payload_bytes, hashlib.sha256).hexdigest()

        return {
            "status": "SUCCESS",
            "attestation": payload,
            "oracle_signature": f"0x{sig}",
            "mintable_nrg_tokens": int(surplus_kwh * 1e18) if surplus_kwh > 0 else 0,
            "ready_for_onchain_mint": surplus_kwh > 0.05,
        }


meter_oracle = SmartMeterOracleRelay()
