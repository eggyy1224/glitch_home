"""API routers for feature modules."""

from .media import router as media_router
from .realtime import router as realtime_router
from .storage import router as storage_router

__all__ = [
    "media_router",
    "realtime_router",
    "storage_router",
]
