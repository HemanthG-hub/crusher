from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from pwdlib import PasswordHash
from uuid import uuid4

from app.config import get_settings
from app.models import User

password_hash = PasswordHash.recommended()
DUMMY_PASSWORD_HASH = password_hash.hash("quarry-one-password-hash-timing-only")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_access_token(user: User) -> tuple[str, int]:
    settings = get_settings()
    expires_in = settings.access_token_minutes * 60
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(user.id),
            "company": str(user.company_id),
            "ver": user.token_version,
            "iat": now,
            "exp": now + timedelta(seconds=expires_in),
            "jti": uuid4().hex,
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    return token, expires_in


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])


def token_user_id(claims: dict) -> UUID:
    return UUID(claims["sub"])
