from __future__ import annotations

from functools import lru_cache

from google.cloud import translate_v2 as translate
from google.oauth2 import service_account

from core.config import settings


@lru_cache(maxsize=1)
def get_translate_client() -> translate.Client:
    if settings.GCP_SERVICE_ACCOUNT_PATH and settings.GCP_SERVICE_ACCOUNT_PATH.strip():
        credentials = service_account.Credentials.from_service_account_file(
            settings.GCP_SERVICE_ACCOUNT_PATH
        )
        return translate.Client(credentials=credentials)
    return translate.Client()
