#!/usr/bin/env python3
"""Apply the current complex desktop showcase layout: 18-column hero wall with nested desktop2."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Sequence

DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "desktop"
DEFAULT_NESTED_CLIENT = "desktop2"

RAW_CONFIG_JSON = r"""{
  "layout": "grid",
  "gap": 8,
  "columns": 18,
  "panels": [
    {
      "id": "p1",
      "image": "offspring_20250923_161624_066.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "kinship",
        "continuous": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 6,
      "row_span": 5
    },
    {
      "id": "p2",
      "image": "offspring_20250923_161704_451.png",
      "url": null,
      "params": {
        "incubator": "true",
        "continuous": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 4,
      "row_span": 6
    },
    {
      "id": "p3",
      "image": "offspring_20250923_161747_194.png",
      "url": null,
      "params": {
        "organic_mode": "true",
        "continuous": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 3,
      "row_span": 5
    },
    {
      "id": "p4",
      "image": "offspring_20251006_202714_956.png",
      "url": null,
      "params": {},
      "ratio": 1.0,
      "label": null,
      "col_span": 5,
      "row_span": 4
    },
    {
      "id": "p5",
      "image": null,
      "url": "/?iframe_mode=true&client=desktop2",
      "params": {},
      "ratio": 1.0,
      "label": "Desktop2",
      "col_span": 6,
      "row_span": 6
    },
    {
      "id": "p6",
      "image": "offspring_20251005_144934_368.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "macrocosm"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 6,
      "row_span": 4
    },
    {
      "id": "p7",
      "image": "offspring_20250923_162600_328.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "ancestry",
        "sound_player": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 4,
      "row_span": 3
    },
    {
      "id": "p8",
      "image": "offspring_20250923_162512_773.png",
      "url": null,
      "params": {
        "organic_mode": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 3,
      "row_span": 3
    },
    {
      "id": "p9",
      "image": "offspring_20250923_162223_271.png",
      "url": null,
      "params": {
        "incubator": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 3,
      "row_span": 3
    },
    {
      "id": "p10",
      "image": "offspring_20250923_170818_939.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "diagram"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 3,
      "row_span": 2
    },
    {
      "id": "p11",
      "image": "offspring_20250923_170931_161.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "ancestry"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 2,
      "row_span": 2
    },
    {
      "id": "p12",
      "image": "offspring_20250923_170859_729.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "macrocosm"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 2,
      "row_span": 2
    },
    {
      "id": "p13",
      "image": "offspring_20250923_163256_169.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "kinship",
        "continuous": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 3,
      "row_span": 2
    },
    {
      "id": "p14",
      "image": "offspring_20250923_163230_415.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "archive",
        "autoplay": "1",
        "step": "15"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 4,
      "row_span": 2
    },
    {
      "id": "p15",
      "image": "offspring_20250923_162135_155.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "macrocosm"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 3,
      "row_span": 2
    },
    {
      "id": "p16",
      "image": "offspring_20250923_161828_524.png",
      "url": null,
      "params": {
        "organic_mode": "true",
        "continuous": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 2,
      "row_span": 4
    },
    {
      "id": "p17",
      "image": "offspring_20250923_162600_328.png",
      "url": null,
      "params": {
        "incubator": "true",
        "continuous": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 2,
      "row_span": 4
    },
    {
      "id": "p18",
      "image": "offspring_20251004_221320_255.png",
      "url": null,
      "params": {},
      "ratio": 1.0,
      "label": null,
      "col_span": 2,
      "row_span": 2
    },
    {
      "id": "p19",
      "image": "offspring_20251004_212917_604.png",
      "url": null,
      "params": {},
      "ratio": 1.0,
      "label": null,
      "col_span": 2,
      "row_span": 2
    },
    {
      "id": "p20",
      "image": null,
      "url": "/?img=offspring_20250923_162600_328.png&sound_player=true&client=desktop",
      "params": {},
      "ratio": 1.0,
      "label": "Sound Player",
      "col_span": 3,
      "row_span": 2
    },
    {
      "id": "p21",
      "image": "offspring_20250923_161624_066.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "archive",
        "continuous": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 3,
      "row_span": 2
    },
    {
      "id": "p22",
      "image": "offspring_20250923_162258_533.png",
      "url": null,
      "params": {
        "slide_mode": "true",
        "slide_source": "macrocosm",
        "continuous": "true"
      },
      "ratio": 1.0,
      "label": null,
      "col_span": 2,
      "row_span": 2
    }
  ]
}"""

RAW_CONFIG = json.loads(RAW_CONFIG_JSON)


def patch_nested_client(payload: dict, nested_client: str) -> dict:
    for panel in payload.get("panels", []):
        url = panel.get("url") or panel.get("src")
        if url and "iframe_mode=true" in url:
            new_url = f"/?iframe_mode=true&client={nested_client}"
            panel["url"] = new_url
            panel["src"] = new_url
            panel["label"] = nested_client.capitalize()
    return payload


def build_payload(client_id: str, nested_client: str) -> dict:
    payload = json.loads(json.dumps(RAW_CONFIG))
    payload = patch_nested_client(payload, nested_client)
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
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Backend API base URL")
    parser.add_argument("--client", default=DEFAULT_CLIENT_ID, help="Target client ID")
    parser.add_argument("--nested-client", default=DEFAULT_NESTED_CLIENT, help="Nested client ID (default: desktop2)")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    payload = build_payload(args.client, args.nested_client)
    put_iframe_config(args.api_base, payload)


if __name__ == "__main__":
    main()