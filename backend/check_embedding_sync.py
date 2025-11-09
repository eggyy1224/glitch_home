#!/usr/bin/env python3
"""檢查 offspring_images 資料夾中的圖片與 ChromaDB 的同步狀況

使用 SQLite 直接查詢 ChromaDB，不需要 Python 依賴
"""

import sqlite3
import sys
from pathlib import Path
from collections import defaultdict

def get_chroma_db_path():
    """取得 ChromaDB 路徑"""
    # 檢查多個可能的位置
    possible_paths = [
        # 1. 專案根目錄下的 embeddings/chroma
        Path(__file__).parent.parent / "embeddings" / "chroma" / "chroma.sqlite3",
        # 2. backend/chroma_db（預設）
        Path(__file__).parent / "chroma_db" / "chroma.sqlite3",
        # 3. 從環境變數讀取（如果有的話）
    ]
    
    # 檢查環境變數
    import os
    env_path = os.getenv("CHROMA_DB_PATH")
    if env_path:
        env_db_path = Path(env_path) / "chroma.sqlite3"
        if env_db_path.exists():
            return env_db_path
        # 如果環境變數直接指向檔案
        if Path(env_path).is_file():
            return Path(env_path)
    
    # 檢查可能的路徑
    for path in possible_paths:
        if path.exists():
            return path
    
    # 如果都不存在，返回第一個預設路徑（用於錯誤訊息）
    return possible_paths[0]

def get_offspring_dir():
    """取得 offspring_images 目錄路徑"""
    default_path = Path(__file__).parent / "offspring_images"
    return default_path

def main():
    """檢查圖片檔案與 ChromaDB 的同步狀況"""
    
    # 1. 取得所有圖片檔案
    image_dir = get_offspring_dir()
    if not image_dir.exists():
        print(f"❌ 圖片目錄不存在: {image_dir}")
        return
    
    # 取得所有圖片檔案（排除子目錄）
    image_files = []
    for p in image_dir.iterdir():
        if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg"}:
            image_files.append(p.name)
    
    image_files.sort()
    total_images = len(image_files)
    print(f"📁 圖片目錄: {image_dir}")
    print(f"📊 總圖片數量: {total_images}")
    print()
    
    # 2. 查詢 ChromaDB SQLite 資料庫
    db_path = get_chroma_db_path()
    if not db_path.exists():
        print(f"❌ ChromaDB 資料庫不存在: {db_path}")
        print("   這表示還沒有任何圖片被索引過")
        print()
        print("💡 建議操作：")
        print("   執行 POST /api/index/offspring 來索引所有圖片")
        return
    
    print(f"🗄️  ChromaDB 路徑: {db_path}")
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # 查詢 collection 名稱（預設是 offspring_images）
        cursor.execute("SELECT name FROM collections WHERE name LIKE '%images%' OR name = 'offspring_images'")
        collections = cursor.fetchall()
        
        if not collections:
            print("⚠️  找不到 images collection")
            conn.close()
            return
        
        collection_name = collections[0][0]
        print(f"📦 Collection 名稱: {collection_name}")
        
        # 查詢該 collection 的所有 ID
        # ChromaDB 的結構：ids 儲存在 embeddings 表中，透過 collection_id 關聯
        cursor.execute("""
            SELECT c.id as collection_id 
            FROM collections c 
            WHERE c.name = ?
        """, (collection_name,))
        collection_row = cursor.fetchone()
        
        if not collection_row:
            print("⚠️  找不到 collection 記錄")
            conn.close()
            return
        
        collection_id = collection_row[0]
        
        # 查詢該 collection 的所有記錄 ID
        # ChromaDB 結構：embeddings 表的 embedding_id 欄位就是檔名
        # 需要透過 segments 表來關聯 collection
        cursor.execute("""
            SELECT DISTINCT e.embedding_id 
            FROM embeddings e
            JOIN segments s ON e.segment_id = s.id
            WHERE s.collection = ?
        """, (collection_id,))
        
        db_ids = {row[0] for row in cursor.fetchall()}
        total_in_db = len(db_ids)
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ 查詢資料庫時發生錯誤: {e}")
        return
    except Exception as e:
        print(f"❌ 無法連接到 ChromaDB: {e}")
        return
    
    print(f"📊 資料庫中的記錄數: {total_in_db}")
    print()
    
    # 3. 比對檔案和資料庫
    file_set = set(image_files)
    
    # 找出缺少 embedding 的圖片
    missing_in_db = file_set - db_ids
    
    # 找出資料庫中有但檔案不存在的記錄（可能是舊記錄）
    missing_files = db_ids - file_set
    
    # 4. 顯示結果
    print("=" * 60)
    print("📋 同步狀況摘要")
    print("=" * 60)
    print(f"✅ 已同步: {len(file_set & db_ids)} 張")
    print(f"❌ 缺少 embedding: {len(missing_in_db)} 張")
    print(f"⚠️  資料庫中有但檔案不存在: {len(missing_files)} 筆")
    print()
    
    # 顯示缺少 embedding 的圖片（前 30 張）
    if missing_in_db:
        print("=" * 60)
        print(f"❌ 缺少 embedding 的圖片（顯示前 30 張，共 {len(missing_in_db)} 張）:")
        print("=" * 60)
        sorted_missing = sorted(missing_in_db)
        for i, filename in enumerate(sorted_missing[:30], 1):
            print(f"  {i:3d}. {filename}")
        if len(missing_in_db) > 30:
            print(f"  ... 還有 {len(missing_in_db) - 30} 張")
        print()
        
        # 按日期分組統計
        date_groups = defaultdict(int)
        for filename in missing_in_db:
            # 從檔名提取日期：offspring_YYYYMMDD_HHMMSS_XXX.png
            parts = filename.split('_')
            if len(parts) >= 2:
                date_str = parts[1]  # YYYYMMDD
                date_groups[date_str] += 1
        
        if date_groups:
            print("=" * 60)
            print("📅 缺少 embedding 的圖片按日期分組:")
            print("=" * 60)
            for date_str in sorted(date_groups.keys()):
                count = date_groups[date_str]
                print(f"  {date_str}: {count} 張")
            print()
    
    # 顯示資料庫中有但檔案不存在的記錄（前 10 筆）
    if missing_files:
        print("=" * 60)
        print(f"⚠️  資料庫中有但檔案不存在的記錄（顯示前 10 筆，共 {len(missing_files)} 筆）:")
        print("=" * 60)
        for i, db_id in enumerate(sorted(missing_files)[:10], 1):
            print(f"  {i}. {db_id}")
        if len(missing_files) > 10:
            print(f"  ... 還有 {len(missing_files) - 10} 筆")
        print()
    
    # 5. 建議
    print("=" * 60)
    print("💡 建議操作")
    print("=" * 60)
    if missing_in_db:
        print(f"執行以下 API 來索引缺少的 {len(missing_in_db)} 張圖片：")
        print()
        print("方法 1: 批次索引所有圖片（推薦）")
        print("  curl -X POST http://localhost:8000/api/index/offspring \\")
        print("    -H 'Content-Type: application/json'")
        print()
        print("方法 2: 分頁批次索引（適合大量圖片）")
        print("  curl -X POST http://localhost:8000/api/index/batch \\")
        print("    -H 'Content-Type: application/json' \\")
        print("    -d '{\"batch_size\": 50, \"offset\": 0, \"force\": false}'")
        print()
        print("方法 3: 強制重新索引所有圖片")
        print("  curl -X POST http://localhost:8000/api/index/offspring \\")
        print("    -H 'Content-Type: application/json' \\")
        print("    -d '{\"force\": true}'")
    else:
        print("✅ 所有圖片都已同步到 ChromaDB！")
    
    if missing_files:
        print()
        print(f"⚠️  建議清理資料庫中不存在的檔案記錄（共 {len(missing_files)} 筆）")
        print("   這些可能是已刪除的圖片留下的舊記錄")

if __name__ == "__main__":
    main()

