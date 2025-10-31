#!/usr/bin/env python3
"""Single-Image Study: offspring_20250929_114940_017

以「單圖研究」的方式，聚焦分析一張圖像，並分幕推送到前端 iframe：

Stages
------
0) Caption Mode（標題頁）
1) 焦點圖（1×1）— 基本資訊（日期、父圖數、世代深度）
2) 父圖族譜（自適應網格）— 顯示其 parent 圖像（若存在）
3) 同源兄弟姊妹（自適應網格）— 共享任一父圖者（若存在）
4) 視覺觀察模式（2×2）— 同圖不同模式（default / slide / incubator / organic）
5) 概念收束（可選的字幕敘述）

用法
----
python backend/playback_scripts/圖像系譜學/offspring_20250929_114940_017.py \\
  --api-base http://localhost:8000 \\
  --client desktop

用 --dry-run 可只列印 payload，不打 API。
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from itertools import cycle
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple


DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "desktop"
DEFAULT_METADATA_DIR = "backend/metadata"
OFFSPRING_DIR = "backend/offspring_images"

# 研究目標
IMAGE_NAME = "offspring_20250929_114940_017.png"


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


def delete_subtitle(api_base: str, *, client_id: str) -> None:
    query = f"?target_client_id={urllib.parse.quote(client_id)}" if client_id else ""
    # DELETE /api/subtitles
    request_json(api_base, "DELETE", f"/api/subtitles{query}")
    print("🧹 已清除當前字幕")


def delete_caption(api_base: str, *, client_id: str) -> None:
    query = f"?target_client_id={urllib.parse.quote(client_id)}" if client_id else ""
    # DELETE /api/captions
    request_json(api_base, "DELETE", f"/api/captions{query}")
    print("🧹 已清除當前標題")


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


def rotate_subtitles(
    api_base: str,
    *,
    client_id: str,
    lines: List[str],
    language: Optional[str] = None,
    duration: float = 5.0,
    gap: float = 0.8,
    repeat: int = 1,
) -> None:
    if repeat <= 0:
        repeat = 1
    for _ in range(repeat):
        for text in lines:
            post_subtitle(
                api_base,
                text=text,
                client_id=client_id,
                language=language,
                duration=duration,
            )
            # 留一點間隔避免覆蓋
            time.sleep(max(0.0, float(duration) + float(gap)))


def load_metadata_files(metadata_dir: str) -> Dict[str, dict]:
    """載入 offspring_*.json，回傳以 output_image 為鍵的索引。"""
    metadata: Dict[str, dict] = {}
    path = Path(metadata_dir)
    if not path.exists():
        print(f"❌ Metadata 目錄不存在: {metadata_dir}", file=sys.stderr)
        return {}
    files = list(path.glob("offspring_*.json"))
    print(f"📂 找到 {len(files)} 份 metadata…", file=sys.stderr)
    for i, jf in enumerate(files):
        if i and i % 100 == 0:
            print(f"  已載入 {i}/{len(files)}…", file=sys.stderr)
        try:
            with jf.open("r", encoding="utf-8") as fp:
                data = json.load(fp)
                key = data.get("output_image", jf.stem + ".png")
                metadata[key] = data
        except Exception:
            pass
    return metadata


def parse_date(created_at: str | None) -> Optional[str]:
    if not created_at:
        return None
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def calculate_lineage_depth(img_name: str, metadata: Dict[str, dict], memo: Dict[str, int] | None = None) -> int:
    """遞迴估算世代深度 (1=無 offspring 父圖)。"""
    if memo is None:
        memo = {}
    if img_name in memo:
        return memo[img_name]
    if img_name not in metadata:
        memo[img_name] = 1
        return 1
    parents = metadata[img_name].get("parents", [])
    if not parents:
        memo[img_name] = 1
        return 1
    offs = [p for p in parents if "offspring_" in p]
    if not offs:
        memo[img_name] = 1
        return 1
    depth = 1
    for p in offs:
        depth = max(depth, 1 + calculate_lineage_depth(p, metadata, memo))
    memo[img_name] = min(depth, 100)
    return memo[img_name]


def image_exists(name: str) -> bool:
    return os.path.exists(os.path.join(OFFSPRING_DIR, name))


def choose_grid(n: int, max_cols: int = 8, max_rows: int = 12) -> Tuple[int, int]:
    if n <= 0:
        return 1, 1
    cols = min(max_cols, max(1, int(math.ceil(math.sqrt(n)))))
    rows = int(math.ceil(n / cols))
    rows = min(rows, max_rows)
    return cols, rows


def build_grid_payload(
    images: Iterable[str],
    client_id: str,
    *,
    columns: int,
    rows: int,
    gap: int,
    params: Optional[Dict[str, str]] = None,
) -> dict:
    assert columns >= 1 and rows >= 1
    total = columns * rows
    img_list = [img for img in images if image_exists(img)]
    if img_list:
        if len(img_list) < total:
            img_list = img_list + list(cycle(img_list))[: total - len(img_list)]
        else:
            img_list = img_list[:total]
    panels: List[dict] = []
    for idx, filename in enumerate(img_list):
        panel = {
            "id": f"p{idx + 1}",
            "image": filename,
            "params": {"slide_mode": "true"},
        }
        if params:
            panel["params"].update({k: v for k, v in params.items() if v is not None})
        panels.append(panel)
    payload: dict = {"layout": "grid", "gap": gap, "columns": columns, "panels": panels}
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def build_parents_payload(
    parents: List[str],
    client_id: str,
    *,
    gap: int = 8,
) -> Optional[dict]:
    imgs = [p for p in parents if image_exists(p)]
    if not imgs:
        return None
    cols, rows = choose_grid(len(imgs), max_cols=6, max_rows=6)
    return build_grid_payload(imgs, client_id, columns=cols, rows=rows, gap=gap)


def build_siblings_payload(
    siblings: List[str],
    client_id: str,
    *,
    limit: int = 48,
    gap: int = 6,
) -> Optional[dict]:
    imgs = [s for s in siblings if image_exists(s)][:limit]
    if not imgs:
        return None
    cols, rows = choose_grid(len(imgs), max_cols=8, max_rows=8)
    return build_grid_payload(imgs, client_id, columns=cols, rows=rows, gap=gap)


def build_modes_payload(
    image_name: str,
    client_id: str,
    *,
    gap: int = 8,
) -> dict:
    # 2×2：同圖不同模式
    panels = []
    modes = [
        ("default", {}),
        ("slide", {"slide_mode": "true"}),
        ("incubator", {"incubator": "true"}),
        ("organic", {"organic_mode": "true"}),
    ]
    for i, (label, extra) in enumerate(modes, start=1):
        panel = {
            "id": f"m{i}",
            "image": image_name,
            "params": {},
            "label": label,
        }
        panel["params"].update(extra)
        panels.append(panel)
    payload: dict = {"layout": "grid", "gap": gap, "columns": 2, "panels": panels}
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def find_siblings(target: str, metadata: Dict[str, dict]) -> List[str]:
    if target not in metadata:
        return []
    t_parents = set(metadata[target].get("parents", []))
    if not t_parents:
        return []
    sibs: List[str] = []
    for img_name, meta in metadata.items():
        if img_name == target:
            continue
        parents = set(meta.get("parents", []))
        if parents & t_parents:
            sibs.append(img_name)
    return sibs


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Backend API base URL")
    parser.add_argument("--client", default=DEFAULT_CLIENT_ID, help="Target client ID")
    parser.add_argument("--metadata-dir", default=DEFAULT_METADATA_DIR, help="Metadata directory")

    # Caption stage
    parser.add_argument("--no-caption", action="store_true", help="Skip Stage 0 caption")
    # 預設標題改為「飛鳥」
    default_caption = "飛鳥"
    parser.add_argument("--caption-text", default=default_caption, help="Caption text")
    parser.add_argument("--caption-lang", default="zh-TW", help="Caption language label")
    parser.add_argument("--caption-dur", type=float, default=8.0, help="Caption duration seconds")

    # Holds
    parser.add_argument("--hold-focus", type=float, default=12.0, help="Hold on focus stage")
    parser.add_argument("--hold-parents", type=float, default=10.0, help="Hold on parents stage")
    parser.add_argument("--hold-siblings", type=float, default=12.0, help="Hold on siblings stage")
    parser.add_argument("--hold-modes", type=float, default=12.0, help="Hold on modes stage")

    # Subtitles
    parser.add_argument("--sub-lang", default="zh-TW", help="Subtitle language")
    parser.add_argument("--sub-dur", type=float, default=5.0, help="Subtitle duration")
    parser.add_argument("--subs-gap", type=float, default=0.8, help="Gap between rotating subtitles")
    parser.add_argument("--subs-repeat", type=int, default=1, help="Times to repeat rotating subtitles")

    # Subtitle control
    parser.add_argument("--reset-subs", action="store_true", help="Clear current subtitle before playback")
    parser.add_argument("--reset-caption", action="store_true", help="Clear current caption before playback")
    parser.add_argument(
        "--show-focus-stats",
        action="store_true",
        help="Show statistics subtitle in focus stage (default off)",
    )
    parser.add_argument(
        "--no-rotate-subs",
        action="store_true",
        help="Disable content-matching rotating subtitles",
    )

    # Feature flags
    parser.add_argument("--limit-siblings", type=int, default=48, help="Limit number of sibling images")
    parser.add_argument("--no-parents", action="store_true", help="Skip parents stage")
    parser.add_argument("--no-siblings", action="store_true", help="Skip siblings stage")
    parser.add_argument("--no-modes", action="store_true", help="Skip modes stage")
    parser.add_argument("--no-concept", action="store_true", help="Skip concept narration stage")
    parser.add_argument("--dry-run", action="store_true", help="Print payloads only, do not call API")

    # Presets
    parser.add_argument(
        "--preset",
        choices=["quick", "expo", "silent"],
        default=None,
        help="Timing presets: quick(短時預覽) / expo(展演) / silent(無字幕、零等待)",
    )

    return parser.parse_args(argv)


def _apply_preset(args: argparse.Namespace) -> None:
    """Apply timing presets by mutating args in-place."""
    p = args.preset
    if p == "quick":
        args.no_caption = True
        args.sub_dur = 3.0
        args.subs_gap = 0.3
        args.hold_focus = 4.0
        args.hold_parents = 4.0
        args.hold_siblings = 5.0
        args.hold_modes = 5.0
        args.no_concept = True
        # keep rotating subtitles on for quick context
    elif p == "expo":
        # slightly longer than defaults for on-site display
        args.caption_dur = max(args.caption_dur, 10.0)
        args.sub_dur = max(args.sub_dur, 6.0)
        args.subs_gap = max(args.subs_gap, 1.0)
        args.hold_focus = max(args.hold_focus, 12.0)
        args.hold_parents = max(args.hold_parents, 12.0)
        args.hold_siblings = max(args.hold_siblings, 14.0)
        args.hold_modes = max(args.hold_modes, 14.0)
        # keep concept narration
    elif p == "silent":
        args.no_caption = True
        args.no_rotate_subs = True
        args.no_concept = True
        args.hold_focus = 0.0
        args.hold_parents = 0.0
        args.hold_siblings = 0.0
        args.hold_modes = 0.0


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)

    # Apply preset adjustments if requested
    if args.preset:
        _apply_preset(args)

    if not image_exists(IMAGE_NAME):
        print(f"❌ 找不到目標圖像: {IMAGE_NAME} (於 {OFFSPRING_DIR})", file=sys.stderr)
        return

    # 載入 metadata 並提取本圖資訊
    print(f"📂 讀取 metadata 從 {args.metadata_dir}…", file=sys.stderr)
    metadata = load_metadata_files(args.metadata_dir)
    target_meta = metadata.get(IMAGE_NAME)
    created_at = target_meta.get("created_at") if target_meta else None
    created_date = parse_date(created_at)
    parents = list(target_meta.get("parents", [])) if target_meta else []
    parent_offspring = [p for p in parents if "offspring_" in p]
    parent_external = [p for p in parents if "offspring_" not in p]
    depth = calculate_lineage_depth(IMAGE_NAME, metadata) if target_meta else 1

    # 內容關聯字幕（預設啟用）
    default_rotating_lines: List[str] = [
        "飛群在夜空劃過，秩序微微鬆動。",
        "白襯衫排列成牆，呼吸被綁在領帶裡。",
        "水面複寫每張臉，像回聲的第二聲。",
        "石疊是節點，人群成了網。",
        "前景模糊的人，說著我們的距離。",
        "同一姿態，不同心跳。",
        "集合的靜，暗處在流。",
        "翅音掠過頭頂，剪開夜色。",
        "鏡像之下，誰先眨眼。",
        "隊列是儀式，也是保護色。",
    ]

    # 先清理現有字幕/標題（可選）
    if not args.dry_run:
        if args.reset_subs:
            delete_subtitle(args.api_base, client_id=args.client)
        if args.reset_caption:
            delete_caption(args.api_base, client_id=args.client)

    # Stage 0: Caption
    if not args.no_caption and not args.dry_run:
        caption_url = "/?caption_mode=true"
        if args.client:
            caption_url += f"&client={args.client}"
        payload_caption = {
            "layout": "grid",
            "gap": 0,
            "columns": 1,
            "panels": [{"id": "caption", "url": caption_url}],
        }
        if args.client:
            payload_caption["target_client_id"] = args.client
        put_iframe_config(args.api_base, payload_caption)
        post_caption(
            args.api_base,
            text=args.caption_text,
            language=args.caption_lang,
            duration=args.caption_dur,
            client_id=args.client,
        )
        print(f"⏳ 顯示標題 {args.caption_dur:.1f} 秒…")
        time.sleep(max(0.0, float(args.caption_dur) + 1.0))

    # Stage 1: Focus (1×1)
    payload_focus = build_grid_payload([IMAGE_NAME], args.client, columns=1, rows=1, gap=0)
    focus_subtitle = (
        f"焦點圖：{created_date or '未知日期'}；父圖 {len(parents)}（offspring {len(parent_offspring)} / external {len(parent_external)}）；世代深度 {depth}。"
    )
    if args.dry_run:
        print("[DRY-RUN] Stage 1 - Focus:")
        print(json.dumps(payload_focus, ensure_ascii=False, indent=2))
        print(f"Subtitle: {focus_subtitle}")
    else:
        put_iframe_config(args.api_base, payload_focus)
        # 預設不顯示統計字幕，除非明確要求
        if args.show_focus_stats:
            post_subtitle(
                args.api_base,
                text=focus_subtitle,
                client_id=args.client,
                language=args.sub_lang,
                duration=args.sub_dur,
            )
            if args.hold_focus > 0:
                time.sleep(args.hold_focus)
        # 推送內容關聯字幕輪播（若啟用）
        if not args.no_rotate_subs:
            rotate_subtitles(
                args.api_base,
                client_id=args.client,
                lines=default_rotating_lines,
                language=args.sub_lang,
                duration=float(args.sub_dur),
                gap=float(args.subs_gap),
                repeat=int(args.subs_repeat),
            )

    # Stage 2: Parents grid
    if not args.no_parents:
        payload_parents = build_parents_payload(parents, args.client)
        if args.dry_run:
            print("[DRY-RUN] Stage 2 - Parents:")
            print(json.dumps(payload_parents or {"note": "no parents"}, ensure_ascii=False, indent=2))
        else:
            if payload_parents:
                put_iframe_config(args.api_base, payload_parents)
                post_subtitle(
                    args.api_base,
                    text=f"父圖族譜：共 {len(parents)}，可視 {sum(1 for p in parents if image_exists(p))}。",
                    client_id=args.client,
                    language=args.sub_lang,
                    duration=args.sub_dur,
                )
                if args.hold_parents > 0:
                    time.sleep(args.hold_parents)
            else:
                post_subtitle(
                    args.api_base,
                    text="無可視父圖（或 metadata 缺失）",
                    client_id=args.client,
                    language=args.sub_lang,
                    duration=max(3.0, args.sub_dur),
                )
                time.sleep(1.0)

    # Stage 3: Siblings grid
    if not args.no_siblings:
        siblings = find_siblings(IMAGE_NAME, metadata)
        payload_siblings = build_siblings_payload(siblings, args.client, limit=max(1, int(args.limit_siblings)))
        if args.dry_run:
            print("[DRY-RUN] Stage 3 - Siblings:")
            print(json.dumps(payload_siblings or {"note": "no siblings"}, ensure_ascii=False, indent=2))
        else:
            if payload_siblings:
                put_iframe_config(args.api_base, payload_siblings)
                post_subtitle(
                    args.api_base,
                    text=f"同源兄弟姊妹：共 {len(siblings)}，展示 {min(len(siblings), int(args.limit_siblings))}。",
                    client_id=args.client,
                    language=args.sub_lang,
                    duration=args.sub_dur,
                )
                if args.hold_siblings > 0:
                    time.sleep(args.hold_siblings)
            else:
                post_subtitle(
                    args.api_base,
                    text="無同源兄弟姊妹（無共享父圖）",
                    client_id=args.client,
                    language=args.sub_lang,
                    duration=max(3.0, args.sub_dur),
                )
                time.sleep(1.0)

    # Stage 4: Modes (2×2)
    if not args.no_modes:
        payload_modes = build_modes_payload(IMAGE_NAME, args.client)
        if args.dry_run:
            print("[DRY-RUN] Stage 4 - Modes:")
            print(json.dumps(payload_modes, ensure_ascii=False, indent=2))
        else:
            put_iframe_config(args.api_base, payload_modes)
            post_subtitle(
                args.api_base,
                text="觀察模式：default / slide / incubator / organic",
                client_id=args.client,
                language=args.sub_lang,
                duration=args.sub_dur,
            )
            if args.hold_modes > 0:
                time.sleep(args.hold_modes)

    # Stage 5: Concept lines
    if not args.dry_run and not args.no_concept:
        lines = [
            "圖像作為生物：父圖的遺傳訊號經由繁殖傳遞與變異。",
            "同源群體的差異：相同來源在選擇壓力下分岔出多樣風格。",
            "個體—系譜—生態：單圖研究是通往整體圖像生態的入口。",
        ]
        for t in lines:
            post_subtitle(
                args.api_base,
                text=t,
                client_id=args.client,
                language=args.sub_lang,
                duration=max(3.0, float(args.sub_dur)),
            )
            time.sleep(max(0.0, float(args.sub_dur) + 1.0))

    if args.dry_run:
        print("\n✅ 單圖研究（dry-run）完成。")
    else:
        print("\n✅ 單圖研究完成。")


if __name__ == "__main__":
    main()
