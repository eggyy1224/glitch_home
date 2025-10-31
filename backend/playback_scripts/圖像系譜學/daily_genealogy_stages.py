#!/usr/bin/env python3
"""Daily Genealogical Evolution: 從創始到凝聚
按時間序列展現圖像演化的五個關鍵階段。

此腳本以「創始事件」為敘事樞紐，展示圖像系譜在 2025-09-23 至 2025-10-13 期間的演化歷程：
- Stage 1（9/23）：祖先種子 — 創始者的誕生
- Stage 2（9/24）：初次擴張 — 創始者效應的力量
- Stage 3（10/04）：創始事件 — 新基因的注入（大量新種子）
- Stage 4（10/05-13）：凝聚網絡 — 漸進收斂的視覺語言

每個階段對應的 offspring parent ratio 反映了回授強度：
- 低比例（<30%）= 新種子優先，系統引入新基因
- 高比例（>80%）= 後代自我迴路，快速風格凝聚

Stages
------
0) Caption Mode - 標題介紹
1) 9/23 祖先種子 - 4×4 核心創始者
2) 9/24 初次擴張 - 8×8 早期回授
3) 10/04 創始事件 - 12×12 新種子注入
4) 10/05-13 凝聚網絡 - 15×15 彩色特徵熱圖

Usage
-----
# 快速預覽（不連線 API）
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py --dry-run

# 完整演出（需後端運行）
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --api-base http://localhost:8000 \
  --client desktop

# 自訂參數
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --api-base http://localhost:8000 \
  --client desktop \
  --enable-heatmap \
  --hold-seeds 15 \
  --hold-coalesce 40

Features
--------
- 自動分析 metadata 中的 created_at 時間戳
- 計算日別回授比例，識別創始日
- Stage 4 支援快速熱圖著色（基於圖像序號漸變）
- 支援 --dry-run 預覽 payload 結構
- 完整的敘事字幕與概念敘述

Performance
-----------
- 載入 1144 份 metadata：約 3-5 秒
- 生成 4 個 payload：<1 秒
- 總執行時間（不含 hold 等待）：~5-10 秒
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict, Counter
from datetime import datetime, timedelta
from itertools import cycle
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
import math


DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "desktop"
DEFAULT_METADATA_DIR = "backend/metadata"

# 日期時間段定義
STAGE_DATES = {
    1: ("2025-09-23", "2025-09-23"),     # 祖先種子
    2: ("2025-09-24", "2025-09-24"),     # 初次擴張
    3: ("2025-10-04", "2025-10-04"),     # 創始事件
    4: ("2025-10-05", "2025-10-13"),     # 凝聚網絡
}


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


def load_metadata_files(metadata_dir: str) -> Dict[str, dict]:
    """載入所有 offspring_*.json metadata 檔案"""
    metadata = {}
    metadata_path = Path(metadata_dir)
    
    if not metadata_path.exists():
        print(f"❌ Metadata 目錄不存在: {metadata_dir}", file=sys.stderr)
        return {}
    
    json_files = list(metadata_path.glob("offspring_*.json"))
    print(f"📂 找到 {len(json_files)} 份 metadata 檔案…", file=sys.stderr)
    
    for i, json_file in enumerate(json_files):
        if i % 100 == 0 and i > 0:
            print(f"  已載入 {i}/{len(json_files)}…", file=sys.stderr)
        try:
            with open(json_file) as f:
                data = json.load(f)
                img_name = data.get("output_image", json_file.stem + ".png")
                metadata[img_name] = data
        except Exception as e:
            pass  # 靜默跳過錯誤檔案
    
    return metadata


def parse_created_date(created_at_str: str) -> str:
    """從 ISO 時間戳提取日期 (YYYY-MM-DD)"""
    try:
        dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except:
        return ""


def calculate_lineage_depth(img_name: str, metadata: Dict[str, dict], memo: Dict = None) -> int:
    """遞迴計算圖像的世代深度 (1=無 offspring 父圖)"""
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
    
    offspring_parents = [p for p in parents if "offspring_" in p]
    if not offspring_parents:
        memo[img_name] = 1
        return 1
    
    # 限制最大遞迴深度防止無限迴圈
    max_depth = 1
    for p in offspring_parents:
        if p not in memo and memo.get(p, 0) < 50:  # 防止無限遞迴
            p_depth = calculate_lineage_depth(p, metadata, memo)
            max_depth = max(max_depth, p_depth)
        elif p in memo:
            max_depth = max(max_depth, memo[p])
    
    depth = max_depth + 1
    memo[img_name] = min(depth, 100)  # 限制最大深度
    return memo[img_name]


def calculate_offspring_parent_ratio(stage_images: List[str], metadata: Dict[str, dict]) -> float:
    """計算該階段中，父圖包含 offspring 的比例"""
    if not stage_images:
        return 0.0
    
    total_parents = 0
    offspring_parent_count = 0
    
    for img in stage_images:
        if img in metadata:
            parents = metadata[img].get("parents", [])
            total_parents += len(parents)
            offspring_count = sum(1 for p in parents if "offspring_" in p)
            offspring_parent_count += offspring_count
    
    return offspring_parent_count / total_parents if total_parents > 0 else 0.0


def group_by_date(metadata: Dict[str, dict]) -> Dict[str, List[str]]:
    """按日期分組圖像"""
    date_groups = defaultdict(list)
    for img_name, meta in metadata.items():
        created_at = meta.get("created_at", "")
        date_str = parse_created_date(created_at)
        if date_str:
            date_groups[date_str].append(img_name)
    return dict(sorted(date_groups.items()))


def estimate_hue_color(img_name: str, depth: int, total_depth: int) -> str:
    """根據世代深度估計顏色 (深色→淺色 漸變)"""
    # 簡單啟發式：根據 depth 計算色相
    # 深層（祖先）: 紅色 (#FF6B6B)
    # 淺層（新後代）: 藍色 (#4ECDC4)
    ratio = max(0, min(1, depth / max(total_depth, 1)))
    # 從紅 → 藍 的漸變
    r = int(255 * (1 - ratio * 0.5))
    g = int(100 + 80 * ratio)
    b = int(150 * ratio + 100)
    return f"#{r:02X}{g:02X}{b:02X}"


def estimate_hue_color_fast(idx: int, total: int) -> str:
    """快速著色，基於索引而非深度"""
    # 不計算深度，直接用索引比例著色
    ratio = idx / max(total, 1)
    r = int(255 * (1 - ratio * 0.3))
    g = int(120 + 60 * ratio)
    b = int(100 * ratio + 150)
    return f"#{r:02X}{g:02X}{b:02X}"


def build_daily_stage_payload(
    stage_images: List[str],
    client_id: str,
    *,
    columns: int,
    rows: int,
    gap: int,
    metadata: Dict[str, dict],
    enable_heatmap: bool = False,
) -> dict:
    """構建日期階段的 grid payload，支援熱圖著色"""
    
    if columns < 1 or rows < 1:
        raise ValueError("columns 與 rows 必須為正整數")
    
    total = columns * rows
    
    # 過濾：只保留存在的圖像
    valid_images = []
    for img in stage_images:
        img_path = f"backend/offspring_images/{img}"
        if os.path.exists(img_path):
            valid_images.append(img)
        else:
            print(f"⚠️ 圖像不存在，跳過: {img}", file=sys.stderr)
    
    # 如果有效圖像不足，補充循環
    cycled = valid_images[:total] if valid_images else []
    
    if len(cycled) < total and cycled:
        cycled += list(cycle(cycled))[:total - len(cycled)]
    
    panels = []
    for idx, filename in enumerate(cycled):
        if filename == "placeholder":
            continue
        
        panel = {
            "id": f"p{idx + 1}",
            "image": filename,
            "params": {"slide_mode": "true"},
        }
        
        # 添加快速熱圖著色（不計算深度，基於索引）
        if enable_heatmap:
            color = estimate_hue_color_fast(idx, len(cycled))
            panel["bg_color"] = color
        
        # 簡單的 span 分配
        if idx % 7 == 0 and columns >= 3:
            panel["col_span"] = 2
        if idx % 11 == 0 and rows >= 3:
            panel["row_span"] = 2
        
        panels.append(panel)
    
    payload: dict = {"layout": "grid", "gap": gap, "columns": columns, "panels": panels}
    if client_id:
        payload["target_client_id"] = client_id
    return payload


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Backend API base URL")
    parser.add_argument("--client", default=DEFAULT_CLIENT_ID, help="Target client ID")
    parser.add_argument("--metadata-dir", default=DEFAULT_METADATA_DIR, help="Metadata directory")
    
    # Caption stage
    parser.add_argument("--no-caption", action="store_true", help="Skip Stage 0")
    parser.add_argument("--caption-text", default="圖像系譜學：創始到凝聚", help="Caption text")
    parser.add_argument("--caption-dur", type=float, default=10.0, help="Caption duration")
    
    # Gap & hold
    parser.add_argument("--gap-seeds", type=int, default=10, help="Gap for ancestral seeds")
    parser.add_argument("--gap-gen1", type=int, default=8, help="Gap for first generation")
    parser.add_argument("--gap-founder", type=int, default=6, help="Gap for founder event")
    parser.add_argument("--gap-coalesce", type=int, default=4, help="Gap for coalescence")
    
    parser.add_argument("--hold-seeds", type=float, default=20.0, help="Hold on seeds")
    parser.add_argument("--hold-gen1", type=float, default=25.0, help="Hold on gen1")
    parser.add_argument("--hold-founder", type=float, default=30.0, help="Hold on founder")
    parser.add_argument("--hold-coalesce", type=float, default=35.0, help="Hold on coalesce")
    
    # Subtitles
    parser.add_argument("--sub-seeds", default="祖先種子：創始者的誕生", help="Subtitle for seeds")
    parser.add_argument("--sub-gen1", default="初次擴張：創始者效應的力量", help="Subtitle for gen1")
    parser.add_argument("--sub-founder", default="創始事件：新基因的注入", help="Subtitle for founder")
    parser.add_argument("--sub-coalesce", default="凝聚網絡：漸進收斂的視覺語言", help="Subtitle for coalesce")
    parser.add_argument("--sub-lang", default="zh-TW", help="Subtitle language")
    parser.add_argument("--sub-dur", type=float, default=5.0, help="Subtitle duration")
    
    # Features
    parser.add_argument("--enable-heatmap", action="store_true", help="Enable feature heatmap coloring")
    parser.add_argument("--dry-run", action="store_true", help="Print payloads without API calls")
    parser.add_argument("--no-concept", action="store_true", help="Skip concept narration")
    
    return parser.parse_args(argv)


def main(argv=None) -> None:
    args = parse_args(argv)
    
    # 載入所有 metadata
    print(f"📂 讀取 metadata 從 {args.metadata_dir}…", file=sys.stderr)
    metadata = load_metadata_files(args.metadata_dir)
    if not metadata:
        print("❌ 未找到 metadata 檔案", file=sys.stderr)
        return
    
    print(f"✅ 已載入 {len(metadata)} 份 metadata", file=sys.stderr)
    
    # 按日期分組 (只取前 500 個用於快速測試)
    print(f"📅 按日期分組…", file=sys.stderr)
    date_groups = group_by_date(metadata)
    print(f"📅 按日期分組: {len(date_groups)} 天", file=sys.stderr)
    for date_str, images in sorted(date_groups.items()):
        ratio = calculate_offspring_parent_ratio(images, metadata)
        print(f"  {date_str}: {len(images)} 張 (offspring parent ratio: {ratio:.2%})")
    
    # 提取各階段的圖像
    stage_images = {
        1: [],  # 祖先種子
        2: [],  # 初次擴張
        3: [],  # 創始事件
        4: [],  # 凝聚網絡
    }
    
    for stage_id, (start_date, end_date) in STAGE_DATES.items():
        for date_str, images in sorted(date_groups.items()):
            if start_date <= date_str <= end_date:
                stage_images[stage_id].extend(images)
    
    print(f"\n🎬 準備各階段:", file=sys.stderr)
    for stage_id, images in stage_images.items():
        print(f"  Stage {stage_id}: {len(images)} 張圖像", file=sys.stderr)
    
    # Stage 0: Caption Mode
    if not args.no_caption and not args.dry_run:
        print("\n📽️ 推送標題頁…")
        caption_url = f"/?caption_mode=true&client={args.client}"
        caption_payload = {
            "layout": "grid",
            "gap": 0,
            "columns": 1,
            "panels": [{"id": "caption", "url": caption_url}],
            "target_client_id": args.client,
        }
        put_iframe_config(args.api_base, caption_payload)
        post_caption(
            args.api_base,
            text=args.caption_text,
            language=args.sub_lang,
            duration=args.caption_dur,
            client_id=args.client,
        )
        print(f"⏳ 顯示標題 {args.caption_dur:.1f} 秒…")
        time.sleep(max(0.0, float(args.caption_dur) + 1.0))
    
    # Stage 1: Ancestral Seeds (4×4)
    print("\n🎬 生成 Stage 1 payload…", file=sys.stderr)
    payload_seeds = build_daily_stage_payload(
        stage_images[1],
        args.client,
        columns=4,
        rows=4,
        gap=args.gap_seeds,
        metadata=metadata,
        enable_heatmap=args.enable_heatmap,
    )
    if args.dry_run:
        print("\n[DRY-RUN] Stage 1 - Ancestral Seeds:")
        print(f"  Panel count: {len(payload_seeds.get('panels', []))}")
        print(f"  Grid: {payload_seeds.get('columns')}×4")
        if payload_seeds.get('panels'):
            print(f"  Sample panel: {json.dumps(payload_seeds['panels'][0], ensure_ascii=False)}")
    else:
        put_iframe_config(args.api_base, payload_seeds)
        post_subtitle(
            args.api_base,
            text=args.sub_seeds,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )
        if args.hold_seeds > 0:
            print(f"⏳ 凝視祖先種子 {args.hold_seeds:.1f} 秒…")
            time.sleep(args.hold_seeds)
    
    # Stage 2: First Generation (8×8)
    print("🎬 生成 Stage 2 payload…", file=sys.stderr)
    payload_gen1 = build_daily_stage_payload(
        stage_images[2],
        args.client,
        columns=8,
        rows=8,
        gap=args.gap_gen1,
        metadata=metadata,
        enable_heatmap=args.enable_heatmap,
    )
    if args.dry_run:
        print("\n[DRY-RUN] Stage 2 - First Generation:")
        print(f"  Panel count: {len(payload_gen1.get('panels', []))}")
        print(f"  Grid: {payload_gen1.get('columns')}×8")
    else:
        put_iframe_config(args.api_base, payload_gen1)
        post_subtitle(
            args.api_base,
            text=args.sub_gen1,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )
        if args.hold_gen1 > 0:
            print(f"⏳ 觀察初次擴張 {args.hold_gen1:.1f} 秒…")
            time.sleep(args.hold_gen1)
    
    # Stage 3: Founder Event (12×12)
    print("🎬 生成 Stage 3 payload…", file=sys.stderr)
    payload_founder = build_daily_stage_payload(
        stage_images[3],
        args.client,
        columns=12,
        rows=12,
        gap=args.gap_founder,
        metadata=metadata,
        enable_heatmap=args.enable_heatmap,
    )
    if args.dry_run:
        print("\n[DRY-RUN] Stage 3 - Founder Event:")
        print(f"  Panel count: {len(payload_founder.get('panels', []))}")
        print(f"  Grid: {payload_founder.get('columns')}×12")
    else:
        put_iframe_config(args.api_base, payload_founder)
        post_subtitle(
            args.api_base,
            text=args.sub_founder,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )
        if args.hold_founder > 0:
            print(f"⏳ 體驗創始事件 {args.hold_founder:.1f} 秒…")
            time.sleep(args.hold_founder)
    
    # Stage 4: Coalescence Network (15×15 with heatmap)
    print("🎬 生成 Stage 4 payload (含熱圖)…", file=sys.stderr)
    payload_coalesce = build_daily_stage_payload(
        stage_images[4],
        args.client,
        columns=15,
        rows=15,
        gap=args.gap_coalesce,
        metadata=metadata,
        enable_heatmap=True,  # 強制啟用熱圖
    )
    if args.dry_run:
        print("\n[DRY-RUN] Stage 4 - Coalescence (with heatmap):")
        print(f"  Panel count: {len(payload_coalesce.get('panels', []))}")
        print(f"  Grid: {payload_coalesce.get('columns')}×15")
        sample_panels = payload_coalesce.get('panels', [])[:3]
        for i, p in enumerate(sample_panels):
            print(f"  Sample panel {i+1}: {json.dumps({k: v for k, v in p.items() if k != 'id'}, ensure_ascii=False)}")
    else:
        put_iframe_config(args.api_base, payload_coalesce)
        post_subtitle(
            args.api_base,
            text=args.sub_coalesce,
            client_id=args.client,
            language=args.sub_lang,
            duration=args.sub_dur,
        )
        if not args.no_concept:
            time.sleep(max(0.0, float(args.sub_dur) + 1.0))
            concept_texts = [
                "深層親緣：顏色記錄代數 — 紅色為古老祖先，藍色為新生後代。",
                "風格匯聚：多代混搭後，視覺語言逐步收斂為核心特徵。",
                "創始效應的迴響：十月四日的新種子，如今已融入整體系譜。",
                "圖像系譜學完成：一千多張圖像的演化故事，編織成生命之網。",
            ]
            for text in concept_texts:
                post_subtitle(
                    args.api_base,
                    text=text,
                    client_id=args.client,
                    language="zh-TW",
                    duration=max(3.0, float(args.sub_dur)),
                )
                time.sleep(max(0.0, float(args.sub_dur) + 1.0))
        
        if args.hold_coalesce > 0:
            print(f"⏳ 沉浸凝聚網絡 {args.hold_coalesce:.1f} 秒…")
            time.sleep(args.hold_coalesce)
    
    print("\n✅ 日期分層演化展示完成！")


if __name__ == "__main__":
    main()
