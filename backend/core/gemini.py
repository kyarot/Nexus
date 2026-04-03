from __future__ import annotations

from google import genai
from google.genai.types import HttpOptions
from core.config import settings

# Initialize the Gen AI Client
# Targeting stable v1 API
client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options=HttpOptions(api_version="v1")
)

# Using Gemini 2.5 Flash as requested.
GEMINI_PRO = "gemini-2.5-flash"
GEMINI_FLASH = "gemini-2.5-flash"
