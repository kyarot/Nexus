from __future__ import annotations

from google import genai
from google.genai.types import HttpOptions
from core.config import settings

# Initialize the Gen AI Client
client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options=HttpOptions(api_version=str(settings.GEMINI_API_VERSION or "v1beta"))
)

GEMINI_PRO = str(settings.GEMINI_PRO_MODEL or "gemini-2.5-flash-lite")
GEMINI_FLASH = str(settings.GEMINI_FLASH_MODEL or "gemini-2.5-flash-lite")
GEMINI_VISION = str(settings.GEMINI_VISION_MODEL or "gemini-2.5-flash-lite")
