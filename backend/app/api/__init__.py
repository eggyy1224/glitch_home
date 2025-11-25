"""API routers for feature modules."""

from .clients import router as clients_router
from .collage import router as collage_router
from .generation import router as generation_router
from .indexing import router as indexing_router
from .kinship import router as kinship_router
from .episode import router as episode_router
from .realtime import router as realtime_router
from .screenshot import router as screenshot_router
from .sound import router as sound_router
from .storage import router as storage_router
from .timeline import router as timeline_router

__all__ = [
    "clients_router",
    "collage_router",
    "generation_router",
    "indexing_router",
    "kinship_router",
    "episode_router",
    "realtime_router",
    "screenshot_router",
    "sound_router",
    "storage_router",
    "timeline_router",
]
