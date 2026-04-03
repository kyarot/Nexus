from __future__ import annotations

import json
import logging

from google.genai import types
from core.gemini import client, GEMINI_PRO

logger = logging.getLogger(__name__)

async def process_scan(image_bytes: bytes, mime_type: str) -> dict:
    """
    Extract data from a community survey form using Gemini Vision.
    """
    prompt = """
    Extract all data from this community survey form.
        Return the same canonical report fields used for voice reports, but leave
        voice-only fields as null if they cannot be inferred from the image.
    Return ONLY valid JSON with NO markdown fences:
    {
            "sourceType": "scan",
      "needType": "str",
      "severity": "low" | "medium" | "high" | "critical",
      "familiesAffected": int,
      "location": "str",
      "landmark": "str",
      "additionalNotes": "str",
      "safetySignals": ["str"],
      "confidence": int(0-100),
      "fieldConfidences": {
        "needType": int,
        "severity": int,
        "families": int
            },
            "transcript": null,
            "transcriptEnglish": null,
            "imageUrl": null,
            "voiceUrl": null
    }
    """
    
    try:
        response = client.models.generate_content(
            model=GEMINI_PRO,
            contents=[
                prompt,
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            ]
        )
        
        text = response.text.strip()
        # Remove potential markdown fences
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        result = json.loads(text)
        result.setdefault("sourceType", "scan")
        result.setdefault("transcript", None)
        result.setdefault("transcriptEnglish", None)
        result.setdefault("imageUrl", None)
        result.setdefault("voiceUrl", None)
        result.setdefault("landmark", None)
        result.setdefault("additionalNotes", None)
        result.setdefault("fieldConfidences", {"needType": 0, "severity": 0, "families": 0})
        return result
    except Exception as e:
        logger.error(f"Error in process_scan: {e}")
        raise ValueError(f"Failed to process image scan: {str(e)}")
