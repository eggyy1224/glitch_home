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
    realtime_router,
    screenshot_router,
    sound_router,
    storage_router,
)
from .config import settings

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

app.include_router(storage_router)
app.include_router(generation_router)
app.include_router(indexing_router)
app.include_router(sound_router)
app.include_router(screenshot_router)
app.include_router(kinship_router)
app.include_router(collage_router)
app.include_router(realtime_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
