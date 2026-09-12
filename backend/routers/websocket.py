"""
WebSocket endpoint — /ws/live
Broadcasts real-time events to all connected dashboard clients.

Events emitted:
  price_update       — when a new price is computed for a feeder
  order_matched      — when a trade is created by the matching engine
  grid_alert         — when congestion band changes on a feeder
  settlement_complete — when a trade is settled
"""

import json
from datetime import datetime, timezone
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from schemas import WSEvent, WSEventType

router = APIRouter(tags=["WebSocket"])

# In-memory connection set — sufficient for MVP single-instance deployment.
# For multi-instance, replace with a Redis pub/sub fan-out.
_connections: Set[WebSocket] = set()


async def broadcast(event: WSEvent) -> None:
    """Broadcast a WebSocket event to all connected clients."""
    if not _connections:
        return
    message = event.model_dump_json()
    dead = set()
    for ws in _connections:
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)


async def emit_price_update(feeder_id: str, price: float) -> None:
    await broadcast(WSEvent(
        event=WSEventType.price_update,
        data={"feeder_id": feeder_id, "price": price},
        timestamp=datetime.now(timezone.utc),
    ))


async def emit_order_matched(trade_id: str, quantity: float, price: float) -> None:
    await broadcast(WSEvent(
        event=WSEventType.order_matched,
        data={"trade_id": trade_id, "quantity_kwh": quantity, "clearing_price": price},
        timestamp=datetime.now(timezone.utc),
    ))


async def emit_grid_alert(feeder_id: str, congestion_level: float, headroom_kw: float, band: str) -> None:
    await broadcast(WSEvent(
        event=WSEventType.grid_alert,
        data={
            "feeder_id": feeder_id,
            "congestion_level": congestion_level,
            "headroom_kw": headroom_kw,
            "band": band,
        },
        timestamp=datetime.now(timezone.utc),
    ))


async def emit_settlement_complete(trade_id: str, status: str) -> None:
    await broadcast(WSEvent(
        event=WSEventType.settlement_complete,
        data={"trade_id": trade_id, "status": status},
        timestamp=datetime.now(timezone.utc),
    ))


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """
    WebSocket endpoint for real-time dashboard updates.
    Clients connect and receive events as JSON.
    """
    await websocket.accept()
    _connections.add(websocket)

    # Send initial connection confirmation
    await websocket.send_text(json.dumps({
        "event": "connected",
        "data": {"message": "GRIDMIND live feed connected"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }))

    try:
        while True:
            # Keep connection alive — clients send pings as needed
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))
    except WebSocketDisconnect:
        _connections.discard(websocket)
