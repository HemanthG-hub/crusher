import logging
import logging.config

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import router


def configure_logging() -> None:
    settings = get_settings()
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "structured": {
                    "format": '{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}'
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "structured",
                }
            },
            "root": {"level": settings.log_level.upper(), "handlers": ["console"]},
        }
    )


configure_logging()
settings = get_settings()
development = settings.environment == "development"
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if development else None,
    redoc_url="/redoc" if development else None,
    openapi_url="/openapi.json" if development else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)
