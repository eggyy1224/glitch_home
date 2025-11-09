#!/usr/bin/env python3
"""索引缺少 embedding 的圖片

使用 API 端點來索引圖片
"""

import sys
import json
from pathlib import Path

# 添加 backend 目錄到路徑
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

try:
    from app.config import settings
except ImportError:
    print("❌ 無法導入 app.config，請確認在 backend 目錄下執行")
    sys.exit(1)

try:
    import httpx
except ImportError:
    print("❌ 需要 httpx 模組")
    print("   請執行: pip install httpx")
    sys.exit(1)

import sqlite3
import time

def get_chroma_db_path():
    """取得 ChromaDB 路徑"""
    possible_paths = [
        Path(__file__).parent.parent / "embeddings" / "chroma" / "chroma.sqlite3",
        Path(settings.chroma_db_path) / "chroma.sqlite3",
    ]
    
    for path in possible_paths:
        if path.exists():
            return path
    
    return possible_paths[0]

def get_missing_images():
    """取得缺少 embedding 的圖片列表"""
    image_dir = Path(settings.offspring_dir)
    if not image_dir.exists():
        return []
    
    # 取得所有圖片檔案
    image_files = []
    for p in image_dir.iterdir():
        if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg"}:
            image_files.append(p.name)
    
    # 查詢資料庫中已有的 ID
    db_path = get_chroma_db_path()
    if not db_path.exists():
        return sorted(image_files)
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # 取得 collection ID
        cursor.execute("SELECT id FROM collections WHERE name='offspring_images'")
        collection_row = cursor.fetchone()
        
        if not collection_row:
            conn.close()
            return sorted(image_files)
        
        collection_id = collection_row[0]
        
        # 查詢資料庫中所有的 embedding_id
        cursor.execute("""
            SELECT DISTINCT e.embedding_id 
            FROM embeddings e
            JOIN segments s ON e.segment_id = s.id
            WHERE s.collection = ?
        """, (collection_id,))
        
        db_ids = {row[0] for row in cursor.fetchall()}
        conn.close()
        
        # 找出缺少的圖片
        file_set = set(image_files)
        missing = sorted(file_set - db_ids)
        
        return missing
        
    except Exception as e:
        print(f"⚠️  無法查詢資料庫，將索引所有圖片: {e}")
        return sorted(image_files)

def index_images(api_base="http://localhost:8000", batch_size=10, delay=1.0):
    """使用 API 索引缺少的圖片"""
    missing_images = get_missing_images()
    
    if not missing_images:
        print("✅ 所有圖片都已索引！")
        return
    
    total = len(missing_images)
    print(f"📊 找到 {total} 張缺少 embedding 的圖片")
    print(f"🚀 開始使用 API 索引...")
    print(f"🌐 API 基礎 URL: {api_base}")
    print()
    
    indexed = 0
    skipped = 0
    errors = 0
    error_details = []
    
    # 使用 httpx 客戶端
    with httpx.Client(timeout=60.0) as client:
        # 檢查 API 健康狀態
        try:
            health_response = client.get(f"{api_base}/health", timeout=5.0)
            if health_response.status_code != 200:
                print(f"⚠️  API 健康檢查失敗 (HTTP {health_response.status_code})")
                print("   繼續執行...")
        except Exception as e:
            print(f"⚠️  無法連接到 API: {e}")
            print("   請確認後端服務正在運行")
            print(f"   可以執行: curl {api_base}/health")
            return
        
        for i, basename in enumerate(missing_images, 1):
            try:
                # 調用 API
                response = client.post(
                    f"{api_base}/api/index/image",
                    json={"basename": basename, "force": False},
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    status = result.get("status", "unknown")
                    
                    if status == "indexed":
                        indexed += 1
                        dim = result.get("dim", "?")
                        print(f"  [{i}/{total}] ✅ {basename} (dim: {dim})")
                    elif status == "exists":
                        skipped += 1
                        print(f"  [{i}/{total}] ⏭️  {basename} (已存在)")
                    else:
                        errors += 1
                        error_msg = result.get("error", f"未知狀態: {status}")
                        error_details.append((basename, error_msg))
                        print(f"  [{i}/{total}] ❌ {basename} - {error_msg}")
                
                elif response.status_code == 404:
                    errors += 1
                    error_msg = f"圖片不存在 (HTTP 404)"
                    error_details.append((basename, error_msg))
                    print(f"  [{i}/{total}] ❌ {basename} - {error_msg}")
                
                else:
                    errors += 1
                    try:
                        error_text = response.text[:200]
                    except:
                        error_text = "無法讀取錯誤訊息"
                    error_msg = f"HTTP {response.status_code}: {error_text}"
                    error_details.append((basename, error_msg))
                    print(f"  [{i}/{total}] ❌ {basename} - {error_msg}")
            
            except httpx.TimeoutException:
                errors += 1
                error_msg = "請求超時"
                error_details.append((basename, error_msg))
                print(f"  [{i}/{total}] ❌ {basename} - {error_msg}")
            
            except Exception as e:
                errors += 1
                error_msg = str(e)
                error_details.append((basename, error_msg))
                print(f"  [{i}/{total}] ❌ {basename} - 錯誤: {e}")
            
            # 每處理一批後稍作延遲，避免 API 過載
            if i % batch_size == 0 and i < total:
                print(f"  ⏸️  已處理 {i}/{total}，暫停 {delay} 秒...")
                time.sleep(delay)
    
    print()
    print("=" * 60)
    print("📋 索引結果摘要")
    print("=" * 60)
    print(f"✅ 成功索引: {indexed} 張")
    print(f"⏭️  已存在（跳過）: {skipped} 張")
    print(f"❌ 錯誤: {errors} 張")
    print(f"📊 總計: {total} 張")
    
    if error_details:
        print()
        print("=" * 60)
        print("❌ 錯誤詳情（前 10 個）:")
        print("=" * 60)
        for basename, error in error_details[:10]:
            print(f"  {basename}: {error}")
        if len(error_details) > 10:
            print(f"  ... 還有 {len(error_details) - 10} 個錯誤")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="使用 API 索引缺少 embedding 的圖片")
    parser.add_argument(
        "--api-base",
        default="http://localhost:8000",
        help="API 基礎 URL (預設: http://localhost:8000)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="每批次處理的圖片數量，處理完一批後會暫停 (預設: 10)"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="批次之間的延遲時間（秒）(預設: 1.0)"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🚀 開始使用 API 索引缺少 embedding 的圖片")
    print("=" * 60)
    print(f"📁 圖片目錄: {settings.offspring_dir}")
    print(f"🗄️  ChromaDB 路徑: {settings.chroma_db_path}")
    print()
    
    index_images(
        api_base=args.api_base,
        batch_size=args.batch_size,
        delay=args.delay
    )
