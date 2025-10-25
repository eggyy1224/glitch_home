#!/usr/bin/env python3
"""Configure the desktop client with a wide 18-column hero collage.

Features:
  * 18-column grid, gap 10
  * Core collage built from the 20250923 offspring series (slide mode enabled)
  * Two large static hero tiles flanking a nested Desktop2 iframe window
  * Desktop2 is expected to run the incubator scene, giving a live window-in-window effect

Usage:
    python backend/playback_scripts/set_desktop_nested_hero_layout.py \
        --api-base http://localhost:8000 \
        --client desktop

You can override the base images or adjust columns/gap via CLI flags.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from itertools import cycle
from typing import Sequence

DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "desktop"
DEFAULT_COLUMNS = 18
DEFAULT_GAP = 10

# Base collage tiles (preserve ordering for nice visual flow)
SLIDE_IMAGES = [
    "offspring_20250923_161624_066.png",
    "offspring_20250923_161704_451.png",
    "offspring_20250923_161747_194.png",
    "offspring_20250923_161828_524.png",
    "offspring_20250923_162135_155.png",
    "offspring_20250923_162223_271.png",
    "offspring_20250923_162258_533.png",
    "offspring_20250923_162512_773.png",
    "offspring_20250923_162600_328.png",
    "offspring_20250923_163230_415.png",
    "offspring_20250923_163256_169.png",
    "offspring_20250923_170818_939.png",
    "offspring_20250923_170859_729.png",
    "offspring_20250923_170931_161.png",
    "offspring_20250923_171042_144.png",
    "offspring_20250923_171114_325.png",
]

SLIDE_SOURCES = [
    "kinship",
    "kinship",
    "archive",
    "fieldnotes",
    "macrocosm",
    "kinship",
    "ancestry",
    "diagram",
    "kinship",
    "archive",
    "fieldnotes",
    "macrocosm",
    "kinship",
    "ancestry",
    "diagram",
    "kinship",
]

# Hero tiles (no special params)
STATIC_HERO_LEFT = "offspring_20251006_202714_956.png"
STATIC_HERO_RIGHT = "offspring_20251005_144934_368.png"


def resolve_slide_images(overrides: Sequence[str] | None) -> list[str]:
    base = list(overrides) if overrides else SLIDE_IMAGES
    if not base:
        raise ValueError("No slide images provided")
    return base


def build_slide_panels(images: Sequence[str]) -> list[dict]:
    source_cycle = cycle(SLIDE_SOURCES)
    panels: list[dict] = []
    # Predefined span pattern copied from the live configuration
    span_pattern = cycle(
        [
            (4, 3),  # large hero
            (2, 2),
            (3, 2),
            (0, 2),  # 0 indicates default span -> omit
            (2, 0),
            (0, 3),
            (3, 3),
            (0, 2),
            (2, 2),
            (2, 0),
            (0, 2),
            (3, 0),
            (0, 3),
            (2, 2),
            (2, 0),
            (0, 2),
        ]
    )

    for idx, image in enumerate(images, start=1):
        col_span, row_span = next(span_pattern)
        panel: dict = {
            "id": f"p{idx}",
            "image": image,
            "params": {
                "slide_mode": "true",
                "slide_source": next(source_cycle),
            },
            "ratio": 1.0,
        }
        if col_span:
            panel["col_span"] = col_span
        if row_span:
            panel["row_span"] = row_span
        panels.append(panel)
    return panels


def insert_hero_panels(panels: list[dict], nested_client: str) -> list[dict]:
    # Insert around the middle
    midpoint = len(panels) // 2
    left_panel = {
        "id": f"p{midpoint + 1}",
        "image": STATIC_HERO_LEFT,
        "params": {},
        "ratio": 1.0,
        "col_span": 6,
        "row_span": 5,
    }
    nested_panel = {
        "id": f"p{midpoint + 2}",
        "url": f"/?iframe_mode=true&client={nested_client}",
        "params": {},
        "ratio": 1.0,
        "col_span": 8,
        "row_span": 7,
        "label": nested_client.capitalize(),
    }
    right_panel = {
        "id": f"p{midpoint + 3}",
        "image": STATIC_HERO_RIGHT,
        "params": {},
        "ratio": 1.0,
        "col_span": 6,
        "row_span": 5,
    }

    new_panels = panels[:midpoint] + [left_panel, nested_panel, right_panel] + panels[midpoint:]
    # Reassign ids sequentially
    for idx, panel in enumerate(new_panels, start=1):
        panel["id"] = f"p{idx}"
    return new_panels


def build_payload(client_id: str, nested_client: str, images: Sequence[str], gap: int, columns: int) -> dict:
    slide_panels = build_slide_panels(images)
    panels = insert_hero_panels(slide_panels, nested_client)
    payload: dict = {
        "layout": "grid",
        "gap": gap,
        "columns": columns,
        "panels": panels,
    }
    if client_id:
        payload["target_client_id"] = client_id
    return payload


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
            print(f"Applied iframe config (status {response.status}):")
            print(body)
    except urllib.error.HTTPError as exc:
        print(f"HTTP error: {exc.code} {exc.reason}", file=sys.stderr)
        detail = exc.read().decode("utf-8", errors="ignore")
        if detail:
            print(detail, file=sys.stderr)
        raise SystemExit(1)
    except urllib.error.URLError as exc:
        print(f"Failed to reach {url}: {exc.reason}", file=sys.stderr)
        raise SystemExit(1)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Backend API base URL (default: %(default)s)")
    parser.add_argument("--client", default=DEFAULT_CLIENT_ID, help="Target client ID (default: %(default)s)")
    parser.add_argument("--nested-client", default="desktop2", help="Client ID to embed via iframe (default: desktop2)")
    parser.add_argument("--gap", type=int, default=DEFAULT_GAP, help="Grid gap in pixels (default: %(default)s)")
    parser.add_argument("--columns", type=int, default=DEFAULT_COLUMNS, help="Number of columns (default: %(default)s)")
    parser.add_argument("--slide-image", action="append", dest="slide_images", help="Override slide images (append)")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    if args.columns <= 0:
        raise SystemExit("--columns 必須大於 0")
    if args.gap < 0:
        raise SystemExit("--gap 不可為負值")

    images = resolve_slide_images(args.slide_images)
    payload = build_payload(args.client, args.nested_client, images, args.gap, args.columns)
    put_iframe_config(args.api_base, payload)


if __name__ == "__main__":
    main()

