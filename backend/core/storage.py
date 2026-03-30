from __future__ import annotations

from google.cloud import storage

from core.config import settings


if settings.GCP_SERVICE_ACCOUNT_PATH:
	storage_client = storage.Client.from_service_account_json(
		settings.GCP_SERVICE_ACCOUNT_PATH
	)
else:
	storage_client = storage.Client()

bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
