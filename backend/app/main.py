from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import (
    collage_router,
    generation_router,
    indexing_router,
    kinship_router,
    episode_router,
    scene_router,
    script_router,
    realtime_router,
    screenshot_router,
    sound_router,
    storage_router,
    timeline_router,
    clients_router,
)
from .config import settings
from .utils.permissions import runtime_capabilities

app = FastAPI(title="Image Loop Synthesizer Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path(settings.generated_sounds_dir).mkdir(parents=True, exist_ok=True)

app.mount(
    "/generated_images",
    StaticFiles(directory=settings.offspring_dir),
    name="generated_images",
)

app.mount(
    "/generated_sounds",
    StaticFiles(directory=settings.generated_sounds_dir),
    name="generated_sounds",
)

if settings.nightwalk_assets_dir:
    nightwalk_path = Path(settings.nightwalk_assets_dir)
    app.mount(
        "/nightwalk_assets",
        StaticFiles(directory=nightwalk_path),
        name="nightwalk_assets",
    )

app.include_router(storage_router)
app.include_router(generation_router)
app.include_router(indexing_router)
app.include_router(sound_router)
app.include_router(screenshot_router)
app.include_router(kinship_router)
app.include_router(collage_router)
app.include_router(realtime_router)
app.include_router(episode_router)
app.include_router(scene_router)
app.include_router(script_router)
app.include_router(timeline_router)
app.include_router(clients_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "app_mode": settings.app_mode}


@app.get("/api/runtime-caps")
def api_runtime_caps() -> dict:
    caps = runtime_capabilities()
    return {"status": "ok", **caps}
