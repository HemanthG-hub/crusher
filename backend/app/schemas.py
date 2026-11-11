import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalized_email(value: str) -> str:
    email = value.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Enter a valid email address.")
    return email


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return normalized_email(value)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    must_change_password: bool


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class UserSummary(BaseModel):
    id: UUID
    email: str
    full_name: str
    roles: list[str]
    plant_ids: list[UUID]
    must_change_password: bool


class PlantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=2, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")
    location: str | None = Field(default=None, max_length=200)


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    full_name: str = Field(min_length=2, max_length=160)
    temporary_password: str = Field(min_length=12, max_length=256)
    role_ids: list[UUID] = Field(min_length=1, max_length=12)
    plant_ids: list[UUID] = Field(default_factory=list, max_length=100)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return normalized_email(value)


class PlantSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
    location: str | None
    is_active: bool


class RoleSummary(BaseModel):
    id: UUID
    name: str
    permissions: list[str]


class DashboardMetric(BaseModel):
    value: float
    unit: str
    previous_period_value: float
    has_data: bool


class DashboardMetrics(BaseModel):
    production_tonnes: DashboardMetric
    dispatches: DashboardMetric
    sales_revenue_inr: DashboardMetric
    stock_tonnes: DashboardMetric
    diesel_litres: DashboardMetric


class DashboardSummary(BaseModel):
    plant_scope: str
    as_of: datetime
    metrics: DashboardMetrics
    setup_required: list[str]
