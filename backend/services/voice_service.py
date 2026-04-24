from __future__ import annotations

import base64
import json
import logging
import re
from functools import lru_cache
from typing import Any

from google.cloud import speech
from google.genai import types
from google.oauth2 import service_account

from core.config import settings
from core.gemini import GEMINI_VISION, client

logger = logging.getLogger(__name__)
SPEECH_SCOPE = "https://www.googleapis.com/auth/cloud-platform"


def _extract_retry_seconds(message: str) -> int | None:
    if not message:
        return None
    match = re.search(r"retry in\s+(\d+(?:\.\d+)?)s", message, flags=re.IGNORECASE)
    if match:
        try:
            return max(1, int(float(match.group(1))))
        except ValueError:
            return None
    match = re.search(r"retryDelay'?:\s*'?([0-9]+)s", message)
    if match:
        try:
            return max(1, int(match.group(1)))
        except ValueError:
            return None
    return None

def _strip_json_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return cleaned


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_language_code(language: str) -> str:
    normalized = str(language or "").strip()
    if not normalized:
        return settings.SPEECH_TO_TEXT_DEFAULT_LANGUAGE
    if "-" in normalized:
        return normalized
    if normalized.lower() == "en":
        return "en-US"
    return normalized


def _clean_mime_type(mime_type: str) -> str:
    return str(mime_type or "").split(";")[0].strip().lower()


def _resolve_speech_encoding(mime_type: str) -> tuple[speech.RecognitionConfig.AudioEncoding, int | None]:
    cleaned = _clean_mime_type(mime_type)
    if cleaned == "audio/webm":
        return speech.RecognitionConfig.AudioEncoding.WEBM_OPUS, 48000
    if cleaned == "audio/ogg" or cleaned == "audio/opus":
        return speech.RecognitionConfig.AudioEncoding.OGG_OPUS, 48000
    if cleaned in {"audio/wav", "audio/x-wav", "audio/wave"}:
        return speech.RecognitionConfig.AudioEncoding.LINEAR16, None
    if cleaned == "audio/flac":
        return speech.RecognitionConfig.AudioEncoding.FLAC, None
    return speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED, None


def _load_speech_credentials():
    candidate_paths = [settings.GCP_SERVICE_ACCOUNT_PATH, settings.FIREBASE_SERVICE_ACCOUNT_PATH]
    for path in candidate_paths:
        if path and str(path).strip():
            return service_account.Credentials.from_service_account_file(str(path), scopes=[SPEECH_SCOPE])
    return None


@lru_cache(maxsize=1)
def _speech_client() -> speech.SpeechClient:
    credentials = _load_speech_credentials()
    return speech.SpeechClient(credentials=credentials) if credentials else speech.SpeechClient()


def _normalize_voice_result(result: dict[str, Any]) -> dict[str, Any]:
    severity = str(result.get("severity") or "medium").lower().strip()
    if severity not in {"low", "medium", "high", "critical"}:
        severity = "medium"

    safety_signals = result.get("safetySignals")
    if not isinstance(safety_signals, list):
        safety_signals = []

    transcript = str(result.get("transcript") or "")
    transcript_english = str(result.get("transcriptEnglish") or "")
    if not transcript_english and transcript:
        transcript_english = transcript

    families_affected = max(0, _coerce_int(result.get("familiesAffected"), 0))
    persons_affected = max(0, _coerce_int(result.get("personsAffected"), 0))
    if persons_affected <= 0 and families_affected > 0:
        persons_affected = families_affected * 4

    return {
        "transcript": transcript,
        "transcriptEnglish": transcript_english,
        "needType": str(result.get("needType") or "General"),
        "severity": severity,
        "familiesAffected": families_affected,
        "personsAffected": persons_affected,
        "location": str(result.get("location") or ""),
        "landmark": str(result.get("landmark") or ""),
        "householdRef": str(result.get("householdRef") or ""),
        "visitType": str(result.get("visitType") or "first_visit"),
        "verificationState": str(result.get("verificationState") or "unverified"),
        "additionalNotes": str(result.get("additionalNotes") or ""),
        "safetySignals": [str(signal) for signal in safety_signals],
        "confidence": max(0, min(100, _coerce_int(result.get("confidence"), 0))),
        "fieldConfidences": {
            "needType": max(0, min(100, _coerce_int(result.get("fieldConfidences", {}).get("needType"), 0))),
            "severity": max(0, min(100, _coerce_int(result.get("fieldConfidences", {}).get("severity"), 0))),
            "families": max(0, min(100, _coerce_int(result.get("fieldConfidences", {}).get("families"), 0))),
            "persons": max(0, min(100, _coerce_int(result.get("fieldConfidences", {}).get("persons"), 0))),
            "location": max(0, min(100, _coerce_int(result.get("fieldConfidences", {}).get("location"), 0))),
        },
    }


async def transcribe_voice(
    audio_bytes: bytes,
    language: str = "en",
    mime_type: str = "audio/wav",
) -> dict:
    """Transcribe voice input using Cloud Speech-to-Text."""
    if not audio_bytes:
        raise ValueError("Audio input was empty")

    language_code = _normalize_language_code(language)
    encoding, sample_rate = _resolve_speech_encoding(mime_type)
    config_kwargs: dict[str, Any] = {
        "language_code": language_code,
        "enable_automatic_punctuation": True,
        "model": "latest_short",
    }
    if encoding != speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED:
        config_kwargs["encoding"] = encoding
    if sample_rate:
        config_kwargs["sample_rate_hertz"] = sample_rate

    config = speech.RecognitionConfig(**config_kwargs)
    audio = speech.RecognitionAudio(content=audio_bytes)

    try:
        response = _speech_client().recognize(config=config, audio=audio)
    except Exception as exc:
        message = str(exc)
        logger.error("Speech-to-Text failed: %s", message)
        if "429" in message or "RESOURCE_EXHAUSTED" in message:
            raise ValueError("Speech-to-Text rate limited. Please retry in a few seconds.") from exc
        raise ValueError(f"Speech-to-Text failed: {message}") from exc

    transcript_parts: list[str] = []
    confidences: list[float] = []
    for result in response.results:
        if not result.alternatives:
            continue
        primary = result.alternatives[0]
        if primary.transcript:
            transcript_parts.append(primary.transcript)
        if primary.confidence:
            confidences.append(primary.confidence)

    transcript = " ".join(part.strip() for part in transcript_parts if part.strip()).strip()
    if not transcript:
        raise ValueError("Speech-to-Text returned an empty transcript")

    confidence = max(confidences) if confidences else 0.0
    return {
        "transcript": transcript,
        "transcriptEnglish": transcript,
        "confidence": int(max(0, min(100, round(confidence * 100)))),
    }


async def process_voice(
    audio_bytes: bytes,
    language: str = "en",
    prompt: str | None = None,
    mime_type: str = "audio/wav",
) -> dict:
    """Transcribe and extract structured needs data from a voice report."""
    effective_prompt = prompt or (
        f"Transcribe this voice report carefully. Language hint: {language}.\n"
        "Preserve local names and place names exactly in transcript.\n"
        "Then translate the transcript to clear English in transcriptEnglish.\n"
        "Then extract community needs data from the meaning of the report.\n"
        "Use conservative confidence when audio is noisy or unclear.\n"
        "Return ONLY valid JSON with NO markdown fences:\n"
        "{"
        '"transcript":str, '
        '"transcriptEnglish":str, '
        '"needType":str, '
        '"severity":str, '
        '"familiesAffected":int, '
        '"personsAffected":int, '
        '"location":str, '
        '"landmark":str, '
        '"householdRef":str, '
        '"visitType":"first_visit"|"follow_up"|"revisit", '
        '"verificationState":"unverified"|"verified"|"rejected", '
        '"additionalNotes":str, '
        '"safetySignals":list[str], '
        '"fieldConfidences":{"needType":int,"severity":int,"families":int,"persons":int,"location":int}, '
        '"confidence":int'
        "}"
    )

    try:
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        response = client.models.generate_content(
            model=GEMINI_VISION,
            config=types.GenerateContentConfig(temperature=0.1),
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": effective_prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": audio_b64,
                            }
                        },
                    ],
                }
            ],
        )

        text = _strip_json_fences(getattr(response, "text", "") or "")
        if not text:
            raise ValueError("Gemini returned empty voice response")

        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            raise ValueError("Gemini voice response is not a JSON object")

        # Custom prompts (for mission voice updates) should pass through unchanged.
        if prompt:
            return parsed

        return _normalize_voice_result(parsed)
    except ValueError:
        raise
    except Exception as exc:
        message = str(exc)
        logger.error("Error in process_voice: %s", message)
        if "429" in message or "RESOURCE_EXHAUSTED" in message:
            retry_after = _extract_retry_seconds(message)
            if retry_after:
                raise ValueError(f"Rate limited. Retry after {retry_after} seconds.") from exc
            raise ValueError("Rate limited. Please retry in a few seconds.") from exc
        raise ValueError(f"Failed to process voice report: {message}") from exc
