"""
Auth utilities — mock JWT for role-based access control.

For the MVP, tokens are issued without a real login flow:
  - The /auth/token endpoint accepts username + role (no password check in demo mode)
  - The token carries: user_id, role, feeder_id, meter_id
  - Route guards check the role claim to enforce RBAC

This is intentionally simplified for a demo/hackathon. Replace with
real credential verification before any production deployment.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from database import get_db
from models.user import User, UserRole
from schemas import TokenData

security = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        role = payload.get("role")
        feeder_id = payload.get("feeder_id", "")
        meter_id = payload.get("meter_id", "")
        if user_id is None or role is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return TokenData(
            user_id=uuid.UUID(user_id),
            role=UserRole(role),
            feeder_id=feeder_id,
            meter_id=meter_id,
        )
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate token")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token_data = decode_token(credentials.credentials)
    result = await db.execute(select(User).where(User.user_id == token_data.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


# ── Role guards ────────────────────────────────────────────────────────────────
def require_roles(*roles: UserRole):
    """Factory that returns a dependency enforcing one of the given roles."""
    async def _guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access requires role(s): {[r.value for r in roles]}",
            )
        return current_user
    return _guard


# Convenience shortcuts
require_prosumer = require_roles(UserRole.prosumer)
require_consumer = require_roles(UserRole.consumer)
require_operator = require_roles(UserRole.discom_operator, UserRole.regulator)
require_any_authenticated = require_roles(*UserRole)
