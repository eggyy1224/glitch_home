"""API routers for feature modules."""

from .admin import router as admin_router
from .display import router as display_router
from .media import router as media_router
from .realtime import router as realtime_router
from .storage import router as storage_router

__all__ = [
    "admin_router",
    "display_router",
    "media_router",
    "realtime_router",
    "storage_router",
]
