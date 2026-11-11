from uuid import uuid4

from fastapi.testclient import TestClient

from app.dependencies import get_fully_authenticated_user
from app.database import get_db
from app.main import app
from app.models import Role, User
from app.security import hash_password


class FakeDatabase:
    def __init__(self, user: User | None) -> None:
        self.user = user
        self.audit_entries = []

    def scalar(self, _statement):
        return self.user

    def add(self, entry) -> None:
        self.audit_entries.append(entry)

    def commit(self) -> None:
        pass


def build_test_user() -> User:
    return User(
        id=uuid4(),
        company_id=uuid4(),
        email="admin@example.test",
        full_name="Test Admin",
        password_hash=hash_password("temporary-test-password"),
        is_active=True,
        must_change_password=False,
        token_version=0,
        roles=[Role(id=uuid4(), name="Test admin", permissions=["*"])],
        plants=[],
    )


def test_health_and_protected_profile() -> None:
    with TestClient(app) as client:
        assert client.get("/api/v1/health").json() == {"status": "ok"}
        assert client.get("/api/v1/auth/me").status_code == 401
        assert client.get("/openapi.json").status_code == 200


def test_empty_dashboard_returns_explicit_zero_metrics() -> None:
    user = build_test_user()
    app.dependency_overrides[get_fully_authenticated_user] = lambda: user
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/dashboard")
        assert response.status_code == 200
        payload = response.json()
        assert payload["metrics"]["production_tonnes"]["value"] == 0
        assert payload["metrics"]["sales_revenue_inr"]["value"] == 0
        assert payload["metrics"]["stock_tonnes"]["has_data"] is False
        assert "Production records" in payload["setup_required"]
    finally:
        app.dependency_overrides.clear()


def test_invalid_credentials_are_rejected() -> None:
    database = FakeDatabase(None)
    app.dependency_overrides[get_db] = lambda: database
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/auth/login",
                json={"email": "unknown@example.test", "password": "wrong-password"},
            )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password."
        assert not database.audit_entries
    finally:
        app.dependency_overrides.clear()


def test_logout_revokes_the_access_token() -> None:
    user = build_test_user()
    database = FakeDatabase(user)
    app.dependency_overrides[get_db] = lambda: database
    try:
        with TestClient(app) as client:
            sign_in = client.post(
                "/api/v1/auth/login",
                json={"email": user.email, "password": "temporary-test-password"},
            )
            assert sign_in.status_code == 200
            token = sign_in.json()["access_token"]
            signed_out = client.post(
                "/api/v1/auth/logout",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert signed_out.status_code == 204
            assert client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            ).status_code == 401
        assert user.token_version == 1
        assert [entry.event_type for entry in database.audit_entries] == [
            "auth.login_succeeded",
            "auth.logout",
        ]
    finally:
        app.dependency_overrides.clear()
