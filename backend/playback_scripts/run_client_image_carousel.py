#!/usr/bin/env python3
"""Animate a set of images hopping between iframe clients via backend API."""

from __future__ import annotations

import argparse
import itertools
import json
import sys
import time
import urllib.error
import urllib.request
from typing import Iterable, Sequence


DEFAULT_API_BASE = "http://127.0.0.1:8000"
DEFAULT_CLIENTS: list[str] = ["default", "desktop", "desktop2", "mobile"]
DEFAULT_IMAGES: list[str] = [
    "offspring_20251006_191451_449.png",
    "offspring_20250923_161624_066.png",
    "offspring_20250923_161704_451.png",
    "offspring_20250923_161747_194.png",
    "offspring_20250923_161828_524.png",
    "offspring_20250923_162135_155.png",
]
DEFAULT_MODE_CYCLE: dict[str, list[str]] = {
    "default": ["slide:kinship", "incubator", "slide:diagram", "static"],
    "desktop": ["slide:macrocosm", "slide:ancestry", "incubator", "slide:archive"],
    "desktop2": ["slide:archive", "static", "slide:kinship", "slide:macrocosm"],
    "mobile": ["incubator", "slide:diagram", "slide:ancestry", "static"],
}


def put_json(url: str, payload: dict) -> None:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(request) as response:
        response.read()


def build_panel_payload(image: str, mode: str, client: str) -> dict:
    params: dict[str, str] = {}
    label = "STATIC"

    if mode == "incubator":
        params = {"incubator": "true"}
        label = "INCUBATOR"
    elif mode.startswith("slide:"):
        source = mode.split(":", 1)[1]
        params = {
            "slide_mode": "true",
            "slide_source": source,
            "continuous": "true",
        }
        label = f"SLIDE · {source.upper()}"

    return {
        "layout": "grid",
        "columns": 1,
        "gap": 8,
        "panels": [
            {
                "id": f"hero_{mode.replace(':', '_')}",
                "image": image,
                "params": params,
                "label": label,
            }
        ],
        "target_client_id": client,
    }


def run_cycle(
    *,
    api_base: str,
    clients: Sequence[str],
    images: Sequence[str],
    mode_cycle: dict[str, Sequence[str]],
    steps: int,
    delay: float,
) -> None:
    endpoint = api_base.rstrip("/") + "/api/iframe-config"
    image_cycle = list(images)
    if not image_cycle:
        raise SystemExit("No images provided for rotation")

    # Precompute per-client mode iterators so the rhythm is deterministic.
    mode_iters: dict[str, Iterable[str]] = {}
    for client in clients:
        modes = mode_cycle.get(client)
        if not modes:
            modes = ["static"]
        mode_iters[client] = itertools.cycle(modes)

    for step in range(steps):
        for offset, client in enumerate(clients):
            image = image_cycle[(step + offset) % len(image_cycle)]
            mode = next(mode_iters[client])
            payload = build_panel_payload(image, mode, client)
            try:
                put_json(endpoint, payload)
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="ignore")
                sys.stderr.write(f"HTTP error for {client}: {exc.code} {exc.reason}\n")
                if detail:
                    sys.stderr.write(detail + "\n")
                raise SystemExit(1)
            except urllib.error.URLError as exc:
                sys.stderr.write(f"Failed to reach backend: {exc.reason}\n")
                raise SystemExit(1)
        if delay > 0 and step != steps - 1:
            time.sleep(delay)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Backend API base URL")
    parser.add_argument(
        "--clients",
        nargs="*",
        default=DEFAULT_CLIENTS,
        help="Client IDs to animate (default: %(default)s)",
    )
    parser.add_argument(
        "--images",
        nargs="*",
        default=DEFAULT_IMAGES,
        help="Images to rotate through (default: %(default)s)",
    )
    parser.add_argument(
        "--steps",
        type=int,
        default=16,
        help="Number of rotation steps to perform",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.8,
        help="Seconds to pause between steps",
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Repeat indefinitely until interrupted",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    if not args.clients:
        raise SystemExit("Need at least one client to animate")

    steps = max(1, args.steps)

    if args.loop:
        try:
            while True:
                run_cycle(
                    api_base=args.api_base,
                    clients=args.clients,
                    images=args.images,
                    mode_cycle=DEFAULT_MODE_CYCLE,
                    steps=steps,
                    delay=args.delay,
                )
        except KeyboardInterrupt:
            print("\nLoop interrupted; exiting.")
    else:
        run_cycle(
            api_base=args.api_base,
            clients=args.clients,
            images=args.images,
            mode_cycle=DEFAULT_MODE_CYCLE,
            steps=steps,
            delay=args.delay,
        )


if __name__ == "__main__":
    main()
