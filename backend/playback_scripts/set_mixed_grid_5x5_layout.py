#!/usr/bin/env python3
"""Apply the 5x5 mixed grid layout (Slide Mode / kinship) with varied spans.

This matches the layout created via API earlier:
- Grid columns: 5, gap: 8
- 16 panels using offspring_20250923_* images, some spanning multiple rows/columns.

Run:
    python3 backend/playback_scripts/set_mixed_grid_5x5_layout.py \
        --api-base http://localhost:8000 \
        --client default

All panels default to Slide Mode with slide_source=kinship. You can override
individual filenames via CLI options.
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
DEFAULT_IMAGES = [
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

SPAN_SETTINGS = {
    "p1": {"col_span": 2, "row_span": 2},
    "p2": {"row_span": 2},
    "p4": {"col_span": 2},
    "p7": {"row_span": 2},
    "p9": {"col_span": 2},
    "p13": {"row_span": 2},
    "p15": {"col_span": 2},
}


def build_payload(images: Sequence[str], gap: int, client_id: str) -> dict:
    panels: list[dict] = []
    for idx, image in enumerate(images, start=1):
        panel = {
            "id": f"p{idx}",
            "image": image,
            "params": {"slide_mode": "true", "slide_source": "kinship"},
        }
        spans = SPAN_SETTINGS.get(panel["id"])
        if spans:
            panel.update(spans)
        panels.append(panel)

    payload: dict = {
        "layout": "grid",
        "gap": gap,
        "columns": 5,
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
        default=8,
        help="Grid gap in pixels (default: %(default)s)",
    )
    parser.add_argument(
        "--images",
        nargs="*",
        help="Override panel images (provide up to 16 filenames)",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    imgs = args.images if args.images else DEFAULT_IMAGES
    if len(imgs) < len(DEFAULT_IMAGES):
        imgs = list(imgs) + DEFAULT_IMAGES[len(imgs):]
    payload = build_payload(imgs[:len(DEFAULT_IMAGES)], gap=args.gap, client_id=args.client)
    put_iframe_config(args.api_base, payload)


if __name__ == "__main__":
    main()
