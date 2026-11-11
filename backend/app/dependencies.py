from collections.abc import Callable
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.audit import record_audit
from app.database import get_db
from app.models import User
from app.security import decode_access_token, token_user_id

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        claims = decode_access_token(credentials.credentials)
        user_id = token_user_id(claims)
        token_version = int(claims["ver"])
        company_id = UUID(claims["company"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise unauthorized from None
    user = db.scalar(
        select(User)
        .options(selectinload(User.roles), selectinload(User.plants))
        .where(User.id == user_id, User.company_id == company_id)
    )
    if user is None or not user.is_active or user.token_version != token_version:
        raise unauthorized
    return user


def get_fully_authenticated_user(user: User = Depends(get_current_user)) -> User:
    if user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Change your password before accessing this resource.",
        )
    return user


def require_permission(permission: str) -> Callable:
    def permission_dependency(
        user: User = Depends(get_fully_authenticated_user),
        db: Session = Depends(get_db),
    ) -> User:
        granted = {item for role in user.roles for item in role.permissions}
        if "*" not in granted and permission not in granted:
            record_audit(
                db,
                company_id=user.company_id,
                event_type="auth.permission_denied",
                user=user,
                details={"permission": permission},
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")
        return user
    return permission_dependency


def visible_plant_ids(user: User) -> set[UUID] | None:
    permissions = {item for role in user.roles for item in role.permissions}
    if "*" in permissions:
        return None
    return {plant.id for plant in user.plants if plant.is_active}


def authorize_plant(user: User, plant_id: UUID) -> None:
    allowed = visible_plant_ids(user)
    if allowed is not None and plant_id not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Plant access denied.")
