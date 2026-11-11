import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.audit import record_audit
from app.database import get_db
from app.dependencies import (
    authorize_plant, get_current_user, get_fully_authenticated_user,
    require_permission, visible_plant_ids,
)
from app.models import Plant, Role, User
from app.schemas import (
    DashboardMetric, DashboardMetrics, DashboardSummary, LoginRequest, PasswordChangeRequest,
    PlantCreate, PlantSummary, RoleSummary, TokenResponse, UserCreate, UserSummary,
)
from app.security import DUMMY_PASSWORD_HASH, create_access_token, hash_password, verify_password

logger = logging.getLogger("quarry_one.audit")
router = APIRouter(prefix="/api/v1")


def user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=[role.name for role in user.roles],
        plant_ids=[plant.id for plant in user.plants],
        must_change_password=user.must_change_password,
    )


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(
        select(User)
        .options(selectinload(User.roles), selectinload(User.plants))
        .where(User.email == payload.email)
    )
    password_matches = verify_password(payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH)
    if user is None or not user.is_active or not password_matches:
        if user is not None:
            record_audit(
                db,
                company_id=user.company_id,
                event_type="auth.login_failed",
                user=user,
                source_ip=request.client.host if request.client else None,
            )
            db.commit()
        logger.warning("Authentication failed")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    user.last_login_at = datetime.now(timezone.utc)
    record_audit(
        db,
        company_id=user.company_id,
        event_type="auth.login_succeeded",
        user=user,
        source_ip=request.client.host if request.client else None,
    )
    db.commit()
    token, expires_in = create_access_token(user)
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        must_change_password=user.must_change_password,
    )


@router.get("/auth/me", response_model=UserSummary)
def who_am_i(user: User = Depends(get_current_user)) -> UserSummary:
    return user_summary(user)


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    user.token_version += 1
    record_audit(
        db,
        company_id=user.company_id,
        event_type="auth.logout",
        user=user,
        source_ip=request.client.host if request.client else None,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/auth/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a new password.")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    user.token_version += 1
    record_audit(
        db,
        company_id=user.company_id,
        event_type="auth.password_changed",
        user=user,
        source_ip=request.client.host if request.client else None,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/users/me", response_model=UserSummary)
def get_my_profile(user: User = Depends(get_current_user)) -> UserSummary:
    return user_summary(user)


@router.get("/roles", response_model=list[RoleSummary])
def list_roles(
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("roles:read")),
) -> list[RoleSummary]:
    roles = db.scalars(select(Role).order_by(Role.name)).all()
    return [RoleSummary(id=role.id, name=role.name, permissions=role.permissions) for role in roles]


@router.get("/users", response_model=list[UserSummary])
def list_users(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("users:read")),
) -> list[UserSummary]:
    users = db.scalars(
        select(User)
        .options(selectinload(User.roles), selectinload(User.plants))
        .where(User.company_id == user.company_id)
        .order_by(User.full_name)
    ).all()
    return [user_summary(account) for account in users]


@router.post("/users", response_model=UserSummary, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("users:create")),
) -> UserSummary:
    roles = db.scalars(select(Role).where(Role.id.in_(payload.role_ids))).all()
    plants = db.scalars(
        select(Plant).where(
            Plant.id.in_(payload.plant_ids),
            Plant.company_id == actor.company_id,
            Plant.is_active.is_(True),
        )
    ).all() if payload.plant_ids else []
    if len(roles) != len(set(payload.role_ids)):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="One or more roles are invalid.")
    if len(plants) != len(set(payload.plant_ids)):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="One or more plants are invalid.")
    account = User(
        company_id=actor.company_id,
        email=payload.email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.temporary_password),
        must_change_password=True,
        roles=roles,
        plants=plants,
    )
    db.add(account)
    try:
        db.flush()
        record_audit(
            db, company_id=actor.company_id, event_type="user.created", user=actor,
            subject_type="user", subject_id=str(account.id),
            details={"role_ids": [str(role.id) for role in roles]},
        )
        db.commit()
        db.refresh(account)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists.") from None
    return user_summary(account)


@router.get("/plants", response_model=list[PlantSummary])
def list_plants(
    db: Session = Depends(get_db),
    user: User = Depends(get_fully_authenticated_user),
) -> list[PlantSummary]:
    query = select(Plant).where(Plant.company_id == user.company_id, Plant.is_active.is_(True))
    allowed = visible_plant_ids(user)
    if allowed is not None:
        query = query.where(Plant.id.in_(allowed)) if allowed else query.where(Plant.id.is_(None))
    return [PlantSummary.model_validate(plant) for plant in db.scalars(query.order_by(Plant.name)).all()]


@router.post("/plants", response_model=PlantSummary, status_code=status.HTTP_201_CREATED)
def create_plant(
    payload: PlantCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("plants:create")),
) -> PlantSummary:
    plant = Plant(company_id=user.company_id, name=payload.name.strip(), code=payload.code.upper(), location=payload.location)
    db.add(plant)
    try:
        db.flush()
        user.plants.append(plant)
        record_audit(
            db, company_id=user.company_id, event_type="plant.created", user=user,
            subject_type="plant", subject_id=str(plant.id),
        )
        db.commit()
        db.refresh(plant)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Plant code already exists or could not be saved.") from None
    return PlantSummary.model_validate(plant)


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard(
    plant_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_fully_authenticated_user),
) -> DashboardSummary:
    if plant_id:
        authorize_plant(user, plant_id)
        if db.scalar(
            select(Plant.id).where(
                Plant.id == plant_id,
                Plant.company_id == user.company_id,
                Plant.is_active.is_(True),
            )
        ) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found.")
        plant_scope = str(plant_id)
    else:
        plant_scope = "all_authorized_plants"
    empty_metric = DashboardMetric(value=0, unit="", previous_period_value=0, has_data=False)
    return DashboardSummary(
        plant_scope=plant_scope,
        as_of=datetime.now(timezone.utc),
        metrics=DashboardMetrics(
            production_tonnes=empty_metric.model_copy(update={"unit": "t"}),
            dispatches=empty_metric.model_copy(update={"unit": "count"}),
            sales_revenue_inr=empty_metric.model_copy(update={"unit": "INR"}),
            stock_tonnes=empty_metric.model_copy(update={"unit": "t"}),
            diesel_litres=empty_metric.model_copy(update={"unit": "L"}),
        ),
        setup_required=[
            "Production records",
            "Dispatch records",
            "Sales invoices",
            "Inventory ledger",
            "Fuel transactions",
        ],
    )


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def readiness(db: Session = Depends(get_db)) -> dict[str, str]:
    from sqlalchemy import text

    db.execute(text("SELECT 1"))
    return {"status": "ready", "database": "connected"}


@router.get("/audit-logs")
def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("audit:read")),
) -> list[dict]:
    from app.models import AuditLog

    bounded_limit = max(1, min(limit, 200))
    records = db.scalars(
        select(AuditLog)
        .where(AuditLog.company_id == user.company_id)
        .order_by(AuditLog.created_at.desc())
        .limit(bounded_limit)
    ).all()
    return [
        {
            "id": record.id,
            "user_id": record.user_id,
            "event_type": record.event_type,
            "subject_type": record.subject_type,
            "subject_id": record.subject_id,
            "details": record.details,
            "created_at": record.created_at,
        }
        for record in records
    ]
