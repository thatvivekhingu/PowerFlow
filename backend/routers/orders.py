"""
POST /api/orders    — Create a buy or sell order
GET  /api/orders/{id} — Order status
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.order import Order, OrderSide, OrderStatus
from models.user import User, UserRole
from schemas import OrderCreate, OrderResponse
from auth import get_current_user, require_roles, require_any_authenticated

router = APIRouter(prefix="/api/orders", tags=["Orders"])


def _validate_order_for_role(data: OrderCreate, user: User) -> None:
    """Ensure price boundaries and validation for orders.
    In modern P2P microgrids, prosumers produce solar and consume power,
    so they can post both buy and sell orders.
    """
    if data.side == OrderSide.sell and data.min_price is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Sell orders must specify min_price",
        )
    if data.side == OrderSide.buy and data.max_price is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Buy orders must specify max_price",
        )


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_authenticated),
):
    """
    Create a buy or sell order.
    Prosumers and consumers can place buy and sell orders across the P2P marketplace.
    After creation, the order is placed in the matching engine queue.
    """
    _validate_order_for_role(data, current_user)

    order = Order(
        user_id=current_user.user_id,
        feeder_id=current_user.feeder_id,
        side=data.side,
        quantity_kwh=data.quantity_kwh,
        min_price=data.min_price,
        max_price=data.max_price,
        interval=data.interval,
        status=OrderStatus.open,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)

    # Queue order for matching (matching engine picks it up from Redis)
    from services.matching_engine import enqueue_order
    await enqueue_order(order)

    return order


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get order status. Owners see their own orders; operators see all."""
    result = await db.execute(select(Order).where(Order.order_id == order_id))
    order = result.scalar_one_or_none()

    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # RBAC: users can only see their own orders
    if current_user.role not in (UserRole.discom_operator, UserRole.regulator):
        if order.user_id != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return order


@router.get("", response_model=List[OrderResponse])
async def list_orders(
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    feeder_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List orders. Non-operators see only their own orders."""
    query = select(Order)

    if current_user.role not in (UserRole.discom_operator, UserRole.regulator):
        query = query.where(Order.user_id == current_user.user_id)
    elif feeder_id:
        query = query.where(Order.feeder_id == feeder_id)

    if status_filter:
        query = query.where(Order.status == status_filter)

    query = query.order_by(Order.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
