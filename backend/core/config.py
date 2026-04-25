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
    GEMINI_API_VERSION: str = "v1beta"
    GEMINI_FLASH_MODEL: str = "gemini-2.5-flash-lite"
    GEMINI_PRO_MODEL: str = "gemini-2.5-flash-lite"
    GEMINI_VISION_MODEL: str = "gemini-2.5-flash-lite"
    COPILOT_VERTEX_PROJECT_ID: str = ""
    COPILOT_VERTEX_LOCATION: str = "us-central1"
    COPILOT_VERTEX_MODEL: str = "gemini-2.5-flash-lite"
    GCS_BUCKET_NAME: str
    GCP_SERVICE_ACCOUNT_PATH: str | None = None
    JWT_SECRET_KEY: str = "change-me-in-env"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 1440

    def get_firebase_credentials(self) -> dict | str:
        import json
        import os
        # Check if the path is actually a JSON string
        path = self.FIREBASE_SERVICE_ACCOUNT_PATH
        if path.strip().startswith("{"):
            try:
                return json.loads(path)
            except json.JSONDecodeError:
                pass
        return path

    def get_gcp_credentials(self) -> dict | str | None:
        import json
        import os
        path = self.GCP_SERVICE_ACCOUNT_PATH
        if not path:
            return None
        if path.strip().startswith("{"):
            try:
                return json.loads(path)
            except json.JSONDecodeError:
                pass
        return path

    COPILOT_PLANNER_ENABLED: bool = True
    COPILOT_CACHE_ENABLED: bool = True
    COPILOT_CACHE_TTL_SECONDS: int = 45
    COPILOT_VOICE_COALESCE_ENABLED: bool = True
    COPILOT_VOICE_BURST_WINDOW_MS: int = 850
    COPILOT_AUTO_CREATE_MISSIONS: bool = False

    SPEECH_TO_TEXT_DEFAULT_LANGUAGE: str = "en-US"

    PUBLIC_TRACKING_SALT: str = ""
    PUBLIC_SYNTHESIS_MIN_REPORTS: int = 5
    PUBLIC_SYNTHESIS_LOOKBACK_DAYS: int = 14
    PUBLIC_RATE_LIMIT_PHONE_PER_HOUR: int = 5
    PUBLIC_RATE_LIMIT_IP_PER_HOUR: int = 20
    PUBLIC_DEDUPE_WINDOW_MINUTES: int = 10
    COMMUNITY_ECHO_RETENTION_WEEKS: int = 4
    COMMUNITY_ECHO_DISPATCH_BATCH_SIZE: int = 250

    @property
    def origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()  # type: ignore[call-arg]
