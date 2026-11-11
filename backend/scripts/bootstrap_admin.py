import os
import re
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import select

from app.database import SessionLocal
from app.models import Company, Role, User
from app.security import hash_password

SUPER_ADMIN_PERMISSIONS = ["*"]
STANDARD_ROLES = {
    "Owner/Director": ["plants:read", "users:read", "roles:read", "audit:read"],
    "Plant Manager": ["plants:read", "plants:create", "users:read"],
    "Production Supervisor": ["plants:read"],
    "Weighbridge Operator": ["plants:read"],
    "Sales/Billing": ["plants:read"],
    "Accountant": ["plants:read"],
    "HR Manager": ["plants:read"],
    "Payroll Preparer": [],
    "Payroll Approver": [],
    "Maintenance Manager": ["plants:read"],
    "Employee": [],
}


def main() -> None:
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    email = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")
    full_name = os.getenv("BOOTSTRAP_ADMIN_NAME", "").strip()
    company_name = os.getenv("COMPANY_NAME", "Quarry One")
    if not email or not password or not full_name:
        raise SystemExit(
            "Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (12+ characters), "
            "and BOOTSTRAP_ADMIN_NAME before running bootstrap."
        )
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise SystemExit("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.")
    if len(password) < 12:
        raise SystemExit("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters.")

    with SessionLocal() as db:
        company = db.scalar(select(Company).where(Company.name == company_name))
        if company is None:
            company = Company(name=company_name)
            db.add(company)
            db.flush()
        seeded_roles = []
        for role_name, permissions in {"Super Admin": SUPER_ADMIN_PERMISSIONS, **STANDARD_ROLES}.items():
            role = db.scalar(select(Role).where(Role.name == role_name))
            if role is None:
                role = Role(name=role_name, permissions=permissions)
                db.add(role)
                db.flush()
            seeded_roles.append(role)
        role = next(role for role in seeded_roles if role.name == "Super Admin")
        user = db.scalar(select(User).where(User.company_id == company.id, User.email == email))
        if user is None:
            user = User(
                company_id=company.id,
                email=email,
                full_name=full_name,
                password_hash=hash_password(password),
                must_change_password=True,
            )
            user.roles.append(role)
            db.add(user)
        elif not any(existing.id == role.id for existing in user.roles):
            user.roles.append(role)
        db.commit()
        print(f"Bootstrap administrator ready: {email}. Change the password after first sign-in.")


if __name__ == "__main__":
    main()
