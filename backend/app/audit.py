from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AuditLog, User


def record_audit(
    db: Session,
    *,
    company_id: UUID,
    event_type: str,
    user: User | None = None,
    subject_type: str | None = None,
    subject_id: str | None = None,
    details: dict[str, Any] | None = None,
    source_ip: str | None = None,
) -> None:
    db.add(
        AuditLog(
            company_id=company_id,
            user_id=user.id if user else None,
            event_type=event_type,
            subject_type=subject_type,
            subject_id=subject_id,
            details=details or {},
            source_ip=source_ip,
        )
    )
