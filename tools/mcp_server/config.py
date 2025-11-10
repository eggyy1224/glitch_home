from __future__ import annotations

import os


def api_base() -> str:
    return os.getenv("API_BASE", "http://localhost:8000").rstrip("/")


def http_timeout_seconds() -> float:
    try:
        return float(os.getenv("HTTP_TIMEOUT_SECONDS", "15"))
    except Exception:
        return 15.0

