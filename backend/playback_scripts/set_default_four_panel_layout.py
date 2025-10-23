#!/usr/bin/env python3
"""Apply the four-panel default iframe layout without extra mode parameters.

This script mirrors the manual configuration we just applied via the UI: a 2x2
grid, 12px gap, each panel pointing to a specific offspring image and relying on
the viewer's default behaviour (no slide/incubator/organic params).

Usage
-----

```bash
python backend/playback_scripts/set_default_four_panel_layout.py \
    --api-base http://localhost:8000 \
    --client default
```

You can override the images by repeating ``--image``. When fewer than four
images are provided the script uses the built-in defaults for the remaining
slots.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Iterable, List


DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "default"
DEFAULT_IMAGES: List[str] = [
    "offspring_20250927_141336_787.png",
    "offspring_20250927_141751_825.png",
    "offspring_20250929_114940_017.png",
    "offspring_20250929_115141_659.png",
]


def build_payload(images: Iterable[str], client_id: str, *, gap: int, columns: int) -> dict:
    images_list = list(images)
    if not images_list:
        images_list = DEFAULT_IMAGES.copy()
    else:
        # top up with defaults if fewer than 4 provided
        topped = images_list[:]
        for fallback in DEFAULT_IMAGES:
            if len(topped) >= 4:
                break
            topped.append(fallback)
        images_list = topped[:4]

    panels = [
        {
            "id": f"p{index + 1}",
            "image": name,
            "params": {},
        }
        for index, name in enumerate(images_list[:4])
    ]

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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--api-base",
        default=DEFAULT_API_BASE,
        help="Backend API base URL (default: %(default)s)",
    )
    parser.add_argument(
        "--client",
        default=DEFAULT_CLIENT_ID,
        help="Client ID to target (default: %(default)s)",
    )
    parser.add_argument(
        "--gap",
        type=int,
        default=12,
        help="Gap/padding between panels (default: %(default)s)",
    )
    parser.add_argument(
        "--columns",
        type=int,
        default=2,
        help="Number of columns in grid layout (default: %(default)s)",
    )
    parser.add_argument(
        "--image",
        action="append",
        dest="images",
        help="Image filename to use (can repeat up to four times)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    images = args.images if args.images else DEFAULT_IMAGES
    payload = build_payload(images, args.client, gap=args.gap, columns=args.columns)
    put_iframe_config(args.api_base, payload)


if __name__ == "__main__":
    main()

