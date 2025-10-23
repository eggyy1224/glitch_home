#!/usr/bin/env python3
"""Set a 3x2 iframe layout with a large left panel (2x2 span) and two right panels.

This script reproduces the layout we just configured manually: the left side
shows a single image spanning two columns and two rows, while the right column
contains two smaller panels stacked vertically. All panels run Slide Mode with
kinship source.

Usage:

    python backend/playback_scripts/set_left_panel_highlight_layout.py \
        --api-base http://localhost:8000

You can override the default images via CLI arguments; see --help.
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
DEFAULT_LEFT_IMAGE = "offspring_20251005_142915_438.png"
DEFAULT_TOP_IMAGE = "offspring_20251005_143233_160.png"
DEFAULT_BOTTOM_IMAGE = "offspring_20251005_145502_652.png"


def build_payload(left: str, top: str, bottom: str, client_id: str, gap: int = 12) -> dict:
    panels: list[dict] = [
        {
            "id": "left",
            "image": left,
            "params": {"slide_mode": "true", "slide_source": "kinship"},
            "col_span": 2,
            "row_span": 2,
        },
        {
            "id": "top-right",
            "image": top,
            "params": {"slide_mode": "true", "slide_source": "kinship"},
        },
        {
            "id": "bottom-right",
            "image": bottom,
            "params": {"slide_mode": "true", "slide_source": "kinship"},
        },
    ]

    payload: dict = {
        "layout": "grid",
        "gap": gap,
        "columns": 3,
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
        default=12,
        help="Grid gap in pixels (default: %(default)s)",
    )
    parser.add_argument(
        "--left",
        default=DEFAULT_LEFT_IMAGE,
        help="Image filename for the large left panel",
    )
    parser.add_argument(
        "--top",
        default=DEFAULT_TOP_IMAGE,
        help="Image filename for the top-right panel",
    )
    parser.add_argument(
        "--bottom",
        default=DEFAULT_BOTTOM_IMAGE,
        help="Image filename for the bottom-right panel",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    payload = build_payload(args.left, args.top, args.bottom, args.client, gap=args.gap)
    put_iframe_config(args.api_base, payload)


if __name__ == "__main__":
    main()
