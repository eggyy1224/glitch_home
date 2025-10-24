#!/usr/bin/env python3
"""Configure desktop, desktop2, and mobile clients with showcase layouts.

Layouts applied:
  - desktop  : split view, Slide Mode vs incubator (same image both sides)
  - desktop2 : 15x15 dense collage with large panels interleaved among small ones
  - mobile   : single static image (no extra params)

Usage:
    python3 backend/playback_scripts/set_showcase_triple_layout.py \
        --api-base http://localhost:8000 \
        --desktop desktop \
        --desktop2 desktop2 \
        --mobile mobile

Options:
    --seed <int>   Use deterministic random sampling
    --dry-run      Print payloads instead of sending them
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path
from typing import Iterable, Sequence
import urllib.error
import urllib.request

DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_DESKTOP = "desktop"
DEFAULT_DESKTOP2 = "desktop2"
DEFAULT_MOBILE = "mobile"
DEFAULT_MAIN_IMAGE = "offspring_20250923_161624_066.png"
DEFAULT_MOBILE_IMAGE = "offspring_20250923_161624_066.png"
OFFSPRING_DIR = Path("backend/offspring_images")

SLIDE_SOURCES = [
    "kinship",
    "archive",
    "macrocosm",
    "fieldnotes",
    "ancestry",
    "diagram",
]


def load_images(limit: int | None = None) -> list[str]:
    if not OFFSPRING_DIR.exists():
        raise SystemExit(f"Image directory not found: {OFFSPRING_DIR}")
    imgs = sorted(p.name for p in OFFSPRING_DIR.glob("*.png"))
    if not imgs:
        raise SystemExit(f"No PNG images found in {OFFSPRING_DIR}")
    if limit is not None:
        return imgs[:limit]
    return imgs


def cycle_sources(count: int) -> list[str]:
    sources = []
    pool = SLIDE_SOURCES or ["kinship"]
    for idx in range(count):
        sources.append(pool[idx % len(pool)])
    return sources


def build_mobile_payload(images: Sequence[str], gap: int, client: str) -> dict:
    image = DEFAULT_MOBILE_IMAGE if DEFAULT_MOBILE_IMAGE in images else images[0]
    panels = [
        {
            "id": "p1",
            "image": image,
            "params": {},
        }
    ]
    payload = {
        "layout": "grid",
        "columns": 1,
        "gap": 0,
        "panels": panels,
        "target_client_id": client,
    }
    return payload


def build_desktop_payload(image: str, client: str) -> dict:
    return {
        "layout": "grid",
        "columns": 2,
        "gap": 16,
        "panels": [
            {
                "id": "p1",
                "image": image,
                "params": {"slide_mode": "true", "slide_source": "kinship"},
            },
            {
                "id": "p2",
                "image": image,
                "params": {"incubator": "true"},
            },
        ],
        "target_client_id": client,
    }


def build_desktop2_payload(images: Sequence[str], client: str) -> dict:
    columns = 15
    rows = 15
    total = columns * rows
    if len(images) < total:
        raise SystemExit(f"Need at least {total} images for desktop2 layout, found {len(images)}")

    chosen = random.sample(images, total)
    large_count = 24
    medium_prob = 0.22
    max_large_col = 5
    max_large_row = 4

    large_indices = set(random.sample(range(total), large_count))
    panels: list[dict] = []
    for idx, image in enumerate(chosen, start=1):
        panel = {
            "id": f"p{idx}",
            "image": image,
            "params": {"slide_mode": "true", "slide_source": "kinship"},
        }
        if idx - 1 in large_indices:
            panel["col_span"] = random.randint(3, max_large_col)
            panel["row_span"] = random.randint(3, max_large_row)
        else:
            if random.random() < medium_prob:
                panel["col_span"] = random.randint(2, 3)
            if random.random() < medium_prob:
                panel["row_span"] = random.randint(2, 3)
        panels.append(panel)

    payload = {
        "layout": "grid",
        "columns": columns,
        "gap": 6,
        "panels": panels,
        "target_client_id": client,
    }
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
    with urllib.request.urlopen(request) as response:
        body = response.read().decode("utf-8")
        print(f"[{payload.get('target_client_id')}] Applied iframe config (status {response.status})")
        if body and body.strip():
            print(body)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Backend API base URL")
    parser.add_argument("--desktop", default=DEFAULT_DESKTOP, help="Client ID for desktop (default: %(default)s)")
    parser.add_argument(
        "--desktop2", default=DEFAULT_DESKTOP2, help="Client ID for desktop2 (default: %(default)s)"
    )
    parser.add_argument("--mobile", default=DEFAULT_MOBILE, help="Client ID for mobile (default: %(default)s)")
    parser.add_argument("--seed", type=int, help="Seed RNG for deterministic layouts")
    parser.add_argument("--dry-run", action="store_true", help="Print payloads without sending")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    if args.seed is not None:
        random.seed(args.seed)

    all_images = load_images()
    if len(all_images) < 225:
        raise SystemExit("Need at least 225 images in backend/offspring_images for these layouts")

    main_image = DEFAULT_MAIN_IMAGE if DEFAULT_MAIN_IMAGE in all_images else all_images[0]

    desktop_payload = build_desktop_payload(main_image, args.desktop)
    desktop2_payload = build_desktop2_payload(all_images, args.desktop2)
    mobile_payload = build_mobile_payload(all_images, gap=10, client=args.mobile)

    payloads = [
        ("desktop", desktop_payload),
        ("desktop2", desktop2_payload),
        ("mobile", mobile_payload),
    ]

    if args.dry_run:
        for name, payload in payloads:
            print(f"\n--- Payload for {name} ---")
            print(json.dumps(payload, indent=2))
        return

    for _, payload in payloads:
        try:
            put_iframe_config(args.api_base, payload)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            sys.stderr.write(f"HTTP error for {payload.get('target_client_id')}: {exc.code} {exc.reason}\n")
            if detail:
                sys.stderr.write(detail + "\n")
            raise SystemExit(1)
        except urllib.error.URLError as exc:
            sys.stderr.write(f"Failed to reach backend: {exc.reason}\n")
            raise SystemExit(1)


if __name__ == "__main__":
    main()
