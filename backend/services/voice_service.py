from __future__ import annotations

import json
import logging
from google.genai import types
from core.gemini import client, GEMINI_PRO

logger = logging.getLogger(__name__)

async def process_voice(audio_bytes: bytes, language: str = 'en', prompt: str = None) -> dict:
    """
    Transcribe and extract data from a community voice report using Gemini.
    """
    if not prompt:
        prompt = f"""
        Transcribe this voice report. Language hint: {language}.
        Then extract community needs data.
                Return the same canonical report fields used for scan reports.
        Return ONLY valid JSON with NO markdown fences:
        {{
                    "sourceType": "voice",
          "transcript": "str",
          "transcriptEnglish": "str",
          "needType": "str",
          "severity": "str",
          "familiesAffected": int,
          "location": "str",
                    "landmark": "str",
                    "additionalNotes": "str",
          "safetySignals": ["str"],
                    "confidence": int(0-100),
                    "fieldConfidences": {{
                        "needType": int,
                        "severity": int,
                        "families": int
                    }},
                    "imageUrl": null,
                    "voiceUrl": null
        }}
        """
    
    try:
        response = client.models.generate_content(
            model=GEMINI_PRO,
            contents=[
                prompt,
                types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav")
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
        result.setdefault("sourceType", "voice")
        result.setdefault("landmark", None)
        result.setdefault("additionalNotes", None)
        result.setdefault("imageUrl", None)
        result.setdefault("voiceUrl", None)
        result.setdefault("fieldConfidences", {"needType": 0, "severity": 0, "families": 0})
        return result
    except Exception as e:
        logger.error(f"Error in process_voice: {e}")
        raise ValueError(f"Failed to process voice report: {str(e)}")
