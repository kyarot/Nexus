from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any

from google.genai import types

from core.gemini import GEMINI_VISION, client

logger = logging.getLogger(__name__)

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
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
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
        logger.error("Error in process_voice: %s", exc)
        raise ValueError(f"Failed to process voice report: {exc}") from exc
