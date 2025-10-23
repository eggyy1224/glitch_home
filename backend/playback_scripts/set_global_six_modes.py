#!/usr/bin/env python3
"""Broadcast the six-mode demo layout to all iframe clients.

This applies the configuration where every panel uses the same image but
different URL parameters to showcase the available frontend modes:

1. incubator=true (孵化室 3D)
2. iframe_mode=true (iframe split view)
3. slide_mode=true (單畫面輪播)
4. organic_mode=true (有機房間)
5. phylogeny=true (親緣樹 2D)
6. default kinship scene (no extra params)

Usage:

```bash
python backend/playback_scripts/set_global_six_modes.py \
    --api-base http://localhost:8000 \
    --image offspring_20251001_183316_858.png
```

Both arguments are optional; defaults match our current demo setup.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_IMAGE = "offspring_20251001_183316_858.png"


def build_payload(image_name: str) -> dict:
    panels = [
        ("mode-incubator", {"incubator": "true"}),
        ("mode-iframe", {"iframe_mode": "true"}),
        ("mode-slide", {"slide_mode": "true"}),
        ("mode-organic", {"organic_mode": "true"}),
        ("mode-phylogeny", {"phylogeny": "true"}),
        ("mode-kinship", {}),
    ]

    return {
        "layout": "grid",
        "gap": 16,
        "columns": 3,
        "panels": [
            {
                "id": pid,
                "image": image_name,
                "params": params,
            }
            for pid, params in panels
        ],
    }


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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--api-base",
        default=DEFAULT_API_BASE,
        help="Backend API base URL (default: %(default)s)",
    )
    parser.add_argument(
        "--image",
        default=DEFAULT_IMAGE,
        help="Image filename to use for all panels (default: %(default)s)",
    )
    args = parser.parse_args()

    payload = build_payload(args.image)
    put_iframe_config(args.api_base, payload)


if __name__ == "__main__":
    main()

