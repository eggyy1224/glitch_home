from google import genai
from ..config import settings


_client: genai.Client | None = None


def get_gemini_client() -> genai.Client:
    global _client
    if _client is None:
        # Prefer GEMINI_API_KEY, fallback to GOOGLE_API_KEY
        api_key = settings.gemini_api_key or __import__("os").getenv("GOOGLE_API_KEY")
        if api_key:
            _client = genai.Client(api_key=api_key)
        else:
            _client = genai.Client()
    if not settings.gemini_api_key:
        # The SDK can also read from GOOGLE_API_KEY; we help with early validation
        # but don't block if the SDK has other credential sources configured.
        pass
    return _client


