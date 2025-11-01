#!/usr/bin/env python3
"""Single-Image Study (Stage 0–1 only): offspring_20250929_114732_835

本腳本先實作兩個場景：
0) 標題頁（Caption Mode）
1) 焦點圖（1×1）— 顯示目標影像，並可選擇推送統計字幕

後續可逐步加入父圖格、兄弟姊妹格、模式 2×2、概念字幕等。

用法
----
python backend/playback_scripts/圖像系譜學/offspring_20250929_114732_835.py \
  --api-base http://localhost:8000 \
  --client desktop

用 --dry-run 僅列印 payload，不打 API。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence


DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "desktop"
DEFAULT_METADATA_DIR = "backend/metadata"
OFFSPRING_DIR = "backend/offspring_images"

# 研究目標
IMAGE_NAME = "offspring_20250929_114732_835.png"
PARENT_BASE = "offspring_20250929_113731_778.png"  # 景觀與光的母本
PARENT_CATALYST = "offspring_20250929_114341_263.png"  # 密度/深度催化


# ------------------------------
# 基礎 HTTP / API helpers
# ------------------------------
def request_json(api_base: str, method: str, path: str, payload: dict | None = None) -> dict:
    url = api_base.rstrip("/") + path
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request) as response:
        body = response.read().decode("utf-8")
        try:
            return json.loads(body) if body else {}
        except json.JSONDecodeError:
            return {}


def put_iframe_config(api_base: str, payload: dict) -> None:
    result = request_json(api_base, "PUT", "/api/iframe-config", payload)
    print("✅ 已更新 iframe 配置")
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
        payload["duration_seconds"] = float(duration)
    result = request_json(api_base, "POST", f"/api/captions{query}", payload)
    print("✅ 已推送標題字幕")
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
        payload["duration_seconds"] = float(duration)
    result = request_json(api_base, "POST", f"/api/subtitles{query}", payload)
    print("✅ 已推送字幕")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def delete_caption(api_base: str, *, client_id: str) -> None:
    query = f"?target_client_id={urllib.parse.quote(client_id)}" if client_id else ""
    request_json(api_base, "DELETE", f"/api/captions{query}")
    print("🧹 已清除當前標題")


def delete_subtitle(api_base: str, *, client_id: str) -> None:
    query = f"?target_client_id={urllib.parse.quote(client_id)}" if client_id else ""
    request_json(api_base, "DELETE", f"/api/subtitles{query}")
    print("🧹 已清除當前字幕")


# ------------------------------
# Metadata helpers
# ------------------------------
def load_metadata_files(metadata_dir: str) -> Dict[str, dict]:
    idx: Dict[str, dict] = {}
    p = Path(metadata_dir)
    if not p.exists():
        print(f"❌ Metadata 目錄不存在: {metadata_dir}", file=sys.stderr)
        return {}
    for jf in p.glob("offspring_*.json"):
        try:
            with jf.open("r", encoding="utf-8") as f:
                data = json.load(f)
                key = data.get("output_image", jf.stem + ".png")
                idx[key] = data
        except Exception:
            pass
    return idx


def parse_date(created_at: str | None) -> Optional[str]:
    if not created_at:
        return None
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def calculate_lineage_depth(img_name: str, metadata: Dict[str, dict], memo: Dict[str, int] | None = None) -> int:
    if memo is None:
        memo = {}
    if img_name in memo:
        return memo[img_name]
    meta = metadata.get(img_name)
    if not meta:
        memo[img_name] = 1
        return 1
    parents = [p for p in meta.get("parents", []) if p.startswith("offspring_")]
    if not parents:
        memo[img_name] = 1
        return 1
    depth = 1
    for p in parents:
        depth = max(depth, 1 + calculate_lineage_depth(p, metadata, memo))
    memo[img_name] = min(depth, 100)
    return memo[img_name]


# ------------------------------
# Payload builders
# ------------------------------
def image_exists(name: str) -> bool:
    return os.path.isfile(os.path.join(OFFSPRING_DIR, name))


def build_grid_payload(
    images: Iterable[str],
    client_id: str,
    *,
    columns: int,
    rows: int,
    gap: int,
    params: Optional[Dict[str, str]] = None,
) -> dict:
    imgs = [i for i in images if image_exists(i)]
    if not imgs:
        imgs = []
    panels = []
    for idx, name in enumerate(imgs[: columns * rows]):
        p = {"id": f"p{idx+1}", "image": name, "params": {}}
        if params:
            p["params"].update(params)
        panels.append(p)
    payload: dict = {"layout": "grid", "gap": gap, "columns": columns, "panels": panels}
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def build_triad_payload(
    left: str,
    center: str,
    right: str,
    *,
    client_id: str,
    gap: int = 8,
    left_label: str = "父圖A：景觀與光",
    center_label: str = "本圖：穩定母版",
    right_label: str = "父圖B：密度/深度催化",
) -> dict:
    imgs = [i for i in (left, center, right) if image_exists(i)]
    panels = []
    labels = [left_label, center_label, right_label]
    for idx, name in enumerate(imgs, start=1):
        panels.append({
            "id": f"t{idx}",
            "image": name,
            "label": labels[idx - 1],
            "params": {},
        })
    payload: dict = {"layout": "grid", "gap": gap, "columns": 3, "panels": panels}
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def find_siblings(target: str, metadata: Dict[str, dict]) -> List[str]:
    meta = metadata.get(target)
    if not meta:
        return []
    t_parents = set(meta.get("parents", []))
    if not t_parents:
        return []
    sibs: List[str] = []
    for name, m in metadata.items():
        if name == target:
            continue
        ps = set(m.get("parents", []))
        if t_parents & ps:
            sibs.append(name)
    # 僅回傳實際存在的圖片
    return [s for s in sibs if image_exists(s)]


def push_lines(
    api_base: str,
    client_id: str,
    lines: List[str],
    *,
    language: Optional[str],
    duration: float,
    gap: float = 0.8,
    dry_run: bool = False,
) -> None:
    for text in lines:
        if dry_run:
            print(f"Subtitle: {text}")
        else:
            post_subtitle(
                api_base,
                text=text,
                client_id=client_id,
                language=language,
                duration=duration,
            )
            time.sleep(max(0.0, float(duration) + float(gap)))


# ------------------------------
# CLI
# ------------------------------
def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Backend API base URL")
    parser.add_argument("--client", default=DEFAULT_CLIENT_ID, help="Target client ID")
    parser.add_argument("--metadata-dir", default=DEFAULT_METADATA_DIR, help="Metadata directory")

    # Stage 0: Caption
    parser.add_argument("--no-caption", action="store_true", help="Skip caption stage")
    parser.add_argument("--caption-text", default="左側主視覺｜穩定母版", help="Caption text")
    parser.add_argument("--caption-lang", default="zh-TW", help="Caption language label")
    parser.add_argument("--caption-dur", type=float, default=8.0, help="Caption duration seconds")

    # Stage 1: Focus
    parser.add_argument("--show-focus-stats", action="store_true", help="Show stats subtitle in focus stage")
    parser.add_argument("--sub-lang", default="zh-TW", help="Subtitle language")
    parser.add_argument("--sub-dur", type=float, default=5.0, help="Subtitle duration seconds")

    # Stage 2–3 controls
    parser.add_argument("--no-triad", action="store_true", help="Skip triad comparison stage")
    parser.add_argument("--hold-triad", type=float, default=12.0, help="Hold on triad stage seconds")
    parser.add_argument("--no-siblings", action="store_true", help="Skip siblings stage")
    parser.add_argument("--limit-siblings", type=int, default=48, help="Limit siblings shown")
    parser.add_argument("--hold-siblings", type=float, default=12.0, help="Hold on siblings stage seconds")

    # Explanation toggle
    parser.add_argument("--explain", action="store_true", help="Push narrative subtitles for each stage")

    # Controls
    parser.add_argument("--reset-subs", action="store_true", help="Clear current subtitles before playback")
    parser.add_argument("--reset-caption", action="store_true", help="Clear current caption before playback")
    parser.add_argument("--dry-run", action="store_true", help="Print payloads only, do not call API")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)

    if not image_exists(IMAGE_NAME):
        print(f"❌ 找不到目標圖像: {IMAGE_NAME} (於 {OFFSPRING_DIR})", file=sys.stderr)
        return

    # 載入 metadata，供焦點場景的統計字幕使用
    metadata = load_metadata_files(args.metadata_dir)
    meta = metadata.get(IMAGE_NAME, {})
    created_date = parse_date(meta.get("created_at"))
    parents: List[str] = list(meta.get("parents", []))
    parent_off = [p for p in parents if p.startswith("offspring_")]
    parent_ext = [p for p in parents if not p.startswith("offspring_")]
    depth = calculate_lineage_depth(IMAGE_NAME, metadata)

    # 可選：事先清理字幕/標題
    if not args.dry_run:
        if args.reset_caption:
            delete_caption(args.api_base, client_id=args.client)
        if args.reset_subs:
            delete_subtitle(args.api_base, client_id=args.client)

    # Stage 0: 標題頁（Caption Mode）
    if not args.no_caption:
        caption_url = "/?caption_mode=true"
        if args.client:
            caption_url += f"&client={urllib.parse.quote(args.client)}"
        payload_caption = {
            "layout": "grid",
            "gap": 0,
            "columns": 1,
            "panels": [{"id": "caption", "url": caption_url}],
        }
        if args.client:
            payload_caption["target_client_id"] = args.client
        if args.dry_run:
            print("[DRY-RUN] Stage 0 - Caption:")
            print(json.dumps(payload_caption, ensure_ascii=False, indent=2))
            print(f"Caption: {args.caption_text}")
        else:
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

    # Stage 1: 焦點圖（1×1）
    payload_focus = build_grid_payload([IMAGE_NAME], args.client, columns=1, rows=1, gap=0)
    stats_line = (
        f"焦點圖：{created_date or '未知日期'}；父圖 {len(parents)}（offspring {len(parent_off)} / external {len(parent_ext)}）；世代深度 {depth}。"
    )
    focus_lines = [
        "這是系統的左側主視覺：一張為後續變奏準備的穩定母版。",
        "夜色、硬閃、池面反射與鳥群，構成可延展的場景語彙。",
        "前景失焦的人頭—中景清晰的隊列—遠景遞減的群集，建立層層深度。",
        "在這裡，我們以它作為重攝、廣角化與密度調整的起點。",
    ]
    if args.dry_run:
        print("[DRY-RUN] Stage 1 - Focus:")
        print(json.dumps(payload_focus, ensure_ascii=False, indent=2))
        if args.show_focus_stats:
            print(f"Subtitle: {stats_line}")
    else:
        put_iframe_config(args.api_base, payload_focus)
        if args.show_focus_stats:
            post_subtitle(
                args.api_base,
                text=stats_line,
                client_id=args.client,
                language=args.sub_lang,
                duration=args.sub_dur,
            )
        # 若開啟說明模式，推送敘事字幕
        if args.explain:
            push_lines(
                args.api_base,
                args.client,
                focus_lines,
                language=args.sub_lang,
                duration=args.sub_dur,
                dry_run=False,
            )

    # Stage 2：父母—母版 三聯對照（1×3）
    if not args.no_triad:
        payload_triad = build_triad_payload(
            PARENT_BASE,
            IMAGE_NAME,
            PARENT_CATALYST,
            client_id=args.client,
            left_label="父圖A：景觀與光（鳥群／反射／硬閃）",
            center_label="本圖：穩定母版（平衡構圖與可延展性）",
            right_label="父圖B：密度／深度催化（前景bokeh與群聚）",
        )
        triad_lines = [
            "左：從環境與光出發，鳥群與反射定下舞台。",
            "中：調和兩端訊號，成為後續繁衍的母版。",
            "右：擴張人群密度與景深層次，形成變奏方向。",
        ]
        if args.dry_run:
            print("[DRY-RUN] Stage 2 - Triad:")
            print(json.dumps(payload_triad, ensure_ascii=False, indent=2))
            if args.explain:
                for t in triad_lines:
                    print(f"Subtitle: {t}")
        else:
            put_iframe_config(args.api_base, payload_triad)
            if args.explain:
                push_lines(
                    args.api_base,
                    args.client,
                    triad_lines,
                    language=args.sub_lang,
                    duration=args.sub_dur,
                    dry_run=False,
                )
            if args.hold_triad > 0:
                time.sleep(args.hold_triad)

    # Stage 3：同源兄弟姊妹（自適應網格）
    if not args.no_siblings:
        siblings = find_siblings(IMAGE_NAME, metadata)
        if args.limit_siblings > 0:
            siblings = siblings[: int(args.limit_siblings)]
        # 自動估計 cols/rows：用簡單平方根近似
        n = max(1, len(siblings))
        cols = max(1, int(n ** 0.5))
        rows = max(1, (n + cols - 1) // cols)
        payload_sibs = build_grid_payload(siblings, args.client, columns=cols, rows=rows, gap=6)
        sib_lines = [
            f"同源兄弟姊妹：共 {len(siblings)} 張；共享至少一個父圖。",
            "觀察：在相同來源下，密度、節奏與景深的微差異。",
        ]
        if args.dry_run:
            print("[DRY-RUN] Stage 3 - Siblings:")
            print(json.dumps(payload_sibs, ensure_ascii=False, indent=2))
            if args.explain:
                for t in sib_lines:
                    print(f"Subtitle: {t}")
        else:
            put_iframe_config(args.api_base, payload_sibs)
            if args.explain:
                push_lines(
                    args.api_base,
                    args.client,
                    sib_lines,
                    language=args.sub_lang,
                    duration=args.sub_dur,
                    dry_run=False,
                )
            if args.hold_siblings > 0:
                time.sleep(args.hold_siblings)
    if args.dry_run:
        print("\n✅ Stage 0–3（dry-run）完成。")
    else:
        print("\n✅ Stage 0–3 完成。")


if __name__ == "__main__":
    main()
