from google import genai
from ..config import settings


_client: genai.Client | None = None


def get_gemini_client() -> genai.Client:
    global _client
    if _client is None:
        # Prefer GEMINI_API_KEY, fallback to GOOGLE_API_KEY
        api_key = settings.gemini_api_key or __import__("os").getenv("GOOGLE_API_KEY")
        client_kwargs = {}
        # Optional Vertex AI route (ADC required). When enabled, we ignore api_key.
        if settings.genai_use_vertex:
            if settings.vertex_project and settings.vertex_location:
                client_kwargs.update(
                    dict(vertexai=True, project=settings.vertex_project, location=settings.vertex_location)
                )
            else:
                # If project/location missing, still try vertexai=True and let SDK error explicitly
                client_kwargs.update(dict(vertexai=True))
        if api_key and not settings.genai_use_vertex:
            client_kwargs["api_key"] = api_key
        _client = genai.Client(**client_kwargs)
    return _client

