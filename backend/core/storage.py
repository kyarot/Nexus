from __future__ import annotations

from google.cloud import storage

from core.config import settings


gcp_creds = settings.get_gcp_credentials()
if gcp_creds:
    if isinstance(gcp_creds, dict):
        storage_client = storage.Client.from_service_account_info(gcp_creds)
    else:
        storage_client = storage.Client.from_service_account_json(gcp_creds)
else:
    storage_client = storage.Client()

bucket = None
if settings.GCS_BUCKET_NAME and settings.GCS_BUCKET_NAME.strip():
    bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
else:
    import logging
    logging.getLogger(__name__).warning("GCS_BUCKET_NAME is empty. GCS uploads will be disabled.")
