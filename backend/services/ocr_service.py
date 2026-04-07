from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any

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


def _normalize_result(result: dict[str, Any]) -> dict[str, Any]:
    severity = str(result.get("severity") or "medium").lower().strip()
    if severity not in {"low", "medium", "high", "critical"}:
        severity = "medium"

    safety_signals = result.get("safetySignals")
    if not isinstance(safety_signals, list):
        safety_signals = []

    field_confidences = result.get("fieldConfidences")
    if not isinstance(field_confidences, dict):
        field_confidences = {}

    families_affected = max(0, _coerce_int(result.get("familiesAffected"), 0))
    persons_affected = max(0, _coerce_int(result.get("personsAffected"), 0))
    if persons_affected <= 0 and families_affected > 0:
        persons_affected = families_affected * 4

    return {
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
            "needType": max(0, min(100, _coerce_int(field_confidences.get("needType"), 0))),
            "severity": max(0, min(100, _coerce_int(field_confidences.get("severity"), 0))),
            "families": max(0, min(100, _coerce_int(field_confidences.get("families"), 0))),
            "persons": max(0, min(100, _coerce_int(field_confidences.get("persons"), 0))),
            "location": max(0, min(100, _coerce_int(field_confidences.get("location"), 0))),
        },
    }


async def process_scan(image_bytes: bytes, mime_type: str) -> dict:
    """Extract structured data from a scanned community survey image."""
    prompt = (
        "Extract all data from this community survey form.\n"
        "Return ONLY valid JSON with NO markdown fences:\n"
        "{"
        '"needType":str, '
        '"severity":"low"|"medium"|"high"|"critical", '
        '"familiesAffected":int, '
        '"personsAffected":int, '
        '"location":str, '
        '"landmark":str, '
        '"householdRef":str, '
        '"visitType":"first_visit"|"follow_up"|"revisit", '
        '"verificationState":"unverified"|"verified"|"rejected", '
        '"additionalNotes":str, '
        '"safetySignals":list[str], '
        '"confidence":int, '
        '"fieldConfidences":{"needType":int,"severity":int,"families":int,"persons":int,"location":int}'
        "}"
    )

    try:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        response = client.models.generate_content(
            model=GEMINI_VISION,
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": image_b64,
                            }
                        },
                    ],
                }
            ],
        )

        text = _strip_json_fences(getattr(response, "text", "") or "")
        if not text:
            raise ValueError("Gemini returned empty OCR response")

        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            raise ValueError("Gemini OCR response is not a JSON object")

        return _normalize_result(parsed)
    except ValueError:
        raise
    except Exception as exc:
        logger.error("Error in process_scan: %s", exc)
        raise ValueError(f"Failed to process image scan: {exc}") from exc
