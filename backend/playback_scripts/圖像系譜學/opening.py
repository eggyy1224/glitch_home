#!/usr/bin/env python3
"""Opening cue for "圖像系譜學": 祖先誕生 → 世代擴張 → 系譜交織 → 網絡演化

This script presents the genealogy of images through progressive visual evolution.
Starting from ancestral seeds, it shows the birth of offspring, branching of lineages,
and the emergence of complex visual relationships.

Stages
------
0) Caption Mode（單面板載入 /?caption_mode=true，並推送標題文字）。
1) 祖先種子：4×4 核心圖像，展示創始圖像的誕生。
2) 第一世代：8×8 擴張，子代圖像的誕生與初始繁衍。
3) 多代交織：12×12 混合世代，展示不同代際的視覺對話。
4) 系譜網絡：15×15 分層演化，完整的圖像生態系統。

Each stage reveals different aspects of image genealogy and visual inheritance.

Usage
-----
python backend/playback_scripts/圖像系譜學/opening.py \
  --api-base http://localhost:8000 \
  --client desktop

Use --dry-run to print payloads without hitting the API. You can override
gaps, holds, images, and text via CLI flags.
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

# Curated ancestral seeds representing different lineages and visual attractors
# Using actual existing files from the project
DEFAULT_ANCESTORS: List[str] = [
    "offspring_20250923_161624_066.png",  # Early generation ancestor
    "offspring_20250923_161704_451.png",  # Early generation ancestor
    "offspring_20250923_161747_194.png",  # Early generation ancestor
    "offspring_20250923_161828_524.png",  # Early generation ancestor
    "offspring_20250923_162135_155.png",  # Early generation ancestor
    "offspring_20250923_162223_271.png",  # Early generation ancestor
    "offspring_20250923_162258_533.png",  # Early generation ancestor
    "offspring_20250923_162512_773.png",  # Early generation ancestor
    "offspring_20250923_162600_328.png",  # Early generation ancestor
    "offspring_20250923_163230_415.png",  # Early generation ancestor
    "offspring_20250923_163256_169.png",  # Early generation ancestor
    "offspring_20250923_170818_939.png",  # Early generation ancestor
    "offspring_20250923_170859_729.png",  # Early generation ancestor
    "offspring_20250923_170931_161.png",  # Early generation ancestor
    "offspring_20250923_171042_144.png",  # Early generation ancestor
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


def post_caption(
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
    result = request_json(api_base, "POST", f"/api/captions{query}", payload)
    print("✅ 已推送標題字幕")
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


def build_intertwined_generations_payload(images: Iterable[str], client_id: str, *, gap: int) -> dict:
    """Build 12×12 layout representing intertwined generations with mixed spans"""
    columns = 12
    total = 144
    img_list = list(images) or DEFAULT_ANCESTORS
    cycled = [filename for filename, _ in zip(cycle(img_list), range(total))]

    panels: list[dict] = []
    for i, filename in enumerate(cycled):
        idx = i + 1
        panel = {
            "id": f"p{idx}",
            "image": filename,
            "params": {"slide_mode": "true"},
        }
        # Evolutionary mixed-span pattern representing different generations and relationships
        if idx % 48 == 1:
            panel.update({"col_span": 3, "row_span": 3})  # Ancient ancestors - large presence
        elif idx % 32 == 9:
            panel.update({"col_span": 2, "row_span": 3})  # Deep lineage vertical
        elif idx % 24 == 5:
            panel.update({"col_span": 3, "row_span": 2})  # Branching families
        elif idx % 18 == 7:
            panel.update({"col_span": 2, "row_span": 2})  # Generation clusters
        elif idx % 12 == 3:
            panel.update({"col_span": 2})  # Horizontal lineage
        elif idx % 12 == 9:
            panel.update({"row_span": 2})  # Vertical inheritance
        panels.append(panel)

    payload: dict = {"layout": "grid", "gap": gap, "columns": columns, "panels": panels}
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def build_genealogical_network_payload(images: Iterable[str], client_id: str, *, gap: int) -> dict:
    """Build final 15×15 network with complex evolutionary relationships"""
    columns = 15
    total = 225
    img_list = list(images) or DEFAULT_ANCESTORS
    cycled = [filename for filename, _ in zip(cycle(img_list), range(total))]

    panels: list[dict] = []
    for i, filename in enumerate(cycled):
        idx = i + 1
        panel = {
            "id": f"p{idx}",
            "image": filename,
            "params": {"slide_mode": "true"},
        }
        # Complex network pattern representing full genealogical ecosystem
        if idx % 60 == 1:
            panel.update({"col_span": 4, "row_span": 3})  # Supreme ancestors
        elif idx % 45 == 16:
            panel.update({"col_span": 3, "row_span": 3})  # Major lineage founders
        elif idx % 30 == 7:
            panel.update({"col_span": 3, "row_span": 2})  # Branching families
        elif idx % 20 == 11:
            panel.update({"col_span": 2, "row_span": 3})  # Deep vertical lineages
        elif idx % 15 == 5:
            panel.update({"col_span": 2, "row_span": 2})  # Generation clusters
        elif idx % 10 == 3:
            panel.update({"col_span": 2})  # Horizontal connections
        elif idx % 10 == 7:
            panel.update({"row_span": 2})  # Vertical inheritance
        panels.append(panel)

    payload: dict = {"layout": "grid", "gap": gap, "columns": columns, "panels": panels}
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Backend API base URL (default: %(default)s)")
    parser.add_argument("--client", default=DEFAULT_CLIENT_ID, help="Target client ID (default: %(default)s)")

    # Caption stage
    parser.add_argument("--no-caption", action="store_true", help="Skip Stage 0 caption mode")
    parser.add_argument("--caption-text", default="圖像系譜學", help="Caption text (default: %(default)s)")
    parser.add_argument("--caption-lang", default="zh-TW", help="Caption language label (default: %(default)s)")
    parser.add_argument("--caption-dur", type=float, default=12.0, help="Caption duration seconds (default: %(default)s)")

    # Gaps for different evolutionary stages
    parser.add_argument("--gap-seeds", type=int, default=8, help="Grid gap for ancestral seeds (default: %(default)s)")
    parser.add_argument("--gap-gen1", type=int, default=6, help="Grid gap for first generation (default: %(default)s)")
    parser.add_argument("--gap-intertwined", type=int, default=5, help="Grid gap for intertwined generations (default: %(default)s)")
    parser.add_argument("--gap-network", type=int, default=4, help="Grid gap for final network (default: %(default)s)")

    # Holds (seconds) for evolutionary pacing
    parser.add_argument("--hold-seeds", type=float, default=25.0, help="Hold on ancestral seeds (default: %(default)s)")
    parser.add_argument("--hold-gen1", type=float, default=30.0, help="Hold on first generation expansion (default: %(default)s)")
    parser.add_argument("--hold-intertwined", type=float, default=35.0, help="Hold on intertwined generations (default: %(default)s)")

    # Subtitles per evolutionary stage
    parser.add_argument("--sub-seeds", default="祖先種子：創始圖像的誕生", help="Subtitle for ancestral seeds stage (default: %(default)s)")
    parser.add_argument("--sub-gen1", default="第一世代：子代的誕生與擴張", help="Subtitle for first generation stage (default: %(default)s)")
    parser.add_argument("--sub-intertwined", default="多代交織：視覺對話的形成", help="Subtitle for intertwined generations stage (default: %(default)s)")
    parser.add_argument("--sub-network", default="系譜網絡：圖像生態的演化", help="Subtitle for final network stage (default: %(default)s)")
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
    images = args.images or DEFAULT_ANCESTORS

    # Stage 0: Caption Mode
    if not args.no_caption and not args.dry_run:
        print("📽️ 準備標題頁 (Caption Mode)…")
        caption_url = "/?caption_mode=true"
        if args.client:
            caption_url += f"&client={args.client}"

        caption_payload: dict = {
            "layout": "grid",
            "gap": 0,
            "columns": 1,
            "panels": [
                {
                    "id": "caption",
                    "url": caption_url,
                }
            ],
        }
        if args.client:
            caption_payload["target_client_id"] = args.client
        put_iframe_config(args.api_base, caption_payload)

        # 推送標題文字到 caption mode
        post_caption(
            args.api_base,
            text=args.caption_text,
            language=args.caption_lang,
            duration=args.caption_dur,
            client_id=args.client,
        )
        print(f"⏳ 顯示標題 {float(args.caption_dur):.1f} 秒…")
        time.sleep(max(0.0, float(args.caption_dur) + 1.0))  # 留 1 秒緩衝

    # Stage 1: Ancestral Seeds - 4×4 core images
    payload_seeds = build_grid_payload(images, args.client, columns=4, rows=4, gap=args.gap_seeds)
    if args.dry_run:
        print("[DRY-RUN] Stage 1 payload:")
        print(json.dumps(payload_seeds, ensure_ascii=False, indent=2))
    else:
        stage_start = time.time()
        put_iframe_config(args.api_base, payload_seeds)
        post_subtitle(
            args.api_base,
            text=args.sub_seeds,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )
        # Evolutionary concept narration
        if not args.no_concept:
            time.sleep(max(0.0, float(args.sub_dur) + float(args.concept_gap)))
            post_subtitle(
                args.api_base,
                text="圖像系譜學：從祖先種子開始，每張圖像都是繁殖的起點。",
                client_id=args.client,
                language="zh-TW",
                duration=max(3.0, float(args.concept_dur)),
            )
        # Hold for ancestral contemplation
        if args.hold_seeds > 0:
            elapsed = time.time() - stage_start
            remaining = max(0.0, float(args.hold_seeds) - elapsed)
            print(f"⏳ 凝視祖先種子還需 {remaining:.1f} 秒…")
            time.sleep(remaining)

    # Stage 2: First Generation - 8×8 expansion
    payload_gen1 = build_grid_payload(images, args.client, columns=8, rows=8, gap=args.gap_gen1)
    if args.dry_run:
        print("[DRY-RUN] Stage 2 payload:")
        print(json.dumps(payload_gen1, ensure_ascii=False, indent=2))
    else:
        stage_start = time.time()
        put_iframe_config(args.api_base, payload_gen1)
        post_subtitle(
            args.api_base,
            text=args.sub_gen1,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )
        if not args.no_concept:
            time.sleep(max(0.0, float(args.sub_dur) + float(args.concept_gap)))
            post_subtitle(
                args.api_base,
                text="第一世代誕生：祖先們開始繁衍，子代繼承並變異視覺特徵。",
                client_id=args.client,
                language="zh-TW",
                duration=max(3.0, float(args.concept_dur)),
            )
        if args.hold_gen1 > 0:
            elapsed = time.time() - stage_start
            remaining = max(0.0, float(args.hold_gen1) - elapsed)
            print(f"⏳ 觀察第一世代擴張還需 {remaining:.1f} 秒…")
            time.sleep(remaining)

    # Stage 3: Intertwined Generations - 12×12 mixed spans
    payload_intertwined = build_intertwined_generations_payload(images, args.client, gap=args.gap_intertwined)
    if args.dry_run:
        print("[DRY-RUN] Stage 3 payload:")
        print(json.dumps(payload_intertwined, ensure_ascii=False, indent=2))
    else:
        stage_start = time.time()
        put_iframe_config(args.api_base, payload_intertwined)
        post_subtitle(
            args.api_base,
            text=args.sub_intertwined,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )
        if not args.no_concept:
            time.sleep(max(0.0, float(args.sub_dur) + float(args.concept_gap)))
            post_subtitle(
                args.api_base,
                text="多代交織：不同世代的圖像開始對話，形成複雜的視覺關係。",
                client_id=args.client,
                language="zh-TW",
                duration=max(3.0, float(args.concept_dur)),
            )
        if args.hold_intertwined > 0:
            elapsed = time.time() - stage_start
            remaining = max(0.0, float(args.hold_intertwined) - elapsed)
            print(f"⏳ 沉浸多代交織還需 {remaining:.1f} 秒…")
            time.sleep(remaining)

    # Stage 4: Genealogical Network - 15×15 complex evolution
    payload_network = build_genealogical_network_payload(images, args.client, gap=args.gap_network)
    if args.dry_run:
        print("[DRY-RUN] Stage 4 payload:")
        print(json.dumps(payload_network, ensure_ascii=False, indent=2))
    else:
        put_iframe_config(args.api_base, payload_network)
        post_subtitle(
            args.api_base,
            text=args.sub_network,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )

    # Final concept narration in the complete network
    if not args.dry_run and not args.no_concept:
        concept_lines_final: list[str] = [
            "系譜網絡：完整的圖像生態系統，展現視覺遺傳與演化的力量。",
            "創始者效應：祖先圖像的影響力決定後代的視覺方向。",
            "漂變與選擇：圖像在繁殖過程中持續變異，形成獨特的演化軌跡。",
            "圖像不再是靜態的影像，而是活著的、有記憶的視覺生命。",
        ]
        for text in concept_lines_final:
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

