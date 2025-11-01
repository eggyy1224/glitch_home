#!/usr/bin/env python3
"""Configure the desktop client for the "圖像系譜學" opening scene.

This helper script applies a dense iframe grid (default 10×10) and pushes a
subtitle banner that reads「圖像系譜學」to the specified client (desktop by
default). It mirrors the manual steps we usually perform at the beginning of a
show, but wraps them into a single command-line utility.

Usage
-----

```bash
python backend/playback_scripts/set_kinship_opening_layout.py \
    --api-base http://localhost:8000 \
    --client desktop
```

Options allow overriding grid density and subtitle settings. The image set is
intentionally hard-coded for this program and will be cycled to fill the grid.

Two-stage flow (default):
1) Show a dense 10×10 slide grid for a short hold time.
2) Automatically switch to a single-image panel (still slide_mode for lightness).
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from itertools import cycle
from typing import Iterable, List
import time


DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "desktop"
DEFAULT_IMAGES: List[str] = [
    "offspring_20250929_114940_017.png",
    "offspring_20250927_141336_787.png",
    "offspring_20250929_112621_888.png",
    "offspring_20251001_181913_443.png",
]
DEFAULT_SUBTITLE_TEXT = "圖像系譜學"

# Intro narration subtitles (after opening subtitle finishes)
# 後續解說字幕，使用較慢的節奏顯示
INTRO_SUBTITLES: List[tuple[str, float]] = [
    ("我們正在製作一部關於『圖像系譜學』的影片。", 4.5),
    ("接下來的畫面，將為這部影片打開開場。", 4.5),
    ("請把注意力放在圖像之間的親緣與流動。", 5.0),
]

# 節奏調整係數與下限，確保足夠閱讀時間
INTRO_PACE = 1.8  # 乘上原始時長
INTRO_MIN_DURATION = 7.0  # 至少 7 秒
INTRO_GAP_SECONDS = 0.6  # 兩句之間的緩衝


def build_iframe_payload(
    images: Iterable[str],
    client_id: str,
    *,
    columns: int,
    rows: int,
    gap: int,
) -> dict:
    if columns < 1 or rows < 1:
        raise ValueError("columns 與 rows 必須為正整數")

    image_list = list(images) or DEFAULT_IMAGES
    total_slots = columns * rows
    cycled_images = []
    for filename, _ in zip(cycle(image_list), range(total_slots)):
        cycled_images.append(filename)

    # Use slide_mode for each panel to keep each embed lightweight.
    panels = [
        {
            "id": f"p{index + 1}",
            "image": filename,
            "params": {"slide_mode": "true"},
        }
        for index, filename in enumerate(cycled_images)
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


def build_single_image_payload(
    image: str,
    client_id: str,
    *,
    gap: int = 0,
) -> dict:
    panel = {
        "id": "solo",
        "image": image,
        "params": {"slide_mode": "true"},
    }
    payload: dict = {
        "layout": "grid",
        "gap": gap,
        "columns": 1,
        "panels": [panel],
    }
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def request_json(api_base: str, method: str, path: str, payload: dict | None = None) -> dict:
    url = api_base.rstrip("/") + path
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8")
            try:
                return json.loads(body) if body else {}
            except json.JSONDecodeError:
                return {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        print(f"HTTP error: {exc.code} {exc.reason}", file=sys.stderr)
        if detail:
            print(detail, file=sys.stderr)
        raise SystemExit(1)
    except urllib.error.URLError as exc:
        print(f"無法連線到 {url}: {exc.reason}", file=sys.stderr)
        raise SystemExit(1)


def put_iframe_config(api_base: str, payload: dict) -> None:
    result = request_json(api_base, "PUT", "/api/iframe-config", payload)
    print("✅ 已更新 iframe 配置")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def post_subtitle(
    api_base: str,
    *,
    text: str,
    client_id: str,
    language: str | None,
    duration: float | None,
) -> None:
    query = ""
    if client_id:
        query = f"?target_client_id={urllib.parse.quote(client_id)}"
    payload: dict = {"text": text}
    if language:
        payload["language"] = language
    if duration is not None:
        payload["duration_seconds"] = duration

    result = request_json(api_base, "POST", f"/api/subtitles{query}", payload)
    print("✅ 已推送字幕")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def run_intro_subtitles(api_base: str, client_id: str) -> None:
    for text, base_duration in INTRO_SUBTITLES:
        effective = max(INTRO_MIN_DURATION, float(base_duration) * INTRO_PACE)
        post_subtitle(
            api_base,
            text=text,
            client_id=client_id,
            language="zh-TW",
            duration=effective,
        )
        # 緩衝避免邊界重疊與閃爍
        time.sleep(INTRO_GAP_SECONDS)


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
        help="Target client ID (default: %(default)s)",
    )
    parser.add_argument(
        "--columns",
        type=int,
        default=10,
        help="Grid columns (default: %(default)s)",
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=10,
        help="Grid rows (default: %(default)s)",
    )
    parser.add_argument(
        "--gap",
        type=int,
        default=6,
        help="Grid gap/padding in pixels (default: %(default)s)",
    )
    parser.add_argument(
        "--subtitle",
        default=DEFAULT_SUBTITLE_TEXT,
        help="Subtitle text to display (default: %(default)s)",
    )
    parser.add_argument(
        "--subtitle-language",
        default="zh-TW",
        help="Optional subtitle language label (default: %(default)s)",
    )
    parser.add_argument(
        "--subtitle-duration",
        type=float,
        default=15.0,
        help="Subtitle display duration in seconds (default: %(default)s)",
    )
    parser.add_argument(
        "--hold-grid-seconds",
        type=float,
        default=15.0,
        help="How long to keep the 10×10 grid before switching to single image (default: %(default)s)",
    )
    parser.add_argument(
        "--no-switch",
        action="store_true",
        help="If set, do not switch to single-image view after the grid",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    images = DEFAULT_IMAGES

    iframe_payload = build_iframe_payload(
        images,
        args.client,
        columns=args.columns,
        rows=args.rows,
        gap=args.gap,
    )
    put_iframe_config(args.api_base, iframe_payload)

    post_subtitle(
        args.api_base,
        text=args.subtitle,
        client_id=args.client,
        language=args.subtitle_language,
        duration=args.subtitle_duration,
    )

    # Stage 2: optional switch to single image after hold duration
    waited = 0.0
    if not args.no_switch:
        delay = max(0.0, float(args.hold_grid_seconds))
        if delay > 0:
            print(f"⏳ 保持 10×10 佈局 {delay:.1f} 秒後切換為單張顯示…")
            time.sleep(delay)
            waited += delay
        first_image = DEFAULT_IMAGES[0]
        single_payload = build_single_image_payload(first_image, args.client, gap=0)
        put_iframe_config(args.api_base, single_payload)
        print("✅ 已切換為單張圖片模式 (slide_mode)")

    # Stage 3: start intro narration subtitles after the initial subtitle is over
    remaining = max(0.0, float(args.subtitle_duration) - waited)
    if remaining > 0:
        print(f"⏳ 等待開場字幕結束後再開始說明（{remaining:.1f} 秒）…")
        time.sleep(remaining)
    print("🎬 開始用字幕說明『圖像系譜學』…")
    run_intro_subtitles(args.api_base, args.client)


if __name__ == "__main__":
    main()

