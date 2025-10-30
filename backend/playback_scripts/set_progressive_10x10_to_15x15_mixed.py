#!/usr/bin/env python3
"""Progressively morph the wall layout: 10×10 → 15×15 (uniform) → 15×15 (mixed spans).

This script reproduces the interactive steps we just performed, but as a
repeatable show cue with subtitles at each stage. It follows the structure and
API usage pattern of `set_kinship_opening_layout.py`.

Stages
------
1) Dense 10×10 slide grid（均一尺寸）。
2) 擴充為 15×15（仍為均一尺寸）。
3) 15×15 混合尺寸（穿插 3×3/3×2/2×2/2×1/1×2 等 span，形成視覺層級）。

Each stage can push a subtitle with configurable text/duration. Holds between
stages are also configurable so the audience有時間讀取與感受轉場。

Usage
-----
python backend/playback_scripts/set_progressive_10x10_to_15x15_mixed.py \
  --api-base http://localhost:8000 \
  --client desktop

You can adjust holds, gaps, and subtitle contents via CLI flags. Images are
cycled to fill panels; you can override the image filenames with --images.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from itertools import cycle
from typing import Iterable, List, Sequence


DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "desktop"

# Reuse a known-good set; will be cycled to fill the grid.
DEFAULT_IMAGES: List[str] = [
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
    query = f"?target_client_id={urllib.parse.quote(client_id)}" if client_id else ""
    payload: dict = {"text": text}
    if language:
        payload["language"] = language
    if duration is not None:
        payload["duration_seconds"] = duration
    result = request_json(api_base, "POST", f"/api/subtitles{query}", payload)
    print("✅ 已推送字幕")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def build_grid_payload(
    images: Iterable[str],
    client_id: str,
    *,
    columns: int,
    rows: int,
    gap: int,
) -> dict:
    if columns < 1 or rows < 1:
        raise ValueError("columns 與 rows 必須為正整數")
    total = columns * rows
    img_list = list(images) or DEFAULT_IMAGES
    cycled = [filename for filename, _ in zip(cycle(img_list), range(total))]
    panels = [
        {
            "id": f"p{idx + 1}",
            "image": filename,
            "params": {"slide_mode": "true"},
        }
        for idx, filename in enumerate(cycled)
    ]
    payload: dict = {"layout": "grid", "gap": gap, "columns": columns, "panels": panels}
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def build_mixed_15x15_payload(images: Iterable[str], client_id: str, *, gap: int) -> dict:
    columns = 15
    total = 225
    img_list = list(images) or DEFAULT_IMAGES
    cycled = [filename for filename, _ in zip(cycle(img_list), range(total))]

    panels: list[dict] = []
    for i, filename in enumerate(cycled):
        idx = i + 1
        panel = {
            "id": f"p{idx}",
            "image": filename,
            "params": {"slide_mode": "true"},
        }
        # Mixed-span pattern（視覺層級）：
        if idx % 36 == 1:
            panel.update({"col_span": 3, "row_span": 3})  # hero tiles
        elif idx % 24 == 7:
            panel.update({"col_span": 3, "row_span": 2})
        elif idx % 20 == 5:
            panel.update({"col_span": 2, "row_span": 2})
        elif idx % 12 == 3:
            panel.update({"col_span": 2})
        elif idx % 12 == 9:
            panel.update({"row_span": 2})
        panels.append(panel)

    payload: dict = {"layout": "grid", "gap": gap, "columns": 15, "panels": panels}
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Backend API base URL (default: %(default)s)")
    parser.add_argument("--client", default=DEFAULT_CLIENT_ID, help="Target client ID (default: %(default)s)")

    # Gaps
    parser.add_argument("--gap10", type=int, default=6, help="Grid gap for 10×10 (default: %(default)s)")
    parser.add_argument("--gap15", type=int, default=6, help="Grid gap for 15×15 (default: %(default)s)")

    # Holds (seconds)
    parser.add_argument("--hold-10", type=float, default=30.0, help="Hold on 10×10 before expanding (default: %(default)s)")
    parser.add_argument("--hold-15-uniform", type=float, default=30.0, help="Hold on 15×15 uniform (default: %(default)s)")

    # Subtitles per stage
    parser.add_argument("--sub-10", default="啟動 10×10 密集佈局", help="Subtitle for stage 1 (default: %(default)s)")
    parser.add_argument("--sub-15", default="擴充為 15×15 佈局", help="Subtitle for stage 2 (default: %(default)s)")
    parser.add_argument("--sub-mixed", default="注入層級：大小不一的拼貼", help="Subtitle for stage 3 (default: %(default)s)")
    parser.add_argument("--sub-lang", default="zh-TW", help="Subtitle language label (default: %(default)s)")
    parser.add_argument("--sub-dur", type=float, default=6.0, help="Subtitle duration seconds (default: %(default)s)")

    # Images override
    parser.add_argument("--images", nargs="*", help="Override image filenames (cycled as needed)")

    # Dry-run to print payloads only
    parser.add_argument("--dry-run", action="store_true", help="Print payloads but do not call the API")

    # Concept subtitles (post-stage narrative)
    parser.add_argument("--no-concept", action="store_true", help="Do not run concept narration subtitles")
    parser.add_argument("--concept-dur", type=float, default=7.0, help="Per-line concept subtitle duration (default: %(default)s)")
    parser.add_argument("--concept-gap", type=float, default=0.8, help="Gap seconds between concept subtitles (default: %(default)s)")

    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    images = args.images or DEFAULT_IMAGES

    # Stage 1: 10×10 uniform（內含字幕時間，總長保持 hold_10 秒）
    payload_10 = build_grid_payload(images, args.client, columns=10, rows=10, gap=args.gap10)
    if args.dry_run:
        print("[DRY-RUN] Stage 1 payload:")
        print(json.dumps(payload_10, ensure_ascii=False, indent=2))
    else:
        stage_start = time.time()
        put_iframe_config(args.api_base, payload_10)
        # 轉場標題字幕
        post_subtitle(
            args.api_base,
            text=args.sub_10,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )
        # 概念字幕（分布於本階段內，不與轉場字幕重疊）
        if not args.no_concept:
            time.sleep(max(0.0, float(args.sub_dur) + float(args.concept_gap)))
            post_subtitle(
                args.api_base,
                text="圖像系譜學：以『親代→子代』的混配關係，追蹤影像源流與分支。",
                client_id=args.client,
                language="zh-TW",
                duration=max(3.0, float(args.concept_dur)),
            )
        # 將剩餘時間補滿到 hold_10 秒
        if args.hold_10 > 0:
            elapsed = time.time() - stage_start
            remaining = max(0.0, float(args.hold_10) - elapsed)
            print(f"⏳ 保持 10×10 還需 {remaining:.1f} 秒…")
            time.sleep(remaining)

    # Stage 2: 15×15 uniform（內含字幕時間，總長保持 hold_15_uniform 秒）
    payload_15_uniform = build_grid_payload(images, args.client, columns=15, rows=15, gap=args.gap15)
    if args.dry_run:
        print("[DRY-RUN] Stage 2 payload:")
        print(json.dumps(payload_15_uniform, ensure_ascii=False, indent=2))
    else:
        stage_start = time.time()
        put_iframe_config(args.api_base, payload_15_uniform)
        post_subtitle(
            args.api_base,
            text=args.sub_15,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )
        if not args.no_concept:
            time.sleep(max(0.0, float(args.sub_dur) + float(args.concept_gap)))
            post_subtitle(
                args.api_base,
                text="擴展為 15×15 代表族群擴張；格點密度對應分支數與變異度。",
                client_id=args.client,
                language="zh-TW",
                duration=max(3.0, float(args.concept_dur)),
            )
        if args.hold_15_uniform > 0:
            elapsed = time.time() - stage_start
            remaining = max(0.0, float(args.hold_15_uniform) - elapsed)
            print(f"⏳ 保持 15×15（均一）還需 {remaining:.1f} 秒…")
            time.sleep(remaining)

    # Stage 3: 15×15 mixed spans
    payload_15_mixed = build_mixed_15x15_payload(images, args.client, gap=args.gap15)
    if args.dry_run:
        print("[DRY-RUN] Stage 3 payload:")
        print(json.dumps(payload_15_mixed, ensure_ascii=False, indent=2))
    else:
        put_iframe_config(args.api_base, payload_15_mixed)
        post_subtitle(
            args.api_base,
            text=args.sub_mixed,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )

    # Concept narration subtitles in Stage 3（順序播放，避免重疊）
    if not args.dry_run and not args.no_concept:
        concept_lines_stage3: list[str] = [
            "混合 span＝視覺層級：較大格標示吸引子與高繁衍節點（高頻共親）。",
            "大小差異也回應創始者效應：新種子注入後，強勢母題會放大其影響。",
            "節奏：創始→回授→凝聚與變奏，讓觀眾閱讀圖像如何繁衍與流變。",
        ]
        for text in concept_lines_stage3:
            post_subtitle(
                args.api_base,
                text=text,
                client_id=args.client,
                language="zh-TW",
                duration=max(3.0, float(args.concept_dur)),
            )
            time.sleep(max(0.0, float(args.concept_dur) + float(args.concept_gap)))


if __name__ == "__main__":
    main()


