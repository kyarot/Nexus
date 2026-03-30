from __future__ import annotations

import google.generativeai as genai

from core.config import settings


genai.configure(api_key=settings.GEMINI_API_KEY)

gemini_pro = genai.GenerativeModel("gemini-1.5-pro")
gemini_flash = genai.GenerativeModel("gemini-1.5-flash")
