#!/usr/bin/env python3
"""Apply a 10x10 mixed-span Slide Mode layout with blended data sources.

This script targets large mosaic displays:
- Grid columns: 10, default gap: 10
- 40 panels arranged with varied row/column spans for visual hierarchy
- Slide Mode enabled on every panel, mixing kinship / archive / macrocosm /
  fieldnotes / ancestry / diagram sources

Run:
    python3 backend/playback_scripts/set_mixed_grid_10x10_layout.py \
        --api-base http://localhost:8000 \
        --client default

Override panel imagery via --images (up to 40 filenames). When overriding, the
predefined slide_source assignments remain in place so data provenance stays
balanced across the wall.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Sequence

DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "default"

# Reuse the known-good offspring set to avoid missing-file errors; repeat as needed.
BASE_IMAGES = [
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
]
MAX_PANELS = len(SLIDE_SOURCES)

SPAN_SETTINGS = {
    "p1": {"col_span": 4, "row_span": 3},
    "p2": {"col_span": 2, "row_span": 2},
    "p3": {"col_span": 3, "row_span": 2},
    "p4": {"row_span": 2},
    "p5": {"col_span": 2},
    "p6": {"row_span": 3},
    "p7": {"col_span": 3, "row_span": 3},
    "p8": {"row_span": 2},
    "p9": {"col_span": 2, "row_span": 2},
    "p10": {"col_span": 2},
    "p11": {"row_span": 2},
    "p12": {"col_span": 3},
    "p13": {"row_span": 3},
    "p14": {"col_span": 2, "row_span": 2},
    "p15": {"col_span": 2},
    "p16": {"row_span": 2},
    "p17": {"col_span": 3, "row_span": 2},
    "p18": {"row_span": 2},
    "p19": {"col_span": 2},
    "p20": {"row_span": 3},
    "p21": {"col_span": 3, "row_span": 3},
    "p22": {"row_span": 2},
    "p23": {"col_span": 2, "row_span": 2},
    "p24": {"col_span": 2},
    "p25": {"row_span": 2},
    "p26": {"col_span": 3},
    "p27": {"row_span": 3},
    "p28": {"col_span": 2, "row_span": 2},
    "p29": {"col_span": 2},
    "p30": {"row_span": 2},
    "p31": {"col_span": 3, "row_span": 2},
    "p32": {"row_span": 2},
    "p33": {"col_span": 2},
    "p34": {"row_span": 3},
    "p35": {"col_span": 3, "row_span": 3},
    "p36": {"row_span": 2},
    "p37": {"col_span": 2, "row_span": 2},
    "p38": {"col_span": 2},
    "p39": {"row_span": 2},
    "p40": {"col_span": 3},
}


def default_images() -> list[str]:
    """Return 40 filenames, repeating the known 16-image set."""
    tiled = (BASE_IMAGES * ((MAX_PANELS + len(BASE_IMAGES) - 1) // len(BASE_IMAGES)))[:MAX_PANELS]
    return tiled


def resolve_images(overrides: Sequence[str] | None) -> list[str]:
    """Apply CLI overrides while guaranteeing 40 filenames."""
    images = default_images()
    if overrides:
        for idx, image in enumerate(overrides):
            if idx >= MAX_PANELS:
                break
            images[idx] = image
    return images


def build_payload(images: Sequence[str], gap: int, client_id: str) -> dict:
    panels: list[dict] = []
    for idx, (image, slide_source) in enumerate(zip(images, SLIDE_SOURCES), start=1):
        panel = {
            "id": f"p{idx}",
            "image": image,
            "params": {"slide_mode": "true", "slide_source": slide_source},
        }
        spans = SPAN_SETTINGS.get(panel["id"])
        if spans:
            panel.update(spans)
        panels.append(panel)

    payload: dict = {
        "layout": "grid",
        "gap": gap,
        "columns": 10,
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
        "--gap",
        type=int,
        default=10,
        help="Grid gap in pixels (default: %(default)s)",
    )
    parser.add_argument(
        "--images",
        nargs="*",
        help=f"Override panel images (provide up to {MAX_PANELS} filenames)",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    images = resolve_images(args.images)
    payload = build_payload(images, gap=args.gap, client_id=args.client)
    put_iframe_config(args.api_base, payload)


if __name__ == "__main__":
    main()

