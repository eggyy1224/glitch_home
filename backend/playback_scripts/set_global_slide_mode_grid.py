#!/usr/bin/env python3
"""Apply the 4x2 slide-mode grid layout to the iframe viewer.

This script hits the backend `/api/iframe-config` endpoint and sets the
global configuration so that every panel runs slide mode with the images
we used during the demo.

Usage
-----

```bash
python backend/playback_scripts/set_global_slide_mode_grid.py \
    --api-base http://localhost:8000
```

If you omit `--api-base`, the script defaults to `http://localhost:8000`.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


DEFAULT_API_BASE = "http://localhost:8000"


PAYLOAD = {
    "layout": "grid",
    "gap": 14,
    "columns": 4,
    "panels": [
        {"id": "s1", "image": "offspring_20251008_112729_198.png", "params": {"slide_mode": "true"}},
        {"id": "s2", "image": "offspring_20250924_171310_997.png", "params": {"slide_mode": "true"}},
        {"id": "s3", "image": "offspring_20250929_003741_142.png", "params": {"slide_mode": "true"}},
        {"id": "s4", "image": "offspring_20250927_140540_742.png", "params": {"slide_mode": "true"}},
        {"id": "s5", "image": "offspring_20251004_213352_691.png", "params": {"slide_mode": "true"}},
        {"id": "s6", "image": "offspring_20251001_183450_884.png", "params": {"slide_mode": "true"}},
        {"id": "s7", "image": "offspring_20251004_212841_983.png", "params": {"slide_mode": "true"}},
        {"id": "s8", "image": "offspring_20251005_144934_368.png", "params": {"slide_mode": "true"}},
    ],
}


def put_iframe_config(api_base: str) -> None:
    url = api_base.rstrip("/") + "/api/iframe-config"
    data = json.dumps(PAYLOAD).encode("utf-8")
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
        try:
            detail = exc.read().decode("utf-8")
            if detail:
                print(detail, file=sys.stderr)
        except Exception:
            pass
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
    args = parser.parse_args()
    put_iframe_config(args.api_base)


if __name__ == "__main__":
    main()

