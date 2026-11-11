from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "QUARRY ONE API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://quarry_one:local-only-change-me@127.0.0.1:5432/quarry_one"
    jwt_secret: str = "CHANGE-ME-BEFORE-STARTING"
    access_token_minutes: int = 20
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        validate_default=True,
    )

    @field_validator("jwt_secret")
    @classmethod
    def reject_placeholder_secret(cls, value: str) -> str:
        if len(value) < 32 or value in {
            "CHANGE-ME-BEFORE-STARTING",
            "replace-this-with-a-random-secret-at-least-32-characters",
        }:
            raise ValueError("JWT_SECRET must be a unique secret of at least 32 characters.")
        return value

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
