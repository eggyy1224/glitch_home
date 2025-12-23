from __future__ import annotations

import logging
from pathlib import Path
from datetime import datetime, timezone

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
    schedule_router,
)
from .config import settings
from .utils.permissions import runtime_capabilities
from .services.client_queue import client_queue_manager
from .services.schedule import list_schedule_definitions, load_schedule_definition, plan_schedule_deploy

logger = logging.getLogger(__name__)
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
app.include_router(schedule_router)


@app.on_event("startup")
async def seed_daily_schedules() -> None:
    try:
        schedules = list_schedule_definitions()
        if not schedules:
            return
        now = datetime.now(timezone.utc)
        for entry in schedules:
            if entry.get("status") != "active":
                continue
            schedule_id = entry.get("id")
            if not schedule_id:
                continue
            schedule = load_schedule_definition(schedule_id)
            specs, skipped = plan_schedule_deploy(schedule, now=now, stagger_seconds=2.0)
            if skipped:
                logger.info("Schedule %s skipped %s entries on startup", schedule_id, len(skipped))
            for spec in specs:
                await client_queue_manager.enqueue(
                    client_id=spec.client_id,
                    item_type=spec.item_type,
                    target_id=spec.target_id,
                    eta=spec.eta,
                    priority=None,
                    retries=0,
                    payload=spec.payload,
                )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Schedule seed failed: %s", exc)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "app_mode": settings.app_mode}


@app.get("/api/runtime-caps")
def api_runtime_caps() -> dict:
    caps = runtime_capabilities()
    return {"status": "ok", **caps}
