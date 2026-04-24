from __future__ import annotations

from functools import lru_cache

from google import genai
from google.genai.types import HttpOptions
from google.oauth2 import service_account

from core.config import settings

VERTEX_SCOPE = "https://www.googleapis.com/auth/cloud-platform"


def _load_vertex_credentials():
    candidate_paths = [settings.GCP_SERVICE_ACCOUNT_PATH, settings.FIREBASE_SERVICE_ACCOUNT_PATH]
    for path in candidate_paths:
        if path and str(path).strip():
            return service_account.Credentials.from_service_account_file(str(path), scopes=[VERTEX_SCOPE])
    return None


def _require_vertex_project() -> str:
    project_id = str(settings.COPILOT_VERTEX_PROJECT_ID or "").strip()
    if not project_id:
        raise ValueError("COPILOT_VERTEX_PROJECT_ID is required for Vertex AI Copilot")
    return project_id


def _resolve_vertex_location() -> str:
    return str(settings.COPILOT_VERTEX_LOCATION or "us-central1").strip() or "us-central1"


@lru_cache(maxsize=1)
def get_copilot_vertex_client() -> genai.Client:
    credentials = _load_vertex_credentials()
    project_id = _require_vertex_project()
    location = _resolve_vertex_location()

    client_args = {
        "vertexai": True,
        "project": project_id,
        "location": location,
        "http_options": HttpOptions(api_version="v1"),
    }
    if credentials is not None:
        client_args["credentials"] = credentials

    return genai.Client(**client_args)


COPILOT_GEMINI_MODEL = str(settings.COPILOT_VERTEX_MODEL or "gemini-2.5-flash-lite")
