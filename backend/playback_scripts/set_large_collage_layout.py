#!/usr/bin/env python3
"""Configure a desktop client with a sparse 30-column collage featuring bold spans.

This script targets large-format displays where a handful of dominant panels
should occupy significant screen real-estate while smaller tiles fill the gaps.

By default it sends the payload to client `desktop2`, but you can point it at
any registered iframe client.

Example:
    python backend/playback_scripts/set_large_collage_layout.py \
        --api-base http://localhost:8000 \
        --client desktop2

Override imagery:
    python backend/playback_scripts/set_large_collage_layout.py \
        --api-base http://localhost:8000 \
        --client desktop2 \
        --image offspring_20251006_202714_956.png \
        --image offspring_20251006_191644_532.png
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from itertools import cycle
from typing import Iterable, Sequence

DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "desktop2"
DEFAULT_COLUMNS = 30
DEFAULT_GAP = 10

# Curated set of reliable offspring filenames. The list is repeated as needed.
BASE_IMAGES = [
    "offspring_20251006_202714_956.png",
    "offspring_20251008_191824_966.png",
    "offspring_20250924_191135_325.png",
    "offspring_20251006_192152_401.png",
    "offspring_20250925_141803_803.png",
    "offspring_20251006_191644_532.png",
    "offspring_20251008_193042_321.png",
    "offspring_20251012_183757_386.png",
    "offspring_20250924_145030_681.png",
    "offspring_20250927_144919_645.png",
    "offspring_20251005_144934_368.png",
    "offspring_20251004_224929_107.png",
    "offspring_20251012_181715_584.png",
    "offspring_20251005_143953_981.png",
    "offspring_20251001_193728_640.png",
    "offspring_20251004_221320_255.png",
]

# Slide sources rotate to keep the wall visually diverse.
SLIDE_SOURCES = [
    "kinship",
    "archive",
    "macrocosm",
    "fieldnotes",
    "ancestry",
    "diagram",
]

# Three span tiers: large hero tiles, medium accents, and small fillers.
HERO_SPANS = [
    (24, 18),
    (22, 16),
    (20, 15),
    (26, 18),
    (18, 14),
    (24, 17),
]

MEDIUM_SPANS = [
    (14, 10),
    (12, 9),
    (15, 11),
    (13, 9),
    (12, 10),
    (16, 12),
]

SMALL_SPANS = [
    (8, 6),
    (9, 5),
    (7, 6),
    (10, 7),
    (8, 5),
    (9, 6),
]


def cycle_list(items: Sequence[str], length: int) -> list[str]:
    """Repeat items until we have `length` entries."""
    if not items:
        raise ValueError("No images provided for layout generation")
    factor = (length + len(items) - 1) // len(items)
    tiled = list(items) * max(1, factor)
    return tiled[:length]


def build_panels(images: Sequence[str]) -> list[dict]:
    """Construct the panel payload with varying spans."""
    src_cycle = cycle(SLIDE_SOURCES)
    hero_cycle = cycle(HERO_SPANS)
    medium_cycle = cycle(MEDIUM_SPANS)
    small_cycle = cycle(SMALL_SPANS)

    panels: list[dict] = []
    for idx, image in enumerate(images):
        panel: dict = {
            "id": f"p{idx + 1}",
            "ratio": 1.0,
        }

        # Every 6th tile becomes an embedded URL variant to introduce motion/textures
        if (idx + 1) % 6 == 0:
            fallback_image = images[(idx * 3 + 5) % len(images)]
            panel["url"] = f"/?img={fallback_image}&slide_mode=true&slide_source=macrocosm"
            panel["params"] = {}
        else:
            panel["image"] = image
            panel["params"] = {
                "slide_mode": "true",
                "slide_source": next(src_cycle),
            }

        if idx % 3 == 0:
            span = next(hero_cycle)
        elif idx % 3 == 1:
            span = next(medium_cycle)
        else:
            span = next(small_cycle)

        col_span = min(span[0], DEFAULT_COLUMNS)
        row_span = span[1]

        panel["col_span"] = col_span
        panel["row_span"] = row_span
        panels.append(panel)

    return panels


def build_payload(images: Iterable[str], client_id: str) -> dict:
    images_list = list(images)
    panels = build_panels(images_list)
    payload: dict = {
        "layout": "grid",
        "gap": DEFAULT_GAP,
        "columns": DEFAULT_COLUMNS,
        "panels": panels,
    }
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def post_iframe_config(api_base: str, payload: dict) -> None:
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
    parser.add_argument(
        "--api-base",
        default=DEFAULT_API_BASE,
        help="Backend API base URL (default: %(default)s)",
    )
    parser.add_argument(
        "--client",
        default=DEFAULT_CLIENT_ID,
        help="Target client ID to update (default: %(default)s)",
    )
    parser.add_argument(
        "--panels",
        type=int,
        default=48,
        help="Number of panels to generate (default: %(default)s)",
    )
    parser.add_argument(
        "--image",
        action="append",
        dest="images",
        help="Override base images (may repeat, provide multiple times)",
    )
    return parser.parse_args(argv)


def resolve_images(overrides: Sequence[str] | None, panel_count: int) -> list[str]:
    base = list(overrides) if overrides else BASE_IMAGES
    return cycle_list(base, panel_count)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    if args.panels <= 0:
        raise SystemExit("--panels 必須為正整數")

    images = resolve_images(args.images, args.panels)
    payload = build_payload(images, args.client)
    post_iframe_config(args.api_base, payload)


if __name__ == "__main__":
    main()

