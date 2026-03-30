from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    ALLOWED_ORIGINS: str = "http://localhost:8080"
    FIREBASE_SERVICE_ACCOUNT_PATH: str
    FIREBASE_DATABASE_URL: str | None = None
    GEMINI_API_KEY: str
    GCS_BUCKET_NAME: str
    GCP_SERVICE_ACCOUNT_PATH: str | None = None
    JWT_SECRET_KEY: str = "change-me-in-env"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 1440

    @property
    def origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()  # type: ignore[call-arg]
