from __future__ import annotations

from html import unescape

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.translation import get_translate_client

PREFIX = "/public/translations"
TAGS = ["public"]
router = APIRouter()


class PublicBatchTranslatePayload(BaseModel):
    texts: list[str] = Field(default_factory=list)
    targetLanguage: str
    sourceLanguage: str | None = "en"


@router.post("/batch")
async def translate_public_batch(payload: PublicBatchTranslatePayload) -> dict[str, list[str]]:
    target = (payload.targetLanguage or "").strip().lower()
    if not target:
        raise HTTPException(status_code=400, detail="targetLanguage is required")

    if target == "en":
        return {"translations": payload.texts}

    if len(payload.texts) > 500:
        raise HTTPException(status_code=400, detail="Too many texts. Max 500 per request")

    unique_texts = list(dict.fromkeys(payload.texts))
    if not unique_texts:
        return {"translations": []}

    client = get_translate_client()
    translated = client.translate(
        values=unique_texts,
        target_language=target,
        source_language=(payload.sourceLanguage or "en").strip().lower(),
        format_="text",
    )

    if isinstance(translated, dict):
        translated = [translated]

    translated_map: dict[str, str] = {}
    for source, result in zip(unique_texts, translated):
        translated_map[source] = unescape(result.get("translatedText") or source)

    return {
        "translations": [translated_map.get(text, text) for text in payload.texts],
    }
