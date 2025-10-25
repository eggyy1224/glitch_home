#!/usr/bin/env python3
"""Apply a dense 25×25 grid layout without any span overrides.

Every panel occupies exactly one grid cell; use this for uniform collage walls
or analytic views where consistency matters more than hierarchy.

Example:
    python backend/playback_scripts/set_uniform_grid_25x25_layout.py \
        --api-base http://localhost:8000 \
        --client desktop2

You can customize the total panel count and override the image pool via CLI
flags. When overriding images, the script loops through the list until it fills
the requested number of panels.
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
DEFAULT_CLIENT_ID = "desktop2"
DEFAULT_COLUMNS = 25
DEFAULT_GAP = 6
DEFAULT_PANELS = 225  # 25 × 9 rows; adjust with --panels

# Stable offspring filenames to avoid missing file errors. Repeat as needed.
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

SLIDE_SOURCES = [
    "kinship",
    "archive",
    "macrocosm",
    "fieldnotes",
    "ancestry",
    "diagram",
]


def resolve_images(overrides: Sequence[str] | None, count: int) -> list[str]:
    pool = list(overrides) if overrides else BASE_IMAGES
    if not pool:
        raise ValueError("No images available to populate the grid")
    repeated = []
    it = cycle(pool)
    for _ in range(count):
        repeated.append(next(it))
    return repeated


def build_panels(images: Sequence[str]) -> list[dict]:
    source_cycle = cycle(SLIDE_SOURCES)
    panels: list[dict] = []
    for idx, image in enumerate(images):
        panels.append(
            {
                "id": f"p{idx + 1}",
                "image": image,
                "params": {
                    "slide_mode": "true",
                    "slide_source": next(source_cycle),
                },
                "ratio": 1.0,
            }
        )
    return panels


def build_payload(images: Sequence[str], client_id: str, gap: int) -> dict:
    panels = build_panels(images)
    payload: dict = {
        "layout": "grid",
        "gap": gap,
        "columns": DEFAULT_COLUMNS,
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
    parser.add_argument(
        "--api-base",
        default=DEFAULT_API_BASE,
        help="Backend API base URL (default: %(default)s)",
    )
    parser.add_argument(
        "--client",
        default=DEFAULT_CLIENT_ID,
        help="Target client ID (default: %(default)s)",
    )
    parser.add_argument(
        "--panels",
        type=int,
        default=DEFAULT_PANELS,
        help="Total number of panels (default: %(default)s)",
    )
    parser.add_argument(
        "--gap",
        type=int,
        default=DEFAULT_GAP,
        help="Gap size in pixels (default: %(default)s)",
    )
    parser.add_argument(
        "--image",
        action="append",
        dest="images",
        help="Override base images; provide multiple times to expand the pool",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    if args.panels <= 0:
        raise SystemExit("--panels 必須大於 0")
    if args.gap < 0:
        raise SystemExit("--gap 不可為負值")

    images = resolve_images(args.images, args.panels)
    payload = build_payload(images, args.client, args.gap)
    put_iframe_config(args.api_base, payload)


if __name__ == "__main__":
    main()

