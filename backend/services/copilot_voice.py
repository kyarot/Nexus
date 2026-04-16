from __future__ import annotations

import base64
import json
import logging
from typing import Any

import certifi
import google.auth
from google.auth.transport.requests import Request
from google.oauth2 import service_account
import requests

from core.config import settings

logger = logging.getLogger(__name__)

TTS_SCOPE = "https://www.googleapis.com/auth/cloud-platform"
CHIRP3_HD_VOICE = "en-US-Chirp3-HD-Achernar"
TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize"


def _load_credentials():
    candidate_paths = [settings.GCP_SERVICE_ACCOUNT_PATH, settings.FIREBASE_SERVICE_ACCOUNT_PATH]
    for path in candidate_paths:
        if path and str(path).strip():
            return service_account.Credentials.from_service_account_file(str(path), scopes=[TTS_SCOPE])

    credentials, _ = google.auth.default(scopes=[TTS_SCOPE])
    return credentials


def synthesize_copilot_speech(text: str, language_code: str = "en-US", voice_name: str = CHIRP3_HD_VOICE) -> dict[str, Any]:
    normalized_text = " ".join(str(text or "").split()).strip()
    if not normalized_text:
        raise ValueError("Cannot synthesize empty Copilot text")

    credentials = _load_credentials()
    credentials.refresh(Request())

    payload = {
        "input": {"text": normalized_text},
        "voice": {
            "languageCode": language_code or "en-US",
            "name": voice_name,
        },
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": 1.0,
            "pitch": 0.0,
        },
    }

    try:
        response = requests.post(
            TTS_ENDPOINT,
            headers={
                "Authorization": f"Bearer {credentials.token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            data=json.dumps(payload),
            timeout=30,
            verify=certifi.where(),
        )
        response.raise_for_status()
        data = response.json()
    except requests.HTTPError as exc:
        error_body = exc.response.text if exc.response is not None else str(exc)
        logger.error("Copilot TTS HTTP error: %s", error_body)
        raise ValueError(f"Copilot speech synthesis failed: {error_body}") from exc
    except Exception as exc:
        logger.exception("Copilot TTS request failed")
        raise ValueError(f"Copilot speech synthesis failed: {exc}") from exc

    audio_base64 = str(data.get("audioContent") or "")
    if not audio_base64:
        raise ValueError("Copilot speech synthesis returned no audio")

    return {
        "audio_base64": audio_base64,
        "audio_mime_type": "audio/mpeg",
        "voice_name": voice_name,
    }