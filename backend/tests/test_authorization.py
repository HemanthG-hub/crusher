from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.dependencies import authorize_plant, get_fully_authenticated_user, visible_plant_ids
from app.models import Plant, Role, User


def build_user(*, permissions: list[str], plants: list[Plant]) -> User:
    return User(
        id=uuid4(),
        company_id=uuid4(),
        email="operator@example.test",
        full_name="Test Operator",
        password_hash="not-used",
        roles=[Role(id=uuid4(), name="Test role", permissions=permissions)],
        plants=plants,
    )


def test_plant_scope_contains_only_assigned_active_plants() -> None:
    assigned = Plant(id=uuid4(), name="North", code="NORTH", is_active=True)
    inactive = Plant(id=uuid4(), name="Closed", code="CLOSED", is_active=False)
    user = build_user(permissions=["plants:read"], plants=[assigned, inactive])

    assert visible_plant_ids(user) == {assigned.id}
    authorize_plant(user, assigned.id)
    with pytest.raises(HTTPException) as error:
        authorize_plant(user, inactive.id)
    assert error.value.status_code == 403


def test_unrestricted_role_uses_company_wide_scope() -> None:
    user = build_user(permissions=["*"], plants=[])

    assert visible_plant_ids(user) is None


def test_user_without_plant_assignments_has_empty_scope() -> None:
    user = build_user(permissions=["plants:read"], plants=[])

    assert visible_plant_ids(user) == set()


def test_initial_password_change_blocks_workspace_access() -> None:
    user = build_user(permissions=["*"], plants=[])
    user.must_change_password = True

    with pytest.raises(HTTPException) as error:
        get_fully_authenticated_user(user)
    assert error.value.status_code == 403
