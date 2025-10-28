#!/usr/bin/env python3
"""Run a multi-scene showcase cycle for the desktop client.

Each scene updates the iframe layout to produce a dynamic lightwave effect
(1->2->4->8 center stages) with nested desktop2 and progressive dot grids."""

from __future__ import annotations

import argparse
import json
import sys
import time
import itertools
import urllib.error
import urllib.request
from typing import Sequence

DEFAULT_API_BASE = "http://localhost:8000"
DESKTOP_CLIENT = "desktop"
DEFAULT_NESTED_CLIENT = "desktop2"

# --- helpers ---------------------------------------------------------------

def put_iframe_config(api_base: str, payload: dict) -> None:
    url = api_base.rstrip("/") + "/api/iframe-config"
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    try:
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8")
            label = payload.get("label")
            print(f"[{time.strftime('%H:%M:%S')}] Applied {label or 'layout'} (status {response.status})")
            if label:
                print(body)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        print(f"HTTP error: {exc.code} {exc.reason}\n{detail}", file=sys.stderr)
        raise SystemExit(1)
    except urllib.error.URLError as exc:
        print(f"Failed to reach backend: {exc.reason}", file=sys.stderr)
        raise SystemExit(1)


def sound_play(api_base: str, filename: str, target_client: str | None = None) -> None:
    url = api_base.rstrip("/") + "/api/sound-play"
    body = {"filename": filename}
    if target_client:
        body["target_client_id"] = target_client
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        urllib.request.urlopen(req).read()
    except Exception as exc:  # noqa: BLE001
        print(f"Warning: sound_play failed: {exc}", file=sys.stderr)


def hero_panel(image: str, *, col: int, row: int, slide_source: str | None = None, continuous: bool = False) -> dict:
    params: dict[str, str] = {}
    if slide_source:
        params |= {"slide_mode": "true", "slide_source": slide_source}
    if continuous:
        params["continuous"] = "true"
    return {
        "image": image,
        "params": params,
        "ratio": 1.0,
        "col_span": col,
        "row_span": row,
    }


def nested_panel(client_id: str, *, col: int, row: int, label: str | None = None) -> dict:
    url = f"/?iframe_mode=true&client={client_id}"
    panel: dict[str, object] = {
        "url": url,
        "params": {},
        "ratio": 1.0,
        "col_span": col,
        "row_span": row,
    }
    if label:
        panel["label"] = label
    panel["src"] = url
    return panel


def static_panel(image: str, *, col: int, row: int) -> dict:
    return {
        "image": image,
        "params": {},
        "ratio": 1.0,
        "col_span": col,
        "row_span": row,
    }


def dot_grid(*, images: Sequence[str], columns: int, rows: int, step: int, continuous: bool = False, offset: int = 0) -> list[dict]:
    panels: list[dict] = []
    image_cycle = itertools.cycle(images)
    sources = ["kinship", "archive", "macrocosm", "fieldnotes", "ancestry", "diagram"]
    source_cycle = itertools.cycle(sources[offset:] + sources[:offset])
    for _row in range(rows):
        for _col in range(columns):
            params = {
                "slide_mode": "true",
                "slide_source": next(source_cycle),
                "autoplay": "1",
                "step": str(step),
            }
            if continuous:
                params["continuous"] = "true"
            panels.append(
                {
                    "image": next(image_cycle),
                    "params": params,
                    "ratio": 1.0,
                    "col_span": 1,
                    "row_span": 1,
                }
            )
    return panels


def medium_tiles(*, images: Sequence[str], count: int, col: int, row: int) -> list[dict]:
    panels: list[dict] = []
    image_cycle = itertools.cycle(images)
    source_cycle = itertools.cycle(["kinship", "macrocosm", "archive", "ancestry"])
    for _ in range(count):
        panels.append(
            {
                "image": next(image_cycle),
                "params": {
                    "slide_mode": "true",
                    "slide_source": next(source_cycle),
                    "continuous": "true",
                },
                "ratio": 1.0,
                "col_span": col,
                "row_span": row,
            }
        )
    return panels


def organic_incubator_band(*, images: Sequence[str], count: int) -> list[dict]:
    panels: list[dict] = []
    image_cycle = itertools.cycle(images)
    for idx in range(count):
        if idx % 3 == 0:
            params = {"organic_mode": "true"}
            row = 3
        elif idx % 3 == 1:
            params = {"incubator": "true"}
            row = 3
        else:
            params = {"slide_mode": "true", "slide_source": "ancestry", "continuous": "true"}
            row = 2
        panels.append(
            {
                "image": next(image_cycle),
                "params": params,
                "ratio": 1.0,
                "col_span": 2,
                "row_span": row,
            }
        )
    return panels

# --- scenes ---------------------------------------------------------------

IMAGES_DOTS = [
    "offspring_20250923_161624_066.png",
    "offspring_20250923_161704_451.png",
    "offspring_20250923_161747_194.png",
    "offspring_20250923_162135_155.png",
    "offspring_20250923_162223_271.png",
    "offspring_20250923_162258_533.png",
    "offspring_20250923_162512_773.png",
    "offspring_20250923_162600_328.png",
    "offspring_20251006_191451_449.png",
    "offspring_20251004_221320_255.png",
]

def build_scene_a(nested_client: str) -> dict:
    panels = [
        hero_panel("offspring_20250923_161624_066.png", col=4, row=5, slide_source="kinship", continuous=True),
        nested_panel(nested_client, col=4, row=6, label="Desktop2"),
        static_panel("offspring_20251006_202714_956.png", col=4, row=4),
    ]
    panels += dot_grid(images=["offspring_20251006_191451_449.png"], columns=12, rows=4, step=60, continuous=True)
    for idx, panel in enumerate(panels, start=1):
        panel["id"] = f"p{idx}"
    return {"layout": "grid", "columns": 12, "gap": 10, "panels": panels}


def build_scene_b(nested_client: str) -> dict:
    panels = [
        hero_panel("offspring_20250923_161624_066.png", col=5, row=5, slide_source="kinship", continuous=True),
        hero_panel("offspring_20251005_144934_368.png", col=5, row=5, slide_source="macrocosm", continuous=True),
        nested_panel(nested_client, col=4, row=5, label="Desktop2"),
        static_panel("offspring_20251006_202714_956.png", col=3, row=4),
    ]
    panels += dot_grid(images=IMAGES_DOTS, columns=16, rows=3, step=40, continuous=True)
    panels += medium_tiles(images=IMAGES_DOTS, count=12, col=2, row=2)
    for idx, panel in enumerate(panels, start=1):
        panel["id"] = f"p{idx}"
    return {"layout": "grid", "columns": 16, "gap": 8, "panels": panels}


def build_scene_c(nested_client: str) -> dict:
    panels = [
        hero_panel("offspring_20250923_161624_066.png", col=4, row=4, slide_source="kinship", continuous=True),
        hero_panel("offspring_20250923_170931_161.png", col=4, row=4, slide_source="ancestry", continuous=True),
        hero_panel("offspring_20250923_170859_729.png", col=4, row=4, slide_source="macrocosm", continuous=True),
        hero_panel("offspring_20250923_163230_415.png", col=4, row=4, slide_source="archive", continuous=True),
        nested_panel(nested_client, col=4, row=4, label="Desktop2"),
    ]
    panels += dot_grid(images=IMAGES_DOTS, columns=20, rows=4, step=25, continuous=True)
    panels += medium_tiles(images=IMAGES_DOTS, count=16, col=2, row=2)
    panels += organic_incubator_band(images=IMAGES_DOTS, count=10)
    for idx, panel in enumerate(panels, start=1):
        panel["id"] = f"p{idx}"
    return {"layout": "grid", "columns": 20, "gap": 6, "panels": panels}


def build_scene_d(nested_client: str) -> dict:
    heroes = [
        hero_panel("offspring_20250923_161624_066.png", col=5, row=5, slide_source="kinship", continuous=True),
        hero_panel("offspring_20250923_161747_194.png", col=4, row=5, slide_source="archive", continuous=True),
        hero_panel("offspring_20250923_162258_533.png", col=4, row=5, slide_source="macrocosm", continuous=True),
        hero_panel("offspring_20251006_202714_956.png", col=4, row=4, slide_source="ancestry", continuous=True),
    ]
    nested = nested_panel(nested_client, col=6, row=6, label="Desktop2")
    dots = dot_grid(images=IMAGES_DOTS, columns=24, rows=5, step=15, continuous=True)
    mids = medium_tiles(images=IMAGES_DOTS, count=30, col=2, row=2)
    lower = organic_incubator_band(images=IMAGES_DOTS, count=18)
    sound = {
        "id": "sound_player",
        "url": "/?img=offspring_20250923_162600_328.png&sound_player=true&client=desktop",
        "params": {},
        "ratio": 1.0,
        "col_span": 3,
        "row_span": 2,
        "label": "Sound Player",
    }
    panels = heroes + [nested, sound] + dots + mids + lower
    for idx, panel in enumerate(panels, start=1):
        panel["id"] = f"p{idx}"
    return {"layout": "grid", "columns": 24, "gap": 5, "panels": panels}


def build_scene_e(nested_client: str) -> dict:
    panels = [
        hero_panel("offspring_20250923_161624_066.png", col=5, row=5, slide_source="kinship", continuous=True),
        nested_panel(nested_client, col=6, row=5, label="Desktop2"),
        hero_panel("offspring_20251005_144934_368.png", col=5, row=5, slide_source="macrocosm", continuous=True),
        static_panel("offspring_20251006_202714_956.png", col=4, row=4),
    ]
    panels += dot_grid(images=IMAGES_DOTS, columns=18, rows=3, step=30, continuous=True)
    panels += medium_tiles(images=IMAGES_DOTS, count=12, col=2, row=2)
    panels += organic_incubator_band(images=IMAGES_DOTS, count=12)
    for idx, panel in enumerate(panels, start=1):
        panel["id"] = f"p{idx}"
    return {"layout": "grid", "columns": 18, "gap": 6, "panels": panels}

# --- runner ---------------------------------------------------------------

def run_cycle(api_base: str, nested_client: str, loop: bool) -> None:
    scenes = [
        {"label": "Scene A", "duration": 60, "builder": build_scene_a},
        {"label": "Scene B", "duration": 90, "builder": build_scene_b},
        {"label": "Scene C", "duration": 90, "builder": build_scene_c},
        {"label": "Scene D", "duration": 60, "builder": build_scene_d},
        {"label": "Scene E", "duration": 60, "builder": build_scene_e},
    ]
    while True:
        for scene in scenes:
            payload = scene["builder"](nested_client)
            payload["target_client_id"] = DESKTOP_CLIENT
            payload["label"] = scene["label"]
            put_iframe_config(api_base, payload)

            if scene["label"] == "Scene A":
                sound_play(api_base, "low_drone.mp3", DESKTOP_CLIENT)
            elif scene["label"] == "Scene C":
                sound_play(api_base, "pulse_rise.mp3", DESKTOP_CLIENT)

            time.sleep(scene["duration"])
        if not loop:
            break


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run desktop showcase scene cycle")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--nested-client", default=DEFAULT_NESTED_CLIENT)
    parser.add_argument("--loop", action="store_true", help="Loop forever until interrupted")
    args = parser.parse_args()

    run_cycle(args.api_base, args.nested_client, loop=args.loop)
